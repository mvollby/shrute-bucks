import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'

describe('parseCsv', () => {
  it('splits a simple comma-separated file into rows', () => {
    const result = parseCsv('a,b,c\n1,2,3\n')
    expect(result).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('handles quoted fields with embedded commas', () => {
    const result = parseCsv('name,amount\n"SQ *BLUE BOTTLE, SEATTLE",4.50\n')
    expect(result).toEqual([
      ['name', 'amount'],
      ['SQ *BLUE BOTTLE, SEATTLE', '4.50'],
    ])
  })

  it('handles escaped double quotes inside quoted fields', () => {
    const result = parseCsv('name\n"Joe ""The Rock"" Smith"\n')
    expect(result).toEqual([['name'], ['Joe "The Rock" Smith']])
  })

  it('handles CRLF line endings', () => {
    const result = parseCsv('a,b\r\n1,2\r\n')
    expect(result).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('handles a file with no trailing newline', () => {
    const result = parseCsv('a,b\n1,2')
    expect(result).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})
