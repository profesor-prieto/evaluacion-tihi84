import { useState } from 'react'
import { timerAction } from '../lib/api'
import { errorMessage } from '../lib/supabase'
import { DEFENSE_MS, TOTAL_MS, PHASE_LABEL, elapsedMs, formatDuration, timerPhase } from '../lib/timer'
import { useNow } from '../lib/useSessionLive'
import type { Session } from '../types'

interface Props {
  session: Session
  clockOffset: number
  canControl: boolean
  onChange?: (s: Session) => void
}

/** Cronómetro de la presentación: lo controla el docente guía y lo ve toda la comisión. */
export function SharedTimer({ session, clockOffset, canControl, onChange }: Props) {
  const now = useNow(clockOffset)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ms = elapsedMs(session, now)
  const phase = timerPhase(ms)
  const pct = Math.min(100, (ms / TOTAL_MS) * 100)
  const started = session.timer_running || session.timer_accumulated_ms > 0

  async function act(a: 'start' | 'pause' | 'reset') {
    if (a === 'reset' && !confirm('¿Reiniciar el cronómetro a 00:00?')) return
    setBusy(true)
    setError(null)
    try {
      onChange?.(await timerAction(session.id, a))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const color = phase === 'excedido' ? 'text-red-700' : phase === 'demostracion' ? 'text-amber-700' : 'text-slate-900'

  return (
    <section className="card no-print sticky top-0 z-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Tiempo de presentación</div>
          <div className={`font-mono text-4xl font-bold tabular-nums ${color}`} aria-live="polite">{formatDuration(ms)}</div>
          <div className="text-sm text-slate-600">
            {!started ? 'Esperando que el docente guía inicie la presentación' : PHASE_LABEL[phase]}
            {started && !session.timer_running && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs">En pausa</span>}
          </div>
        </div>
        {canControl && (
          <div className="flex gap-2">
            {session.timer_running ? (
              <button className="btn-secondary" disabled={busy} onClick={() => void act('pause')}>Pausar</button>
            ) : (
              <button className="btn-primary" disabled={busy} onClick={() => void act('start')}>{started ? 'Reanudar' : 'Iniciar presentación'}</button>
            )}
            {started && <button className="btn-secondary" disabled={busy} onClick={() => void act('reset')}>Reiniciar</button>}
          </div>
        )}
      </div>
      <div className="relative mt-3 h-2 overflow-hidden rounded bg-slate-200">
        <div className={`h-full ${phase === 'excedido' ? 'bg-red-600' : 'bg-red-700/80'}`} style={{ width: `${pct}%` }} />
        <div className="absolute top-0 h-full w-0.5 bg-slate-700" style={{ left: `${(DEFENSE_MS / TOTAL_MS) * 100}%` }} title="12 min" />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-500">
        <span>0</span><span style={{ marginLeft: '50%' }}>12 min</span><span>20 min</span>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  )
}
