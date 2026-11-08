import { useState } from 'preact/hooks'
import { errorMessage, fetchText, fetchXmlMaybeGzip } from '../lib/net'
import { parseXmltv } from '../lib/xmltv'
import { parseM3u, playlistProblem } from '../lib/m3u'
import { loadXtream } from '../lib/xtream'
import { addEpgUrl, addM3uUrl, addXtream, removeEpg, removeSource, sources, epgSources, toast } from '../store'
import type { EpgSource, Source } from '../types'

type Tab = 'm3u' | 'xtream' | 'epg'

const KEYS = ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN', '0123456789']

export function AbonnementView() {
  const [tab, setTab] = useState<Tab>('m3u')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [server, setServer] = useState('')
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState('')
  const [field, setField] = useState<'name' | 'url' | 'server' | 'user' | 'password'>('url')

  const users = sources.value.filter((source) => !source.builtin)
  const guides = epgSources.value.filter((source) => !source.builtin)

  function write(value: string) {
    const apply = (current: string) => current + value
    if (field === 'name') setName(apply(name))
    if (field === 'url') setUrl(apply(url))
    if (field === 'server') setServer(apply(server))
    if (field === 'user') setUser(apply(user))
    if (field === 'password') setPassword(apply(password))
  }

  function backspace() {
    const cut = (current: string) => current.slice(0, -1)
    if (field === 'name') setName(cut(name))
    if (field === 'url') setUrl(cut(url))
    if (field === 'server') setServer(cut(server))
    if (field === 'user') setUser(cut(user))
    if (field === 'password') setPassword(cut(password))
  }

  function editSource(source: Source) {
    setEditing(source.id)
    setName(source.name)
    setNote('')
    if (source.kind === 'xtream') {
      setTab('xtream')
      setServer(source.url ?? '')
      setUser(source.username ?? '')
      setPassword(source.password ?? '')
      setField('server')
    } else {
      setTab('m3u')
      setUrl(source.url ?? '')
      setField('url')
    }
  }

  function editGuide(source: EpgSource) {
    setEditing(source.id)
    setTab('epg')
    setName(source.name)
    setUrl(source.url)
    setField('url')
    setNote('')
  }

  async function testConnection() {
    setBusy('Test de la connexion…')
    setNote('')
    try {
      if (tab === 'm3u') {
        if (!/^https?:\/\//i.test(url.trim())) throw new Error('Indiquez une adresse http ou https.')
        const text = await fetchText(url.trim())
        const problem = playlistProblem(text)
        if (problem) throw new Error(problem)
        const count = parseM3u(text, { id: 'probe', role: 'user' }).length
        if (!count) throw new Error(`Parse : 0 chaîne reconnue. Début : ${text.replace(/\s+/g, ' ').trim().slice(0, 180)}`)
        setNote(`${count.toLocaleString('fr-FR')} chaînes trouvées.`)
      } else if (tab === 'xtream') {
        if (!server.trim() || !user.trim() || !password.trim()) throw new Error('Serveur, identifiant et mot de passe sont requis.')
        const loaded = await loadXtream({ base: server.trim(), username: user.trim(), password: password }, 'probe')
        setNote(`${loaded.drafts.length.toLocaleString('fr-FR')} chaînes en direct, ${loaded.vod.length.toLocaleString('fr-FR')} films.`)
      } else {
        if (!/^https?:\/\//i.test(url.trim())) throw new Error('Indiquez l’adresse XMLTV.')
        const xml = await fetchXmlMaybeGzip(url.trim())
        const parsed = parseXmltv(xml)
        const count = Object.keys(parsed).filter((key) => key.startsWith('id:')).length
        setNote(`${count.toLocaleString('fr-FR')} chaînes dans le guide.`)
      }
    } catch (error) {
      setNote(errorMessage(error))
    } finally {
      setBusy('')
    }
  }

  async function save() {
    setBusy('Ajout en cours…')
    setNote('')
    try {
      if (tab === 'epg') {
        if (editing) await removeEpg(editing)
        await addEpgUrl(url.trim(), name.trim() || 'Guide XMLTV')
        setNote('Guide ajouté. Les chaînes gratuites restent en place.')
      } else if (tab === 'xtream') {
        if (editing) await removeSource(editing)
        await addXtream(server.trim(), user.trim(), password, name.trim() || 'Abonnement Xtream')
        const added = sources.value.find((source) => source.kind === 'xtream' && source.username === user.trim())
        setNote(added?.channelCount ? `${added.channelCount.toLocaleString('fr-FR')} chaînes dans « ${added.name} ». Les listes gratuites restent chargées.` : 'Abonnement ajouté.')
      } else {
        if (editing) await removeSource(editing)
        await addM3uUrl(url.trim(), name.trim() || 'Abonnement M3U')
        setNote('Liste ajoutée à côté des chaînes gratuites.')
      }
      setEditing('')
      toast('Abonnement enregistré sur cet appareil.')
    } catch (error) {
      setNote(errorMessage(error))
    } finally {
      setBusy('')
    }
  }

  return (
    <section class="abo" data-testid="abonnement">
      <header class="pane-head">
        <p class="kicker">Vos sources</p>
        <h1>Ajouter mon abonnement</h1>
        <p class="lede">Les chaînes gratuites restent toujours chargées. Votre liste s’ajoute à côté, sans les remplacer. Identifiants uniquement sur cet appareil.</p>
      </header>
      <div class="chips">
        <button type="button" data-nav class={tab === 'm3u' ? 'chip on' : 'chip'} onClick={() => setTab('m3u')}>Lien M3U</button>
        <button type="button" data-nav class={tab === 'xtream' ? 'chip on' : 'chip'} onClick={() => setTab('xtream')}>Xtream Codes</button>
        <button type="button" data-nav class={tab === 'epg' ? 'chip on' : 'chip'} onClick={() => setTab('epg')}>Guide EPG</button>
      </div>
      <form class="abo-form" onSubmit={(event) => { event.preventDefault(); void save() }}>
        <label>Nom
          <input data-nav class="tv-input" value={name} placeholder="Mon abonnement" onFocus={() => setField('name')} onInput={(event) => setName((event.currentTarget as HTMLInputElement).value)} />
        </label>
        {tab !== 'xtream' && (
          <label>{tab === 'epg' ? 'Adresse XMLTV' : 'Lien M3U'}
            <input data-nav class="tv-input" data-testid="abo-url" value={url} placeholder="https://" onFocus={() => setField('url')} onInput={(event) => setUrl((event.currentTarget as HTMLInputElement).value)} />
          </label>
        )}
        {tab === 'xtream' && (
          <>
            <label>Serveur
              <input data-nav class="tv-input" value={server} placeholder="http://exemple:8080" onFocus={() => setField('server')} onInput={(event) => setServer((event.currentTarget as HTMLInputElement).value)} />
            </label>
            <label>Identifiant
              <input data-nav class="tv-input" value={user} onFocus={() => setField('user')} onInput={(event) => setUser((event.currentTarget as HTMLInputElement).value)} />
            </label>
            <label>Mot de passe
              <input data-nav class="tv-input" type="password" value={password} onFocus={() => setField('password')} onInput={(event) => setPassword((event.currentTarget as HTMLInputElement).value)} />
            </label>
          </>
        )}
        <div class="keys" aria-label="Clavier">
          {KEYS.map((row) => (
            <div key={row} class="key-row">
              {row.split('').map((key) => (
                <button key={key} type="button" data-nav class="key" onClick={() => write(key.toLowerCase())}>{key}</button>
              ))}
            </div>
          ))}
          <div class="key-row">
            <button type="button" data-nav class="key wide" onClick={() => write('https://')}>https://</button>
            <button type="button" data-nav class="key" onClick={() => write('.')}>.</button>
            <button type="button" data-nav class="key" onClick={() => write('/')}>/</button>
            <button type="button" data-nav class="key" onClick={() => write(':')}>:</button>
            <button type="button" data-nav class="key" onClick={() => write('-')}>-</button>
            <button type="button" data-nav class="key" onClick={() => write('_')}>_</button>
            <button type="button" data-nav class="key wide" onClick={backspace}>Effacer</button>
          </div>
        </div>
        {note && <p class="abo-note" data-testid="abo-note">{note}</p>}
        <div class="abo-actions">
          <button type="button" data-nav class="btn" disabled={!!busy} onClick={() => void testConnection()}>{busy || 'Tester la connexion'}</button>
          <button type="submit" data-nav class="btn primary" data-testid="abo-save" disabled={!!busy}>{editing ? 'Enregistrer' : 'Ajouter'}</button>
        </div>
      </form>
      <div class="source-list">
        <h2>Sources ajoutées</h2>
        {users.length === 0 && guides.length === 0 ? <p class="empty">Aucune source personnelle. Les listes gratuites restent disponibles.</p> : null}
        {users.map((source) => (
          <article key={source.id} class="source-card">
            <div>
              <strong>{source.name}</strong>
              <p>{source.kind === 'xtream' ? 'Xtream Codes' : 'Liste M3U'} · {(source.channelCount ?? 0).toLocaleString('fr-FR')} chaînes{source.lastError ? ` · ${source.lastError}` : ''}</p>
            </div>
            <button type="button" data-nav onClick={() => editSource(source)}>Modifier</button>
            <button type="button" data-nav onClick={() => void removeSource(source.id)}>Retirer</button>
          </article>
        ))}
        {guides.map((source) => (
          <article key={source.id} class="source-card">
            <div>
              <strong>{source.name}</strong>
              <p>Guide · {(source.programmeCount ?? 0).toLocaleString('fr-FR')} chaînes{source.lastError ? ` · ${source.lastError}` : ''}</p>
            </div>
            <button type="button" data-nav onClick={() => editGuide(source)}>Modifier</button>
            <button type="button" data-nav onClick={() => void removeEpg(source.id)}>Retirer</button>
          </article>
        ))}
      </div>
    </section>
  )
}
