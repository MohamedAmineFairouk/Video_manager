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

---
**Statut** : toutes les tâches ci-dessus ont été implémentées côté front (`frontend/src/...`) et le build (`npm run build`) passe sans erreur.
Backend (`mvnw spring-boot:run`, port 8080) et frontend dev (`npm run dev`, port 5173) tournent en local pour vérification visuelle.
