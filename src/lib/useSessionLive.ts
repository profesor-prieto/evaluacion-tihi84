import { useCallback, useEffect, useRef, useState } from 'react'
import type { Evaluation, Session, SessionEvaluator } from '../types'
import { fetchClockOffset, fetchEvaluations, fetchSessionBundle, type SessionBundle } from './api'
import { errorMessage, supabase } from './supabase'

/**
 * Carga una sesión (integrantes, comisión, valoraciones visibles) y la mantiene
 * sincronizada con Supabase Realtime: cronómetro, avance y valoraciones.
 */
export function useSessionLive(sessionId: string | undefined) {
  const [bundle, setBundle] = useState<SessionBundle | null>(null)
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [clockOffset, setClockOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const statusRef = useRef<string | undefined>(undefined)
  statusRef.current = bundle?.session.status

  const reload = useCallback(async () => {
    if (!sessionId) return
    try {
      const [b, ev] = await Promise.all([fetchSessionBundle(sessionId), fetchEvaluations(sessionId)])
      setBundle(b)
      setEvaluations(ev)
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [sessionId])

  useEffect(() => {
    void reload()
    void fetchClockOffset().then(setClockOffset)
  }, [reload])

  useEffect(() => {
    if (!sessionId) return
    const channel = supabase
      .channel(`session-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, (p) => {
        if (p.eventType === 'DELETE') return
        const s = p.new as Session
        const statusChanged = statusRef.current !== undefined && statusRef.current !== s.status
        setBundle((b) => (b ? { ...b, session: { ...b.session, ...s } } : b))
        // Al finalizar la sesión cambia qué valoraciones puede ver cada evaluador.
        if (statusChanged) void reload()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_evaluators', filter: `session_id=eq.${sessionId}` }, (p) => {
        if (p.eventType === 'UPDATE') {
          const e = p.new as SessionEvaluator
          setBundle((b) => b && { ...b, evaluators: b.evaluators.map((x) => (x.id === e.id ? { ...x, ...e, teacher: x.teacher } : x)) })
        } else void reload()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'evaluations', filter: `session_id=eq.${sessionId}` }, (p) => {
        if (p.eventType === 'DELETE') {
          const old = p.old as Partial<Evaluation>
          setEvaluations((list) => list.filter((x) => x.id !== old.id))
        } else {
          const e = p.new as Evaluation
          setEvaluations((list) => [...list.filter((x) => x.id !== e.id), e])
        }
      })
      .subscribe()

    // Respaldo: re-sincroniza al volver a la pestaña.
    const onVisible = () => document.visibilityState === 'visible' && void reload()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      void supabase.removeChannel(channel)
    }
  }, [sessionId, reload])

  return { bundle, setBundle, evaluations, setEvaluations, clockOffset, error, reload }
}

/** Reloj que avanza cada `intervalMs`, ajustado a la hora del servidor. */
export function useNow(offset: number, intervalMs = 500): number {
  const [now, setNow] = useState(() => Date.now() + offset)
  useEffect(() => {
    setNow(Date.now() + offset)
    const t = setInterval(() => setNow(Date.now() + offset), intervalMs)
    return () => clearInterval(t)
  }, [offset, intervalMs])
  return now
}
