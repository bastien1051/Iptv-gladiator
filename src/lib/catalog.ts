import type { Channel, FastService } from '../types'
import { categoryLabel, countryLabel, fastLabel, languageLabel, normName } from './text'

const FREE = 'Listes gratuites'
const FAST: FastService[] = ['pluto', 'samsung', 'plex', 'rakuten', 'roku']

export type CatalogTuple = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  number,
  number,
  string,
  string,
]

export type CatalogManifest = {
  version: number
  generated: string
  count: number
  priorityCount: number
  files: string[]
}

export function isLightClient(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Tizen|SMART-TV|SmartTV|Web0S|WebOS|BRAVIA|HbbTV|AFT|TV Safari/i.test(navigator.userAgent)
}

export function decodeTuple(row: CatalogTuple): Channel | null {
  const url = row[2]
  if (!url) return null
  const categories = row[7] ? row[7].split(',').filter(Boolean) : []
  const languages = row[6] ? [row[6]] : []
  const fast = row[9] > 0 ? FAST[row[9] - 1] : undefined
  const channel: Channel = {
    id: row[0],
    name: row[1] || 'Chaîne',
    urls: [{ url, userAgent: row[10] || undefined, referrer: row[11] || undefined, quality: 1 }],
    logo: row[3] || undefined,
    tvgId: row[4] || undefined,
    country: row[5] || undefined,
    languages,
    categories,
    adult: false,
    combat: row[8] === 1,
    fast,
    sourceId: 'catalog',
    sourceName: FREE,
    sourceNames: [FREE],
    searchBlob: '',
  }
  channel.searchBlob = normName(
    [
      channel.name,
      channel.country ? countryLabel(channel.country) : '',
      ...channel.categories.map(categoryLabel),
      ...channel.languages.map(languageLabel),
      channel.fast ? fastLabel(channel.fast) : '',
      channel.combat ? 'sports de combat boxe mma catch kickboxing' : '',
      channel.categories.includes('sports') ? 'sport' : '',
    ].join(' '),
  )
  return channel
}

export async function loadSameOriginCatalog(options: {
  full: boolean
  onBatch?: (channels: Channel[], partial: boolean) => void
}): Promise<{ channels: Channel[]; partial: boolean; total: number }> {
  const manifestUrl = new URL('channels/manifest.json', document.baseURI)
  const response = await fetch(manifestUrl.toString())
  if (!response.ok) throw new Error(`Catalogue introuvable (HTTP ${response.status})`)
  const manifest = (await response.json()) as CatalogManifest
  const files = options.full ? manifest.files : manifest.files.filter((file) => file.startsWith('p'))
  const channels: Channel[] = []
  for (const file of files) {
    const chunkUrl = new URL(`channels/${file}`, document.baseURI)
    const chunk = await fetch(chunkUrl.toString())
    if (!chunk.ok) throw new Error(`Morceau ${file} indisponible`)
    const rows = (await chunk.json()) as CatalogTuple[]
    for (const row of rows) {
      const channel = decodeTuple(row)
      if (channel) channels.push(channel)
    }
    options.onBatch?.(channels.slice(), files.length < manifest.files.length)
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  return {
    channels,
    partial: files.length < manifest.files.length,
    total: manifest.count,
  }
}
