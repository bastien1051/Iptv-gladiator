import { groupOptions } from '../lib/browse'
import type { Shelf, View } from '../types'
import { channels, go, group, groupBy, libraryTab, openBrowse, query, shelf, view } from '../store'

type Item = {
  id: string
  label: string
  test?: string
  active: boolean
  run: () => void
}

export function Sidebar() {
  const current = view.value
  const items: Item[] = [
    { id: 'home', label: 'Accueil', active: current === 'home', run: () => go('home') },
    { id: 'direct', label: 'Direct', test: 'nav-direct', active: current === 'direct' && shelf.value === 'all', run: () => openBrowse('all') },
    { id: 'tnt', label: 'TNT France', test: 'nav-tnt-side', active: current === 'direct' && shelf.value === 'tnt', run: () => openBrowse('tnt') },
    { id: 'sport', label: 'Sports', test: 'nav-sports', active: current === 'direct' && shelf.value === 'sport', run: () => openBrowse('sport') },
    { id: 'combat', label: 'Sports de combat', test: 'nav-combat', active: current === 'direct' && shelf.value === 'combat', run: () => openBrowse('combat') },
    { id: 'films', label: 'Films', active: current === 'library' && libraryTab.value === 'films', run: () => { libraryTab.value = 'films'; go('library') } },
    { id: 'series', label: 'Séries', active: current === 'library' && libraryTab.value === 'series', run: () => { libraryTab.value = 'series'; go('library') } },
    { id: 'replay', label: 'Replay', active: current === 'replay', run: () => go('replay') },
    { id: 'favorites', label: 'Favoris', test: 'nav-favorites', active: current === 'direct' && shelf.value === 'favorites', run: () => openBrowse('favorites') },
    { id: 'guide', label: 'Guide TV', active: current === 'guide', run: () => go('guide') },
    { id: 'adult', label: 'Adulte 18+', test: 'nav-adult', active: current === 'adult', run: () => go('adult') },
    { id: 'lists', label: 'Mes listes', test: 'nav-abonnement', active: current === 'abonnement', run: () => go('abonnement') },
    { id: 'settings', label: 'Réglages', active: current === 'settings', run: () => go('settings') },
  ]
  const categories = groupOptions(channels.value, 'category').slice(0, 24)
  const showCategories = current === 'direct'
  return (
    <nav class="rail" aria-label="Sections">
      <p class="mark">IPTV<br />Gladiator</p>
      <p class="rail-label">Sections</p>
      {items.map((item) => (
        <button key={item.id} type="button" data-nav data-testid={item.test} class={item.active ? 'nav-btn on' : 'nav-btn'} onClick={item.run}>
          {item.label}
        </button>
      ))}
      {showCategories && (
        <>
          <p class="rail-label">Catégories</p>
          <button type="button" data-nav class={shelf.value === 'all' && group.value === 'ALL' ? 'nav-cat on' : 'nav-cat'} onClick={() => { shelf.value = 'all'; groupBy.value = 'category'; group.value = 'ALL'; query.value = ''; go('direct') }}>
            Toutes
          </button>
          {categories.map((option) => (
            <button key={option.id} type="button" data-nav class={shelf.value === 'all' && group.value === option.id ? 'nav-cat on' : 'nav-cat'} onClick={() => { shelf.value = 'all'; groupBy.value = 'category'; group.value = option.id; query.value = ''; go('direct') }}>
              {option.label}
              <span>{option.count.toLocaleString('fr-FR')}</span>
            </button>
          ))}
        </>
      )}
      <button type="button" data-nav class={current === 'help' ? 'nav-btn on' : 'nav-btn'} onClick={() => go('help')}>Aide</button>
      <button type="button" data-nav class={current === 'about' ? 'nav-btn on' : 'nav-btn'} onClick={() => go('about')}>À propos</button>
    </nav>
  )
}

export function openMobileSection(id: string): void {
  const shelves: Record<string, Shelf> = {
    direct: 'all',
    tnt: 'tnt',
    sport: 'sport',
    combat: 'combat',
    favorites: 'favorites',
  }
  if (id === 'films') {
    libraryTab.value = 'films'
    go('library')
    return
  }
  if (id === 'series') {
    libraryTab.value = 'series'
    go('library')
    return
  }
  if (shelves[id]) {
    openBrowse(shelves[id])
    return
  }
  go(id as View)
}
