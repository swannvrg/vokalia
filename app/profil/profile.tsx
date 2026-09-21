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

export default function Profile() {
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
    const [businessResponse, hoursResponse, resourcesResponse, servicesResponse] =
      await Promise.all([
        fetch("/api/profile/business"),
        fetch("/api/profile/hours"),
        fetch("/api/profile/resources"),
        fetch("/api/profile/services"),
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
  }, [router]);

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
      body: JSON.stringify({ ...resource, ...changes, id: resource.id }),
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
    const response = await fetch("/api/profile/services", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...service, ...changes, id: service.id }),
    });
    if (response.ok) {
      await load();
      notify("Prestation mise à jour.");
    } else setError((await response.json()).error);
  }

  async function changePassword() {
    if (newPassword.length < 8 || newPassword !== passwordConfirmation) {
      setError("Le mot de passe doit contenir au moins 8 caractères et être confirmé à l'identique.");
      return;
    }
    const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword, currentPassword }) });
    if (!response.ok) setError((await response.json()).error);
    else { setCurrentPassword(""); setNewPassword(""); setPasswordConfirmation(""); notify("Mot de passe modifié."); }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <Logo size={28} />
          <span className="brand-wordmark">vokalia</span>
        </div>
        <div className="actions">
          <button className="button" onClick={() => router.push("/")}>
            Planning
          </button>
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
          {services.map((service) => (
            <div
              className="field-row"
              key={service.id}
              style={{
                marginBottom: ".65rem",
                opacity: service.active ? 1 : 0.55,
              }}
            >
              <input
                className="input"
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
              <input
                className="input"
                type="number"
                min="1"
                step="5"
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
              <span>min</span>
              <input
                className="input"
                type="number"
                min="0"
                step="0.5"
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
              <span>€</span>
              <button
                className="button"
                onClick={() =>
                  updateService(service, {
                    name: service.name,
                    duration_minutes: service.duration_minutes,
                    price: service.price,
                  })
                }
              >
                Enregistrer
              </button>
              {service.active ? (
                <button
                  className="button"
                  onClick={() => updateService(service, { active: false })}
                >
                  Désactiver
                </button>
              ) : (
                <button
                  className="button"
                  onClick={() => updateService(service, { active: true })}
                >
                  Réactiver
                </button>
              )}
            </div>
          ))}
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
