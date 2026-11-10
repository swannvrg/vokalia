"use client";

import { FormEvent, useState } from "react";
import { useEffect, useRef } from "react";
import Logo from "@/app/components/Logo";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void }) => string;
      remove: (widgetId: string) => void;
    };
  }
}

export default function InvitationRequestPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileContainer = useRef<HTMLDivElement>(null);
  const turnstileWidget = useRef<string | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!turnstileSiteKey || !turnstileContainer.current) return;

    const renderTurnstile = () => {
      if (!window.turnstile || !turnstileContainer.current || turnstileWidget.current) return;
      turnstileWidget.current = window.turnstile.render(turnstileContainer.current, {
        sitekey: turnstileSiteKey,
        callback: setTurnstileToken,
        "expired-callback": () => setTurnstileToken(""),
        "error-callback": () => setTurnstileToken(""),
      });
    };

    const existingScript = document.querySelector('script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]');
    if (existingScript) {
      renderTurnstile();
      existingScript.addEventListener("load", renderTurnstile);
    } else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", renderTurnstile);
      document.head.appendChild(script);
    }

    return () => {
      if (turnstileWidget.current && window.turnstile) {
        window.turnstile.remove(turnstileWidget.current);
        turnstileWidget.current = null;
      }
    };
  }, [turnstileSiteKey]);

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
            {turnstileSiteKey && <div ref={turnstileContainer} className="mt-4" />}
            <button className="button primary" type="submit">
              Envoyer la demande
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
