import Link from "next/link";
import Icon from "@/components/Icons";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";

export default function SectionPlaceholder({
  eyebrow,
  title,
  description,
  icon,
  features,
  note,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: Parameters<typeof Icon>[0]["name"];
  features: string[];
  note: string;
}) {
  return (
    <>
      <DashboardPageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
      />

      <div className="mt-8 grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="grid min-h-[430px] place-items-center rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-8 text-center">
          <div className="max-w-[440px]">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-[13px] bg-[var(--surface-blue)] text-[var(--blue)]">
              <Icon name={icon} className="h-6 w-6" />
            </span>
            <h2 className="mt-5 text-lg font-bold tracking-[-0.025em] text-[var(--ink)]">
              This section is ready for its data workflow
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {note}
            </p>
            <Link
              href="/dashboard"
              className="secondary-button mt-6 px-5"
            >
              Back to Today
            </Link>
          </div>
        </section>

        <aside className="rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--blue)]">
            Planned workflow
          </p>
          <h2 className="mt-2 text-lg font-bold tracking-[-0.025em] text-[var(--ink)]">
            What this section will handle
          </h2>
          <ul className="mt-5 divide-y divide-[var(--line)]">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-3 py-4 first:pt-0">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--teal-soft)] text-[var(--teal)]">
                  <Icon name="check" className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm leading-6 text-[var(--muted-strong)]">
                  {feature}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
