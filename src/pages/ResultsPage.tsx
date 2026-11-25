import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ErrorBox, Spinner } from '../components/Layout'
import { fetchInstruments } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatDateTime, formatPoints } from '../lib/format'
import { buildInstrumentResults } from '../lib/scoring'
import { errorMessage } from '../lib/supabase'
import { useSessionLive } from '../lib/useSessionLive'
import { LEVEL_LABEL, ROLE_LABEL, type Instrument, type Level } from '../types'

const LEVEL_CELL: Record<Level, string> = {
  excelente: 'bg-green-50 text-green-800',
  bueno: 'bg-amber-50 text-amber-800',
  insatisfactorio: 'bg-red-50 text-red-800',
}

/** Rúbrica resultante de UN instrumento (ES4 o ES3), sin mezclar con el otro. */
export function ResultsPage() {
  const { id, code } = useParams()
  const { teacher } = useAuth()
  const { bundle, evaluations, error } = useSessionLive(id)
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    fetchInstruments().then(setInstruments).catch((e) => setLoadError(errorMessage(e)))
  }, [])

  const instrument = instruments.find((i) => i.code === code)
  const results = useMemo(
    () => (instrument && bundle ? buildInstrumentResults(instrument, bundle.students, bundle.evaluators, evaluations) : []),
    [instrument, bundle, evaluations],
  )

  if (error || loadError) return <ErrorBox message={error ?? loadError} />
  if (!bundle || instruments.length === 0) return <Spinner />
  if (!instrument) return <ErrorBox message="Instrumento no encontrado" />

  const { session, evaluators } = bundle
  const guide = evaluators.find((e) => e.role === 'guia')
  const companions = evaluators.filter((e) => e.role === 'acompanante')
  const other = instruments.find((i) => i.code !== instrument.code)
  const isGuide = teacher && (teacher.is_admin || session.created_by === teacher.id || guide?.teacher_id === teacher.id)
  const evalName = (eid: string) => evaluators.find((e) => e.id === eid)?.teacher?.full_name ?? '—'

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link to={`/sessions/${session.id}`} className="text-sm text-red-700 hover:underline">← Volver a la sesión</Link>
        <div className="flex gap-2">
          {other && <Link to={`/sessions/${session.id}/results/${other.code}`} className="btn-secondary">Ver {other.code}</Link>}
          <button className="btn-primary" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
        </div>
      </div>
      {session.status !== 'finalizada' && (
        <p className="no-print rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Resultados preliminares: la sesión aún no está finalizada{isGuide ? ' y se actualizan en tiempo real' : ''}.
        </p>
      )}

      <section className="print-sheet card">
        <header className="border-b border-slate-200 pb-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Proyecto de Título (TIHI84) · Ingeniería en Informática · Unidad 3: Defensa del Proyecto
          </div>
          <h1 className="mt-1 text-xl font-bold">
            Rúbrica resultante {instrument.code} – {instrument.name} <span className="font-normal text-slate-500">(ponderación {instrument.weight}%)</span>
          </h1>
        </header>
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <Info label="Proyecto" value={session.project_name} />
          <Info label="Fecha y hora" value={formatDateTime(session.presented_at)} />
          <Info label="Integrantes" value={bundle.students.map((s) => s.full_name).join(', ')} />
          <Info label="Director de Carrera" value={session.director_name || '—'} />
          <Info label="Docente Guía" value={guide?.teacher?.full_name ?? '—'} />
          <Info label="Docente(s) acompañante(s)" value={companions.map((e) => e.teacher?.full_name).join(', ') || '—'} />
        </dl>
        <p className="mt-2 text-xs text-slate-500">
          Escala: Excelente · Bueno · Insatisfactorio. El consolidado por indicador es el promedio de los puntos asignados por
          los evaluadores que valoraron; se indica además el nivel más frecuente. Sin conversión a nota.
        </p>
      </section>

      {results.map((r, idx) => (
        <section key={r.student.id} className={`print-sheet card ${idx > 0 ? 'print-break' : ''}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">{r.student.full_name}</h2>
            <span className="text-sm">
              {instrument.code} · Puntaje consolidado: <b className="text-lg">{formatPoints(r.total)}</b> / {formatPoints(r.maxTotal)}
              {r.answered < r.itemsCount && <span className="ml-2 text-amber-700">({r.itemsCount - r.answered} indicador(es) sin valorar)</span>}
            </span>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="results-table w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="min-w-72 p-2">Indicador</th>
                  <th className="p-2 text-center">Pond.</th>
                  {evaluators.map((e) => (
                    <th key={e.id} className="min-w-28 p-2 text-center">
                      {e.teacher?.full_name}
                      <div className="text-[10px] font-normal text-slate-500">{ROLE_LABEL[e.role]}</div>
                    </th>
                  ))}
                  <th className="p-2 text-center">Nivel más frecuente</th>
                  <th className="p-2 text-center">Puntos (prom.)</th>
                </tr>
              </thead>
              <tbody>
                {r.criteria.map((c) => [
                  <tr key={c.criterion.id} className="bg-slate-50">
                    <td colSpan={4 + evaluators.length} className="p-2 text-xs font-semibold">
                      Criterio {c.criterion.code}. <span className="font-normal">{c.criterion.description}</span>
                    </td>
                  </tr>,
                  ...c.items.map((it) => (
                    <tr key={it.item.id} className="border-t border-slate-200 align-top">
                      <td className="p-2">
                        <span className="font-mono text-xs font-semibold">{c.criterion.code}.{it.item.number}</span> {it.item.description}
                      </td>
                      <td className="p-2 text-center">{formatPoints(it.item.weight)}</td>
                      {evaluators.map((e) => {
                        const l = it.levels[e.id]
                        return (
                          <td key={e.id} className={`p-2 text-center ${l ? LEVEL_CELL[l] : 'text-slate-400'}`}>
                            {l ? <>{LEVEL_LABEL[l]}<div className="text-[10px]">{formatPoints(it.item.points[l])} pts</div></> : '—'}
                          </td>
                        )
                      })}
                      <td className={`p-2 text-center font-medium ${it.modalLevel ? LEVEL_CELL[it.modalLevel] : ''}`}>
                        {it.modalLevel ? LEVEL_LABEL[it.modalLevel] : '—'}
                      </td>
                      <td className="p-2 text-center font-semibold">{formatPoints(it.avgPoints)} <span className="font-normal text-slate-500">/ {formatPoints(it.maxPoints)}</span></td>
                    </tr>
                  )),
                ])}
                <tr className="border-t-2 border-slate-400 bg-slate-100 font-semibold">
                  <td className="p-2">Total {instrument.code}</td>
                  <td className="p-2 text-center">{formatPoints(instrument.criteria.flatMap((c) => c.items).reduce((n, i) => n + i.weight, 0))}</td>
                  {evaluators.map((e) => (
                    <td key={e.id} className="p-2 text-center">
                      {r.evaluatorTotals[e.id] === null ? <span className="font-normal text-slate-400">incompleto</span> : formatPoints(r.evaluatorTotals[e.id])}
                    </td>
                  ))}
                  <td />
                  <td className="p-2 text-center">{formatPoints(r.total)} / {formatPoints(r.maxTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {r.criteria.some((c) => c.items.some((i) => i.comments.length)) && (
            <div className="mt-3 text-sm">
              <h3 className="font-semibold">Observaciones</h3>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {r.criteria.flatMap((c) =>
                  c.items.flatMap((i) =>
                    i.comments.map((cm) => (
                      <li key={`${i.item.id}-${cm.evaluatorId}`}>
                        <span className="font-mono text-xs">{c.criterion.code}.{i.item.number}</span> — <i>{evalName(cm.evaluatorId)}</i>: {cm.comment}
                      </li>
                    )),
                  ),
                )}
              </ul>
            </div>
          )}

          <div className="signatures mt-10 hidden grid-cols-3 gap-6 text-center text-xs print:grid">
            {evaluators.map((e) => (
              <div key={e.id} className="border-t border-slate-500 pt-1">{e.teacher?.full_name}<br />{ROLE_LABEL[e.role]}</div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 font-semibold text-slate-600">{label}:</dt>
      <dd>{value}</dd>
    </div>
  )
}
