begin;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'b@example.test');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

-- create_goal: slug from the name, unique per user (GL-1)
select is((select slug from public.create_goal('Become an AI engineer')), 'become-an-ai-engineer', 'slug comes from the name');
select is((select slug from public.create_goal('Become an AI engineer!')), 'become-an-ai-engineer-2', 'a clash gets a numeric suffix');
select is((select status from public.create_goal('Third')), 'active', 'the third goal is still active');
-- GL-3: the 4th active goal is created as someday
select is((select status from public.create_goal('Fourth')), 'someday', 'with 3 active, a new goal becomes someday (GL-3)');

select throws_ok(
  $$update public.goals set status = 'active' where slug = 'fourth'$$,
  'P0001', null, 'activating a 4th goal is refused (GL-3)'
);

-- GL-4: done needs a target date or a checkpoint
select throws_ok(
  $$update public.goals set status = 'done' where slug = 'third'$$,
  'P0001', null, 'done without a target or checkpoint is refused (GL-4)'
);
select lives_ok(
  $$update public.goals set target_date = '2027-01-01', status = 'done' where slug = 'third'$$,
  'done with a target date is allowed (GL-4)'
);

-- checkpoints (CP-1, CP-3)
select lives_ok(
  $$insert into public.checkpoints (goal_id, title, position)
    select id, 'Step one', 0 from public.goals where slug = 'become-an-ai-engineer'$$,
  'a checkpoint is added'
);
select is(
  public.set_checkpoint_done((select id from public.checkpoints limit 1), true),
  private.today_for(auth.uid()),
  'ticking a checkpoint stamps today (CP-3)'
);

-- isolation
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::int from public.goals), 0, 'another user sees no goals');

select * from finish();
rollback;
