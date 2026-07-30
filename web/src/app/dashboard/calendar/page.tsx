import { redirect } from "next/navigation";
import CalendarClient from "@/components/dashboard/CalendarClient";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <CalendarClient userId={user.id} />;
}
