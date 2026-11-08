import { CATEGORY_NAME_TO_ID, COUNTRY_NAME_TO_CODE, LANGUAGE_NAME_TO_CODE } from '../data/taxonomy'
import type { Channel, Draft, Role } from '../types'
import { detectFast, isAdultChannel, isCombat } from './classify'
import { categoryLabel, countryLabel, fastLabel, hashString, languageLabel, normName } from './text'

const COUNTRY_CODES = new Set(Object.values(COUNTRY_NAME_TO_CODE))
const COUNTRY_ALIAS: Record<string, string> = { UK: 'GB' }

export function normUrl(url: string): string {
  const trimmed = url.trim()
  try {
    const parsed = new URL(trimmed)
    parsed.hash = ''
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1)
    }
    return parsed.toString()
  } catch {
    return trimmed
  }
}

export function qualityScore(name: string, url: string): number {
  const blob = `${name} ${url}`.toLowerCase()
  let score = 1
  if (/2160|4k|uhd/.test(blob)) score = 2160
  else if (/1080/.test(blob)) score = 1080
  else if (/720/.test(blob) || /\bhd\b/.test(blob)) score = 720
  else if (/576/.test(blob)) score = 576
  else if (/480/.test(blob)) score = 480
  else if (/360/.test(blob)) score = 360
  else if (/270/.test(blob)) score = 270
  if (url.startsWith('https://')) score += 0.5
  return score
}

export function countryFromTvg(tvgId?: string): string | undefined {
  if (!tvgId) return undefined
  const match = tvgId.split('@')[0].match(/\.([a-z]{2})$/i)
  if (!match) return undefined
  const code = COUNTRY_ALIAS[match[1].toUpperCase()] ?? match[1].toUpperCase()
  return COUNTRY_CODES.has(code) ? code : undefined
}

export function languageCode(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (LANGUAGE_NAME_TO_CODE[trimmed]) return LANGUAGE_NAME_TO_CODE[trimmed]
  const lower = trimmed.toLowerCase()
  const byName = Object.entries(LANGUAGE_NAME_TO_CODE).find(([name]) => name.toLowerCase() === lower)
  if (byName) return byName[1]
  if (lower === 'fr' || lower === 'fre') return 'fra'
  if (lower === 'en') return 'eng'
  if (lower === 'es') return 'spa'
  if (lower === 'de') return 'deu'
  if (lower === 'pt') return 'por'
  if (lower === 'it') return 'ita'
  if (lower === 'ar') return 'ara'
  if (/^[a-z]{3}$/.test(lower)) return lower
  return undefined
}

function categoryId(name: string): string | undefined {
  const trimmed = name.trim()
  if (!trimmed) return undefined
  if (CATEGORY_NAME_TO_ID[trimmed]) return CATEGORY_NAME_TO_ID[trimmed]
  const found = Object.entries(CATEGORY_NAME_TO_ID).find(([label]) => label.toLowerCase() === trimmed.toLowerCase())
  if (found) return found[1]
  const slug = normName(trimmed).replace(/ /g, '-')
  return slug || undefined
}

function attributes(line: string): Record<string, string> {
  const out: Record<string, string> = {}
  const pattern = /([a-zA-Z0-9_-]+)="([^"]*)"/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(line))) out[match[1]] = match[2]
  return out
}

