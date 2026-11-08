import { computed, signal } from '@preact/signals'
import type {
  Channel,
  EpgSource,
  Episode,
  Playable,
  PlayKind,
  Position,
  Programme,
  ScheduledRec,
  SeriesItem,
  Settings,
  Shelf,
  Source,
  Toast,
  View,
  VodItem,
} from './types'
import { filterChannels, groupOptions } from './lib/browse'
import { kvGet, kvSet } from './lib/db'
import { currentAndNext, mergeProgrammeMaps, programmesFor } from './lib/epg'
import { parseXmltv } from './lib/xmltv'
import { buildCatchupUrl, finalize, m3uEpgUrls, parseM3u, playlistProblem } from './lib/m3u'
import { isLightClient, loadSameOriginCatalog } from './lib/catalog'
import { errorMessage, fetchText, fetchXmlMaybeGzip } from './lib/net'
import { applyProxy } from './lib/stream'
import { hashString } from './lib/text'
import { OFFICIAL_ADULT_DRAFTS } from './data/adult-official'
import { enterPlayerFullscreen, exitPlayerFullscreen } from './lib/fullscreen'
import { fetchEpisodes, loadXtream, normalizeBase } from './lib/xtream'

const NSFW_URLS = [
  { id: 'org-nsfw', url: 'https://iptv-org.github.io/iptv/index.nsfw.m3u' },
  { id: 'org-xxx', url: 'https://iptv-org.github.io/iptv/categories/xxx.m3u' },
]

const BUILTIN_SOURCES: Source[] = [
  { id: 'org-fr', kind: 'm3u-url', role: 'country', name: 'iptv-org · France', url: 'https://iptv-org.github.io/iptv/countries/fr.m3u', enabled: true, builtin: true },
  { id: 'org-sports', kind: 'm3u-url', role: 'category', name: 'iptv-org · Sport', url: 'https://iptv-org.github.io/iptv/categories/sports.m3u', enabled: true, builtin: true },
  { id: 'org-fra', kind: 'm3u-url', role: 'language', name: 'iptv-org · langue française', url: 'https://iptv-org.github.io/iptv/languages/fra.m3u', enabled: true, builtin: true },
  { id: 'org-index', kind: 'm3u-url', role: 'full', name: 'iptv-org · index complet', url: 'https://iptv-org.github.io/iptv/index.m3u', enabled: true, builtin: true },
  { id: 'org-country', kind: 'm3u-url', role: 'country', name: 'iptv-org · index par pays', url: 'https://iptv-org.github.io/iptv/index.country.m3u', enabled: true, builtin: true },
  { id: 'org-category', kind: 'm3u-url', role: 'category', name: 'iptv-org · index par catégorie', url: 'https://iptv-org.github.io/iptv/index.category.m3u', enabled: true, builtin: true },
  { id: 'org-language', kind: 'm3u-url', role: 'language', name: 'iptv-org · index par langue', url: 'https://iptv-org.github.io/iptv/index.language.m3u', enabled: true, builtin: true },
]

const BUILTIN_EPG: EpgSource[] = [
  { id: 'epg-pluto-fr', name: 'Pluto TV · France', url: 'https://raw.githubusercontent.com/matthuisman/i.mjh.nz/master/PlutoTV/fr.xml.gz', enabled: true, builtin: true },
  { id: 'epg-samsung-fr', name: 'Samsung TV Plus · France', url: 'https://raw.githubusercontent.com/matthuisman/i.mjh.nz/master/SamsungTVPlus/fr.xml.gz', enabled: true, builtin: true },
  { id: 'epg-plex-fr', name: 'Plex · France', url: 'https://raw.githubusercontent.com/matthuisman/i.mjh.nz/master/Plex/fr.xml.gz', enabled: true, builtin: true },
]

const defaultSettings: Settings = {
  bufferSec: 20,
  qualityCap: 0,
  resumeLast: true,
  autoSkip: true,
  dedupeFeed: true,
  hideDead: true,
  pinHash: null,
  adultConsent: false,
  proxyBase: '',
  tvLarge: false,
  lastChannelId: null,
  lastSafeChannelId: null,
}

