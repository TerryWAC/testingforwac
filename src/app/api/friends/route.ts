import { NextResponse } from "next/server";
import { z } from "zod";

import { syncProfileFromRss } from "@/lib/db";
import { usernameSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { LETTERBOXD_RSS_URL } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_FRIENDS = 20;

/**
 * POST /api/friends — add a friend by Letterboxd username. Creates a guest
 * profile from their public activity and links it to the current user.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = z
    .object({ username: usernameSchema })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }
  const username = parsed.data.username;

  const admin = createAdminClient();

  const { data: existingFriends } = await admin
    .from("friends")
    .select("id, profiles!inner(letterboxd_username)")
    .eq("owner_user_id", user.id);

  if ((existingFriends?.length ?? 0) >= MAX_FRIENDS) {
    return NextResponse.json({ error: `Friend limit reached (${MAX_FRIENDS})` }, { status: 400 });
  }
  const duplicate = (existingFriends ?? []).some(
    (f) =>
      (f.profiles as unknown as { letterboxd_username: string }).letterboxd_username.toLowerCase() ===
      username.toLowerCase()
  );
  if (duplicate) {
    return NextResponse.json({ error: `@${username} is already in your friends` }, { status: 400 });
  }

  try {
    const { data: guest, error } = await admin
      .from("profiles")
      .insert({ letterboxd_username: username, rss_url: LETTERBOXD_RSS_URL(username), is_guest: true })
      .select("id, rss_url")
      .single();
    if (error || !guest) throw new Error(error?.message ?? "Could not create friend profile");

    const { added } = await syncProfileFromRss(guest);
    if (added === 0) {
      // Feed reachable but empty — keep the friend, they may log films later.
    }

    const { error: linkError } = await admin
      .from("friends")
      .insert({ owner_user_id: user.id, profile_id: guest.id });
    if (linkError) throw new Error(linkError.message);

    return NextResponse.json({ ok: true, filmsImported: added });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not add friend";
    return NextResponse.json(
      {
        error: message.includes("404")
          ? `Couldn't find @${username} — check the spelling and that their account is public.`
          : message,
      },
      { status: 400 }
    );
  }
}

/** DELETE /api/friends — remove a friend (and their guest profile data). */
export async function DELETE(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = z
    .object({ friendId: z.string().uuid() })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const admin = createAdminClient();
  const { data: friend } = await admin
    .from("friends")
    .select("id, profile_id")
    .eq("id", parsed.data.friendId)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!friend) return NextResponse.json({ error: "Friend not found" }, { status: 404 });

  // Deleting the guest profile cascades to films and the friends row.
  const { error } = await admin.from("profiles").delete().eq("id", friend.profile_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