export function m3uEpgUrls(text: string): string[] {
  const header = text.split(/\r?\n/, 1)[0] ?? ''
  const attrs = attributes(header)
  const raw = attrs['url-tvg'] || attrs['x-tvg-url'] || attrs['tvg-url'] || ''
  return raw.split(',').map((item) => item.trim()).filter((item) => /^https?:\/\//i.test(item))
}

export function playlistProblem(text: string): string | null {
  const cleaned = text.replace(/^\uFEFF/, '').trim()
  if (!cleaned) return 'Parse : réponse vide'
  const head = cleaned.slice(0, 180).replace(/\s+/g, ' ')
  if (cleaned.charAt(0) === '<' || /^<!doctype/i.test(cleaned)) return `Parse : page HTML reçue à la place d’une liste M3U. Début : ${head}`
  if (cleaned.charAt(0) === '{' || cleaned.charAt(0) === '[') return `Parse : JSON reçu à la place d’une liste M3U. Début : ${head}`
  return null
}

export function parseM3u(text: string, source: { id: string; role: Role }): Draft[] {
  const drafts: Draft[] = []
  let pending: {
    attrs: Record<string, string>
    name: string
    userAgent?: string
    referrer?: string
    group?: string
  } | null = null
  let extGroup = ''

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('#EXTINF')) {
      const comma = line.indexOf(',')
      const head = comma >= 0 ? line.slice(0, comma) : line
      const name = comma >= 0 ? line.slice(comma + 1).trim() : ''
      pending = { attrs: attributes(head), name, group: extGroup }
      continue
    }
    if (line.startsWith('#EXTGRP:')) {
      extGroup = line.slice('#EXTGRP:'.length).trim()
      if (pending && !pending.group) pending.group = extGroup
      continue
    }
    if (line.startsWith('#EXTVLCOPT:') && pending) {
      const body = line.slice('#EXTVLCOPT:'.length)
      const splitAt = body.indexOf('=')
      if (splitAt > 0) {
        const key = body.slice(0, splitAt).trim().toLowerCase()
        const value = body.slice(splitAt + 1).trim()
        if (key === 'http-user-agent') pending.userAgent = value
        if (key === 'http-referrer' || key === 'http-referer') pending.referrer = value
      }
      continue
    }
    if (line.startsWith('#')) continue
    if (!pending || !/^https?:\/\//i.test(line)) {
      pending = null
      continue
    }
    const attrs = pending.attrs
    const days = Number(attrs['catchup-days'] || attrs['tvg-rec'] || '')
    drafts.push({
      name: pending.name || attrs['tvg-name'] || 'Chaîne',
      url: line,
      logo: attrs['tvg-logo'] || undefined,
      tvgId: attrs['tvg-id'] || undefined,
      groupTitle: attrs['group-title'] || pending.group || '',
      userAgent: pending.userAgent || attrs['http-user-agent'] || undefined,
      referrer: pending.referrer || attrs['http-referrer'] || attrs['http-referer'] || undefined,
      catchupType: attrs['catchup'] || undefined,
      catchupDays: Number.isFinite(days) && days > 0 ? days : undefined,
      catchupSource: attrs['catchup-source'] || undefined,
      tvgLanguage: attrs['tvg-language'] || undefined,
      sourceId: source.id,
      role: source.role,
    })
    pending = null
  }
  return drafts
}

type Bucket = {
  drafts: Draft[]
  urls: { url: string; name: string; userAgent?: string; referrer?: string }[]
}

function searchBlobFor(channel: Omit<Channel, 'searchBlob'>): string {
  const parts = [
    channel.name,
    channel.country ? countryLabel(channel.country) : '',
    ...channel.categories.map(categoryLabel),
    ...channel.languages.map(languageLabel),
    channel.fast ? fastLabel(channel.fast) : '',
    channel.combat ? 'sports de combat boxe mma catch kickboxing' : '',
    channel.categories.includes('sports') ? 'sport' : '',
  ]
  return normName(parts.join(' '))
}

function buildChannel(bucket: Bucket, dedupeFeed: boolean): Channel | null {
  const first = bucket.drafts[0]
  if (!first) return null
  const tvgId = bucket.drafts.find((draft) => draft.tvgId)?.tvgId
  const logo = bucket.drafts.find((draft) => draft.logo)?.logo
  const name = bucket.drafts.find((draft) => draft.role === 'full' || draft.role === 'category')?.name || first.name
  const countries = new Set<string>()
  const langs = new Set<string>()
  const categories = new Set<string>()
  const fromTvg = countryFromTvg(tvgId)
  if (fromTvg) countries.add(fromTvg)
  let catchupType: string | undefined
  let catchupDays: number | undefined
  let catchupSource: string | undefined
  let origin = bucket.drafts.find((draft) => draft.origin)?.origin
  const groups: string[] = []

  for (const draft of bucket.drafts) {
    groups.push(draft.groupTitle)
    const parts = draft.groupTitle.split(';').map((part) => part.trim()).filter(Boolean)
    if (draft.role === 'country') {
      for (const part of parts) {
        const code = COUNTRY_NAME_TO_CODE[part]
        if (code) countries.add(code)
      }
    } else if (draft.role === 'language') {
      for (const part of parts) {
        const code = languageCode(part)
        if (code) langs.add(code)
      }
    } else if (draft.role !== 'adult') {
      for (const part of parts) {
        const id = categoryId(part)
        if (id) categories.add(id)
      }
    }
    const lang = languageCode(draft.tvgLanguage)
    if (lang) langs.add(lang)
    if (draft.catchupType) catchupType = draft.catchupType
    if (draft.catchupDays) catchupDays = draft.catchupDays
    if (draft.catchupSource) catchupSource = draft.catchupSource
    if (draft.origin) origin = draft.origin
  }

  const categoryList = [...categories].filter((id) => id !== 'undefined')
  const groupText = groups.join(' ')
  const sourceAdult = bucket.drafts.some((draft) => draft.role === 'adult')
  const adult = isAdultChannel(name, groupText, categoryList, sourceAdult)
  const urls = bucket.urls
    .map((item) => ({
      url: item.url,
      userAgent: item.userAgent,
      referrer: item.referrer,
      quality: qualityScore(item.name, item.url),
    }))
    .sort((a, b) => b.quality - a.quality)
  const unique: typeof urls = []
  const seen = new Set<string>()
  for (const item of urls) {
    const key = normUrl(item.url)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(item)
  }
  if (!unique.length) return null
  const country = fromTvg ?? [...countries][0]
  const fast = unique.map((item) => detectFast(name, tvgId ?? '', item.url)).find(Boolean)
  const id = dedupeFeed && tvgId ? `tvg:${tvgId}` : `url:${hashString(normUrl(unique[0].url))}`
  const partial: Omit<Channel, 'searchBlob'> = {
    id,
    name,
    urls: unique,
    logo,
    tvgId,
    country,
    languages: [...langs],
    categories: categoryList,
    catchup: catchupType || catchupDays || catchupSource ? { type: catchupType, days: catchupDays, source: catchupSource } : undefined,
    origin,
    adult,
    combat: !adult && isCombat(name, groupText, categoryList),
    fast: adult ? undefined : fast,
    sourceId: first.sourceId,
  }
  return { ...partial, searchBlob: searchBlobFor(partial) }
}

