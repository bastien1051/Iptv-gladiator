import type { Draft, Episode, Role, SeriesItem, VodItem } from '../types'
import { fetchJson } from './net'
import { hashString, parseDuration } from './text'
import { isAdultChannel } from './classify'

export type XtreamAuth = { base: string; username: string; password: string }

export function normalizeBase(input: string): string {
  let value = input.trim()
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`
  const url = new URL(value)
  let path = url.pathname.replace(/\/player_api\.php$/i, '').replace(/\/get\.php$/i, '')
  if (path.endsWith('/')) path = path.slice(0, -1)
  return `${url.origin}${path}`
}

export function xtreamFromUrl(raw: string): XtreamAuth | null {
  try {
    const url = new URL(raw)
    const username = url.searchParams.get('username')
    const password = url.searchParams.get('password')
    if (!username || !password) return null
    return { base: normalizeBase(raw), username, password }
  } catch {
    return null
  }
}

function api(auth: XtreamAuth, params: Record<string, string> = {}): string {
  const url = new URL(`${auth.base}/player_api.php`)
  url.searchParams.set('username', auth.username)
  url.searchParams.set('password', auth.password)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return url.toString()
}

function enc(value: string): string {
  return encodeURIComponent(value)
}

export function liveStreamUrl(auth: XtreamAuth, streamId: string | number): string {
  return `${auth.base}/live/${enc(auth.username)}/${enc(auth.password)}/${streamId}.m3u8`
}

export function movieStreamUrl(auth: XtreamAuth, streamId: string | number, ext = 'mp4'): string {
  return `${auth.base}/movie/${enc(auth.username)}/${enc(auth.password)}/${streamId}.${ext || 'mp4'}`
}

export function seriesStreamUrl(auth: XtreamAuth, episodeId: string | number, ext = 'mp4'): string {
  return `${auth.base}/series/${enc(auth.username)}/${enc(auth.password)}/${episodeId}.${ext || 'mp4'}`
}

type Row = Record<string, unknown>

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((item): item is Row => !!item && typeof item === 'object') : []
}

function text(row: Row, key: string): string {
  const value = row[key]
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

export async function loadXtream(auth: XtreamAuth, sourceId: string): Promise<{ drafts: Draft[]; vod: VodItem[]; series: SeriesItem[] }> {
  const liveStreams = await fetchJson<unknown>(api(auth, { action: 'get_live_streams' }))
  if (!Array.isArray(liveStreams)) {
    const hint = JSON.stringify(liveStreams ?? null).replace(/\s+/g, ' ').slice(0, 180)
    throw new Error(`Parse Xtream : get_live_streams n’est pas une liste. Début : ${hint}`)
  }
  const [liveCategories, vodCategories, vodStreams, seriesCategories, series] = await Promise.all([
    fetchJson<unknown>(api(auth, { action: 'get_live_categories' })).catch(() => []),
    fetchJson<unknown>(api(auth, { action: 'get_vod_categories' })).catch(() => []),
    fetchJson<unknown>(api(auth, { action: 'get_vod_streams' })).catch(() => []),
    fetchJson<unknown>(api(auth, { action: 'get_series_categories' })).catch(() => []),
    fetchJson<unknown>(api(auth, { action: 'get_series' })).catch(() => []),
  ])
  const liveNames = new Map(asRows(liveCategories).map((row) => [text(row, 'category_id'), text(row, 'category_name')]))
  const vodNames = new Map(asRows(vodCategories).map((row) => [text(row, 'category_id'), text(row, 'category_name')]))
  const seriesNames = new Map(asRows(seriesCategories).map((row) => [text(row, 'category_id'), text(row, 'category_name')]))

  const drafts: Draft[] = asRows(liveStreams).map((row) => {
    const name = text(row, 'name') || 'Chaîne'
    const group = liveNames.get(text(row, 'category_id')) || ''
    const streamId = text(row, 'stream_id')
    const direct = text(row, 'direct_source')
    const archiveDays = Number(text(row, 'tv_archive_duration') || text(row, 'tv_archive') || 0)
    const role: Role = isAdultChannel(name, group, [], false) ? 'adult' : 'user'
    const draft: Draft = {
      name,
      url: /^https?:\/\//i.test(direct) ? direct : liveStreamUrl(auth, streamId),
      logo: text(row, 'stream_icon') || undefined,
      tvgId: text(row, 'epg_channel_id') || undefined,
      groupTitle: group,
      sourceId,
      role,
      catchupDays: archiveDays > 0 ? archiveDays : undefined,
      catchupType: archiveDays > 0 ? 'xc' : undefined,
      origin: archiveDays > 0 ? { ...auth, streamId, archiveDays } : undefined,
    }
    return draft
  }).filter((draft) => draft.url)

  const vod: VodItem[] = asRows(vodStreams).map((row) => {
    const name = text(row, 'name') || 'Film'
    const genre = text(row, 'genre') || vodNames.get(text(row, 'category_id')) || ''
    const ext = text(row, 'container_extension') || 'mp4'
    const id = text(row, 'stream_id')
    return {
      id: `vod:${sourceId}:${id || hashString(name)}`,
      sourceId,
      name,
      poster: text(row, 'stream_icon') || undefined,
      plot: text(row, 'plot') || undefined,
      genre: genre || undefined,
      year: text(row, 'year') || text(row, 'releasedate') || undefined,
      durationSec: parseDuration(row.duration),
      rating: text(row, 'rating') || undefined,
      url: movieStreamUrl(auth, id, ext),
      container: ext,
      adult: isAdultChannel(name, `${genre} ${vodNames.get(text(row, 'category_id')) || ''}`, [], false),
    }
  })

  const seriesItems: SeriesItem[] = asRows(series).map((row) => {
    const name = text(row, 'name') || 'Série'
    const genre = text(row, 'genre') || seriesNames.get(text(row, 'category_id')) || ''
    const seriesId = text(row, 'series_id')
    return {
      id: `series:${sourceId}:${seriesId || hashString(name)}`,
      sourceId,
      seriesId,
      name,
      poster: text(row, 'cover') || text(row, 'stream_icon') || undefined,
      plot: text(row, 'plot') || undefined,
      genre: genre || undefined,
      year: text(row, 'releaseDate') || text(row, 'year') || undefined,
      adult: isAdultChannel(name, genre, [], false),
      ...auth,
    }
  })

  return { drafts, vod, series: seriesItems }
}

export async function fetchEpisodes(item: SeriesItem): Promise<Episode[]> {
  const auth = { base: item.base, username: item.username, password: item.password }
  const payload = await fetchJson<Row>(api(auth, { action: 'get_series_info', series_id: item.seriesId }))
  const episodes = payload.episodes
  if (!episodes || typeof episodes !== 'object') return []
  const list: Episode[] = []
  for (const [seasonKey, value] of Object.entries(episodes as Record<string, unknown>)) {
    for (const row of asRows(value)) {
      const id = text(row, 'id')
      const ext = text(row, 'container_extension') || 'mp4'
      const info = row.info && typeof row.info === 'object' ? (row.info as Row) : {}
      list.push({
        id: id || `${item.seriesId}-${seasonKey}-${text(row, 'episode_num')}`,
        season: Number(seasonKey) || Number(text(row, 'season')) || 1,
        episode: Number(text(row, 'episode_num')) || list.length + 1,
        title: text(row, 'title') || `Épisode ${text(row, 'episode_num') || ''}`.trim(),
        url: seriesStreamUrl(auth, id, ext),
        container: ext,
        plot: text(info, 'plot') || undefined,
        durationSec: parseDuration(info.duration),
      })
    }
  }
  list.sort((a, b) => a.season - b.season || a.episode - b.episode)
  return list
}
