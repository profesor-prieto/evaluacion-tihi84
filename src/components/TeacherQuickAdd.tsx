import { useState } from 'react'
import { createTeacher } from '../lib/api'
import { formatRut, isValidRut, normalizeRut } from '../lib/rut'
import { errorMessage } from '../lib/supabase'
import type { Teacher } from '../types'

/** Alta rápida de un docente (RUT + nombre). */
export function TeacherQuickAdd({ onCreated }: { onCreated: (t: Teacher) => void }) {
  const [rut, setRut] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!isValidRut(rut)) return setError('RUT inválido')
    if (!name.trim()) return setError('Ingrese el nombre')
    setBusy(true)
    setError(null)
    try {
      const t = await createTeacher({ rut: normalizeRut(rut), full_name: name.trim() })
      onCreated(t)
      setRut('')
      setName('')
    } catch (e) {
      const msg = errorMessage(e)
      setError(msg.includes('duplicate') ? 'Ya existe un docente con ese RUT' : msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-md border border-dashed border-slate-300 p-3">
      <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Registrar docente nuevo</div>
      <div className="flex flex-wrap gap-2">
        <input className="input w-40" placeholder="RUT" value={rut} onChange={(e) => setRut(formatRut(e.target.value))} />
        <input className="input min-w-48 flex-1" placeholder="Nombre completo" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => void add()}>Registrar</button>
      </div>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  )
}
