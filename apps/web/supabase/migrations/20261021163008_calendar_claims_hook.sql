-- Custom Access Token Hook: copies the calendar fields of user_settings (timezone, week start: TM-2, TM-4;
-- adoption date: PT-1) into the JWT, so the app knows the user's "today" without reading user_settings
-- first (one network round trip less per page). The app refreshes the token after saving settings;
-- elsewhere the claims trail the table by at most one token lifetime. SQL rules keep using the table
-- (private.today_for).
-- Enabled by [auth.hook.custom_access_token] in config.toml (hosted: `supabase config push`).
-- Never raises: a failing hook blocks every sign-in and token refresh.
create function private.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_timezone text;
  v_week_start smallint;
  v_adopted_on date;
begin
  select s.timezone, s.week_start, s.adopted_on into v_timezone, v_week_start, v_adopted_on
  from public.user_settings s
  where s.user_id = (event->>'user_id')::uuid;

  if found then
    event := jsonb_set(event, '{claims,timezone}', to_jsonb(v_timezone));
    event := jsonb_set(event, '{claims,week_start}', to_jsonb(v_week_start));
    event := jsonb_set(event, '{claims,adopted_on}', to_jsonb(v_adopted_on));
  end if;
  return event;
end;
$$;

-- Auth runs hooks as supabase_auth_admin; nobody else may call it.
grant usage on schema private to supabase_auth_admin;
grant execute on function private.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function private.custom_access_token_hook(jsonb) from public, anon, authenticated;

grant select (user_id, timezone, week_start, adopted_on) on table public.user_settings to supabase_auth_admin;
create policy "user_settings_select_auth_admin" on public.user_settings
  for select to supabase_auth_admin
  using (true);
