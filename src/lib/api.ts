import type {
  Evaluation, Instrument, InstrumentCode, Level, RubricCriterion, RubricItem,
  Session, SessionEvaluator, Student, Teacher,
} from '../types'
import { supabase } from './supabase'

function check<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

/** Carga ES4 y ES3 con criterios, indicadores y puntajes por nivel. */
export async function fetchInstruments(): Promise<Instrument[]> {
  const [ins, crit, items, levels] = await Promise.all([
    supabase.from('instruments').select('*').order('sort'),
    supabase.from('rubric_criteria').select('*').order('sort'),
    supabase.from('rubric_items').select('*').order('sort'),
    supabase.from('rubric_item_levels').select('*'),
  ])
  const lv = check(levels) as { item_id: string; level: Level; points: number }[]
  const pointsByItem = new Map<string, Record<Level, number>>()
  for (const l of lv) {
    const p = pointsByItem.get(l.item_id) ?? { excelente: 0, bueno: 0, insatisfactorio: 0 }
    p[l.level] = Number(l.points)
    pointsByItem.set(l.item_id, p)
  }
  const itemRows = check(items) as Omit<RubricItem, 'points'>[]
  const critRows = check(crit) as Omit<RubricCriterion, 'items'>[]
  return (check(ins) as Omit<Instrument, 'criteria'>[]).map((i) => ({
    ...i,
    weight: Number(i.weight),
    criteria: critRows
      .filter((c) => c.instrument_code === i.code)
      .map((c) => ({
        ...c,
        items: itemRows
          .filter((it) => it.criterion_id === c.id)
          .map((it) => ({
            ...it,
            weight: Number(it.weight),
            points: pointsByItem.get(it.id) ?? { excelente: 0, bueno: 0, insatisfactorio: 0 },
          })),
      })),
  }))
}

export async function updateLevelPoints(itemId: string, level: Level, points: number) {
  check(await supabase.from('rubric_item_levels').update({ points }).eq('item_id', itemId).eq('level', level).select())
}

export async function fetchTeachers(): Promise<Teacher[]> {
  return check(await supabase.from('teachers').select('*').order('full_name'))
}

export async function createTeacher(t: Pick<Teacher, 'rut' | 'full_name'> & Partial<Teacher>): Promise<Teacher> {
  return check(await supabase.from('teachers').insert(t).select().single())
}

export async function updateTeacher(id: string, patch: Partial<Teacher>) {
  check(await supabase.from('teachers').update(patch).eq('id', id).select())
}

export async function deleteTeacher(id: string) {
  check(await supabase.from('teachers').delete().eq('id', id))
}

export async function fetchSessions(): Promise<Session[]> {
  return check(await supabase.from('sessions').select('*').order('presented_at'))
}

export interface SessionBundle {
  session: Session
  students: Student[]
  evaluators: SessionEvaluator[]
}

export async function fetchSessionBundle(id: string): Promise<SessionBundle> {
  const [s, st, ev] = await Promise.all([
    supabase.from('sessions').select('*').eq('id', id).single(),
    supabase.from('students').select('*').eq('session_id', id).order('sort'),
    supabase.from('session_evaluators').select('*, teacher:teachers(*)').eq('session_id', id),
  ])
  const roleOrder = { guia: 0, director: 1, acompanante: 2 }
  const evaluators = (check(ev) as SessionEvaluator[]).sort(
    (a, b) => roleOrder[a.role] - roleOrder[b.role] || (a.teacher?.full_name ?? '').localeCompare(b.teacher?.full_name ?? ''),
  )
  return { session: check(s), students: check(st), evaluators }
}

export async function fetchEvaluations(sessionId: string): Promise<Evaluation[]> {
  return check(await supabase.from('evaluations').select('*').eq('session_id', sessionId))
}

export async function upsertEvaluation(e: Evaluation): Promise<Evaluation> {
  return check(
    await supabase
      .from('evaluations')
      .upsert({ ...e, updated_at: new Date().toISOString() }, { onConflict: 'evaluator_id,student_id,item_id' })
      .select()
      .single(),
  )
}

