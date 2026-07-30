"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icons";
import { useConfirmation } from "@/components/dashboard/ConfirmationDialog";
import { createClient } from "@/lib/supabase/client";

type DeletionResponse = {
  error?: string;
  message?: string;
};

async function readResponse(response: Response) {
  return (await response.json().catch(() => ({}))) as DeletionResponse;
}

function clearLocalAccountCache(userId: string) {
  const prefix = `ekampusmo:${userId}:`;
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix)) {
      localStorage.removeItem(key);
    }
  }

  const request = indexedDB.open("ekampusmo-files-v1", 1);
  request.onsuccess = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains("files")) {
      database.close();
      return;
    }
    const transaction = database.transaction("files", "readwrite");
    const index = transaction.objectStore("files").index("userId");
    const cursorRequest = index.openKeyCursor(IDBKeyRange.only(userId));
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      transaction.objectStore("files").delete(cursor.primaryKey);
      cursor.continue();
    };
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  };
}

export default function AccountDeletionPanel({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const router = useRouter();
  const confirm = useConfirmation();
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function requestDeletionCode() {
    const shouldProceed = await confirm({
      title: "Delete your account?",
      message:
        "This permanently deletes your profile and all synchronized records, including any records from previously available features. This cannot be undone.",
      confirmLabel: "Yes, send a code",
      tone: "danger",
    });
    if (!shouldProceed) return;

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/account/deletion-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = await readResponse(response);
      if (!response.ok) {
        throw new Error(
          result.error ?? "The verification code could not be sent.",
        );
      }
      setMessage(
        result.message ??
          "A verification code was sent to your registered email.",
      );
      setCode("");
      setShowCodeDialog(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The verification code could not be sent.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!/^\d{6,8}$/.test(code)) {
      setError("Enter the 6 to 8 digit code from your email.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const result = await readResponse(response);
      if (!response.ok) {
        throw new Error(result.error ?? "Your account could not be deleted.");
      }

      clearLocalAccountCache(userId);
      await createClient().auth.signOut({ scope: "local" });
      setShowCodeDialog(false);
      router.replace("/login?accountDeleted=1");
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Your account could not be deleted.",
      );
      setBusy(false);
    }
  }

  return (
    <>
      <section className="mt-5 rounded-[16px] border border-red-200 bg-[var(--surface)] p-5 sm:p-7 dark:border-red-950">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-[var(--danger-soft)] text-[var(--danger)]">
                <Icon name="shield" className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--danger)]">
                  Danger zone
                </p>
                <h2 className="mt-1 text-lg font-bold text-[var(--ink)]">
                  Delete account
                </h2>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
              Permanently remove this account and every synchronized record.
              We will send a verification code to{" "}
              <span className="font-bold text-[var(--ink-soft)]">{email}</span>{" "}
              before deletion is allowed.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void requestDeletionCode()}
            disabled={busy}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[10px] border border-red-300 px-5 text-sm font-bold text-[var(--danger)] transition hover:bg-[var(--danger-soft)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900"
          >
            {busy ? "Sending code…" : "Delete account"}
          </button>
        </div>

        {error && !showCodeDialog && (
          <p
            role="alert"
            className="mt-5 rounded-[10px] border border-red-200 bg-[var(--danger-soft)] px-4 py-3 text-sm leading-5 text-[var(--danger)] dark:border-red-900"
          >
            {error}
          </p>
        )}
      </section>

      {showCodeDialog && (
        <div className="fixed inset-0 z-[110] grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-[3px]">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-account-code-title"
            aria-describedby="delete-account-code-description"
            className="w-full max-w-[480px] rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.32)] sm:p-7"
          >
            <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-[var(--danger-soft)] text-[var(--danger)]">
              <Icon name="shield" className="h-5 w-5" />
            </span>
            <h2
              id="delete-account-code-title"
              className="mt-5 text-xl font-bold tracking-[-0.025em] text-[var(--ink)]"
            >
              Enter your verification code
            </h2>
            <p
              id="delete-account-code-description"
              className="mt-2 text-sm leading-6 text-[var(--muted)]"
            >
              {message} Enter the code sent to{" "}
              <span className="font-bold text-[var(--ink-soft)]">{email}</span>.
              Deletion begins immediately after verification.
            </p>

            <form onSubmit={deleteAccount} className="mt-6">
              <label
                htmlFor="delete-account-code"
                className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
              >
                Verification code
              </label>
              <input
                id="delete-account-code"
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 8))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Enter code"
                required
                autoFocus
                disabled={busy}
                className="form-input text-center font-mono text-lg tracking-[0.25em]"
              />

              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-[10px] border border-red-200 bg-[var(--danger-soft)] px-4 py-3 text-sm leading-5 text-[var(--danger)] dark:border-red-900"
                >
                  {error}
                </p>
              )}

              <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCodeDialog(false);
                    setCode("");
                    setError("");
                  }}
                  disabled={busy}
                  className="secondary-button px-5"
                >
                  Keep my account
                </button>
                <button
                  type="submit"
                  disabled={busy || code.length < 6}
                  className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-red-700 px-5 text-sm font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "Deleting account…" : "Verify and delete"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
