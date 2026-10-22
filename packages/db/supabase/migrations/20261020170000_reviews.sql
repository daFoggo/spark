-- Phase 5: weekly review. Spec: RV-1..RV-5.

create table public.reviews (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start_on   date not null,
  reflection      text check (char_length(reflection) <= 2000),
  -- {habitId: 'keep' | 'easier' | 'pause'}
  habit_choices   jsonb not null default '{}'::jsonb,
  focus_task_ids  uuid[] not null default '{}' check (cardinality(focus_task_ids) <= 3),
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, week_start_on)
);

create trigger reviews_set_updated_at before update on public.reviews
  for each row execute function private.set_updated_at();

alter table public.reviews enable row level security;
revoke all on table public.reviews from anon, authenticated;
grant select on table public.reviews to authenticated;
grant insert (week_start_on, reflection, habit_choices, focus_task_ids, completed_at)
  on table public.reviews to authenticated;
grant update (reflection, habit_choices, focus_task_ids, completed_at)
  on table public.reviews to authenticated;

create policy "reviews_select_own" on public.reviews for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "reviews_insert_own" on public.reviews for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "reviews_update_own" on public.reviews for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- RV-4: a focus task shows on Today from `focus_from` on, whichever list it sits in.
alter table public.tasks add column focus_from date;
grant update (focus_from) on table public.tasks to authenticated;

-- First day of the user's current week (TM-4).
create function private.week_start_for(p_user uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select (private.today_for(p_user)
          - ((extract(dow from private.today_for(p_user))::int - s.week_start + 7) % 7))::date
  from public.user_settings s
  where s.user_id = p_user
$$;
revoke execute on function private.week_start_for(uuid) from public, anon;
grant execute on function private.week_start_for(uuid) to authenticated;

-- RV-1..RV-5: save the review, pause the chosen habits from next week and queue the focus tasks, all or nothing.
create function public.complete_review(
  p_week_start date, p_reflection text, p_choices jsonb, p_focus uuid[]
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user       uuid := (select auth.uid());
  v_today      date := private.today_for(v_user);
  v_week       date := private.week_start_for(v_user);
  v_next       date := v_week + 7;
  v_old_focus  uuid[];
  v_focus_from date;
begin
  if p_week_start is distinct from v_week then
    raise exception 'RV-1: only the current week can be reviewed' using errcode = 'P0001';
  end if;
  if cardinality(coalesce(p_focus, '{}')) > 3 then
    raise exception 'RV-4: pick at most 3 focus tasks' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_reflection, '')) > 2000 then
    raise exception 'RV-2: keep the reflection under 2000 characters' using errcode = 'P0001';
  end if;

  select r.focus_task_ids into v_old_focus
  from public.reviews r where r.user_id = v_user and r.week_start_on = v_week;

  insert into public.reviews (week_start_on, reflection, habit_choices, focus_task_ids, completed_at)
  values (v_week, nullif(trim(p_reflection), ''), coalesce(p_choices, '{}'::jsonb), coalesce(p_focus, '{}'), now())
  on conflict (user_id, week_start_on) do update
    set reflection = excluded.reflection,
        habit_choices = excluded.habit_choices,
        focus_task_ids = excluded.focus_task_ids,
        completed_at = excluded.completed_at;

  -- RV-3: Pause starts at the next week.
  update public.habits h
  set paused_from = v_next, paused_until = null
  where h.archived_at is null
    and p_choices ->> h.id::text = 'pause';

  -- RV-4: on the last day of the week the focus is immediate, otherwise it starts with the next week.
  v_focus_from := case when v_today >= v_week + 6 then v_today else v_next end;
  update public.tasks t set focus_from = v_focus_from
  where t.id = any (coalesce(p_focus, '{}')) and t.done_on is null;
  -- Tasks dropped from the focus on a re-opened review go back to their list.
  update public.tasks t set focus_from = null
  where t.id = any (coalesce(v_old_focus, '{}')) and t.id <> all (coalesce(p_focus, '{}'));
end;
$$;
revoke execute on function public.complete_review(date, text, jsonb, uuid[]) from public, anon;
grant execute on function public.complete_review(date, text, jsonb, uuid[]) to authenticated;
