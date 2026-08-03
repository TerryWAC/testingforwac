import { NextResponse } from "next/server";
import { z } from "zod";

import { replaceCsvFilms } from "@/lib/db";
import { parseExportZip } from "@/lib/import";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/friends/import — multipart form: friendId, zip.
 *
 * Letterboxd's public RSS feed only exposes a friend's ~50 most recent
 * entries, so a friend added by username has a shallow library. If they send
 * you their export ZIP, this replaces that shallow copy with their full
 * history. The raw ZIP is discarded after parsing.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const parsed = z
    .object({ friendId: z.string().uuid() })
    .safeParse({ friendId: form.get("friendId") });
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const zip = form.get("zip");
  if (!(zip instanceof File)) {
    return NextResponse.json({ error: "Missing ZIP file" }, { status: 400 });
  }

  const admin = createAdminClient();

  // The friend row must belong to the caller — this is the only ownership check
  // standing between a user and someone else's profile.
  const { data: friend } = await admin
    .from("friends")
    .select("id, profile_id")
    .eq("id", parsed.data.friendId)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!friend) return NextResponse.json({ error: "Friend not found" }, { status: 404 });

  // Never write into a real signed-in account's library, only a guest profile.
  const { data: guest } = await admin
    .from("profiles")
    .select("id, is_guest, letterboxd_username")
    .eq("id", friend.profile_id)
    .maybeSingle();
  if (!guest?.is_guest) {
    return NextResponse.json({ error: "That profile can't be imported into" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await zip.arrayBuffer());
    const { films, summary } = await parseExportZip(buffer);
    const totalUpserted = await replaceCsvFilms(friend.profile_id, films);
    return NextResponse.json({ summary: { ...summary, totalUpserted } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 400 }
    );
  }
}
