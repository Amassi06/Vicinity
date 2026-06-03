# lex-yacc

**Épice 12** — DSL maison d'interrogation de MongoDB, généré via `lex` + `yacc`
(ou `flex` + `bison`).

## Objectif

Offrir aux administrateurs (et au back-office) un mini-langage déclaratif
plus lisible que les filtres Mongo bruts, qui se compile en pipelines
d'agrégation MongoDB.

Exemple cible (syntaxe indicative) :

```
FIND messages
WHERE conversation = "c-42"
  AND createdAt > "2026-01-01"
ORDER BY createdAt DESC
LIMIT 50
```

→ compilé en :

```js
db.messages.find(
  { conversationId: "c-42", createdAt: { $gt: ISODate("2026-01-01") } }
).sort({ createdAt: -1 }).limit(50)
```

## Livraison Vicinity (minimal)

Compilateur **TypeScript** : `backend/src/dsl/mini-find-lang.ts`.
Route HTTP **`POST /dsl/compile`** (JWT `MODERATOR` ou `ADMIN`).

Référence lex/bison hors CI :

- `grammar/mongo-dsl.y`
- `grammar/mongo-dsl.l.example` (à renommer après `bison -d`)

## Architecture

```
lex-yacc/
├── grammar/
│   ├── mongo-dsl.y            # yacc/bison
│   └── mongo-dsl.l.example    # flex
├── Makefile                   # stubs de build local
└── README.md                  # ce fichier
```

## Intégration

Voir `backend/src/http/routes/dsl.ts`.
