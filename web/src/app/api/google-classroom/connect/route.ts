import { NextResponse } from "next/server";
import {
  CLASSROOM_STATE_COOKIE,
  CLASSROOM_VERIFIER_COOKIE,
  createGoogleClassroomState,
  createPkceChallenge,
  createPkceVerifier,
  googleClassroomAuthorizationUrl,
  googleClassroomCookieOptions,
  isGoogleClassroomConfigured,
} from "@/lib/google-classroom/server";
import {
  addRateLimitHeaders,
  checkRateLimit,
} from "@/lib/security/api-protection";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const assignmentsUrl = new URL("/dashboard/assignments", request.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", "/dashboard/assignments");
    return NextResponse.redirect(loginUrl);
  }

  if (!isGoogleClassroomConfigured()) {
    assignmentsUrl.searchParams.set(
      "classroom_error",
      "not-configured",
    );
    return NextResponse.redirect(assignmentsUrl);
  }

  const rateLimit = await checkRateLimit(
    supabase,
    user.id,
    "classroom-connect",
  );
  if (!rateLimit.allowed) {
    assignmentsUrl.searchParams.set("classroom_error", "rate-limited");
    return addRateLimitHeaders(
      NextResponse.redirect(assignmentsUrl),
      rateLimit,
    );
  }

  const state = createGoogleClassroomState();
  const verifier = createPkceVerifier();
  const response = NextResponse.redirect(
    googleClassroomAuthorizationUrl({
      request,
      state,
      challenge: createPkceChallenge(verifier),
    }),
  );
  response.cookies.set(
    CLASSROOM_STATE_COOKIE,
    state,
    googleClassroomCookieOptions(request, 10 * 60),
  );
  response.cookies.set(
    CLASSROOM_VERIFIER_COOKIE,
    verifier,
    googleClassroomCookieOptions(request, 10 * 60),
  );
  return addRateLimitHeaders(response, rateLimit);
}
