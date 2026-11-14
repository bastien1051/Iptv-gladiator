export const PAGES_ORIGIN = 'https://bastien1051.github.io'

export type DropReason =
  | 'geo-blocked'
  | 'not-24-7'
  | 'paid'
  | 'drm'
  | 'http'
  | 'cors'
  | 'invalid'
  | 'timeout'
  | 'unavailable'

export type ManifestHit =
  | { ok: true; kind: 'media' | 'master' | 'dash'; next: string }
  | { ok: true; kind: 'direct' }
  | { ok: false; reason: 'drm' | 'invalid' | 'geo-blocked' }

const PAID_NAME =
  /\b(netflix|disney\s*\+|disney plus|paramount\s*\+|paramount plus|hbo max|hbomax|espn\s*\+|apple tv\s*\+|prime video|amazon prime|dazn|bein sports|beinsports|bein connect|canal\s*\+|canal plus|mycanal|sky sports|sky cinema|sky atlantic|movistar\s*\+|rmc sport|discovery\s*\+|crunchyroll|hulu|peacock|sling tv|fubo|youtube tv|ocs)(?!\w)/i

const PAID_URL =
  /(netflix\.com|nflxvideo|nflxso|dazn\.|dazndn|beinsports|bein\.com|canalplus|canal-plus|hbomax|paramountplus|primevideo|hulu\.com|peacocktv|sling\.com|fubo\.tv)/i

export function isPaidService(name: string, url: string): boolean {
  return PAID_NAME.test(name) || PAID_URL.test(url)
}

export function catalogLabelReason(labels: string[] | undefined): 'geo-blocked' | 'not-24-7' | null {
  if (!labels?.length) return null
  for (const label of labels) {
    const value = label.toLowerCase()
    if (value.includes('geo')) return 'geo-blocked'
    if (value.includes('24/7') || value.includes('24-7') || value.includes('not 24')) return 'not-24-7'
  }
  return null
}

export function prefilterUrl(input: { name: string; url: string; labels?: string[] }): DropReason | null {
  const labeled = catalogLabelReason(input.labels)
  if (labeled) return labeled
  if (isPaidService(input.name, input.url)) return 'paid'
  return null
}

export function corsAllows(value: string | null, origin = PAGES_ORIGIN): boolean {
  if (!value) return false
  const allowed = value.trim().toLowerCase()
  if (allowed === '*') return true
  return allowed === origin.toLowerCase()
}

export function shouldRetry(reason: DropReason): boolean {
  return reason === 'timeout' || reason === 'unavailable'
}

export function resolveUrl(base: string, value: string): string {
  try {
    return new URL(value, base).toString()
  } catch {
    return value
  }
}

function geoText(text: string): boolean {
  return /geo-?block|not available in your (country|region)|unavailable in your location|this content is not available in your/i.test(text.slice(0, 1500))
}

function drmText(text: string): boolean {
  return /METHOD=SAMPLE-AES|EXT-X-SESSION-KEY|widevine|playready|fairplay|skd:\/\/|ContentProtection/i.test(text)
}

export function inspectManifest(body: string, playlistUrl: string): ManifestHit {
  const text = body.replace(/^\uFEFF/, '').trim()
  if (!text) return { ok: false, reason: 'invalid' }
  if (geoText(text)) return { ok: false, reason: 'geo-blocked' }
  if (drmText(text)) return { ok: false, reason: 'drm' }
  if (/^<!doctype html|^<html/i.test(text)) return { ok: false, reason: 'invalid' }
  if (/<MPD[\s>]/i.test(text)) return inspectDash(text, playlistUrl)
  if (!text.includes('#EXTM3U')) return { ok: false, reason: 'invalid' }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  let expectVariant = false
  let pendingBandwidth = Number.POSITIVE_INFINITY
  let lowestBandwidth = Number.POSITIVE_INFINITY
  let variant = ''
  let segment = ''
  for (const line of lines) {
    if (line.startsWith('#EXT-X-STREAM-INF')) {
      expectVariant = true
      const match = /BANDWIDTH=(\d+)/i.exec(line)
      pendingBandwidth = match ? Number(match[1]) : 1
      continue
    }
    if (line.startsWith('#')) {
      expectVariant = false
      continue
    }
    const absolute = resolveUrl(playlistUrl, line)
    if (expectVariant) {
      if (pendingBandwidth < lowestBandwidth) {
        lowestBandwidth = pendingBandwidth
        variant = absolute
      }
      expectVariant = false
      continue
    }
    if (!segment) segment = absolute
  }
  if (variant) return { ok: true, kind: 'master', next: variant }
  if (segment) return { ok: true, kind: 'media', next: segment }
  return { ok: false, reason: 'invalid' }
}

