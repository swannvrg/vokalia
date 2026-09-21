import BookingForm from "@/app/prendre-rdv/booking-form";

export const metadata = { title: "Prendre rendez-vous | Vokalia" };

export default async function BookingPage({ searchParams }: { searchParams: Promise<{ businessId?: string }> }) {
  const params = await searchParams;
  return <BookingForm businessId={params.businessId ?? ""} />;
}
