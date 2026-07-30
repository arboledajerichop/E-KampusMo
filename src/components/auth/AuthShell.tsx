import type { ReactNode } from "react";
import Brand from "@/components/Brand";
import Icon from "@/components/Icons";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export default function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: AuthShellProps) {
  return (
    <main className="grid min-h-screen bg-[var(--canvas-warm)] lg:grid-cols-[0.88fr_1.12fr]">
      <aside className="auth-grid relative hidden overflow-hidden bg-[#2b2d2a] px-10 py-9 text-white lg:flex lg:flex-col xl:px-16 xl:py-12">
        <div className="relative z-10">
          <Brand inverse />
        </div>

        <div className="relative z-10 my-auto max-w-[520px] py-16">
          <p className="mono-label text-white/55">
            Student workspace / 01
          </p>
          <h2 className="text-balance mt-6 text-4xl font-bold leading-[1.08] tracking-[-0.05em] xl:text-[3.45rem]">
            The practical work behind student life, organized.
          </h2>
          <p className="mt-6 max-w-[470px] text-base leading-7 text-white/68">
            See Classroom deadlines, class schedules, internship progress, and
            daily spending without switching between disconnected tools.
          </p>

          <div className="mt-10 grid gap-3">
            {[
              "Google Classroom deadline overview",
              "Class schedule and OJT progress",
              "Simple student expense tracking",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 text-sm font-semibold text-white/88"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full border border-white/25 text-white">
                  <Icon name="check" className="h-3.5 w-3.5" />
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 font-mono text-[10px] uppercase tracking-[0.11em] text-white/45">
          E-KampusMo / Student companion / 2026
        </p>
      </aside>

      <section className="relative flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-[450px]">
          <div className="mb-9 lg:hidden">
            <Brand />
          </div>

          <header className="mb-7">
            <p className="mono-label text-[var(--muted)]">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-[2rem] font-extrabold tracking-[-0.055em] text-[var(--ink)] sm:text-[2.3rem]">
              {title}
            </h1>
            <p className="mt-3 max-w-[420px] text-sm leading-6 text-[var(--muted)]">
              {description}
            </p>
          </header>

          {children}
        </div>
      </section>
    </main>
  );
}
