"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
        });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setMessage(
        "If an account matches that email, a password reset link is on its way. Check your inbox and spam folder.",
      );
    } catch {
      setError("We could not start the password reset. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your password."
      description="Enter the email address you used for E-KampusMo. We’ll send you a secure link to choose a new password."
    >
      <form onSubmit={handleResetRequest} className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
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

        <button type="submit" disabled={loading} className="primary-button w-full">
          {loading ? "Sending reset link…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-[var(--muted)]">
        Remembered your password?{" "}
        <Link
          href="/login"
          className="font-bold text-[var(--blue)] hover:text-[var(--blue-strong)]"
        >
          Back to log in
        </Link>
      </p>
    </AuthShell>
  );
}
