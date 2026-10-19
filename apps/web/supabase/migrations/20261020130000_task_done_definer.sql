-- done_on is not writable by users (the client must not choose the date), so completing a task runs as the
-- function owner and checks ownership itself. TK-6, TK-7.
create or replace function public.set_task_done(p_task_id uuid, p_done boolean)
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
revoke execute on function public.set_task_done(uuid, boolean) from public, anon;
grant execute on function public.set_task_done(uuid, boolean) to authenticated;
