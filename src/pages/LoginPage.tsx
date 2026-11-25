import { useState, type FormEvent } from 'react'
import { ErrorBox } from '../components/Layout'
import { useAuth } from '../lib/auth'
import { formatRut, isValidRut } from '../lib/rut'
import { supabaseConfigured } from '../lib/supabase'

export function LoginPage() {
  const { login } = useAuth()
  const [rut, setRut] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const valid = isValidRut(rut)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return setError('Ingrese un RUT válido (ej.: 12.345.678-5)')
    setBusy(true)
    setError(null)
    try {
      await login(rut)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="card">
        <h1 className="text-xl font-semibold">Ingreso de docentes</h1>
        <p className="mt-1 text-sm text-slate-600">Comisión evaluadora · Proyecto de Título TIHI84</p>
        {!supabaseConfigured && (
          <ErrorBox message="Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY." />
        )}
        <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-4">
          <label className="block">
            <span className="label">RUT</span>
            <input
              className="input text-lg"
              inputMode="text"
              autoComplete="username"
              placeholder="12.345.678-5"
              value={rut}
              onChange={(e) => setRut(formatRut(e.target.value))}
              autoFocus
            />
            {rut.length > 3 && !valid && <span className="mt-1 block text-xs text-red-700">RUT inválido</span>}
          </label>
          <ErrorBox message={error} />
          <button type="submit" className="btn-primary w-full" disabled={busy || !valid}>
            {busy ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
