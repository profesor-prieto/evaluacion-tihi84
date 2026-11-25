import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ItemEvaluator } from '../components/ItemEvaluator'
import { ErrorBox, Spinner } from '../components/Layout'
import { SharedTimer } from '../components/SharedTimer'
import { deleteEvaluation, fetchInstruments, setCompleted, timerAction, updateSession, upsertEvaluation } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatDateTime } from '../lib/format'
import { evaluatorProgress } from '../lib/scoring'
import { errorMessage } from '../lib/supabase'
import { useSessionLive } from '../lib/useSessionLive'
import { ROLE_LABEL, type Evaluation, type Instrument, type InstrumentCode, type Level } from '../types'
import { StatusBadge } from './HomePage'

export function SessionPage() {
  const { id } = useParams()
  const { teacher } = useAuth()
  const { bundle, setBundle, evaluations, setEvaluations, clockOffset, error, reload } = useSessionLive(id)
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [tab, setTab] = useState<InstrumentCode>('ES4')
  const [studentId, setStudentId] = useState<string | null>(null)
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    fetchInstruments().then(setInstruments).catch((e) => setActionError(errorMessage(e)))
  }, [])

  useEffect(() => {
    if (bundle && !studentId && bundle.students.length) setStudentId(bundle.students[0].id)
  }, [bundle, studentId])

  const me = bundle?.evaluators.find((e) => e.teacher_id === teacher?.id)
  const isGuide = Boolean(
    teacher && bundle && (teacher.is_admin || bundle.session.created_by === teacher.id || me?.role === 'guia'),
  )
  const instrument = instruments.find((i) => i.code === tab)
  const myEvals = useMemo(() => {
    const m = new Map<string, Evaluation>()
    if (me) for (const e of evaluations) if (e.evaluator_id === me.id) m.set(`${e.student_id}|${e.item_id}`, e)
    return m
  }, [evaluations, me])

  if (error) return <ErrorBox message={error} />
  if (!bundle || instruments.length === 0) return <Spinner />

  const { session, students, evaluators } = bundle
  const finished = session.status === 'finalizada'
  const completedFlag = (code: InstrumentCode) => (code === 'ES4' ? me?.completed_es4 : me?.completed_es3) ?? false
  const locked = finished || completedFlag(tab)
  const canSeeResults = isGuide || (finished && Boolean(me))

  async function setLevel(itemId: string, level: Level | null) {
    if (!me || !studentId) return
    const key = `${studentId}|${itemId}`
    const prev = myEvals.get(key)
    setSaving((s) => new Set(s).add(key))
    setActionError(null)
    try {
      if (level === null) {
        await deleteEvaluation(me.id, studentId, itemId)
        setEvaluations((list) => list.filter((e) => !(e.evaluator_id === me.id && e.student_id === studentId && e.item_id === itemId)))
      } else {
        const saved = await upsertEvaluation({
          session_id: session.id, evaluator_id: me.id, student_id: studentId, item_id: itemId, level, comment: prev?.comment ?? null,
        })
        setEvaluations((list) => [...list.filter((e) => e.id !== saved.id), saved])
      }
    } catch (e) {
      setActionError(errorMessage(e))
    } finally {
      setSaving((s) => { const n = new Set(s); n.delete(key); return n })
    }
  }

  async function setComment(itemId: string, comment: string) {
    if (!me || !studentId) return
    const prev = myEvals.get(`${studentId}|${itemId}`)
    if (!prev) return
    try {
      const saved = await upsertEvaluation({ ...prev, comment: comment.trim() || null })
      setEvaluations((list) => [...list.filter((e) => e.id !== saved.id), saved])
    } catch (e) {
      setActionError(errorMessage(e))
    }
  }

  async function toggleCompleted(code: InstrumentCode, value: boolean) {
    try {
      await setCompleted(session.id, code, value)
      await reload()
    } catch (e) {
      setActionError(errorMessage(e))
    }
  }

  async function setStatus(status: 'finalizada' | 'en_curso') {
    const msg = status === 'finalizada'
      ? '¿Finalizar la sesión? Las evaluaciones quedarán cerradas y la comisión podrá ver las rúbricas resultantes.'
      : '¿Reabrir la sesión para permitir modificar evaluaciones?'
    if (!confirm(msg)) return
    try {
      // Al finalizar se detiene el cronómetro (luego ya no se puede controlar).
      if (status === 'finalizada' && session.timer_running) await timerAction(session.id, 'pause')
      await updateSession(session.id, { status })
      await reload()
    } catch (e) {
      setActionError(errorMessage(e))
    }
  }

  return (
    <div className="space-y-5">
      <section className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{session.project_name}</h1>
            <p className="text-sm text-slate-600">{formatDateTime(session.presented_at)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={session.status} />
            {isGuide && <Link to={`/sessions/${session.id}/edit`} className="btn-secondary">Editar datos</Link>}
          </div>
        </div>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
          <div>
            <dt className="label">Integrantes</dt>
            <dd>{students.map((s) => <div key={s.id}>{s.full_name}</div>)}</dd>
          </div>
          <div>
            <dt className="label">Comisión evaluadora</dt>
            <dd>{evaluators.map((e) => <div key={e.id}>{e.teacher?.full_name} <span className="text-slate-500">· {ROLE_LABEL[e.role]}</span></div>)}</dd>
          </div>
          <div>
            <dt className="label">Director de Carrera</dt>
            <dd>{session.director_name || '—'}</dd>
          </div>
        </dl>
      </section>

      <SharedTimer
        session={session}
        clockOffset={clockOffset}
        canControl={isGuide && !finished}
        onChange={(s) => setBundle((b) => b && { ...b, session: s })}
      />

      <ErrorBox message={actionError} />

      {isGuide && (
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Avance de la comisión</h2>
            <div className="flex flex-wrap gap-2">
              {finished
                ? <button className="btn-secondary" onClick={() => void setStatus('en_curso')}>Reabrir sesión</button>
                : <button className="btn-primary" onClick={() => void setStatus('finalizada')}>Finalizar sesión</button>}
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr><th className="py-1 pr-4">Evaluador</th>{instruments.map((i) => <th key={i.code} className="py-1 pr-4">{i.code} – {i.name}</th>)}</tr>
              </thead>
              <tbody>
                {evaluators.map((ev) => (
                  <tr key={ev.id} className="border-t border-slate-100">
                    <td className="py-2 pr-4">{ev.teacher?.full_name}<div className="text-xs text-slate-500">{ROLE_LABEL[ev.role]}</div></td>
                    {instruments.map((ins) => {
                      const p = evaluatorProgress(ins, students, ev.id, evaluations)
                      const done = ins.code === 'ES4' ? ev.completed_es4 : ev.completed_es3
                      return (
                        <td key={ins.code} className="py-2 pr-4">
                          <ProgressBar done={p.done} required={p.required} />
                          <span className="text-xs text-slate-600">{p.done}/{p.required} {done && <b className="text-green-700">· Finalizada</b>}</span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {canSeeResults && (
        <section className="card flex flex-wrap items-center gap-3">
          <span className="font-semibold">Rúbricas resultantes:</span>
          {instruments.map((i) => (
            <Link key={i.code} to={`/sessions/${session.id}/results/${i.code}`} className="btn-secondary">{i.code} – {i.name}</Link>
          ))}
        </section>
      )}

      {me ? (
        <section className="card space-y-4">
          <div className="flex flex-wrap gap-2 border-b border-slate-200" role="tablist">
            {instruments.map((i) => (
              <button
                key={i.code}
                role="tab"
                aria-selected={tab === i.code}
                onClick={() => setTab(i.code)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === i.code ? 'border-red-700 text-red-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                {i.code} · {i.name} <span className="font-normal text-slate-400">({i.weight}%)</span>
                {completedFlag(i.code) && <span className="ml-1 text-green-700">✓</span>}
              </button>
            ))}
          </div>

          {instrument && (
            <>
              <div className="flex flex-wrap gap-2">
                {students.map((s) => {
                  const total = instrument.criteria.reduce((n, c) => n + c.items.length, 0)
                  const done = instrument.criteria.flatMap((c) => c.items).filter((it) => myEvals.has(`${s.id}|${it.id}`)).length
                  return (
                    <button
                      key={s.id}
                      onClick={() => setStudentId(s.id)}
                      className={`rounded-full border px-3 py-1 text-sm ${studentId === s.id ? 'border-red-700 bg-red-700 text-white' : 'border-slate-300 bg-white hover:bg-slate-50'}`}
                    >
                      {s.full_name} <span className="opacity-75">{done}/{total}</span>
                    </button>
                  )
                })}
              </div>

              {studentId && instrument.criteria.map((c) => (
                <div key={c.id} className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700">Criterio {c.code} <span className="font-normal">{c.description}</span></h3>
                  {c.items.map((it) => {
                    const key = `${studentId}|${it.id}`
                    return (
                      <ItemEvaluator
                        key={key}
                        code={`${c.code}.${it.number}`}
                        item={it}
                        value={myEvals.get(key)}
                        disabled={locked}
                        saving={saving.has(key)}
                        onLevel={(l) => void setLevel(it.id, l)}
                        onComment={(txt) => void setComment(it.id, txt)}
                      />
                    )
                  })}
                </div>
              ))}

              <FinishBar
                code={tab}
                done={evaluatorProgress(instrument, students, me.id, evaluations)}
                completed={completedFlag(tab)}
                finished={finished}
                onToggle={(v) => void toggleCompleted(tab, v)}
              />
            </>
          )}
        </section>
      ) : (
        <p className="card text-sm text-slate-600">Usted no integra la comisión evaluadora de esta sesión; solo puede administrarla.</p>
      )}
    </div>
  )
}

function ProgressBar({ done, required }: { done: number; required: number }) {
  const pct = required ? Math.round((done / required) * 100) : 0
  return (
    <div className="mb-1 h-1.5 w-40 overflow-hidden rounded bg-slate-200">
      <div className={`h-full ${pct === 100 ? 'bg-green-600' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function FinishBar(props: {
  code: InstrumentCode
  done: { done: number; required: number }
  completed: boolean
  finished: boolean
  onToggle: (v: boolean) => void
}) {
  const { code, done, completed, finished, onToggle } = props
  const complete = done.done >= done.required
  if (finished) return <p className="text-sm text-slate-600">La sesión está finalizada; las evaluaciones están cerradas.</p>
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-100 p-3">
      <span className="text-sm">
        {code}: {done.done} de {done.required} valoraciones (todos los integrantes)
        {!complete && !completed && <span className="text-amber-700"> · faltan {done.required - done.done}</span>}
      </span>
      {completed ? (
        <button className="btn-secondary" onClick={() => onToggle(false)}>Reabrir mi {code} para editar</button>
      ) : (
        <button className="btn-primary" disabled={!complete} onClick={() => onToggle(true)}>Finalizar mi evaluación {code}</button>
      )}
    </div>
  )
}
