"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useTransitionRouter } from "@/app/components/PageTransitionProvider";
import Logo from "@/app/components/Logo";

type Business = { name: string; address: string | null; real_phone_number: string | null };
type Day = { dayOfWeek: number; closed: boolean; openTime: string; closeTime: string };
type Resource = { id: string; name: string; active: boolean };
type Service = { id: string; name: string; duration_minutes: number; price: number | null; active?: boolean };
const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const defaultDays: Day[] = dayNames.map((_, dayOfWeek) => ({ dayOfWeek, closed: dayOfWeek === 0, openTime: "09:00", closeTime: "19:00" }));

export default function OnboardingForm({ businessId }: { businessId: string }) {
  const router = useTransitionRouter();
  const [step, setStep] = useState(0);
  const [business, setBusiness] = useState<Business>({ name: "", address: "", real_phone_number: "" });
  const [days, setDays] = useState<Day[]>(defaultDays);
  const [resources, setResources] = useState<Resource[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [newResource, setNewResource] = useState("");
  const [newService, setNewService] = useState({ name: "", duration: "30", price: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [businessResponse, hoursResponse, resourcesResponse, servicesResponse] = await Promise.all([
          fetch(`/api/profile/business?businessId=${businessId}`),
          fetch(`/api/profile/hours?businessId=${businessId}`),
          fetch(`/api/profile/resources?businessId=${businessId}`),
          fetch(`/api/profile/services?businessId=${businessId}`),
        ]);
        if (![businessResponse, hoursResponse, resourcesResponse, servicesResponse].every((response) => response.ok)) throw new Error("Chargement impossible.");
        const loadedBusiness = await businessResponse.json();
        const loadedHours = await hoursResponse.json();
        const loadedResources = await resourcesResponse.json();
        const loadedServices = await servicesResponse.json();
        setBusiness(loadedBusiness);
        if (loadedHours.length) {
          setDays(defaultDays.map((day) => {
            const hour = loadedHours.find((item: { day_of_week: number }) => item.day_of_week - 1 === day.dayOfWeek);
            return hour ? { ...day, closed: false, openTime: hour.open_time, closeTime: hour.close_time } : { ...day, closed: true };
          }));
        }
        setResources(loadedResources);
        setServices(loadedServices);
        if (!loadedBusiness.name?.trim() || !loadedBusiness.address?.trim() || !loadedBusiness.real_phone_number?.trim()) {
          setStep(0);
        } else if (!loadedHours.some((item: { open_time?: string; close_time?: string }) => item.open_time && item.close_time)) {
          setStep(1);
        } else if (!loadedResources.some((item: Resource) => item.active)) {
          setStep(2);
        } else if (!loadedServices.some((item: Service) => item.active !== false)) {
          setStep(3);
        }
      } catch {
        setError("Impossible de charger la configuration.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [businessId]);

  const missing = useMemo(() => {
    const values: string[] = [];
    if (!business.name.trim() || !business.address?.trim() || !business.real_phone_number?.trim()) values.push("les informations du salon");
    if (!days.some((day) => !day.closed)) values.push("au moins un jour ouvert");
    if (!resources.some((resource) => resource.active)) values.push("au moins un coiffeur");
    if (!services.some((service) => service.active !== false)) values.push("au moins une prestation");
    return values;
  }, [business, days, resources, services]);

  async function saveStep() {
    if (step === 0) {
      const response = await fetch("/api/profile/business", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, name: business.name, address: business.address, phoneNumber: business.real_phone_number }) });
      if (!response.ok) throw new Error((await response.json()).error || "Informations invalides.");
    }
    if (step === 1) {
      const response = await fetch("/api/profile/hours", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, days: days.map((day) => ({ ...day, dayOfWeek: day.dayOfWeek + 1 })) }) });
      if (!response.ok) throw new Error((await response.json()).error || "Horaires invalides.");
    }
    if (step === 2 && newResource.trim()) {
      const response = await fetch("/api/profile/resources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, name: newResource.trim() }) });
      if (!response.ok) throw new Error((await response.json()).error || "Coiffeur invalide.");
      setResources([...resources, await response.json()]);
      setNewResource("");
    }
    if (step === 3 && newService.name.trim()) {
      const response = await fetch("/api/profile/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, name: newService.name, durationMinutes: Number(newService.duration), price: newService.price }) });
      if (!response.ok) throw new Error((await response.json()).error || "Prestation invalide.");
      setServices([...services, await response.json()]);
      setNewService({ name: "", duration: "30", price: "" });
    }
  }

  async function continueStep(event?: FormEvent) {
    event?.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await saveStep();
      if (step < 3) setStep(step + 1);
      else {
        const response = await fetch("/api/onboarding/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId }) });
        const result = await response.json();
        if (!response.ok) {
          setError(result.error || "Complétez les éléments requis.");
          return;
        }
        router.replace(`/${businessId}/calendrier?welcome=1`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible d'enregistrer.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="login"><div className="login-card"><p>Chargement de votre configuration...</p></div></main>;
  return (
    <main className="login">
      <form className="login-card" onSubmit={continueStep}>
        <div className="brand"><Logo size={32} /><span className="brand-wordmark">vokalia</span></div>
        <p className="kicker">Étape {step + 1} sur 4</p>
        <h1>{["Informations du salon", "Horaires d'ouverture", "Vos coiffeurs", "Vos prestations"][step]}</h1>
        <div className="progress"><div style={{ width: `${((step + 1) / 4) * 100}%` }} /></div>
        {error && <div className="error">{error}</div>}
        {step === 0 && <><div className="field"><label htmlFor="business-name">Nom du salon</label><input className="input" id="business-name" required value={business.name} onChange={(event) => setBusiness({ ...business, name: event.target.value })} /></div><div className="field"><label htmlFor="business-address">Adresse</label><input className="input" id="business-address" required value={business.address ?? ""} onChange={(event) => setBusiness({ ...business, address: event.target.value })} /></div><div className="field"><label htmlFor="business-phone">Téléphone</label><input className="input" id="business-phone" required type="tel" value={business.real_phone_number ?? ""} onChange={(event) => setBusiness({ ...business, real_phone_number: event.target.value })} /></div></>}
        {step === 1 && <div className="onboarding-list">{days.map((day) => <div className="field-row" key={day.dayOfWeek}><label><input type="checkbox" checked={!day.closed} onChange={(event) => setDays(days.map((item) => item.dayOfWeek === day.dayOfWeek ? { ...item, closed: !event.target.checked } : item))} /> {dayNames[day.dayOfWeek]}</label>{!day.closed && <><input className="input" type="time" value={day.openTime} onChange={(event) => setDays(days.map((item) => item.dayOfWeek === day.dayOfWeek ? { ...item, openTime: event.target.value } : item))} /><input className="input" type="time" value={day.closeTime} onChange={(event) => setDays(days.map((item) => item.dayOfWeek === day.dayOfWeek ? { ...item, closeTime: event.target.value } : item))} /></>}</div>)}</div>}
        {step === 2 && <><ul className="onboarding-list">{resources.map((resource) => <li key={resource.id}>{resource.name}</li>)}</ul><div className="field"><label htmlFor="new-resource">Ajouter un coiffeur</label><input className="input" id="new-resource" value={newResource} onChange={(event) => setNewResource(event.target.value)} placeholder="Prénom" /></div></>}
        {step === 3 && <><ul className="onboarding-list">{services.map((service) => <li key={service.id}>{service.name} · {service.duration_minutes} min{service.price !== null ? ` · ${service.price} €` : ""}</li>)}</ul><div className="field"><label htmlFor="new-service">Nom de la prestation</label><input className="input" id="new-service" value={newService.name} onChange={(event) => setNewService({ ...newService, name: event.target.value })} /></div><div className="field-row"><input className="input" type="number" min="1" value={newService.duration} onChange={(event) => setNewService({ ...newService, duration: event.target.value })} aria-label="Durée en minutes" /><input className="input" type="number" min="0" step="0.01" value={newService.price} onChange={(event) => setNewService({ ...newService, price: event.target.value })} aria-label="Prix en euros" /></div></>}
        {step === 3 && missing.length > 0 && <p className="booking-muted">Il manque : {missing.join(", ")}.</p>}
        <div className="actions"><button type="button" className="button ghost" disabled={step === 0 || saving} onClick={() => setStep(step - 1)}>Retour</button><button className="button primary" disabled={saving}>{saving ? "Enregistrement..." : step === 3 ? "Terminer" : "Continuer"}</button></div>
      </form>
    </main>
  );
}
