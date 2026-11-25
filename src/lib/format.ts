const dateFmt = new Intl.DateTimeFormat('es-CL', { dateStyle: 'full', timeStyle: 'short' })
const shortFmt = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' })

export const formatDateTime = (iso: string) => dateFmt.format(new Date(iso))
export const formatDateTimeShort = (iso: string) => shortFmt.format(new Date(iso))

/** Valor para <input type="datetime-local"> en hora local. */
export function toLocalInput(iso: string | Date): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatPoints(n: number | null): string {
  if (n === null) return '—'
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',')
}
