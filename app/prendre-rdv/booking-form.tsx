"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import Logo from "@/app/components/Logo";

type Service = { id: string; name: string; duration_minutes: number };
type Resource = { id: string; name: string; color: string };
type Slot = { resource_id: string; resource_name: string; slot_start: string; slot_end: string };
type BookingData = { business: { name: string; address: string | null; real_phone_number: string | null }; services: Service[]; resources: Resource[]; slots: Slot[] };

const parisDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
const formatTime = (value: string) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

export default function BookingForm({ businessId }: { businessId: string }) {
  const [date, setDate] = useState(parisDate);
  const [serviceId, setServiceId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [data, setData] = useState<BookingData | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    startTransition(() => setLoading(true));
    const query = new URLSearchParams({ date, businessId });
    if (serviceId) query.set("serviceId", serviceId);
    if (resourceId) query.set("resourceId", resourceId);
    fetch(`/api/public/booking?${query}`).then(async (response) => {
      const result = await response.json();
      if (!response.ok) setError(result.error); else { setData(result); setSelectedSlot(null); setError(""); }
      setLoading(false);
    }).catch(() => { setError("Impossible de charger les disponibilités."); setLoading(false); });
  }, [businessId, date, serviceId, resourceId]);

  const groupedSlots = useMemo(() => {
    const groups = new Map<string, Slot[]>();
    for (const slot of data?.slots ?? []) {
      if (!slot.slot_start) continue;
      groups.set(slot.slot_start, [...(groups.get(slot.slot_start) ?? []), slot]);
    }
    return [...groups.values()];
  }, [data]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedSlot) return setError("Sélectionnez un créneau.");
    setBooking(true); setError("");
    const response = await fetch("/api/public/booking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, customerName: name, customerPhone: phone, resourceId: selectedSlot.resource_id, serviceId, startTime: selectedSlot.slot_start }) });
    const result = await response.json();
    if (!response.ok) setError(result.error); else { setMessage("Votre rendez-vous est confirmé. À bientôt !"); setName(""); setPhone(""); setSelectedSlot(null); }
    setBooking(false);
  }

  return <main className="booking-page"><div className="booking-card"><header className="booking-brand"><Logo size={32} /><div><p className="kicker">Réservation en ligne</p><h1>{data?.business.name || "Vokalia"}</h1></div></header><p className="booking-intro">Choisissez votre prestation, votre Coiffeur et un créneau.</p>{data?.business.address && <p className="booking-meta">{data.business.address}{data.business.real_phone_number ? ` · ${data.business.real_phone_number}` : ""}</p>}{message ? <div className="booking-success">{message}</div> : <form onSubmit={submit}><div className="booking-grid"><div className="field"><label htmlFor="booking-date">Date</label><input className="input" id="booking-date" type="date" min={parisDate()} value={date} onChange={(event) => setDate(event.target.value)} required /></div><div className="field"><label htmlFor="booking-service">Prestation</label><select className="select" id="booking-service" value={serviceId} onChange={(event) => { setServiceId(event.target.value); setResourceId(""); }} required><option value="">Choisir une prestation</option>{data?.services.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.duration_minutes} min</option>)}</select></div><div className="field"><label htmlFor="booking-resource">Coiffeur</label><select className="select" id="booking-resource" value={resourceId} onChange={(event) => setResourceId(event.target.value)} disabled={!serviceId}><option value="">Tous les Coiffeurs</option>{data?.resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</select></div></div><div className="booking-slots"><h2>Créneaux disponibles</h2>{loading ? <p className="booking-muted">Recherche en cours...</p> : !serviceId ? <p className="booking-muted">Choisissez d&apos;abord une prestation.</p> : groupedSlots.length === 0 ? <p className="booking-muted">Aucun créneau disponible pour cette date.</p> : <div className="slot-list">{groupedSlots.map((slots) => <div className="slot-group" key={slots[0].slot_start}><span>{formatTime(slots[0].slot_start)}</span><div>{slots.map((slot) => { const resource = data?.resources.find((item) => item.id === slot.resource_id); return <button type="button" className={`slot-choice ${selectedSlot?.slot_start === slot.slot_start && selectedSlot.resource_id === slot.resource_id ? "selected" : ""}`} style={{ "--slot-color": resource?.color || "var(--color-accent)" } as React.CSSProperties} key={slot.resource_id} onClick={() => setSelectedSlot(slot)}>{slot.resource_name}</button>; })}</div></div>)}</div>}</div><div className="booking-grid"><div className="field"><label htmlFor="booking-name">Votre nom</label><input className="input" id="booking-name" value={name} onChange={(event) => setName(event.target.value)} required /></div><div className="field"><label htmlFor="booking-phone">Téléphone</label><input className="input" id="booking-phone" type="tel" placeholder="+33..." value={phone} onChange={(event) => setPhone(event.target.value)} required /></div></div>{error && <div className="error">{error}</div>}<button className="button booking-submit" disabled={booking || !selectedSlot}>{booking ? "Confirmation..." : "Confirmer le rendez-vous"}</button></form>}</div></main>;
}
