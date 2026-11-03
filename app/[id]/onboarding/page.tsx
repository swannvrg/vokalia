import { getBusinessIdForCurrentUser, requireUser } from "@/lib/supabase";
import { notFound, redirect } from "next/navigation";
import OnboardingForm from "./onboarding-form";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const metadata = { title: "Configuration de votre salon | Vokalia" };

export default async function OnboardingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_REGEX.test(id)) notFound();
  let user;
  let supabase;
  try {
    ({ user, supabase } = await requireUser());
  } catch {
    redirect(`/login?redirect=/${id}/onboarding`);
  }
  if (user.must_change_password) redirect("/bienvenue/mot-de-passe");
  if (!user.onboarding_pending) redirect(`/${id}/calendrier`);
  if (user.role !== "admin") {
    try {
      if (await getBusinessIdForCurrentUser(supabase, user.id) !== id) redirect(`/${user.business_id}/onboarding`);
    } catch {
      redirect("/login");
    }
  }
  const { data: business } = await supabase.from("businesses").select("id, status").eq("id", id).maybeSingle();
  if (!business || business.status !== "active") notFound();
  return <OnboardingForm businessId={id} />;
}
