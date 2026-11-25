import type { Evaluation, Instrument, Level, RubricCriterion, RubricItem, SessionEvaluator, Student } from '../types'
import { LEVELS } from '../types'

export interface ItemResult {
  item: RubricItem
  /** Nivel marcado por cada evaluador (clave: evaluator_id). */
  levels: Record<string, Level | undefined>
  comments: { evaluatorId: string; comment: string }[]
  count: number
  /** Promedio de los puntos obtenidos entre los evaluadores que valoraron. */
  avgPoints: number | null
  /** Nivel más frecuente (empate → el nivel más bajo). */
  modalLevel: Level | null
  maxPoints: number
}

export interface CriterionResult {
  criterion: RubricCriterion
  items: ItemResult[]
}

export interface StudentResult {
  student: Student
  criteria: CriterionResult[]
  /** Suma de los promedios por indicador. */
  total: number
  /** Puntaje máximo posible (suma de puntos de "Excelente"). */
  maxTotal: number
  /** Puntaje total de cada evaluador (null si no completó todos los indicadores). */
  evaluatorTotals: Record<string, number | null>
  /** Indicadores valorados por al menos un evaluador / total de indicadores. */
  answered: number
  itemsCount: number
}

export function maxPoints(item: RubricItem): number {
  return Math.max(...LEVELS.map((l) => item.points[l] ?? 0))
}

export function modalLevel(levels: Level[]): Level | null {
  if (levels.length === 0) return null
  const counts = new Map<Level, number>()
  for (const l of levels) counts.set(l, (counts.get(l) ?? 0) + 1)
  let best: Level | null = null
  let bestCount = 0
  // LEVELS va de mayor a menor; con ">=" el empate queda en el nivel más bajo.
  for (const l of LEVELS) {
    const c = counts.get(l) ?? 0
    if (c > 0 && c >= bestCount) {
      best = l
      bestCount = c
    }
  }
  return best
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function instrumentItems(instrument: Instrument): RubricItem[] {
  return instrument.criteria.flatMap((c) => c.items)
}

/** Construye la rúbrica resultante de UN instrumento para cada estudiante. */
export function buildInstrumentResults(
  instrument: Instrument,
  students: Student[],
  evaluators: SessionEvaluator[],
  evaluations: Evaluation[],
): StudentResult[] {
  const itemIds = new Set(instrumentItems(instrument).map((i) => i.id))
  const evaluatorIds = new Set(evaluators.map((e) => e.id))
  const index = new Map<string, Evaluation>()
  for (const ev of evaluations) {
    if (!itemIds.has(ev.item_id) || !evaluatorIds.has(ev.evaluator_id)) continue
    index.set(`${ev.student_id}|${ev.item_id}|${ev.evaluator_id}`, ev)
  }

  return students.map((student) => {
    const evaluatorTotals: Record<string, number | null> = {}
    for (const e of evaluators) evaluatorTotals[e.id] = 0
    let total = 0
    let maxTotal = 0
    let answered = 0
    let itemsCount = 0

    const criteria = instrument.criteria.map((criterion) => ({
      criterion,
      items: criterion.items.map((item): ItemResult => {
        itemsCount++
        const levels: Record<string, Level | undefined> = {}
        const comments: ItemResult['comments'] = []
        const marked: Level[] = []
        let sum = 0
        for (const e of evaluators) {
          const ev = index.get(`${student.id}|${item.id}|${e.id}`)
          levels[e.id] = ev?.level
          if (ev) {
            marked.push(ev.level)
            const pts = item.points[ev.level] ?? 0
            sum += pts
            if (evaluatorTotals[e.id] !== null) evaluatorTotals[e.id] = (evaluatorTotals[e.id] as number) + pts
            if (ev.comment?.trim()) comments.push({ evaluatorId: e.id, comment: ev.comment.trim() })
          } else {
            evaluatorTotals[e.id] = null
          }
        }
        const avgPoints = marked.length ? round2(sum / marked.length) : null
        const mx = maxPoints(item)
        if (avgPoints !== null) {
          total += avgPoints
          answered++
        }
        maxTotal += mx
        return { item, levels, comments, count: marked.length, avgPoints, modalLevel: modalLevel(marked), maxPoints: mx }
      }),
    }))

    for (const id of Object.keys(evaluatorTotals)) {
      const v = evaluatorTotals[id]
      if (v !== null) evaluatorTotals[id] = round2(v)
    }

    return { student, criteria, total: round2(total), maxTotal: round2(maxTotal), evaluatorTotals, answered, itemsCount }
  })
}

/** Avance de un evaluador en un instrumento: valoraciones hechas / requeridas. */
export function evaluatorProgress(
  instrument: Instrument,
  students: Student[],
  evaluatorId: string,
  evaluations: Evaluation[],
): { done: number; required: number } {
  const itemIds = new Set(instrumentItems(instrument).map((i) => i.id))
  const studentIds = new Set(students.map((s) => s.id))
  const done = evaluations.filter(
    (e) => e.evaluator_id === evaluatorId && itemIds.has(e.item_id) && studentIds.has(e.student_id),
  ).length
  return { done, required: itemIds.size * students.length }
}
