# IPTV Gladiator

Lecteur IPTV pour le téléphone, le navigateur d’un téléviseur et le salon. Interface en français. Les listes préchargées sont publiques et gratuites (iptv-org, guides FAST). Une réalisation des Éditions Bastien.

Le guide d’installation (téléphone, Android TV, Fire TV, Samsung, LG, hébergement gratuit, application Android) est dans [README-FR.md](README-FR.md).

## Lancer

```bash
npm install
npm run dev
```

Ouvrir [http://127.0.0.1:4178](http://127.0.0.1:4178).

Adresse permanente : https://bastien1051.github.io/Iptv-gladiator/

Page d’installation : https://bastien1051.github.io/Iptv-gladiator/partage.html

APK : https://github.com/bastien1051/Iptv-gladiator/releases/latest/download/IPTV-Gladiator.apk

Le `base` Vite est relatif (`./`), donc le même build sert le sous-chemin GitHub Pages et l’application Android. Le catalogue gratuit (iptv-org et playlists FAST) est régénéré à chaque construction, y compris chaque nuit par GitHub Actions.

```bash
npm test          # analyseurs + liste iptv-org réelle
npm run build     # site statique dans dist/
npm run preview   # sert dist/ sur le port 4178
npm run helper    # relais local et enregistrement ffmpeg
```

Le relais est décrit dans [server/README.md](server/README.md). Il reste sur `127.0.0.1`.
