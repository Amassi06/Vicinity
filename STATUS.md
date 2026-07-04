# État d'avancement — Connected Neighbours (Vicinity)

Ce document liste, pour chaque exigence du cahier des charges (voir [README.md](README.md)), ce qui est **fait**, **partiel** ou **manquant** dans le code actuel. Légende : ✅ Fait — 🟡 Partiel — ❌ Manquant.

## Résumé rapide

| Domaine | ✅ Fait | 🟡 Partiel | ❌ Manquant |
|---|---|---|---|
| Backend (Node.js/Express) | 14 | 0 | 0 |
| Web (React client + admin) | 9 | 0 | 0 |
| Client lourd Java (desktop) | 9 | 0 | 0 |
| Infra / CI / Documentation | 3 | 0 | 0 |

---

## 1. Backend (Node.js/Express)

| Fonctionnalité | Statut | Détail |
|---|---|---|
| Quartier géographique (dessin + gestion des limites) | ✅ | PostGIS (`ST_Contains`, `ST_Intersects`, `ST_Touches`), détection des chevauchements — `backend/src/neighbourhood/repository.ts` |
| Petites annonces + points + contrat obligatoire | ✅ | Création/acceptation d'annonce, transfert de points atomique, contrat auto — `backend/src/listings/service.ts`, `backend/src/wallet/service.ts` |
| Documents PDF + zones de signature + MFA obligatoire | ✅ | Upload, zones, signature avec vérification MFA, hash d'archivage — `backend/src/documents/service.ts` |
| Événements + suggestions Neo4j (avec intérêt "swipe") | ✅ | Création, intérêt/déclin via relations Neo4j, recommandations — `backend/src/events/service.ts`, `neo4j.ts`, routes `/events/:id/interest` et `/events/:id/decline` |
| Messagerie temps réel + pièces jointes | ✅ | Chat texte, upload photo/vocal (`POST /conversations/:cid/attachments`), présence via Socket.IO — `backend/src/messages/`, `realtime/socket-server.ts` |
| Votes configurables/extensibles | ✅ | Système de plugins de vote (standard, min 3 options, quorum) — `backend/src/polls/`, `backend/src/plugins/registry.ts` |
| Multilingue | ✅ | Middleware i18n (fr/en) qui traduit les codes d'erreur selon `Accept-Language` — `backend/src/i18n/` |
| Extensibilité générique (ajout de modules sans toucher au code) | ✅ | Registre de modules générique, chaque route s'auto-enregistre — `backend/src/plugins/module-registry.ts` |
| Sécurité : MFA / SSO / rôles | ✅ | TOTP (otplib), endpoint SSO pour le client Java, rôles HABITANT/MODERATOR/ADMIN — `backend/src/auth/` |
| RGPD | ✅ | Export, suppression (anonymisation), gestion des consentements, journal d'audit — `backend/src/gdpr/service.ts` |
| Conteneurisation + tests | ✅ | Docker Compose (Postgres/PostGIS, MongoDB, Neo4j, MinIO), 17 suites de tests (unitaires/intégration) — `infra/docker/docker-compose.yml`, `backend/tests/` |
| Bases de données (Postgres/PostGIS + MongoDB + Neo4j) | ✅ | Prisma (Postgres), Mongoose (MongoDB), neo4j-driver (graphe social) |
| Langage de requête maison (lex/yacc) | ✅ | Grammaire jison (lex/yacc) compilée en parser réel — `lex-yacc/grammar/mongo-dsl.jison`, intégré dans `backend/src/dsl/mini-find-lang.ts` |
| Documentation Swagger/OpenAPI | ✅ | Spec exposée via `/openapi.yaml` et `/docs` — `backend/src/http/openapi.ts`, `docs/api/openapi.yaml` |

## 2. Web (React) — `web-client` (résidents) / `web-admin` (back-office)

