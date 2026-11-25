import { describe, expect, it } from 'vitest'
import type { Session } from '../types'
import { sortByProximity } from './suggest'

const mk = (id: string, iso: string, status: Session['status'] = 'programada'): Session => ({
  id, project_name: id, presented_at: iso, director_name: '', created_by: 'x', status,
  timer_running: false, timer_started_at: null, timer_accumulated_ms: 0,
})

describe('sortByProximity', () => {
  const now = Date.parse('2026-11-25T15:10:00Z')
  it('sugiere la más cercana a la hora actual', () => {
    const r = sortByProximity([mk('a', '2026-11-25T09:00:00Z'), mk('b', '2026-11-25T15:30:00Z'), mk('c', '2026-11-25T14:30:00Z')], now)
    expect(r.sorted.map((s) => s.id)).toEqual(['b', 'c', 'a'])
    expect(r.suggested?.id).toBe('b')
  })
  it('omite finalizadas y prioriza la que está en curso', () => {
    const r = sortByProximity([mk('a', '2026-11-25T15:00:00Z', 'finalizada'), mk('b', '2026-11-25T16:00:00Z'), mk('c', '2026-11-25T13:00:00Z', 'en_curso')], now)
    expect(r.suggested?.id).toBe('c')
    expect(sortByProximity([mk('a', '2026-11-25T15:00:00Z', 'finalizada')], now).suggested).toBeNull()
  })
})
