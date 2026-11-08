export function toVtt(input: string): string {
  const text = input.replace(/^\uFEFF/, '').replace(/\r/g, '')
  if (/^WEBVTT/m.test(text)) return text
  const cues = ['WEBVTT', '']
  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split('\n').map((line) => line.trimEnd())
    const timeIndex = lines.findIndex((line) => line.includes('-->'))
    if (timeIndex < 0) continue
    const body = lines.slice(timeIndex + 1).join('\n').trim()
    if (!body) continue
    cues.push(lines[timeIndex].replace(/,/g, '.'), body, '')
  }
  return cues.join('\n')
}
