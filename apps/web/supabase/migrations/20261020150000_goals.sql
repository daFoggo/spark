-- Phase 4: goals, checkpoints, chapters. Spec: GL-1..GL-7, CP-1..CP-4, CH-1..CH-4.

create table public.goals (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug              text not null check (slug ~ '^[a-z0-9][a-z0-9-]*$' and char_length(slug) <= 60),
  name              text not null check (char_length(name) between 1 and 120),
  why               text check (char_length(why) <= 500),
  becoming          text check (char_length(becoming) between 1 and 60),
  target_date       date,
  if_hard_obstacle  text check (char_length(if_hard_obstacle) <= 280),
  if_hard_plan      text check (char_length(if_hard_plan) <= 280),
  status            text not null default 'active' check (status in ('active', 'someday', 'done', 'archived')),
  position          int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, slug)
);
create index goals_user_status on public.goals (user_id, status);

create trigger goals_set_updated_at before update on public.goals
  for each row execute function private.set_updated_at();

create function private.owns_goal(p_goal uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.goals g where g.id = p_goal and g.user_id = (select auth.uid())
  )
$$;
revoke execute on function private.owns_goal(uuid) from public, anon;
grant execute on function private.owns_goal(uuid) to authenticated;

alter table public.goals enable row level security;
revoke all on table public.goals from anon, authenticated;
grant select on table public.goals to authenticated;
grant insert (slug, name, why, becoming, target_date, if_hard_obstacle, if_hard_plan, status)
  on table public.goals to authenticated;
grant update (name, why, becoming, target_date, if_hard_obstacle, if_hard_plan, status, position)
  on table public.goals to authenticated;

create policy "goals_select_own" on public.goals for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "goals_insert_own" on public.goals for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "goals_update_own" on public.goals for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table public.checkpoints (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id     uuid not null references public.goals (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  position    int not null default 0,
  done_on     date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index checkpoints_user_id on public.checkpoints (user_id);
create index checkpoints_goal_id on public.checkpoints (goal_id, position);

create trigger checkpoints_set_updated_at before update on public.checkpoints
  for each row execute function private.set_updated_at();

alter table public.checkpoints enable row level security;
revoke all on table public.checkpoints from anon, authenticated;
grant select, delete on table public.checkpoints to authenticated;
grant insert (goal_id, title, position) on table public.checkpoints to authenticated;
grant update (title, position, done_on) on table public.checkpoints to authenticated;

create policy "checkpoints_select_own" on public.checkpoints for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "checkpoints_insert_own" on public.checkpoints for insert to authenticated
  with check ((select auth.uid()) = user_id and private.owns_goal(goal_id));
create policy "checkpoints_update_own" on public.checkpoints for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "checkpoints_delete_own" on public.checkpoints for delete to authenticated
  using ((select auth.uid()) = user_id);

-- CH-4: chapters are append-only. They are written only by close_chapter(); users may rename them.
create table public.chapters (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id           uuid not null references public.goals (id) on delete cascade,
  title             text not null check (char_length(title) between 1 and 120),
  closed_on         date not null,
  last_activity_id  bigint not null,
  activity_count    int not null,
  hours             numeric(6, 1) not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index chapters_user_id on public.chapters (user_id);
create index chapters_goal_id on public.chapters (goal_id, last_activity_id);

create trigger chapters_set_updated_at before update on public.chapters
  for each row execute function private.set_updated_at();

alter table public.chapters enable row level security;
revoke all on table public.chapters from anon, authenticated;
grant select on table public.chapters to authenticated;
grant update (title) on table public.chapters to authenticated;

create policy "chapters_select_own" on public.chapters for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "chapters_update_own" on public.chapters for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- GL-3 (at most 3 active) and GL-4 (done needs a target date or a checkpoint).
create function private.enforce_goal_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    if (select count(*) from public.goals g
        where g.user_id = new.user_id and g.status = 'active' and g.id <> new.id) >= 3 then
      raise exception 'GL-3: Move one goal to Someday first' using errcode = 'P0001';
    end if;
  end if;
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    if new.target_date is null
       and not exists (select 1 from public.checkpoints c where c.goal_id = new.id) then
      raise exception 'GL-4: Add a target date or a checkpoint before marking it done'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger goals_enforce_rules
  before insert or update on public.goals
  for each row execute function private.enforce_goal_rules();

-- Links from the other tables become real foreign keys, and writes must point at the caller's own goal.
alter table public.habits
  add constraint habits_goal_id_fkey foreign key (goal_id) references public.goals (id) on delete set null;
alter table public.tasks
  add constraint tasks_goal_id_fkey foreign key (goal_id) references public.goals (id) on delete set null;
alter table public.activities
  add constraint activities_goal_id_fkey foreign key (goal_id) references public.goals (id) on delete set null;
create index habits_goal_id on public.habits (goal_id) where goal_id is not null;
create index tasks_goal_id on public.tasks (goal_id) where goal_id is not null;

drop policy "habits_insert_own" on public.habits;
create policy "habits_insert_own" on public.habits for insert to authenticated
  with check ((select auth.uid()) = user_id and (goal_id is null or private.owns_goal(goal_id)));
drop policy "habits_update_own" on public.habits;
create policy "habits_update_own" on public.habits for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (goal_id is null or private.owns_goal(goal_id)));

drop policy "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own" on public.tasks for insert to authenticated
  with check ((select auth.uid()) = user_id and (goal_id is null or private.owns_goal(goal_id)));
drop policy "tasks_update_own" on public.tasks;
create policy "tasks_update_own" on public.tasks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (goal_id is null or private.owns_goal(goal_id)));

drop policy "activities_insert_own" on public.activities;
create policy "activities_insert_own" on public.activities for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (habit_id is null or private.owns_habit(habit_id))
    and (task_id is null or private.owns_task(task_id))
    and (goal_id is null or private.owns_goal(goal_id))
  );
