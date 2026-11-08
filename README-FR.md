# IPTV Gladiator

Lecteur IPTV à installer sur un téléphone ou à ouvrir dans le navigateur d’un téléviseur. Tout le texte de l’application est en français. Une réalisation des Éditions Bastien.

Le catalogue gratuit est préparé à la construction du site (`npm run build`) et servi depuis la même origine, en morceaux. Le téléviseur n’a pas à télécharger les fichiers M3U d’iptv-org. S’il ne peut pas les lire, un message et le bouton **Réessayer** s’affichent à la place d’une liste vide.

Ce catalogue réunit, après dédoublonnage par adresse et par identifiant :

- les quatre index publics d’[iptv-org](https://github.com/iptv-org/iptv) : complet, pays, catégories, langues ;
- les playlists publiques Pluto TV, Samsung TV Plus, Plex, Roku, Rakuten TV, Tubi, Stirr et Xumo publiées dans le dépôt iptv-org.

**12 931 chaînes gratuites** au 8 novembre 2026. Sur un téléviseur, l’accueil charge d’abord la France, le français, le sport et les chaînes gratuites FAST (1 641 chaînes), puis **Charger tout le catalogue gratuit** ajoute le reste. i.mjh.nz ne publie pas de playlist M3U : ses guides XMLTV France (Pluto, Samsung TV Plus, Plex) restent utilisés.

**Ajouter mon abonnement** est sur l’accueil et dans le menu. Lien M3U, Xtream Codes ou guide XMLTV : la source s’ajoute à côté des listes gratuites, dans son propre groupe. Elle ne les remplace pas. Une chaîne déjà présente n’est pas dupliquée. Les identifiants restent dans l’appareil. Si le navigateur ne peut pas joindre la liste, l’application réessaie par le relais de la même origine.

## Lancer sur cet ordinateur

Il faut Node.js 20 ou plus récent.

```bash
npm install
npm run dev
```

Puis ouvrir http://127.0.0.1:4178 . Le site de production se construit avec `npm run build` (dossier `dist/`) et se vérifie avec `npm run preview`.

## Adresse publique

https://bastien1051.github.io/Iptv-gladiator/

Page pour Android, iPhone et téléviseur : https://bastien1051.github.io/Iptv-gladiator/partage.html

APK : https://github.com/bastien1051/Iptv-gladiator/releases/latest/download/IPTV-Gladiator.apk

Le dépôt GitHub Actions construit le site à chaque envoi sur `main` et chaque nuit (le catalogue gratuit est retéléchargé). Dans les réglages Pages du dépôt, la source doit être **GitHub Actions**. Les adresses des fichiers sont relatives : elles fonctionnent dans `/Iptv-gladiator/` et dans l’application Android.

Une liste personnelle est lue directement par le navigateur. Si le téléviseur la bloque (CORS), l’écran affiche l’erreur : il n’y a pas de relais sur ce site statique. Importez alors le fichier M3U.

## Héberger gratuitement

Le build est un site statique. Les adresses des fichiers sont relatives : le même dossier `dist/` fonctionne à la racine d’un domaine ou dans un sous-chemin.

### GitHub Pages

1. `npm run build`
2. Dans le dépôt, activer Pages sur la branche de publication, dossier `/docs` ou « GitHub Actions ».
3. Copier le contenu de `dist/` (pas le dossier lui-même) vers la racine publiée. Pour un site de projet `https://utilisateur.github.io/iptv-gladiator/`, le base relative suffit.
4. Le site doit être servi en HTTPS pour pouvoir être installé.

### Netlify Drop

1. `npm run build`
2. Ouvrir https://app.netlify.com/drop
3. Déposer le dossier `dist/`.

Aucun compte n’est obligatoire pour un essai. L’adresse fournie est en HTTPS.

### Cloudflare Pages

1. Créer un projet Pages relié au dépôt.
2. Commande de build : `npm run build`
3. Dossier de sortie : `dist`
4. Aucune variable d’environnement n’est requise.

## Installer sur un téléphone Android

1. Ouvrir l’adresse HTTPS dans Chrome.
2. Menu du navigateur, puis **Installer l’application** ou **Ajouter à l’écran d’accueil**.
3. IPTV Gladiator s’ouvre ensuite sans barre d’adresse, comme une application. Les listes et le guide restent dans l’appareil (IndexedDB).

Sur le réseau local, Chrome peut aussi proposer l’installation depuis `http://127.0.0.1`.

## Android TV et Fire TV

IPTV Gladiator se pilote au pavé directionnel : flèches pour le cadre doré, OK / Entrée pour valider, Retour pour revenir, touches chaîne ou Page haut / bas pour zapper, chiffres pour un numéro de la liste affichée.

- **Android TV** : si un navigateur est installé (Chrome, TV Bro…), ouvrir l’adresse du site. Dans Réglages, activer **Grand format télévision**.
- **Fire TV** : ouvrir **Silk**, saisir l’adresse. La télécommande envoie les flèches, le centre valide, Retour revient. Le grand format se règle au même endroit.

Le navigateur du téléviseur doit savoir lire le MSE (c’est le cas des versions récentes). Un téléviseur ancien peut refuser certains flux.

## Navigateurs Samsung et LG

- **Samsung (Tizen)** : application Internet, saisir l’adresse. Les modèles récents utilisent Chromium et lisent le HLS. La télécommande déplace le cadre.
- **LG (webOS)** : application Navigateur. webOS 4 et les suivants sont utilisables. La télécommande magique et les flèches fonctionnent.

Ces navigateurs n’installent pas toujours le site comme une application : gardez le favori. Ils ne fournissent pas non plus l’enregistrement `MediaRecorder` de façon fiable. Pour enregistrer, laissez IPTV Gladiator ouvert sur un ordinateur, ou utilisez le relais ffmpeg.

## Application Android (Capacitor)

Le fichier `capacitor.config.json` est prêt (`appId` : `fr.editionsbastien.iptvgladiator`). Il autorise les flux HTTP depuis la page locale, car beaucoup de flux publics ne sont pas en HTTPS.

Prérequis : JDK 17 ou 21, Android SDK, variable `ANDROID_HOME`.

```bash
npm install
npm run build
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
```

L’APK de démonstration est alors `android/app/build/outputs/apk/debug/app-debug.apk`. Cette machine de construction n’a pas le SDK Android : l’APK n’a pas été produit ici.

Une TWA (Trusted Web Activity) n’a de sens qu’une fois le site publié en HTTPS, avec un `assetlinks.json` à votre nom de domaine. Bubblewrap peut ensuite empaqueter cette adresse. Sans domaine fixe, Capacitor est le chemin le plus direct.

## Relais et enregistrement

Le navigateur enregistre via `captureStream()` et MediaRecorder (fichier WebM). Cela échoue souvent : sans en-tête CORS, l’image se voit mais ne se capture pas. L’enregistrement programmé depuis le guide ne tourne que tant que l’onglet reste ouvert.

Le dossier `server/` lance un relais local et ffmpeg. Voir [server/README.md](server/README.md).

```bash
npm run helper
```

Dans Réglages, relais local : `http://127.0.0.1:8787`. Ne publiez pas ce processus : il relaie n’importe quelle adresse HTTP.

## Raccourcis

| Touche | Action |
| --- | --- |
| Flèches | Déplacer le cadre |
| Entrée / OK | Valider |
| Échap, Retour | Revenir |
| Page haut / bas, chaîne + / − | Zapper |
| Chiffres | Numéro dans la liste affichée |
| P | Chaîne précédente |
| M | Muet |
| F | Plein écran |
| I | Infos du programme |
| R | Enregistrer / arrêter |

## Limites

- Beaucoup de flux publics tombent, sont géobloqués ou refusent le navigateur (CORS). Après deux échecs, la chaîne est marquée hors service. Le relais local contourne le CORS, pas un géoblocage.
- Le lecteur enchaîne hls.js (HLS, débit automatique), mpegts.js (`.ts` et FLV), Shaka Player (DASH) et la lecture native. Les flux chiffrés ne sont pas lus.
- Les sous-titres affichés sont ceux du flux, ou un fichier `.srt` / `.vtt`. Si l’audio est annoncé dans une autre langue et qu’une piste française existe, elle s’active. Il n’y a pas de traduction automatique des dialogues.
- L’onglet **Adulte** reste visible et demande un code à 4 chiffres, avec une confirmation 18+ la première fois. Au 8 novembre 2026, aucun flux officiel gratuit et lisible n’a pu être intégré : iptv-org ne publie plus cette catégorie, et les listes qui rediffusent des chaînes payantes ont été écartées. Une source que vous ajoutez peut en contenir : elles sont rangées ici, et restent absentes de l’accueil, de la recherche et des récents tant que le code n’est pas saisi.
- Le guide préchargé ne couvre pas toute la TNT. Ajoutez un XMLTV si vous en avez un.
- Le code parental est un verrou local. Il ne chiffre pas les flux.
- Les logos viennent des listes. Certains sites ont un certificat invalide : le logo manque, la chaîne reste lisible.
- Reprendre un film, un épisode ou un replay mémorise la position sur l’appareil. Le direct reprend la dernière chaîne non verrouillée.

## Vérifications

`npm test` analyse les listes et télécharge l’index iptv-org. Au moment de la mise au point : 11 465 chaînes, 428 dans Sport, 13 dans Sports de combat, lecture HLS de 20 Minutes TV dans un Chrome headless, guide Pluto / Samsung TV Plus / Plex reçu en HTTP 200.
