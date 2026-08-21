create unique index if not exists appointment_hourmeter_readings_appointment_uq
on public.appointment_hourmeter_readings (appointment_id);

create or replace function public.sync_appointment_hourmeter_reading()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reported_hourmeter is null or nullif(trim(coalesce(new.equipment_serial,'')), '') is null then
    delete from public.appointment_hourmeter_readings where appointment_id = new.id;
    return new;
  end if;

  insert into public.appointment_hourmeter_readings (
    appointment_id,
    equipment_serial,
    hourmeter,
    reading_date,
    created_by
  ) values (
    new.id,
    new.equipment_serial,
    new.reported_hourmeter,
    new.appointment_date,
    coalesce(new.updated_by, new.created_by)
  )
  on conflict (appointment_id) do update set
    equipment_serial = excluded.equipment_serial,
    hourmeter = excluded.hourmeter,
    reading_date = excluded.reading_date,
    created_by = coalesce(excluded.created_by, public.appointment_hourmeter_readings.created_by);

  return new;
end;
$$;

drop trigger if exists appointments_sync_hourmeter_reading on public.appointments;
create trigger appointments_sync_hourmeter_reading
after insert or update of reported_hourmeter, equipment_serial, appointment_date, updated_by
on public.appointments
for each row
execute function public.sync_appointment_hourmeter_reading();
