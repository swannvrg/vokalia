import { requireUser, resolveAuthorizedBusinessId } from "@/lib/supabase";
import { normalizeAssistantPhone } from "@/lib/phone";

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
  if (error instanceof Error && error.message === "INVALID_ASSISTANT_PHONE") {
    return Response.json(
      { error: "Le numéro de l'assistant vocal n'est pas valide." },
      { status: 400 },
    );
  }
  if (error instanceof Error && error.message === "ASSISTANT_PHONE_IN_USE") {
    return Response.json(
      { error: "Ce numéro est déjà utilisé par un autre salon" },
      { status: 409 },
    );
  }
  if (error instanceof Error && error.message === "ASSISTANT_PHONE_UNIQUE_VIOLATION") {
    return Response.json(
      { error: "Ce numéro est déjà utilisé par un autre salon" },
      { status: 409 },
    );
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
      .select("id, name, real_phone_number, phone_number, address, timezone")
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
      .select("id, name, real_phone_number, phone_number, address, timezone")
      .eq("id", businessId)
      .single();
    if (currentError || !current) throw currentError || new Error("SALON_NOT_FOUND");

    const assistantPhone = normalizeAssistantPhone(String(body.assistantPhoneNumber ?? ""));
    if (assistantPhone) {
      const { data: otherBusiness, error: duplicateError } = await supabase
        .from("businesses")
        .select("id")
        .eq("phone_number", assistantPhone)
        .neq("id", businessId)
        .limit(1)
        .maybeSingle();
      if (duplicateError) throw duplicateError;
      if (otherBusiness) throw new Error("ASSISTANT_PHONE_IN_USE");
    }

    const { data, error } = await supabase
      .from("businesses")
      .update({
        name: String(body.name ?? current.name).trim(),
        real_phone_number: String(body.phoneNumber ?? "").trim() || null,
        phone_number: assistantPhone,
        twilio_number: assistantPhone,
        address: String(body.address ?? "").trim() || null,
      })
      .eq("id", businessId)
      .select("id, name, real_phone_number, phone_number, address, timezone")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("ASSISTANT_PHONE_UNIQUE_VIOLATION");
      throw error;
    }
    return Response.json(data);
  } catch (error) {
    return handleApiError(error, "Impossible d'enregistrer les informations du salon.");
  }
}
