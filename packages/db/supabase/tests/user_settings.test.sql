begin;
create extension if not exists pgtap with schema extensions;
create temp table tap_out (n serial, line text);
grant all on tap_out to authenticated;
grant usage on sequence tap_out_n_seq to authenticated;
insert into tap_out (line) select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'b@example.test');

insert into tap_out (line) select is(
  (select count(*)::int from public.user_settings
   where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2')),
  2,
  'a settings row is created with each account'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

insert into tap_out (line) select is((select count(*)::int from public.user_settings), 1, 'a user sees only their own row');

insert into tap_out (line) select results_eq(
  $$update public.user_settings set pet_name = 'Tofu' returning pet_name$$,
  $$values ('Tofu'::text)$$,
  'a user can rename the pet'
);

insert into tap_out (line) select is_empty(
  $$update public.user_settings set pet_name = 'Hack' where user_id = '00000000-0000-0000-0000-0000000000b2' returning 1$$,
  'a user cannot update another user''s row'
);

insert into tap_out (line) select throws_ok(
  $$update public.user_settings set timezone = 'Mars/Olympus'$$,
  'P0001', null, 'an unknown timezone is rejected (TM-2)'
);

insert into tap_out (line) select results_eq(
  $$update public.user_settings set timezone = 'Asia/Ho_Chi_Minh', timezone_confirmed = true returning timezone$$,
  $$values ('Asia/Ho_Chi_Minh'::text)$$,
  'a valid timezone is saved'
);

insert into tap_out (line) select throws_ok(
  $$update public.user_settings set adopted_on = '2000-01-01'$$,
  '42501', null, 'adopted_on cannot be changed by the user'
);

insert into tap_out (line) select throws_ok(
  $$delete from public.user_settings$$,
  '42501', null, 'a user cannot delete settings'
);

reset role;
insert into tap_out (line) select * from finish();
select string_agg(line, E'
' order by n) as tap from tap_out;
rollback;
