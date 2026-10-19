-- Demo data for `supabase db reset` on a local stack (never applied to the hosted project).
-- One demo user (demo@spark.test / demo-password-123) with the prototype's world: goals, habits with a year of
-- check-ins, free logs, tasks, a closed chapter. Dates are relative to the day the seed runs.

do $$
declare
  v_user  uuid := '00000000-0000-0000-0000-00000000de40';
  v_today date;
  v_ai    uuid := gen_random_uuid();
  v_run   uuid := gen_random_uuid();
  v_sleep uuid := gen_random_uuid();
  v_read  uuid;
  v_walk  uuid;
  v_meds  uuid;
  v_water uuid;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'demo@spark.test', extensions.crypt('demo-password-123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_user, v_user::text, 'email',
          jsonb_build_object('sub', v_user::text, 'email', 'demo@spark.test'), now(), now(), now());

  -- user_settings was created by the sign-up trigger.
  update public.user_settings
  set timezone = 'Asia/Ho_Chi_Minh', timezone_confirmed = true, week_start = 1,
      adopted_on = (now() at time zone 'Asia/Ho_Chi_Minh')::date - 45
  where user_id = v_user;
  v_today := (now() at time zone 'Asia/Ho_Chi_Minh')::date;

  -- Goals: two active (one open-ended with an identity, one with a finish line) and one waiting.
  insert into public.goals (id, user_id, slug, name, why, becoming, status, position) values
    (v_ai, v_user, 'ai-engineer', 'Become an AI engineer', 'Build things that think.', 'an AI engineer', 'active', 0);
  insert into public.goals (id, user_id, slug, name, target_date, status, position) values
    (v_run, v_user, 'half-marathon', 'Run a half marathon', v_today + 120, 'active', 1);
  insert into public.goals (id, user_id, slug, name, status, position) values
    (v_sleep, v_user, 'sleep-better', 'Sleep better', 'someday', 2);

  insert into public.checkpoints (user_id, goal_id, title, position, done_on) values
    (v_user, v_run, 'Run 5 km without stopping', 0, v_today - 30),
    (v_user, v_run, 'Run 10 km', 1, v_today - 6),
    (v_user, v_run, 'Run 15 km', 2, null),
    (v_user, v_run, 'Race day', 3, null);

  -- Habits and their schedules (valid from the start date).
  insert into public.habits (user_id, goal_id, name, cue, minimum_version, time_of_day, starts_on)
  values (v_user, v_ai, 'Study one hour', 'After dinner', 'Open the notes', 'evening', v_today - 120)
  returning id into v_read;
  insert into public.habits (user_id, goal_id, name, cue, minimum_version, time_of_day, starts_on)
  values (v_user, v_run, 'Run', 'After I wake up', 'Put the shoes on', 'morning', v_today - 120)
  returning id into v_walk;
  insert into public.habits (user_id, name, cue, minimum_version, time_of_day, starts_on)
  values (v_user, 'Meditate', 'After I pour my coffee', 'One minute', 'morning', v_today - 120)
  returning id into v_meds;
  insert into public.habits (user_id, name, time_of_day, starts_on)
  values (v_user, 'Drink water', 'afternoon', v_today - 120)
  returning id into v_water;

  insert into public.habit_schedules (user_id, habit_id, valid_from, kind, weekdays, every_n) values
    (v_user, v_read, v_today - 120, 'days', array[1, 3, 5]::smallint[], null),
    (v_user, v_walk, v_today - 120, 'every', null, 2),
    (v_user, v_meds, v_today - 120, 'days', array[0, 1, 2, 3, 4, 5, 6]::smallint[], null),
    (v_user, v_water, v_today - 120, 'days', array[1, 2, 3, 4, 5]::smallint[], null);

  -- A year of history is written directly, so the "last 3 days" trigger must be off while seeding.
  alter table public.activities disable trigger activities_check_window;

  -- Check-ins: roughly 75% on scheduled days, a few minimum versions, deterministic per habit and date.
  insert into public.activities (user_id, date, source, habit_id, goal_id, level)
  select v_user, d::date, 'habit', h.id, h.goal_id,
         case when abs(hashtext(h.id::text || d::text)) % 5 = 0 then 'minimum' else 'full' end
  from public.habits h
  join public.habit_schedules s on s.habit_id = h.id
  cross join generate_series(v_today - 119, v_today - 1, interval '1 day') as d
  where h.user_id = v_user
    and abs(hashtext(h.id::text || d::text || 'p')) % 4 <> 0
    and (
      (s.kind = 'days' and extract(dow from d)::int = any (s.weekdays))
      or (s.kind = 'every' and (d::date - h.starts_on) % s.every_n = 0)
    );

  -- Free logs on the open-ended goal, then a closed chapter that snapshots the first ones.
  insert into public.activities (user_id, date, source, goal_id, note, hours)
  select v_user, v_today - n, 'log', v_ai,
         (array['Read about embeddings', 'Built a toy RAG pipeline', 'Watched a lecture on transformers',
                'Fixed my training loop', 'Wrote notes on attention'])[1 + n % 5],
         0.5 + (n % 4) * 0.5
  from generate_series(2, 40, 3) as n;

  insert into public.chapters (user_id, goal_id, title, closed_on, last_activity_id, activity_count, hours)
  select v_user, v_ai, 'Foundations', v_today - 14, max(id), count(*), coalesce(sum(hours), 0)
  from public.activities where goal_id = v_ai and source = 'log' and date <= v_today - 20;

  alter table public.activities enable trigger activities_check_window;

  -- Tasks: some fresh, one old enough to ask "Still want to do this?", one waiting, one done and linked.
  insert into public.tasks (user_id, goal_id, title, list, created_on, done_on) values
    (v_user, v_ai, 'Finish the RAG tutorial', 'today', v_today, null),
    (v_user, null, 'Book a dentist appointment', 'today', v_today - 7, null),
    (v_user, null, 'Plan the weekend trip', 'later', v_today - 2, null),
    (v_user, v_run, 'Buy new running shoes', 'today', v_today - 3, v_today - 1);

  -- Last week's review, saved.
  insert into public.reviews (user_id, week_start_on, reflection, habit_choices, completed_at)
  values (v_user, v_today - 7 - ((extract(dow from v_today)::int - 1 + 7) % 7),
          'Late nights got in the way.', jsonb_build_object(v_walk::text, 'easier'), now() - interval '5 days');
end;
$$;
