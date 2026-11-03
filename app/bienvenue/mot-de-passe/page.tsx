import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase";
import ChangePasswordForm from "./change-password-form";

export const metadata = { title: "Choisir votre mot de passe | Vokalia" };

export default async function ChangePasswordPage() {
  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    redirect("/login");
  }
  if (!user.must_change_password) {
    redirect(user.business_id ? `/${user.business_id}/calendrier` : "/calendrier");
  }
  return <ChangePasswordForm />;
}
