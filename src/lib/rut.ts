/** Utilidades de RUT chileno. Formato normalizado: "12345678-K". */

export function cleanRut(rut: string): string {
  return rut.toUpperCase().replace(/[^0-9K]/g, '')
}

export function computeDv(body: string): string {
  let sum = 0
  let factor = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * factor
    factor = factor === 7 ? 2 : factor + 1
  }
  const r = 11 - (sum % 11)
  return r === 11 ? '0' : r === 10 ? 'K' : String(r)
}

export function isValidRut(rut: string): boolean {
  const c = cleanRut(rut)
  if (!/^[0-9]{2,9}[0-9K]$/.test(c) || c.length < 2) return false
  const body = c.slice(0, -1)
  if (!/^[0-9]{1,8}$/.test(body)) return false
  return computeDv(body) === c.slice(-1)
}

export function normalizeRut(rut: string): string {
  const c = cleanRut(rut)
  return c.length < 2 ? c : `${c.slice(0, -1)}-${c.slice(-1)}`
}

/** Formato de despliegue: 12.345.678-K */
export function formatRut(rut: string): string {
  const c = cleanRut(rut)
  if (c.length < 2) return c
  const body = c.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${body}-${c.slice(-1)}`
}