function inspectDash(text: string, playlistUrl: string): ManifestHit {
  const listed = /<SegmentURL[^>]*media="([^"]+)"/i.exec(text) || /<Initialization[^>]*sourceURL="([^"]+)"/i.exec(text)
  if (listed?.[1]) return { ok: true, kind: 'dash', next: resolveUrl(playlistUrl, listed[1].trim()) }
  const template = /\bmedia="([^"]+)"/i.exec(text)
  if (template?.[1]) {
    const start = /startNumber="(\d+)"/i.exec(text)?.[1] ?? '1'
    const raw = template[1]
      .replaceAll('$Number$', start)
      .replaceAll('$RepresentationID$', '1')
      .replaceAll('$Bandwidth$', '1000000')
      .replaceAll('$Time$', '0')
    if (!raw.includes('$')) return { ok: true, kind: 'dash', next: resolveUrl(playlistUrl, raw) }
  }
  const base = /<BaseURL>([^<]+)<\/BaseURL>/i.exec(text)
  if (base?.[1]?.trim()) return { ok: true, kind: 'dash', next: resolveUrl(playlistUrl, base[1].trim()) }
  return { ok: false, reason: 'invalid' }
}

export type ProbeResult = { ok: true } | { ok: false; reason: DropReason }

const BROWSER_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  origin: PAGES_ORIGIN,
  referer: `${PAGES_ORIGIN}/`,
  accept: '*/*',
}

async function readSome(response: Response, max: number): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return ''
  const parts: Uint8Array[] = []
  let size = 0
  while (size < max) {
    const chunk = await reader.read()
    if (chunk.done) break
    parts.push(chunk.value)
    size += chunk.value.byteLength
  }
  await reader.cancel().catch(() => undefined)
  const merged = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    merged.set(part, offset)
    offset += part.byteLength
  }
  return new TextDecoder().decode(merged)
}

function failureReason(error: unknown): DropReason {
  const name = error instanceof Error ? error.name : ''
  if (name === 'TimeoutError' || name === 'AbortError') return 'timeout'
  return 'unavailable'
}

async function fetchChecked(url: string, signal: AbortSignal): Promise<{ status: number; acao: string | null; type: string; text: string }> {
  const response = await fetch(url, { signal, redirect: 'follow', headers: BROWSER_HEADERS })
  const acao = response.headers.get('access-control-allow-origin')
  const type = (response.headers.get('content-type') || '').toLowerCase()
  const playlist = type.includes('mpegurl') || type.includes('dash') || /\.m3u8?(\?|$)/i.test(url) || /\.mpd(\?|$)/i.test(url)
  const text = playlist || response.status === 401 || response.status === 403 ? await readSome(response, playlist ? 250_000 : 4_000) : ''
  if (!text) await response.body?.cancel().catch(() => undefined)
  return { status: response.status, acao, type, text }
}

export async function probeStream(url: string, timeoutMs = 8000): Promise<ProbeResult> {
  const signal = AbortSignal.timeout(timeoutMs)
  try {
    return await follow(url, signal, 0)
  } catch (error) {
    return { ok: false, reason: failureReason(error) }
  }
}

async function follow(url: string, signal: AbortSignal, depth: number): Promise<ProbeResult> {
  if (depth > 3) return { ok: false, reason: 'invalid' }
  const hit = await fetchChecked(url, signal)
  if (!corsAllows(hit.acao)) return { ok: false, reason: 'cors' }
  if (hit.status === 401 || hit.status === 403) {
    return { ok: false, reason: geoText(hit.text) ? 'geo-blocked' : 'http' }
  }
  if (hit.status >= 500) return { ok: false, reason: 'unavailable' }
  if (hit.status !== 200 && hit.status !== 206) return { ok: false, reason: 'http' }
  if (hit.type.includes('text/html') || /^<!doctype html|^<html/i.test(hit.text)) return { ok: false, reason: 'invalid' }

  const playlist = hit.text.includes('#EXTM3U') || /<MPD[\s>]/i.test(hit.text)
  if (!playlist) {
    if (hit.type.includes('video') || hit.type.includes('octet-stream') || hit.type.includes('mp4') || /\.(ts|mp4|m4s)(\?|$)/i.test(url)) {
      return { ok: true }
    }
    return { ok: false, reason: 'invalid' }
  }
  const inspected = inspectManifest(hit.text, url)
  if (!inspected.ok) return inspected
  if (inspected.kind === 'direct') return { ok: true }
  if (inspected.kind === 'media' || inspected.kind === 'dash') {
    const segment = await fetchChecked(inspected.next, signal)
    if (!corsAllows(segment.acao)) return { ok: false, reason: 'cors' }
    if (segment.status === 401 || segment.status === 403) return { ok: false, reason: geoText(segment.text) ? 'geo-blocked' : 'http' }
    if (segment.status >= 500) return { ok: false, reason: 'unavailable' }
    if (segment.status !== 200 && segment.status !== 206) return { ok: false, reason: 'http' }
    return { ok: true }
  }
  return follow(inspected.next, signal, depth + 1)
}
