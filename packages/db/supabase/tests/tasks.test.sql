begin;
create extension if not exists pgtap with schema extensions;
create temp table tap_out (n serial, line text);
grant all on tap_out to authenticated;
grant usage on sequence tap_out_n_seq to authenticated;
insert into tap_out (line) select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'b@example.test');

-- A goal owned by b, to prove a cannot link to it.
insert into public.goals (id, user_id, slug, name, status) values
  ('00000000-0000-0000-0000-00000000b0a1', '00000000-0000-0000-0000-0000000000b2', 'bs-goal', 'B goal', 'active');

-- Fixed ids need the table owner (users may insert only the columns the app sends); the defaults
-- (user_id, created_on) still come from these claims.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into public.tasks (id, title) values ('00000000-0000-0000-0000-0000000000f1', 'Write tests');
set local role authenticated;

insert into tap_out (line) select is(
  (select created_on from public.tasks where id = '00000000-0000-0000-0000-0000000000f1'),
  private.today_for(auth.uid()),
  'created_on is the user''s local today, not the client''s (TK-4)'
);

insert into tap_out (line) select is(
  public.set_task_done('00000000-0000-0000-0000-0000000000f1', true),
  private.today_for(auth.uid()),
  'completing stamps today (TK-6)'
);
insert into tap_out (line) select is(
  public.set_task_done('00000000-0000-0000-0000-0000000000f1', false),
  null::date,
  'un-completing clears the date (TK-7)'
);
insert into tap_out (line) select throws_ok(
  $$update public.tasks set done_on = '2000-01-01'$$,
  '42501', null, 'done_on cannot be written directly'
);

insert into tap_out (line) select throws_ok(
  $$select public.log_task('00000000-0000-0000-0000-0000000000f1')$$,
  'P0001', null, 'a task without a goal cannot be logged (TK-6)'
);

insert into tap_out (line) select throws_ok(
  $$insert into public.tasks (title, goal_id) values ('Sneaky', '00000000-0000-0000-0000-00000000b0a1')$$,
  '42501', null, 'a task cannot point at another user''s goal'
);

-- own goal -> loggable, and only once
insert into tap_out (line) select lives_ok(
  $$insert into public.goals (slug, name, status) values ('mine', 'Mine', 'active')$$,
  'a user creates a goal'
);
insert into tap_out (line) select lives_ok(
  $$update public.tasks set goal_id = (select id from public.goals where slug = 'mine')$$,
  'a task links to the user''s own goal'
);
insert into tap_out (line) select is(
  public.log_task('00000000-0000-0000-0000-0000000000f1') = public.log_task('00000000-0000-0000-0000-0000000000f1'),
  true,
  'logging a task twice returns the same activity (TK-6)'
);
insert into tap_out (line) select is(
  (select count(*)::int from public.activities where source = 'task'),
  1,
  'one activity per logged task'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
insert into tap_out (line) select is((select count(*)::int from public.tasks), 0, 'another user sees no tasks');
insert into tap_out (line) select throws_ok(
  $$select public.set_task_done('00000000-0000-0000-0000-0000000000f1', true)$$,
  'P0001', null, 'another user cannot complete this task'
);

reset role;
insert into tap_out (line) select * from finish();
select string_agg(line, E'
' order by n) as tap from tap_out;
rollback;
