"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import BackendNotConnected from "./BackendNotConnected";

export default function SignupForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${siteUrl}/auth/confirm`,
        data: { display_name: displayName.trim() },
      },
    });
    setBusy(false);
    if (error) {
      setError("Sign-up failed. Try a different email or a longer password.");
      return;
    }
    if (data.session) {
      // Email confirmation is OFF (the workshop default) — signed in already.
      router.push("/app");
      router.refresh();
    } else {
      // Email confirmation is ON — tell the user to check their inbox.
      setCheckEmail(true);
    }
  }

  if (checkEmail) {
    return (
      <div className="auth-card">
        <div className="auth-heading"><h1>Check your email</h1></div>
        <p className="auth-copy">
          We sent a confirmation link to <strong>{email}</strong>. Click it to finish
          creating your account, then sign in.
        </p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <div className="auth-heading">
        <h1>Create staff account</h1>
        <p>Use your TimeTec work details.</p>
      </div>
      {!isSupabaseConfigured() && (
        <div>
          <BackendNotConnected />
        </div>
      )}
      <form onSubmit={handleSubmit} className="auth-form">
        <label className="field" htmlFor="display-name">
          <span>Display name</span>
          <input
            id="display-name"
            required
            maxLength={80}
            autoComplete="name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Name shown to colleagues"
          />
          <small className="field-help">Use the name staff recognise.</small>
        </label>
        <label className="field" htmlFor="email">
          <span>Email address</span>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <small className="field-help" aria-hidden="true">&nbsp;</small>
        </label>
        <label className="field" htmlFor="password">
          <span>Password</span>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <small className="field-help">At least 8 characters.</small>
        </label>
        {error && <p className="form-message form-message--error" role="alert">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="button button--primary button--wide"
        >
          {busy ? "Creating account…" : "Sign up"}
        </button>
      </form>
      <p className="auth-switch">
        Already have an account?{" "}
        <Link href="/login" className="text-link">Sign in</Link>
      </p>
    </div>
  );
}
