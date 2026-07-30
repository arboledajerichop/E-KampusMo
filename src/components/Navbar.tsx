import Link from "next/link";
import Brand from "@/components/Brand";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] backdrop-blur-xl">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 sm:px-8"
      >
        <Brand />

        <div className="hidden items-center gap-8 lg:flex">
          <a
            href="#features"
            className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-strong)] hover:text-[var(--ink)]"
          >
            Workspace
          </a>

          <a
            href="#internship"
            className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-strong)] hover:text-[var(--ink)]"
          >
            Internship
          </a>

          <a
            href="#privacy"
            className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-strong)] hover:text-[var(--ink)]"
          >
            Privacy
          </a>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="hidden min-h-10 items-center px-2 text-sm font-bold text-[var(--muted-strong)] hover:text-[var(--ink)] sm:inline-flex"
          >
            Log in
          </Link>

          <Link
            href="/register"
            className="inline-flex min-h-10 items-center rounded-[7px] bg-[var(--ink)] px-4 text-sm font-bold text-[var(--surface)] hover:-translate-y-px hover:opacity-80"
          >
            <span className="sm:hidden">Join</span>
            <span className="hidden sm:inline">Get started</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
