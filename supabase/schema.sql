-- =====================================================================
-- Sistema de Evaluación de Defensa y Presentación de Proyecto de Título
-- TIHI84 · INACAP · Instrumentos ES4 (Defensa) y ES3 (Demostración)
--
-- Ejecutar en Supabase → SQL Editor (primero schema.sql, luego seed.sql).
-- Requiere: Authentication → Sign In / Providers → "Allow anonymous sign-ins" activado.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type rubric_level as enum ('excelente', 'bueno', 'insatisfactorio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type evaluator_role as enum ('guia', 'director', 'acompanante');
exception when duplicate_object then null; end $$;

do $$ begin
  create type session_status as enum ('programada', 'en_curso', 'finalizada');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Docentes e ingreso por RUT
-- ---------------------------------------------------------------------
create table if not exists teachers (
  id          uuid primary key default gen_random_uuid(),
  rut         text not null unique,          -- normalizado: 12345678-K
  full_name   text not null,
  email       text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Vincula el usuario anónimo de Supabase Auth con el docente que ingresó su RUT.
create table if not exists teacher_logins (
  auth_uid    uuid primary key references auth.users (id) on delete cascade,
  teacher_id  uuid not null references teachers (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Instrumentos y rúbricas
-- ---------------------------------------------------------------------
create table if not exists instruments (
  code        text primary key check (code in ('ES4', 'ES3')),
  name        text not null,
  weight      numeric(5,2) not null,         -- ponderación en la asignatura (35 / 25)
  sort        int not null
);

create table if not exists rubric_criteria (
  id              uuid primary key default gen_random_uuid(),
  instrument_code text not null references instruments (code) on delete cascade,
  code            text not null,             -- 3.1.3, 3.1.4, ...
  description     text not null,
  sort            int not null,
  unique (instrument_code, code)
);

create table if not exists rubric_items (
  id           uuid primary key default gen_random_uuid(),
  criterion_id uuid not null references rubric_criteria (id) on delete cascade,
  number       int not null,                 -- número del indicador dentro del instrumento
  description  text not null,
  weight       numeric(6,2) not null,        -- ponderación del indicador en la tabla (total 100)
  sort         int not null
);

-- Puntaje que otorga cada nivel de valoración en cada indicador (editable).
create table if not exists rubric_item_levels (
  item_id  uuid not null references rubric_items (id) on delete cascade,
  level    rubric_level not null,
  points   numeric(6,2) not null check (points >= 0),
  primary key (item_id, level)
);

-- ---------------------------------------------------------------------
-- Sesiones de evaluación
-- ---------------------------------------------------------------------
create table if not exists sessions (
  id                   uuid primary key default gen_random_uuid(),
  project_name         text not null,
  presented_at         timestamptz not null,
  director_name        text not null default '',
  created_by           uuid not null references teachers (id),
  status               session_status not null default 'programada',
  -- Cronómetro compartido: transcurrido = timer_accumulated_ms + (now - timer_started_at) si está corriendo
  timer_running        boolean not null default false,
  timer_started_at     timestamptz,
  timer_accumulated_ms bigint not null default 0,
  created_at           timestamptz not null default now()
);

create table if not exists students (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions (id) on delete cascade,
  full_name   text not null,
  sort        int not null default 0,
  unique (id, session_id)
);

create table if not exists session_evaluators (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references sessions (id) on delete cascade,
  teacher_id     uuid not null references teachers (id),
  role           evaluator_role not null,
  completed_es4  boolean not null default false,
  completed_es3  boolean not null default false,
  unique (session_id, teacher_id),
  unique (id, session_id)
);

-- Una valoración por evaluador × estudiante × indicador (ES4 y ES3 son individuales).
create table if not exists evaluations (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions (id) on delete cascade,
  evaluator_id  uuid not null,
  student_id    uuid not null,
  item_id       uuid not null references rubric_items (id) on delete cascade,
  level         rubric_level not null,
  comment       text,
  updated_at    timestamptz not null default now(),
  unique (evaluator_id, student_id, item_id),
  foreign key (evaluator_id, session_id) references session_evaluators (id, session_id) on delete cascade,
  foreign key (student_id, session_id)   references students (id, session_id) on delete cascade
);

create index if not exists idx_students_session on students (session_id);
create index if not exists idx_evaluators_session on session_evaluators (session_id);
create index if not exists idx_evaluators_teacher on session_evaluators (teacher_id);
create index if not exists idx_evaluations_session on evaluations (session_id);
create index if not exists idx_sessions_presented on sessions (presented_at);

-- ---------------------------------------------------------------------
-- Funciones auxiliares (SECURITY DEFINER para evitar recursión de RLS)
-- ---------------------------------------------------------------------
create or replace function normalize_rut(p_rut text) returns text
language sql immutable as $$
  select case
    when length(regexp_replace(upper(coalesce(p_rut, '')), '[^0-9K]', '', 'g')) < 2 then null
    else left(regexp_replace(upper(p_rut), '[^0-9K]', '', 'g'),
              length(regexp_replace(upper(p_rut), '[^0-9K]', '', 'g')) - 1)
         || '-' || right(regexp_replace(upper(p_rut), '[^0-9K]', '', 'g'), 1)
  end
$$;

create or replace function is_valid_rut(p_rut text) returns boolean
language plpgsql immutable as $$
declare
  v text := normalize_rut(p_rut);
  body text; dv text; s int := 0; m int := 2; i int; r int; expected text;
begin
  if v is null or v !~ '^[0-9]{1,8}-[0-9K]$' then return false; end if;
  body := split_part(v, '-', 1);
  dv := split_part(v, '-', 2);
  for i in reverse length(body)..1 loop
    s := s + substr(body, i, 1)::int * m;
    m := case when m = 7 then 2 else m + 1 end;
  end loop;
  r := 11 - (s % 11);
  expected := case r when 11 then '0' when 10 then 'K' else r::text end;
  return expected = dv;
end $$;

create or replace function current_teacher_id() returns uuid
language sql stable security definer set search_path = public as $$
  select teacher_id from teacher_logins where auth_uid = auth.uid()
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from teachers where id = current_teacher_id()), false)
$$;

create or replace function is_session_member(p_session uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from session_evaluators
    where session_id = p_session and teacher_id = current_teacher_id()
  ) or exists (
    select 1 from sessions where id = p_session and created_by = current_teacher_id()
  )
$$;

-- Docente guía de la sesión (o quien la creó, o admin): administra la sesión y el cronómetro.
create or replace function is_session_guide(p_session uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin()
    or exists (select 1 from sessions where id = p_session and created_by = current_teacher_id())
    or exists (
      select 1 from session_evaluators
      where session_id = p_session and teacher_id = current_teacher_id() and role = 'guia'
    )
$$;

-- ---------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------

-- Ingreso por RUT: vincula el usuario anónimo actual con el docente.
create or replace function login_with_rut(p_rut text)
returns teachers
language plpgsql security definer set search_path = public as $$
declare
  t teachers;
begin
  if auth.uid() is null then
    raise exception 'Sesión de autenticación no iniciada';
  end if;
  if not is_valid_rut(p_rut) then
    raise exception 'RUT inválido';
  end if;
  select * into t from teachers where rut = normalize_rut(p_rut);
  if not found then
    raise exception 'RUT no registrado como docente';
  end if;
  insert into teacher_logins (auth_uid, teacher_id) values (auth.uid(), t.id)
  on conflict (auth_uid) do update set teacher_id = excluded.teacher_id, created_at = now();
  return t;
end $$;

create or replace function logout_teacher() returns void
language sql security definer set search_path = public as $$
  delete from teacher_logins where auth_uid = auth.uid()
$$;

-- Hora del servidor, para sincronizar el cronómetro entre dispositivos.
create or replace function server_now() returns timestamptz
language sql stable as $$ select now() $$;

-- Control del cronómetro compartido: 'start' | 'pause' | 'reset'
create or replace function timer_action(p_session uuid, p_action text)
returns sessions
language plpgsql security definer set search_path = public as $$
declare
  s sessions;
begin
  if not is_session_guide(p_session) then
    raise exception 'Solo el docente guía puede controlar el cronómetro';
  end if;
  select * into s from sessions where id = p_session for update;
  if p_action = 'start' then
    if not s.timer_running then
      update sessions set timer_running = true, timer_started_at = now(),
        status = case when status = 'programada' then 'en_curso'::session_status else status end
      where id = p_session returning * into s;
    end if;
  elsif p_action = 'pause' then
    if s.timer_running then
      update sessions set timer_running = false,
        timer_accumulated_ms = timer_accumulated_ms
          + (extract(epoch from (now() - timer_started_at)) * 1000)::bigint,
        timer_started_at = null
      where id = p_session returning * into s;
    end if;
  elsif p_action = 'reset' then
    update sessions set timer_running = false, timer_started_at = null, timer_accumulated_ms = 0
    where id = p_session returning * into s;
  else
    raise exception 'Acción de cronómetro desconocida: %', p_action;
  end if;
  return s;
end $$;

-- El evaluador marca (o desmarca) como finalizada su rúbrica ES4 o ES3.
create or replace function set_evaluation_completed(p_session uuid, p_instrument text, p_value boolean)
returns session_evaluators
language plpgsql security definer set search_path = public as $$
declare
  e session_evaluators;
begin
  if p_instrument not in ('ES4', 'ES3') then
    raise exception 'Instrumento inválido';
  end if;
  update session_evaluators set
    completed_es4 = case when p_instrument = 'ES4' then p_value else completed_es4 end,
    completed_es3 = case when p_instrument = 'ES3' then p_value else completed_es3 end
  where session_id = p_session and teacher_id = current_teacher_id()
  returning * into e;
  if not found then
    raise exception 'No integra la comisión de esta sesión';
  end if;
  return e;
end $$;

grant execute on function login_with_rut(text), logout_teacher(), server_now(),
  timer_action(uuid, text), set_evaluation_completed(uuid, text, boolean),
  current_teacher_id(), is_admin(), is_session_member(uuid), is_session_guide(uuid),
  normalize_rut(text), is_valid_rut(text)
  to authenticated;

-- ---------------------------------------------------------------------
-- Vista de resultados consolidados (promedio de puntos y nivel modal)
-- ---------------------------------------------------------------------
create or replace view v_item_results with (security_invoker = true) as
select
  e.session_id,
  c.instrument_code,
  e.student_id,
  e.item_id,
  count(*)                          as evaluations_count,
  round(avg(l.points), 2)           as avg_points,
  mode() within group (order by e.level desc) as modal_level
from evaluations e
join rubric_items i      on i.id = e.item_id
join rubric_criteria c   on c.id = i.criterion_id
join rubric_item_levels l on l.item_id = e.item_id and l.level = e.level
group by e.session_id, c.instrument_code, e.student_id, e.item_id;

-- ---------------------------------------------------------------------
-- Privilegios de tabla (los proyectos nuevos de Supabase no los otorgan
-- por defecto). El acceso real de cada fila lo limitan las políticas RLS.
-- ---------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select on instruments, rubric_criteria, rubric_items, teacher_logins, v_item_results to authenticated;
grant select, update on rubric_item_levels to authenticated;
grant select, insert, update, delete on teachers, sessions, students, session_evaluators, evaluations to authenticated;
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table teachers           enable row level security;
alter table teacher_logins     enable row level security;
alter table instruments        enable row level security;
alter table rubric_criteria    enable row level security;
alter table rubric_items       enable row level security;
alter table rubric_item_levels enable row level security;
alter table sessions           enable row level security;
alter table students           enable row level security;
alter table session_evaluators enable row level security;
alter table evaluations        enable row level security;

-- Docentes: visibles para docentes identificados; alta por cualquier docente; edición solo admin.
drop policy if exists teachers_select on teachers;
create policy teachers_select on teachers for select to authenticated
  using (current_teacher_id() is not null);
drop policy if exists teachers_insert on teachers;
create policy teachers_insert on teachers for insert to authenticated
  with check (current_teacher_id() is not null and (is_admin() or is_admin = false));
drop policy if exists teachers_update on teachers;
create policy teachers_update on teachers for update to authenticated
  using (is_admin()) with check (is_admin());
drop policy if exists teachers_delete on teachers;
create policy teachers_delete on teachers for delete to authenticated
  using (is_admin());

drop policy if exists teacher_logins_select on teacher_logins;
create policy teacher_logins_select on teacher_logins for select to authenticated
  using (auth_uid = auth.uid());

-- Rúbricas: lectura para todos los autenticados; edición de puntajes solo admin.
drop policy if exists instruments_select on instruments;
create policy instruments_select on instruments for select to authenticated using (true);
drop policy if exists criteria_select on rubric_criteria;
create policy criteria_select on rubric_criteria for select to authenticated using (true);
drop policy if exists items_select on rubric_items;
create policy items_select on rubric_items for select to authenticated using (true);
drop policy if exists levels_select on rubric_item_levels;
create policy levels_select on rubric_item_levels for select to authenticated using (true);
drop policy if exists levels_update on rubric_item_levels;
create policy levels_update on rubric_item_levels for update to authenticated
  using (is_admin()) with check (is_admin());

-- Sesiones
drop policy if exists sessions_select on sessions;
create policy sessions_select on sessions for select to authenticated
  using (is_admin() or is_session_member(id));
drop policy if exists sessions_insert on sessions;
create policy sessions_insert on sessions for insert to authenticated
  with check (created_by = current_teacher_id());
drop policy if exists sessions_update on sessions;
create policy sessions_update on sessions for update to authenticated
  using (is_session_guide(id)) with check (is_session_guide(id));
drop policy if exists sessions_delete on sessions;
create policy sessions_delete on sessions for delete to authenticated
  using (is_session_guide(id));

-- Estudiantes
drop policy if exists students_select on students;
create policy students_select on students for select to authenticated
  using (is_admin() or is_session_member(session_id));
drop policy if exists students_write on students;
create policy students_write on students for all to authenticated
  using (is_session_guide(session_id)) with check (is_session_guide(session_id));

-- Comisión
drop policy if exists evaluators_select on session_evaluators;
create policy evaluators_select on session_evaluators for select to authenticated
  using (is_admin() or is_session_member(session_id));
drop policy if exists evaluators_write on session_evaluators;
create policy evaluators_write on session_evaluators for all to authenticated
  using (is_session_guide(session_id)) with check (is_session_guide(session_id));

-- Evaluaciones: cada evaluador ve y escribe las suyas; el docente guía ve todas;
-- el resto de la comisión ve todas una vez finalizada la sesión.
drop policy if exists evaluations_select on evaluations;
create policy evaluations_select on evaluations for select to authenticated
  using (
    is_session_guide(session_id)
    or exists (select 1 from session_evaluators se
               where se.id = evaluator_id and se.teacher_id = current_teacher_id())
    or (is_session_member(session_id)
        and exists (select 1 from sessions s where s.id = session_id and s.status = 'finalizada'))
  );

drop policy if exists evaluations_write on evaluations;
create policy evaluations_write on evaluations for all to authenticated
  using (
    exists (select 1 from session_evaluators se
            where se.id = evaluator_id and se.teacher_id = current_teacher_id())
    and exists (select 1 from sessions s where s.id = session_id and s.status <> 'finalizada')
  )
  with check (
    exists (select 1 from session_evaluators se
            where se.id = evaluator_id and se.teacher_id = current_teacher_id())
    and exists (select 1 from sessions s where s.id = session_id and s.status <> 'finalizada')
  );

-- ---------------------------------------------------------------------
-- Realtime (cronómetro y avance de la comisión)
-- ---------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table sessions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table session_evaluators;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table evaluations;
exception when duplicate_object then null; end $$;
