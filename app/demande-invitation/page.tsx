"use client";

import { FormEvent, useState } from "react";
import Logo from "@/app/components/Logo";
import TurnstileWidget from "@/app/components/TurnstileWidget";

export default function InvitationRequestPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (turnstileSiteKey && !turnstileToken) {
      setError("Veuillez confirmer que vous n'êtes pas un robot.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/public/invitation-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...Object.fromEntries(form.entries()),
        turnstileToken,
      }),
    });
    if (!response.ok) {
      setError((await response.json()).error || "Une erreur est survenue.");
      return;
    }
    setSent(true);
  }

  return (
    <main className="login">
      <section className="login-card">
        <div className="brand">
          <Logo size={32} />
          <span className="brand-wordmark">vokalia</span>
        </div>
        <h1>Ouvrir votre espace.</h1>
        {sent ? (
          <div className="booking-success">
            Votre demande a bien été reçue. Vous serez recontacté prochainement.
          </div>
        ) : (
          <form onSubmit={submit}>
            {error && <div className="error">{error}</div>}
            <input
              aria-hidden="true"
              autoComplete="off"
              name="website"
              tabIndex={-1}
              style={{ display: "none" }}
            />
            <div className="field">
              <label htmlFor="salonName">Nom du salon</label>
              <input
                className="input"
                id="salonName"
                name="salonName"
                required
              />
            </div>
            
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                className="input"
                id="email"
                name="email"
                type="email"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="phone">Téléphone</label>
              <input className="input" id="phone" name="phone" type="tel" />
            </div>
            <div className="field">
              <label htmlFor="message">Message</label>
              <textarea
                className="input"
                id="message"
                name="message"
                rows={4}
              />
            </div>
            {turnstileSiteKey && <TurnstileWidget onToken={setTurnstileToken} />}
            <button className="button primary" type="submit">
              Envoyer la demande
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
