import type { Channel, Programme } from '../types'
import { normName } from './text'

export function programmesFor(channel: Channel, index: Map<string, Programme[]>): Programme[] {
  if (channel.tvgId) {
    const exact = index.get(`id:${channel.tvgId.toLowerCase()}`)
    if (exact?.length) return exact
    const base = index.get(`id:${channel.tvgId.split('@')[0].toLowerCase()}`)
    if (base?.length) return base
  }
  return index.get(`name:${normName(channel.name)}`) ?? []
}

export function currentAndNext(list: Programme[], now: number): { current?: Programme; next?: Programme } {
  if (!list.length) return {}
  let lo = 0
  let hi = list.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const item = list[mid]
    if (item.stop <= now) lo = mid + 1
    else if (item.start > now) hi = mid - 1
    else return { current: item, next: list[mid + 1] }
  }
  const next = list.find((item) => item.start > now)
  return next ? { next } : {}
}

export function mergeProgrammeMaps(
  base: Record<string, Programme[]>,
  extra: Record<string, Programme[]>,
): Record<string, Programme[]> {
  const out: Record<string, Programme[]> = { ...base }
  for (const [key, list] of Object.entries(extra)) {
    const seen = new Map<string, Programme>()
    for (const item of [...(out[key] ?? []), ...list]) seen.set(`${item.start}|${item.title}`, item)
    out[key] = [...seen.values()].sort((a, b) => a.start - b.start).slice(0, 80)
  }
  return out
}
