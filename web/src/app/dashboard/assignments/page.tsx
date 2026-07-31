import { redirect } from "next/navigation";
import AssignmentsClient from "@/components/dashboard/AssignmentsClient";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  return <AssignmentsClient userId={user.id} />;
}
