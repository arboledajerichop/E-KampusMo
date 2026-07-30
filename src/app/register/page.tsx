"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import GoogleIcon from "@/components/GoogleIcon";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleSignUp() {
    setError("");
    setMessage("");
    setGoogleLoading(true);

    try {
      const supabase = createClient();
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });

      if (googleError) {
        setError(googleError.message);
        setGoogleLoading(false);
      }
    } catch {
      setError("Google sign-up could not be started. Please try again.");
      setGoogleLoading(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    if (!agreedToTerms) {
      setError("You must agree to the Terms and Privacy Policy.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      setMessage(
        "Account created. Check your inbox to confirm your email, then come back to log in.",
      );
      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setAgreedToTerms(false);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Create your account"
      title="Start your semester with a clear plan."
      description="Your account keeps your academic and internship records private and available across your devices."
    >
      <button
        type="button"
        onClick={handleGoogleSignUp}
        disabled={googleLoading || loading}
        className="secondary-button w-full"
      >
        <GoogleIcon />
        {googleLoading ? "Connecting to Google…" : "Sign up with Google"}
      </button>

      <div className="my-5 flex items-center gap-4" aria-hidden="true">
        <div className="h-px flex-1 bg-[var(--line)]" />
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          or use email
        </span>
        <div className="h-px flex-1 bg-[var(--line)]" />
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label
            htmlFor="name"
            className="mb-1.5 block text-sm font-bold text-[var(--ink-soft)]"
          >
            Full name
          </label>
          <input
            id="name"
            type="text"
            placeholder="Your full name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            autoComplete="name"
            className="form-input"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-bold text-[var(--ink-soft)]"
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-bold text-[var(--ink-soft)]"
            >
              Password
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
              className="mb-1.5 block text-sm font-bold text-[var(--ink-soft)]"
            >
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
              className="form-input"
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 pt-1 text-sm leading-5 text-[var(--muted)]">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(event) => setAgreedToTerms(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--line-strong)] accent-blue-700"
          />
          <span>
            I agree to the{" "}
            <Link
              href="/terms"
              className="font-semibold text-[var(--blue)] hover:text-[var(--blue-strong)]"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="font-semibold text-[var(--blue)] hover:text-[var(--blue-strong)]"
            >
              Privacy Policy
            </Link>
            .
          </span>
        </label>

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

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="primary-button w-full"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-bold text-[var(--blue)] hover:text-[var(--blue-strong)]"
        >
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
