import { redirect } from "next/navigation";
import FinanceClient from "@/components/dashboard/FinanceClient";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <FinanceClient userId={user.id} />;
}
