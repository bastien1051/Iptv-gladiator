import { useEffect } from 'preact/hooks'
import { installFullscreenSync } from '../lib/fullscreen'
import { installNav } from '../nav'
import { AboutView } from './AboutView'
import { AbonnementView } from './AbonnementView'
import { AdultView } from './AdultView'
import { ChannelPane } from './ChannelPane'
import { Guard } from './Guard'
import { GuideView } from './GuideView'
import { HelpView } from './HelpView'
import { HomeView } from './HomeView'
import { LibraryView } from './LibraryView'
import { MultiView } from './MultiView'
import { PlayerDock } from './PlayerDock'
import { ReplayView } from './ReplayView'
import { ScheduleHost } from './ScheduleHost'
import { SettingsView } from './SettingsView'
import {
  boot,
  captureInstall,
  currentId,
  go,
  loading,
  moreOpen,
  numberEntry,
  retryLoad,
  screenError,
  settings,
  toasts,
  view,
} from '../store'
import type { View } from '../types'

const RAIL: { id: View; label: string; test?: string }[] = [
  { id: 'home', label: 'Accueil' },
  { id: 'abonnement', label: 'Abonnement', test: 'nav-abonnement' },
  { id: 'direct', label: 'Direct' },
  { id: 'guide', label: 'Guide' },
  { id: 'library', label: 'Films' },
  { id: 'replay', label: 'Replay' },
  { id: 'multi', label: 'Écrans' },
  { id: 'adult', label: 'Adulte', test: 'nav-adult' },
  { id: 'settings', label: 'Réglages' },
  { id: 'help', label: 'Aide' },
  { id: 'about', label: 'À propos' },
]

export function App() {
  useEffect(() => {
    void boot()
    const removeNav = installNav()
    const removeFullscreen = installFullscreenSync()
    const onInstall = (event: Event) => captureInstall(event)
    window.addEventListener('beforeinstallprompt', onInstall)
    return () => {
      removeNav()
      removeFullscreen()
      window.removeEventListener('beforeinstallprompt', onInstall)
    }
  }, [])

  const current = view.value
  const playing = currentId.value !== null
  const dock = current === 'multi' ? 'hidden' : current === 'direct' ? 'full' : playing ? 'mini' : 'off'

  return (
    <Guard>
      <div class={`shell dock-${dock} view-${current}`} data-tv={settings.value.tvLarge ? '1' : '0'}>
        <nav class="rail" aria-label="Sections">
          <p class="mark">IPTV<br />Gladiator</p>
          {RAIL.map((item) => (
            <button key={item.id} type="button" data-nav data-testid={item.test} class={current === item.id ? 'nav-btn on' : 'nav-btn'} onClick={() => go(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
        <Guard>
          <PlayerDock compact={dock !== 'full'} />
        </Guard>
        <main class="panel">
          {screenError.value && (
            <div class="load-error" data-testid="load-error" role="alert">
              <p>{screenError.value}</p>
              <button type="button" data-nav onClick={() => { void retryLoad() }}>Réessayer</button>
            </div>
          )}
          {loading.value && <p class="loading-bar">{loading.value}</p>}
          {current === 'home' && <HomeView />}
          {current === 'abonnement' && <AbonnementView />}
          {current === 'direct' && <ChannelPane />}
          {current === 'guide' && <GuideView />}
          {current === 'library' && <LibraryView />}
          {current === 'replay' && <ReplayView />}
          {current === 'multi' && <MultiView />}
          {current === 'adult' && <AdultView />}
          {current === 'settings' && <SettingsView />}
          {current === 'help' && <HelpView />}
          {current === 'about' && <AboutView />}
        </main>
        <nav class="tabbar" aria-label="Navigation">
          <button type="button" data-nav class={current === 'home' ? 'on' : ''} onClick={() => go('home')}>Accueil</button>
          <button type="button" data-nav class={current === 'direct' ? 'on' : ''} onClick={() => go('direct')}>Direct</button>
          <button type="button" data-nav class={current === 'guide' ? 'on' : ''} onClick={() => go('guide')}>Guide</button>
          <button type="button" data-nav class={current === 'library' ? 'on' : ''} onClick={() => go('library')}>Films</button>
          <button type="button" data-nav data-testid="nav-more" class={moreOpen.value ? 'on' : ''} onClick={() => { moreOpen.value = !moreOpen.value }}>Plus</button>
        </nav>
        {moreOpen.value && (
          <div class="sheet">
            {(['abonnement', 'replay', 'multi', 'adult', 'settings', 'help', 'about'] as View[]).map((item) => (
              <button key={item} type="button" data-nav data-testid={item === 'adult' ? 'nav-adult-mobile' : undefined} onClick={() => go(item)}>
                {RAIL.find((entry) => entry.id === item)?.label}
              </button>
            ))}
          </div>
        )}
        <div class="toasts" aria-live="polite">
          {toasts.value.map((item) => <p key={item.id} class={`toast ${item.tone}`}>{item.text}</p>)}
        </div>
        {numberEntry.value && <p class="hud">{numberEntry.value}</p>}
        <ScheduleHost />
      </div>
    </Guard>
  )
}
