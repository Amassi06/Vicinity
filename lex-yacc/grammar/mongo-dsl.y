%{
#include <stdio.h>

int yylex(void);
void yyerror(const char *);

/* Skeleton Vicinity — le compilateur exécuté en prod/tst est TS (voir backend/src/dsl/). */
%}

%token FIND WHERE EQ LIMIT IDENT STRING NUMBER

%%

query:
          FIND IDENT WHERE IDENT EQ literal opt_limit
          {
            fputs("vicinity yacc: mongo-dsl skeleton OK\n", stdout);
          }
        ;

literal:
          STRING
        | NUMBER
        ;

opt_limit:
          /* empty */
        | LIMIT NUMBER
        ;

%%

void yyerror(const char *s)
{
	fprintf(stderr, "mongo-dsl parse error %s\n", s ? s : "");
}
