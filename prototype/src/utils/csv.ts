export const parseCsv = (content: string) => {
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim())
    return headers.reduce<Record<string, string>>((acc, header, idx) => {
      acc[header] = cells[idx] ?? ''
      return acc
    }, {})
  })
}

export const downloadCsv = (headers: string[], rows: (string | number)[][], filename: string) => {
  const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
}
