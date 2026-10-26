import { describe, expect, it } from 'vitest'
import { importCsv } from './importCsv'

const cardCsv = `Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit
2026-09-05,2026-09-06,1234,CHIPOTLE 2481 SEATTLE WA,Dining,12.50,
`

const checkingCsv = `Account Number,Transaction Date,Transaction Amount,Transaction Type,Transaction Description,Balance
1234,2026-09-03,85.00,Debit,RENT PAYMENT,4200.00
`

describe('importCsv', () => {
  it('auto-detects and parses a card export with no format flag', () => {
    const rows = importCsv(cardCsv)
    expect(rows).toHaveLength(1)
    expect(rows[0].amount).toBe(-12.5)
  })

  it('auto-detects and parses a checking export with no format flag', () => {
    const rows = importCsv(checkingCsv)
    expect(rows).toHaveLength(1)
    expect(rows[0].amount).toBe(-85)
  })

  it('imports common spreadsheet CSV headers and normalizes dates and signed amounts', () => {
    const rows = importCsv('Date,Payee,Amount\n10/02/2026,Corner Market,-24.50\n10/03/2026,Payroll,2000.00')
    expect(rows[0]).toMatchObject({ date: '2026-10-02', description: 'Corner Market', amount: -24.5 })
    expect(rows[1].amount).toBe(2000)
  })

  it('throws when no adapter recognizes the header row', () => {
    expect(() => importCsv('foo,bar\n1,2\n')).toThrow()
  })
})
