import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { finalize, parseM3u } from '../src/lib/m3u.ts'
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
  const priority = legal.filter(isPriority)
  const rest = legal.filter((channel) => !isPriority(channel))
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
  const manifest = {
    version: 1,
    generated: new Date().toISOString(),
    count: legal.length,
    priorityCount: priority.length,
    files,
    sources: urls.length,
    failed,
    fastPlaylists: fast.length,
  }
  await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest))
  const names = await readdir(OUT)
  process.stdout.write(`FREE_CHANNELS ${legal.length}\nPRIORITY ${priority.length}\nFILES ${names.length}\nFAST_PLAYLISTS ${fast.length}\nFAILED ${failed}\n`)
}

await main()
