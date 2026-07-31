import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  CLASSROOM_TOKEN_COOKIE,
  googleClassroomCookieOptions,
} from "@/lib/google-classroom/server";
import {
  addRateLimitHeaders,
  checkRateLimit,
  isSameOriginRequest,
  rateLimitedJson,
} from "@/lib/security/api-protection";
import { getSupabaseAdminKey } from "@/lib/supabase/admin-key";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PRIVATE_BUCKETS = ["student-files", "internship-photos"] as const;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function listUserObjects(
  client: SupabaseClient,
  bucket: string,
  folder: string,
): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await client.storage
      .from(bucket)
      .list(folder, { limit: 100, offset });
    if (error) throw error;
    if (!data?.length) break;

    for (const item of data) {
      const path = `${folder}/${item.name}`;
      if (item.id) {
        paths.push(path);
      } else {
        paths.push(...(await listUserObjects(client, bucket, path)));
      }
    }

    if (data.length < 100) break;
    offset += data.length;
  }

  return paths;
}

async function removeUserObjects(
  client: SupabaseClient,
  userId: string,
) {
  const { data: buckets, error: bucketsError } =
    await client.storage.listBuckets();
  if (bucketsError) throw bucketsError;
  const availableBuckets = new Set(buckets.map((bucket) => bucket.name));

  for (const bucket of PRIVATE_BUCKETS) {
    if (!availableBuckets.has(bucket)) continue;

    const paths = await listUserObjects(client, bucket, userId);
    for (let index = 0; index < paths.length; index += 100) {
      const { error } = await client.storage
        .from(bucket)
        .remove(paths.slice(index, index + 100));
      if (error) throw error;
    }
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return jsonError("This request was not accepted.", 403);
  }

  const authenticatedClient = await createClient();
  const {
    data: { user: currentUser },
    error: userError,
  } = await authenticatedClient.auth.getUser();
  if (userError || !currentUser?.email) {
    return jsonError("Sign in again before deleting your account.", 401);
  }

  const rateLimit = await checkRateLimit(
    authenticatedClient,
    currentUser.id,
    "account-delete",
  );
  if (!rateLimit.allowed) {
    return rateLimitedJson(
      rateLimit,
      "Too many deletion attempts were made. Please wait before trying again.",
    );
  }

  const adminKey = getSupabaseAdminKey();
  if (!adminKey.key) {
    return addRateLimitHeaders(
      jsonError(
        adminKey.error ?? "Account deletion is not configured yet.",
        503,
      ),
      rateLimit,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return addRateLimitHeaders(
      jsonError("Enter the verification code from your email.", 400),
      rateLimit,
    );
  }
  const code =
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    typeof body.code === "string"
      ? body.code.replace(/\s/g, "")
      : "";
  if (!/^\d{6,8}$/.test(code)) {
    return addRateLimitHeaders(
      jsonError("Enter the 6 to 8 digit verification code.", 400),
      rateLimit,
    );
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
  const {
    data: verification,
    error: verificationError,
  } = await otpClient.auth.verifyOtp({
    email: currentUser.email,
    token: code,
    type: "email",
  });

  if (
    verificationError ||
    !verification.user ||
    verification.user.id !== currentUser.id
  ) {
    return addRateLimitHeaders(
      jsonError(
        "That verification code is incorrect or has expired.",
        400,
      ),
      rateLimit,
    );
  }

  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    adminKey.key,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );

  try {
    await removeUserObjects(adminClient, currentUser.id);
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(
      currentUser.id,
      false,
    );
    if (deleteError) throw deleteError;
  } catch (reason) {
    console.error(
      "Supabase account deletion failed:",
      reason instanceof Error ? reason.message : "Unknown Supabase error",
    );
    return addRateLimitHeaders(
      jsonError(
        "Your account deletion could not be completed. Please try again; any remaining records are still private.",
        500,
      ),
      rateLimit,
    );
  }

  const response = NextResponse.json({ deleted: true });
  response.cookies.set(
    CLASSROOM_TOKEN_COOKIE,
    "",
    googleClassroomCookieOptions(request, 0),
  );
  return addRateLimitHeaders(response, rateLimit);
}
