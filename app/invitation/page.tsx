"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/app/components/Logo";

export default function InvitationPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const token = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("token") || "";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8 || password !== confirmation) { setError("Utilisez au moins 8 caractères et confirmez le même mot de passe."); return; }
    const response = await fetch("/api/auth/invitation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
    if (!response.ok) { setError((await response.json()).error || "Impossible de définir le mot de passe."); return; }
    router.replace("/profil");
  }

  return <main className="login"><form className="login-card" onSubmit={submit}><div className="brand"><Logo size={32} /><span className="brand-wordmark">vokalia</span></div><h1>Créer votre mot de passe.</h1>{!token ? <p>Lien d&apos;invitation manquant ou invalide.</p> : <><div className="field"><label htmlFor="password">Nouveau mot de passe</label><input className="input" id="password" type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></div><div className="field"><label htmlFor="confirmation">Confirmation</label><input className="input" id="confirmation" type="password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div>{error && <div className="error">{error}</div>}<button className="button primary">Accéder à mon espace</button></>}</form></main>;
}
