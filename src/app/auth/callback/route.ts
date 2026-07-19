import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/** Magic-link landing: exchange the code for a session, then route by profile state. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        return NextResponse.redirect(new URL(profile ? "/dashboard" : "/setup", url.origin));
      }
    }
  }

  return NextResponse.redirect(new URL("/?error=auth", url.origin));
}
