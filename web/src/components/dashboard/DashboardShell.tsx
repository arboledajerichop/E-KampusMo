"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Brand from "@/components/Brand";
import Icon from "@/components/Icons";
import LogoutButton from "@/components/auth/LogoutButton";
import { useCloudSyncStatus } from "@/lib/supabase/cloud-sync";

const dashboardNav = [
  { label: "Today", icon: "home", href: "/dashboard" },
  {
    label: "Class Schedule",
    icon: "calendar",
    href: "/dashboard/calendar",
  },
  {
    label: "Assignments",
    icon: "tasks",
    href: "/dashboard/assignments",
  },
  {
    label: "Notepad",
    icon: "notepad",
    href: "/dashboard/notepad",
  },
  {
    label: "Internship",
    icon: "briefcase",
    href: "/dashboard/internship",
  },
  {
    label: "Expenses",
    icon: "wallet",
    href: "/dashboard/expenses",
  },
  {
    label: "Reminders",
    icon: "bell",
    href: "/dashboard/reminders",
  },
] as const;

type NavigationItem = (typeof dashboardNav)[number];

function isCurrentPath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLink({
  item,
  pathname,
}: {
  item: NavigationItem;
  pathname: string;
}) {
  const active = isCurrentPath(pathname, item.href);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={`flex min-h-10 items-center gap-3 rounded-[7px] px-[14px] text-sm font-semibold ${
        active
          ? "bg-[var(--ink)] text-[var(--surface)]"
          : "text-[var(--muted-strong)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
      }`}
    >
      <Icon name={item.icon} className="h-5 w-5 shrink-0" />
      <span className="translate-x-1 whitespace-nowrap opacity-0 transition-[opacity,transform] duration-150 group-hover/sidebar:translate-x-0 group-hover/sidebar:opacity-100 group-focus-within/sidebar:translate-x-0 group-focus-within/sidebar:opacity-100">
        {item.label}
      </span>
    </Link>
  );
}

function MobileNavigationLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavigationItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const active = isCurrentPath(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-12 items-center gap-3 rounded-[10px] px-4 text-sm font-semibold transition-colors ${
        active
          ? "bg-[var(--ink)] text-[var(--surface)]"
          : "text-[var(--muted-strong)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
      }`}
    >
      <Icon name={item.icon} className="h-5 w-5 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}

export default function DashboardShell({
  fullName,
  children,
}: {
  fullName: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const firstInitial = fullName.slice(0, 1).toUpperCase();
  const syncStatus = useCloudSyncStatus();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [mobileMenuOpen]);

  return (
    <div className="min-h-screen bg-[var(--canvas)] lg:grid lg:grid-cols-[72px_1fr]">
      <aside className="group/sidebar z-50 hidden w-[72px] overflow-hidden border-r border-[var(--line)] bg-[var(--surface)] transition-[width,box-shadow] duration-200 ease-out hover:w-[248px] hover:shadow-[12px_0_34px_rgba(17,17,15,0.08)] focus-within:w-[248px] focus-within:shadow-[12px_0_34px_rgba(17,17,15,0.08)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:px-3 lg:py-5">
        <div className="flex items-center gap-3 px-1 pb-6">
          <Brand
            href="/dashboard"
            ariaLabel="Go to dashboard home"
            compact
          />
          <div
            aria-hidden="true"
            className="translate-x-1 whitespace-nowrap leading-none opacity-0 transition-[opacity,transform] duration-150 group-hover/sidebar:translate-x-0 group-hover/sidebar:opacity-100 group-focus-within/sidebar:translate-x-0 group-focus-within/sidebar:opacity-100"
          >
            <span className="block text-[17px] font-extrabold tracking-[-0.035em] text-[var(--ink)]">
              E-KampusMo
            </span>
            <span className="mt-1 block font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
              Student companion
            </span>
          </div>
        </div>

        <nav
          aria-label="Student workspace"
          className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden group-hover/sidebar:overflow-y-auto group-focus-within/sidebar:overflow-y-auto"
        >
          <div className="space-y-1">
            {dashboardNav.map((item) => (
              <NavigationLink
                key={item.href}
                item={item}
                pathname={pathname}
              />
            ))}
          </div>
        </nav>

        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <Link
            href="/dashboard/settings"
            title="Profile & settings"
            className={`mb-3 flex min-h-10 items-center gap-3 rounded-[7px] px-[14px] text-sm font-semibold ${
              isCurrentPath(pathname, "/dashboard/settings")
                ? "bg-[var(--ink)] text-[var(--surface)]"
                : "text-[var(--muted-strong)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
            }`}
          >
            <Icon name="settings" className="h-5 w-5 shrink-0" />
            <span className="translate-x-1 whitespace-nowrap opacity-0 transition-[opacity,transform] duration-150 group-hover/sidebar:translate-x-0 group-hover/sidebar:opacity-100 group-focus-within/sidebar:translate-x-0 group-focus-within/sidebar:opacity-100">
              Profile & settings
            </span>
          </Link>
          <LogoutButton collapsible />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] backdrop-blur-xl">
          <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
            <div className="flex items-center gap-3 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open dashboard menu"
                aria-controls="mobile-dashboard-sidebar"
                aria-expanded={mobileMenuOpen}
                className="grid h-10 w-10 place-items-center rounded-[7px] border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-soft)]"
              >
                <Icon name="menu" className="h-5 w-5" />
              </button>

              <Brand
                href="/dashboard"
                ariaLabel="Go to dashboard home"
                compact
              />
            </div>

            <div className="hidden items-center gap-2 text-sm font-semibold text-[var(--muted)] lg:flex">
              <Icon
                name={
                  syncStatus.state === "offline" ||
                  syncStatus.state === "error"
                    ? "device"
                    : "signal"
                }
                className={`h-4 w-4 ${
                  syncStatus.state === "error"
                    ? "text-[var(--danger)]"
                    : syncStatus.state === "offline"
                      ? "text-[var(--warning)]"
                      : "text-[var(--teal)]"
                }`}
              />
              <span>{syncStatus.message}</span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/reminders"
                aria-label="Open reminders"
                className={`grid h-10 w-10 place-items-center rounded-[7px] border border-[var(--line)] bg-[var(--surface)] ${
                  isCurrentPath(pathname, "/dashboard/reminders")
                    ? "border-[var(--ink)] text-[var(--ink)]"
                    : "text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--ink)]"
                }`}
              >
                <Icon name="bell" className="h-[18px] w-[18px]" />
              </Link>
              <Link
                href="/dashboard/settings"
                title={fullName}
                aria-label={`Open profile settings for ${fullName}`}
                className="grid h-10 w-10 place-items-center rounded-[7px] bg-[var(--ink)] text-xs font-bold text-[var(--surface)] hover:-translate-y-px"
              >
                {firstInitial}
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            aria-label="Close dashboard menu"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          />

          <aside
            id="mobile-dashboard-sidebar"
            role="dialog"
            aria-modal="true"
            aria-label="Dashboard navigation"
            className="relative flex h-full w-[min(86vw,320px)] flex-col border-r border-[var(--line)] bg-[var(--surface)] shadow-[18px_0_45px_rgba(0,0,0,0.18)]"
          >
            <div className="flex h-[68px] items-center justify-between border-b border-[var(--line)] px-5">
              <div className="flex items-center gap-3">
                <Brand
                  href="/dashboard"
                  ariaLabel="Go to dashboard home"
                  compact
                />
                <div className="leading-none">
                  <span className="block text-[17px] font-extrabold tracking-[-0.035em] text-[var(--ink)]">
                    E-KampusMo
                  </span>
                  <span className="mt-1 block font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
                    Student companion
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close dashboard menu"
                className="grid h-10 w-10 place-items-center rounded-[7px] border border-[var(--line)] bg-[var(--surface)] text-xl leading-none text-[var(--muted-strong)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
              >
                ×
              </button>
            </div>

            <div className="border-b border-[var(--line)] px-5 py-4">
              <p className="truncate text-sm font-bold text-[var(--ink)]">
                {fullName}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                <Icon
                  name={
                    syncStatus.state === "offline" ||
                    syncStatus.state === "error"
                      ? "device"
                      : "signal"
                  }
                  className={`h-4 w-4 ${
                    syncStatus.state === "error"
                      ? "text-[var(--danger)]"
                      : syncStatus.state === "offline"
                        ? "text-[var(--warning)]"
                        : "text-[var(--teal)]"
                  }`}
                />
                <span>{syncStatus.message}</span>
              </div>
            </div>

            <nav
              aria-label="Mobile student workspace"
              className="min-h-0 flex-1 overflow-y-auto px-4 py-5"
            >
              <div className="space-y-1">
                {dashboardNav.map((item) => (
                  <MobileNavigationLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    onNavigate={() => setMobileMenuOpen(false)}
                  />
                ))}
              </div>
            </nav>

            <div className="border-t border-[var(--line)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Link
                href="/dashboard/settings"
                onClick={() => setMobileMenuOpen(false)}
                aria-current={
                  isCurrentPath(pathname, "/dashboard/settings")
                    ? "page"
                    : undefined
                }
                className={`mb-3 flex min-h-12 items-center gap-3 rounded-[10px] px-4 text-sm font-semibold ${
                  isCurrentPath(pathname, "/dashboard/settings")
                    ? "bg-[var(--ink)] text-[var(--surface)]"
                    : "text-[var(--muted-strong)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
                }`}
              >
                <Icon name="settings" className="h-5 w-5 shrink-0" />
                <span>Profile & settings</span>
              </Link>

              <LogoutButton />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
