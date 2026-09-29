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

export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await request.json();
    const businessId = await resolveAuthorizedBusinessId(
      supabase,
      user,
      body.businessId,
    );

    const serviceId = body.serviceId;
    if (!serviceId || typeof serviceId !== "string") {
      return Response.json(
        { error: "Identifiant de prestation manquant." },
        { status: 400 },
      );
    }

    // 1. Vérification d'existence, d'appartenance au salon et de statut actif
    const { data: targetService, error: serviceError } = await supabase
      .from("services")
      .select("id, name, active, business_id")
      .eq("id", serviceId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (serviceError || !targetService) {
      return Response.json(
        { error: "Prestation introuvable pour ce salon." },
        { status: 404 },
      );
    }

    if (!targetService.active) {
      return Response.json(
        { error: "Une prestation inactive ne peut pas être définie par défaut." },
        { status: 400 },
      );
    }

    // 2. Mise à jour de la prestation par défaut
    // Tentative via la RPC transactionnelle si présente
    const { error: rpcError } = await supabase.rpc("set_default_service", {
      p_business_id: businessId,
      p_service_id: serviceId,
    });

    if (rpcError) {
      // Fallback séquentiel sécurisé si la RPC n'est pas encore appliquée en base
      // Étape A : retire l'ancien défaut du salon
      const { error: resetError } = await supabase
        .from("services")
        .update({ is_default: false })
        .eq("business_id", businessId)
        .eq("is_default", true);

      if (resetError) throw resetError;

      // Étape B : active le nouveau défaut et vide son combo_service_id
      const { error: updateError } = await supabase
        .from("services")
        .update({ is_default: true, combo_service_id: null })
        .eq("id", serviceId)
        .eq("business_id", businessId);

      if (updateError) throw updateError;
    }

    return Response.json({
      ok: true,
      defaultServiceId: serviceId,
      name: targetService.name,
    });
  } catch (error) {
    return handleApiError(
      error,
      "Impossible de mettre à jour la prestation par défaut du salon.",
    );
  }
}
