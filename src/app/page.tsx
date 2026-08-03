import { redirect } from "next/navigation";

import { Attribution } from "@/components/Attribution";
import { LoginForm } from "@/components/LoginForm";
import { safeNextPath } from "@/lib/nextPath";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const next = safeNextPath(searchParams.next);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    redirect(profile ? (next ?? "/dashboard") : "/setup");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-10 text-center">
        <div className="mb-3 flex justify-center gap-1.5" aria-hidden>
          <span className="h-4 w-4 rounded-full bg-accent-orange" />
          <span className="h-4 w-4 rounded-full bg-accent" />
          <span className="h-4 w-4 rounded-full bg-accent-blue" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Letterboxd Night</h1>
        <p className="mt-2 text-sm text-night-400">
          Turn your Letterboxd library into tonight&apos;s perfect pick.
        </p>
      </div>
      <LoginForm next={next} />
      <p className="mt-8 text-center text-xs text-night-400">
        One-time import of your official Letterboxd export — then it stays up to date by itself.
        No scraping, no passwords.
      </p>
      <Attribution className="mt-6" />
    </main>
  );
}
