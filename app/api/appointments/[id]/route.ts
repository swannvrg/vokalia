import { getBusinessIdForCurrentUser, requireUser } from "@/lib/supabase";
import { isWithinOpeningHours } from "@/lib/business-hours";

function unauthenticated(error: unknown) {
  return error instanceof Error && error.message === "UNAUTHENTICATED";
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireUser();
    const businessId = await getBusinessIdForCurrentUser(supabase, user.id);
    const { id } = await context.params;
    const body = await request.json();
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("id, business_id, resource_id, service_id, start_time, end_time, party_size, status, booked_by")
      .eq("id", id)
      .eq("business_id", businessId)
      .single();
    if (appointmentError) throw appointmentError;
    if (appointment.status !== "confirmed" || appointment.booked_by === "block" || !appointment.resource_id) {
      return Response.json({ error: "Ce rendez-vous ne peut pas être modifié." }, { status: 400 });
    }

    const serviceId = String(body.serviceId ?? appointment.service_id ?? "");
    const resourceId = String(body.resourceId ?? appointment.resource_id);
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, duration_minutes")
      .eq("id", serviceId)
      .eq("business_id", appointment.business_id)
      .eq("active", true)
      .single();
    if (serviceError || !service) return Response.json({ error: "Prestation introuvable ou inactive." }, { status: 400 });

    const start = new Date(String(body.startTime));
    if (Number.isNaN(start.getTime())) return Response.json({ error: "Heure invalide." }, { status: 400 });
    const end = new Date(start.getTime() + Number(service.duration_minutes) * 60_000);
    if (!(await isWithinOpeningHours(supabase, appointment.business_id, start, service.duration_minutes))) {
      return Response.json({ error: "Ce rendez-vous serait en dehors des heures d'ouverture du salon." }, { status: 400 });
    }
    const { data: resource, error: resourceError } = await supabase
      .from("resources")
      .select("id, capacity, business_id, active, resource_type")
      .eq("id", resourceId)
      .eq("business_id", appointment.business_id)
      .eq("resource_type", "practitioner")
      .single();
    if (resourceError) throw resourceError;
    if (!resource.active) return Response.json({ error: "Ce Coiffeur est désactivé." }, { status: 400 });

    const { data: overlaps, error: overlapError } = await supabase
      .from("appointments")
      .select("id, party_size")
      .eq("resource_id", resourceId)
      .eq("status", "confirmed")
      .neq("id", id)
      .lt("start_time", end.toISOString())
      .gt("end_time", start.toISOString());
    if (overlapError) throw overlapError;
    const bookedCapacity = (overlaps ?? []).reduce((total, item) => total + (item.party_size ?? 1), 0);
    if (bookedCapacity + (appointment.party_size ?? 1) > resource.capacity) {
      return Response.json({ error: "Ce créneau n'est plus disponible pour ce Coiffeur." }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("appointments")
      .update({ resource_id: resourceId, service_id: service.id, start_time: start.toISOString(), end_time: end.toISOString() })
      .eq("id", id)
      .select("id, resource_id, start_time, end_time, service_id")
      .single();
    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    if (unauthenticated(error)) return Response.json({ error: "Non authentifié." }, { status: 401 });
    console.error(error);
    return Response.json({ error: "Impossible de modifier le rendez-vous." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireUser();
    const businessId = await getBusinessIdForCurrentUser(supabase, user.id);
    const { id } = await context.params;
    const { data: appointment } = await supabase.from("appointments").select("id").eq("id", id).eq("business_id", businessId).maybeSingle();
    if (!appointment) return Response.json({ error: "Ce rendez-vous est introuvable." }, { status: 404 });
    const { data, error } = await supabase.rpc("cancel_appointment", { p_appointment_id: id });
    if (error) throw error;
    if (!data) return Response.json({ error: "Ce rendez-vous est déjà annulé ou introuvable." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    if (unauthenticated(error)) return Response.json({ error: "Non authentifié." }, { status: 401 });
    console.error(error);
    return Response.json({ error: "Impossible d'annuler le rendez-vous." }, { status: 500 });
  }
}
