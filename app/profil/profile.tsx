"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Toast from "@/app/components/toast";
import DashboardShell from "@/app/components/DashboardShell";
import Icon from "@/app/components/Icon";

type Business = {
  id: string;
  name: string;
  real_phone_number: string | null;
  address: string | null;
  timezone: string;
};
type Hours = {
  id?: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
};
type Resource = {
  id: string;
  name: string;
  capacity: number;
  active: boolean;
  color: string;
  resource_type: string;
};
type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
  active: boolean;
  is_default: boolean;
  combo_service_id: string | null;
};

const days = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];
const colors = [
  "#BD5B39",
  "#C89B57",
  "#E0A583",
  "#9FB98A",
  "#8C8172",
  "#6B8A7A",
];
const timeOptions = Array.from({ length: 24 * 4 }, (_, index) => {
  const minutes = index * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

export default function Profile({ businessId }: { businessId?: string } = {}) {
  const router = useRouter();

  // Saved / initial state
  const [initialBusiness, setInitialBusiness] = useState<Business | null>(null);
  const [initialHours, setInitialHours] = useState<Hours[]>([]);
  const [initialResources, setInitialResources] = useState<Resource[]>([]);
  const [initialServices, setInitialServices] = useState<Service[]>([]);

  // Working state
  const [business, setBusiness] = useState<Business | null>(null);
  const [hours, setHours] = useState<Hours[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  // Add forms
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(colors[0]);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDuration, setNewServiceDuration] = useState("30");
  const [newServicePrice, setNewServicePrice] = useState("");

  // Feedback & navigation
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  // Password section
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  // Tooltip state for combo explanation
  const [showComboTooltip, setShowComboTooltip] = useState(false);

  // Collapsible sections (Informations and Horaires open by default)
  const [openSections, setOpenSections] = useState({
    business: true,
    hours: true,
    resources: true,
    services: true,
    password: false,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  function notify(messageText: string) {
    setError("");
    setMessage(messageText);
    window.setTimeout(
      () => setMessage((current) => (current === messageText ? "" : current)),
      3500,
    );
  }

  const load = useCallback(async () => {
    const qs = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
    const [businessResponse, hoursResponse, resourcesResponse, servicesResponse] =
      await Promise.all([
        fetch(`/api/profile/business${qs}`),
        fetch(`/api/profile/hours${qs}`),
        fetch(`/api/profile/resources${qs}`),
        fetch(`/api/profile/services${qs}`),
      ]);

    if (
      [businessResponse, hoursResponse, resourcesResponse, servicesResponse].some(
        (response) => response.status === 401,
      )
    ) {
      return router.replace("/login");
    }

    const [businessData, hoursData, resourcesData, servicesData] = await Promise.all([
      businessResponse.json(),
      hoursResponse.json(),
      resourcesResponse.json(),
      servicesResponse.json(),
    ]);

    startTransition(() => {
      if (!businessResponse.ok || !hoursResponse.ok || !resourcesResponse.ok || !servicesResponse.ok) {
        setError(businessData.error || hoursData.error || resourcesData.error || servicesData.error);
      } else {
        setBusiness(businessData);
        setInitialBusiness(businessData);
        setHours(hoursData);
        setInitialHours(hoursData);
        setResources(resourcesData);
        setInitialResources(resourcesData);
        setServices(servicesData);
        setInitialServices(servicesData);
      }
    });
  }, [businessId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  // Track unsaved changes
  const hasBusinessChanged = useMemo(() => {
    if (!business || !initialBusiness) return false;
    return (
      business.name !== initialBusiness.name ||
      (business.real_phone_number ?? "") !== (initialBusiness.real_phone_number ?? "") ||
      (business.address ?? "") !== (initialBusiness.address ?? "")
    );
  }, [business, initialBusiness]);

  const hasHoursChanged = useMemo(() => {
    return JSON.stringify(hours) !== JSON.stringify(initialHours);
  }, [hours, initialHours]);

  const hasResourcesChanged = useMemo(() => {
    return JSON.stringify(resources) !== JSON.stringify(initialResources);
  }, [resources, initialResources]);

  const hasServicesChanged = useMemo(() => {
    return JSON.stringify(services) !== JSON.stringify(initialServices);
  }, [services, initialServices]);

  const hasUnsavedChanges =
    hasBusinessChanged || hasHoursChanged || hasResourcesChanged || hasServicesChanged;

  // Warn user before leaving page with unsaved modifications
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Revert all unsaved changes
  const cancelAllChanges = () => {
    setBusiness(initialBusiness ? { ...initialBusiness } : null);
    setHours(initialHours ? JSON.parse(JSON.stringify(initialHours)) : []);
    setResources(initialResources ? JSON.parse(JSON.stringify(initialResources)) : []);
    setServices(initialServices ? JSON.parse(JSON.stringify(initialServices)) : []);
    setFieldErrors({});
    notify("Modifications annulées.");
  };

  // Validation function
  const validateForm = () => {
    const errors: Record<string, boolean> = {};

    if (business && !business.name.trim()) {
      errors["business-name"] = true;
    }

    for (const res of resources) {
      if (!res.name.trim()) {
        errors[`resource-${res.id}`] = true;
      }
    }

    for (const srv of services) {
      if (!srv.name.trim()) {
        errors[`service-name-${srv.id}`] = true;
      }
      if (!srv.duration_minutes || srv.duration_minutes <= 0) {
        errors[`service-duration-${srv.id}`] = true;
      }
      if (srv.price !== null && srv.price < 0) {
        errors[`service-price-${srv.id}`] = true;
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save all modified sections
  async function saveAllChanges() {
    if (!validateForm()) {
      setError("Veuillez corriger les champs en surbrillance (durée > 0, prix ≥ 0, nom obligatoire).");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const promises: Promise<Response>[] = [];

      if (hasBusinessChanged && business) {
        promises.push(
          fetch("/api/profile/business", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: business.name,
              phoneNumber: business.real_phone_number,
              address: business.address,
              ...(businessId ? { businessId } : {}),
            }),
          }),
        );
      }

      if (hasHoursChanged) {
        promises.push(
          fetch("/api/profile/hours", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(businessId ? { businessId } : {}),
              days: days.map((_, index) => {
                const hour = hours.find((item) => item.day_of_week === index + 1);
                return {
                  dayOfWeek: index + 1,
                  closed: !hour,
                  openTime: hour?.open_time.slice(0, 5) || "09:00",
                  closeTime: hour?.close_time.slice(0, 5) || "19:00",
                };
              }),
            }),
          }),
        );
      }

      if (hasResourcesChanged) {
        for (const res of resources) {
          const init = initialResources.find((r) => r.id === res.id);
          if (JSON.stringify(res) !== JSON.stringify(init)) {
            promises.push(
              fetch("/api/profile/resources", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...res,
                  id: res.id,
                  ...(businessId ? { businessId } : {}),
                }),
              }),
            );
          }
        }
      }

      if (hasServicesChanged) {
        for (const srv of services) {
          const init = initialServices.find((s) => s.id === srv.id);
          if (JSON.stringify(srv) !== JSON.stringify(init)) {
            promises.push(
              fetch("/api/profile/services", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...srv,
                  id: srv.id,
                  ...(businessId ? { businessId } : {}),
                }),
              }),
            );
          }
        }
      }

      const results = await Promise.all(promises);
      const hasError = results.some((r) => !r.ok);

      if (hasError) {
        setError("Une erreur est survenue lors de l'enregistrement de certaines modifications.");
      } else {
        await load();
        setFieldErrors({});
        notify("Toutes les modifications ont été enregistrées avec succès.");
      }
    } catch {
      setError("Impossible d'enregistrer les modifications.");
    } finally {
      setIsSaving(false);
    }
  }

  // Section-specific saves
  async function saveBusinessSection() {
    if (!business) return;
    if (!business.name.trim()) {
      setFieldErrors((prev) => ({ ...prev, "business-name": true }));
      setError("Le nom du salon est obligatoire.");
      return;
    }
    setIsSaving(true);
    const response = await fetch("/api/profile/business", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: business.name,
        phoneNumber: business.real_phone_number,
        address: business.address,
        ...(businessId ? { businessId } : {}),
      }),
    });
    setIsSaving(false);
    if (response.ok) {
      setInitialBusiness({ ...business });
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next["business-name"];
        return next;
      });
      notify("Informations du salon enregistrées.");
    } else {
      setError((await response.json()).error);
    }
  }

  async function saveHoursSection() {
    setIsSaving(true);
    const response = await fetch("/api/profile/hours", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(businessId ? { businessId } : {}),
        days: days.map((_, index) => {
          const hour = hours.find((item) => item.day_of_week === index + 1);
          return {
            dayOfWeek: index + 1,
            closed: !hour,
            openTime: hour?.open_time.slice(0, 5) || "09:00",
            closeTime: hour?.close_time.slice(0, 5) || "19:00",
          };
        }),
      }),
    });
    setIsSaving(false);
    if (response.ok) {
      setInitialHours(JSON.parse(JSON.stringify(hours)));
      notify("Horaires enregistrés.");
    } else {
      setError((await response.json()).error);
    }
  }

  async function saveResourcesSection() {
    for (const res of resources) {
      if (!res.name.trim()) {
        setFieldErrors((prev) => ({ ...prev, [`resource-${res.id}`]: true }));
        setError("Le nom du coiffeur ne peut pas être vide.");
        return;
      }
    }
    setIsSaving(true);
    const promises = resources.map((res) =>
      fetch("/api/profile/resources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...res,
          id: res.id,
          ...(businessId ? { businessId } : {}),
        }),
      }),
    );
    const results = await Promise.all(promises);
    setIsSaving(false);
    if (results.every((r) => r.ok)) {
      setInitialResources(JSON.parse(JSON.stringify(resources)));
      setFieldErrors({});
      notify("Coiffeurs enregistrés.");
    } else {
      setError("Erreur lors de l'enregistrement de l'équipe.");
    }
  }

  async function saveServicesSection() {
    for (const srv of services) {
      if (!srv.name.trim() || !srv.duration_minutes || srv.duration_minutes <= 0 || (srv.price !== null && srv.price < 0)) {
        setFieldErrors((prev) => ({
          ...prev,
          [`service-name-${srv.id}`]: !srv.name.trim(),
          [`service-duration-${srv.id}`]: !srv.duration_minutes || srv.duration_minutes <= 0,
          [`service-price-${srv.id}`]: srv.price !== null && srv.price < 0,
        }));
        setError("Veuillez vérifier les prestations en surbrillance (nom, durée > 0, prix ≥ 0).");
        return;
      }
    }
    setIsSaving(true);
    const promises = services.map((srv) =>
      fetch("/api/profile/services", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...srv,
          id: srv.id,
          ...(businessId ? { businessId } : {}),
        }),
      }),
    );
    const results = await Promise.all(promises);
    setIsSaving(false);
    if (results.every((r) => r.ok)) {
      setInitialServices(JSON.parse(JSON.stringify(services)));
      setFieldErrors({});
      notify("Prestations enregistrées.");
    } else {
      setError("Erreur lors de l'enregistrement des prestations.");
    }
  }

  // Toggle active status directly
  async function toggleResourceActive(resource: Resource) {
    const nextState = !resource.active;
    const response = await fetch("/api/profile/resources", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...resource,
        active: nextState,
        id: resource.id,
        ...(businessId ? { businessId } : {}),
      }),
    });
    if (response.ok) {
      await load();
      notify(`Coiffeur ${nextState ? "réactivé" : "désactivé"}.`);
    } else {
      setError((await response.json()).error);
    }
  }

  async function toggleServiceActive(service: Service) {
    const nextState = !service.active;
    const response = await fetch("/api/profile/services", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...service,
        active: nextState,
        id: service.id,
        ...(businessId ? { businessId } : {}),
      }),
    });
    if (response.ok) {
      await load();
      notify(`Prestation ${nextState ? "réactivée" : "désactivée"}.`);
    } else {
      const data = await response.json().catch(() => ({}));
      setError(data.error || "Impossible de changer l'état de la prestation.");
    }
  }

  async function addResource() {
    if (!newName.trim()) {
      setError("Veuillez entrer un nom pour le coiffeur.");
      return;
    }
    const response = await fetch("/api/profile/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        color: newColor,
        ...(businessId ? { businessId } : {}),
      }),
    });
    if (response.ok) {
      setNewName("");
      await load();
      notify("Coiffeur ajouté.");
    } else setError((await response.json()).error);
  }

  async function addService() {
    if (!newServiceName.trim()) {
      setError("Le nom de la prestation est obligatoire.");
      return;
    }
    const dur = Number(newServiceDuration);
    if (!dur || dur <= 0) {
      setError("La durée doit être supérieure à 0 minute.");
      return;
    }
    const prc = newServicePrice === "" ? null : Number(newServicePrice);
    if (prc !== null && prc < 0) {
      setError("Le prix ne peut pas être négatif.");
      return;
    }

    const response = await fetch("/api/profile/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newServiceName,
        durationMinutes: dur,
        price: prc,
        ...(businessId ? { businessId } : {}),
      }),
    });
    if (response.ok) {
      setNewServiceName("");
      setNewServiceDuration("30");
      setNewServicePrice("");
      await load();
      notify("Prestation ajoutée.");
    } else setError((await response.json()).error);
  }

  async function setDefaultService(newServiceId: string) {
    if (!newServiceId) return;
    const response = await fetch("/api/profile/services/default", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: newServiceId,
        ...(businessId ? { businessId } : {}),
      }),
    });
    if (response.ok) {
      await load();
      const target = services.find((s) => s.id === newServiceId);
      notify(
        `« ${target?.name || "Prestation"} » est désormais la prestation par défaut du salon.`,
      );
    } else {
      const data = await response.json().catch(() => ({}));
      setError(
        data.error || "Impossible de mettre à jour la prestation par défaut.",
      );
    }
  }

  async function changePassword() {
    if (newPassword.length < 8 || newPassword !== passwordConfirmation) {
      setError("Le mot de passe doit contenir au moins 8 caractères et être confirmé à l'identique.");
      return;
    }
    const response = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword, currentPassword }),
    });
    if (!response.ok) {
      setError((await response.json()).error);
    } else {
      setCurrentPassword("");
      setNewPassword("");
      setPasswordConfirmation("");
      notify("Mot de passe modifié.");
    }
  }

  const effectiveBusinessId = businessId || business?.id;

  return (
    <DashboardShell businessId={effectiveBusinessId}>
      {error && <Toast message={error} type="error" onClose={() => setError("")} />}
      {!error && message && <Toast message={message} type="success" onClose={() => setMessage("")} />}

      <div className="toolbar">
        <div>
          <p className="kicker">Configuration</p>
          <h2>Réglages du salon</h2>
          <p>Coordonnées, horaires et équipe.</p>
        </div>
      </div>

      {/* 1. Informations du salon */}
      <section className="panel mb-4">
        <button
          type="button"
          onClick={() => toggleSection("business")}
          className="w-full flex items-center justify-between text-left cursor-pointer border-none bg-transparent p-0 text-inherit font-inherit"
          aria-expanded={openSections.business}
        >
          <h3 className="m-0 flex items-center gap-2">
            <span>Informations du salon</span>
            {hasBusinessChanged && (
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] inline-block" title="Modifications en attente" />
            )}
          </h3>
          <span className="p-2 text-[var(--color-text-dim)]">
            <Icon name={openSections.business ? "chevron-up" : "chevron-down"} size={18} />
          </span>
        </button>

        {openSections.business && business && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <div className="field-row">
              <div className="field">
                <label htmlFor="business-name">Nom du salon *</label>
                <input
                  className={`input ${fieldErrors["business-name"] ? "!border-red-500 !ring-1 !ring-red-500" : ""}`}
                  id="business-name"
                  value={business.name}
                  onChange={(event) =>
                    setBusiness({ ...business, name: event.target.value })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="business-phone">Téléphone</label>
                <input
                  className="input"
                  id="business-phone"
                  type="tel"
                  placeholder="06 12 34 56 78"
                  value={business.real_phone_number ?? ""}
                  onChange={(event) =>
                    setBusiness({
                      ...business,
                      real_phone_number: event.target.value,
                    })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="business-address">Adresse</label>
                <input
                  className="input"
                  id="business-address"
                  value={business.address ?? ""}
                  onChange={(event) =>
                    setBusiness({ ...business, address: event.target.value })
                  }
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="button primary"
                disabled={isSaving || !hasBusinessChanged}
                onClick={saveBusinessSection}
              >
                Enregistrer les coordonnées
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 2. Horaires d'ouverture */}
      <section className="panel mb-4">
        <button
          type="button"
          onClick={() => toggleSection("hours")}
          className="w-full flex items-center justify-between text-left cursor-pointer border-none bg-transparent p-0 text-inherit font-inherit"
          aria-expanded={openSections.hours}
        >
          <h3 className="m-0 flex items-center gap-2">
            <span>Horaires d&apos;ouverture · {business?.timezone || "Europe/Paris"}</span>
            {hasHoursChanged && (
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] inline-block" title="Modifications en attente" />
            )}
          </h3>
          <span className="p-2 text-[var(--color-text-dim)]">
            <Icon name={openSections.hours ? "chevron-up" : "chevron-down"} size={18} />
          </span>
        </button>

        {openSections.hours && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <div>
              {days.map((day, index) => {
                const hour = hours.find((item) => item.day_of_week === index + 1);
                return (
                  <div
                    className="field-row"
                    key={day}
                    style={{ marginBottom: ".65rem" }}
                  >
                    <strong style={{ width: "6rem" }}>{day}</strong>
                    <label
                      className="field"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: ".4rem",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(hour)}
                        onChange={(event) =>
                          setHours((current) =>
                            event.target.checked
                              ? [
                                ...current,
                                {
                                  day_of_week: index + 1,
                                  open_time: "09:00",
                                  close_time: "19:00",
                                },
                              ]
                              : current.filter(
                                (item) => item.day_of_week !== index + 1,
                              ),
                          )
                        }
                      />{" "}
                      Ouvert
                    </label>
                    {hour && (
                      <>
                        <select
                          className="select"
                          value={hour.open_time.slice(0, 5)}
                          onChange={(event) =>
                            setHours((current) =>
                              current.map((item) =>
                                item.day_of_week === index + 1
                                  ? { ...item, open_time: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        >
                          {timeOptions.map((option) => (
                            <option key={`open-${option}`} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <span>à</span>
                        <select
                          className="select"
                          value={hour.close_time.slice(0, 5)}
                          onChange={(event) =>
                            setHours((current) =>
                              current.map((item) =>
                                item.day_of_week === index + 1
                                  ? { ...item, close_time: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        >
                          {timeOptions.map((option) => (
                            <option key={`close-${option}`} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="button primary"
                disabled={isSaving || !hasHoursChanged}
                onClick={saveHoursSection}
              >
                Enregistrer les horaires
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 3. Coiffeurs */}
      <section className="panel mb-4">
        <button
          type="button"
          onClick={() => toggleSection("resources")}
          className="w-full flex items-center justify-between text-left cursor-pointer border-none bg-transparent p-0 text-inherit font-inherit"
          aria-expanded={openSections.resources}
        >
          <h3 className="m-0 flex items-center gap-2">
            <span>Coiffeurs</span>
            {hasResourcesChanged && (
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] inline-block" title="Modifications en attente" />
            )}
          </h3>
          <span className="p-2 text-[var(--color-text-dim)]">
            <Icon name={openSections.resources ? "chevron-up" : "chevron-down"} size={18} />
          </span>
        </button>

        {openSections.resources && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            {/* Formulaire d'ajout rapide */}
            <div className="field-row mb-4 p-3 bg-[var(--color-bg-subtle)] rounded-lg">
              <input
                className="input flex-1"
                placeholder="Nom du nouveau coiffeur"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
              />
              <input
                className="input w-14 cursor-pointer"
                type="color"
                value={newColor}
                onChange={(event) => setNewColor(event.target.value)}
                title="Couleur associée sur le planning"
              />
              <button type="button" className="button primary" onClick={addResource}>
                Ajouter à l&apos;équipe
              </button>
            </div>

            {/* Liste modifiable sans bouton par ligne */}
            <div className="flex flex-col gap-2">
              {resources.map((resource) => (
                <div
                  key={resource.id}
                  className={`flex flex-wrap items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] transition-opacity ${
                    resource.active ? "bg-[var(--color-bg-panel)]" : "opacity-50 bg-[var(--color-bg-subtle)]"
                  }`}
                >
                  <input
                    className={`input flex-1 min-w-[150px] ${
                      fieldErrors[`resource-${resource.id}`] ? "!border-red-500 !ring-1 !ring-red-500" : ""
                    }`}
                    value={resource.name}
                    placeholder="Nom"
                    onChange={(event) =>
                      setResources((current) =>
                        current.map((item) =>
                          item.id === resource.id
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <input
                    className="input w-12 cursor-pointer"
                    type="color"
                    value={resource.color}
                    onChange={(event) =>
                      setResources((current) =>
                        current.map((item) =>
                          item.id === resource.id
                            ? { ...item, color: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  {/* Action secondaire discrète */}
                  <button
                    type="button"
                    className="text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)] underline p-2 min-h-[44px] flex items-center"
                    onClick={() => toggleResourceActive(resource)}
                  >
                    {resource.active ? "Désactiver" : "Réactiver"}
                  </button>
                </div>
              ))}
            </div>

            <p className="text-[var(--color-text-muted)] text-xs mt-3">
              Désactiver un coiffeur le retire du calendrier et des nouvelles prises de rendez-vous, tout en conservant son historique.
            </p>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="button primary"
                disabled={isSaving || !hasResourcesChanged}
                onClick={saveResourcesSection}
              >
                Enregistrer l&apos;équipe
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 4. Prestations */}
      <section className="panel mb-4">
        <button
          type="button"
          onClick={() => toggleSection("services")}
          className="w-full flex items-center justify-between text-left cursor-pointer border-none bg-transparent p-0 text-inherit font-inherit"
          aria-expanded={openSections.services}
        >
          <h3 className="m-0 flex items-center gap-2">
            <span>Prestations</span>
            {hasServicesChanged && (
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] inline-block" title="Modifications en attente" />
            )}
          </h3>
          <span className="p-2 text-[var(--color-text-dim)]">
            <Icon name={openSections.services ? "chevron-up" : "chevron-down"} size={18} />
          </span>
        </button>

        {openSections.services && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            {/* Ajout rapide d'une prestation */}
            <div className="field-row mb-4 p-3 bg-[var(--color-bg-subtle)] rounded-lg">
              <input
                className="input flex-2"
                placeholder="Nom de la prestation"
                value={newServiceName}
                onChange={(event) => setNewServiceName(event.target.value)}
              />
              <input
                className="input w-28"
                type="number"
                min="1"
                step="5"
                placeholder="Durée (min)"
                value={newServiceDuration}
                onChange={(event) => setNewServiceDuration(event.target.value)}
              />
              <input
                className="input w-24"
                type="number"
                min="0"
                step="0.5"
                placeholder="Prix (€)"
                value={newServicePrice}
                onChange={(event) => setNewServicePrice(event.target.value)}
              />
              <button type="button" className="button primary" onClick={addService}>
                Ajouter la prestation
              </button>
            </div>

            {(() => {
              const activeServices = services.filter((s) => s.active);
              const currentDefaultService = activeServices.find((s) => s.is_default);
              const hasDefaultIssue = activeServices.length > 0 && !currentDefaultService;

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {/* Sélecteur unique : Prestation par défaut du salon */}
                  <div
                    style={{
                      padding: "1rem 1.25rem",
                      borderRadius: "12px",
                      border: hasDefaultIssue
                        ? "2px solid var(--color-danger)"
                        : "1px solid var(--color-border)",
                      backgroundColor: hasDefaultIssue
                        ? "color-mix(in srgb, var(--color-danger) 10%, var(--color-bg-panel))"
                        : "color-mix(in srgb, var(--color-accent) 5%, var(--color-bg-panel))",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.6rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span
                          style={{
                            fontSize: "1.1rem",
                            color: hasDefaultIssue
                              ? "var(--color-danger)"
                              : "var(--color-accent-soft)",
                            display: "inline-flex",
                            alignItems: "center",
                          }}
                        >
                          <Icon name="star" size={16} />
                        </span>
                        <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                          Prestation par défaut du salon (Agent vocal)
                        </span>
                      </div>
                      {hasDefaultIssue && (
                        <span
                          style={{
                            backgroundColor: "var(--color-danger)",
                            color: "#fff",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            padding: "0.2rem 0.6rem",
                            borderRadius: "20px",
                            letterSpacing: "0.02em",
                          }}
                        >
                          Action requise
                        </span>
                      )}
                    </div>

                    {hasDefaultIssue && (
                      <div
                        style={{
                          fontSize: "0.85rem",
                          color: "var(--color-danger)",
                          fontWeight: 500,
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                        }}
                      >
                        <Icon name="warning" size={16} />
                        <span>
                          Aucune prestation par défaut n&apos;est actuellement active. Veuillez choisir un nouveau défaut parmi les prestations actives ci-dessous pour assurer le bon fonctionnement de l&apos;agent vocal.
                        </span>
                      </div>
                    )}

                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.82rem",
                        color: "var(--color-text-dim)",
                      }}
                    >
                      Prestation sélectionnée automatiquement par l&apos;agent vocal si le client ne précise pas sa demande lors de son appel téléphonique.
                    </p>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        flexWrap: "wrap",
                        marginTop: "0.2rem",
                      }}
                    >
                      {activeServices.length === 0 ? (
                        <span
                          style={{
                            color: "var(--color-text-muted)",
                            fontSize: "0.85rem",
                            fontStyle: "italic",
                          }}
                        >
                          Aucune prestation active pour le moment.
                        </span>
                      ) : activeServices.length === 1 ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.6rem",
                            flex: "1 1 280px",
                          }}
                        >
                          <select
                            className="select"
                            disabled
                            value={activeServices[0].id}
                            style={{ flex: "1 1 auto", minHeight: "2.4rem" }}
                          >
                            <option value={activeServices[0].id}>
                              {activeServices[0].name} ({activeServices[0].duration_minutes} min
                              {activeServices[0].price !== null ? ` · ${activeServices[0].price} €` : ""})
                            </option>
                          </select>
                          <span
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--color-text-dim)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            (Seule prestation active, sélectionnée d&apos;office)
                          </span>
                        </div>
                      ) : (
                        <select
                          className="select"
                          value={currentDefaultService?.id ?? ""}
                          onChange={(e) => void setDefaultService(e.target.value)}
                          style={{
                            flex: "1 1 320px",
                            minHeight: "2.4rem",
                            borderColor: hasDefaultIssue ? "var(--color-danger)" : undefined,
                            fontWeight: 500,
                          }}
                        >
                          {hasDefaultIssue && (
                            <option value="" disabled>
                              -- Choisissez une nouvelle prestation par défaut --
                            </option>
                          )}
                          {activeServices.map((service) => (
                            <option key={service.id} value={service.id}>
                              {service.name} ({service.duration_minutes} min
                              {service.price !== null ? ` · ${service.price} €` : ""})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Liste des prestations existantes - SANS bouton par ligne */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                    {services.map((service) => {
                      const isDefault = Boolean(service.is_default);
                      const targetCombo = service.combo_service_id
                        ? services.find((s) => s.id === service.combo_service_id)
                        : null;
                      const isComboInactive = Boolean(
                        service.combo_service_id && (!targetCombo || !targetCombo.active),
                      );

                      return (
                        <div
                          key={service.id}
                          style={{
                            padding: "0.85rem 1rem",
                            borderRadius: "12px",
                            border: isDefault
                              ? "1px solid var(--color-accent)"
                              : "1px solid var(--color-border)",
                            backgroundColor: isDefault
                              ? "color-mix(in srgb, var(--color-accent) 6%, var(--color-bg-panel))"
                              : "var(--color-bg-panel)",
                            opacity: service.active ? 1 : 0.6,
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.75rem",
                            transition: "border-color 0.2s ease, background-color 0.2s ease",
                          }}
                        >
                          {/* Ligne principale : Nom, Durée, Prix, Badge Défaut, Activer/Désactiver */}
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              alignItems: "center",
                              gap: "0.6rem",
                            }}
                          >
                            <input
                              className={`input ${fieldErrors[`service-name-${service.id}`] ? "!border-red-500 !ring-1 !ring-red-500" : ""}`}
                              style={{ flex: "2 1 180px", minWidth: "140px" }}
                              placeholder="Nom de la prestation"
                              value={service.name}
                              onChange={(event) =>
                                setServices((current) =>
                                  current.map((item) =>
                                    item.id === service.id
                                      ? { ...item, name: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                            />
                            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                              <input
                                className={`input ${fieldErrors[`service-duration-${service.id}`] ? "!border-red-500 !ring-1 !ring-red-500" : ""}`}
                                type="number"
                                min="1"
                                step="5"
                                style={{ width: "5rem" }}
                                value={service.duration_minutes}
                                onChange={(event) =>
                                  setServices((current) =>
                                    current.map((item) =>
                                      item.id === service.id
                                        ? {
                                            ...item,
                                            duration_minutes: Number(event.target.value),
                                          }
                                        : item,
                                    ),
                                  )
                                }
                              />
                              <span style={{ color: "var(--color-text-dim)", fontSize: "0.85rem" }}>
                                min
                              </span>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                              <input
                                className={`input ${fieldErrors[`service-price-${service.id}`] ? "!border-red-500 !ring-1 !ring-red-500" : ""}`}
                                type="number"
                                min="0"
                                step="0.5"
                                style={{ width: "5.5rem" }}
                                placeholder="Prix"
                                value={service.price ?? ""}
                                onChange={(event) =>
                                  setServices((current) =>
                                    current.map((item) =>
                                      item.id === service.id
                                        ? {
                                            ...item,
                                            price:
                                              event.target.value === ""
                                                ? null
                                                : Number(event.target.value),
                                          }
                                        : item,
                                    ),
                                  )
                                }
                              />
                              <span style={{ color: "var(--color-text-dim)", fontSize: "0.85rem" }}>
                                €
                              </span>
                            </div>

                            {/* Badge Prestation par défaut */}
                            {isDefault && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.3rem",
                                  padding: "0.35rem 0.65rem",
                                  borderRadius: "8px",
                                  backgroundColor: "color-mix(in srgb, var(--color-accent) 15%, transparent)",
                                  border: "1px solid var(--color-accent)",
                                  color: "var(--color-accent-soft)",
                                  fontSize: "0.82rem",
                                  fontWeight: 600,
                                  whiteSpace: "nowrap",
                                }}
                                title="Cette prestation est actuellement définie comme le choix par défaut du salon"
                              >
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                                  <Icon name="star" size={12} />
                                  Par défaut
                                </span>
                              </span>
                            )}

                            {/* Action secondaire discrète */}
                            <div style={{ marginLeft: "auto" }}>
                              <button
                                type="button"
                                className="text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)] underline p-2 min-h-[44px] flex items-center"
                                onClick={() => toggleServiceActive(service)}
                              >
                                {service.active ? "Désactiver" : "Réactiver"}
                              </button>
                            </div>
                          </div>

                          {/* Sous-section : Information défaut OU Sélecteur Complément */}
                          {isDefault ? (
                            <div
                              style={{
                                fontSize: "0.8rem",
                                color: "var(--color-accent-soft)",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.4rem",
                                paddingLeft: "0.2rem",
                              }}
                            >
                              <Icon name="star" size={14} style={{ flexShrink: 0 }} />
                              <span>
                                Prestation principale du salon : sélectionnée d&apos;office par l&apos;agent vocal si le client ne précise pas de prestation.
                              </span>
                            </div>
                          ) : (
                            <div
                              style={{
                                paddingTop: "0.6rem",
                                borderTop: "1px dashed var(--color-border)",
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.4rem",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  alignItems: "center",
                                  gap: "0.6rem",
                                }}
                              >
                                <label
                                  htmlFor={`combo-${service.id}`}
                                  style={{
                                    fontSize: "0.82rem",
                                    fontWeight: 500,
                                    color: "var(--color-text-dim)",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  Complément qui devient… :
                                </label>
                                <select
                                  id={`combo-${service.id}`}
                                  className="select"
                                  style={{
                                    flex: "1 1 260px",
                                    minHeight: "2.3rem",
                                    fontSize: "0.85rem",
                                    borderColor: isComboInactive ? "var(--color-danger)" : undefined,
                                  }}
                                  value={service.combo_service_id ?? ""}
                                  onChange={(event) => {
                                    const newCombo = event.target.value ? event.target.value : null;
                                    setServices((current) =>
                                      current.map((item) =>
                                        item.id === service.id
                                          ? { ...item, combo_service_id: newCombo }
                                          : item,
                                      ),
                                    );
                                  }}
                                >
                                  <option value="">-- Aucun complément (prestation simple) --</option>
                                  {isComboInactive && (
                                    <option value={service.combo_service_id!} disabled>
                                      [Inactif] {targetCombo ? targetCombo.name : "Prestation supprimée"} (désactivée)
                                    </option>
                                  )}
                                  {services
                                    .filter((s) => s.id !== service.id && s.active)
                                    .map((other) => (
                                      <option key={other.id} value={other.id}>
                                        {other.name} ({other.duration_minutes} min
                                        {other.price !== null ? ` · ${other.price} €` : ""})
                                      </option>
                                    ))}
                                </select>
                              </div>

                              {/* Alerte si le complément configuré est inactif */}
                              {isComboInactive && (
                                <div
                                  style={{
                                    fontSize: "0.8rem",
                                    color: "var(--color-danger)",
                                    backgroundColor:
                                      "color-mix(in srgb, var(--color-danger) 10%, transparent)",
                                    padding: "0.35rem 0.6rem",
                                    borderRadius: "6px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.35rem",
                                  }}
                                >
                                  <Icon name="warning" size={15} style={{ flexShrink: 0 }} />
                                  <span>
                                    Le complément précédemment associé ({targetCombo ? `« ${targetCombo.name} »` : "inconnu"}) est désactivé. Veuillez sélectionner une prestation active ou remettre sur « Aucun complément ».
                                  </span>
                                </div>
                              )}

                              {/* Texte explicatif raccourci + Infobulle En savoir plus */}
                              <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                                <span className="inline-flex items-center gap-1">
                                  <Icon name="info" size={13} style={{ color: "var(--color-accent-soft)" }} />
                                </span>
                                <span>
                                  Si le client demande cette prestation en plus du choix par défaut, réserver celle-ci à la place.
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setShowComboTooltip((v) => !v)}
                                  className="text-[var(--color-accent)] underline hover:text-[var(--color-text)] cursor-pointer text-xs ml-1"
                                >
                                  En savoir plus
                                </button>
                              </div>

                              {showComboTooltip && (
                                <div className="p-2.5 rounded bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-xs text-[var(--color-text-dim)]">
                                  Exemple : pour la prestation « Barbe », associer « Barbe + Coupe » — quand le client accepte la barbe en plus de la coupe, l&apos;agent vocal réserve directement « Barbe + Coupe » d&apos;un seul coup.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <p className="text-[var(--color-text-muted)] text-xs mt-3">
              Désactiver une prestation la retire des nouvelles prises de rendez-vous, tout en conservant son historique.
            </p>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="button primary"
                disabled={isSaving || !hasServicesChanged}
                onClick={saveServicesSection}
              >
                Enregistrer les prestations
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 5. Changer mon mot de passe (replié par défaut) */}
      <section className="panel mb-4">
        <button
          type="button"
          onClick={() => toggleSection("password")}
          className="w-full flex items-center justify-between text-left cursor-pointer border-none bg-transparent p-0 text-inherit font-inherit"
          aria-expanded={openSections.password}
        >
          <h3 className="m-0">Changer mon mot de passe</h3>
          <span className="p-2 text-[var(--color-text-dim)]">
            <Icon name={openSections.password ? "chevron-up" : "chevron-down"} size={18} />
          </span>
        </button>

        {openSections.password && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <div className="field-row">
              <div className="field">
                <label htmlFor="current-password">Mot de passe actuel</label>
                <input
                  className="input"
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="new-password">Nouveau mot de passe</label>
                <input
                  className="input"
                  id="new-password"
                  type="password"
                  minLength={8}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="password-confirmation">Confirmation</label>
                <input
                  className="input"
                  id="password-confirmation"
                  type="password"
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                />
              </div>
              <button
                type="button"
                className="button primary"
                onClick={changePassword}
              >
                Mettre à jour le mot de passe
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Barre d'actions collante en bas (visible UNIQUEMENT quand il y a des modifications non enregistrées) */}
      {hasUnsavedChanges && (
        <aside
          aria-label="Barre d'enregistrement"
          className="sticky bottom-4 z-40 bg-[var(--color-bg-panel)] border border-[var(--color-accent)] rounded-xl shadow-2xl p-4 flex flex-wrap items-center justify-between gap-4 mt-6 animate-in slide-in-from-bottom-3 duration-200"
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
            <span className="font-semibold text-sm text-[var(--color-text)]">
              Modifications non enregistrées
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="button ghost text-sm min-h-[44px]"
              disabled={isSaving}
              onClick={cancelAllChanges}
            >
              Annuler
            </button>
            <button
              type="button"
              className="button primary text-sm min-h-[44px] px-6"
              disabled={isSaving}
              onClick={saveAllChanges}
            >
              {isSaving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </aside>
      )}
    </DashboardShell>
  );
}