const viewStack = signal<View[]>(['home'])
export const view = computed(() => viewStack.value[viewStack.value.length - 1] ?? 'home')
export const channels = signal<Channel[]>([])
export const adultChannels = signal<Channel[]>([])
export const adultUnlocked = signal(false)
export const adultLoading = signal(false)
export const adultMessage = signal('')
export const loading = signal('')
export const loadError = signal('')
export const partialCatalog = signal(false)
export const catalogTotal = signal(0)
export const indexed = signal(false)
export const query = signal('')
export const shelf = signal<Shelf>('all')
export const groupBy = signal<'country' | 'category' | 'language' | 'source'>('country')
export const group = signal('FR')
export const favorites = signal<string[]>([])
export const recents = signal<string[]>([])
export const hidden = signal<string[]>([])
export const dead = signal<string[]>([])
export const settings = signal<Settings>(defaultSettings)
export const sources = signal<Source[]>(BUILTIN_SOURCES)
export const screenError = computed(() => {
  const lines: string[] = []
  if (loadError.value) lines.push(loadError.value)
  for (const source of sources.value) {
    if (source.builtin || !source.lastError) continue
    if (loadError.value.includes(source.lastError)) continue
    lines.push(`${source.name} : ${source.lastError}`)
  }
  return lines.join('\n')
})
export const epgSources = signal<EpgSource[]>(BUILTIN_EPG)
export const currentId = signal<string | null>(null)
export const previousId = signal<string | null>(null)
export const playToken = signal(0)
export const playKind = signal<PlayKind>('live')
export const nowMs = signal(Date.now())
export const epgIndex = signal<Map<string, Programme[]>>(new Map())
export const toasts = signal<Toast[]>([])
export const numberEntry = signal('')
export const playerStatus = signal('')
export const playerFatal = signal('')
export const needsGesture = signal(false)
export const vodItems = signal<VodItem[]>([])
export const seriesItems = signal<SeriesItem[]>([])
export const episodes = signal<Record<string, Episode[]>>({})
export const positions = signal<Record<string, Position>>({})
export const scheduled = signal<ScheduledRec[]>([])
export const activeSchedule = signal<ScheduledRec | null>(null)
export const manualRecording = signal(false)
export const zapList = signal<Channel[]>([])
export const canInstall = signal(false)
export const moreOpen = signal(false)
export const resumedFrom = signal(0)

const browseBase = {
  get channels() { return channels.value },
  get adult() { return adultChannels.value },
  get hidden() { return hidden.value },
  get dead() { return dead.value },
  get hideDead() { return settings.value.hideDead },
  get favorites() { return favorites.value },
  get recents() { return recents.value },
  groupBy: 'country' as const,
  group: 'ALL',
  query: '',
}

export const sportShelf = computed(() => filterChannels({ ...browseBase, includeAdult: false, shelf: 'sport' }))
export const combatShelf = computed(() => filterChannels({ ...browseBase, includeAdult: false, shelf: 'combat' }))
export const franceShelf = computed(() => filterChannels({ ...browseBase, includeAdult: false, shelf: 'france' }))
export const fastShelf = computed(() => filterChannels({ ...browseBase, includeAdult: false, shelf: 'fast' }))
export const newsShelf = computed(() => filterChannels({ ...browseBase, includeAdult: false, shelf: 'news' }))
export const movieShelf = computed(() => filterChannels({ ...browseBase, includeAdult: false, shelf: 'movies' }))
export const seriesShelf = computed(() => filterChannels({ ...browseBase, includeAdult: false, shelf: 'series' }))
export const directList = computed(() => filterChannels({
  channels: channels.value,
  adult: adultChannels.value,
  includeAdult: adultUnlocked.value,
  shelf: shelf.value,
  groupBy: groupBy.value,
  group: group.value,
  query: query.value,
  hidden: hidden.value,
  dead: dead.value,
  hideDead: settings.value.hideDead,
  favorites: favorites.value,
  recents: recents.value,
}))
export const searchList = computed(() => {
  if (!query.value.trim()) return []
  return filterChannels({
    channels: channels.value,
    adult: adultChannels.value,
    includeAdult: adultUnlocked.value,
    shelf: 'all',
    groupBy: 'country',
    group: 'ALL',
    query: query.value,
    hidden: hidden.value,
    dead: dead.value,
    hideDead: settings.value.hideDead,
    favorites: favorites.value,
    recents: recents.value,
  })
})
export const groups = computed(() => groupOptions(channels.value, groupBy.value))

let booted = false
let toastSeq = 1
let skipStreak = 0
let queued: Playable | null = null
let pendingAdultId: string | null = null
const fails: Record<string, number> = {}
const positionWritten = new Map<string, number>()
let pinFails = 0
let pinLockedUntil = 0
let installEvent: { prompt: () => Promise<void> } | null = null

export const hotkeys = {
  mute: () => undefined as void,
  fullscreen: () => undefined as void,
  info: () => undefined as void,
  record: () => undefined as void,
  play: () => undefined as void,
}
export const multiHooks: { zap: ((delta: number) => void) | null } = { zap: null }

export function go(next: View): void {
  moreOpen.value = false
  viewStack.value = next === 'home' ? ['home'] : ['home', next]
}

export function back(): void {
  if (moreOpen.value) {
    moreOpen.value = false
    return
  }
  if (viewStack.value.length > 1) viewStack.value = ['home']
}

export function toast(text: string, tone: Toast['tone'] = 'info'): void {
  const id = toastSeq
  toastSeq += 1
  toasts.value = [...toasts.value, { id, text, tone }].slice(-3)
  window.setTimeout(() => {
    toasts.value = toasts.value.filter((item) => item.id !== id)
  }, 4600)
}

export function findChannel(id: string | null): Channel | undefined {
  if (!id) return undefined
  return channels.value.find((channel) => channel.id === id) ?? adultChannels.value.find((channel) => channel.id === id)
}

export function guideFor(channel: Channel): { current?: Programme; next?: Programme } {
  return currentAndNext(programmesFor(channel, epgIndex.value), nowMs.value)
}

export function consumePlayable(): Playable | null {
  const item = queued
  queued = null
  return item
}

