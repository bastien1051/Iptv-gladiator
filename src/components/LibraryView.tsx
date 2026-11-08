import { useState } from 'preact/hooks'
import type { SeriesItem } from '../types'
import { VirtualList, useRowFocus } from './VirtualList'
import { ChannelButton, Logo } from './rows'
import { adultUnlocked, episodes, movieShelf, openSeries, playEpisode, playVod, seriesItems, seriesShelf, vodItems } from '../store'

export function LibraryView() {
  const [tab, setTab] = useState<'films' | 'series'>('films')
  const [openId, setOpenId] = useState<string | null>(null)
  const films = movieShelf.value
  const seriesChannels = seriesShelf.value
  const movies = vodItems.value.filter((item) => adultUnlocked.value || !item.adult)
  const shows = seriesItems.value.filter((item) => adultUnlocked.value || !item.adult)
  const focusRef = useRowFocus(72)
  const list = tab === 'films' ? films : seriesChannels

  return (
    <section class="page" data-testid="library">
      <header class="page-head">
        <div>
          <p class="kicker">Direct et serveur personnel</p>
          <h1>Films & Séries</h1>
        </div>
        <div class="chips">
          <button type="button" data-nav class={tab === 'films' ? 'chip on' : 'chip'} onClick={() => setTab('films')}>Films</button>
          <button type="button" data-nav class={tab === 'series' ? 'chip on' : 'chip'} onClick={() => setTab('series')}>Séries</button>
        </div>
      </header>
      <p class="lede">Les chaînes ci-dessous diffusent en continu. Les films et épisodes à la demande apparaissent si vous ajoutez un serveur Xtream Codes dans les réglages.</p>
      <div ref={focusRef} data-row-count={list.length} class="library-channels">
        {list.length === 0 ? <p class="empty">Aucune chaîne de cette famille dans les listes publiques.</p> : (
          <VirtualList items={list} rowHeight={72} render={(channel, index) => <ChannelButton channel={channel} index={index} list={list} />} />
        )}
      </div>
      {tab === 'films' && (
        <div class="posters">
          {movies.length === 0 && <p class="empty">Aucun film à la demande. Ajoutez un serveur que vous exploitez déjà.</p>}
          {movies.map((item) => (
            <button key={item.id} type="button" class="poster" data-nav onClick={() => playVod(item)}>
              <Logo src={item.poster} name={item.name} />
              <span>{item.name}</span>
              <span class="fine">{item.year || item.genre || 'Film'}</span>
            </button>
          ))}
        </div>
      )}
      {tab === 'series' && (
        <div class="series-list">
          {shows.length === 0 && <p class="empty">Aucune série à la demande.</p>}
          {shows.map((item) => (
            <SeriesBlock key={item.id} item={item} open={openId === item.id} onOpen={() => { setOpenId(item.id); void openSeries(item) }} />
          ))}
        </div>
      )}
    </section>
  )
}

function SeriesBlock({ item, open, onOpen }: { item: SeriesItem; open: boolean; onOpen: () => void }) {
  const list = episodes.value[item.id] ?? []
  return (
    <article class="series">
      <button type="button" data-nav onClick={onOpen}>
        <Logo src={item.poster} name={item.name} />
        <span>
          <strong>{item.name}</strong>
          <span class="fine">{item.year || item.genre || 'Série'}</span>
        </span>
      </button>
      {open && (
        <div class="episodes">
          {list.length === 0 && <p class="fine">Chargement des épisodes…</p>}
          {list.map((episode) => (
            <button key={episode.id} type="button" data-nav onClick={() => playEpisode(item, episode)}>
              S{episode.season} E{episode.episode} · {episode.title}
            </button>
          ))}
        </div>
      )}
    </article>
  )
}