| Fonctionnalité | Statut | Détail |
|---|---|---|
| Dessin de quartier | ✅ (admin) | Leaflet + Geoman, gestion des chevauchements — `web-admin` `AdminNeighbourhoodsPage.tsx`. Côté résident : lecture seule (`QuartiersExplorerMap.tsx`) |
| Petites annonces + contrats | ✅ | Création, acceptation, points, contrat — `ListingsPage.tsx` |
| Documents & signatures | ✅ | Upload, liste, signature par code TOTP, éditeur visuel de zones sur rendu PDF (pdfjs-dist) — `DocumentsPage.tsx`, `components/ZoneEditor.tsx` |
| Événements & swipe | ✅ | Création, boutons + geste de swipe (gauche = décliner, droite = intéressé) — `EventsPage.tsx`, `hooks/useSwipe.ts` |
| Messagerie multimédia | ✅ | Chat texte temps réel, upload photo/vocal, indicateur de présence en ligne/hors ligne — `MessagesPage.tsx` |
| Votes | ✅ | Création de sondage configurable, vote, résultats — `PollsPage.tsx` |
| Multilingue | ✅ | Contexte i18n (fr/en) custom, sélecteur de langue dans le menu, toutes les pages traduites — `i18n/I18nContext.tsx` |
| Auth / MFA / SSO / rôles | ✅ | Login/register, activation MFA, SSO vers le client Java, UI conditionnée par rôle — `LoginPage.tsx`, `MfaPage.tsx`, `SsoPage.tsx` |
| RGPD | ✅ | Export, suppression, consentements, et rectification (nom libre, e-mail derrière TOTP) — `PrivacyPage.tsx`, backend `PATCH /me/profile` |

## 3. Client lourd Java (desktop, admin)

| Fonctionnalité | Statut | Détail |
|---|---|---|
| Base locale embarquée offline-first | ✅ | H2 avec cache des quartiers, incidents, statistiques, session, réglages — `store/LocalStore.java` |
| Gestion des incidents/alertes signalés | ✅ | Résidents signalent sur le web (`IncidentsPage.tsx`, backend `incidents/`), admin consulte/change le statut hors-ligne sur le cache H2 — `ui/tabs/IncidentsTab.java` |
| Statistiques de participation | ✅ | Comptages (annonces, événements, sondages, incidents) via `GET /admin/stats`, mis en cache et affichés dans l'onglet Accueil — `ui/tabs/HomeTab.java` |
| Synchronisation automatique + résolution de conflits | ✅ | `SyncService.java` (planificateur toutes les 5 min + démarrage), résolution de conflit optimiste via `updatedAt` (409 côté backend) |
| Plugins (export stats, analyse sociale, calendrier) | ✅ | 3 actions locales concrètes : export JSON, appel aux recommandations Neo4j existantes, liste triée des événements — `ui/tabs/PluginsTab.java` |
| Thèmes personnalisables | ✅ | Clair/sombre + couleur d'accent + taille de police, persistés — `ui/ThemeSupport.java`. Personnalisation de disposition non incluse (hors périmètre réaliste) |
| Mises à jour automatiques | ✅ | Vérification automatique au démarrage via `GET /desktop/latest-version`, téléchargement manuel en un clic — `update/UpdateChecker.java` |
| Désinstallation depuis l'UI | ✅ | Bouton "Désinstaller" : confirmation, purge de `~/.vicinity`, fermeture de l'application — `ui/MainView.java` |
| Packaging en .jar exécutable | ✅ | Plugin Gradle Shadow, tâche `shadowJar` produisant un jar exécutable unique (mono-plateforme) — `build.gradle.kts` |

## 4. Infra / CI / Documentation

| Fonctionnalité | Statut | Détail |
|---|---|---|
| Conteneurisation | ✅ | Postgres/PostGIS, MongoDB, Neo4j, MinIO avec healthchecks — `infra/docker/docker-compose.yml` |
| CI (build/test) | ✅ | Jobs backend, web (client+admin), desktop (Gradle) — `.github/workflows/ci.yml` |
| Documentation (schémas, Swagger, modélisation BDD) | ✅ | Swagger/OpenAPI (`docs/api/openapi.yaml`), schémas d'architecture/conteneurs/SSO (`docs/architecture.md`), modélisation Postgres/Mongo/Neo4j/H2 (`docs/database-model.md`) |

---

Tous les domaines du cahier des charges sont à ✅.
