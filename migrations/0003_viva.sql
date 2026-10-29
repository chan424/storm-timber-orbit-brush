-- Viva bank, each student's ten questions, and their answers.
-- Oral recordings are base64 text. MCQ marks are 0 or 2. Oral marks stay null until the evaluation cell awards them.

create table if not exists viva_questions (
  id          serial primary key,
  kind        text not null check (kind in ('oral', 'mcq')),
  prompt      text not null,
  choices     text not null default '[]',
  answer      smallint,
  created_at  timestamptz not null default now()
);

create table if not exists viva_papers (
  user_id       text primary key,
  student_id    text not null,
  email         text not null,
  question_ids  text not null,
  saved_at      timestamptz
);

create index if not exists viva_papers_student_idx on viva_papers (student_id);

create table if not exists viva_answers (
  user_id      text not null,
  question_id  integer not null references viva_questions (id) on delete cascade,
  choice       smallint,
  awarded      smallint,
  video        text,
  video_type   text,
  updated_at   timestamptz not null default now(),
  primary key (user_id, question_id)
);
