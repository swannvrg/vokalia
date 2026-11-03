"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useTransitionRouter } from "@/app/components/PageTransitionProvider";
import Logo from "@/app/components/Logo";

const checks = [
  ["8 caractères minimum", (value: string) => value.length >= 8],
  ["Une majuscule", (value: string) => /[A-Z]/.test(value)],
  ["Un chiffre", (value: string) => /\d/.test(value)],
  ["Un symbole", (value: string) => /[^A-Za-z0-9]/.test(value)],
] as const;

export default function ChangePasswordForm() {
  const router = useTransitionRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const valid = useMemo(() => checks.every(([, test]) => test(password)) && password === confirmation, [password, confirmation]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/account/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Impossible d'enregistrer le mot de passe.");
        return;
      }
      router.replace(result.onboardingPending && result.businessId ? `/${result.businessId}/onboarding` : "/calendrier");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="brand"><Logo size={32} /><span className="brand-wordmark">vokalia</span></div>
        <h1>Choisissez votre mot de passe</h1>
        <p>Pour sécuriser votre espace salon, remplacez le mot de passe provisoire.</p>
        {error && <div className="error">{error}</div>}
        <div className="field">
          <label htmlFor="new-password">Nouveau mot de passe</label>
          <div className="password-field">
            <input className="input" id="new-password" type={visible ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
            <button type="button" className="button ghost" onClick={() => setVisible((value) => !value)}>{visible ? "Masquer" : "Afficher"}</button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="confirm-password">Confirmer le mot de passe</label>
          <input className="input" id="confirm-password" type={visible ? "text" : "password"} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" />
        </div>
        <ul className="password-rules">
          {checks.map(([label, test]) => <li key={label} className={test(password) ? "valid" : ""}><span aria-hidden="true">{test(password) ? "✓" : "○"}</span>{label}</li>)}
        </ul>
        {confirmation && password !== confirmation && <p className="error">Les mots de passe ne correspondent pas.</p>}
        <button className="button primary" disabled={!valid || loading}>{loading ? "Enregistrement..." : "Enregistrer mon mot de passe"}</button>
      </form>
    </main>
  );
}