export async function deleteEvaluation(evaluatorId: string, studentId: string, itemId: string) {
  check(
    await supabase.from('evaluations').delete()
      .eq('evaluator_id', evaluatorId).eq('student_id', studentId).eq('item_id', itemId),
  )
}

export async function setCompleted(sessionId: string, instrument: InstrumentCode, value: boolean) {
  check(await supabase.rpc('set_evaluation_completed', { p_session: sessionId, p_instrument: instrument, p_value: value }))
}

export async function timerAction(sessionId: string, action: 'start' | 'pause' | 'reset'): Promise<Session> {
  return check(await supabase.rpc('timer_action', { p_session: sessionId, p_action: action }))
}

export async function updateSession(id: string, patch: Partial<Session>) {
  check(await supabase.from('sessions').update(patch).eq('id', id).select())
}

/** Diferencia (ms) entre el reloj del servidor y el local: serverNow ≈ Date.now() + offset. */
export async function fetchClockOffset(): Promise<number> {
  const t0 = Date.now()
  const { data, error } = await supabase.rpc('server_now')
  const t1 = Date.now()
  if (error || !data) return 0
  return Date.parse(data as string) - (t0 + t1) / 2
}

export interface SessionDraft {
  project_name: string
  presented_at: string
  director_name: string
  students: { id?: string; full_name: string }[]
  evaluators: { id?: string; teacher_id: string; role: SessionEvaluator['role'] }[]
}

/** Crea o actualiza una sesión con sus integrantes y comisión. */
export async function saveSession(draft: SessionDraft, createdBy: string, id?: string): Promise<string> {
  const base = {
    project_name: draft.project_name.trim(),
    presented_at: new Date(draft.presented_at).toISOString(),
    director_name: draft.director_name.trim(),
  }
  let sessionId = id
  if (sessionId) {
    check(await supabase.from('sessions').update(base).eq('id', sessionId).select())
  } else {
    const s = check(await supabase.from('sessions').insert({ ...base, created_by: createdBy }).select().single()) as Session
    sessionId = s.id
  }

  // Integrantes
  const current = check(await supabase.from('students').select('id').eq('session_id', sessionId)) as { id: string }[]
  const keepStudents = new Set(draft.students.filter((s) => s.id).map((s) => s.id))
  const removeStudents = current.filter((s) => !keepStudents.has(s.id)).map((s) => s.id)
  if (removeStudents.length) check(await supabase.from('students').delete().in('id', removeStudents))
  const studentRows = draft.students
    .map((s, i) => ({ ...(s.id ? { id: s.id } : {}), session_id: sessionId, full_name: s.full_name.trim(), sort: i + 1 }))
    .filter((s) => s.full_name)
  const existingS = studentRows.filter((s) => 'id' in s)
  const newS = studentRows.filter((s) => !('id' in s))
  if (existingS.length) check(await supabase.from('students').upsert(existingS).select())
  if (newS.length) check(await supabase.from('students').insert(newS).select())

  // Comisión
  const currentE = check(await supabase.from('session_evaluators').select('id, teacher_id').eq('session_id', sessionId)) as
    { id: string; teacher_id: string }[]
  const wanted = new Map(draft.evaluators.map((e) => [e.teacher_id, e.role]))
  const removeE = currentE.filter((e) => !wanted.has(e.teacher_id)).map((e) => e.id)
  // Primero se agregan/actualizan (así quien edita no pierde su rol de guía a mitad de la operación).
  for (const [teacher_id, role] of wanted) {
    const existing = currentE.find((e) => e.teacher_id === teacher_id)
    if (existing) check(await supabase.from('session_evaluators').update({ role }).eq('id', existing.id).select())
    else check(await supabase.from('session_evaluators').insert({ session_id: sessionId, teacher_id, role }).select())
  }
  if (removeE.length) check(await supabase.from('session_evaluators').delete().in('id', removeE))

  return sessionId!
}

export async function deleteSession(id: string) {
  check(await supabase.from('sessions').delete().eq('id', id))
}
