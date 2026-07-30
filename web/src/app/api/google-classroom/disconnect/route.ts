import { NextResponse } from "next/server";
import {
  CLASSROOM_TOKEN_COOKIE,
  googleClassroomCookieOptions,
} from "@/lib/google-classroom/server";
import {
  addRateLimitHeaders,
  checkRateLimit,
  clearPrivateCache,
  isSameOriginRequest,
  rateLimitedJson,
} from "@/lib/security/api-protection";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "This request was not accepted." },
      { status: 403 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 },
    );
  }

  const rateLimit = await checkRateLimit(
    supabase,
    user.id,
    "classroom-disconnect",
  );
  if (!rateLimit.allowed) {
    return rateLimitedJson(
      rateLimit,
      "Too many disconnect attempts were made. Please wait before trying again.",
    );
  }

  clearPrivateCache("google-classroom-coursework", user.id);
  const response = NextResponse.json({ disconnected: true });
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(
    CLASSROOM_TOKEN_COOKIE,
    "",
    googleClassroomCookieOptions(request, 0),
  );
  return addRateLimitHeaders(response, rateLimit);
}
