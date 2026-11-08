import { useState } from 'preact/hooks'
import type { Channel, Programme } from '../types'
import { programmesFor } from '../lib/epg'
import { formatClock } from '../lib/text'
import { epgIndex, franceShelf, playChannel, playReplay, scheduleRecording } from '../store'

const SLOT = 30 * 60 * 1000
const SPAN = 4 * 60 * 60 * 1000

export function GuideView() {
  const [origin, setOrigin] = useState(() => Math.floor(Date.now() / SLOT) * SLOT)
  const channels = franceShelf.value.slice(0, 80)
  const end = origin + SPAN

  function onProgramme(channel: Channel, programme: Programme): void {
    const now = Date.now()
    if (programme.start <= now && programme.stop > now) playChannel(channel.id, channels, true)
    else if (programme.stop <= now) playReplay(channel, programme)
    else scheduleRecording(channel, programme)
  }

  return (
    <section class="page guide" data-testid="guide">
      <header class="page-head">
        <div>
          <p class="kicker">France · {channels.length} chaînes</p>
          <h1>Guide</h1>
        </div>
        <div class="row-actions">
          <button type="button" data-nav onClick={() => setOrigin(origin - SPAN)}>Plus tôt</button>
          <button type="button" data-nav onClick={() => setOrigin(Math.floor(Date.now() / SLOT) * SLOT)}>Maintenant</button>
          <button type="button" data-nav onClick={() => setOrigin(origin + SPAN)}>Plus tard</button>
        </div>
      </header>
      <div class="guide-scroll">
        <div class="guide-times" style={{ width: '880px' }}>
          {Array.from({ length: 8 }, (_, index) => (
            <span key={index}>{formatClock(origin + index * SLOT)}</span>
          ))}
        </div>
        {channels.length === 0 && <p class="empty">Le guide attend les chaînes françaises.</p>}
        {channels.map((channel) => {
          const programmes = programmesBetween(channel, origin, end)
          return (
            <div class="guide-row" key={channel.id}>
              <button type="button" class="guide-name" data-nav onClick={() => playChannel(channel.id, channels, true)}>{channel.name}</button>
              <div class="guide-track">
                {programmes.map((programme) => {
                  const left = ((programme.start - origin) / SPAN) * 100
                  const width = (Math.max(programme.stop, programme.start + 60_000) - programme.start) / SPAN * 100
                  return (
                    <button key={`${programme.start}-${programme.title}`} type="button" class="prog" data-nav style={{ left: `${left}%`, width: `${Math.max(width, 4)}%` }} onClick={() => onProgramme(channel, programme)}>
                      <strong>{programme.title}</strong>
                      <span>{formatClock(programme.start)}</span>
                    </button>
                  )
                })}
                {programmes.length === 0 && <span class="fine guide-empty">Pas de guide</span>}
              </div>
            </div>
          )
        })}
      </div>
      <p class="fine">Un programme en cours lance la chaîne. Un programme passé tente le replay. Un programme à venir programme l’enregistrement tant que l’application reste ouverte.</p>
    </section>
  )
}

function programmesBetween(channel: Channel, start: number, end: number): Programme[] {
  return programmesFor(channel, epgIndex.value).filter((item) => item.stop > start && item.start < end)
}
