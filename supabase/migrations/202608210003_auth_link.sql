create or replace function private.link_auth_user_by_matricula()
returns trigger language plpgsql security definer set search_path=public,private as $$
declare login_matricula text;
begin
  login_matricula := split_part(coalesce(new.email,''),'@',1);
  if login_matricula <> '' then
    update public.app_users set auth_user_id=new.id,updated_at=now() where matricula=login_matricula and auth_user_id is null;
  end if;
  return new;
end;
$$;
revoke all on function private.link_auth_user_by_matricula() from public,anon,authenticated;
drop trigger if exists on_auth_user_created_link_profile on auth.users;
create trigger on_auth_user_created_link_profile after insert on auth.users for each row execute function private.link_auth_user_by_matricula();
