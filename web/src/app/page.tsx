import Link from "next/link";
import Brand from "@/components/Brand";
import Icon from "@/components/Icons";
import Navbar from "@/components/Navbar";
import TypingWord from "@/components/TypingWord";

const featureRows = [
  {
    number: "01",
    eyebrow: "Google Classroom",
    title: "Know what is active, missing, completed, or has no deadline.",
    copy: "Connect a Google account and keep current-semester coursework in one focused list. Mark work submitted outside Classroom as done when needed.",
    detail: "Read-only connection / Current semester / Deadline groups",
  },
  {
    number: "02",
    eyebrow: "Class schedule",
    title: "Turn class details into a week you can understand.",
    copy: "Enter meetings manually or read a registration form locally, then edit the result and download a clean Monday-to-Sunday schedule.",
    detail: "Multiple meeting days / Editable import / Downloadable",
  },
  {
    number: "03",
    eyebrow: "Internship",
    title: "Let every rendered hour update the bigger picture.",
    copy: "Record clock-in, clock-out, absences, and optional reflections. Short days and early outs automatically move the estimated completion date.",
    detail: "Daily journal / Accurate credits / Expected end date",
  },
  {
    number: "04",
    eyebrow: "Expenses",
    title: "See where student money goes before it disappears.",
    copy: "Log everyday spending, compare categories, and review daily, weekly, or monthly totals alongside an optional allowance period.",
    detail: "Expense categories / Spending trend / Allowance guide",
  },
];

const todayRows = [
  {
    label: "08:30",
    title: "Systems Integration",
    detail: "ITE410L / ITC-110",
  },
  {
    label: "DUE",
    title: "Database case study",
    detail: "Tomorrow / Active",
  },
  {
    label: "OJT",
    title: "312h 30m rendered",
    detail: "187h 30m remaining",
  },
];

