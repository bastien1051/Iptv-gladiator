import { render } from 'preact'
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/500.css'
import '@fontsource/outfit/600.css'
import '@fontsource/fraunces/500.css'
import '@fontsource/fraunces/700.css'
import { App } from './components/App'
import { watchUpdates } from './lib/updates'
import './styles.css'

const root = document.getElementById('app')
if (root) render(<App />, root)
watchUpdates()