export function captureInstall(event: Event): void {
  event.preventDefault()
  installEvent = event as Event & { prompt: () => Promise<void> }
  canInstall.value = true
}

export async function promptInstall(): Promise<void> {
  if (!installEvent) return
  await installEvent.prompt()
  installEvent = null
  canInstall.value = false
}

function queue(item: Playable): void {
  queued = item
  playKind.value = item.kind
  currentId.value = item.id
  playToken.value += 1
  playerFatal.value = ''
  playerStatus.value = ''
  needsGesture.value = false
  resumedFrom.value = item.startAt && item.startAt > 10 ? item.startAt : 0
  if (typeof history !== 'undefined' && !history.state?.player) history.pushState({ player: true }, '')
}

export function closePlayer(fromHistory = false): void {
  exitPlayerFullscreen()
  currentId.value = null
  playToken.value += 1
  playerFatal.value = ''
  playerStatus.value = ''
  needsGesture.value = false
  queued = null
  if (!fromHistory && typeof history !== 'undefined' && history.state?.player) history.back()
}

export function toPlayable(channel: Channel, kind: PlayKind, startAt?: number): Playable {
  const proxy = settings.value.proxyBase
  return {
    id: channel.id,
    title: channel.name,
    kind,
    logo: channel.logo,
    startAt,
    urls: channel.urls.map((item) => ({
      ...item,
      url: applyProxy(item.url, proxy, item.userAgent, item.referrer),
    })),
  }
}

export function playChannel(id: string, list?: Channel[], fullscreen = false): void {
  const channel = findChannel(id)
  if (!channel) return
  if (channel.adult && !adultUnlocked.value) {
    pendingAdultId = id
    go('adult')
    return
  }
  if (fullscreen) enterPlayerFullscreen()
  if (currentId.value && currentId.value !== id) previousId.value = currentId.value
  if (list) zapList.value = list
  const safe = channel.adult
    ? settings.value
    : { ...settings.value, lastChannelId: id, lastSafeChannelId: id }
  settings.value = { ...safe, lastChannelId: id }
  queue(toPlayable(channel, 'live'))
  void persistPrefs()
  if (view.value === 'home') go('direct')
}

export function playVod(item: VodItem): void {
  if (item.adult && !adultUnlocked.value) {
    go('adult')
    toast('Cette vidéo est dans la catégorie Adulte.')
    return
  }
  enterPlayerFullscreen()
  const saved = positions.value[item.id]
  queue({
    id: item.id,
    title: item.name,
    kind: 'vod',
    logo: item.poster,
    startAt: saved?.position,
    urls: [{ url: applyProxy(item.url, settings.value.proxyBase), quality: 1 }],
  })
  go('direct')
  if (saved && saved.position > 10) toast(`Reprise à ${Math.floor(saved.position / 60)} min`)
}

export function playEpisode(series: SeriesItem, episode: Episode): void {
  if (series.adult && !adultUnlocked.value) {
    go('adult')
    return
  }
  enterPlayerFullscreen()
  const saved = positions.value[episode.id]
  queue({
    id: episode.id,
    title: `${series.name} · ${episode.title}`,
    kind: 'series',
    logo: series.poster,
    startAt: saved?.position,
    urls: [{ url: applyProxy(episode.url, settings.value.proxyBase), quality: 1 }],
  })
  go('direct')
}

export function playReplay(channel: Channel, programme: Programme): void {
  const url = buildCatchupUrl(channel, programme.start, programme.stop)
  if (!url) {
    toast('Replay indisponible pour cette chaîne. Il faut un serveur Xtream avec archive, ou un attribut catchup dans la liste.', 'warn')
    return
  }
  enterPlayerFullscreen()
  queue({
    id: `${channel.id}@${programme.start}`,
    title: programme.title,
    kind: 'replay',
    logo: channel.logo,
    startAt: positions.value[`${channel.id}@${programme.start}`]?.position,
    urls: [{ url: applyProxy(url, settings.value.proxyBase), quality: 1 }],
  })
  go('direct')
}

export function restartFromBeginning(): void {
  resumedFrom.value = 0
  const video = document.querySelector('video')
  if (video) video.currentTime = 0
}

export function zap(delta: number): void {
  const list = zapList.value.length ? zapList.value : directList.value
  if (!list.length) return
  const index = list.findIndex((channel) => channel.id === currentId.value)
  const next = list[(index + delta + list.length) % list.length]
  if (next) playChannel(next.id, list)
}

export function zapToNumber(value: number): void {
  const list = zapList.value.length ? zapList.value : directList.value
  const channel = list[value - 1]
  if (!channel) {
    toast('Numéro hors de la liste affichée.', 'warn')
    return
  }
  playChannel(channel.id, list)
}

export function playPrevious(): void {
  if (previousId.value) playChannel(previousId.value)
}

export function noteFailure(id: string | null): void {
  if (!id) return
  fails[id] = (fails[id] ?? 0) + 1
  if (fails[id] >= 2 && !dead.value.includes(id)) {
    dead.value = [...dead.value, id]
    void persistPrefs()
  }
  if (!settings.value.autoSkip) return
  if (skipStreak >= 8) {
    toast('Plusieurs chaînes ne répondent pas. La lecture est en pause.', 'warn')
    return
  }
  skipStreak += 1
  toast('Chaîne indisponible. Passage à la suivante.', 'warn')
  zap(1)
}

