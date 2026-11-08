import { useEffect, useState } from 'preact/hooks'
import type { Shelf } from '../types'
import { phoneLayout } from '../lib/phone'
import { VirtualList, useRowFocus } from './VirtualList'
import { ChannelButton } from './rows'
import { currentId, directList, findChannel, group, groupBy, groups, query, shelf, zapList } from '../store'

const CHIPS: { id: Shelf; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'france', label: 'France' },
  { id: 'sport', label: 'Sport' },
  { id: 'combat', label: 'Combats' },
  { id: 'fast', label: 'Gratuites' },
  { id: 'news', label: 'Info' },
  { id: 'favorites', label: 'Favoris' },
  { id: 'recents', label: 'Récents' },
]

export function ChannelPane() {
  const list = directList.value
  const focusRef = useRowFocus(72)
  const [phone, setPhone] = useState(phoneLayout())
  const [filtersOpen, setFiltersOpen] = useState(false)
  useEffect(() => {
    if (!findChannel(currentId.value)?.adult) zapList.value = list
  }, [list])
  useEffect(() => {
    const queryMedia = window.matchMedia('(max-width: 980px), (max-height: 520px)')
    const onChange = () => setPhone(queryMedia.matches)
    onChange()
    queryMedia.addEventListener('change', onChange)
    return () => queryMedia.removeEventListener('change', onChange)
  }, [])

  const filterBody = (
    <>
      <div class="chips scroll">
        {CHIPS.map((chip) => (
          <button key={chip.id} type="button" data-nav class={shelf.value === chip.id ? 'chip on' : 'chip'} onClick={() => { shelf.value = chip.id }}>{chip.label}</button>
        ))}
        {shelf.value === 'all' && (['country', 'category', 'language', 'source'] as const).map((mode) => (
          <button key={mode} type="button" data-nav class={groupBy.value === mode ? 'chip on' : 'chip'} onClick={() => { groupBy.value = mode; group.value = mode === 'country' ? 'FR' : mode === 'source' ? 'Listes gratuites' : 'ALL' }}>
            {mode === 'country' ? 'Pays' : mode === 'category' ? 'Catégorie' : mode === 'language' ? 'Langue' : 'Source'}
          </button>
        ))}
      </div>
      {shelf.value === 'all' && (
        <label class="group-select">
          <span class="sr">Groupe</span>
          <select data-nav value={group.value} onChange={(event) => { group.value = (event.currentTarget as HTMLSelectElement).value }}>
            <option value="ALL">Tous les groupes</option>
            {groups.value.slice(0, 80).map((option) => (
              <option key={option.id} value={option.id}>{option.label} · {option.count.toLocaleString('fr-FR')}</option>
            ))}
          </select>
        </label>
      )}
    </>
  )

  return (
    <section class="direct" data-testid="direct">
      <header class="pane-head">
        <div class="phone-tools">
          <label class="search">
            <span class="sr">Rechercher</span>
            <input data-nav data-testid="direct-search" value={query.value} placeholder="Rechercher" onInput={(event) => { query.value = (event.currentTarget as HTMLInputElement).value }} />
          </label>
          {phone && (
            <button type="button" class="chip" data-nav data-testid="filters" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>
              {filtersOpen ? 'Masquer' : 'Filtres'}
            </button>
          )}
        </div>
        {phone ? (filtersOpen ? <div class="filter-drawer" data-testid="filter-drawer">{filterBody}</div> : null) : filterBody}
        <p class="count">{list.length.toLocaleString('fr-FR')} chaîne{list.length > 1 ? 's' : ''}</p>
      </header>
      <div ref={focusRef} data-row-count={list.length} class="list-wrap">
        {list.length === 0 ? <p class="empty">Aucune chaîne à afficher. Ajustez la recherche ou réaffichez les chaînes masquées dans les réglages.</p> : (
          <VirtualList items={list} rowHeight={72} render={(channel, index) => <ChannelButton channel={channel} index={index} list={list} />} />
        )}
      </div>
    </section>
  )
}
