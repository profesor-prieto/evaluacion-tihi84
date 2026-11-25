export type Level = 'excelente' | 'bueno' | 'insatisfactorio'
export type InstrumentCode = 'ES4' | 'ES3'
export type EvaluatorRole = 'guia' | 'director' | 'acompanante'
export type SessionStatus = 'programada' | 'en_curso' | 'finalizada'

export const LEVELS: Level[] = ['excelente', 'bueno', 'insatisfactorio']
export const LEVEL_LABEL: Record<Level, string> = {
  excelente: 'Excelente',
  bueno: 'Bueno',
  insatisfactorio: 'Insatisfactorio',
}
export const ROLE_LABEL: Record<EvaluatorRole, string> = {
  guia: 'Docente Guía',
  director: 'Director de Carrera',
  acompanante: 'Docente Acompañante',
}
export const STATUS_LABEL: Record<SessionStatus, string> = {
  programada: 'Programada',
  en_curso: 'En curso',
  finalizada: 'Finalizada',
}

export interface Teacher {
  id: string
  rut: string
  full_name: string
  email: string | null
  is_admin: boolean
}

export interface RubricItem {
  id: string
  criterion_id: string
  number: number
  description: string
  weight: number
  sort: number
  points: Record<Level, number>
}

export interface RubricCriterion {
  id: string
  instrument_code: InstrumentCode
  code: string
  description: string
  sort: number
  items: RubricItem[]
}

export interface Instrument {
  code: InstrumentCode
  name: string
  weight: number
  sort: number
  criteria: RubricCriterion[]
}

export interface Session {
  id: string
  project_name: string
  presented_at: string
  director_name: string
  created_by: string
  status: SessionStatus
  timer_running: boolean
  timer_started_at: string | null
  timer_accumulated_ms: number
}

export interface Student {
  id: string
  session_id: string
  full_name: string
  sort: number
}

export interface SessionEvaluator {
  id: string
  session_id: string
  teacher_id: string
  role: EvaluatorRole
  completed_es4: boolean
  completed_es3: boolean
  teacher?: Teacher
}

export interface Evaluation {
  id?: string
  session_id: string
  evaluator_id: string
  student_id: string
  item_id: string
  level: Level
  comment: string | null
}
