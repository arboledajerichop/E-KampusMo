import { redirect } from "next/navigation";
import AccountDeletionPanel from "@/components/dashboard/AccountDeletionPanel";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import Icon from "@/components/Icons";
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
        description="Review the identity connected to this student workspace and its current data status."
      />

      <div className="mt-8 grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <section className="rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-[8px] bg-[var(--ink)] text-sm font-bold text-[var(--surface)]">
              {fullName.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h2 className="text-lg font-bold text-[var(--ink)]">{fullName}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{user.email}</p>
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
                {user.email_confirmed_at ? "Confirmed" : "Confirmation pending"}
              </dd>
            </div>
          </dl>
        </section>

        <aside className="rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
          <span className="grid h-10 w-10 place-items-center rounded-[11px] bg-[var(--teal-soft)] text-[var(--teal)]">
            <Icon name="signal" className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-[var(--ink)]">
            Cloud sync with offline cache
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Student records synchronize with Supabase under your account ID.
            Device copies keep your workspace usable during connection
            interruptions.
          </p>
          <p className="mt-4 rounded-[10px] bg-[var(--surface-soft)] px-4 py-3 text-xs leading-5 text-[var(--muted-strong)]">
            Documents and images use private Storage folders protected by the
            same signed-in-user rules. The dashboard header reports the current
            synchronization state.
          </p>
        </aside>
      </div>

      <AccountDeletionPanel
        userId={user.id}
        email={user.email ?? "your registered email"}
      />
    </>
  );
}
