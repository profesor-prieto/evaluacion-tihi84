import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ErrorBox, Spinner } from '../components/Layout'
import { TeacherQuickAdd } from '../components/TeacherQuickAdd'
import { deleteSession, fetchSessionBundle, fetchTeachers, saveSession, type SessionDraft } from '../lib/api'
import { useAuth } from '../lib/auth'
import { toLocalInput } from '../lib/format'
import { formatRut } from '../lib/rut'
import { errorMessage } from '../lib/supabase'
import { ROLE_LABEL, type EvaluatorRole, type Teacher } from '../types'

function emptyDraft(teacherId: string): SessionDraft {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  return {
    project_name: '',
    presented_at: toLocalInput(d),
    director_name: '',
    students: [{ full_name: '' }, { full_name: '' }, { full_name: '' }],
    evaluators: [{ teacher_id: teacherId, role: 'guia' }],
  }
}

export function SessionFormPage() {
  const { id } = useParams()
  const { teacher } = useAuth()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<SessionDraft | null>(id ? null : emptyDraft(teacher!.id))
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetchTeachers().then(setTeachers).catch((e) => setError(errorMessage(e)))
    if (id) {
      fetchSessionBundle(id)
        .then(({ session, students, evaluators }) =>
          setDraft({
            project_name: session.project_name,
            presented_at: toLocalInput(session.presented_at),
            director_name: session.director_name,
            students: students.map((s) => ({ id: s.id, full_name: s.full_name })),
            evaluators: evaluators.map((e) => ({ id: e.id, teacher_id: e.teacher_id, role: e.role })),
          }),
        )
        .catch((e) => setError(errorMessage(e)))
    }
  }, [id])

  if (!draft) return error ? <ErrorBox message={error} /> : <Spinner />

  const set = (patch: Partial<SessionDraft>) => setDraft({ ...draft, ...patch })
  const usedTeachers = new Set(draft.evaluators.map((e) => e.teacher_id))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft) return
    const students = draft.students.filter((s) => s.full_name.trim())
    if (!draft.project_name.trim()) return setError('Ingrese el nombre del proyecto')
    if (students.length === 0) return setError('Agregue al menos un integrante')
    if (draft.evaluators.length === 0 || draft.evaluators.some((x) => !x.teacher_id)) return setError('Complete la comisión evaluadora')
    if (!draft.evaluators.some((x) => x.role === 'guia')) return setError('La comisión debe incluir un Docente Guía')
    setBusy(true)
    setError(null)
    try {
      const sid = await saveSession({ ...draft, students }, teacher!.id, id)
      navigate(`/sessions/${sid}`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!id || !confirm('¿Eliminar esta sesión y todas sus evaluaciones? Esta acción no se puede deshacer.')) return
    try {
      await deleteSession(id)
      navigate('/')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
      <h1 className="text-2xl font-semibold">{id ? 'Editar sesión de evaluación' : 'Nueva sesión de evaluación'}</h1>

      <section className="card grid gap-4 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="label">Nombre del Proyecto de Título</span>
          <input className="input" value={draft.project_name} onChange={(e) => set({ project_name: e.target.value })} required />
        </label>
        <label>
          <span className="label">Fecha y hora de exposición</span>
          <input type="datetime-local" className="input" value={draft.presented_at} onChange={(e) => set({ presented_at: e.target.value })} required />
        </label>
        <label>
          <span className="label">Director de Carrera</span>
          <input className="input" value={draft.director_name} onChange={(e) => set({ director_name: e.target.value })} />
        </label>
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Integrantes del equipo</h2>
          <button type="button" className="btn-secondary" onClick={() => set({ students: [...draft.students, { full_name: '' }] })}>+ Agregar integrante</button>
        </div>
        {draft.students.map((s, i) => (
          <div key={s.id ?? `n${i}`} className="flex gap-2">
            <span className="w-6 pt-2 text-right text-sm text-slate-500">{i + 1}.</span>
            <input
              className="input flex-1"
              placeholder="Nombre completo del estudiante"
              value={s.full_name}
              onChange={(e) => set({ students: draft.students.map((x, j) => (j === i ? { ...x, full_name: e.target.value } : x)) })}
            />
            <button
              type="button"
              className="btn-ghost"
              title="Quitar integrante"
              onClick={() => {
                if (s.id && !confirm('Quitar este integrante borrará sus evaluaciones. ¿Continuar?')) return
                set({ students: draft.students.filter((_, j) => j !== i) })
              }}
            >✕</button>
          </div>
        ))}
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Comisión evaluadora</h2>
          <button type="button" className="btn-secondary" onClick={() => set({ evaluators: [...draft.evaluators, { teacher_id: '', role: 'acompanante' }] })}>+ Agregar evaluador</button>
        </div>
        {draft.evaluators.map((ev, i) => (
          <div key={ev.id ?? `n${i}`} className="flex flex-wrap gap-2">
            <select
              className="input min-w-64 flex-1"
              value={ev.teacher_id}
              onChange={(e) => set({ evaluators: draft.evaluators.map((x, j) => (j === i ? { ...x, teacher_id: e.target.value } : x)) })}
            >
              <option value="">— Seleccione docente —</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id} disabled={usedTeachers.has(t.id) && t.id !== ev.teacher_id}>
                  {t.full_name} ({formatRut(t.rut)})
                </option>
              ))}
            </select>
            <select
              className="input w-56"
              value={ev.role}
              onChange={(e) => set({ evaluators: draft.evaluators.map((x, j) => (j === i ? { ...x, role: e.target.value as EvaluatorRole } : x)) })}
            >
              {(Object.keys(ROLE_LABEL) as EvaluatorRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            <button type="button" className="btn-ghost" title="Quitar evaluador" onClick={() => set({ evaluators: draft.evaluators.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
        <TeacherQuickAdd onCreated={(t) => setTeachers((list) => [...list, t].sort((a, b) => a.full_name.localeCompare(b.full_name)))} />
      </section>

      <ErrorBox message={error} />
      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar sesión'}</button>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancelar</button>
        </div>
        {id && <button type="button" className="btn-danger" onClick={() => void onDelete()}>Eliminar sesión</button>}
      </div>
    </form>
  )
}