export function noteHealthy(id: string): void {
  skipStreak = 0
  delete fails[id]
  if (dead.value.includes(id)) dead.value = dead.value.filter((item) => item !== id)
  recents.value = [id, ...recents.value.filter((item) => item !== id)].slice(0, 30)
  void persistPrefs()
}

export function savePosition(id: string, position: number, duration: number, title: string): void {
  const now = Date.now()
  if (now - (positionWritten.get(id) ?? 0) < 5000) return
  positionWritten.set(id, now)
  positions.value = { ...positions.value, [id]: { position, duration, updated: now, title } }
  void persistPrefs()
}

export function toggleFavorite(id: string): void {
  favorites.value = favorites.value.includes(id) ? favorites.value.filter((item) => item !== id) : [...favorites.value, id]
  void persistPrefs()
}

export function moveFavorite(id: string, dir: -1 | 1): void {
  const list = [...favorites.value]
  const index = list.indexOf(id)
  const target = index + dir
  if (index < 0 || target < 0 || target >= list.length) return
  const [item] = list.splice(index, 1)
  list.splice(target, 0, item)
  favorites.value = list
  void persistPrefs()
}

export function hideChannel(id: string): void {
  if (!hidden.value.includes(id)) hidden.value = [...hidden.value, id]
  toast('Chaîne masquée.')
  void persistPrefs()
}

export function restoreHidden(): void {
  hidden.value = []
  toast('Chaînes masquées réaffichées.')
  void persistPrefs()
}

export function restoreDead(): void {
  dead.value = []
  toast('Les chaînes hors service seront réessayées.')
  void persistPrefs()
}

export function updateSettings(patch: Partial<Settings>): void {
  settings.value = { ...settings.value, ...patch }
  void persistPrefs()
}

export function openShelf(next: Shelf): void {
  shelf.value = next
  query.value = ''
  go('direct')
}

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`le-poste-v1|${pin}`)
  if (crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', data)
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  return `fnv:${hashString(`${pin}|le-poste`)}`
}

export function pinCooldown(): number {
  return Math.max(0, pinLockedUntil - Date.now())
}

export async function createPin(pin: string, confirm: string, consent: boolean): Promise<string | null> {
  if (!consent) return 'Confirmez avoir 18 ans ou plus.'
  if (!/^\d{4}$/.test(pin)) return 'Le code doit comporter 4 chiffres.'
  if (pin !== confirm) return 'Les deux codes ne correspondent pas.'
  settings.value = { ...settings.value, pinHash: await hashPin(pin), adultConsent: true }
  await persistPrefs()
  await unlockWithHash(pin)
  return null
}

export async function enterPin(pin: string): Promise<string | null> {
  if (pinCooldown() > 0) return 'Trop d’essais. Patientez quelques secondes.'
  if (!settings.value.pinHash) return 'Créez d’abord un code.'
  if ((await hashPin(pin)) !== settings.value.pinHash) {
    pinFails += 1
    if (pinFails >= 5) {
      pinLockedUntil = Date.now() + 30000
      pinFails = 0
      return 'Trop d’essais. Patientez 30 secondes.'
    }
    return 'Code incorrect.'
  }
  pinFails = 0
  await unlockWithHash(pin)
  return null
}

async function unlockWithHash(_pin: string): Promise<void> {
  adultUnlocked.value = true
  await ensureAdultLoaded()
  const pending = pendingAdultId
  pendingAdultId = null
  if (pending) playChannel(pending)
}

export function lockAdult(): void {
  adultUnlocked.value = false
  const current = findChannel(currentId.value)
  if (current?.adult) {
    currentId.value = null
    playToken.value += 1
    queued = null
  }
  if (view.value === 'adult') go('home')
  toast('Catégorie Adulte verrouillée.')
}

export async function changePin(current: string, next: string, confirm: string): Promise<string | null> {
  if (!settings.value.pinHash) return 'Aucun code n’est défini.'
  if ((await hashPin(current)) !== settings.value.pinHash) return 'Code actuel incorrect.'
  if (!/^\d{4}$/.test(next)) return 'Le nouveau code doit comporter 4 chiffres.'
  if (next !== confirm) return 'Les deux codes ne correspondent pas.'
  settings.value = { ...settings.value, pinHash: await hashPin(next) }
  await persistPrefs()
  toast('Code parental modifié.')
  return null
}

export async function ensureAdultLoaded(): Promise<void> {
  adultLoading.value = true
  adultMessage.value = ''
  try {
    const userAdult = (await kvGet<Channel[]>('adult-user')) ?? []
    const cached = (await kvGet<Channel[]>('adult-nsfw')) ?? []
    const updated = (await kvGet<number>('adult-nsfw-at')) ?? 0
    adultChannels.value = cached.concat(userAdult)
    if (!cached.length || Date.now() - updated > 12 * 60 * 60 * 1000) await fetchNsfw()
    else if (!adultChannels.value.length) adultMessage.value = emptyAdultMessage()
  } finally {
    adultLoading.value = false
  }
}

