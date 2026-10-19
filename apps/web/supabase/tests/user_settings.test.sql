begin;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'b@example.test');

select is((select count(*)::int from public.user_settings), 2, 'a settings row is created with each account');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select is((select count(*)::int from public.user_settings), 1, 'a user sees only their own row');

select results_eq(
  $$update public.user_settings set pet_name = 'Tofu' returning pet_name$$,
  $$values ('Tofu'::text)$$,
  'a user can rename the pet'
);

select is_empty(
  $$update public.user_settings set pet_name = 'Hack' where user_id = '00000000-0000-0000-0000-0000000000b2' returning 1$$,
  'a user cannot update another user''s row'
);

select throws_ok(
  $$update public.user_settings set timezone = 'Mars/Olympus'$$,
  'P0001', null, 'an unknown timezone is rejected (TM-2)'
);

select results_eq(
  $$update public.user_settings set timezone = 'Asia/Ho_Chi_Minh', timezone_confirmed = true returning timezone$$,
  $$values ('Asia/Ho_Chi_Minh'::text)$$,
  'a valid timezone is saved'
);

select throws_ok(
  $$update public.user_settings set adopted_on = '2000-01-01'$$,
  '42501', null, 'adopted_on cannot be changed by the user'
);

select throws_ok(
  $$delete from public.user_settings$$,
  '42501', null, 'a user cannot delete settings'
);

select * from finish();
rollback;
