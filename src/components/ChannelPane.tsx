import { useEffect } from 'preact/hooks'
import { VirtualList, useRowFocus } from './VirtualList'
import { ChannelButton } from './rows'
import { TntBlock } from './TntBlock'
import { currentId, directList, findChannel, query, shelf, zapList } from '../store'

export function ChannelPane() {
  const list = directList.value
  const focusRef = useRowFocus(72)
  const tntOnly = shelf.value === 'tnt'
  const showStrip = shelf.value === 'all' && !query.value.trim()
  useEffect(() => {
    if (!findChannel(currentId.value)?.adult) zapList.value = list
  }, [list])

  return (
    <section class="direct" data-testid="direct">
      <header class="pane-head">
        <label class="search">
          <span class="sr">Rechercher</span>
          <input data-nav data-testid="direct-search" value={query.value} placeholder="Rechercher une chaîne" onInput={(event) => { query.value = (event.currentTarget as HTMLInputElement).value }} />
        </label>
        <p class="count">{tntOnly ? 'TNT France' : `${list.length.toLocaleString('fr-FR')} chaîne${list.length > 1 ? 's' : ''}`}</p>
      </header>
      {showStrip && <TntBlock mode="strip" />}
      {tntOnly && (
        <div class="list-wrap">
          <TntBlock mode="list" />
        </div>
      )}
      {!tntOnly && (
      <div ref={focusRef} data-row-count={list.length} class="list-wrap">
        {list.length === 0 ? <p class="empty">Aucune chaîne à afficher. Ajustez la recherche ou réaffichez les chaînes masquées dans les réglages.</p> : (
          <VirtualList items={list} rowHeight={72} render={(channel, index) => <ChannelButton channel={channel} index={index} list={list} />} />
        )}
      </div>
      )}
    </section>
  )
}
