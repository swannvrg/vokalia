"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Toast from "@/app/components/toast";
import Logo from "@/app/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      setError("Email ou mot de passe incorrect.");
    } else {
      const result = await response.json();
      const redirectParam =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("redirect")
          : null;

      if (redirectParam && redirectParam.startsWith("/")) {
        router.replace(redirectParam);
      } else if (result.role === "admin") {
        router.replace("/admin");
      } else if (result.businessId) {
        router.replace(`/${result.businessId}/calendrier`);
      } else {
        router.replace("/calendrier");
      }
    }
    setLoading(false);
  }

  return <main className="login"><form className="login-card" onSubmit={submit}>
    <div className="brand"><Logo size={32} /><span className="brand-wordmark">vokalia</span></div>
    <h1>Bon retour.</h1><p>Connectez-vous pour ouvrir le planning du salon.</p>
    {error && <Toast message={error} type="error" onClose={() => setError("")} />}
    <div className="field"><label htmlFor="email">Email</label><input className="input" id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
    <div className="field"><label htmlFor="password">Mot de passe</label><input className="input" id="password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
    <button className="button primary" disabled={loading}>{loading ? "Connexion..." : "Se connecter"}</button>
    <p className="login-invitation"><a href="/demande-invitation">Demander à rejoindre Vokalia</a></p>
  </form></main>;
}
