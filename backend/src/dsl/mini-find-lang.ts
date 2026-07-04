/**
 * Petit langage FIND du type FIND coll WHERE champ EQ valeur [LIMIT n].
 * Compilé par un vrai parser lex/yacc (jison) généré depuis la grammaire
 * lex-yacc/grammar/mongo-dsl.jison (voir aussi les fichiers .l/.y de
 * référence flex/bison dans ce même dossier). Le parser généré est commité
 * sous ./generated/mongo-dsl.parser.js — régénérable via `npm run dsl:build`.
 */
import { parser } from './generated/mongo-dsl.parser.js';

export interface CompiledMongoFindQuery {
  collection: keyof typeof COLLECTIONS;
  mongoCollectionName: string;
  filter: Record<string, unknown>;
  limit: number;
}

const COLLECTIONS = {
  messages: 'messages',
  listings: 'listings',
  events: 'events',
} as const;

export class DSLParseError extends Error {
  override readonly name = 'DSLParseError';
}

export function compileMongoFindDsl(script: string): CompiledMongoFindQuery {
  let ast;
  try {
    ast = parser.parse(script.trim());
  } catch (err) {
    throw new DSLParseError(err instanceof Error ? err.message : 'erreur_de_syntaxe');
  }

  const collKeyRaw = ast.collection.toLowerCase();
  if (!(collKeyRaw in COLLECTIONS)) {
    throw new DSLParseError('collection_inconnue');
  }
  const collKey = collKeyRaw as keyof typeof COLLECTIONS;

  const limit = ast.limit === null ? 50 : Math.min(500, Math.max(1, ast.limit));

  return {
    collection: collKey,
    mongoCollectionName: COLLECTIONS[collKey],
    filter: { [ast.field]: ast.value },
    limit,
  };
}
