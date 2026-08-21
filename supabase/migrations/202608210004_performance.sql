create index if not exists appointments_client_id_idx on public.appointments(client_id);
create index if not exists appointments_equipment_id_idx on public.appointments(equipment_id);
create index if not exists appointments_status_id_idx on public.appointments(status_id);
create index if not exists appointments_created_by_idx on public.appointments(created_by);
create index if not exists appointments_updated_by_idx on public.appointments(updated_by);
create index if not exists caretrack_checks_appointment_id_idx on public.caretrack_checks(appointment_id);
create index if not exists caretrack_checks_equipment_id_idx on public.caretrack_checks(equipment_id);
create index if not exists caretrack_checks_created_by_idx on public.caretrack_checks(created_by);
create index if not exists equipment_client_id_idx on public.equipment(client_id);
create index if not exists retention_contacts_appointment_id_idx on public.retention_contacts(appointment_id);
create index if not exists retention_contacts_created_by_idx on public.retention_contacts(created_by);
create index if not exists user_branches_branch_id_idx on public.user_branches(branch_id);

drop policy if exists app_users_select on public.app_users;
create policy app_users_select on public.app_users for select to authenticated
using (auth_user_id=(select auth.uid()) or private.current_app_role() in ('gestor','admin'));
