-- Performance optimization indexes (aligned with Supabase Postgres best practices:
-- query-composite-indexes, query-partial-indexes).

-- 1. Composite index for goal activity queries (timeline & range scan)
-- Satisfies equality on goal_id, range on date, and ordering by (date desc, id desc)
-- without requiring an in-memory sort node.
create index if not exists activities_goal_date_desc
  on public.activities (goal_id, date desc, id desc);

-- 2. Partial index on active habits for fast dashboard & list queries
-- Bypasses archived habits and covers user_id + ordering by position and created_at.
create index if not exists habits_user_active
  on public.habits (user_id, position, created_at)
  where archived_at is null;

-- 3. Partial index on focus tasks
-- Fast filter for open tasks that carry a focus_from date.
create index if not exists tasks_user_focus
  on public.tasks (user_id, focus_from)
  where done_on is null and focus_from is not null;
