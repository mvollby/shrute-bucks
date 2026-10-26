import { describe, expect, it } from 'vitest'
import { parseCapitalOneCard } from './parseCapitalOneCard'

const sampleCsv = `Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit
2026-09-05,2026-09-06,1234,CHIPOTLE 2481 SEATTLE WA,Dining,12.50,
2026-09-10,2026-09-11,1234,PAYMENT - THANK YOU,Payment/Credit,,500.00
2026-09-15,2026-09-16,1234,"SQ *BLUE BOTTLE, SEATTLE",Dining,4.75,
`

describe('parseCapitalOneCard', () => {
  it('parses debits as negative amounts', () => {
    const rows = parseCapitalOneCard(sampleCsv)
    const chipotle = rows.find((r) => r.rawDescription === 'CHIPOTLE 2481 SEATTLE WA')
    expect(chipotle?.amount).toBe(-12.5)
    expect(chipotle?.date).toBe('2026-09-05')
  })

  it('parses credits as positive amounts', () => {
    const rows = parseCapitalOneCard(sampleCsv)
    const payment = rows.find((r) => r.rawDescription === 'PAYMENT - THANK YOU')
    expect(payment?.amount).toBe(500)
  })

  it('handles a quoted description containing a comma', () => {
    const rows = parseCapitalOneCard(sampleCsv)
    const blueBottle = rows.find((r) => r.rawDescription.includes('BLUE BOTTLE'))
    expect(blueBottle?.rawDescription).toBe('SQ *BLUE BOTTLE, SEATTLE')
    expect(blueBottle?.amount).toBe(-4.75)
  })

  it('throws on a CSV that is not a Capital One card export', () => {
    expect(() => parseCapitalOneCard('foo,bar\n1,2\n')).toThrow()
  })
})
