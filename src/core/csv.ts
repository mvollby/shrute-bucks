// A small RFC4180-ish CSV parser: handles quoted fields, embedded commas,
// escaped ("") quotes, and quoted embedded newlines. No dependency pulled in
// for this since Capital One exports are simple enough that a hand-rolled
// parser is a few dozen lines, and it avoids picking a CSV library just to
// split rows.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  const pushField = () => {
    row.push(field)
    field = ''
  }
  const pushRow = () => {
    pushField()
    rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      pushField()
    } else if (char === '\n') {
      pushRow()
    } else if (char === '\r') {
      // swallow; \r\n line endings are handled by the following \n
    } else {
      field += char
    }
  }

  // Trailing row with no final newline.
  if (field.length > 0 || row.length > 0) {
    pushRow()
  }

  // Drop wholly-empty trailing rows (e.g. a trailing blank line in the file).
  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}