export async function fetchNsfw(): Promise<void> {
  adultLoading.value = true
  const drafts = [...OFFICIAL_ADULT_DRAFTS]
  const errors: string[] = []
  for (const source of NSFW_URLS) {
    try {
      const text = await fetchText(source.url)
      drafts.push(...parseM3u(text, { id: source.id, role: 'adult' }))
    } catch (error) {
      errors.push(`${source.url} (${errorMessage(error)})`)
    }
  }
  const { adult } = finalize(drafts, settings.value.dedupeFeed)
  const userAdult = (await kvGet<Channel[]>('adult-user')) ?? adultChannels.value.filter((channel) => channel.sourceId !== 'org-nsfw' && channel.sourceId !== 'org-xxx')
  adultChannels.value = adult.concat(userAdult)
  await kvSet('adult-nsfw', adult)
  await kvSet('adult-nsfw-at', Date.now())
  adultLoading.value = false
  if (!adult.length) adultMessage.value = emptyAdultMessage(errors)
  else adultMessage.value = ''
}

function emptyAdultMessage(errors: string[] = []): string {
  const detail = errors.length ? ` Dernière tentative : ${errors[0]}.` : ''
  return `Aucun flux adulte officiel et gratuit n’a répondu de façon lisible (vérification du 8 novembre 2026). Les rediffusions de chaînes payantes ne sont pas intégrées. iptv-org ne publie plus cette catégorie.${detail} Vous pouvez ajouter votre propre source : les chaînes classées adultes y seront rangées, et resteront invisibles ailleurs tant que le code n’est pas saisi.`
}

export function scheduleRecording(channel: Channel, programme: Programme): void {
  if (channel.adult && !adultUnlocked.value) {
    go('adult')
    return
  }
  const item: ScheduledRec = {
    id: `rec-${programme.start}-${channel.id}`,
    channelId: channel.id,
    title: programme.title,
    start: programme.start,
    stop: programme.stop,
    status: 'pending',
  }
  scheduled.value = [item, ...scheduled.value.filter((job) => job.id !== item.id)]
  toast(`Enregistrement programmé : ${programme.title}. Laissez IPTV Gladiator ouvert.`)
  void persistPrefs()
}

export function finishSchedule(id: string, ok: boolean, error?: string): void {
  scheduled.value = scheduled.value.map((job) => job.id === id ? { ...job, status: ok ? 'done' : 'error', error } : job)
  if (activeSchedule.value?.id === id) activeSchedule.value = null
  void persistPrefs()
}

function tickSchedule(): void {
  const now = Date.now()
  let changed = false
  scheduled.value = scheduled.value.map((job) => {
    if (job.status === 'pending' && now > job.stop) {
      changed = true
      return { ...job, status: 'error', error: 'L’application était fermée pendant le créneau.' }
    }
    return job
  })
  if (changed) void persistPrefs()
  if (activeSchedule.value) return
  const due = scheduled.value.find((job) => job.status === 'pending' && now >= job.start && now < job.stop)
  if (!due) return
  const channel = findChannel(due.channelId)
  if (!channel || (channel.adult && !adultUnlocked.value)) {
    finishSchedule(due.id, false, 'Chaîne indisponible pour l’enregistrement.')
    return
  }
  scheduled.value = scheduled.value.map((job) => job.id === due.id ? { ...job, status: 'recording' } : job)
  activeSchedule.value = { ...due, status: 'recording' }
  void persistPrefs()
}

async function persistPrefs(): Promise<void> {
  await kvSet('settings', settings.value)
  await kvSet('favorites', favorites.value)
  await kvSet('recents', recents.value)
  await kvSet('hidden', hidden.value)
  await kvSet('dead', dead.value)
  await kvSet('positions', positions.value)
  await kvSet('scheduled', scheduled.value)
  await kvSet('epgSources', epgSources.value)
  await kvSet('sources', sources.value)
}

function mergeSources(saved: Source[] | undefined): Source[] {
  const previous = new Map((saved ?? []).map((source) => [source.id, source]))
  const builtins = BUILTIN_SOURCES.map((source) => {
    const old = previous.get(source.id)
    return { ...source, enabled: old?.enabled ?? source.enabled, lastSync: old?.lastSync, lastError: old?.lastError, channelCount: old?.channelCount }
  })
  const users = (saved ?? []).filter((source) => !source.builtin && !BUILTIN_SOURCES.some((item) => item.id === source.id))
  return [...builtins, ...users]
}

function mergeEpg(saved: EpgSource[] | undefined): EpgSource[] {
  const previous = new Map((saved ?? []).map((source) => [source.id, source]))
  const builtins = BUILTIN_EPG.map((source) => ({ ...source, ...(previous.get(source.id) ?? {}), ...source, enabled: previous.get(source.id)?.enabled ?? true }))
  const users = (saved ?? []).filter((source) => !source.builtin)
  return [...builtins, ...users]
}

