-- Lab submissions for the DAA RGUKT Ongole evaluation portal.
-- One row per student account per experiment (1–5). Re-runs update the row.

create table if not exists lab_submissions (
  id              serial primary key,
  user_id         text not null,
  student_id      text not null,
  email           text not null,
  experiment      smallint not null check (experiment between 1 and 5),
  aim             text not null,
  language        text not null,
  code            text not null,
  runs_ok         boolean not null,
  base_marks      smallint not null,
  ai_percent      smallint,
  human_percent   smallint,
  ai_comment      text not null default '',
  deducted        boolean not null default false,
  awarded_marks   smallint not null,
  diagnostics     text not null default '[]',
  updated_at      timestamptz not null default now(),
  unique (user_id, experiment)
);

create index if not exists lab_submissions_student_idx on lab_submissions (student_id);
create index if not exists lab_submissions_email_idx on lab_submissions (email);
