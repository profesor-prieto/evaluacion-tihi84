import { describe, expect, it } from 'vitest'
import { computeDv, formatRut, isValidRut, normalizeRut } from './rut'

describe('rut', () => {
  it('calcula el dígito verificador', () => {
    expect(computeDv('11111111')).toBe('1')
    expect(computeDv('12345678')).toBe('5')
  })
  it('valida RUT con y sin formato', () => {
    expect(isValidRut('11.111.111-1')).toBe(true)
    expect(isValidRut('12345678-5')).toBe(true)
    expect(isValidRut('12345678-K')).toBe(false)
    expect(isValidRut('')).toBe(false)
    expect(isValidRut('1')).toBe(false)
  })
  it('acepta dígito verificador K en minúscula', () => {
    const body = '10000013'
    expect(computeDv(body)).toBe('K')
    expect(isValidRut(`${body}-k`)).toBe(true)
  })
  it('normaliza y formatea', () => {
    expect(normalizeRut('12.345.678-k')).toBe('12345678-K')
    expect(formatRut('123456785')).toBe('12.345.678-5')
    expect(formatRut('7654321-6')).toBe('7.654.321-6')
  })
})
