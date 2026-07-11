# grammar/

Langage de requête maison **FIND -> filtre Mongo** :

```
FIND <collection> WHERE <champ> EQ <valeur> [LIMIT <n>]
```

## Chemin principal : jison (lex/yacc en JS)

`mongo-dsl.jison` est la grammaire officielle, écrite au format jison (le port
JS standard de flex+bison, mêmes concepts : section lexicale `%lex ... /lex`
puis règles de grammaire `%%`). Elle est compilée en un vrai parser LALR via :

```bash
cd backend
npm run dsl:build
# génère backend/src/dsl/generated/mongo-dsl.parser.js (committé)
```

`backend/src/dsl/mini-find-lang.ts` délègue directement à ce parser généré ;
c'est lui qui est exécuté en test/prod (`compileMongoFindDsl()`).

## Grammaire de référence flex/bison (documentation)

`mongo-dsl.l.example` et `mongo-dsl.y` documentent la même grammaire dans sa
forme C flex/bison originale (tokens FIND/WHERE/EQ/LIMIT/IDENT/STRING/NUMBER).
Ils ne sont pas utilisés au runtime — les garder sert de référence/preuve que
la grammaire jison est équivalente à une vraie grammaire lex/yacc. Pour les
régénérer en C (hors CI) :

```bash
flex mongo-dsl.l
bison -d mongo-dsl.y   # mongo-dsl.tab.h + mongo-dsl.tab.c
```