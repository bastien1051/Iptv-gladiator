import { canInstall, channels, indexed, promptInstall } from '../store'

export function AboutView() {
  return (
    <section class="page about" data-testid="about">
      <p class="kicker">Lecteur</p>
      <h1>IPTV Gladiator</h1>
      <p class="lede">Un lecteur pour le téléphone, le navigateur du téléviseur et le salon. Les flux préchargés viennent des listes publiques iptv-org : tous les pays, toutes les catégories, avec le sport mis en avant, y compris les chaînes gratuites déjà publiées dans ces listes.</p>
      <ul class="about-list">
        <li>{channels.value.length} chaînes en mémoire{indexed.value ? '' : ', index encore en cours'}.</li>
        <li>Pluto TV, Samsung TV Plus, Plex, Rakuten TV et Roku sont repérés dans ces listes, pas ajoutés depuis une autre offre.</li>
        <li>Vous pouvez ajouter vos propres listes M3U, un fichier, un serveur Xtream Codes ou un guide XMLTV.</li>
        <li>Aucune liste privée n’est fournie avec l’application.</li>
      </ul>
      {canInstall.value && <button type="button" data-nav onClick={() => { void promptInstall() }}>Installer IPTV Gladiator</button>}
      <p class="colophon">Une réalisation des Éditions Bastien.</p>
    </section>
  )
}
