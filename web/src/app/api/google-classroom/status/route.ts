import { type NextRequest, NextResponse } from "next/server";
import {
  CLASSROOM_TOKEN_COOKIE,
  decryptGoogleClassroomToken,
  isGoogleClassroomConfigured,
} from "@/lib/google-classroom/server";
import {
  addRateLimitHeaders,
  checkRateLimit,
  rateLimitedJson,
} from "@/lib/security/api-protection";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { configured: false, connected: false, code: "unauthorized" },
      { status: 401 },
    );
  }

  const rateLimit = await checkRateLimit(
    supabase,
    user.id,
    "classroom-status",
  );
  if (!rateLimit.allowed) {
    return rateLimitedJson(
      rateLimit,
      "Too many status checks were made. Please wait a moment.",
    );
  }

  const configured = isGoogleClassroomConfigured();
  const token = configured
    ? decryptGoogleClassroomToken(
        request.cookies.get(CLASSROOM_TOKEN_COOKIE)?.value,
      )
    : null;
  const connected = Boolean(
    token &&
      token.userId === user.id &&
      (token.expiresAt > Date.now() || token.refreshToken),
  );

  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  return addRateLimitHeaders(NextResponse.json(
    { configured, connected },
    {
      headers: {
        "Cache-Control": forceRefresh
          ? "no-store"
          : "private, max-age=5",
        Vary: "Cookie",
      },
    },
  ), rateLimit);
}
