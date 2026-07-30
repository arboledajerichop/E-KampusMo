"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Icon from "@/components/Icons";

type ConfirmationTone = "default" | "danger";

export type ConfirmationOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmationTone;
};

type ConfirmationRequest = {
  options: ConfirmationOptions;
  resolve: (confirmed: boolean) => void;
};

type ConfirmationContextValue = (
  options: ConfirmationOptions,
) => Promise<boolean>;

const ConfirmationContext = createContext<ConfirmationContextValue | null>(
  null,
);

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback(
    (options: ConfirmationOptions) =>
      new Promise<boolean>((resolve) => {
        setRequest((current) => {
          current?.resolve(false);
          return { options, resolve };
        });
      }),
    [],
  );

  const finish = useCallback((confirmed: boolean) => {
    setRequest((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!request) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(
      () => confirmButtonRef.current?.focus(),
      0,
    );
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [finish, request]);

  return (
    <ConfirmationContext.Provider value={confirm}>
      {children}
      {request && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) finish(false);
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirmation-dialog-title"
            aria-describedby="confirmation-dialog-message"
            className="w-full max-w-[460px] rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.32)] sm:p-7"
          >
            <span
              className={`grid h-11 w-11 place-items-center rounded-[12px] ${
                request.options.tone === "danger"
                  ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                  : "bg-[var(--warning-soft)] text-[var(--warning)]"
              }`}
            >
              <Icon
                name={
                  request.options.tone === "danger" ? "shield" : "device"
                }
                className="h-5 w-5"
              />
            </span>

            <h2
              id="confirmation-dialog-title"
              className="mt-5 text-xl font-bold tracking-[-0.025em] text-[var(--ink)]"
            >
              {request.options.title}
            </h2>
            <p
              id="confirmation-dialog-message"
              className="mt-2 text-sm leading-6 text-[var(--muted)]"
            >
              {request.options.message}
            </p>

            <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => finish(false)}
                className="secondary-button px-5"
              >
                {request.options.cancelLabel ?? "Cancel"}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={() => finish(true)}
                className={
                  request.options.tone === "danger"
                    ? "inline-flex min-h-11 items-center justify-center rounded-[10px] bg-red-700 px-5 text-sm font-bold text-white transition hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                    : "primary-button px-5"
                }
              >
                {request.options.confirmLabel ?? "Yes, proceed"}
              </button>
            </div>
          </section>
        </div>
      )}
    </ConfirmationContext.Provider>
  );
}

export function useConfirmation() {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error(
      "useConfirmation must be used inside a ConfirmationProvider.",
    );
  }
  return context;
}
