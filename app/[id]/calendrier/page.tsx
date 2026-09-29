import { getBusinessIdForCurrentUser, requireUser } from "@/lib/supabase";
import { notFound, redirect } from "next/navigation";
import Calendar from "@/app/calendar";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parisDate = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
    new Date(),
  );

export const metadata = {
  title: "Planning | Vokalia",
};

export default async function SalonCalendarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Validation immédiate du format d'identifiant
  if (!UUID_REGEX.test(id)) {
    notFound();
  }

  let user;
  let supabase;

  // 1. Contrôle d'authentification serveur
  try {
    ({ supabase, user } = await requireUser());
  } catch {
    redirect(`/login?redirect=/${id}/calendrier`);
  }

  // 2. Contrôle d'autorisation strict : vérification d'appartenance
  // L'utilisateur connecté doit être admin OU être rattaché à CE business_id spécifique
  if (user.role !== "admin") {
    try {
      const userBusinessId = await getBusinessIdForCurrentUser(supabase, user.id);
      if (userBusinessId !== id) {
        redirect(`/${userBusinessId}/calendrier`);
      }
    } catch {
      redirect("/login");
    }
  }

  // Vérification de l'existence du salon
  const { data: business } = await supabase
    .from("businesses")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (!business || business.status !== "active") {
    notFound();
  }

  return <Calendar initialDate={parisDate()} businessId={id} />;
}
