import { describe, expect, it } from 'vitest'
import { normalizeMerchant } from './normalizeMerchant'

describe('normalizeMerchant', () => {
  it('normalizes two differently-numbered Chipotle rows identically', () => {
    expect(normalizeMerchant('CHIPOTLE 2481 SEATTLE WA')).toBe('chipotle')
    expect(normalizeMerchant('CHIPOTLE 0113 PORTLAND')).toBe('chipotle')
  })

  it('strips the SQ * processor prefix', () => {
    expect(normalizeMerchant('SQ *BLUE BOTTLE 8821')).toBe('blue bottle')
  })

  it('strips the TST* processor prefix', () => {
    expect(normalizeMerchant('TST* CANLIS RESTAURANT 4471')).toBe('canlis restaurant')
  })

  it('strips the PAYPAL * processor prefix', () => {
    expect(normalizeMerchant('PAYPAL *ACMEWIDGETS')).toBe('acmewidgets')
  })

  it('strips a trailing state code with no preceding store number', () => {
    expect(normalizeMerchant('TARGET SEATTLE WA')).toBe('target seattle')
  })

  it('collapses extra whitespace', () => {
    expect(normalizeMerchant('  CHIPOTLE   2481   SEATTLE  WA  ')).toBe('chipotle')
  })
})
