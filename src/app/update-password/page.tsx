"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUpdatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("Your new password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setMessage("Your password has been updated. You can continue securely.");
    } catch {
      setError("We could not update your password. Please request a new link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Secure your account"
      title="Choose a new password."
      description="Use at least eight characters and avoid a password you use for another account."
    >
      <form onSubmit={handleUpdatePassword} className="space-y-5">
        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
          >
            New password
          </label>
          <input
            id="password"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
            className="form-input"
          />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
          >
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            type="password"
            placeholder="Repeat your new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
            className="form-input"
          />
        </div>

        <div aria-live="polite">
          {error && (
            <p
              role="alert"
              className="rounded-[10px] border border-red-200 bg-[var(--danger-soft)] px-4 py-3 text-sm leading-5 text-[var(--danger)] dark:border-red-900"
            >
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-[10px] border border-teal-200 bg-[var(--teal-soft)] px-4 py-3 text-sm leading-5 text-[var(--teal)] dark:border-teal-900">
              {message}
            </p>
          )}
        </div>

        {message ? (
          <Link href="/dashboard" className="primary-button w-full">
            Continue to dashboard
          </Link>
        ) : (
          <button type="submit" disabled={loading} className="primary-button w-full">
            {loading ? "Updating password…" : "Update password"}
          </button>
        )}
      </form>

      <p className="mt-7 text-center text-sm text-[var(--muted)]">
        Reset link expired?{" "}
        <Link
          href="/forgot-password"
          className="font-bold text-[var(--blue)] hover:text-[var(--blue-strong)]"
        >
          Request another
        </Link>
      </p>
    </AuthShell>
  );
}
