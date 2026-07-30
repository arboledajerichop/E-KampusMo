import { redirect } from "next/navigation";
import InternshipClient from "@/components/dashboard/InternshipClient";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function InternshipPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <InternshipClient userId={user.id} />;
}
