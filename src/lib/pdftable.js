// Haalt tabellen uit een PDF op basis van de positie van tekst (werkt voor PDF's met echte tekst, niet voor scans).

/** Tekstfragmenten van een pagina met positie in pt (oorsprong linksboven). */
async function pageItems(pdf, n) {
  const page = await pdf.getPage(n)
  const vp = page.getViewport({ scale: 1 })
  const content = await page.getTextContent()
  const items = []
  for (const it of content.items) {
    const str = it.str?.replace(/\s+/g, ' ')
    if (!str || !str.trim()) continue
    const [, , c, d, e, f] = it.transform
    const size = Math.hypot(c, d) || it.height || 10
    items.push({ str, x0: e, x1: e + (it.width || str.length * size * 0.5), y: vp.height - f, size })
  }
  return items
}

/** Groepeert fragmenten in regels en cellen. */
function toRows(items) {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x0 - b.x0)
  const rows = []
  for (const it of sorted) {
    const row = rows.find((r) => Math.abs(r.y - it.y) <= Math.max(2, it.size * 0.45))
    if (row) row.items.push(it)
    else rows.push({ y: it.y, items: [it] })
  }
  return rows.map((r) => {
    const its = r.items.sort((a, b) => a.x0 - b.x0)
    const cells = []
    for (const it of its) {
      const last = cells.at(-1)
      if (last && it.x0 - last.x1 < it.size * 0.8) {
        last.text += (it.x0 - last.x1 > it.size * 0.15 && !last.text.endsWith(' ') && !it.str.startsWith(' ') ? ' ' : '') + it.str
        last.x1 = Math.max(last.x1, it.x1)
      } else cells.push({ text: it.str, x0: it.x0, x1: it.x1 })
    }
    cells.forEach((c) => (c.text = c.text.trim()))
    return { y: r.y, cells }
  })
}

/** Kolommen = stroken op de x-as die door cellen van meerkolomsregels worden bedekt. */
function detectColumns(rows) {
  const intervals = rows
    .filter((r) => r.cells.length >= 2)
    .flatMap((r) => r.cells.map((c) => [c.x0, c.x1]))
    .sort((a, b) => a[0] - b[0])
  const cols = []
  for (const [a, b] of intervals) {
    const last = cols.at(-1)
    if (last && a <= last[1] + 2) last[1] = Math.max(last[1], b)
    else cols.push([a, b])
  }
  return cols
}

function assign(rows, cols) {
  if (!cols.length) return rows.map((r) => [r.cells.map((c) => c.text).join(' ')])
  return rows.map((r) => {
    const out = new Array(cols.length).fill('')
    // losse regel (titel, tussenkop) altijd in de eerste kolom
    if (r.cells.length === 1) {
      out[0] = r.cells[0].text
      return out
    }
    for (const c of r.cells) {
      let best = 0
      let bestScore = -Infinity
      cols.forEach(([a, b], i) => {
        const overlap = Math.min(b, c.x1) - Math.max(a, c.x0)
        const score = overlap > 0 ? overlap : -Math.abs((a + b) / 2 - (c.x0 + c.x1) / 2)
        if (score > bestScore) {
          bestScore = score
          best = i
        }
      })
      out[best] = out[best] ? `${out[best]} ${c.text}` : c.text
    }
    return out
  })
}

export async function extractTables(pdf, pages, { minColumns = 2, dropTitles = true } = {}) {
  const result = []
  for (const n of pages) {
    const rows = toRows(await pageItems(pdf, n))
    const cols = detectColumns(rows)
    let table = assign(rows, cols)
    if (cols.length < minColumns) table = rows.map((r) => [r.cells.map((c) => c.text).join(' ')])
    else if (dropTitles) {
      // titels boven de tabel weglaten (regels met één cel vóór de eerste echte tabelregel)
      const first = rows.findIndex((r) => r.cells.length >= 2)
      if (first > 0) table = table.slice(first)
    }
    result.push({ page: n, columns: Math.max(1, cols.length), rows: table })
  }
  return result
}

// ---------- Getallen ----------
/** "€ 1.234,56" → 1234.56; geeft null als het geen getal is. */
export function parseNumber(v) {
  const s = String(v).replace(/[€\s]|EUR/gi, '').replace(/,-+$/, '')
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'))
  if (/^-?\d+,\d+$/.test(s)) return Number(s.replace(',', '.'))
  if (/^-?\d+(\.\d{1,2})?$/.test(s)) return Number(s)
  return null
}

// ---------- Export ----------
export function toCsv(rows) {
  const esc = (v) => (/[;"\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v)
  return '﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n')
}

export const toTsv = (rows) => rows.map((r) => r.map((v) => String(v).replace(/[\t\n]/g, ' ')).join('\t')).join('\n')

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function colName(i) {
  let s = ''
  for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s
  return s
}

/** Minimale .xlsx-schrijver (meerdere tabbladen, vette kopregel, getallen als getal). */
export async function toXlsx(sheets, { header = true, numbers = true } = {}) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join('')}</Types>`,
  )
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`)
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
      .map((s, i) => `<sheet name="${xmlEsc(s.name.slice(0, 31).replace(/[\\/?*[\]:]/g, ''))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</sheets></workbook>`,
  )
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  )
  zip.file(
    'xl/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0"/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`,
  )
  sheets.forEach((sheet, si) => {
    const widths = []
    const rowsXml = sheet.rows
      .map((row, ri) => {
        const isHead = header && ri === 0
        const cells = row
          .map((v, ci) => {
            widths[ci] = Math.max(widths[ci] || 6, Math.min(60, String(v).length + 2))
            if (v === '' || v == null) return ''
            const ref = `${colName(ci)}${ri + 1}`
            const num = numbers && !isHead ? parseNumber(v) : null
            const style = isHead ? ' s="1"' : ''
            return num != null ? `<c r="${ref}"${style}><v>${num}</v></c>` : `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`
          })
          .join('')
        return `<row r="${ri + 1}">${cells}</row>`
      })
      .join('')
    const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : ''
    zip.file(
      `xl/worksheets/sheet${si + 1}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${rowsXml}</sheetData></worksheet>`,
    )
  })
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
