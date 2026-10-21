begin;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'b@example.test');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
-- Fixed ids need the table owner; user_id still defaults to the claims' user.
insert into public.tasks (id, title) values
  ('00000000-0000-0000-0000-0000000000f1', 'One'),
  ('00000000-0000-0000-0000-0000000000f2', 'Two'),
  ('00000000-0000-0000-0000-0000000000f3', 'Three'),
  ('00000000-0000-0000-0000-0000000000f4', 'Four');
set local role authenticated;

select public.create_habit('Read', null, null, null, 'evening', 'days', array[1,3,5]::smallint[], null);

select throws_ok(
  $$select public.complete_review('2000-01-03', 'x', '{}'::jsonb, '{}')$$,
  'P0001', null, 'only the current week can be reviewed (RV-1)'
);
select throws_ok(
  format(
    $$select public.complete_review(%L, 'x', '{}'::jsonb, array[%L, %L, %L, %L]::uuid[])$$,
    private.week_start_for(auth.uid()),
    '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2',
    '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f4'
  ),
  'P0001', null, 'at most 3 focus tasks (RV-4)'
);

select lives_ok(
  format(
    $$select public.complete_review(%L, 'Busy week', jsonb_build_object((select id::text from public.habits limit 1), 'pause'), array[%L]::uuid[])$$,
    private.week_start_for(auth.uid()), '00000000-0000-0000-0000-0000000000f1'
  ),
  'a review is saved'
);
select is((select count(*)::int from public.reviews), 1, 'one review per week (RV-1)');
select isnt((select completed_at from public.reviews), null, 'it is completed (RV-5)');
select is(
  (select paused_from from public.habits limit 1),
  private.week_start_for(auth.uid()) + 7,
  'a paused habit pauses from next week (RV-3)'
);
select isnt(
  (select focus_from from public.tasks where id = '00000000-0000-0000-0000-0000000000f1'),
  null,
  'a focus task is queued (RV-4)'
);

-- re-opening replaces the review and releases dropped focus tasks
select lives_ok(
  format(
    $$select public.complete_review(%L, 'Again', '{}'::jsonb, array[%L]::uuid[])$$,
    private.week_start_for(auth.uid()), '00000000-0000-0000-0000-0000000000f2'
  ),
  'the review can be saved again within the week'
);
select is(
  (select focus_from from public.tasks where id = '00000000-0000-0000-0000-0000000000f1'),
  null::date,
  'a task dropped from the focus goes back to its list'
);

select * from finish();
rollback;
