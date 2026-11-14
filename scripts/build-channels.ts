import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { TNT_ENTRIES, officialStreamHost } from '../src/data/tnt-france.ts'
import { finalize, normUrl, parseM3u } from '../src/lib/m3u.ts'
import { prefilterUrl, probeStream, shouldRetry, type DropReason } from '../src/lib/stream-health.ts'
import type { Channel, Draft, FastService } from '../src/types.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'public', 'channels')
const CHUNK = 350
const FREE = 'Listes gratuites'

const INDEXES = [
  'https://iptv-org.github.io/iptv/index.m3u',
  'https://iptv-org.github.io/iptv/index.country.m3u',
  'https://iptv-org.github.io/iptv/index.category.m3u',
  'https://iptv-org.github.io/iptv/index.language.m3u',
]

const FAST_INDEX: Record<string, number> = { pluto: 1, samsung: 2, plex: 3, rakuten: 4, roku: 5 }

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'user-agent': 'IPTVGladiator/1.0' } })
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`)
  return response.text()
}

async function fastPlaylistUrls(): Promise<string[]> {
  const response = await fetch('https://api.github.com/repos/iptv-org/iptv/git/trees/master?recursive=1', {
    headers: { 'user-agent': 'IPTVGladiator/1.0', accept: 'application/vnd.github+json' },
  })
  if (!response.ok) return []
  const data = (await response.json()) as { tree?: { path: string }[] }
  const keys = ['pluto', 'samsung', 'plex', 'roku', 'rakuten', 'tubi', 'stirr', 'xumo']
  return (data.tree ?? [])
    .map((item) => item.path)
    .filter((name) => name.startsWith('streams/') && name.endsWith('.m3u') && keys.some((key) => name.includes(key)))
    .map((name) => `https://raw.githubusercontent.com/iptv-org/iptv/master/${name}`)
}

function encode(channel: Channel): unknown[] {
  const best = channel.urls[0]
  return [
    channel.id,
    channel.name,
    best?.url ?? '',
    channel.logo ?? '',
    channel.tvgId ?? '',
    channel.country ?? '',
    channel.languages[0] ?? '',
    channel.categories.join(','),
    channel.combat ? 1 : 0,
    channel.fast ? FAST_INDEX[channel.fast as FastService] ?? 0 : 0,
    best?.userAgent ?? '',
    best?.referrer ?? '',
  ]
}

function isPriority(channel: Channel): boolean {
  return channel.country === 'FR' || channel.languages.includes('fra') || channel.categories.includes('sports') || channel.combat || !!channel.fast
}

function wantProbe(): boolean {
  if (process.env.PROBE_STREAMS === '0') return false
  if (process.env.PROBE_STREAMS === '1') return true
  return process.env.GITHUB_ACTIONS === 'true'
}

