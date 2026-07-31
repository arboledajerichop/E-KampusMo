"use client";

export default function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  function toggleTheme() {
    const root = document.documentElement;
    const current =
      root.dataset.theme ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    const next = current === "dark" ? "light" : "dark";

    root.dataset.theme = next;
    window.localStorage.setItem("ekampusmo-theme", next);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle color theme"
      className="inline-flex h-10 items-center justify-center gap-2 rounded-[7px] border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--muted-strong)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[18px] w-[18px]"
      >
        <path d="M20.4 15.5A8.4 8.4 0 0 1 8.5 3.6 8.4 8.4 0 1 0 20.4 15.5Z" />
      </svg>
      {showLabel && <span>Theme</span>}
    </button>
  );
}