async function readSource(source: Source): Promise<{ source: Source; drafts: ReturnType<typeof parseM3u>; epg: string[] }> {
  if (!source.enabled) return { source, drafts: [], epg: [] }
  try {
    if (source.kind === 'm3u-url' && source.url) {
      const text = await fetchText(source.url)
      const problem = playlistProblem(text)
      if (problem) throw new Error(problem)
      const drafts = parseM3u(text, { id: source.id, role: source.role === 'adult' ? 'user' : source.role })
      if (!drafts.length) throw new Error(`Parse : 0 chaîne reconnue. Début : ${text.replace(/\s+/g, ' ').trim().slice(0, 180)}`)
      return { source: { ...source, lastSync: Date.now(), lastError: undefined, channelCount: drafts.length }, drafts, epg: source.role === 'user' ? m3uEpgUrls(text) : [] }
    }
    if (source.kind === 'm3u-file') {
      const text = (await kvGet<string>(`file:${source.id}`)) ?? ''
      const drafts = parseM3u(text, { id: source.id, role: 'user' })
      return { source: { ...source, lastSync: Date.now(), lastError: undefined, channelCount: drafts.length }, drafts, epg: m3uEpgUrls(text) }
    }
    if (source.kind === 'xtream' && source.url && source.username && source.password) {
      const loaded = await loadXtream({ base: source.url, username: source.username, password: source.password }, source.id)
      vodItems.value = vodItems.value.filter((item) => item.sourceId !== source.id).concat(loaded.vod)
      seriesItems.value = seriesItems.value.filter((item) => item.sourceId !== source.id).concat(loaded.series)
      return { source: { ...source, lastSync: Date.now(), lastError: undefined, channelCount: loaded.drafts.length }, drafts: loaded.drafts, epg: [] }
    }
    return { source, drafts: [], epg: [] }
  } catch (error) {
    return { source: { ...source, lastError: errorMessage(error) }, drafts: [], epg: [] }
  }
}

function rememberEpg(urls: string[]): void {
  let changed = false
  const next = [...epgSources.value]
  for (const url of urls) {
    if (next.some((source) => source.url === url)) continue
    next.push({ id: `epg-${hashString(url)}`, name: 'Guide de la liste', url, enabled: true })
    changed = true
  }
  if (changed) epgSources.value = next
}

const FREE_GROUP = 'Listes gratuites'

function streamKey(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return url
  }
}

function isFreeChannel(channel: Channel): boolean {
  return channel.sourceId === 'catalog' || channel.sourceId.startsWith('org-') || (channel.sourceNames ?? []).includes(FREE_GROUP)
}

function stripSource(list: Channel[], sourceId: string, name: string): Channel[] {
  const next: Channel[] = []
  for (const channel of list) {
    const names = (channel.sourceNames ?? []).filter((item) => item !== name)
    if (!isFreeChannel(channel) && channel.sourceId === sourceId) continue
    next.push(names.length && names.length !== (channel.sourceNames ?? []).length ? { ...channel, sourceNames: names } : channel)
  }
  return next
}

function attachUser(base: Channel[], extra: Channel[], name: string, sourceId: string): Channel[] {
  const out: Channel[] = base.map((channel) => ({ ...channel, sourceNames: [...(channel.sourceNames ?? [channel.sourceName || FREE_GROUP])] }))
  const byUrl = new Map<string, Channel>()
  for (const channel of out) {
    for (const item of channel.urls) byUrl.set(streamKey(item.url), channel)
  }
  for (const channel of extra) {
    const key = channel.urls[0] ? streamKey(channel.urls[0].url) : channel.id
    const found = byUrl.get(key)
    if (found) {
      if (!found.sourceNames?.includes(name)) found.sourceNames = [...(found.sourceNames ?? []), name]
      continue
    }
    const created: Channel = { ...channel, sourceId, sourceName: name, sourceNames: [name] }
    byUrl.set(key, created)
    out.push(created)
  }
  return out
}

function restorePersonal(catalog: Channel[], personal: Channel[]): Channel[] {
  const bySource = new Map<string, Channel[]>()
  for (const channel of personal) {
    const bucket = bySource.get(channel.sourceId) ?? []
    bucket.push(channel)
    bySource.set(channel.sourceId, bucket)
  }
  let next = catalog
  for (const [sourceId, list] of bySource) next = attachUser(next, list, list[0]?.sourceName || 'Source', sourceId)
  return next
}

async function paintCatalog(full: boolean): Promise<void> {
  const personal = channels.value.filter((channel) => !isFreeChannel(channel))
  const loaded = await loadSameOriginCatalog({
    full,
    onBatch: (list) => {
      channels.value = restorePersonal(list, personal)
    },
  })
  channels.value = restorePersonal(loaded.channels, personal)
  partialCatalog.value = loaded.partial
  catalogTotal.value = loaded.total
  indexed.value = loaded.channels.length > 0
  if (!isLightClient()) {
    try {
      await kvSet('channels', channels.value)
      await kvSet('channelsUpdated', Date.now())
    } catch {
      /* Le téléviseur refuse parfois d’enregistrer tout le catalogue. */
    }
  }
}