async function loadLabels(): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  try {
    const response = await fetch('https://iptv-org.github.io/api/streams.json', { headers: { 'user-agent': 'IPTVGladiator/1.0' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const rows = (await response.json()) as { url?: string; labels?: string[] }[]
    for (const row of rows) {
      if (!row.url) continue
      const key = normUrl(row.url)
      map.set(key, [...(map.get(key) ?? []), ...(row.labels ?? [])])
    }
    process.stdout.write(`STREAMS_API ${rows.length}\n`)
  } catch (error) {
    process.stdout.write(`STREAMS_API skip ${error instanceof Error ? error.message : error}\n`)
  }
  return map
}

function tally(list: Channel[]): Record<string, number> {
  const out: Record<string, number> = { total: list.length, france: 0, fast: 0, combat: 0 }
  for (const channel of list) {
    if (channel.country === 'FR') out.france += 1
    if (channel.fast) out.fast += 1
    if (channel.combat) out.combat += 1
    for (const category of channel.categories) out[category] = (out[category] ?? 0) + 1
    if (!channel.categories.length) out.uncategorized = (out.uncategorized ?? 0) + 1
  }
  return out
}

async function screenChannel(channel: Channel, labels: Map<string, string[]>, probing: boolean, timeout: number, bump: (reason: DropReason) => void): Promise<Channel | null> {
  const urls: Channel['urls'] = []
  let attempts = 0
  for (const item of channel.urls) {
    const labeled = prefilterUrl({ name: channel.name, url: item.url, labels: labels.get(normUrl(item.url)) })
    if (labeled) {
      bump(labeled)
      continue
    }
    if (!probing) {
      urls.push(item)
      continue
    }
    if (attempts >= 2) continue
    attempts += 1
    let result = await probeStream(item.url, timeout)
    if (!result.ok && shouldRetry(result.reason)) result = await probeStream(item.url, timeout)
    if (result.ok) {
      urls.push(item)
      break
    }
    bump(result.reason)
  }
  if (!urls.length) return null
  return { ...channel, urls }
}

async function keepHealthy(channels: Channel[], labels: Map<string, string[]>): Promise<{ kept: Channel[]; dropped: Record<string, number> }> {
  const dropped: Record<string, number> = {}
  const bump = (reason: DropReason) => {
    dropped[reason] = (dropped[reason] ?? 0) + 1
  }
  const probing = wantProbe()
  const timeout = Number(process.env.PROBE_TIMEOUT_MS || 8000)
  const concurrency = Math.max(1, Number(process.env.PROBE_CONCURRENCY || 48))
  const kept = new Array<Channel | undefined>(channels.length)
  let cursor = 0
  let done = 0
  async function worker(): Promise<void> {
    while (cursor < channels.length) {
      const index = cursor
      cursor += 1
      kept[index] = (await screenChannel(channels[index], labels, probing, timeout, bump)) ?? undefined
      done += 1
      if (probing && done % 400 === 0) process.stdout.write(`PROBE ${done}/${channels.length}\n`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(channels.length, 1)) }, () => worker()))
  return { kept: kept.filter((channel): channel is Channel => !!channel), dropped }
}

async function main(): Promise<void> {
  const fast = await fastPlaylistUrls()
  const urls = [...INDEXES, ...fast]
  const drafts: Draft[] = []
  let failed = 0
  for (const url of urls) {
    try {
      const text = await fetchText(url)
      const id = url.includes('/streams/') ? `fast-${path.basename(url, '.m3u')}` : `org-${path.basename(url, '.m3u')}`
      drafts.push(...parseM3u(text, { id, role: url.endsWith('/index.m3u') ? 'full' : 'category' }))
      process.stdout.write(`ok ${drafts.length} ${url}\n`)
    } catch (error) {
      failed += 1
      process.stdout.write(`skip ${url} ${error instanceof Error ? error.message : error}\n`)
    }
  }
  const { channels } = finalize(drafts, true)
  const legal = channels.filter((channel) => !channel.adult).map((channel) => ({
    ...channel,
    sourceId: 'catalog',
    sourceName: FREE,
    sourceNames: [FREE],
  }))
  const labels = await loadLabels()
  const before = tally(legal)
  const { kept, dropped } = await keepHealthy(legal, labels)
  const after = tally(kept)
  if (wantProbe() && kept.length < 400) {
    throw new Error(`Catalogue trop réduit après contrôle (${kept.length} chaînes). Déploiement annulé.`)
  }
  const priority = kept.filter(isPriority)
  const rest = kept.filter((channel) => !isPriority(channel))
  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })
  const files: string[] = []
  const writeChunks = async (list: Channel[], prefix: string) => {
    for (let index = 0; index * CHUNK < list.length; index += 1) {
      const name = `${prefix}${index}.json`
      files.push(name)
      await writeFile(path.join(OUT, name), JSON.stringify(list.slice(index * CHUNK, (index + 1) * CHUNK).map(encode)))
    }
  }
  await writeChunks(priority, 'p')
  await writeChunks(rest, 'r')
  const health = {
    generated: new Date().toISOString(),
    probed: wantProbe(),
    vantage: 'Build machine (GitHub-hosted runners are not in the EU). Geo-blocked and Not 24/7 labels from iptv-org are removed. Streams are not fetched through a proxy.',
    timeoutMs: Number(process.env.PROBE_TIMEOUT_MS || 8000),
    before,
    after,
    dropped,
  }
  const manifest = {
    version: 1,
    generated: health.generated,
    count: kept.length,
    priorityCount: priority.length,
    files,
    sources: urls.length,
    failed,
    fastPlaylists: fast.length,
    health,
  }
  await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest))
  await writeFile(path.join(OUT, 'health-report.json'), JSON.stringify(health, null, 2))
  await writeTnt(OUT)
  const names = await readdir(OUT)
  const sections = ['total', 'movies', 'series', 'sports', 'news', 'france', 'fast', 'combat']
  for (const key of sections) {
    process.stdout.write(`SECTION ${key} ${before[key] ?? 0} -> ${after[key] ?? 0}\n`)
  }
  process.stdout.write(`DROPPED ${JSON.stringify(dropped)}\n`)
  process.stdout.write(`FREE_CHANNELS ${kept.length}\nPRIORITY ${priority.length}\nFILES ${names.length}\nFAST_PLAYLISTS ${fast.length}\nFAILED ${failed}\n`)
}

async function writeTnt(dir: string): Promise<void> {
  const probing = wantProbe()
  const slots = []
  for (const entry of TNT_ENTRIES) {
    let streamUrl: string | null = null
    if (probing) {
      for (const url of entry.streams) {
        if (!officialStreamHost(url)) continue
        let result = await probeStream(url, Number(process.env.PROBE_TIMEOUT_MS || 8000))
        if (!result.ok && shouldRetry(result.reason)) result = await probeStream(url, Number(process.env.PROBE_TIMEOUT_MS || 8000))
        if (result.ok) {
          streamUrl = url
          break
        }
      }
    }
    slots.push({ id: entry.id, number: entry.number, name: entry.name, officialUrl: entry.officialUrl, streamUrl })
    process.stdout.write(`TNT ${entry.number ?? '-'} ${entry.name} ${streamUrl ? 'stream' : 'site'}\n`)
  }
  await writeFile(path.join(dir, 'tnt.json'), JSON.stringify({ generated: new Date().toISOString(), slots }))
}

await main()
