import type { Channel, GroupBy, Shelf } from '../types'
import { categoryLabel, countryLabel, languageLabel, normName } from './text'

export type BrowseInput = {
  channels: Channel[]
  adult: Channel[]
  includeAdult: boolean
  shelf: Shelf
  groupBy: GroupBy
  group: string
  query: string
  hidden: string[]
  dead: string[]
  hideDead: boolean
  favorites: string[]
  recents: string[]
}

function passes(channel: Channel, hidden: Set<string>, dead: Set<string>, hideDead: boolean, includeAdult: boolean): boolean {
  if (hidden.has(channel.id)) return false
  if (hideDead && dead.has(channel.id)) return false
  if (channel.adult && !includeAdult) return false
  return true
}

function byName(a: Channel, b: Channel): number {
  return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
}

function featuredRank(channel: Channel): number {
  if (channel.country === 'FR') return 0
  if (channel.languages.includes('fra')) return 1
  return 2
}

export function filterChannels(input: BrowseInput): Channel[] {
  const hidden = new Set(input.hidden)
  const dead = new Set(input.dead)
  const query = normName(input.query)
  let pool: Channel[]
  if (input.shelf === 'adult') pool = input.adult
  else if (query || input.shelf === 'favorites' || input.shelf === 'recents') {
    pool = input.includeAdult ? input.channels.concat(input.adult) : input.channels
  } else pool = input.channels

  let list = pool.filter((channel) => passes(channel, hidden, dead, input.hideDead, input.includeAdult || input.shelf === 'adult'))

  if (input.shelf === 'sport') list = list.filter((channel) => channel.categories.includes('sports'))
  else if (input.shelf === 'combat') list = list.filter((channel) => channel.combat)
  else if (input.shelf === 'france') list = list.filter((channel) => channel.country === 'FR')
  else if (input.shelf === 'fast') list = list.filter((channel) => !!channel.fast)
  else if (input.shelf === 'news') {
    list = list.filter((channel) => channel.categories.includes('news') && (channel.country === 'FR' || channel.languages.includes('fra')))
  } else if (input.shelf === 'movies') list = list.filter((channel) => channel.categories.includes('movies'))
  else if (input.shelf === 'series') list = list.filter((channel) => channel.categories.includes('series'))
  else if (input.shelf === 'adult') list = list.filter((channel) => channel.adult)
  else if (input.shelf === 'all' && input.group !== 'ALL') {
    if (input.groupBy === 'country') list = list.filter((channel) => (channel.country ?? 'INT') === input.group)
    else if (input.groupBy === 'category') {
      list = list.filter((channel) =>
        input.group === 'undefined' ? channel.categories.length === 0 : channel.categories.includes(input.group),
      )
    } else if (input.groupBy === 'source') {
      list = list.filter((channel) => sourceNamesOf(channel).includes(input.group))
    } else list = list.filter((channel) => channel.languages.includes(input.group))
  }

  if (query) list = list.filter((channel) => channel.searchBlob.includes(query))

  if (input.shelf === 'favorites') {
    const order = new Map(input.favorites.map((id, index) => [id, index]))
    list = list.filter((channel) => order.has(channel.id))
    list.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    return list
  }
  if (input.shelf === 'recents') {
    const order = new Map(input.recents.map((id, index) => [id, index]))
    list = list.filter((channel) => order.has(channel.id))
    list.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    return list
  }
  if (input.shelf === 'sport' || input.shelf === 'combat' || input.shelf === 'fast' || input.shelf === 'news' || input.shelf === 'france') {
    list.sort((a, b) => featuredRank(a) - featuredRank(b) || byName(a, b))
    return list
  }
  list.sort(byName)
  return list
}

function sourceNamesOf(channel: Channel): string[] {
  if (channel.sourceNames && channel.sourceNames.length) return channel.sourceNames
  return [channel.sourceName || 'Listes gratuites']
}

export function groupOptions(channels: Channel[], groupBy: GroupBy): { id: string; label: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const channel of channels) {
    if (channel.adult) continue
    if (groupBy === 'country') {
      const id = channel.country ?? 'INT'
      counts.set(id, (counts.get(id) ?? 0) + 1)
    } else if (groupBy === 'category') {
      const ids = channel.categories.length ? channel.categories : ['undefined']
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
    } else if (groupBy === 'source') {
      for (const id of sourceNamesOf(channel)) counts.set(id, (counts.get(id) ?? 0) + 1)
    } else {
      for (const id of channel.languages) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  const options = [...counts.entries()].map(([id, count]) => ({
    id,
    count,
    label: groupBy === 'country' ? countryLabel(id) : groupBy === 'category' ? categoryLabel(id) : groupBy === 'source' ? id : languageLabel(id),
  }))
  options.sort((a, b) => {
    if (a.id === 'FR' || a.id === 'fra' || a.id === 'Listes gratuites') return -1
    if (b.id === 'FR' || b.id === 'fra' || b.id === 'Listes gratuites') return 1
    return b.count - a.count || a.label.localeCompare(b.label, 'fr')
  })
  return options
}
