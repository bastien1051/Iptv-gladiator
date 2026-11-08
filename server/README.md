# Relais local

Petit serveur Node.js, sans dépendance, pour deux choses que le navigateur fait mal :

- relayer un flux et réécrire les listes HLS, afin d’ajouter les en-têtes CORS (et, si besoin, un user-agent) ;
- enregistrer avec ffmpeg, en copie de flux, dans un fichier `.ts`.

Il n’écoute que sur `127.0.0.1`. Ne le publiez pas sur Internet : ce serait un proxy ouvert.

```bash
npm run helper
```

Puis, dans Réglages → Relais local : `http://127.0.0.1:8787`.

ffmpeg doit être installé (`ffmpeg -version`). Les fichiers sont écrits dans `server/recordings/`.

- `GET /health`
- `GET /proxy?url=`
- `POST /record` avec `{ "url", "seconds", "title" }`
- `POST /record/:id/stop`
- `GET /recordings` et `GET /recordings/:fichier`
