import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Every signed-in route. Each page also guards itself server-side, but
// bouncing here avoids rendering a page we're about to throw away — and the
// list had drifted badly behind the app, so most routes were rendering first
// and redirecting second.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/setup",
  "/compare",
  "/profile",
  "/stats",
  "/wrapped",
  "/play",
  "/tonight",
  "/faceoff",
  "/veto",
  "/wheel",
  "/slots",
  "/match",
  "/double",
  "/coin",
  "/coming",
  "/people",
  "/gauntlet",
  "/join",
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session cookie on every request.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (!user && PROTECTED_PREFIXES.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    // Remember where they were headed so login lands them there, not on a
    // generic dashboard — this is what made shared /join invite links break.
    const intended = `${path}${request.nextUrl.search}`;
    url.search = intended === "/" ? "" : `?next=${encodeURIComponent(intended)}`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
