begin;
create extension if not exists pgtap with schema extensions;
create temp table tap_out (n serial, line text);
grant all on tap_out to authenticated;
grant usage on sequence tap_out_n_seq to authenticated;
insert into tap_out (line) select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'b@example.test');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

-- create_goal: slug from the name, unique per user (GL-1)
insert into tap_out (line) select is((select slug from public.create_goal('Become an AI engineer')), 'become-an-ai-engineer', 'slug comes from the name');
insert into tap_out (line) select is((select slug from public.create_goal('Become an AI engineer!')), 'become-an-ai-engineer-2', 'a clash gets a numeric suffix');
insert into tap_out (line) select is((select status from public.create_goal('Third')), 'active', 'the third goal is still active');
-- GL-3: the 4th active goal is created as someday
insert into tap_out (line) select is((select status from public.create_goal('Fourth')), 'someday', 'with 3 active, a new goal becomes someday (GL-3)');

insert into tap_out (line) select throws_ok(
  $$update public.goals set status = 'active' where slug = 'fourth'$$,
  'P0001', null, 'activating a 4th goal is refused (GL-3)'
);

-- GL-4: done needs a target date or a checkpoint
insert into tap_out (line) select throws_ok(
  $$update public.goals set status = 'done' where slug = 'third'$$,
  'P0001', null, 'done without a target or checkpoint is refused (GL-4)'
);
insert into tap_out (line) select lives_ok(
  $$update public.goals set target_date = '2027-01-01', status = 'done' where slug = 'third'$$,
  'done with a target date is allowed (GL-4)'
);

-- checkpoints (CP-1, CP-3)
insert into tap_out (line) select lives_ok(
  $$insert into public.checkpoints (goal_id, title, position)
    select id, 'Step one', 0 from public.goals where slug = 'become-an-ai-engineer'$$,
  'a checkpoint is added'
);
insert into tap_out (line) select is(
  public.set_checkpoint_done((select id from public.checkpoints limit 1), true),
  private.today_for(auth.uid()),
  'ticking a checkpoint stamps today (CP-3)'
);

-- isolation
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
insert into tap_out (line) select is((select count(*)::int from public.goals), 0, 'another user sees no goals');

reset role;
insert into tap_out (line) select * from finish();
select string_agg(line, E'
' order by n) as tap from tap_out;
rollback;
