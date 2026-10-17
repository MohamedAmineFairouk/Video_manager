# Développement, release et déploiement – Ar44

## Vue d'ensemble

| Environnement | Backend | Front | Base PostgreSQL | Lancement |
|---|---|---|---|---|
| **Prod** | `ar44.jar` sur http://localhost:8080 | servi par le jar | `db_video` | `arcad44.ps1` dans le dossier de déploiement |
| **Dev** | `mvnw spring-boot:run` sur **:8081** | Vite sur http://localhost:5173 | `db_video_dev` (copie de prod) | commandes ci-dessous |

Dossier de déploiement (prod) : `D:\Programs\apache-maven-3.8.6\lib\ext\load_sheet\Ar44_Portable\`
(contient `ar44.jar`, `videos/`, `thumbnails/`, `a_supprimer/`, `ar44.log`, `arcad44.ps1`).

## Cycle de travail

1. Développer sur `develop`, **sans commit**.
2. Tester en **environnement de dev** (section suivante). La prod n'est pas touchée.
3. **Validation par l'utilisateur** dans le navigateur (http://localhost:5173).
4. Seulement après validation : commits → tag → push → build du jar → déploiement.

## 1. Environnement de dev

### Créer / rafraîchir la base de dev (copie de la prod)

```powershell
$env:PGPASSWORD = '123456'
$pg = 'C:\Program Files\PostgreSQL\15\bin'
& "$pg\dropdb.exe"   -U postgres --if-exists db_video_dev
& "$pg\createdb.exe" -U postgres db_video_dev
& "$pg\pg_dump.exe"  -U postgres db_video | & "$pg\psql.exe" -q -U postgres db_video_dev
```

### Lancer le backend de dev (port 8081, base de dev)

```powershell
$env:SERVER_PORT = '8081'
$env:DB_URL = 'jdbc:postgresql://localhost:5432/db_video_dev'
.\mvnw.cmd spring-boot:run
```

### Lancer le front de dev (proxy `/api` → 8081)

```powershell
cd frontend
$env:VITE_BACKEND_URL = 'http://localhost:8081'
npm run dev        # http://localhost:5173
```

> ⚠️ Le dev lit les **mêmes dossiers `videos/` et `thumbnails/` que la prod** (valeurs par défaut de
> `application.properties`). Les modifications de métadonnées (titres, créateurs, tags, playlists,
> favoris...) ne touchent que `db_video_dev`, mais **supprimer une vidéo en dev déplace le vrai
> fichier** hors du dossier prod. Ne pas tester la suppression en dev.

## 2. Release (après validation)

Version `X.Y.Z` (dernier tag : `git tag --sort=-creatordate | head -1`).

1. Commit du code source : `Release X.Y.Z : <résumé>` + liste à puces des changements.
2. Mettre à jour la version dans `frontend/package.json` et `pom.xml` → commit `Bump version to X.Y.Z`.
3. Build du front (`frontend/vite.config.js` sort dans `src/main/resources/static`) :
   ```
   cd frontend && npm run build
   ```
   → commit `Build frontend X.Y.Z`.
4. Tag annoté : `git tag -a X.Y.Z -m "Release X.Y.Z"`.
5. Push :
   ```
   git push origin develop
   git push origin X.Y.Z
   ```

## 3. Build du jar

```powershell
.\mvnw.cmd -q package -DskipTests      # → target\ar44.jar
```

## 4. Déploiement

```powershell
$d = 'D:\Programs\apache-maven-3.8.6\lib\ext\load_sheet\Ar44_Portable'
& "$d\arcad44.ps1" stop                                            # libère le jar
Copy-Item "$d\ar44.jar" "$d\ar44-<ancienne_version>.jar.bak" -Force  # sauvegarde
Copy-Item .\target\ar44.jar "$d\ar44.jar" -Force
(Get-FileHash "$d\ar44.jar").Hash -eq (Get-FileHash .\target\ar44.jar).Hash   # doit afficher True
& "$d\arcad44.ps1" start
& "$d\arcad44.ps1" status
```

Vérifier ensuite http://localhost:8080. Si `ingest_videos.py` a changé, le recopier aussi dans le dossier de déploiement.

### Rollback

```powershell
& "$d\arcad44.ps1" stop
Copy-Item "$d\ar44-<ancienne_version>.jar.bak" "$d\ar44.jar" -Force
& "$d\arcad44.ps1" start
```
