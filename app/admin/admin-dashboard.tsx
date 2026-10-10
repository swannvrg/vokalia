"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/app/components/Logo";

type RequestItem = { id: string; salon_name: string; contact_name: string; email: string; phone: string | null; message: string | null; status: string; created_at: string; business_id: string | null };
type Business = { id: string; name: string; status: string; app_user_id: string | null };

export default function AdminDashboard({ initialRequests, businesses }: { initialRequests: RequestItem[]; businesses: Business[] }) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ text: string; url?: string } | null>(null);
  const pending = requests.filter((item) => item.status === "pending");

  async function processRequest(requestId: string, action: "approve" | "reject") {
    setError("");
    setNotice(null);
    const response = await fetch("/api/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, action }) });
    if (!response.ok) { setError((await response.json()).error || "Opération impossible."); return; }
    const result = await response.json();
    if (result.warning) setNotice({ text: result.warning, url: result.invitationUrl });
    setRequests((items) => items.map((item) => item.id === requestId ? { ...item, status: action === "approve" ? "approved" : "rejected" } : item));
    router.refresh();
  }

  return <main className="shell"><header className="topbar"><div className="brand"><Logo size={28} /><span className="brand-wordmark">vokalia</span></div><button className="button ghost" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); }}>Se déconnecter</button></header>
    <div className="content">
      <div className="toolbar">
        <div>
          <p className="kicker">Administration</p>
          <h2>Demandes d&apos;invitation</h2>
          <p>Validez les nouveaux espaces salon.</p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="panel" style={{ padding: "1.25rem 1.5rem" }}>
          <div className="stat-big">{pending.length}</div>
          <div className="stat-label">demande{pending.length > 1 ? "s" : ""} en attente</div>
        </div>
        <div className="panel" style={{ padding: "1.25rem 1.5rem" }}>
          <div className="stat-big">{businesses.length}</div>
          <div className="stat-label">salon{businesses.length > 1 ? "s" : ""} enregistré{businesses.length > 1 ? "s" : ""}</div>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {notice && <div className="booking-success">{notice.text}{notice.url && <> <a href={notice.url}>Ouvrir le lien d&apos;invitation</a></>}</div>}
      <section className="panel">
        <h3>En attente ({pending.length})</h3>
        {pending.length === 0 ? (
          <p className="booking-muted">Aucune demande en attente.</p>
        ) : (
          pending.map((item) => (
            <div className="field-row" key={item.id} style={{ justifyContent: "space-between", padding: ".8rem 0", borderBottom: "1px solid var(--color-border)" }}>
              <div>
                <strong>{item.salon_name}</strong>
                <div>{item.contact_name} · {item.email}</div>
                <small style={{ color: "var(--color-text-muted)" }}>{new Date(item.created_at).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}{item.phone ? ` · ${item.phone}` : ""}</small>
              </div>
              <div className="actions">
                <button className="button primary" onClick={() => processRequest(item.id, "approve")}>Accepter la demande</button>
                <button className="button danger" onClick={() => processRequest(item.id, "reject")}>Refuser</button>
              </div>
            </div>
          ))
        )}
      </section>
      <section className="panel">
        <h3>Salons ({businesses.length})</h3>
        {businesses.map((business) => (
          <div className="field-row" key={business.id} style={{ justifyContent: "space-between", padding: ".55rem 0", borderBottom: "1px solid var(--color-border)" }}>
            <span>{business.name}</span>
            <small style={{ color: "var(--color-text-muted)" }}>{business.status} · propriétaire {business.app_user_id ? business.app_user_id.slice(0, 8) : "non lié"}</small>
          </div>
        ))}
      </section>
    </div></main>;
}
