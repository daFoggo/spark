begin;
create extension if not exists pgtap with schema extensions;
create temp table tap_out (n serial, line text);
grant all on tap_out to authenticated;
grant usage on sequence tap_out_n_seq to authenticated;
insert into tap_out (line) select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'b@example.test');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

insert into tap_out (line) select lives_ok(
  $$select public.create_habit('Read', null, null, '1 page', 'evening', 'days', array[1,3,5]::smallint[], null)$$,
  'a habit and its first schedule are created together (HB-1, HB-2)'
);
insert into tap_out (line) select is((select count(*)::int from public.habit_schedules), 1, 'the first schedule row exists');

insert into tap_out (line) select throws_ok(
  $$select public.create_habit('Bad', null, null, null, 'morning', 'every', null, 9::smallint)$$,
  '23514', null, 'every n must be between 2 and 7 (HB-2)'
);

create temp table h as select id from public.habits limit 1;
grant select on h to authenticated;

insert into tap_out (line) select is(
  (select public.toggle_check_in((select id from h), private.today_for(auth.uid()), 'full')),
  'full', 'first tap creates a full check-in (AC-3)'
);
insert into tap_out (line) select is(
  (select public.toggle_check_in((select id from h), private.today_for(auth.uid()), 'minimum')),
  'minimum', 'other level changes it (AC-3)'
);
insert into tap_out (line) select is(
  (select public.toggle_check_in((select id from h), private.today_for(auth.uid()), 'minimum')),
  null, 'same level again undoes it (AC-3)'
);
insert into tap_out (line) select throws_ok(
  format($$select public.toggle_check_in(%L, private.today_for(auth.uid()) - 4, 'full')$$, (select id from h)),
  'P0001', null, 'older than 3 days is rejected (AC-5)'
);
insert into tap_out (line) select throws_ok(
  format($$select public.toggle_check_in(%L, private.today_for(auth.uid()) + 1, 'full')$$, (select id from h)),
  'P0001', null, 'future dates are rejected (AC-5)'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
insert into tap_out (line) select is((select count(*)::int from public.habits), 0, 'another user sees no habits');
insert into tap_out (line) select throws_ok(
  format($$select public.toggle_check_in(%L, private.today_for(auth.uid()), 'full')$$, (select id from h)),
  'P0001', null, 'another user cannot check in on this habit'
);
insert into tap_out (line) select throws_ok(
  format($$insert into public.activities (date, source, habit_id) values (current_date, 'habit', %L)$$, (select id from h)),
  '42501', null, 'another user cannot insert a check-in for this habit'
);

reset role;
insert into tap_out (line) select * from finish();
select string_agg(line, E'
' order by n) as tap from tap_out;
rollback;
