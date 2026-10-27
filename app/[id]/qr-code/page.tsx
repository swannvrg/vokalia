import { getBusinessIdForCurrentUser, requireUser } from "@/lib/supabase";
import { notFound, redirect } from "next/navigation";
import QRCodeView from "./qr-code-view";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const metadata = {
  title: "QR Code & Affiche | Vokalia",
};

export default async function SalonQRCodePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    notFound();
  }

  let user;
  let supabase;

  try {
    ({ supabase, user } = await requireUser());
  } catch {
    redirect(`/login?redirect=/${id}/qr-code`);
  }

  if (user.role !== "admin") {
    try {
      const userBusinessId = await getBusinessIdForCurrentUser(supabase, user.id);
      if (userBusinessId !== id) {
        redirect(`/${userBusinessId}/qr-code`);
      }
    } catch {
      redirect("/login");
    }
  }

  // Requête stricte et minimale : uniquement id, status et name
  const { data: business } = await supabase
    .from("businesses")
    .select("id, status, name")
    .eq("id", id)
    .maybeSingle();

  if (!business || business.status !== "active") {
    notFound();
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") || "";

  return (
    <QRCodeView
      businessId={business.id}
      businessName={business.name || "Salon"}
      siteUrl={siteUrl}
    />
  );
}
