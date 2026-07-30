import { redirect } from "next/navigation";
import RemindersClient from "@/components/dashboard/RemindersClient";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <RemindersClient userId={user.id} />;
}
