-- Phase 3: one-off tasks. Spec: TK-1..TK-8. goal_id stays a plain uuid until the goals table arrives.

create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id     uuid,
  title       text not null check (char_length(title) between 1 and 200),
  note        text check (char_length(note) <= 2000),
  list        text not null default 'today' check (list in ('today', 'later')),
  -- TK-4: age is today - created_on; Keep resets it (TK-5). Set from the user's local date, not the client's.
  created_on  date not null default private.today_for(auth.uid()),
  done_on     date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index tasks_user_list on public.tasks (user_id, list) where done_on is null;
create index tasks_user_done on public.tasks (user_id, done_on) where done_on is not null;

create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function private.set_updated_at();

create function private.owns_task(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t where t.id = p_task and t.user_id = (select auth.uid())
  )
$$;
revoke execute on function private.owns_task(uuid) from public, anon;
grant execute on function private.owns_task(uuid) to authenticated;

alter table public.tasks enable row level security;
revoke all on table public.tasks from anon, authenticated;
grant select, delete on table public.tasks to authenticated;
grant insert (title, note, goal_id, list) on table public.tasks to authenticated;
grant update (title, note, goal_id, list, created_on) on table public.tasks to authenticated;

create policy "tasks_select_own" on public.tasks for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "tasks_insert_own" on public.tasks for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "tasks_update_own" on public.tasks for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "tasks_delete_own" on public.tasks for delete to authenticated
  using ((select auth.uid()) = user_id);

-- activities.task_id now points at a real table (TK-6); a task is logged at most once.
alter table public.activities
  add constraint activities_task_id_fkey foreign key (task_id) references public.tasks (id) on delete set null,
  add constraint activities_task_source check (source <> 'task' or task_id is not null);
create index activities_task_id on public.activities (task_id) where task_id is not null;
create unique index activities_one_task_log on public.activities (task_id) where source = 'task';

drop policy "activities_insert_own" on public.activities;
create policy "activities_insert_own" on public.activities for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (habit_id is null or private.owns_habit(habit_id))
    and (task_id is null or private.owns_task(task_id))
  );

-- TK-6, TK-7: done_on follows the user's local today. Returns the new done date, null when un-completed.
create function public.set_task_done(p_task_id uuid, p_done boolean)
returns date
language plpgsql
set search_path = ''
as $$
declare
  v_done date := case when p_done then private.today_for((select auth.uid())) end;
begin
  update public.tasks set done_on = v_done where id = p_task_id;
  if not found then
    raise exception 'TK-6: task not found' using errcode = 'P0001';
  end if;
  return v_done;
end;
$$;
revoke execute on function public.set_task_done(uuid, boolean) from public, anon;
grant execute on function public.set_task_done(uuid, boolean) to authenticated;

-- TK-6: add a completed task to the log (idempotent: a task is logged once).
create function public.log_task(p_task_id uuid)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_task public.tasks;
  v_id   bigint;
begin
  select * into v_task from public.tasks t where t.id = p_task_id;
  if not found then
    raise exception 'TK-6: task not found' using errcode = 'P0001';
  end if;
  if v_task.goal_id is null then
    raise exception 'TK-6: only tasks linked to a goal can be logged' using errcode = 'P0001';
  end if;

  select a.id into v_id from public.activities a where a.task_id = p_task_id and a.source = 'task';
  if found then
    return v_id; -- already logged
  end if;

  insert into public.activities (date, source, task_id, goal_id, note)
  values (private.today_for((select auth.uid())), 'task', p_task_id, v_task.goal_id, left(v_task.title, 280))
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.log_task(uuid) from public, anon;
grant execute on function public.log_task(uuid) to authenticated;
