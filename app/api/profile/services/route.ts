import { requireUser, resolveAuthorizedBusinessId } from "@/lib/supabase";

const serviceFields =
  "id, business_id, name, duration_minutes, price, active, is_default, combo_service_id";

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
  if (error instanceof Error && error.message === "INVALID_SERVICE") {
    return Response.json(
      { error: "Indiquez un nom, une durée valide en minutes et un prix valide." },
      { status: 400 },
    );
  }
  console.error(error);
  return Response.json({ error: fallbackMessage }, { status: 500 });
}

function serviceInput(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim();
  const durationMinutes = Number(body.duration_minutes ?? body.durationMinutes);
  const price =
    body.price === null || body.price === "" || body.price === undefined
      ? null
      : Number(body.price);
  if (
    !name ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes <= 0 ||
    (price !== null && (!Number.isFinite(price) || price < 0))
  ) {
    throw new Error("INVALID_SERVICE");
  }
  return { name, duration_minutes: durationMinutes, price };
}

async function validateComboService(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  businessId: string,
  currentServiceId: string | null,
  comboServiceId: string,
) {
  if (currentServiceId && comboServiceId === currentServiceId) {
    return {
      valid: false,
      error: "Une prestation ne peut pas être son propre complément.",
    };
  }
  const { data: target, error } = await supabase
    .from("services")
    .select("id, active, business_id")
    .eq("id", comboServiceId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error || !target) {
    return {
      valid: false,
      error: "La prestation complémentaire sélectionnée n'appartient pas à ce salon.",
    };
  }
  if (!target.active) {
    return {
      valid: false,
      error: "La prestation complémentaire doit être active.",
    };
  }
  return { valid: true };
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
      .from("services")
      .select(serviceFields)
      .eq("business_id", businessId)
      .order("active", { ascending: false })
      .order("name");
    if (error) throw error;
    return Response.json(data ?? []);
  } catch (error) {
    return handleApiError(error, "Impossible de charger les prestations.");
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
    const input = serviceInput(body);

    let comboServiceId =
      body.combo_service_id !== undefined &&
      body.combo_service_id !== null &&
      body.combo_service_id !== ""
        ? String(body.combo_service_id)
        : null;

    if (comboServiceId) {
      const comboCheck = await validateComboService(
        supabase,
        businessId,
        null,
        comboServiceId,
      );
      if (!comboCheck.valid) {
        return Response.json({ error: comboCheck.error }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from("services")
      .insert({
        business_id: businessId,
        ...input,
        active: true,
        is_default: false,
        combo_service_id: comboServiceId,
      })
      .select(serviceFields)
      .single();

    if (error) throw error;
    return Response.json(data, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Impossible d'ajouter la prestation.");
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

    const serviceId = body.id;
    if (!serviceId || typeof serviceId !== "string") {
      return Response.json(
        { error: "Identifiant de prestation manquant." },
        { status: 400 },
      );
    }

    const { data: currentService, error: currentError } = await supabase
      .from("services")
      .select(serviceFields)
      .eq("id", serviceId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (currentError || !currentService) {
      return Response.json({ error: "Prestation introuvable." }, { status: 404 });
    }

    const input = serviceInput(body);

    const nextActive =
      typeof body.active === "boolean" ? body.active : currentService.active;

    // is_default ne peut plus être modifié via ce endpoint générique.
    // Si la prestation est désactivée, elle perd automatiquement son statut par défaut.
    let nextIsDefault = currentService.is_default;
    if (!nextActive && nextIsDefault) {
      nextIsDefault = false;
    }

    let nextComboServiceId = currentService.combo_service_id;
    if (body.combo_service_id !== undefined) {
      nextComboServiceId =
        body.combo_service_id === "" || body.combo_service_id === null
          ? null
          : String(body.combo_service_id);
    }

    // Une prestation par défaut ne peut pas avoir de prestation combo
    if (nextIsDefault) {
      nextComboServiceId = null;
    } else if (nextComboServiceId !== null) {
      const comboCheck = await validateComboService(
        supabase,
        businessId,
        serviceId,
        nextComboServiceId,
      );
      if (!comboCheck.valid) {
        return Response.json({ error: comboCheck.error }, { status: 400 });
      }
    }

    const changes = {
      ...input,
      active: nextActive,
      is_default: nextIsDefault,
      combo_service_id: nextComboServiceId,
    };

    const { data, error } = await supabase
      .from("services")
      .update(changes)
      .eq("id", serviceId)
      .eq("business_id", businessId)
      .select(serviceFields)
      .single();

    if (error) throw error;

    return Response.json(data);
  } catch (error) {
    return handleApiError(error, "Impossible de modifier la prestation.");
  }
}