-- Phase 1: habits, schedule history and the activity log (check-ins). Spec: HB-1..HB-7, AC-1..AC-6, AC-9.
-- goal_id / task_id are plain uuid columns for now; their foreign keys arrive with the goals and tasks tables.

-- Today's date for a user, from their saved timezone (TM-1, TM-3).
create function private.today_for(p_user uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone s.timezone)::date
  from public.user_settings s
  where s.user_id = p_user
$$;
revoke execute on function private.today_for(uuid) from public, anon;
grant execute on function private.today_for(uuid) to authenticated;

create table public.habits (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id          uuid,
  name             text not null check (char_length(name) between 1 and 80),
  cue              text check (char_length(cue) <= 120),
  full_version     text check (char_length(full_version) <= 60),
  minimum_version  text check (char_length(minimum_version) <= 60),
  time_of_day      text not null default 'morning' check (time_of_day in ('morning', 'afternoon', 'evening')),
  starts_on        date not null,
  paused_from      date,
  paused_until     date,
  archived_at      timestamptz,
  position         int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (paused_until is null or paused_from is not null)
);
create index habits_user_id on public.habits (user_id);

create trigger habits_set_updated_at before update on public.habits
  for each row execute function private.set_updated_at();

-- Ownership helper for policies on child tables (security definer so the lookup is not itself filtered twice).
create function private.owns_habit(p_habit uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.habits h where h.id = p_habit and h.user_id = (select auth.uid())
  )
$$;
revoke execute on function private.owns_habit(uuid) from public, anon;
grant execute on function private.owns_habit(uuid) to authenticated;

alter table public.habits enable row level security;
revoke all on table public.habits from anon, authenticated;
grant select on table public.habits to authenticated;
grant insert (name, cue, full_version, minimum_version, time_of_day, starts_on, goal_id)
  on table public.habits to authenticated;
grant update (name, cue, full_version, minimum_version, time_of_day, paused_from, paused_until,
              archived_at, position, goal_id)
  on table public.habits to authenticated;

create policy "habits_select_own" on public.habits for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "habits_insert_own" on public.habits for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "habits_update_own" on public.habits for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- HB-4: the latest row whose valid_from <= d applies on d.
create table public.habit_schedules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id    uuid not null references public.habits (id) on delete cascade,
  valid_from  date not null,
  kind        text not null check (kind in ('days', 'every')),
  weekdays    smallint[],
  every_n     smallint check (every_n between 2 and 7),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (habit_id, valid_from),
  check (
    (kind = 'days' and every_n is null and weekdays is not null and cardinality(weekdays) > 0
       and weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])
    or (kind = 'every' and weekdays is null and every_n is not null)
  )
);
create index habit_schedules_user_id on public.habit_schedules (user_id);

create trigger habit_schedules_set_updated_at before update on public.habit_schedules
  for each row execute function private.set_updated_at();

alter table public.habit_schedules enable row level security;
revoke all on table public.habit_schedules from anon, authenticated;
grant select on table public.habit_schedules to authenticated;
grant insert (habit_id, valid_from, kind, weekdays, every_n) on table public.habit_schedules to authenticated;
grant update (kind, weekdays, every_n) on table public.habit_schedules to authenticated;

create policy "habit_schedules_select_own" on public.habit_schedules for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "habit_schedules_insert_own" on public.habit_schedules for insert to authenticated
  with check ((select auth.uid()) = user_id and private.owns_habit(habit_id));
create policy "habit_schedules_update_own" on public.habit_schedules for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- One history table for check-ins, free logs and logged tasks (AC-1).
create table public.activities (
  id          bigint generated always as identity primary key,  -- monotonic: chapters use it (CH-2)
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  source      text not null check (source in ('habit', 'log', 'task')),
  habit_id    uuid references public.habits (id) on delete cascade,
  goal_id     uuid,
  task_id     uuid,
  level       text not null default 'full' check (level in ('full', 'minimum')),
  note        text check (char_length(note) <= 280),
  hours       numeric(3, 1) check (hours > 0 and hours <= 24),
  topic       text check (char_length(topic) <= 40),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check ((source = 'habit') = (habit_id is not null)),
  check (source = 'habit' or level = 'full')
);
create unique index activities_one_checkin on public.activities (habit_id, date) where source = 'habit';  -- AC-2
create index activities_user_date on public.activities (user_id, date);
create index activities_goal on public.activities (goal_id, id);

create trigger activities_set_updated_at before update on public.activities
  for each row execute function private.set_updated_at();

