# TODO – Améliorations front-end (Bibliothèque de vidéos)

Liste de tâches à implémenter. Cocher au fur et à mesure.

## 1. Étiquette créateur
- [x] Ne plus afficher l'étiquette "Unknown" quand une vidéo n'a pas de créateur.
- [x] Plus généralement, si une vidéo n'a pas de créateur (ou creator = "unknown"), ne rien afficher à la place (pas de badge du tout).
- Fichiers concernés : `frontend/src/components/VideoCard.jsx` (`CreatorBadges`), `frontend/src/components/VideoPlayerModal.jsx` (liste "À suivre", ligne meta créateur).

## 2. Filtre créateurs — lisibilité
- [x] Rendre la liste déroulante des créateurs (filtre) plus lisible.
- [x] Agrandir la taille des options/choix dans ce select (police, hauteur des lignes).
- Fichier concerné : `frontend/src/pages/LibraryPage.jsx` (select `creatorFilter`), styles dans `frontend/src/styles/global.css` (`.creator-filter-select`).

## 3. Filtre créateur — option "UNKNOWN"
- [x] Ajouter une option "UNKNOWN" dans le filtre créateur pour retrouver les vidéos sans créateur.
- Fichier concerné : `frontend/src/pages/LibraryPage.jsx` (logique de filtrage `filtered` + select `creatorFilter`).

## 4. Tri par index
- [x] Ajouter un tri "Index (croissant)" et un tri "Index (décroissant)" dans le select de tri.
- Fichier concerné : `frontend/src/pages/LibraryPage.jsx` (state `sort`, switch de tri, select).

## 5. Nettoyage du bloc filtres
- [x] Supprimer les boutons "Scanner le dossier" (🔄) et "Générer les aperçus" (🎞️) du bloc filtres (et le code associé, décision utilisateur : suppression complète, pas de déplacement).
- [x] Garder uniquement le bouton "Réinitialiser les filtres" (↺).
- Fichier concerné : `frontend/src/pages/LibraryPage.jsx` (`filter-panel-header`).

## 6. Tri par défaut
- [x] Par défaut, afficher les vidéos triées par index décroissant (de 5 à 1).
- Fichier concerné : `frontend/src/pages/LibraryPage.jsx` (state initial `sort`, valeur par défaut de `resetFilters`).

## 7. Recherche globale dans la nav bar
- [x] Ajouter un champ de recherche texte dans la barre du haut (pas dans le bloc filtres).
- [x] La recherche s'applique sur les vidéos déjà filtrées (par titre / créateur / tags).
- Fichier concerné : `frontend/src/pages/LibraryPage.jsx` (zone `brand-row` / en-tête du contenu principal).

## 8. Édition créateur dans le lecteur vidéo
- [x] Dans le lecteur (modal vidéo), cacher par défaut l'édition du champ "Créateurs".
- [x] Afficher un simple libellé/bouton "Créateur" ; au clic, révéler les badges + le champ d'ajout de créateur.
- Fichier concerné : `frontend/src/components/VideoPlayerModal.jsx` (`player-inline-field` "Créateurs").

## 9. Corrections après premier retour visuel
- [x] Tri par défaut inversé : `sourceIndex` est stocké à l'envers (1 = 5 étoiles/meilleur, 5 = 1 étoile/moins bon, cf. `levelToFilledStars` dans `utils.js`) — le tri par défaut affiche maintenant les meilleures étoiles en premier (5 → 1 visuellement).
- [x] Les deux options de tri par niveau utilisent des icônes étoile + flèche (★ ↓ / ★ ↑) au lieu du texte "Index (5→1)"/"Index (1→5)".
- [x] Tri et filtre créateur remis sur la même ligne (`.filter-select-row`).
- [x] Libellés du filtre créateur raccourcis : "Tout" (au lieu de "Tous les créateurs") et "UKWN" (au lieu de "UNKNOWN (sans créateur)").

## 10. Titres obfusqués en base de données
- [x] Le titre des vidéos n'est plus stocké en clair dans Postgres (colonne `video.title`), mais reste lisible normalement sur le front (décodage transparent à la lecture).
- Approche : simple obfuscation réversible (XOR + Base64, préfixe `OBF1:`), même philosophie que `FileObfuscationService` déjà utilisé pour les fichiers vidéo/miniatures — pas du chiffrement cryptographique fort, juste pour qu'une lecture brute de la base ne montre pas les titres.
- Fichiers : `src/main/java/com/local/ar44/converter/TitleObfuscationConverter.java` (nouveau), `dto/Video.java` (`@Convert` sur `title`), `repo/VideoRepository.java` (requêtes SQL brutes de migration), `service/TitleObfuscationMigrationRunner.java` (nouveau, migration automatique au démarrage).
- L'endpoint `GET /api/videos/search` (`VideoController#search`) ne pouvait plus faire de `LIKE` SQL sur une colonne obfusquée : il filtre désormais en mémoire sur le titre décodé (cet endpoint n'est pas utilisé par le front actuellement, qui a sa propre recherche client-side).
- Migration : au démarrage du backend, tous les titres encore en clair ont été réécrits en base (421/421 lignes migrées et vérifiées).

## 11. Renommage des titres (base de données)
- [x] Tous les titres des 421 vidéos ont été renommés en `{Créateur}_{numéro}` (numéro sur 3 chiffres, ex: `AAd_001`, `AAd_002`...), la numérotation repartant à 001 pour chaque créateur.
- [x] Les vidéos sans créateur utilisent `ZAr` comme préfixe (ex: `ZAr_001`... `ZAr_129`, 129 vidéos sans créateur).
- [x] Pour les 8 vidéos ayant 2 créateurs, le premier par ordre alphabétique a été utilisé.
- Exécuté comme une migration ponctuelle en une seule transaction SQL (`BEGIN`/`COMMIT`), directement en base, en réutilisant l'algorithme d'obfuscation (`OBF1:` + XOR + Base64) pour que le nouveau titre soit stocké dans le même format que le reste de la table.
- Une sauvegarde des 421 anciens titres (valeurs obfusquées) a été prise avant l'opération, en plus de la sauvegarde de base déjà faite par l'utilisateur.
- Vérifié par décodage direct d'un échantillon (ex: `AAd_001`, `AAd_002`, `LAn_001`, `ZAr_001`...).

---
**Statut** : toutes les tâches ci-dessus ont été implémentées et testées.
- Front : `npm run build` passe sans erreur.
- Backend : `mvnw compile` passe sans erreur ; migration des titres vérifiée directement en base (`psql`) + round-trip de décodage vérifié indépendamment.
Backend (`mvnw spring-boot:run`, port 8080) et frontend dev (`npm run dev`, port 5173) tournent en local pour vérification visuelle.
