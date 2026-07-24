# desktop-client Vicinity

Client **JavaFX 21** pour administrateurs / modérateurs : connexion API, cache
**H2** hors-ligne des quartiers, crédit portefeuille (ADMIN).

## Prérequis

- **JDK 21+**
- Backend Vicinity sur `http://localhost:3000` (`cd backend && npm run dev`)
- Bases Docker : `make up` à la racine du monorepo

> Utilisez **`./gradlew run`**, pas le `gradle` système Ubuntu (4.x).

## Lancer

```bash
cd desktop-client
./gradlew run
```

Autre URL API :

```bash
./gradlew run -Dvicinity.api.url=http://192.168.1.10:3000
```


Ou fichier `~/.vicinity/config.properties` :

```properties
api.url=http://localhost:3000
```

## Fonctionnalités

| Écran | Description |
|-------|-------------|
| **Connexion** | E-mail / mot de passe, ou jeton SSO (`POST /auth/sso/issue` depuis le web) |
| **Accueil** | Profil, mode en ligne / hors ligne, test `healthz` / `readyz` |
| **Quartiers** | Liste synchronisée depuis `GET /neighbourhoods`, cache H2 |
| **Portefeuille** | `POST /admin/wallet/credit` (rôle ADMIN) |

### Données locales

- Base H2 : `~/.vicinity/data/vicinity-desktop.mv.db`
- Session (jetons + profil) persistée pour reconnexion rapide
- Si l’API est injoignable, le client reste utilisable en **lecture** sur le cache quartiers

### Jeton SSO (desktop)

1. Connectez-vous sur **web-admin** (compte ADMIN de préférence).
2. Dans Swagger (`/docs`) ou via curl : `POST /auth/sso/issue` avec votre Bearer web.
3. Collez le `ssoToken` dans le champ SSO du client bureau.

## Build

```bash
./gradlew build
```

## Dépannage

| Erreur | Solution |
|--------|----------|
| `Task 'run' not found` | `./gradlew run` |
| **`HTTP/1.1 header parser received no bytes`** | Backend **non démarré** ou **mauvaise URL** (souvent `:5173` au lieu de `:3000`) |
| Connexion refusée | `make up` puis `cd backend && npm run dev` |
| `forbidden` sur wallet | Promouvoir le rôle en base (`users.role`) |
| Pas d’affichage | Environnement graphique (X11 / Wayland) requis |

L’API Express écoute sur **`http://localhost:3000`**, pas sur les ports Vite (5173 / 5174).
