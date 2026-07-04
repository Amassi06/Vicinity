/*
 * Grammaire lex/yacc (jison, l'équivalent JS de flex/bison) pour le
 * mini-langage FIND -> filtre Mongo :
 *   FIND <collection> WHERE <champ> EQ <valeur> [LIMIT <n>]
 *
 * Reprend les mêmes tokens que la grammaire de référence flex/bison
 * (mongo-dsl.l.example / mongo-dsl.y) dans ce même dossier.
 *
 * Génération : `npm run dsl:build` (backend/) exécute
 *   jison lex-yacc/grammar/mongo-dsl.jison -o backend/src/dsl/generated/mongo-dsl.parser.js
 */

%lex

%%
\s+                     /* skip whitespace */
"FIND"|"find"           return 'FIND'
"WHERE"|"where"         return 'WHERE'
"EQ"|"eq"               return 'EQ'
"LIMIT"|"limit"         return 'LIMIT'
\"([^\\\"]|\\.)*\"      return 'STRING'
\'([^\\']|\\.)*\'       return 'STRING'
\-?[0-9]+               return 'NUMBER'
[A-Za-z_][A-Za-z0-9_]*  return 'IDENT'
<<EOF>>                 return 'EOF'
.                       return 'INVALID'

/lex

%start query

%%

query
  : FIND IDENT WHERE IDENT EQ literal opt_limit EOF
      {
        $$ = {
          collection: $2,
          field: $4,
          value: $6,
          limit: $7,
        };
        return $$;
      }
  ;

literal
  : STRING
      { $$ = $1.slice(1, -1); }
  | NUMBER
      { $$ = Number($1); }
  ;

opt_limit
  : /* empty */
      { $$ = null; }
  | LIMIT NUMBER
      { $$ = Number($2); }
  ;
