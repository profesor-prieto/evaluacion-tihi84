import type { Session } from '../types'

export const DEFENSE_MS = 12 * 60_000
export const DEMO_MS = 8 * 60_000
export const TOTAL_MS = DEFENSE_MS + DEMO_MS

type TimerState = Pick<Session, 'timer_running' | 'timer_started_at' | 'timer_accumulated_ms'>

/** Tiempo transcurrido según el estado guardado y la hora del servidor estimada. */
export function elapsedMs(state: TimerState, serverNowMs: number): number {
  const acc = Number(state.timer_accumulated_ms) || 0
  if (!state.timer_running || !state.timer_started_at) return acc
  return acc + Math.max(0, serverNowMs - Date.parse(state.timer_started_at))
}

export function formatDuration(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export type TimerPhase = 'defensa' | 'demostracion' | 'excedido'

export function timerPhase(ms: number): TimerPhase {
  if (ms < DEFENSE_MS) return 'defensa'
  if (ms < TOTAL_MS) return 'demostracion'
  return 'excedido'
}

export const PHASE_LABEL: Record<TimerPhase, string> = {
  defensa: 'Defensa teórica (sugerido hasta 12 min)',
  demostracion: 'Demostración práctica (sugerido hasta 8 min)',
  excedido: 'Tiempo referencial de 20 min excedido',
}