const overviewItems = [
  "CLASSROOM / CONNECTED",
  "SCHEDULE / 6 CLASSES",
  "OJT / 62.5%",
  "BUDGET / ON TRACK",
];

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden bg-[var(--canvas-warm)]">
      <Navbar />

      <main>
        <section className="relative border-b border-[var(--line)]">
          <div
            aria-hidden="true"
            className="landing-grid pointer-events-none absolute inset-0 opacity-40"
          />

          <div className="relative mx-auto grid min-h-[720px] max-w-[1240px] items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[0.94fr_1.06fr] lg:gap-20 lg:py-24">
            <div className="max-w-[620px]">
              <p className="mono-label landing-reveal text-[var(--muted)]">
                Student workspace / 2026
              </p>

              <h1 className="landing-reveal landing-reveal-delay-1 mt-7 text-[clamp(2.1rem,9vw,5.8rem)] font-extrabold leading-[0.96] tracking-[-0.075em] text-[var(--ink)]">
                <span aria-hidden="true">
                  <span className="block">Student life,</span>

                  <span className="block whitespace-nowrap">
                    finally <TypingWord />
                  </span>
                </span>

                <span className="sr-only">
                  Student life, finally organized and balanced.
                </span>
              </h1>

              <p className="landing-reveal landing-reveal-delay-2 mt-7 max-w-[580px] text-lg leading-8 text-[var(--muted-strong)]">
                E-KampusMo brings your Classroom deadlines, weekly schedule,
                internship hours, daily reminders, and student expenses into
                one clear workspace.
              </p>

              <div className="landing-reveal landing-reveal-delay-3 mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="primary-button min-w-[172px] px-6"
                >
                  Create free account
                  <Icon name="arrow" className="h-4 w-4" />
                </Link>

                <Link
                  href="/login"
                  className="secondary-button min-w-[130px] px-6"
                >
                  Log in
                </Link>
              </div>

              <div className="landing-reveal landing-reveal-delay-3 mt-9 flex flex-wrap gap-x-7 gap-y-3 border-t border-[var(--line)] pt-5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
                <span className="inline-flex items-center gap-2">
                  <Icon name="shield" className="h-3.5 w-3.5" />
                  Private account
                </span>

                <span className="inline-flex items-center gap-2">
                  <Icon name="device" className="h-3.5 w-3.5" />
                  Phone-ready
                </span>

                <span className="inline-flex items-center gap-2">
                  <Icon name="signal" className="h-3.5 w-3.5" />
                  Cloud sync
                </span>
              </div>
            </div>

            <div className="landing-reveal landing-reveal-delay-2 mx-auto w-full max-w-[610px] lg:mx-0">
              <div className="today-scan overflow-hidden rounded-[10px] border border-[#363832] bg-[#2b2d2a] text-white shadow-[var(--shadow-float)]">
                <div className="flex items-center justify-between border-b border-white/15 px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <Brand compact inverse />

                    <div>
                      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.13em] text-white/50">
                        Today / 07.30
                      </p>

                      <p className="mt-1 text-sm font-bold">
                        Thursday overview
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-white/55">
                    <span className="today-live-dot h-1.5 w-1.5 rounded-full bg-white" />
                    Synced
                  </span>
                </div>

                <div className="grid border-b border-white/15 sm:grid-cols-[1.1fr_0.9fr]">
                  <div className="p-5 sm:p-6">
                    <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-white/45">
                      Next class / 01
                    </p>

                    <p className="mt-12 text-2xl font-extrabold tracking-[-0.045em]">
                      Software Engineering
                    </p>

                    <p className="mt-2 text-sm text-white/58">
                      08:30–10:00 / Room 402
                    </p>
                  </div>

                  <div className="border-t border-white/15 p-5 sm:border-l sm:border-t-0 sm:p-6">
                    <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-white/45">
                      Needs attention
                    </p>

                    <p className="mt-6 text-5xl font-extrabold tracking-[-0.065em]">
                      03
                    </p>

                    <p className="mt-2 text-xs leading-5 text-white/55">
                      2 active / 1 missing
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-white/12 px-5 sm:px-6">
                  {todayRows.map((item) => (
                    <div
                      key={item.title}
                      className="grid grid-cols-[54px_1fr_auto] items-center gap-4 py-4"
                    >
                      <p className="font-mono text-[10px] font-medium text-white/45">
                        {item.label}
                      </p>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">
                          {item.title}
                        </p>

                        <p className="mt-1 truncate text-[11px] text-white/48">
                          {item.detail}
                        </p>
                      </div>

                      <Icon
                        name="arrow"
                        className="h-4 w-4 text-white/38"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 border-t border-white/15 sm:grid-cols-4">
                  {overviewItems.map((item) => (
                    <p
                      key={item}
                      className="border-b border-r border-white/10 px-3 py-3 text-center font-mono text-[8px] uppercase tracking-[0.08em] text-white/44 sm:border-b-0"
                    >
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="bg-[var(--surface)]">
          <div className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 lg:py-32">
            <div className="grid gap-10 border-b border-[var(--line)] pb-14 lg:grid-cols-[0.62fr_1.38fr] lg:gap-20">
              <p className="mono-label text-[var(--muted)]">
                Workspace / 01–04
              </p>

              <div>
                <h2 className="text-balance max-w-[780px] text-3xl font-extrabold leading-tight tracking-[-0.055em] text-[var(--ink)] sm:text-5xl">
                  Fewer tabs. A clearer semester.
                </h2>

                <p className="mt-5 max-w-[650px] leading-7 text-[var(--muted-strong)]">
                  Each part of E-KampusMo answers a practical student question:
                  what is next, what is missing, how much is finished, and what
                  needs attention today.
                </p>
              </div>
            </div>

            <div className="divide-y divide-[var(--line)]">
              {featureRows.map((feature) => (
                <article
                  key={feature.number}
                  className="grid gap-5 py-10 sm:grid-cols-[70px_0.9fr_1.1fr] sm:items-start sm:gap-8 lg:py-12"
                >
                  <p className="font-mono text-xs font-medium text-[var(--muted)]">
                    / {feature.number}
                  </p>

                  <div>
                    <p className="mono-label text-[var(--muted)]">
                      {feature.eyebrow}
                    </p>

                    <h3 className="mt-4 max-w-[390px] text-xl font-extrabold tracking-[-0.04em] text-[var(--ink)] sm:text-2xl">
                      {feature.title}
                    </h3>
                  </div>

                  <div>
                    <p className="max-w-[540px] leading-7 text-[var(--muted-strong)]">
                      {feature.copy}
                    </p>

                    <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
                      {feature.detail}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="internship"
          className="border-y border-[#363832] bg-[#2b2d2a] text-white"
        >
          <div className="mx-auto grid max-w-[1240px] gap-14 px-5 py-24 sm:px-8 lg:grid-cols-[0.84fr_1.16fr] lg:items-center lg:gap-24 lg:py-28">
            <div>
              <p className="mono-label text-white/48">
                Current semester / Live data
              </p>

              <h2 className="mt-7 text-balance text-4xl font-extrabold leading-[1.04] tracking-[-0.06em] sm:text-5xl">
                Your deadlines should feel actionable, not scattered.
              </h2>

              <p className="mt-6 max-w-[560px] text-base leading-8 text-white/62">
                E-KampusMo reads courses and coursework without editing Google
                Classroom. You get one current-semester view for active,
                missing, completed, and no-deadline work.
              </p>

              <Link
                href="/register"
                className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-[7px] bg-white px-5 text-sm font-bold text-black hover:-translate-y-px hover:bg-white/88"
              >
                Start your workspace
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
            </div>

            <div className="border-y border-white/18">
              {[
                ["ACTIVE WORK", "08", "Due today, next week, or later"],
                ["MISSING", "02", "Can be marked done when submitted in person"],
                ["COMPLETED", "24", "Finished during the current semester"],
                ["NO DEADLINE", "03", "Visible without guessing a due date"],
              ].map(([label, value, detail]) => (
                <div
                  key={label}
                  className="grid grid-cols-[1fr_auto] gap-5 border-b border-white/12 py-5 last:border-b-0 sm:grid-cols-[170px_70px_1fr] sm:items-center"
                >
                  <p className="font-mono text-[10px] tracking-[0.11em] text-white/45">
                    {label}
                  </p>

                  <p className="text-2xl font-extrabold tracking-[-0.05em]">
                    {value}
                  </p>

                  <p className="col-span-2 text-sm text-white/52 sm:col-span-1">
                    {detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[var(--canvas-warm)]">
          <div className="mx-auto grid max-w-[1240px] gap-px border-x border-[var(--line)] bg-[var(--line)] lg:grid-cols-2">
            <article className="bg-[var(--surface)] p-7 sm:p-10 lg:p-14">
              <p className="mono-label text-[var(--muted)]">
                Internship / Progress
              </p>

              <Icon
                name="briefcase"
                className="mt-12 h-8 w-8 text-[var(--ink)]"
              />

              <h2 className="mt-6 max-w-[470px] text-3xl font-extrabold tracking-[-0.05em] text-[var(--ink)]">
                Actual hours shape the expected finish date.
              </h2>

              <p className="mt-5 max-w-[500px] leading-7 text-[var(--muted-strong)]">
                Full days, half days, early outs, and absences stay visible in
                an editable daily journal.
              </p>

              <div className="mt-10 grid grid-cols-3 border-y border-[var(--line)] py-5 text-center">
                <div>
                  <p className="font-mono text-[9px] uppercase text-[var(--muted)]">
                    Rendered
                  </p>

                  <p className="mt-2 font-bold text-[var(--ink)]">312h 30m</p>
                </div>

                <div className="border-x border-[var(--line)]">
                  <p className="font-mono text-[9px] uppercase text-[var(--muted)]">
                    Remaining
                  </p>

                  <p className="mt-2 font-bold text-[var(--ink)]">187h 30m</p>
                </div>

                <div>
                  <p className="font-mono text-[9px] uppercase text-[var(--muted)]">
                    Estimate
                  </p>

                  <p className="mt-2 font-bold text-[var(--ink)]">18 Sep</p>
                </div>
              </div>
            </article>

            <article className="bg-[var(--canvas)] p-7 sm:p-10 lg:p-14">
              <p className="mono-label text-[var(--muted)]">
                Expenses / Insight
              </p>

              <Icon
                name="wallet"
                className="mt-12 h-8 w-8 text-[var(--ink)]"
              />

              <h2 className="mt-6 max-w-[470px] text-3xl font-extrabold tracking-[-0.05em] text-[var(--ink)]">
                A simple record of where the allowance went.
              </h2>

              <p className="mt-5 max-w-[500px] leading-7 text-[var(--muted-strong)]">
                Category shares and spending trends turn small daily entries
                into something useful.
              </p>

              <div className="mt-10 flex items-center gap-6 border-y border-[var(--line)] py-5">
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-[14px] border-[var(--ink)]">
                  <span className="text-xs font-extrabold">42%</span>
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                  {[
                    ["Food", "42%"],
                    ["Transport", "31%"],
                    ["Education", "27%"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between border-b border-[var(--line)] pb-2 text-sm"
                    >
                      <span className="text-[var(--muted-strong)]">{label}</span>

                      <span className="font-mono text-xs text-[var(--ink)]">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </div>
        </section>

        <section
          id="privacy"
          className="border-y border-[var(--line)] bg-[var(--surface)]"
        >
          <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.65fr_1.35fr] lg:gap-24 lg:py-24">
            <p className="mono-label text-[var(--muted)]">
              Privacy / Your account
            </p>

            <div>
              <h2 className="max-w-[760px] text-3xl font-extrabold tracking-[-0.055em] text-[var(--ink)] sm:text-4xl">
                A personal student workspace—not another public profile.
              </h2>

              <p className="mt-5 max-w-[680px] leading-7 text-[var(--muted-strong)]">
                Your schedule, assignments, expenses, and internship entries
                stay tied to your account. Google Classroom access is
                read-only, and registration-form reading stays on the device.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/privacy" className="secondary-button px-5">
                  Read privacy policy
                </Link>

                <Link href="/terms" className="secondary-button px-5">
                  View terms
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[var(--canvas-warm)]">
          <div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-8 px-5 py-20 sm:px-8 lg:flex-row lg:items-end">
            <div>
              <p className="mono-label text-[var(--muted)]">
                Start / Your semester
              </p>

              <h2 className="mt-5 max-w-[700px] text-4xl font-extrabold tracking-[-0.06em] text-[var(--ink)] sm:text-5xl">
                Give the semester one clear home.
              </h2>
            </div>

            <Link href="/register" className="primary-button px-6">
              Create your account
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-8 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between">
          <Brand />

          <div className="flex flex-wrap gap-x-6 gap-y-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
            <Link href="/privacy" className="hover:text-[var(--ink)]">
              Privacy
            </Link>

            <Link href="/terms" className="hover:text-[var(--ink)]">
              Terms
            </Link>

            <span>© 2026 E-KampusMo</span>
          </div>
        </div>
      </footer>
    </div>
  );
}