async function mergeOneSource(source: Source): Promise<number> {
  if (source.builtin || !source.enabled) {
    channels.value = stripSource(channels.value, source.id, source.name)
    return 0
  }
  const part = await readSource(source)
  sources.value = sources.value.map((item) => item.id === source.id ? part.source : item)
  if (part.source.lastError && part.drafts.length === 0) throw new Error(part.source.lastError)
  const result = finalize(part.drafts, settings.value.dedupeFeed)
  channels.value = attachUser(stripSource(channels.value, source.id, source.name), result.channels, source.name, source.id)
  const previousAdult = (await kvGet<Channel[]>('adult-user')) ?? []
  const adult = result.adult.map((channel) => ({ ...channel, sourceId: source.id, sourceName: source.name, sourceNames: [source.name] }))
  const nextAdult = attachUser(previousAdult.filter((channel) => channel.sourceId !== source.id), adult, source.name, source.id)
  await kvSet('adult-user', nextAdult)
  if (adultUnlocked.value) {
    const nsfw = adultChannels.value.filter((channel) => channel.sourceId === 'org-nsfw' || channel.sourceId === 'org-xxx')
    adultChannels.value = nsfw.concat(nextAdult)
  }
  rememberEpg(part.epg)
  await persistPrefs()
  return channels.value.filter((channel) => (channel.sourceNames ?? []).includes(source.name)).length
}

async function mergeEnabledUsers(): Promise<void> {
  for (const source of sources.value.filter((item) => !item.builtin && item.enabled)) {
    try {
      await mergeOneSource(source)
    } catch (error) {
      sources.value = sources.value.map((item) => item.id === source.id ? { ...item, lastError: errorMessage(error) } : item)
    }
  }
}

export async function retryLoad(): Promise<void> {
  loading.value = 'Catalogue gratuit…'
  loadError.value = ''
  try {
    await paintCatalog(!isLightClient())
  } catch (error) {
    loadError.value = `Le catalogue gratuit n’a pas pu être chargé. ${errorMessage(error)}`
  }
  loading.value = 'Sources personnelles…'
  await mergeEnabledUsers()
  loading.value = ''
  const userFailed = sources.value.some((source) => !source.builtin && source.lastError)
  if (!channels.value.length && !loadError.value && !userFailed) {
    loadError.value = 'Aucune chaîne gratuite n’est disponible pour le moment.'
  }
  await persistPrefs()
}

export async function loadFullCatalog(): Promise<void> {
  loading.value = 'Chargement de tout le catalogue gratuit…'
  try {
    await paintCatalog(true)
    loadError.value = ''
  } catch (error) {
    loadError.value = `Le catalogue complet n’a pas pu être chargé. ${errorMessage(error)}`
  }
  await mergeEnabledUsers()
  loading.value = ''
}

export async function refreshSources(): Promise<void> {
  await retryLoad()
}

export async function refreshEpg(): Promise<void> {
  loading.value = loading.value || 'Guide des programmes…'
  let map: Record<string, Programme[]> = {}
  const next = []
  for (const source of epgSources.value) {
    if (!source.enabled) {
      next.push(source)
      continue
    }
    try {
      const xml = await fetchXmlMaybeGzip(source.url)
      const parsed = parseXmltv(xml)
      map = mergeProgrammeMaps(map, parsed)
      const count = Object.entries(parsed).filter(([key]) => key.startsWith('id:')).reduce((sum, [, list]) => sum + list.length, 0)
      next.push({ ...source, lastSync: Date.now(), lastError: undefined, programmeCount: count })
    } catch (error) {
      next.push({ ...source, lastError: errorMessage(error) })
    }
  }
  epgSources.value = next
  epgIndex.value = new Map(Object.entries(map))
  await kvSet('epg', map)
  await kvSet('epgUpdated', Date.now())
  if (loading.value === 'Guide des programmes…') loading.value = ''
  await persistPrefs()
}

function showSource(name: string): void {
  shelf.value = 'all'
  groupBy.value = 'source'
  group.value = name
  query.value = ''
  go('direct')
}

