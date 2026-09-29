import { requireUser, resolveAuthorizedBusinessId } from "@/lib/supabase";

const hexColor = (value: unknown) => /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : "#D96D4B";

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

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const url = new URL(request.url);
    const businessId = await resolveAuthorizedBusinessId(
      supabase,
      user,
      url.searchParams.get("businessId"),
    );
    const { data, error } = await supabase.from("resources").select("id, name, capacity, active, color, resource_type").eq("business_id", businessId).eq("resource_type", "practitioner").order("active", { ascending: false }).order("name");
    if (error) throw error;
    return Response.json(data ?? []);
  } catch (error) {
    return handleApiError(error, "Impossible de charger les Coiffeurs.");
  }
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
    const { data, error } = await supabase.from("resources").insert({ business_id: businessId, name: String(body.name ?? "").trim(), capacity: 1, color: hexColor(body.color), resource_type: "practitioner", active: true }).select("id, name, capacity, active, color, resource_type").single();
    if (error) throw error;
    return Response.json(data, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Impossible d'ajouter le Coiffeur.");
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await request.json();
    const businessId = await resolveAuthorizedBusinessId(
      supabase,
      user,
      body.businessId,
    );
    const changes = { name: String(body.name ?? "").trim(), capacity: 1, color: hexColor(body.color), ...(typeof body.active === "boolean" ? { active: body.active } : {}) };
    const { data, error } = await supabase.from("resources").update(changes).eq("id", body.id).eq("business_id", businessId).eq("resource_type", "practitioner").select("id, name, capacity, active, color, resource_type").single();
    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    return handleApiError(error, "Impossible de modifier le Coiffeur.");
  }
}
