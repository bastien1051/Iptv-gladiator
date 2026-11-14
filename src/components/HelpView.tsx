export function HelpView() {
  return (
    <section class="page help" data-testid="help">
      <p class="kicker">Mode d’emploi</p>
      <h1>Aide</h1>
      <h2>Télécommande</h2>
      <ul class="about-list">
        <li>Flèches : déplacer le cadre. Haut et bas dans une liste passent d’une chaîne à l’autre.</li>
        <li>Entrée ou OK : valider. Échap, Retour ou Backspace : revenir.</li>
        <li>Page haut / bas, ou les touches chaîne de la télécommande : zapper.</li>
        <li>Chiffres : numéro dans la liste affichée. P : chaîne précédente. M : muet. F ou double tape : plein écran. Maintenir OK : plein écran. Retour quitte le plein écran. I : infos. R : enregistrer.</li>
      </ul>
      <h2>Sous-titres</h2>
      <p>Si la langue parlée n’est pas le français, et qu’aucune piste française n’est fournie, les sous-titres français se lancent tout seuls sur cet appareil. La reconnaissance et la traduction restent dans le navigateur, sans service payant. Le menu Sous-titres permet de les couper : le choix est mémorisé. Un fichier .srt ou .vtt reste disponible en complément. Sur un téléviseur ou un appareil trop limité, ils restent désactivés. Si le flux interdit la capture audio, le lecteur affiche « Sous-titres auto indisponibles pour cette chaîne » et la vidéo continue.</p>
      <h2>Lecture</h2>
      <p>HLS est lu avec hls.js (débit automatique et mémoire tampon réglable). Les flux .ts et FLV passent par mpegts.js, le DASH par Shaka Player, et le navigateur sert de repli. Une coupure relance le flux avec un délai croissant. Une image figée est reprise. Un flux qui échoue n’arrête pas l’application : un message s’affiche, puis la chaîne suivante si l’option est active.</p>
      <h2>Enregistrement</h2>
      <p>Le bouton Enregistrer capture l’image via MediaRecorder et télécharge un fichier WebM. Cela échoue souvent si le flux n’autorise pas le navigateur (CORS) : la vidéo peut jouer sans pouvoir être capturée. L’enregistrement programmé depuis le guide ne fonctionne que pendant qu’IPTV Gladiator reste ouvert.</p>
      <p>Le serveur du dossier <code>server/</code> relie ffmpeg pour un enregistrement plus fiable et peut relayer les flux. Il n’écoute que sur la machine locale. Lancez <code>npm run helper</code>, puis indiquez http://127.0.0.1:8787 dans les réglages. ffmpeg doit être installé.</p>
      <h2>Sources</h2>
      <p>Les listes publiques sont celles d’iptv-org. Le guide préchargé couvre des chaînes gratuites Pluto TV, Samsung TV Plus et Plex lorsqu’un nom correspond. Beaucoup de chaînes nationales n’ont pas de programme tant que vous n’ajoutez pas un fichier XMLTV. Les flux publics tombent souvent : après deux échecs, la chaîne est marquée hors service.</p>
    </section>
  )
}
