import { redirect } from "next/navigation";
import ScheduleForm from "@/components/dashboard/ScheduleForm";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewSchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <ScheduleForm userId={user.id} />;
}
