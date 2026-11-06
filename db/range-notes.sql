-- Allow private passage notes alongside existing verse notes and highlights.
begin;
alter table public.study_entries
 drop constraint if exists study_entries_passage_check,
 add constraint study_entries_passage_check
  check (passage ~ '^[A-Z0-9]{3}\.[1-9][0-9]{0,2}\.[1-9][0-9]{0,2}(-[1-9][0-9]{0,2})?$');
commit;
