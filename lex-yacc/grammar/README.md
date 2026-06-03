# grammar/

Fichiers **lex/yacc de référence** décrivant le sous-langage FIND vers Mongo.

La chaîne officielle compilée durant les revues utilise le compilateur TypeScript
`backend/src/dsl/mini-find-lang.ts` (pas besoin de C pour `npm test`).

Pour régénérer du C hors CI :

```bash
cd grammar
flex mongo-dsl.l
bison -d mongo-dsl.y   # mongo-dsl.tab.h + mongo-dsl.tab.c
```

Puis assembler un shim C minimal contenant une fonction `ffi` si tu dois lier depuis Node —
hors périmètre du squelette Vicinity livré ici.
