import type { Session } from '../types'

/**
 * Ordena las sesiones por cercanía a `now` y devuelve la sugerida:
 * la no finalizada más cercana a la fecha/hora actual (una en curso tiene prioridad).
 */
export function sortByProximity(sessions: Session[], now: number): { sorted: Session[]; suggested: Session | null } {
  const dist = (s: Session) => Math.abs(Date.parse(s.presented_at) - now)
  const sorted = [...sessions].sort((a, b) => dist(a) - dist(b))
  const suggested =
    sorted.find((s) => s.status === 'en_curso') ?? sorted.find((s) => s.status !== 'finalizada') ?? null
  return { sorted, suggested }
}
