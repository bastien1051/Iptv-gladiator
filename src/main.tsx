import { render } from 'preact'
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/500.css'
import '@fontsource/outfit/600.css'
import '@fontsource/fraunces/500.css'
import '@fontsource/fraunces/700.css'
import { App } from './components/App'
import './styles.css'

const root = document.getElementById('app')
if (root) render(<App />, root)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const url = new URL('sw.js', document.baseURI)
    void navigator.serviceWorker.register(url)
  })
}
