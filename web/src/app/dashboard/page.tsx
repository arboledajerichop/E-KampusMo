import { redirect } from "next/navigation";
import TodayDashboard from "@/components/dashboard/TodayDashboard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
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
  const firstName = fullName.split(/\s+/)[0];
  const dateLabel = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <TodayDashboard
      userId={user.id}
      firstName={firstName}
      dateLabel={dateLabel}
    />
  );
}
