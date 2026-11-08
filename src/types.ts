export type Role = 'full' | 'country' | 'category' | 'language' | 'user' | 'adult'

export type FastService = 'pluto' | 'samsung' | 'plex' | 'rakuten' | 'roku'

export type StreamUrl = {
  url: string
  userAgent?: string
  referrer?: string
  quality: number
}

export type Catchup = {
  type?: string
  days?: number
  source?: string
}

export type XtreamOrigin = {
  base: string
  username: string
  password: string
  streamId: string
  archiveDays: number
}

export type Channel = {
  id: string
  name: string
  urls: StreamUrl[]
  logo?: string
  tvgId?: string
  country?: string
  languages: string[]
  categories: string[]
  catchup?: Catchup
  origin?: XtreamOrigin
  adult: boolean
  combat: boolean
  fast?: FastService
  searchBlob: string
  sourceId: string
  sourceName?: string
  sourceNames?: string[]
}

export type Draft = {
  name: string
  url: string
  logo?: string
  tvgId?: string
  groupTitle: string
  userAgent?: string
  referrer?: string
  catchupType?: string
  catchupDays?: number
  catchupSource?: string
  tvgLanguage?: string
  sourceId: string
  role: Role
  origin?: XtreamOrigin
}

export type Programme = {
  start: number
  stop: number
  title: string
  subtitle?: string
  desc?: string
  category?: string
}

export type Source = {
  id: string
  kind: 'm3u-url' | 'm3u-file' | 'xtream'
  role: Role
  name: string
  url?: string
  username?: string
  password?: string
  enabled: boolean
  builtin?: boolean
  lastSync?: number
  lastError?: string
  channelCount?: number
}

export type EpgSource = {
  id: string
  name: string
  url: string
  enabled: boolean
  builtin?: boolean
  lastSync?: number
  lastError?: string
  programmeCount?: number
}

export type Settings = {
  bufferSec: number
  qualityCap: number
  resumeLast: boolean
  autoSkip: boolean
  dedupeFeed: boolean
  hideDead: boolean
  pinHash: string | null
  adultConsent: boolean
  proxyBase: string
  tvLarge: boolean
  lastChannelId: string | null
  lastSafeChannelId: string | null
}

export type VodItem = {
  id: string
  sourceId: string
  name: string
  poster?: string
  plot?: string
  genre?: string
  year?: string
  durationSec?: number
  rating?: string
  url: string
  container?: string
  adult: boolean
}

export type SeriesItem = {
  id: string
  sourceId: string
  seriesId: string
  name: string
  poster?: string
  plot?: string
  genre?: string
  year?: string
  adult: boolean
  base: string
  username: string
  password: string
}

export type Episode = {
  id: string
  season: number
  episode: number
  title: string
  url: string
  container?: string
  plot?: string
  durationSec?: number
}

export type Position = {
  position: number
  duration: number
  updated: number
  title: string
}

export type ScheduledRec = {
  id: string
  channelId: string
  title: string
  start: number
  stop: number
  status: 'pending' | 'recording' | 'done' | 'error'
  error?: string
}

export type View =
  | 'home'
  | 'direct'
  | 'guide'
  | 'library'
  | 'replay'
  | 'multi'
  | 'adult'
  | 'settings'
  | 'about'
  | 'help'
  | 'abonnement'

export type Shelf =
  | 'all'
  | 'sport'
  | 'combat'
  | 'france'
  | 'fast'
  | 'news'
  | 'favorites'
  | 'recents'
  | 'adult'
  | 'movies'
  | 'series'

export type GroupBy = 'country' | 'category' | 'language' | 'source'

export type PlayKind = 'live' | 'vod' | 'series' | 'replay'

export type Playable = {
  id: string
  title: string
  urls: StreamUrl[]
  kind: PlayKind
  logo?: string
  startAt?: number
}

export type QualityLevel = { index: number; label: string; height: number }
export type TrackChoice = { index: number; label: string; lang: string }

export type Toast = { id: number; text: string; tone: 'info' | 'warn' | 'bad' }
