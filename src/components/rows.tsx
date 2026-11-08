import { useState } from 'preact/hooks'
import type { Channel } from '../types'
import { currentId, dead, favorites, guideFor, hideChannel, moveFavorite, nowMs, playChannel, shelf, toggleFavorite } from '../store'

export function Logo({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false)
  const letter = name.trim().charAt(0).toLocaleUpperCase('fr') || '•'
  if (!src || failed) return <span class="logo fallback" aria-hidden="true">{letter}</span>
  return <img class="logo" src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
}

export function ChannelButton({ channel, index, list }: { channel: Channel; index: number; list?: Channel[] }) {
  const guide = guideFor(channel)
  const active = currentId.value === channel.id
  const span = guide.current ? guide.current.stop - guide.current.start : 1
  const progress = guide.current ? Math.min(1, Math.max(0, (nowMs.value - guide.current.start) / span)) : 0
  const failed = dead.value.includes(channel.id)
  return (
    <div class={`row ${active ? 'active' : ''}`}>
      <button type="button" class="row-main" data-nav data-row-index={index} onClick={() => playChannel(channel.id, list, true)}>
        <span class="num">{index + 1}</span>
        <Logo src={channel.logo} name={channel.name} />
        <span class="row-copy">
          <span class="row-title">{channel.name}</span>
          <span class="row-sub">
            {failed ? 'Hors service' : guide.current ? guide.current.title : 'Programme non annoncé'}
            {guide.next ? ` · ensuite ${guide.next.title}` : ''}
          </span>
        </span>
      </button>
      {shelf.value === 'favorites' && (
        <>
          <button type="button" class="icon-btn" data-nav aria-label="Monter le favori" onClick={() => moveFavorite(channel.id, -1)}>↑</button>
          <button type="button" class="icon-btn" data-nav aria-label="Descendre le favori" onClick={() => moveFavorite(channel.id, 1)}>↓</button>
        </>
      )}
      <button type="button" class={`icon-btn ${favorites.value.includes(channel.id) ? 'on' : ''}`} data-nav aria-label="Favori" onClick={() => toggleFavorite(channel.id)}>★</button>
      <button type="button" class="icon-btn" data-nav aria-label="Masquer la chaîne" onClick={() => hideChannel(channel.id)}>–</button>
      {guide.current && <span class="row-progress" style={{ width: `${progress * 100}%` }} />}
    </div>
  )
}
