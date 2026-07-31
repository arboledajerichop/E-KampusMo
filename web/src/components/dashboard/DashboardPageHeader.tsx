import type { ReactNode } from "react";

export default function DashboardPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <p className="mono-label text-[var(--muted)]">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.055em] text-[var(--ink)] sm:text-[2.6rem]">
          {title}
        </h1>
        <p className="mt-2 max-w-[680px] text-sm leading-6 text-[var(--muted)]">
          {description}
        </p>
      </div>
      {action}
    </header>
  );
}
