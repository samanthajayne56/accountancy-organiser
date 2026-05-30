"use client";

import { FormEvent, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, LockKeyhole } from "lucide-react";
import { createClient } from "../../utils/supabase/client";

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) {
      setErrorMessage(error.message);
      setSubmitting(false);
      return;
    }

    window.location.assign("/");
  }

  return (
    <main className="loginPage">
      <section className="loginPanel" aria-label="Sign in">
        <div className="loginBrand">
          <img src="/tilleyslogo.png" alt="Tilleys Accountancy" />
          <div>
            <p className="eyebrow">Tilleys Accountancy</p>
            <h1>Work Planner</h1>
          </div>
        </div>

        <div className="loginHeading">
          <LockKeyhole size={23} />
          <div>
            <h2>Sign in</h2>
            <p>Use your team account to open the shared planner.</p>
          </div>
        </div>

        {errorMessage ? (
          <div className="loginError" role="alert">
            <AlertTriangle size={16} />
            {errorMessage}
          </div>
        ) : null}

        <form className="loginForm" onSubmit={signIn}>
          <label>
            <span>Email address</span>
            <input
              autoComplete="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="primaryButton loginButton" disabled={submitting} type="submit">
            {submitting ? "Signing in..." : "Sign in"}
            {!submitting ? <ArrowRight size={17} /> : null}
          </button>
        </form>

        <p className="loginSupport">
          Need an account? Ask your administrator to add you in Supabase Authentication.
        </p>
      </section>
    </main>
  );
}
