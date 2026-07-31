import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headersToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });

          Object.entries(headersToSet).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    },
  );

  // Keep this call immediately after creating the client. It verifies the
  // access token and refreshes expired cookies for Server Components.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;

  const path = request.nextUrl.pathname;
  const isProtectedPath = path.startsWith("/dashboard");
  const isGuestOnlyPath = path === "/login" || path === "/register";

  if ((!claims && isProtectedPath) || (claims && isGuestOnlyPath)) {
    const destination = request.nextUrl.clone();
    destination.pathname = claims ? "/dashboard" : "/login";
    destination.search = "";

    if (!claims) {
      destination.searchParams.set("next", path);
    }

    const redirectResponse = NextResponse.redirect(destination);

    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    ["cache-control", "expires", "pragma"].forEach((header) => {
      const value = response.headers.get(header);
      if (value) {
        redirectResponse.headers.set(header, value);
      }
    });

    return redirectResponse;
  }

  return response;
}
