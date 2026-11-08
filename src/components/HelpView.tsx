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
      <p>Le lecteur affiche les pistes déjà présentes dans le flux HLS ou DASH, et un fichier .srt ou .vtt que vous chargez. Si la piste audio annonce une langue autre que le français et qu’une piste française existe, elle est activée. La traduction automatique des dialogues en direct n’est pas fournie.</p>
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