-- AC-5: new and changed activities must fall on today or the previous 3 local dates. Deleting is not limited (AC-9).
create function private.check_activity_window()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_today date := private.today_for(new.user_id);
begin
  if new.date > v_today or new.date < v_today - 3 then
    raise exception 'AC-5: only the last 3 days can be changed' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and old.date < v_today - 3 then
    raise exception 'AC-5: only the last 3 days can be changed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger activities_check_window
  before insert or update on public.activities
  for each row execute function private.check_activity_window();

alter table public.activities enable row level security;
revoke all on table public.activities from anon, authenticated;
grant select, delete on table public.activities to authenticated;
grant insert (date, source, habit_id, goal_id, task_id, level, note, hours, topic)
  on table public.activities to authenticated;
grant update (level, note, hours, topic, goal_id) on table public.activities to authenticated;

create policy "activities_select_own" on public.activities for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "activities_insert_own" on public.activities for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (habit_id is null or private.owns_habit(habit_id))
  );
create policy "activities_update_own" on public.activities for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "activities_delete_own" on public.activities for delete to authenticated
  using ((select auth.uid()) = user_id);

-- AC-3, AC-5, AC-6: tap full / minimum on a habit for a date. Returns the resulting level, or null when undone.
create function public.toggle_check_in(p_habit_id uuid, p_date date, p_level text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_today    date := private.today_for((select auth.uid()));
  v_goal     uuid;
  v_existing public.activities;
begin
  if p_level not in ('full', 'minimum') then
    raise exception 'AC-3: level must be full or minimum' using errcode = 'P0001';
  end if;
  if p_date > v_today or p_date < v_today - 3 then
    raise exception 'AC-5: only the last 3 days can be changed' using errcode = 'P0001';
  end if;

  select h.goal_id into v_goal from public.habits h where h.id = p_habit_id and h.archived_at is null;
  if not found then
    raise exception 'HB-6: habit not found' using errcode = 'P0001';
  end if;

  select * into v_existing from public.activities a
  where a.habit_id = p_habit_id and a.date = p_date and a.source = 'habit'
  for update;

  if not found then
    -- AC-6: the goal is copied from the habit at creation.
    insert into public.activities (date, source, habit_id, goal_id, level)
    values (p_date, 'habit', p_habit_id, v_goal, p_level);
    return p_level;
  elsif v_existing.level = p_level then
    delete from public.activities where id = v_existing.id;
    return null;
  else
    update public.activities set level = p_level where id = v_existing.id;
    return p_level;
  end if;
end;
$$;
revoke execute on function public.toggle_check_in(uuid, date, text) from public, anon;
grant execute on function public.toggle_check_in(uuid, date, text) to authenticated;

-- HB-1, HB-2, HB-3: a habit and its first schedule in one transaction.
create function public.create_habit(
  p_name text, p_cue text, p_full text, p_minimum text, p_time_of_day text,
  p_kind text, p_weekdays smallint[], p_every_n smallint
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_today date := private.today_for((select auth.uid()));
  v_id    uuid;
begin
  insert into public.habits (name, cue, full_version, minimum_version, time_of_day, starts_on)
  values (p_name, p_cue, p_full, p_minimum, p_time_of_day, v_today)
  returning id into v_id;

  insert into public.habit_schedules (habit_id, valid_from, kind, weekdays, every_n)
  values (v_id, v_today, p_kind, p_weekdays, p_every_n);
  return v_id;
end;
$$;
revoke execute on function public.create_habit(text, text, text, text, text, text, smallint[], smallint) from public, anon;
grant execute on function public.create_habit(text, text, text, text, text, text, smallint[], smallint) to authenticated;

-- HB-4: a schedule change applies from today; editing twice on one day replaces that day's row.
create function public.set_habit_schedule(
  p_habit_id uuid, p_kind text, p_weekdays smallint[], p_every_n smallint
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_today date := private.today_for((select auth.uid()));
begin
  if not exists (select 1 from public.habits h where h.id = p_habit_id) then
    raise exception 'HB-4: habit not found' using errcode = 'P0001';
  end if;
  insert into public.habit_schedules (habit_id, valid_from, kind, weekdays, every_n)
  values (p_habit_id, v_today, p_kind, p_weekdays, p_every_n)
  on conflict (habit_id, valid_from)
  do update set kind = excluded.kind, weekdays = excluded.weekdays, every_n = excluded.every_n;
end;
$$;
revoke execute on function public.set_habit_schedule(uuid, text, smallint[], smallint) from public, anon;
grant execute on function public.set_habit_schedule(uuid, text, smallint[], smallint) to authenticated;
