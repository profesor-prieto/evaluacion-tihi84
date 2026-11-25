import { describe, expect, it } from 'vitest'
import { elapsedMs, formatDuration, timerPhase } from './timer'

describe('timer', () => {
  const start = '2026-11-25T15:00:00.000Z'
  it('detenido devuelve lo acumulado', () => {
    expect(elapsedMs({ timer_running: false, timer_started_at: null, timer_accumulated_ms: 5000 }, 0)).toBe(5000)
  })
  it('corriendo suma desde el inicio', () => {
    const now = Date.parse(start) + 90_000
    expect(elapsedMs({ timer_running: true, timer_started_at: start, timer_accumulated_ms: 10_000 }, now)).toBe(100_000)
  })
  it('no retrocede si el reloj del cliente va atrasado', () => {
    expect(elapsedMs({ timer_running: true, timer_started_at: start, timer_accumulated_ms: 0 }, Date.parse(start) - 5000)).toBe(0)
  })
  it('formatea mm:ss', () => {
    expect(formatDuration(0)).toBe('00:00')
    expect(formatDuration(754_999)).toBe('12:34')
    expect(formatDuration(25 * 60_000)).toBe('25:00')
  })
  it('determina la fase', () => {
    expect(timerPhase(11 * 60_000)).toBe('defensa')
    expect(timerPhase(12 * 60_000)).toBe('demostracion')
    expect(timerPhase(20 * 60_000)).toBe('excedido')
  })
})
