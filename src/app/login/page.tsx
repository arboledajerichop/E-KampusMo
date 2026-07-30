"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import GoogleIcon from "@/components/GoogleIcon";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleLogin() {
    setError("");
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
      setError("Google sign-in could not be started. Please try again.");
      setGoogleLoading(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        setError(loginError.message);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Pick up where you left off."
      description="Log in to see today’s classes, deadlines, internship progress, and student budget."
    >
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={googleLoading || loading}
        className="secondary-button w-full"
      >
        <GoogleIcon />
        {googleLoading ? "Connecting to Google…" : "Continue with Google"}
      </button>

      <div className="my-6 flex items-center gap-4" aria-hidden="true">
        <div className="h-px flex-1 bg-[var(--line)]" />
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          or use email
        </span>
        <div className="h-px flex-1 bg-[var(--line)]" />
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
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

        <div>
          <div className="mb-2 flex items-center justify-between gap-4">
            <label
              htmlFor="password"
              className="text-sm font-bold text-[var(--ink-soft)]"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-sm font-semibold text-[var(--blue)] hover:text-[var(--blue-strong)]"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
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
        </div>

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="primary-button w-full"
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-[var(--muted)]">
        New to E-KampusMo?{" "}
        <Link
          href="/register"
          className="font-bold text-[var(--blue)] hover:text-[var(--blue-strong)]"
        >
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
