import { Component, type ComponentChildren } from 'preact'

export class Guard extends Component<{ children: ComponentChildren }, { message: string }> {
  state = { message: '' }

  componentDidCatch(error: unknown): void {
    this.setState({ message: error instanceof Error ? error.message : 'Erreur inattendue' })
  }

  render() {
    if (this.state.message) {
      return (
        <div class="crash">
          <p class="kicker">Lecture interrompue</p>
          <h1>Cette partie d’IPTV Gladiator a échoué</h1>
          <p>{this.state.message}</p>
          <button type="button" onClick={() => location.reload()}>Recharger</button>
        </div>
      )
    }
    return this.props.children
  }
}