export function finalize(drafts: Draft[], dedupeFeed: boolean): { channels: Channel[]; adult: Channel[] } {
  const byUrl = new Map<string, Bucket>()
  for (const draft of drafts) {
    if (!draft.url) continue
    const key = normUrl(draft.url)
    let bucket = byUrl.get(key)
    if (!bucket) {
      bucket = { drafts: [], urls: [] }
      byUrl.set(key, bucket)
    }
    bucket.drafts.push(draft)
    bucket.urls.push({ url: draft.url, name: draft.name, userAgent: draft.userAgent, referrer: draft.referrer })
  }

  let channels = [...byUrl.values()].map((bucket) => buildChannel(bucket, false)).filter((channel): channel is Channel => !!channel)

  if (dedupeFeed) {
    const merged = new Map<string, Channel>()
    for (const channel of channels) {
      const key = channel.tvgId ? `tvg:${channel.tvgId}` : channel.id
      const prev = merged.get(key)
      if (!prev) {
        merged.set(key, { ...channel, id: channel.tvgId ? `tvg:${channel.tvgId}` : channel.id })
        continue
      }
      const urls = [...prev.urls, ...channel.urls].sort((a, b) => b.quality - a.quality)
      const unique = []
      const seen = new Set<string>()
      for (const item of urls) {
        const urlKey = normUrl(item.url)
        if (seen.has(urlKey)) continue
        seen.add(urlKey)
        unique.push(item)
      }
      const categories = [...new Set([...prev.categories, ...channel.categories])]
      const languages = [...new Set([...prev.languages, ...channel.languages])]
      const next: Channel = {
        ...prev,
        urls: unique,
        logo: prev.logo || channel.logo,
        country: prev.country || channel.country,
        categories,
        languages,
        catchup: prev.catchup || channel.catchup,
        origin: prev.origin || channel.origin,
        adult: prev.adult || channel.adult,
        combat: prev.combat || channel.combat,
        fast: prev.fast || channel.fast,
      }
      next.combat = !next.adult && next.combat
      if (next.adult) next.fast = undefined
      next.searchBlob = searchBlobFor(next)
      merged.set(key, next)
    }
    channels = [...merged.values()]
  }

  return {
    channels: channels.filter((channel) => !channel.adult),
    adult: channels.filter((channel) => channel.adult),
  }
}

export function buildCatchupUrl(channel: Channel, start: number, stop: number): string | null {
  const durationSec = Math.max(60, Math.round((stop - start) / 1000))
  if (channel.origin && channel.origin.archiveDays > 0) {
    const date = new Date(start)
    const pad = (value: number) => String(value).padStart(2, '0')
    const stamp = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}:${pad(date.getUTCHours())}-${pad(date.getUTCMinutes())}`
    const minutes = Math.max(1, Math.round(durationSec / 60))
    const origin = channel.origin
    return `${origin.base}/timeshift/${encodeURIComponent(origin.username)}/${encodeURIComponent(origin.password)}/${minutes}/${stamp}/${encodeURIComponent(origin.streamId)}.m3u8`
  }
  if (!channel.catchup?.source) return null
  const template = channel.catchup.source
  const startDate = new Date(start)
  const stopDate = new Date(stop)
  const stamp = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`
  }
  const utc = Math.floor(start / 1000)
  const tokens: Record<string, string> = {
    '{utc}': String(utc),
    '{lutc}': String(Math.floor(Date.now() / 1000)),
    '{start}': stamp(startDate),
    '{end}': stamp(stopDate),
    '{duration}': String(durationSec),
    '{offset}': String(Math.floor((Date.now() - start) / 1000)),
    '{timestamp}': stamp(startDate),
  }
  let filled = template
  for (const token of Object.keys(tokens)) filled = filled.split(token).join(tokens[token])
  if (/^https?:\/\//i.test(filled)) return filled
  try {
    return new URL(filled, channel.urls[0]?.url).toString()
  } catch {
    return null
  }
}