export async function addM3uUrl(url: string, name: string): Promise<void> {
  if (!/^https?:\/\//i.test(url.trim())) throw new Error('Indiquez une adresse http ou https.')
  const source: Source = { id: `user-${hashString(url)}`, kind: 'm3u-url', role: 'user', name: name || 'Liste M3U', url: url.trim(), enabled: true }
  sources.value = [...sources.value.filter((item) => item.id !== source.id), source]
  const count = await mergeOneSource(source)
  loadError.value = ''
  toast(`${count.toLocaleString('fr-FR')} chaînes dans « ${source.name} ». Les listes gratuites restent chargées.`)
  showSource(source.name)
}

export async function addM3uFile(name: string, text: string): Promise<void> {
  const source: Source = { id: `file-${hashString(name + text.slice(0, 80))}`, kind: 'm3u-file', role: 'user', name: name || 'Fichier M3U', enabled: true }
  await kvSet(`file:${source.id}`, text)
  sources.value = [...sources.value.filter((item) => item.id !== source.id), source]
  const count = await mergeOneSource(source)
  loadError.value = ''
  toast(`${count.toLocaleString('fr-FR')} chaînes importées. Les listes gratuites restent chargées.`)
  showSource(source.name)
}

export async function addXtream(base: string, username: string, password: string, name: string): Promise<void> {
  if (!base.trim() || !username.trim() || !password) throw new Error('Serveur, identifiant et mot de passe sont requis.')
  const source: Source = {
    id: `xtream-${hashString(base + username)}`,
    kind: 'xtream',
    role: 'user',
    name: name || 'Xtream Codes',
    url: normalizeBase(base),
    username: username.trim(),
    password,
    enabled: true,
  }
  sources.value = [...sources.value.filter((item) => item.id !== source.id), source]
  const count = await mergeOneSource(source)
  loadError.value = ''
  toast(`${count.toLocaleString('fr-FR')} chaînes dans « ${source.name} ». Les listes gratuites restent chargées.`)
  showSource(source.name)
}

export async function removeSource(id: string): Promise<void> {
  const source = sources.value.find((item) => item.id === id)
  if (!source || source.builtin) return
  sources.value = sources.value.filter((item) => item.id !== id)
  channels.value = stripSource(channels.value, source.id, source.name)
  vodItems.value = vodItems.value.filter((item) => item.sourceId !== id)
  seriesItems.value = seriesItems.value.filter((item) => item.sourceId !== id)
  const adult = ((await kvGet<Channel[]>('adult-user')) ?? []).filter((channel) => channel.sourceId !== id)
  await kvSet('adult-user', adult)
  if (adultUnlocked.value) {
    const nsfw = adultChannels.value.filter((channel) => channel.sourceId === 'org-nsfw' || channel.sourceId === 'org-xxx')
    adultChannels.value = nsfw.concat(adult)
  }
  await persistPrefs()
  toast('Source retirée. Les chaînes gratuites restent en place.')
}

export async function toggleSource(id: string): Promise<void> {
  const source = sources.value.find((item) => item.id === id)
  if (!source || source.builtin) return
  const next = { ...source, enabled: !source.enabled }
  sources.value = sources.value.map((item) => item.id === id ? next : item)
  if (!next.enabled) {
    channels.value = stripSource(channels.value, source.id, source.name)
    await persistPrefs()
    return
  }
  await mergeOneSource(next)
}

export async function addEpgUrl(url: string, name: string): Promise<void> {
  epgSources.value = [...epgSources.value, { id: `epg-${hashString(url)}`, name: name || 'Guide XMLTV', url, enabled: true }]
  await refreshEpg()
  toast('Guide ajouté.')
}

export async function removeEpg(id: string): Promise<void> {
  const source = epgSources.value.find((item) => item.id === id)
  if (!source || source.builtin) return
  epgSources.value = epgSources.value.filter((item) => item.id !== id)
  await refreshEpg()
}

export async function toggleEpg(id: string): Promise<void> {
  epgSources.value = epgSources.value.map((source) => source.id === id ? { ...source, enabled: !source.enabled } : source)
  await refreshEpg()
}

export async function openSeries(item: SeriesItem): Promise<void> {
  if (episodes.value[item.id]) return
  try {
    const list = await fetchEpisodes(item)
    episodes.value = { ...episodes.value, [item.id]: list }
  } catch (error) {
    toast(errorMessage(error), 'bad')
  }
}

export async function boot(): Promise<void> {
  if (booted) return
  booted = true
  window.setInterval(() => { nowMs.value = Date.now() }, 20000)
  window.addEventListener('popstate', () => {
    if (currentId.value) closePlayer(true)
  })
  window.setInterval(() => tickSchedule(), 5000)
  const savedSettings = await kvGet<Settings>('settings')
  settings.value = { ...defaultSettings, ...(savedSettings ?? {}) }
  sources.value = mergeSources(await kvGet<Source[]>('sources'))
  epgSources.value = mergeEpg(await kvGet<EpgSource[]>('epgSources'))
  favorites.value = (await kvGet<string[]>('favorites')) ?? []
  recents.value = (await kvGet<string[]>('recents')) ?? []
  hidden.value = (await kvGet<string[]>('hidden')) ?? []
  dead.value = (await kvGet<string[]>('dead')) ?? []
  positions.value = (await kvGet<Record<string, Position>>('positions')) ?? {}
  scheduled.value = (await kvGet<ScheduledRec[]>('scheduled')) ?? []
  vodItems.value = (await kvGet<VodItem[]>('vod')) ?? []
  seriesItems.value = (await kvGet<SeriesItem[]>('series')) ?? []
  channels.value = (await kvGet<Channel[]>('channels')) ?? []
  const epg = await kvGet<Record<string, Programme[]>>('epg')
  if (epg) epgIndex.value = new Map(Object.entries(epg))
  const epgUpdated = (await kvGet<number>('epgUpdated')) ?? 0
  await retryLoad()
  if (!epg || Date.now() - epgUpdated > 6 * 60 * 60 * 1000) void refreshEpg()
  if (settings.value.resumeLast && settings.value.lastSafeChannelId && findChannel(settings.value.lastSafeChannelId)) {
    go('direct')
    playChannel(settings.value.lastSafeChannelId)
  }
}
