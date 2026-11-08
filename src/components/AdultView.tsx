import { useEffect, useState } from 'preact/hooks'
import { VirtualList, useRowFocus } from './VirtualList'
import { ChannelButton } from './rows'
import {
  adultChannels,
  adultLoading,
  adultMessage,
  adultUnlocked,
  createPin,
  enterPin,
  fetchNsfw,
  lockAdult,
  settings,
  zapList,
} from '../store'

function Pad({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
  return (
    <div class="pad">
      <p class="pin-dots" aria-live="polite">{'●'.repeat(value.length)}{'○'.repeat(Math.max(0, 4 - value.length))}</p>
      <div class="pad-grid">
        {digits.map((digit) => (
          <button key={digit} type="button" data-nav onClick={() => onChange(`${value}${digit}`.slice(0, 4))}>{digit}</button>
        ))}
        <button type="button" data-nav onClick={() => onChange(value.slice(0, -1))}>Effacer</button>
      </div>
    </div>
  )
}

export function AdultView() {
  const [step, setStep] = useState<'choose' | 'confirm' | 'consent' | 'enter'>(settings.value.pinHash ? 'enter' : 'choose')
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [consent, setConsent] = useState(false)
  const [current, setCurrent] = useState('')
  const [error, setError] = useState('')
  const focusRef = useRowFocus(72)
  const list = adultUnlocked.value ? adultChannels.value : []
  useEffect(() => {
    if (list.length) zapList.value = list
  }, [list])

  if (!adultUnlocked.value) {
    return (
      <section class="page adult-gate" data-testid="adult-gate">
        <p class="kicker">18+</p>
        <h1>Adulte</h1>
        <p class="lede">Cette catégorie est réservée aux personnes majeures. Le code est demandé à chaque visite. Tant qu’il n’est pas saisi, ces chaînes n’apparaissent ni à l’accueil, ni dans la recherche, ni dans les récents.</p>
        {error && <p class="warn">{error}</p>}
        {!settings.value.pinHash || step !== 'enter' ? (
          <>
            {step === 'choose' && (
              <>
                <h2>Choisissez un code à 4 chiffres</h2>
                <Pad value={first} onChange={setFirst} />
                <button type="button" data-nav disabled={first.length !== 4} onClick={() => { setStep('confirm'); setSecond('') }}>Continuer</button>
              </>
            )}
            {step === 'confirm' && (
              <>
                <h2>Confirmez le code</h2>
                <Pad value={second} onChange={setSecond} />
                <button type="button" data-nav disabled={second.length !== 4} onClick={() => setStep('consent')}>Continuer</button>
              </>
            )}
            {step === 'consent' && (
              <>
                <label class="check">
                  <input type="checkbox" checked={consent} onChange={(event) => setConsent((event.currentTarget as HTMLInputElement).checked)} />
                  Je confirme avoir 18 ans révolus.
                </label>
                <button type="button" data-nav disabled={!consent} onClick={() => { void createPin(first, second, consent).then((message) => setError(message ?? '')) }}>Entrer</button>
              </>
            )}
          </>
        ) : (
          <>
            <h2>Code parental</h2>
            <Pad value={current} onChange={(next) => {
              setCurrent(next)
              if (next.length === 4) void enterPin(next).then((message) => { setError(message ?? ''); if (message) setCurrent('') })
            }} />
          </>
        )}
      </section>
    )
  }

  return (
    <section class="page" data-testid="adult-list">
      <header class="page-head">
        <div>
          <p class="kicker">Déverrouillé pour cette visite</p>
          <h1>Adulte</h1>
        </div>
        <div class="row-actions">
          <button type="button" data-nav onClick={() => { void fetchNsfw() }}>Mettre à jour la liste publique</button>
          <button type="button" data-nav onClick={() => lockAdult()}>Verrouiller</button>
        </div>
      </header>
      {adultLoading.value && <p>Chargement de la liste publique…</p>}
      {adultMessage.value && <p class="empty">{adultMessage.value}</p>}
      <div ref={focusRef} data-row-count={list.length} class="list-wrap">
        {list.length > 0 && <VirtualList items={list} rowHeight={72} render={(channel, index) => <ChannelButton channel={channel} index={index} list={list} />} />}
      </div>
    </section>
  )
}
