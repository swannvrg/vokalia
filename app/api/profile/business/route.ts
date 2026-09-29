import { requireUser, resolveAuthorizedBusinessId } from "@/lib/supabase";

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
    const { data, error } = await supabase
      .from("businesses")
      .select("id, name, real_phone_number, address, timezone")
      .eq("id", businessId)
      .single();
    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    return handleApiError(error, "Impossible de charger les informations du salon.");
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
    const { data: current, error: currentError } = await supabase
      .from("businesses")
      .select("id, name, real_phone_number, address, timezone")
      .eq("id", businessId)
      .single();
    if (currentError || !current) throw currentError || new Error("SALON_NOT_FOUND");

    const { data, error } = await supabase
      .from("businesses")
      .update({
        name: String(body.name ?? current.name).trim(),
        real_phone_number: String(body.phoneNumber ?? "").trim() || null,
        address: String(body.address ?? "").trim() || null,
      })
      .eq("id", businessId)
      .select("id, name, real_phone_number, address, timezone")
      .single();
    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    return handleApiError(error, "Impossible d'enregistrer les informations du salon.");
  }
}
