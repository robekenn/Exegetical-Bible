create index if not exists reading_plan_studies_author on public.reading_plan_studies(author_id);
create index if not exists reading_plan_progress_run_version on public.reading_plan_progress(run_id,version_id);
create index if not exists reading_plan_responses_run_member on public.reading_plan_responses(run_id,user_id);
create index if not exists reading_plan_responses_run_version on public.reading_plan_responses(run_id,version_id);
