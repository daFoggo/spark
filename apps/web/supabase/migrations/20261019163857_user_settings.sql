-- Phase 0: per-user settings (timezone, week start, pet). Spec: TM-1..TM-5, PT-1.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- Shared trigger: keep updated_at honest.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.user_settings (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  -- IANA name. Falls back to UTC until the browser reports one (TM-2).
  timezone           text not null default 'UTC',
  timezone_confirmed boolean not null default false,
  -- 0 = Sunday .. 6 = Saturday (TM-4).
  week_start         smallint not null default 1 check (week_start between 0 and 6),
  pet_name           text not null default 'Mochi' check (char_length(pet_name) between 1 and 20),
  adopted_on         date not null default current_date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create function private.validate_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'TM-2: unknown timezone %', new.timezone using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger user_settings_validate_timezone
  before insert or update of timezone on public.user_settings
  for each row execute function private.validate_timezone();

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function private.set_updated_at();

-- A settings row is created with every account (PT-1: adopted_on = sign-up date).
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_settings (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Accounts that already exist.
insert into public.user_settings (user_id)
select id from auth.users
on conflict do nothing;

-- Least privilege: read, and update only the columns a user may change.
alter table public.user_settings enable row level security;
revoke all on table public.user_settings from anon, authenticated;
grant select on table public.user_settings to authenticated;
grant update (timezone, timezone_confirmed, week_start, pet_name) on table public.user_settings to authenticated;

create policy "user_settings_select_own" on public.user_settings
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_settings_update_own" on public.user_settings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
