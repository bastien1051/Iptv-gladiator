import { useMemo, useState } from 'preact/hooks'
import { programmesFor } from '../lib/epg'
import { formatClock, formatDay } from '../lib/text'
import { channels, epgIndex, playReplay } from '../store'

export function ReplayView() {
  const pool = useMemo(() => channels.value.filter((channel) => !channel.adult && (channel.catchup || channel.origin)), [channels.value])
  const [id, setId] = useState<string | null>(null)
  const [when, setWhen] = useState(() => new Date(Date.now() - 60 * 60 * 1000).toISOString().slice(0, 16))
  const [minutes, setMinutes] = useState(60)
  const channel = pool.find((item) => item.id === id) ?? pool[0]
  const past = channel ? programmesFor(channel, epgIndex.value).filter((item) => item.stop < Date.now()).slice(-12).reverse() : []

  return (
    <section class="page" data-testid="replay">
      <header class="page-head">
        <div>
          <p class="kicker">Rattrapage</p>
          <h1>Replay</h1>
        </div>
      </header>
      <p class="lede">Le replay utilise l’archive Xtream (timeshift) ou l’attribut catchup d’une liste M3U. Les chaînes publiques sans archive ne peuvent pas être revues.</p>
      {pool.length === 0 ? <p class="empty">Aucune chaîne avec replay dans les sources actuelles. Ajoutez un serveur Xtream qui fournit une archive.</p> : (
        <>
          <label class="field">Chaîne
            <select data-nav value={channel?.id ?? ''} onChange={(event) => setId((event.currentTarget as HTMLSelectElement).value)}>
              {pool.slice(0, 300).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <div class="stack">
            {past.map((programme) => (
              <button key={programme.start} type="button" data-nav onClick={() => channel && playReplay(channel, programme)}>
                {formatDay(programme.start)} · {formatClock(programme.start)} · {programme.title}
              </button>
            ))}
            {past.length === 0 && <p class="empty">Pas de programme passé dans le guide. Vous pouvez indiquer une heure.</p>}
          </div>
          {channel && (
            <form class="stack" onSubmit={(event) => {
              event.preventDefault()
              const start = new Date(when).getTime()
              if (!Number.isFinite(start)) return
              playReplay(channel, { start, stop: start + minutes * 60 * 1000, title: `Replay ${channel.name}` })
            }}>
              <label class="field">Début
                <input data-nav type="datetime-local" value={when} onInput={(event) => setWhen((event.currentTarget as HTMLInputElement).value)} />
              </label>
              <label class="field">Durée (minutes)
                <input data-nav type="number" min={5} max={240} value={minutes} onInput={(event) => setMinutes(Number((event.currentTarget as HTMLInputElement).value))} />
              </label>
              <button type="submit" data-nav>Lire ce créneau</button>
            </form>
          )}
        </>
      )}
    </section>
  )
}
