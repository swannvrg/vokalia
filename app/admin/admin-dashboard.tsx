"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import DashboardShell from "@/app/components/DashboardShell";
import { usePageReady } from "@/app/components/PageTransitionProvider";

type RequestItem = { id: string; salon_name: string; contact_name: string; email: string; phone: string | null; message: string | null; status: string; created_at: string; business_id: string | null };
type Business = { id: string; name: string; status: string; app_user_id: string | null };

export default function AdminDashboard({ initialRequests, businesses }: { initialRequests: RequestItem[]; businesses: Business[] }) {
  const router = useRouter();
  usePageReady(true);
  const [requests, setRequests] = useState(initialRequests);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ text: string; url?: string } | null>(null);
  const [invite, setInvite] = useState({ salonName: "", email: "", phone: "" });
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
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

  async function inviteSalon(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice(null);
    setTemporaryPassword("");
    setInviteLoading(true);
    try {
      const response = await fetch("/api/admin/invite-salon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invite),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Invitation impossible.");
        return;
      }
      setTemporaryPassword(result.temporaryPassword);
      setNotice({ text: result.warning || "Invitation créée et email envoyé." });
      setInvite({ salonName: "", email: "", phone: "" });
      router.refresh();
    } finally {
      setInviteLoading(false);
    }
  }

  return <DashboardShell isAdmin={true}>
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
      {temporaryPassword && (
        <section className="panel">
          <h3>Mot de passe provisoire</h3>
          <p>Transmettez-le maintenant : il ne sera plus affiché.</p>
          <div className="field-row">
            <code>{temporaryPassword}</code>
            <button type="button" className="button ghost" onClick={() => navigator.clipboard.writeText(temporaryPassword)}>Copier</button>
          </div>
        </section>
      )}
      <section className="panel">
        <h3>Inviter un salon</h3>
        <form className="form-grid" onSubmit={inviteSalon}>
          <div className="field"><label htmlFor="invite-salon-name">Nom du salon</label><input className="input" id="invite-salon-name" required value={invite.salonName} onChange={(event) => setInvite({ ...invite, salonName: event.target.value })} /></div>
          <div className="field"><label htmlFor="invite-email">Email du barber</label><input className="input" id="invite-email" type="email" required value={invite.email} onChange={(event) => setInvite({ ...invite, email: event.target.value })} /></div>
          <div className="field"><label htmlFor="invite-phone">Téléphone (optionnel)</label><input className="input" id="invite-phone" type="tel" value={invite.phone} onChange={(event) => setInvite({ ...invite, phone: event.target.value })} /></div>
          <button className="button primary" disabled={inviteLoading}>{inviteLoading ? "Création..." : "Inviter le salon"}</button>
        </form>
      </section>
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
    </DashboardShell>;
}
