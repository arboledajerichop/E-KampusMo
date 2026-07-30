import { redirect } from "next/navigation";
import AccountDeletionPanel from "@/components/dashboard/AccountDeletionPanel";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const fullName =
    typeof user.user_metadata?.full_name === "string" &&
    user.user_metadata.full_name.trim()
      ? user.user_metadata.full_name.trim()
      : "Student";

  return (
    <>
      <DashboardPageHeader
        eyebrow="Your account"
        title="Profile & settings"
        description="Review the identity connected to this student workspace and manage your account."
      />

      <section className="mt-8 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-[8px] bg-[var(--ink)] text-sm font-bold text-[var(--surface)]">
            {fullName.slice(0, 1).toUpperCase()}
          </span>

          <div>
            <h2 className="text-lg font-bold text-[var(--ink)]">
              {fullName}
            </h2>

            <p className="mt-1 text-sm text-[var(--muted)]">
              {user.email}
            </p>
          </div>
        </div>

        <dl className="mt-7 grid gap-5 border-t border-[var(--line)] pt-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold text-[var(--muted)]">
              Account ID
            </dt>

            <dd className="mt-1 break-all font-mono text-xs text-[var(--ink-soft)]">
              {user.id}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-semibold text-[var(--muted)]">
              Email status
            </dt>

            <dd className="mt-1 text-sm font-bold text-[var(--teal)]">
              {user.email_confirmed_at
                ? "Confirmed"
                : "Confirmation pending"}
            </dd>
          </div>
        </dl>
      </section>

      <AccountDeletionPanel
        userId={user.id}
        email={user.email ?? "your registered email"}
      />
    </>
  );
}