import { type NextRequest, NextResponse } from "next/server";
import {
  CLASSROOM_TOKEN_COOKIE,
  decryptGoogleClassroomToken,
  isGoogleClassroomConnectionRevoked,
  isGoogleClassroomConfigured,
  loadStoredGoogleClassroomToken,
  saveStoredGoogleClassroomToken,
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
  const cookieToken = configured
    ? decryptGoogleClassroomToken(
        request.cookies.get(CLASSROOM_TOKEN_COOKIE)?.value,
      )
    : null;
  let token = null;
  let revoked = false;
  try {
    revoked = Boolean(
      await isGoogleClassroomConnectionRevoked(supabase, user.id),
    );
    if (!revoked) {
      const storedToken = await loadStoredGoogleClassroomToken(user.id);
      if (storedToken) token = storedToken;
      else if (cookieToken?.userId === user.id) {
        await saveStoredGoogleClassroomToken(cookieToken);
        token = cookieToken;
      }
    }
  } catch {
    // The browser cookie remains a safe fallback while the optional account
    // connection table is being provisioned.
    if (cookieToken?.userId === user.id) {
      token = cookieToken;
    }
  }
  const connected = Boolean(
    token &&
      token.userId === user.id &&
      (token.expiresAt > Date.now() || token.refreshToken),
  );

  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const response = NextResponse.json(
    { configured, connected },
    {
      headers: {
        "Cache-Control": forceRefresh
          ? "no-store"
          : "private, max-age=5",
        Vary: "Cookie",
      },
    },
  );
  if (revoked && cookieToken?.userId === user.id) {
    response.cookies.set(
      CLASSROOM_TOKEN_COOKIE,
      "",
      {
        httpOnly: true,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        path: "/",
        maxAge: 0,
      },
    );
  }
  return addRateLimitHeaders(response, rateLimit);
}
