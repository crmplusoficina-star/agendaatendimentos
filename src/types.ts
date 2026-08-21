export type Role = 'consultor' | 'gestor' | 'admin';

export type Profile = {
  id: string;
  matricula: string;
  full_name: string;
  role: Role;
};

export type Branch = {
  id: string;
  name: string;
  slug: string;
};

export type Technician = {
  id: string;
  branch_id: string;
  name: string;
  source: 'fixed' | 'adhoc';
};

export type AppointmentStatus = {
  id: string;
  name: string;
  color_hex: string;
  text_color: string;
  sort_order: number;
};

export type Appointment = {
  id: string;
  branch_id: string;
  appointment_date: string;
  technician_id: string | null;
  technician_name_manual: string | null;
  status_id: string;
  amount: number;
  notes: string | null;
  billing_status: string;
  invoice_number: string | null;
  status?: AppointmentStatus | null;
  technician?: Pick<Technician, 'id' | 'name'> | null;
};

export type Equipment = {
  id: string;
  serial: string;
  manufacturer: string | null;
  model: string | null;
  city: string | null;
  state: string | null;
  current_hourmeter: number | null;
  hourmeter_date: string | null;
  caretrack_status: string | null;
  client?: { name: string } | null;
};
