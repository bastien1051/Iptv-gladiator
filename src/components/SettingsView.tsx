import { useState } from 'preact/hooks'
import {
  addEpgUrl,
  addM3uFile,
  addM3uUrl,
  addXtream,
  canInstall,
  changePin,
  dead,
  epgSources,
  hidden,
  promptInstall,
  refreshEpg,
  refreshSources,
  removeEpg,
  removeSource,
  restoreDead,
  restoreHidden,
  scheduled,
  settings,
  sources,
  toggleEpg,
  toggleSource,
  updateSettings,
} from '../store'

export function SettingsView() {
  const [m3uUrl, setM3uUrl] = useState('')
  const [m3uName, setM3uName] = useState('')
  const [xtream, setXtream] = useState({ base: '', username: '', password: '', name: '' })
  const [epg, setEpg] = useState({ url: '', name: '' })
  const [pin, setPin] = useState({ current: '', next: '', confirm: '' })
  const [pinError, setPinError] = useState('')
  const current = settings.value

  return (
    <section class="page settings" data-testid="settings">
      <header class="page-head">
        <div>
          <p class="kicker">Cet appareil</p>
          <h1>Réglages</h1>
        </div>
        <button type="button" data-nav onClick={() => { void refreshSources() }}>Actualiser les listes</button>
      </header>

      <section>
        <h2>Lecture</h2>
        <p class="fine">Mémoire tampon et plafond de qualité sont pris en compte à la prochaine chaîne.</p>
        <div class="chips">
          {[10, 20, 30, 60].map((value) => (
            <button key={value} type="button" data-nav class={current.bufferSec === value ? 'chip on' : 'chip'} onClick={() => updateSettings({ bufferSec: value })}>{value} s</button>
          ))}
        </div>
        <div class="chips">
          {[{ id: 0, label: 'Qualité auto' }, { id: 1080, label: '1080p' }, { id: 720, label: '720p' }, { id: 480, label: '480p' }, { id: 360, label: '360p' }].map((item) => (
            <button key={item.id} type="button" data-nav class={current.qualityCap === item.id ? 'chip on' : 'chip'} onClick={() => updateSettings({ qualityCap: item.id })}>{item.label}</button>
          ))}
        </div>
        <label class="check"><input type="checkbox" checked={current.resumeLast} onChange={(event) => updateSettings({ resumeLast: (event.currentTarget as HTMLInputElement).checked })} /> Reprendre la dernière chaîne au lancement</label>
        <label class="check"><input type="checkbox" checked={current.autoSkip} onChange={(event) => updateSettings({ autoSkip: (event.currentTarget as HTMLInputElement).checked })} /> Passer à la suivante si le flux échoue</label>
        <label class="check"><input type="checkbox" checked={current.dedupeFeed} onChange={(event) => updateSettings({ dedupeFeed: (event.currentTarget as HTMLInputElement).checked })} /> Fusionner les doublons d’une même chaîne</label>
        <label class="check"><input type="checkbox" checked={current.hideDead} onChange={(event) => updateSettings({ hideDead: (event.currentTarget as HTMLInputElement).checked })} /> Masquer les chaînes hors service</label>
        <label class="check"><input type="checkbox" checked={current.tvLarge} onChange={(event) => updateSettings({ tvLarge: (event.currentTarget as HTMLInputElement).checked })} /> Grand format télévision</label>
      </section>

      <section>
        <h2>Relais local</h2>
        <p class="fine">Le navigateur ne peut pas lire certains flux (CORS) ni imposer un user-agent. Le petit serveur du dossier server/ relaie et enregistre avec ffmpeg. Laissez vide pour un accès direct.</p>
        <label class="field">Adresse
          <input data-nav placeholder="http://127.0.0.1:8787" value={current.proxyBase} onInput={(event) => updateSettings({ proxyBase: (event.currentTarget as HTMLInputElement).value })} />
        </label>
      </section>

      <section>
        <h2>Sources</h2>
        <ul class="source-list">
          {sources.value.map((source) => (
            <li key={source.id}>
              <div>
                <strong>{source.name}</strong>
                <span class="fine">{source.lastError || (source.channelCount ? `${source.channelCount} entrées` : source.url || 'Fichier local')}</span>
              </div>
              <div class="row-actions">
                <button type="button" data-nav onClick={() => { void toggleSource(source.id) }}>{source.enabled ? 'Activée' : 'Coupée'}</button>
                {!source.builtin && <button type="button" data-nav onClick={() => { void removeSource(source.id) }}>Retirer</button>}
              </div>
            </li>
          ))}
        </ul>
        <form class="stack" onSubmit={(event) => { event.preventDefault(); void addM3uUrl(m3uUrl, m3uName); setM3uUrl('') }}>
          <h3>Ajouter une liste M3U</h3>
          <label class="field">Nom <input data-nav value={m3uName} onInput={(event) => setM3uName((event.currentTarget as HTMLInputElement).value)} /></label>
          <label class="field">Adresse <input data-nav required type="url" value={m3uUrl} onInput={(event) => setM3uUrl((event.currentTarget as HTMLInputElement).value)} /></label>
          <button type="submit" data-nav>Ajouter l’adresse</button>
        </form>
        <label class="file">Importer un fichier .m3u
          <input type="file" accept=".m3u,.m3u8,audio/x-mpegurl,application/vnd.apple.mpegurl" onChange={(event) => {
            const file = (event.currentTarget as HTMLInputElement).files?.[0]
            if (!file) return
            void file.text().then((text) => addM3uFile(file.name, text))
          }} />
        </label>
        <form class="stack" onSubmit={(event) => { event.preventDefault(); void addXtream(xtream.base, xtream.username, xtream.password, xtream.name) }}>
          <h3>Serveur Xtream Codes</h3>
          <p class="fine">Pour un serveur que vous exploitez déjà. Les films, les séries et le replay dépendent de ce serveur.</p>
          <label class="field">Nom <input data-nav value={xtream.name} onInput={(event) => setXtream({ ...xtream, name: (event.currentTarget as HTMLInputElement).value })} /></label>
          <label class="field">Adresse <input data-nav required value={xtream.base} onInput={(event) => setXtream({ ...xtream, base: (event.currentTarget as HTMLInputElement).value })} /></label>
          <label class="field">Utilisateur <input data-nav required value={xtream.username} onInput={(event) => setXtream({ ...xtream, username: (event.currentTarget as HTMLInputElement).value })} /></label>
          <label class="field">Mot de passe <input data-nav required type="password" value={xtream.password} onInput={(event) => setXtream({ ...xtream, password: (event.currentTarget as HTMLInputElement).value })} /></label>
          <button type="submit" data-nav>Ajouter le serveur</button>
        </form>
      </section>

      <section>
        <h2>Guide des programmes</h2>
        <button type="button" data-nav onClick={() => { void refreshEpg() }}>Actualiser le guide</button>
        <ul class="source-list">
          {epgSources.value.map((source) => (
            <li key={source.id}>
              <div>
                <strong>{source.name}</strong>
                <span class="fine">{source.lastError || (source.programmeCount ? `${source.programmeCount} programmes` : source.url)}</span>
              </div>
              <div class="row-actions">
                <button type="button" data-nav onClick={() => { void toggleEpg(source.id) }}>{source.enabled ? 'Activé' : 'Coupé'}</button>
                {!source.builtin && <button type="button" data-nav onClick={() => { void removeEpg(source.id) }}>Retirer</button>}
              </div>
            </li>
          ))}
        </ul>
        <form class="stack" onSubmit={(event) => { event.preventDefault(); void addEpgUrl(epg.url, epg.name); setEpg({ url: '', name: '' }) }}>
          <label class="field">Nom <input data-nav value={epg.name} onInput={(event) => setEpg({ ...epg, name: (event.currentTarget as HTMLInputElement).value })} /></label>
          <label class="field">Adresse XMLTV (.xml ou .gz) <input data-nav required type="url" value={epg.url} onInput={(event) => setEpg({ ...epg, url: (event.currentTarget as HTMLInputElement).value })} /></label>
          <button type="submit" data-nav>Ajouter le guide</button>
        </form>
      </section>

      <section>
        <h2>Code parental</h2>
        <p class="fine">Le code se crée à l’ouverture de l’onglet Adulte, avec une confirmation 18+. Ce verrou reste sur cet appareil : il ne chiffre pas les flux.</p>
        {current.pinHash ? (
          <form class="stack" onSubmit={(event) => { event.preventDefault(); void changePin(pin.current, pin.next, pin.confirm).then((message) => setPinError(message ?? '')) }}>
            <label class="field">Code actuel <input data-nav required inputMode="numeric" value={pin.current} onInput={(event) => setPin({ ...pin, current: (event.currentTarget as HTMLInputElement).value })} /></label>
            <label class="field">Nouveau code <input data-nav required inputMode="numeric" value={pin.next} onInput={(event) => setPin({ ...pin, next: (event.currentTarget as HTMLInputElement).value })} /></label>
            <label class="field">Confirmation <input data-nav required inputMode="numeric" value={pin.confirm} onInput={(event) => setPin({ ...pin, confirm: (event.currentTarget as HTMLInputElement).value })} /></label>
            {pinError && <p class="warn">{pinError}</p>}
            <button type="submit" data-nav>Modifier le code</button>
          </form>
        ) : <p>Aucun code pour l’instant.</p>}
      </section>

      <section>
        <h2>Entretien</h2>
        <p class="fine">{hidden.value.length} chaîne{hidden.value.length > 1 ? 's' : ''} masquée{hidden.value.length > 1 ? 's' : ''} · {dead.value.length} hors service.</p>
        <div class="row-actions">
          <button type="button" data-nav onClick={() => restoreHidden()}>Réafficher les chaînes masquées</button>
          <button type="button" data-nav onClick={() => restoreDead()}>Réessayer les chaînes hors service</button>
          {canInstall.value && <button type="button" data-nav onClick={() => { void promptInstall() }}>Installer l’application</button>}
        </div>
      </section>

      <section>
        <h2>Enregistrements programmés</h2>
        {scheduled.value.length === 0 && <p class="empty">Aucun créneau. Depuis le guide, choisissez un programme à venir.</p>}
        <ul class="source-list">
          {scheduled.value.map((job) => (
            <li key={job.id}>
              <div>
                <strong>{job.title}</strong>
                <span class="fine">{job.status}{job.error ? ` · ${job.error}` : ''}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </section>
  )
}
