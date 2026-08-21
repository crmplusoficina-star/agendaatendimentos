create extension if not exists pgcrypto;
create schema if not exists private;
grant usage on schema private to authenticated;

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  matricula text not null unique,
  full_name text not null,
  role text not null check (role in ('consultor','gestor','admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_branches (
  user_id uuid not null references public.app_users(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  primary key (user_id, branch_id)
);

create table public.technicians (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  source text not null default 'fixed' check (source in ('fixed','adhoc')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index technicians_branch_name_uq on public.technicians(branch_id, lower(name));

create table public.appointment_statuses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color_hex text not null,
  text_color text not null default '#FFFFFF',
  sort_order integer not null,
  active boolean not null default true
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  city text,
  state text,
  phone text,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_branch_name_idx on public.clients(branch_id, lower(name));

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  serial text not null unique,
  manufacturer text,
  model text,
  city text,
  state text,
  current_hourmeter numeric(12,1),
  hourmeter_date date,
  caretrack_status text check (caretrack_status in ('cinza','verde','amarelo','vermelho') or caretrack_status is null),
  has_pm boolean,
  last_service_os text,
  last_service_date date,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index equipment_branch_serial_idx on public.equipment(branch_id, serial);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  appointment_date date not null,
  technician_id uuid references public.technicians(id) on delete set null,
  technician_name_manual text,
  client_id uuid references public.clients(id) on delete set null,
  client_name_manual text,
  equipment_id uuid references public.equipment(id) on delete set null,
  status_id uuid not null references public.appointment_statuses(id),
  amount numeric(14,2) not null default 0,
  notes text,
  service_order text,
  billing_status text not null default 'nao_precificado' check (billing_status in ('nao_precificado','precificado','aguardando_faturamento','faturado','perdido')),
  invoice_number text,
  billed_at timestamptz,
  distance_km numeric(10,1),
  deleted_at timestamptz,
  created_by uuid references public.app_users(id) on delete set null,
  updated_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (technician_id is not null or nullif(trim(technician_name_manual),'') is not null)
);
create index appointments_branch_date_idx on public.appointments(branch_id, appointment_date);
create index appointments_technician_date_idx on public.appointments(technician_id, appointment_date);

create table public.retention_contacts (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  contact_date timestamptz not null default now(),
  result text not null,
  notes text,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.caretrack_checks (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete cascade,
  equipment_id uuid references public.equipment(id) on delete cascade,
  checked_at timestamptz not null default now(),
  status text not null,
  alert_details text,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (appointment_id is not null or equipment_id is not null)
);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path=public as $$
begin new.updated_at=now(); return new; end; $$;
create trigger app_users_set_updated_at before update on public.app_users for each row execute function public.set_updated_at();
create trigger clients_set_updated_at before update on public.clients for each row execute function public.set_updated_at();
create trigger equipment_set_updated_at before update on public.equipment for each row execute function public.set_updated_at();
create trigger appointments_set_updated_at before update on public.appointments for each row execute function public.set_updated_at();

create or replace function private.current_app_user_id() returns uuid language sql stable security definer set search_path=public as $$
  select id from public.app_users where auth_user_id=auth.uid() and active=true limit 1
$$;
create or replace function private.current_app_role() returns text language sql stable security definer set search_path=public as $$
  select role from public.app_users where auth_user_id=auth.uid() and active=true limit 1
$$;
create or replace function private.can_access_branch(target_branch uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.app_users u where u.auth_user_id=auth.uid() and u.active=true and (u.role in ('gestor','admin') or exists(select 1 from public.user_branches ub where ub.user_id=u.id and ub.branch_id=target_branch)))
$$;
revoke all on function private.current_app_user_id() from public,anon;
revoke all on function private.current_app_role() from public,anon;
revoke all on function private.can_access_branch(uuid) from public,anon;
grant execute on function private.current_app_user_id() to authenticated;
grant execute on function private.current_app_role() to authenticated;
grant execute on function private.can_access_branch(uuid) to authenticated;

alter table public.branches enable row level security;
alter table public.app_users enable row level security;
alter table public.user_branches enable row level security;
alter table public.technicians enable row level security;
alter table public.appointment_statuses enable row level security;
alter table public.clients enable row level security;
alter table public.equipment enable row level security;
alter table public.appointments enable row level security;
alter table public.retention_contacts enable row level security;
alter table public.caretrack_checks enable row level security;

create policy branches_select on public.branches for select to authenticated using (true);
create policy statuses_select on public.appointment_statuses for select to authenticated using (true);
create policy app_users_select on public.app_users for select to authenticated using (auth_user_id=auth.uid() or private.current_app_role() in ('gestor','admin'));
create policy app_users_insert on public.app_users for insert to authenticated with check (private.current_app_role()='admin');
create policy app_users_update on public.app_users for update to authenticated using (private.current_app_role()='admin') with check (private.current_app_role()='admin');
create policy user_branches_select on public.user_branches for select to authenticated using (user_id=private.current_app_user_id() or private.current_app_role() in ('gestor','admin'));
create policy user_branches_insert on public.user_branches for insert to authenticated with check (private.current_app_role()='admin');
create policy user_branches_delete on public.user_branches for delete to authenticated using (private.current_app_role()='admin');
create policy technicians_select on public.technicians for select to authenticated using (private.can_access_branch(branch_id));
create policy technicians_insert on public.technicians for insert to authenticated with check (private.current_app_role() in ('consultor','admin') and private.can_access_branch(branch_id));
create policy technicians_update on public.technicians for update to authenticated using (private.current_app_role() in ('consultor','admin') and private.can_access_branch(branch_id)) with check (private.current_app_role() in ('consultor','admin') and private.can_access_branch(branch_id));
create policy technicians_delete on public.technicians for delete to authenticated using (private.current_app_role()='admin');
create policy clients_select on public.clients for select to authenticated using (private.can_access_branch(branch_id));
create policy clients_insert on public.clients for insert to authenticated with check (private.current_app_role() in ('consultor','admin') and private.can_access_branch(branch_id));
create policy clients_update on public.clients for update to authenticated using (private.current_app_role() in ('consultor','admin') and private.can_access_branch(branch_id)) with check (private.current_app_role() in ('consultor','admin') and private.can_access_branch(branch_id));
create policy clients_delete on public.clients for delete to authenticated using (private.current_app_role()='admin');
create policy equipment_select on public.equipment for select to authenticated using (private.can_access_branch(branch_id));
create policy equipment_insert on public.equipment for insert to authenticated with check (private.current_app_role() in ('consultor','admin') and private.can_access_branch(branch_id));
create policy equipment_update on public.equipment for update to authenticated using (private.current_app_role() in ('consultor','admin') and private.can_access_branch(branch_id)) with check (private.current_app_role() in ('consultor','admin') and private.can_access_branch(branch_id));
create policy equipment_delete on public.equipment for delete to authenticated using (private.current_app_role()='admin');
create policy appointments_select on public.appointments for select to authenticated using (deleted_at is null and private.can_access_branch(branch_id));
create policy appointments_insert on public.appointments for insert to authenticated with check (private.current_app_role() in ('consultor','admin') and private.can_access_branch(branch_id));
create policy appointments_update on public.appointments for update to authenticated using (private.current_app_role() in ('consultor','admin') and private.can_access_branch(branch_id)) with check (private.current_app_role() in ('consultor','admin') and private.can_access_branch(branch_id));
create policy appointments_delete on public.appointments for delete to authenticated using (private.current_app_role()='admin');
create policy retention_select on public.retention_contacts for select to authenticated using (exists(select 1 from public.appointments a where a.id=appointment_id and private.can_access_branch(a.branch_id)));
create policy retention_insert on public.retention_contacts for insert to authenticated with check (private.current_app_role() in ('consultor','admin') and exists(select 1 from public.appointments a where a.id=appointment_id and private.can_access_branch(a.branch_id)));
create policy retention_update on public.retention_contacts for update to authenticated using (private.current_app_role() in ('consultor','admin') and exists(select 1 from public.appointments a where a.id=appointment_id and private.can_access_branch(a.branch_id)));
create policy caretrack_select on public.caretrack_checks for select to authenticated using ((appointment_id is not null and exists(select 1 from public.appointments a where a.id=appointment_id and private.can_access_branch(a.branch_id))) or (equipment_id is not null and exists(select 1 from public.equipment e where e.id=equipment_id and private.can_access_branch(e.branch_id))));
create policy caretrack_insert on public.caretrack_checks for insert to authenticated with check (private.current_app_role() in ('consultor','admin') and ((appointment_id is not null and exists(select 1 from public.appointments a where a.id=appointment_id and private.can_access_branch(a.branch_id))) or (equipment_id is not null and exists(select 1 from public.equipment e where e.id=equipment_id and private.can_access_branch(e.branch_id)))));
