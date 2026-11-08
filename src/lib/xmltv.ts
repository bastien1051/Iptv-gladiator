import type { Programme } from '../types'
import { normName } from './text'

function decode(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function tag(block: string, name: string): string | undefined {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  if (!match) return undefined
  const text = decode(match[1])
  return text || undefined
}

export function parseXmltvDate(value: string): number {
  const match = value.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/)
  if (!match) return Number.NaN
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]))
  const zone = match[7]
  if (!zone) return utc
  const sign = zone.startsWith('-') ? -1 : 1
  const offset = (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(3, 5))) * 60000
  return utc - sign * offset
}

export function parseXmltv(xml: string, now = Date.now()): Record<string, Programme[]> {
  const from = now - 24 * 3600 * 1000
  const to = now + 36 * 3600 * 1000
  const names = new Map<string, string[]>()
  const channelPattern = /<channel\b([^>]*)>([\s\S]*?)<\/channel>/gi
  let channelMatch: RegExpExecArray | null
  while ((channelMatch = channelPattern.exec(xml))) {
    const id = attributesId(channelMatch[1])
    if (!id) continue
    const displays = [...channelMatch[2].matchAll(/<display-name[^>]*>([\s\S]*?)<\/display-name>/gi)].map((item) => decode(item[1])).filter(Boolean)
    names.set(id, displays)
  }

  const programmes = new Map<string, Programme[]>()
  const push = (key: string, programme: Programme) => {
    const list = programmes.get(key)
    if (list) list.push(programme)
    else programmes.set(key, [programme])
  }
  const programmePattern = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi
  let programmeMatch: RegExpExecArray | null
  while ((programmeMatch = programmePattern.exec(xml))) {
    const attrs = programmeMatch[1]
    const channel = attr(attrs, 'channel')
    const start = parseXmltvDate(attr(attrs, 'start') ?? '')
    const stopRaw = attr(attrs, 'stop')
    const stop = stopRaw ? parseXmltvDate(stopRaw) : start + 30 * 60 * 1000
    if (!channel || !Number.isFinite(start) || !Number.isFinite(stop)) continue
    if (stop < from || start > to) continue
    const body = programmeMatch[2]
    const programme: Programme = {
      start,
      stop,
      title: tag(body, 'title') || 'Programme',
      subtitle: tag(body, 'sub-title'),
      desc: tag(body, 'desc'),
      category: tag(body, 'category'),
    }
    push(`id:${channel.toLowerCase()}`, programme)
    for (const display of names.get(channel) ?? []) push(`name:${normName(display)}`, programme)
  }

  const out: Record<string, Programme[]> = {}
  for (const [key, list] of programmes) {
    const seen = new Map<string, Programme>()
    for (const item of list) seen.set(`${item.start}|${item.title}`, item)
    out[key] = [...seen.values()].sort((a, b) => a.start - b.start).slice(0, 80)
  }
  return out
}

function attr(source: string, name: string): string | undefined {
  const match = source.match(new RegExp(`${name}="([^"]*)"`, 'i'))
  return match?.[1]
}

function attributesId(source: string): string | undefined {
  return attr(source, 'id')
}
