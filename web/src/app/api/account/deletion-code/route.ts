import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  addRateLimitHeaders,
  checkRateLimit,
  isSameOriginRequest,
  rateLimitedJson,
} from "@/lib/security/api-protection";
import { getSupabaseAdminKey } from "@/lib/supabase/admin-key";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return jsonError("This request was not accepted.", 403);
  }

  const authenticatedClient = await createClient();
  const {
    data: { user },
    error: userError,
  } = await authenticatedClient.auth.getUser();

  if (userError || !user?.email) {
    return jsonError("Sign in again before deleting your account.", 401);
  }

  const rateLimit = await checkRateLimit(
    authenticatedClient,
    user.id,
    "account-deletion-code",
  );
  if (!rateLimit.allowed) {
    return rateLimitedJson(
      rateLimit,
      "Too many verification codes were requested. Please wait before trying again.",
    );
  }

  const adminKey = getSupabaseAdminKey();
  if (adminKey.error) {
    return addRateLimitHeaders(jsonError(adminKey.error, 503), rateLimit);
  }

  const otpClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
  const { error } = await otpClient.auth.signInWithOtp({
    email: user.email,
    options: {
      shouldCreateUser: false,
    },
  });

  if (error) {
    return addRateLimitHeaders(
      jsonError(
        error.code === "over_email_send_rate_limit"
          ? "Please wait before requesting another verification code."
          : "The verification code could not be sent. Please try again.",
        error.status ?? 400,
      ),
      rateLimit,
    );
  }

  return addRateLimitHeaders(
    Response.json({
      email: user.email,
      message: "A verification code was sent to your registered email.",
    }),
    rateLimit,
  );
}
