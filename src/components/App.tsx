import { useEffect } from 'preact/hooks'
import { installFullscreenSync } from '../lib/fullscreen'
import { showAppliedUpdate } from '../lib/updates'
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
import { openMobileSection, Sidebar } from './Sidebar'
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
  shelf,
  toasts,
  view,
} from '../store'
const MORE: { id: string; label: string; test?: string }[] = [
  { id: 'tnt', label: 'TNT France' },
  { id: 'combat', label: 'Sports de combat' },
  { id: 'films', label: 'Films' },
  { id: 'series', label: 'Séries' },
  { id: 'replay', label: 'Replay' },
  { id: 'guide', label: 'Guide TV' },
  { id: 'adult', label: 'Adulte 18+', test: 'nav-adult-mobile' },
  { id: 'abonnement', label: 'Mes listes' },
  { id: 'settings', label: 'Réglages' },
  { id: 'help', label: 'Aide' },
  { id: 'about', label: 'À propos' },
]

export function App() {
  useEffect(() => {
    showAppliedUpdate()
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
  const browsing = current === 'direct' || current === 'home' || current === 'library'
  const dock = current === 'multi' ? 'hidden' : browsing && playing ? 'full' : browsing ? 'list' : playing ? 'mini' : 'off'

  return (
    <Guard>
      <div class={`shell dock-${dock} view-${current}`} data-tv={settings.value.tvLarge ? '1' : '0'}>
        <Sidebar />
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
          <button type="button" data-nav class={current === 'direct' && shelf.value === 'all' ? 'on' : ''} onClick={() => openMobileSection('direct')}>Direct</button>
          <button type="button" data-nav class={current === 'direct' && shelf.value === 'sport' ? 'on' : ''} onClick={() => openMobileSection('sport')}>Sports</button>
          <button type="button" data-nav class={current === 'direct' && shelf.value === 'favorites' ? 'on' : ''} onClick={() => openMobileSection('favorites')}>Favoris</button>
          <button type="button" data-nav data-testid="nav-more" class={moreOpen.value ? 'on' : ''} onClick={() => { moreOpen.value = !moreOpen.value }}>Plus</button>
        </nav>
        {moreOpen.value && (
          <div class="sheet">
            {MORE.map((item) => (
              <button key={item.id} type="button" data-nav data-testid={item.test} onClick={() => openMobileSection(item.id)}>
                {item.label}
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
