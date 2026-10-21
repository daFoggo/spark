-- Chapters were removed from the product (spec: no CH rules). Nothing reads them any more.
drop function if exists public.close_chapter(uuid, text);
drop function if exists private.close_chapter_impl(uuid, text);
drop table if exists public.chapters;
