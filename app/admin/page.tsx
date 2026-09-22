import { requireAdmin } from "@/lib/supabase";
import { redirect } from "next/navigation";
import AdminDashboard from "./admin-dashboard";

export default async function AdminPage() {
  let supabase;
  try {
    ({ supabase } = await requireAdmin());
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") redirect("/calendrier");
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    throw error;
  }
  const [{ data: requests }, { data: businesses }] = await Promise.all([
    supabase.from("invitation_requests").select("id, salon_name, contact_name, email, phone, message, status, created_at, business_id").order("created_at", { ascending: false }),
    supabase.from("businesses").select("id, name, status, app_user_id").order("name"),
  ]);
  return <AdminDashboard initialRequests={requests ?? []} businesses={businesses ?? []} />;
}
