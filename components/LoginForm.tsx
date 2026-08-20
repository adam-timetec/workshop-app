"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import BackendNotConnected from "./BackendNotConnected";

export default function LoginForm({ confirmError = false }: { confirmError?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    confirmError ? "That confirmation link didn't work. Try signing in, or sign up again." : null
  );
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return; // banner above already explains
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError("Sign-in failed. Check your email and password and try again.");
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <div className="auth-card">
      <div className="auth-heading">
        <h1>Sign in</h1>
        <p>Open the current TimeTec staff order.</p>
      </div>
      {!isSupabaseConfigured() && (
        <div>
          <BackendNotConnected />
        </div>
      )}
      <form onSubmit={handleSubmit} className="auth-form">
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <small className="field-help" aria-hidden="true">&nbsp;</small>
        </label>
        {error && <p className="form-message form-message--error" role="alert">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="button button--primary button--wide"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="auth-switch">
        No account yet?{" "}
        <Link href="/signup" className="text-link">Create account</Link>
      </p>
    </div>
  );
}
