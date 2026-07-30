import { redirect } from "next/navigation";
import { ConfirmationProvider } from "@/components/dashboard/ConfirmationDialog";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    <ConfirmationProvider>
      <DashboardShell fullName={fullName}>{children}</DashboardShell>
    </ConfirmationProvider>
  );
}
