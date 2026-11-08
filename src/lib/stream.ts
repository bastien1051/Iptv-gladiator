import type { PlayKind } from '../types'

export type StreamMode = 'hls' | 'dash' | 'mpegts' | 'flv' | 'native'

export function detectStreamKind(url: string, kind: PlayKind): StreamMode {
  const path = url.split('?')[0].toLowerCase()
  if (path.endsWith('.m3u8') || path.endsWith('.m3u') || path.includes('.m3u8')) return 'hls'
  if (path.endsWith('.mpd') || path.includes('.mpd')) return 'dash'
  if (path.endsWith('.flv')) return 'flv'
  if (path.endsWith('.ts')) return 'mpegts'
  if (kind === 'live') return 'hls'
  return 'native'
}

export function applyProxy(url: string, proxyBase: string, userAgent?: string, referrer?: string): string {
  const base = proxyBase.trim().replace(/\/$/, '')
  if (!base) return url
  if (url.startsWith(base)) return url
  const params = new URLSearchParams({ url })
  if (userAgent) params.set('ua', userAgent)
  if (referrer) params.set('referer', referrer)
  return `${base}/proxy?${params.toString()}`
}
