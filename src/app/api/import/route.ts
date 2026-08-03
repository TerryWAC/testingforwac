import { NextResponse } from "next/server";

import { replaceCsvFilms } from "@/lib/db";
import { parseExportZip } from "@/lib/import";
import { setupSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIMITS, rateLimit } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/import — multipart form: username, rssUrl, zip.
 * Creates/updates the profile, parses the ZIP server-side, and replaces the
 * CSV-sourced library. The raw ZIP is discarded after parsing.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const limited = rateLimit("import", user.id, LIMITS.upload);
  if (limited) return limited;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const parsed = setupSchema.safeParse({
    username: form.get("username"),
    rssUrl: form.get("rssUrl"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const zip = form.get("zip");
  if (!(zip instanceof File)) {
    return NextResponse.json({ error: "Missing ZIP file" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await zip.arrayBuffer());
    const { films, summary } = await parseExportZip(buffer);

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          letterboxd_username: parsed.data.username,
          rss_url: parsed.data.rssUrl,
          is_guest: false,
        },
        { onConflict: "user_id" }
      )
      .select("id")
      .single();
    if (profileError || !profile) {
      throw new Error(profileError?.message ?? "Could not save profile");
    }

    await admin
      .from("preferences")
      .upsert({ profile_id: profile.id }, { onConflict: "profile_id", ignoreDuplicates: true });

    const totalUpserted = await replaceCsvFilms(profile.id, films);

    return NextResponse.json({ summary: { ...summary, totalUpserted } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 400 }
    );
  }
}
