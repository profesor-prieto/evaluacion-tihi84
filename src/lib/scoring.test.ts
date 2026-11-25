import { describe, expect, it } from 'vitest'
import type { Evaluation, Instrument, Level, SessionEvaluator, Student } from '../types'
import { buildInstrumentResults, evaluatorProgress, modalLevel } from './scoring'

const pts = (e: number, b: number, i: number): Record<Level, number> => ({ excelente: e, bueno: b, insatisfactorio: i })

const es3: Instrument = {
  code: 'ES3',
  name: 'Demostración',
  weight: 25,
  sort: 2,
  criteria: [
    {
      id: 'c1', instrument_code: 'ES3', code: '3.1.1', description: '', sort: 1,
      items: [
        { id: 'i1', criterion_id: 'c1', number: 1, description: '', weight: 15, sort: 1, points: pts(15, 9, 0) },
        { id: 'i2', criterion_id: 'c1', number: 2, description: '', weight: 20, sort: 2, points: pts(20, 12, 2) },
      ],
    },
  ],
}
const es4: Instrument = {
  ...es3, code: 'ES4',
  criteria: [{ id: 'c9', instrument_code: 'ES4', code: '3.1.3', description: '', sort: 1,
    items: [{ id: 'x1', criterion_id: 'c9', number: 1, description: '', weight: 10, sort: 1, points: pts(10, 5, 0) }] }],
}
const students: Student[] = [
  { id: 's1', session_id: 'S', full_name: 'Ana', sort: 1 },
  { id: 's2', session_id: 'S', full_name: 'Beto', sort: 2 },
]
const evaluators: SessionEvaluator[] = ['e1', 'e2', 'e3'].map((id) => ({
  id, session_id: 'S', teacher_id: id, role: 'acompanante', completed_es3: false, completed_es4: false,
}))
const ev = (evaluator_id: string, student_id: string, item_id: string, level: Level, comment: string | null = null): Evaluation =>
  ({ session_id: 'S', evaluator_id, student_id, item_id, level, comment })

describe('modalLevel', () => {
  it('elige el más frecuente y en empate el más bajo', () => {
    expect(modalLevel([])).toBeNull()
    expect(modalLevel(['excelente', 'excelente', 'bueno'])).toBe('excelente')
    expect(modalLevel(['excelente', 'bueno'])).toBe('bueno')
    expect(modalLevel(['excelente', 'bueno', 'insatisfactorio'])).toBe('insatisfactorio')
  })
})

describe('buildInstrumentResults', () => {
  const evaluations: Evaluation[] = [
    ev('e1', 's1', 'i1', 'excelente'), ev('e2', 's1', 'i1', 'bueno'), ev('e3', 's1', 'i1', 'excelente', ' Muy bien '),
    ev('e1', 's1', 'i2', 'insatisfactorio'), ev('e2', 's1', 'i2', 'bueno'),
    // Valoración de ES4 que NO debe mezclarse en ES3
    ev('e1', 's1', 'x1', 'excelente'),
    ev('e1', 's2', 'i1', 'bueno'),
  ]
  const [ana, beto] = buildInstrumentResults(es3, students, evaluators, evaluations)

  it('promedia puntos por indicador entre quienes valoraron', () => {
    const [i1, i2] = ana.criteria[0].items
    expect(i1.avgPoints).toBe(13) // (15 + 9 + 15) / 3
    expect(i1.modalLevel).toBe('excelente')
    expect(i1.comments).toEqual([{ evaluatorId: 'e3', comment: 'Muy bien' }])
    expect(i2.avgPoints).toBe(7) // (2 + 12) / 2
    expect(i2.count).toBe(2)
    expect(i2.levels.e3).toBeUndefined()
  })
  it('calcula totales y máximo por estudiante', () => {
    expect(ana.total).toBe(20)
    expect(ana.maxTotal).toBe(35)
    expect(ana.answered).toBe(2)
    expect(ana.evaluatorTotals).toEqual({ e1: 17, e2: 21, e3: null })
  })
  it('evalúa a cada estudiante por separado', () => {
    expect(beto.total).toBe(9)
    expect(beto.answered).toBe(1)
    expect(beto.criteria[0].items[1].avgPoints).toBeNull()
  })
  it('no mezcla instrumentos', () => {
    const [anaEs4] = buildInstrumentResults(es4, students, evaluators, evaluations)
    expect(anaEs4.total).toBe(10)
    expect(anaEs4.criteria[0].items[0].count).toBe(1)
  })
  it('mide el avance por evaluador e instrumento', () => {
    expect(evaluatorProgress(es3, students, 'e1', evaluations)).toEqual({ done: 3, required: 4 })
    expect(evaluatorProgress(es4, students, 'e1', evaluations)).toEqual({ done: 1, required: 2 })
  })
})
