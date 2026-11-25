import { useEffect, useState } from 'react'
import { ErrorBox, Spinner } from '../components/Layout'
import { TeacherQuickAdd } from '../components/TeacherQuickAdd'
import { deleteTeacher, fetchTeachers, updateTeacher } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatRut } from '../lib/rut'
import { errorMessage } from '../lib/supabase'
import type { Teacher } from '../types'

export function AdminTeachersPage() {
  const { teacher: me } = useAuth()
  const [list, setList] = useState<Teacher[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => fetchTeachers().then(setList).catch((e) => setError(errorMessage(e)))
  useEffect(() => { void load() }, [])

  async function run(fn: () => Promise<unknown>) {
    setError(null)
    try { await fn(); await load() } catch (e) { setError(errorMessage(e)) }
  }

  if (!list) return error ? <ErrorBox message={error} /> : <Spinner />

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Docentes</h1>
      <p className="text-sm text-slate-600">Los docentes registrados pueden ingresar con su RUT y ser asignados a comisiones evaluadoras.</p>
      <TeacherQuickAdd onCreated={() => void load()} />
      <ErrorBox message={error} />
      <section className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600">
            <tr><th className="px-4 py-2">RUT</th><th className="px-4 py-2">Nombre</th><th className="px-4 py-2">Administrador</th><th /></tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono">{formatRut(t.rut)}</td>
                <td className="px-4 py-2">
                  <input
                    className="input"
                    defaultValue={t.full_name}
                    onBlur={(e) => e.target.value.trim() && e.target.value !== t.full_name && void run(() => updateTeacher(t.id, { full_name: e.target.value.trim() }))}
                  />
                </td>
                <td className="px-4 py-2">
                  <input type="checkbox" checked={t.is_admin} disabled={t.id === me?.id}
                    onChange={(e) => void run(() => updateTeacher(t.id, { is_admin: e.target.checked }))} />
                </td>
                <td className="px-4 py-2 text-right">
                  {t.id !== me?.id && (
                    <button className="btn-ghost text-red-700"
                      onClick={() => confirm(`¿Eliminar a ${t.full_name}?`) && void run(() => deleteTeacher(t.id))}>Eliminar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
