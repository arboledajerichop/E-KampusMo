import type { ReactNode } from "react";
import Link from "next/link";
import Brand from "@/components/Brand";
import Navbar from "@/components/Navbar";

export default function LegalPageLayout({
  eyebrow,
  title,
  summary,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--canvas-warm)]">
      <Navbar />
      <main>
        <header className="border-b border-[var(--line)]">
          <div className="mx-auto max-w-[920px] px-5 py-16 sm:px-8 sm:py-20">
            <p className="mono-label text-[var(--muted)]">
              {eyebrow}
            </p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.06em] text-[var(--ink)] sm:text-5xl">
              {title}
            </h1>
            <p className="mt-5 max-w-[720px] text-base leading-7 text-[var(--muted-strong)]">
              {summary}
            </p>
            <p className="mt-6 text-xs font-semibold text-[var(--muted)]">
              Last updated: July 29, 2026
            </p>
          </div>
        </header>

        <article className="mx-auto max-w-[920px] px-5 py-14 sm:px-8 sm:py-16">
          <div className="space-y-10 text-[15px] leading-7 text-[var(--muted-strong)] [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-[-0.025em] [&_h2]:text-[var(--ink)] [&_p+p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
            {children}
          </div>

          <div className="mt-14 border-t border-[var(--line)] pt-8">
            <Link
              href="/"
              className="text-sm font-bold text-[var(--blue)] hover:text-[var(--blue-strong)]"
            >
              ← Back to E-KampusMo
            </Link>
          </div>
        </article>
      </main>

      <footer className="border-t border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-[920px] flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Brand />
          <p className="text-xs text-[var(--muted)]">
            Your academic life, organized.
          </p>
        </div>
      </footer>
    </div>
  );
}
