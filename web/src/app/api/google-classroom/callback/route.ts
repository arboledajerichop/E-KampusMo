import { type NextRequest, NextResponse } from "next/server";
import {
  CLASSROOM_STATE_COOKIE,
  CLASSROOM_TOKEN_COOKIE,
  CLASSROOM_VERIFIER_COOKIE,
  encryptGoogleClassroomToken,
  exchangeGoogleClassroomCode,
  getGoogleClassroomRedirectUri,
  googleClassroomCookieOptions,
  isGoogleClassroomConfigured,
} from "@/lib/google-classroom/server";
import {
  addRateLimitHeaders,
  checkRateLimit,
  clearPrivateCache,
} from "@/lib/security/api-protection";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function redirectWithResult(
  request: Request,
  result:
    | "connected"
    | "denied"
    | "failed"
    | "not-configured"
    | "rate-limited",
) {
  const destination = new URL("/dashboard/assignments", request.url);
  if (result === "connected") {
    destination.searchParams.set("classroom", "connected");
  } else {
    destination.searchParams.set("classroom_error", result);
  }
  return NextResponse.redirect(destination);
}

export async function GET(request: NextRequest) {
  if (!isGoogleClassroomConfigured()) {
    return redirectWithResult(request, "not-configured");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/login?next=/dashboard/assignments", request.url),
    );
  }

  const rateLimit = await checkRateLimit(
    supabase,
    user.id,
    "classroom-callback",
  );
  if (!rateLimit.allowed) {
    return addRateLimitHeaders(
      redirectWithResult(request, "rate-limited"),
      rateLimit,
    );
  }

  if (request.nextUrl.searchParams.get("error")) {
    return addRateLimitHeaders(
      redirectWithResult(request, "denied"),
      rateLimit,
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(CLASSROOM_STATE_COOKIE)?.value;
  const verifier = request.cookies.get(CLASSROOM_VERIFIER_COOKIE)?.value;

  if (
    !code ||
    !state ||
    !expectedState ||
    state !== expectedState ||
    !verifier
  ) {
    return addRateLimitHeaders(
      redirectWithResult(request, "failed"),
      rateLimit,
    );
  }

  try {
    const token = await exchangeGoogleClassroomCode({
      code,
      verifier,
      redirectUri: getGoogleClassroomRedirectUri(request),
      userId: user.id,
    });
    clearPrivateCache("google-classroom-coursework", user.id);
    const response = redirectWithResult(request, "connected");
    response.cookies.set(
      CLASSROOM_TOKEN_COOKIE,
      encryptGoogleClassroomToken(token),
      googleClassroomCookieOptions(request, 30 * 24 * 60 * 60),
    );
    response.cookies.set(
      CLASSROOM_STATE_COOKIE,
      "",
      googleClassroomCookieOptions(request, 0),
    );
    response.cookies.set(
      CLASSROOM_VERIFIER_COOKIE,
      "",
      googleClassroomCookieOptions(request, 0),
    );
    return addRateLimitHeaders(response, rateLimit);
  } catch {
    return addRateLimitHeaders(
      redirectWithResult(request, "failed"),
      rateLimit,
    );
  }
}
