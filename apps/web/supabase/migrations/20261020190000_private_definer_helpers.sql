-- Advisor lint 0029: SECURITY DEFINER functions in `public` are callable through the REST API.
-- The two that must write columns users cannot touch directly move to `private` (not exposed by the API);
-- the public functions stay as thin SECURITY INVOKER wrappers with the same signature, so callers do not change.

create function private.set_task_done_impl(p_task_id uuid, p_done boolean)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_done date := case when p_done then private.today_for((select auth.uid())) end;
begin
  update public.tasks set done_on = v_done where id = p_task_id and user_id = v_user;
  if not found then
    raise exception 'TK-6: task not found' using errcode = 'P0001';
  end if;
  return v_done;
end;
$$;
revoke execute on function private.set_task_done_impl(uuid, boolean) from public, anon;
grant execute on function private.set_task_done_impl(uuid, boolean) to authenticated;

create or replace function public.set_task_done(p_task_id uuid, p_done boolean)
returns date
language sql
security invoker
set search_path = ''
as $$
  select private.set_task_done_impl(p_task_id, p_done)
$$;
revoke execute on function public.set_task_done(uuid, boolean) from public, anon;
grant execute on function public.set_task_done(uuid, boolean) to authenticated;

create function private.close_chapter_impl(p_goal_id uuid, p_title text)
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
revoke execute on function private.close_chapter_impl(uuid, text) from public, anon;
grant execute on function private.close_chapter_impl(uuid, text) to authenticated;

create or replace function public.close_chapter(p_goal_id uuid, p_title text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.close_chapter_impl(p_goal_id, p_title)
$$;
revoke execute on function public.close_chapter(uuid, text) from public, anon;
grant execute on function public.close_chapter(uuid, text) to authenticated;
