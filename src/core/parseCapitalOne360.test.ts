import { describe, expect, it } from 'vitest'
import { parseCapitalOne360 } from './parseCapitalOne360'

const sampleCsv = `Account Number,Transaction Date,Transaction Amount,Transaction Type,Transaction Description,Balance
1234,2026-09-03,85.00,Debit,RENT PAYMENT,4200.00
1234,2026-09-15,2500.00,Credit,PAYROLL DEPOSIT,6700.00
`

describe('parseCapitalOne360', () => {
  it('parses a Debit row as a negative amount', () => {
    const rows = parseCapitalOne360(sampleCsv)
    const rent = rows.find((r) => r.rawDescription === 'RENT PAYMENT')
    expect(rent?.amount).toBe(-85)
    expect(rent?.date).toBe('2026-09-03')
  })

  it('parses a Credit row as a positive amount', () => {
    const rows = parseCapitalOne360(sampleCsv)
    const payroll = rows.find((r) => r.rawDescription === 'PAYROLL DEPOSIT')
    expect(payroll?.amount).toBe(2500)
  })

  it('throws on a CSV that is not a Capital One 360 checking export', () => {
    expect(() => parseCapitalOne360('foo,bar\n1,2\n')).toThrow()
  })
})
