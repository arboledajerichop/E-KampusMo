import Link from "next/link";
import Icon from "@/components/Icons";

type BrandProps = {
  href?: string;
  ariaLabel?: string;
  inverse?: boolean;
  compact?: boolean;
};

export default function Brand({
  href = "/",
  ariaLabel = "E-KampusMo landing page",
  inverse = false,
  compact = false,
}: BrandProps) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="group inline-flex items-center gap-3 rounded-lg focus-visible:outline-none"
    >
      <span
        aria-hidden="true"
        className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-[8px] border ${
          inverse
            ? "border-white/25 bg-white text-black"
            : "border-[var(--ink)] bg-[var(--ink)] text-[var(--surface)]"
        }`}
      >
        <Icon name="briefcase" className="h-[22px] w-[22px]" />
        <span
          className={`absolute -bottom-1 -right-1 grid h-[18px] w-[16px] place-items-center rounded-[4px] border ${
            inverse
              ? "border-black bg-black text-white"
              : "border-[var(--ink)] bg-[var(--surface)] text-[var(--ink)]"
          } transition-transform duration-200 group-hover:-translate-y-0.5`}
        >
          <Icon name="notepad" className="h-3 w-3" />
        </span>
      </span>

      {!compact && (
        <span className="leading-none">
          <span
            className={`block text-[17px] font-extrabold tracking-[-0.035em] ${
              inverse ? "text-white" : "text-[var(--ink)]"
            }`}
          >
            E-KampusMo
          </span>
          <span
            className={`mt-1 block font-mono text-[9px] font-medium uppercase tracking-[0.14em] ${
              inverse ? "text-white/60" : "text-[var(--muted)]"
            }`}
          >
            Student companion
          </span>
        </span>
      )}
    </Link>
  );
}
