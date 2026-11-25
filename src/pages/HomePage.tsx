import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ErrorBox, Spinner } from '../components/Layout'
import { fetchSessions } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatDateTime, formatDateTimeShort } from '../lib/format'
import { sortByProximity } from '../lib/suggest'
import { errorMessage } from '../lib/supabase'
import { STATUS_LABEL, type Session } from '../types'

export function HomePage() {
  const { teacher } = useAuth()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSessions().then(setSessions).catch((e) => setError(errorMessage(e)))
  }, [])

  const { sorted, suggested } = useMemo(() => sortByProximity(sessions ?? [], Date.now()), [sessions])

  if (!sessions && !error) return <Spinner />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Proyectos a evaluar</h1>
          <p className="text-sm text-slate-600">Hola, {teacher?.full_name}. Seleccione el proyecto que va a evaluar.</p>
        </div>
        <Link to="/sessions/new" className="btn-primary">+ Nueva sesión de evaluación</Link>
      </div>
      <ErrorBox message={error} />

      {suggested && (
        <section className="card border-red-200 ring-2 ring-red-700/20">
          <div className="text-xs font-semibold uppercase tracking-wide text-red-700">Sugerido según fecha y hora actual</div>
          <h2 className="mt-1 text-xl font-semibold">{suggested.project_name}</h2>
          <p className="text-sm text-slate-600">{formatDateTime(suggested.presented_at)} · {STATUS_LABEL[suggested.status]}</p>
          <button className="btn-primary mt-4" onClick={() => navigate(`/sessions/${suggested.id}`)}>Ir a evaluar</button>
        </section>
      )}

      <section className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Proyecto</th>
              <th className="px-4 py-2">Fecha y hora</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No integra ninguna comisión todavía.</td></tr>
            )}
            {sorted.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{s.project_name}</td>
                <td className="px-4 py-2">{formatDateTimeShort(s.presented_at)}</td>
                <td className="px-4 py-2"><StatusBadge status={s.status} /></td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <Link className="text-red-700 hover:underline" to={`/sessions/${s.id}`}>Abrir</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

export function StatusBadge({ status }: { status: Session['status'] }) {
  const cls = status === 'en_curso' ? 'bg-amber-100 text-amber-800' : status === 'finalizada' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{STATUS_LABEL[status]}</span>
}
