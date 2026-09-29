"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Toast from "@/app/components/toast";
import Logo from "@/app/components/Logo";

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
  const [business, setBusiness] = useState<Business | null>(null);
  const [hours, setHours] = useState<Hours[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [newName, setNewName] = useState("");
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDuration, setNewServiceDuration] = useState("30");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newColor, setNewColor] = useState(colors[0]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
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
    )
      return router.replace("/login");
    const [businessData, hoursData, resourcesData, servicesData] = await Promise.all([
      businessResponse.json(),
      hoursResponse.json(),
      resourcesResponse.json(),
      servicesResponse.json(),
    ]);
    startTransition(() => {
      if (!businessResponse.ok || !hoursResponse.ok || !resourcesResponse.ok || !servicesResponse.ok)
        setError(businessData.error || hoursData.error || resourcesData.error || servicesData.error);
      else {
        setBusiness(businessData);
        setHours(hoursData);
        setResources(resourcesData);
        setServices(servicesData);
      }
    });
  }, [businessId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveBusiness() {
    if (!business) return;
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
    if (response.ok) notify("Informations du salon enregistrées.");
    else setError((await response.json()).error);
  }

  async function saveHours() {
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
    if (response.ok) notify("Horaires enregistrés.");
    else setError((await response.json()).error);
  }

  async function addResource() {
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

  async function updateResource(
    resource: Resource,
    changes: Partial<Resource>,
  ) {
    const response = await fetch("/api/profile/resources", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...resource,
        ...changes,
        id: resource.id,
        ...(businessId ? { businessId } : {}),
      }),
    });
    if (response.ok) {
      await load();
      notify("Coiffeur mis à jour.");
    } else setError((await response.json()).error);
  }

  async function addService() {
    const response = await fetch("/api/profile/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newServiceName,
        durationMinutes: Number(newServiceDuration),
        price: newServicePrice === "" ? null : Number(newServicePrice),
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

  async function updateService(service: Service, changes: Partial<Service>) {
    const payload = {
      ...service,
      ...changes,
      id: service.id,
      ...(businessId ? { businessId } : {}),
    };
    const response = await fetch("/api/profile/services", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      await load();
      notify("Prestation mise à jour.");
    } else {
      const data = await response.json().catch(() => ({}));
      setError(data.error || "Impossible de modifier la prestation.");
    }
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

  useEffect(() => {
    const active = services.filter((s) => s.active);
    if (active.length === 1 && !active[0].is_default) {
      void setDefaultService(active[0].id);
    }
  }, [services]);

  async function changePassword() {
    if (newPassword.length < 8 || newPassword !== passwordConfirmation) {
      setError("Le mot de passe doit contenir au moins 8 caractères et être confirmé à l'identique.");
      return;
    }
    const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword, currentPassword }) });
    if (!response.ok) setError((await response.json()).error);
    else { setCurrentPassword(""); setNewPassword(""); setPasswordConfirmation(""); notify("Mot de passe modifié."); }
  }

  const effectiveBusinessId = businessId || business?.id;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <Logo size={28} />
          <span className="brand-wordmark">vokalia</span>
        </div>
        <div className="actions">
          <button
            className="button"
            onClick={() =>
              router.push(
                effectiveBusinessId ? `/${effectiveBusinessId}/calendrier` : "/calendrier",
              )
            }
          >
            Planning
          </button>
          {effectiveBusinessId && (
            <a
              className="button ghost"
              href={`/${effectiveBusinessId}/profil-public`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
              title="Voir la fiche publique du salon"
            >
              Fiche publique ↗
            </a>
          )}
          <button
            className="button ghost"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.replace("/login");
            }}
          >
            Se déconnecter
          </button>
        </div>
      </header>
      {error && <Toast message={error} type="error" onClose={() => setError("")} />}
      {!error && message && <Toast message={message} type="success" onClose={() => setMessage("")} />}
      <div className="content">
        <div className="toolbar">
          <div>
            <p className="kicker">Configuration</p>
            <h2>Réglages du salon</h2>
            <p>Coordonnées, horaires et équipe.</p>
          </div>
        </div>
        <section className="panel">
          <h3>Informations du salon</h3>
          {business && (
            <div className="field-row">
              <div className="field">
                <label htmlFor="business-name">Nom</label>
                <input
                  className="input"
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
              <button className="button primary" onClick={saveBusiness}>
                Enregistrer les coordonnées
              </button>
            </div>
          )}
        </section>
        <section className="panel">
          <h3>
            Horaires d&apos;ouverture · {business?.timezone || "Europe/Paris"}
          </h3>
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
          <button className="button primary" onClick={saveHours}>
            Enregistrer les horaires
          </button>
        </section>
        <section className="panel">
          <h3>Coiffeurs</h3>
          <div className="field-row" style={{ marginBottom: "1rem" }}>
            <input
              className="input"
              placeholder="Nom du Coiffeur"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
            <input
              className="input"
              type="color"
              value={newColor}
              onChange={(event) => setNewColor(event.target.value)}
            />
            <button className="button primary" onClick={addResource}>
              Ajouter à l&apos;équipe
            </button>
          </div>
          {resources.map((resource) => (
            <div
              className="field-row"
              key={resource.id}
              style={{
                marginBottom: ".65rem",
                opacity: resource.active ? 1 : 0.55,
              }}
            >
              <input
                className="input"
                value={resource.name}
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
                className="input"
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
              <button
                className="button"
                onClick={() =>
                  updateResource(resource, {
                    name: resource.name,
                    color: resource.color,
                  })
                }
              >
                Enregistrer
              </button>
              {resource.active ? (
                <button
                  className="button"
                  onClick={() => updateResource(resource, { active: false })}
                >
                  Désactiver
                </button>
              ) : (
                <button
                  className="button"
                  onClick={() => updateResource(resource, { active: true })}
                >
                  Réactiver
                </button>
              )}
            </div>
          ))}
          <p style={{ color: "var(--color-text-muted)", fontSize: ".8rem" }}>
            Désactiver un Coiffeur le retire du calendrier et des nouvelles
            prises de rendez-vous, tout en conservant son historique.
          </p>
        </section>
        <section className="panel">
          <h3>Prestations</h3>
          <div className="field-row" style={{ marginBottom: "1rem" }}>
            <input
              className="input"
              placeholder="Nom de la prestation"
              value={newServiceName}
              onChange={(event) => setNewServiceName(event.target.value)}
            />
            <input
              className="input"
              type="number"
              min="1"
              step="5"
              placeholder="Durée (min)"
              value={newServiceDuration}
              onChange={(event) => setNewServiceDuration(event.target.value)}
            />
            <input
              className="input"
              type="number"
              min="0"
              step="0.5"
              placeholder="Prix (€)"
              value={newServicePrice}
              onChange={(event) => setNewServicePrice(event.target.value)}
            />
            <button className="button primary" onClick={addService}>
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
                        }}
                      >
                        ★
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
                      <span>⚠️</span>
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

                {/* Liste des prestations existantes */}
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
                      {/* Ligne principale : Nom, Durée, Prix, Badge Défaut, Enregistrer, Activer/Désactiver */}
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: "0.6rem",
                        }}
                      >
                        <input
                          className="input"
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
                            className="input"
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
                            className="input"
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

                        {/* Badge Prestation par défaut (indicateur visuel sans toggle direct) */}
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
                            ★ Par défaut
                          </span>
                        )}

                        {/* Actions de la ligne */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.45rem",
                            marginLeft: "auto",
                          }}
                        >
                          <button
                            type="button"
                            className="button"
                            onClick={() =>
                              updateService(service, {
                                name: service.name,
                                duration_minutes: service.duration_minutes,
                                price: service.price,
                                combo_service_id: service.combo_service_id,
                              })
                            }
                          >
                            Enregistrer
                          </button>
                          {service.active ? (
                            <button
                              type="button"
                              className="button ghost"
                              onClick={() =>
                                updateService(service, { active: false })
                              }
                              title="Désactiver cette prestation"
                            >
                              Désactiver
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="button ghost"
                              onClick={() => updateService(service, { active: true })}
                            >
                              Réactiver
                            </button>
                          )}
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
                          <span>★</span>
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
                                  ⚠️ {targetCombo ? targetCombo.name : "Prestation supprimée"} (désactivée)
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
                              <span>⚠️</span>
                              <span>
                                Le complément précédemment associé ({targetCombo ? `« ${targetCombo.name} »` : "inconnu"}) est désactivé. Veuillez sélectionner une prestation active ou remettre sur « Aucun complément ».
                              </span>
                            </div>
                          )}

                          {/* Aide contextuelle dynamique */}
                          <p
                            style={{
                              margin: 0,
                              fontSize: "0.78rem",
                              color: "var(--color-text-muted)",
                              lineHeight: 1.4,
                            }}
                          >
                            💡 {currentDefaultService ? (
                              <>
                                Si le client demande cette prestation en plus de{" "}
                                <strong style={{ color: "var(--color-text)" }}>
                                  {currentDefaultService.name}
                                </strong>
                                , réserver celle-ci à la place.
                              </>
                            ) : (
                              <>
                                Si le client demande cette prestation en plus de la prestation par défaut (
                                <em>aucune prestation par défaut définie</em>), réserver celle-ci à la place.
                              </>
                            )}{" "}
                            <span style={{ opacity: 0.85 }}>
                              (Exemple : pour la prestation « Barbe », associer « Barbe + Coupe » — quand le client accepte la barbe en plus de la coupe, l&apos;agent vocal réserve directement « Barbe + Coupe »).
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
              </div>
            );
          })()}
          <p style={{ color: "var(--color-text-muted)", fontSize: ".8rem" }}>
            Désactiver une prestation la retire des nouvelles prises de rendez-vous,
            tout en conservant son historique.
          </p>
        </section>
        <section className="panel">
          <h3>Changer mon mot de passe</h3>
          <div className="field-row">
            <div className="field"><label htmlFor="current-password">Mot de passe actuel</label><input className="input" id="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></div>
            <div className="field"><label htmlFor="new-password">Nouveau mot de passe</label><input className="input" id="new-password" type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></div>
            <div className="field"><label htmlFor="password-confirmation">Confirmation</label><input className="input" id="password-confirmation" type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} /></div>
            <button className="button primary" onClick={changePassword}>Mettre à jour le mot de passe</button>
          </div>
        </section>
      </div>
    </main>
  );
}
