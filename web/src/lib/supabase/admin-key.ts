export type SupabaseAdminKeyResult =
  | { key: string; error: null }
  | { key: null; error: string };

export function getSupabaseAdminKey(): SupabaseAdminKeyResult {
  const key = (
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    ""
  ).trim();
  const publishableKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""
  ).trim();

  if (!key) {
    return {
      key: null,
      error:
        "Account deletion is not configured yet. Add a Supabase secret key to the server environment.",
    };
  }

  if (key === publishableKey || key.startsWith("sb_publishable_")) {
    return {
      key: null,
      error:
        "SUPABASE_SECRET_KEY contains a publishable key. Replace it with the server-only key beginning with sb_secret_, then restart the app.",
    };
  }

  return { key, error: null };
}
