-- One zip each for the mini project and the main project.

create table if not exists project_uploads (
  user_id     text not null,
  student_id  text not null,
  email       text not null,
  kind        text not null check (kind in ('mini', 'major')),
  filename    text not null,
  bytes       integer not null,
  body        text not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, kind)
);

create index if not exists project_uploads_student_idx on project_uploads (student_id);