drop policy "activities_update_own" on public.activities;
create policy "activities_update_own" on public.activities for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (goal_id is null or private.owns_goal(goal_id)));

-- GL-1, GL-3: a goal from just a name. The slug comes from the name and is unique per user.
-- With 3 active goals it is created as someday; the caller reads the returned status.
create function public.create_goal(p_name text)
returns table (id uuid, slug text, status text)
language plpgsql
set search_path = ''
as $$
declare
  v_user   uuid := (select auth.uid());
  v_base   text := left(trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g')), 50);
  v_slug   text;
  v_n      int := 1;
  v_status text;
begin
  if v_base = '' then v_base := 'goal'; end if;
  v_slug := v_base;
  while exists (select 1 from public.goals g where g.user_id = v_user and g.slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  v_status := case
    when (select count(*) from public.goals g where g.user_id = v_user and g.status = 'active') >= 3
      then 'someday'
    else 'active'
  end;

  return query
    insert into public.goals (slug, name, status)
    values (v_slug, p_name, v_status)
    returning goals.id, goals.slug, goals.status;
end;
$$;
revoke execute on function public.create_goal(text) from public, anon;
grant execute on function public.create_goal(text) to authenticated;

-- CP-3: toggling done sets or clears the local date.
create function public.set_checkpoint_done(p_checkpoint_id uuid, p_done boolean)
returns date
language plpgsql
set search_path = ''
as $$
declare
  v_done date := case when p_done then private.today_for((select auth.uid())) end;
begin
  update public.checkpoints set done_on = v_done where id = p_checkpoint_id;
  if not found then
    raise exception 'CP-3: checkpoint not found' using errcode = 'P0001';
  end if;
  return v_done;
end;
$$;
revoke execute on function public.set_checkpoint_done(uuid, boolean) from public, anon;
grant execute on function public.set_checkpoint_done(uuid, boolean) to authenticated;

-- CP-4: swap a checkpoint with its neighbour. p_direction is -1 (up) or 1 (down).
create function public.move_checkpoint(p_checkpoint_id uuid, p_direction int)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_cp    public.checkpoints;
  v_other public.checkpoints;
begin
  select * into v_cp from public.checkpoints c where c.id = p_checkpoint_id;
  if not found then
    raise exception 'CP-4: checkpoint not found' using errcode = 'P0001';
  end if;
  select * into v_other from public.checkpoints c
  where c.goal_id = v_cp.goal_id
    and ((p_direction < 0 and (c.position, c.id) < (v_cp.position, v_cp.id))
      or (p_direction > 0 and (c.position, c.id) > (v_cp.position, v_cp.id)))
  order by case when p_direction < 0 then c.position end desc, case when p_direction < 0 then c.id end desc,
           case when p_direction > 0 then c.position end asc, case when p_direction > 0 then c.id end asc
  limit 1;
  if not found then
    return;
  end if;
  -- Positions can tie; renumber the pair so the swap is visible.
  update public.checkpoints set position = v_other.position where id = v_cp.id;
  update public.checkpoints set position = v_cp.position where id = v_other.id;
  if v_cp.position = v_other.position then
    update public.checkpoints set position = v_cp.position + p_direction where id = v_cp.id;
  end if;
end;
$$;
revoke execute on function public.move_checkpoint(uuid, int) from public, anon;
grant execute on function public.move_checkpoint(uuid, int) to authenticated;

-- CH-1, CH-2: close the current chapter. Runs as the owner (chapters have no insert grant) and checks ownership.
create function public.close_chapter(p_goal_id uuid, p_title text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_last  bigint;
  v_count int;
  v_hours numeric;
  v_max   bigint;
  v_id    uuid;
begin
  if not exists (select 1 from public.goals g where g.id = p_goal_id and g.user_id = v_user) then
    raise exception 'CH-1: goal not found' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 120 then
    raise exception 'CH-1: give the chapter a name' using errcode = 'P0001';
  end if;

  select coalesce(max(c.last_activity_id), 0) into v_last from public.chapters c where c.goal_id = p_goal_id;
  select count(*), coalesce(sum(a.hours), 0), max(a.id)
    into v_count, v_hours, v_max
  from public.activities a
  where a.goal_id = p_goal_id and a.user_id = v_user and a.id > v_last;

  if v_count = 0 then
    raise exception 'CH-1: log something in this chapter before closing it' using errcode = 'P0001';
  end if;

  insert into public.chapters (user_id, goal_id, title, closed_on, last_activity_id, activity_count, hours)
  values (v_user, p_goal_id, trim(p_title), private.today_for(v_user), v_max, v_count, v_hours)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.close_chapter(uuid, text) from public, anon;
grant execute on function public.close_chapter(uuid, text) to authenticated;

-- Habits can now start linked to a goal (HB-1).
drop function public.create_habit(text, text, text, text, text, text, smallint[], smallint);
create function public.create_habit(
  p_name text, p_cue text, p_full text, p_minimum text, p_time_of_day text,
  p_kind text, p_weekdays smallint[], p_every_n smallint, p_goal_id uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_today date := private.today_for((select auth.uid()));
  v_id    uuid;
begin
  insert into public.habits (name, cue, full_version, minimum_version, time_of_day, starts_on, goal_id)
  values (p_name, p_cue, p_full, p_minimum, p_time_of_day, v_today, p_goal_id)
  returning id into v_id;

  insert into public.habit_schedules (habit_id, valid_from, kind, weekdays, every_n)
  values (v_id, v_today, p_kind, p_weekdays, p_every_n);
  return v_id;
end;
$$;
revoke execute on function public.create_habit(text, text, text, text, text, text, smallint[], smallint, uuid) from public, anon;
grant execute on function public.create_habit(text, text, text, text, text, text, smallint[], smallint, uuid) to authenticated;
