import { redirect } from "next/navigation";

import { SetupWizard } from "@/components/SetupWizard";
import { createClient } from "@/lib/supabase/server";

export default async function SetupPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, letterboxd_username, rss_url")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-lg px-6 py-10">
      {profile && (
        <a href="/dashboard" className="mb-4 inline-block text-sm font-semibold text-accent hover:underline">
          ← Back to the app
        </a>
      )}
      <h1 className="text-2xl font-bold text-white">Set up your profile</h1>
      <p className="mt-1 text-sm text-night-400">
        One-time setup — your library is stored permanently, no re-uploading.
      </p>
      <div className="mt-8">
        <SetupWizard
          existingProfile={
            profile
              ? { username: profile.letterboxd_username, rssUrl: profile.rss_url }
              : null
          }
        />
      </div>
    </main>
  );
}
