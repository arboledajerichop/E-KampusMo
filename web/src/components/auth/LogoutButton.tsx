"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icons";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton({
  collapsible = false,
}: {
  collapsible?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);

    const supabase = createClient();
    await supabase.auth.signOut();

    router.replace("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      title={collapsible ? "Log out" : undefined}
      className={`inline-flex min-h-10 w-full items-center gap-3 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] text-sm font-bold text-[var(--muted-strong)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60 ${
        collapsible ? "justify-start px-[14px]" : "justify-center px-4"
      }`}
    >
      <Icon name="arrow" className="h-5 w-5 shrink-0 rotate-180" />
      <span
        className={
          collapsible
            ? "translate-x-1 whitespace-nowrap opacity-0 transition-[opacity,transform] duration-150 group-hover/sidebar:translate-x-0 group-hover/sidebar:opacity-100 group-focus-within/sidebar:translate-x-0 group-focus-within/sidebar:opacity-100"
            : undefined
        }
      >
        {loading ? "Logging out…" : "Log out"}
      </span>
    </button>
  );
}
