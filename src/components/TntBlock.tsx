import type { TntSlot } from '../data/tnt-france'
import { openBrowse, playChannel, tntChannel, tntSlots } from '../store'

function play(slot: TntSlot, list: ReturnType<typeof tntChannel>[]): void {
  const channel = tntChannel(slot)
  if (!channel) return
  playChannel(channel.id, list.filter((item): item is NonNullable<typeof item> => !!item), false)
}

export function TntBlock({ mode }: { mode: 'strip' | 'list' }) {
  const slots = tntSlots.value
  const playable = slots.map(tntChannel).filter((channel): channel is NonNullable<typeof channel> => !!channel)
  if (mode === 'strip') {
    return (
      <div class="tnt-strip" data-testid="tnt-strip">
        <p class="tnt-kicker">TNT France</p>
        <div class="tnt-scroll">
          {slots.filter((slot) => slot.number !== null).map((slot) => {
            const channel = tntChannel(slot)
            if (channel) {
              return (
                <button key={slot.id} type="button" class="tnt-card" data-nav onClick={() => play(slot, playable)}>
                  <span class="num">{slot.number}</span>
                  <span>{slot.name}</span>
                </button>
              )
            }
            return (
              <a key={slot.id} class="tnt-card" data-nav href={slot.officialUrl} target="_blank" rel="noopener noreferrer">
                <span class="num">{slot.number}</span>
                <span>{slot.name}</span>
                <span class="tnt-site">Site officiel</span>
              </a>
            )
          })}
          <button type="button" class="tnt-card tnt-more" data-nav data-testid="nav-tnt" onClick={() => openBrowse('tnt')}>
            Toutes
          </button>
        </div>
      </div>
    )
  }
  return (
    <div class="tnt-list" data-testid="tnt-list">
      <p class="lede">Numérotation Arcom depuis le 6 juin 2025. C8, NRJ12 et Canal+ ne sont plus sur la TNT gratuite. Sans flux officiel vérifié, la chaîne s’ouvre sur le site du diffuseur.</p>
      {slots.map((slot) => {
        const channel = tntChannel(slot)
        return (
          <div key={slot.id} class="tnt-row">
            <span class="num">{slot.number ?? '·'}</span>
            <span class="row-title">{slot.name}</span>
            {channel ? (
              <button type="button" class="official-link" data-nav onClick={() => play(slot, playable)}>Lire</button>
            ) : (
              <a class="official-link" data-nav href={slot.officialUrl} target="_blank" rel="noopener noreferrer">Regarder sur le site officiel</a>
            )}
          </div>
        )
      })}
    </div>
  )
}
