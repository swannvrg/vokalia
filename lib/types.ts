export type Resource = {
  id: string;
  name: string;
  capacity: number;
  active: boolean;
  color: string;
};

export type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
  active?: boolean;
  is_default?: boolean;
  combo_service_id?: string | null;
};

export type Appointment = {
  id: string;
  resource_id: string | null;
  service_id: string | null;
  customer_id: string | null;
  start_time: string;
  end_time: string;
  status: string;
  booked_by: string;
  block_label: string | null;
  customer: { name: string | null; phone_number?: string | null; phone?: string | null } | null;
  service: { name: string; duration_minutes?: number; price?: number | null } | null;
  resource: { name: string; color: string } | null;
};

export type CalendarData = {
  date: string;
  opening: { open_time: string; close_time: string } | null;
  resources: Resource[];
  services: Service[];
  appointments: Appointment[];
  slots: { resource_id: string; slot_start: string; slot_end: string }[];
};