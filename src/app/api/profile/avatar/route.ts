import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  // Small client-resized JPEG/PNG data URL — stored inline, no bucket needed.
  dataUrl: z
    .string()
    .max(200_000)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
});

/** POST /api/profile/avatar — set the user's profile photo. */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid image — try a smaller photo" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ avatar_url: parsed.data.dataUrl })
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/** DELETE /api/profile/avatar — remove the photo (back to the initial). */
export async function DELETE() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const admin = createAdminClient();
  await admin.from("profiles").update({ avatar_url: null }).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
