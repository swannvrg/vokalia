import { requireUser, resolveAuthorizedBusinessId } from "@/lib/supabase";
import { isWithinOpeningHours } from "@/lib/business-hours";

function handleApiError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return Response.json({ error: "Non authentifié." }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return Response.json({ error: "Accès refusé à ce salon." }, { status: 403 });
  }
  if (
    error instanceof Error &&
    (error.message === "SALON_NOT_FOUND" || error.message === "NO_BUSINESS")
  ) {
    return Response.json({ error: "Salon introuvable." }, { status: 404 });
  }
  console.error(error);
  return Response.json({ error: fallbackMessage }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await request.json();
    const businessId = await resolveAuthorizedBusinessId(
      supabase,
      user,
      body.businessId,
    );

    const name = String(body.customerName ?? "").trim();
    const phone = String(body.customerPhone ?? "").trim();
    const resourceId = String(body.resourceId ?? "");
    const serviceId = String(body.serviceId ?? "");
    const startTime = String(body.startTime ?? "");

    if (!name || !resourceId || !serviceId || !startTime) {
      return Response.json({ error: "Nom du client, Coiffeur, prestation et horaire sont obligatoires." }, { status: 400 });
    }
    if (Number.isNaN(new Date(startTime).getTime())) return Response.json({ error: "Date ou heure invalide." }, { status: 400 });

    const { data: resource, error: resourceError } = await supabase
      .from("resources")
      .select("business_id")
      .eq("id", resourceId)
      .eq("business_id", businessId)
      .eq("resource_type", "practitioner")
      .eq("active", true)
      .single();
    if (resourceError || !resource) return Response.json({ error: "Coiffeur introuvable ou désactivé." }, { status: 400 });
    const { data: service, error: serviceError } = await supabase.from("services").select("duration_minutes").eq("id", serviceId).eq("business_id", resource.business_id).eq("active", true).single();
    if (serviceError || !service) return Response.json({ error: "Prestation introuvable ou inactive." }, { status: 400 });
    if (!(await isWithinOpeningHours(supabase, resource.business_id, new Date(startTime), service.duration_minutes))) {
      return Response.json({ error: "Ce créneau est en dehors des heures d'ouverture du salon." }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("book_appointment", {
      p_business_id: businessId,
      p_resource_id: resourceId,
      p_service_id: serviceId,
      p_customer_phone: phone,
      p_customer_name: name,
      p_start_time: startTime,
      p_party_size: 1,
      p_booked_by: "backoffice",
    });
    if (error) {
      if (error.message.includes("SLOT_NO_LONGER_AVAILABLE")) return Response.json({ error: "Ce créneau n'est plus disponible." }, { status: 409 });
      if (error.message.includes("SERVICE_NOT_FOUND")) return Response.json({ error: "Prestation introuvable." }, { status: 400 });
      throw error;
    }
    return Response.json({ id: data }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Impossible de créer le rendez-vous.");
  }
}
