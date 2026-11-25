import { useEffect, useState } from 'react'
import { formatPoints } from '../lib/format'
import { LEVELS, LEVEL_LABEL, type Evaluation, type Level, type RubricItem } from '../types'

const LEVEL_STYLE: Record<Level, string> = {
  excelente: 'border-green-600 bg-green-600 text-white',
  bueno: 'border-amber-500 bg-amber-500 text-white',
  insatisfactorio: 'border-red-600 bg-red-600 text-white',
}

interface Props {
  code: string
  item: RubricItem
  value: Evaluation | undefined
  disabled: boolean
  saving: boolean
  onLevel: (level: Level | null) => void
  onComment: (comment: string) => void
}

/** Un indicador de la rúbrica: tres niveles de valoración y observación opcional. */
export function ItemEvaluator({ code, item, value, disabled, saving, onLevel, onComment }: Props) {
  const [comment, setComment] = useState(value?.comment ?? '')
  const [showComment, setShowComment] = useState(Boolean(value?.comment))
  useEffect(() => setComment(value?.comment ?? ''), [value?.comment])

  return (
    <div className={`rounded-md border p-3 ${value ? 'border-slate-200 bg-white' : 'border-amber-200 bg-amber-50/40'}`}>
      <div className="flex gap-3">
        <span className="mt-0.5 h-fit shrink-0 self-start rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs font-semibold">{code}</span>
        <div className="flex-1">
          <p className="text-sm">{item.description}</p>
          <p className="mt-0.5 text-xs text-slate-500">Ponderación: {formatPoints(item.weight)}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label={`Indicador ${code}`}>
        {LEVELS.map((l) => {
          const active = value?.level === l
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onLevel(active ? null : l)}
              className={`rounded-md border px-2 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                active ? LEVEL_STYLE[l] : 'border-slate-300 bg-white hover:bg-slate-50'
              }`}
            >
              {LEVEL_LABEL[l]}
              <span className={`block text-[11px] font-normal ${active ? 'text-white/90' : 'text-slate-500'}`}>
                {formatPoints(item.points[l])} pts
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        {value && !disabled ? (
          <button type="button" className="text-slate-600 hover:text-red-700" onClick={() => setShowComment((v) => !v)}>
            {showComment ? 'Ocultar observación' : value.comment ? 'Ver observación' : '+ Agregar observación'}
          </button>
        ) : (
          <span className="text-slate-500">{value?.comment ? `Obs.: ${value.comment}` : ''}</span>
        )}
        {saving && <span className="text-slate-400">Guardando…</span>}
      </div>
      {showComment && value && !disabled && (
        <textarea
          className="input mt-2 text-sm"
          rows={2}
          placeholder="Observaciones o comentarios (opcional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => comment !== (value.comment ?? '') && onComment(comment)}
        />
      )}
    </div>
  )
}
