-- Several labs share the submission table. Existing DAA rows stay on lab = 'daa'.

alter table lab_submissions add column if not exists lab text not null default 'daa';

alter table lab_submissions drop constraint if exists lab_submissions_user_id_experiment_key;

create unique index if not exists lab_submissions_user_lab_experiment_key
  on lab_submissions (user_id, lab, experiment);

create table if not exists lab_catalog (
  slug text primary key,
  title text not null,
  blurb text not null,
  language text not null,
  aims text not null,
  updated_at timestamptz not null default now()
);
