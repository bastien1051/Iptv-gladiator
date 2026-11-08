import { useEffect } from 'preact/hooks'
import type { Channel, Shelf } from '../types'
import { fastLabel, formatDay, greeting } from '../lib/text'
import { VirtualList, useRowFocus } from './VirtualList'
import { ChannelButton, Logo } from './rows'
import {
  catalogTotal,
  channels,
  combatShelf,
  fastShelf,
  franceShelf,
  go,
  group,
  groupBy,
  indexed,
  loadFullCatalog,
  loading,
  newsShelf,
  openShelf,
  partialCatalog,
  playChannel,
  query,
  searchList,
  settings,
  shelf,
  sources,
  sportShelf,
} from '../store'

function groupBySource(name: string): void {
  shelf.value = 'all'
  groupBy.value = 'source'
  group.value = name
  go('direct')
}

function ShelfRow({ title, kicker, items, shelf, testId }: { title: string; kicker: string; items: Channel[]; shelf: Shelf; testId: string }) {
  return (
    <section class="shelf" data-testid={testId}>
      <header class="shelf-head">
        <div>
          <p class="kicker">{kicker}</p>
          <h2>{title}</h2>
        </div>
        <button type="button" class="text-btn" data-nav onClick={() => openShelf(shelf)}>
          Tout voir · {items.length.toLocaleString('fr-FR')}
        </button>
      </header>
      {items.length === 0 ? (
        <p class="empty">{loading.value ? 'Chargement des listes publiques…' : 'Aucune chaîne dans cette sélection pour le moment.'}</p>
      ) : (
        <div class="shelf-row">
          {items.slice(0, 24).map((channel) => (
            <button key={channel.id} type="button" class="card" data-nav onClick={() => playChannel(channel.id, items, true)}>
              <Logo src={channel.logo} name={channel.name} />
              <span class="card-name">{channel.name}</span>
              <span class="card-meta">{channel.fast ? fastLabel(channel.fast) : channel.country === 'FR' ? 'France' : 'Direct'}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

export function HomeView() {
  const focusRef = useRowFocus(72)
  const results = searchList.value
  useEffect(() => {
    focusRef.current?.setAttribute('data-row-count', String(results.length))
  }, [results.length, focusRef])

  return (
    <div class="home" data-testid="home" data-channels={channels.value.length} data-sport={sportShelf.value.length} data-combat={combatShelf.value.length} data-indexed={indexed.value ? '1' : '0'}>
      <header class="home-hero">
        <div>
          <p class="mobile-brand">IPTV Gladiator</p>
          <p class="kicker">{formatDay(Date.now())}</p>
          <h1>{greeting()}</h1>
          <p class="lede" data-testid="free-count" data-free={catalogTotal.value} data-loaded={channels.value.length}>
            {catalogTotal.value
              ? `${catalogTotal.value.toLocaleString('fr-FR')} chaînes gratuites`
              : 'Chaînes publiques gratuites'}
            {partialCatalog.value ? ` · ${channels.value.length.toLocaleString('fr-FR')} affichées` : ''}
          </p>
        </div>
        <label class="search">
          <span class="sr">Rechercher</span>
          <input data-nav data-testid="search" value={query.value} placeholder="Rechercher une chaîne, un sport, un pays…" onInput={(event) => { query.value = (event.currentTarget as HTMLInputElement).value }} />
        </label>
      </header>
      <button type="button" class="abo-cta" data-nav data-testid="add-subscription" onClick={() => go('abonnement')}>
        Ajouter mon abonnement
      </button>
      {partialCatalog.value && (
        <button type="button" class="resume" data-nav onClick={() => { void loadFullCatalog() }}>
          Charger tout le catalogue gratuit
        </button>
      )}
      {settings.value.lastSafeChannelId && (
        <button type="button" class="resume" data-nav onClick={() => playChannel(settings.value.lastSafeChannelId!, undefined, true)}>
          Reprendre la dernière chaîne
        </button>
      )}
      {query.value.trim() ? (
        <div ref={focusRef} data-row-count={results.length} class="results">
          <p class="kicker">{results.length} résultat{results.length > 1 ? 's' : ''}</p>
          {results.length === 0 ? <p class="empty">Aucune chaîne ne correspond.</p> : (
            <VirtualList items={results} rowHeight={72} render={(channel, index) => <ChannelButton channel={channel} index={index} list={results} />} />
          )}
        </div>
      ) : (
        <>
          <ShelfRow testId="shelf-sport" title="Sport" kicker="Listes publiques iptv-org" items={sportShelf.value} shelf="sport" />
          <ShelfRow testId="shelf-combat" title="Sports de combat" kicker="Boxe, MMA, catch, kickboxing" items={combatShelf.value} shelf="combat" />
          <ShelfRow testId="shelf-france" title="France" kicker="Chaînes du pays" items={franceShelf.value} shelf="france" />
          <ShelfRow testId="shelf-fast" title="Chaînes gratuites" kicker="Pluto TV, Samsung TV Plus, Plex, Rakuten TV, Roku" items={fastShelf.value} shelf="fast" />
          <ShelfRow testId="shelf-news" title="Information" kicker="En français" items={newsShelf.value} shelf="news" />
          {sources.value.filter((source) => !source.builtin && source.enabled).map((source) => {
            const items = channels.value.filter((channel) => (channel.sourceNames ?? []).includes(source.name))
            return (
              <section key={source.id} class="shelf" data-testid="shelf-user">
                <header class="shelf-head">
                  <div>
                    <p class="kicker">Votre source</p>
                    <h2>{source.name}</h2>
                  </div>
                  <button type="button" class="text-btn" data-nav onClick={() => { groupBySource(source.name) }}>
                    Tout voir · {items.length.toLocaleString('fr-FR')}
                  </button>
                </header>
                {source.lastError ? <p class="empty">{source.lastError}</p> : items.length === 0 ? <p class="empty">Ces chaînes sont déjà dans les listes gratuites, ou la source n’a pas encore répondu.</p> : (
                  <div class="shelf-row">
                    {items.slice(0, 24).map((channel) => (
                      <button key={channel.id} type="button" class="card" data-nav onClick={() => playChannel(channel.id, items, true)}>
                        <Logo src={channel.logo} name={channel.name} />
                        <span class="card-name">{channel.name}</span>
                        <span class="card-meta">{source.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}
