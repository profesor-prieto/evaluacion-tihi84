import { useEffect, useState } from 'react'
import { ErrorBox, Spinner } from '../components/Layout'
import { fetchInstruments, updateLevelPoints } from '../lib/api'
import { formatPoints } from '../lib/format'
import { maxPoints } from '../lib/scoring'
import { errorMessage } from '../lib/supabase'
import { LEVELS, LEVEL_LABEL, type Instrument, type Level } from '../types'

/** Edición del puntaje que otorga cada nivel de valoración en cada indicador. */
export function AdminRubricsPage() {
  const [instruments, setInstruments] = useState<Instrument[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const load = () => fetchInstruments().then(setInstruments).catch((e) => setError(errorMessage(e)))
  useEffect(() => { void load() }, [])

  async function save(itemId: string, level: Level, raw: string, current: number) {
    const value = Number(raw.replace(',', '.'))
    if (Number.isNaN(value) || value < 0) return setError('Puntaje inválido')
    if (value === current) return
    setError(null)
    try {
      await updateLevelPoints(itemId, level, value)
      setSaved(`${itemId}|${level}`)
      await load()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  if (!instruments) return error ? <ErrorBox message={error} /> : <Spinner />

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Puntajes por nivel de valoración</h1>
      <p className="text-sm text-slate-600">
        Los cambios afectan el cálculo de todas las rúbricas resultantes (también de sesiones ya evaluadas).
      </p>
      <ErrorBox message={error} />
      {instruments.map((ins) => {
        const items = ins.criteria.flatMap((c) => c.items.map((i) => ({ c, i })))
        const max = items.reduce((n, x) => n + maxPoints(x.i), 0)
        return (
          <section key={ins.code} className="card overflow-x-auto">
            <h2 className="font-semibold">{ins.code} – {ins.name} <span className="font-normal text-slate-500">· puntaje máximo {formatPoints(max)}</span></h2>
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr><th className="py-1">Indicador</th>{LEVELS.map((l) => <th key={l} className="w-28 py-1 text-center">{LEVEL_LABEL[l]}</th>)}</tr>
              </thead>
              <tbody>
                {items.map(({ c, i }) => (
                  <tr key={i.id} className="border-t border-slate-100 align-top">
                    <td className="py-2 pr-3"><span className="font-mono text-xs font-semibold">{c.code}.{i.number}</span> {i.description}</td>
                    {LEVELS.map((l) => (
                      <td key={l} className="py-2 text-center">
                        <input
                          key={`${i.id}-${l}-${i.points[l]}`}
                          className={`input w-20 text-center ${saved === `${i.id}|${l}` ? 'border-green-500' : ''}`}
                          inputMode="decimal"
                          defaultValue={formatPoints(i.points[l])}
                          onBlur={(e) => void save(i.id, l, e.target.value, i.points[l])}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      })}
    </div>
  )
}
