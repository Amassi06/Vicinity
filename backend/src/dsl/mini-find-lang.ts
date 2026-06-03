/**
 * Petit langage FIND du type FIND coll WHERE champ EQ valeur [LIMIT n].
 * Référencé par la grammaire flex/bison décrite sous lex-yacc/grammar/.
 */

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

type Tk =
  | { k: 'kw'; v: string }
  | { k: 'ident'; v: string }
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'eof' };

export class DSLParseError extends Error {
  override readonly name = 'DSLParseError';
}

function isIdentCont(ch: string | undefined): boolean {
  return ch !== undefined && /[a-zA-Z0-9_]/.test(ch);
}

function startsKeyword(src: string, i: number, kw: string): boolean {
  const slice = src.slice(i, i + kw.length);
  if (slice.toLowerCase() !== kw.toLowerCase()) return false;
  return !isIdentCont(src[i + kw.length]);
}

export function lexDslLite(input: string): Tk[] {
  const tokens: Tk[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (startsKeyword(input, i, 'find')) {
      tokens.push({ k: 'kw', v: 'find' });
      i += 'find'.length;
      continue;
    }
    if (startsKeyword(input, i, 'where')) {
      tokens.push({ k: 'kw', v: 'where' });
      i += 'where'.length;
      continue;
    }
    if (startsKeyword(input, i, 'eq')) {
      tokens.push({ k: 'kw', v: 'eq' });
      i += 'eq'.length;
      continue;
    }
    if (startsKeyword(input, i, 'limit')) {
      tokens.push({ k: 'kw', v: 'limit' });
      i += 'limit'.length;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let escaped = '';
      while (j < input.length && input[j] !== quote) {
        if (input[j] === '\\' && j + 1 < input.length) {
          escaped += input[j + 1];
          j += 2;
          continue;
        }
        escaped += input[j];
        j += 1;
      }
      if (j >= input.length || input[j] !== quote) {
        throw new DSLParseError('chaîne_non_terminée');
      }
      tokens.push({ k: 'str', v: escaped });
      i = j + 1;
      continue;
    }

    if (/[0-9]/.test(ch) || ch === '-') {
      let j = i;
      if (input[j] === '-') j += 1;
      const startDigits = j;
      while (j < input.length && /[0-9]/.test(input[j]!)) j += 1;
      if (j === startDigits) throw new DSLParseError('nombre_invalide');

      const n = Number.parseInt(input.slice(i, j), 10);
      if (Number.isNaN(n)) throw new DSLParseError('nombre_invalide');
      tokens.push({ k: 'num', v: n });
      i = j;
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let j = i + 1;
      while (j < input.length && /[a-zA-Z0-9_]/.test(input[j]!)) j += 1;
      tokens.push({ k: 'ident', v: input.slice(i, j) });
      i = j;
      continue;
    }

    throw new DSLParseError('caractère_inattendu');
  }

  tokens.push({ k: 'eof' });
  return tokens;
}

export function compileMongoFindDsl(script: string): CompiledMongoFindQuery {
  const t = lexDslLite(script.trim());
  let p = 0;

  function cur(): Tk {
    const x = t[p];
    return x ?? { k: 'eof' };
  }

  function eatKw(kw: string): void {
    const c = cur();
    if (c.k !== 'kw' || c.v !== kw) {
      throw new DSLParseError(`attend_${kw}`);
    }
    p += 1;
  }

  eatKw('find');
  const c0 = cur();
  if (c0.k !== 'ident') throw new DSLParseError('collection_manquante');
  const collKeyRaw = c0.v.toLowerCase();
  if (!(collKeyRaw in COLLECTIONS)) {
    throw new DSLParseError('collection_inconnue');
  }
  const collKey = collKeyRaw as keyof typeof COLLECTIONS;
  p += 1;

  eatKw('where');

  const fieldTk = cur();
  if (fieldTk.k !== 'ident') throw new DSLParseError('champ_manquant');
  const fieldName = fieldTk.v;
  p += 1;

  eatKw('eq');

  const valTk = cur();
  if (valTk.k === 'eof') throw new DSLParseError('valeur_manquante');
  p += 1;
  let value: string | number;
  if (valTk.k === 'str') value = valTk.v;
  else if (valTk.k === 'num') value = valTk.v;
  else throw new DSLParseError('valeur_non_prise_en_charge');

  let limit = 50;
  if (cur().k !== 'eof') {
    eatKw('limit');
    const limitTk = cur();
    if (limitTk.k !== 'num') throw new DSLParseError('limit_entier_manquant');
    limit = Math.min(500, Math.max(1, limitTk.v));
    p += 1;
  }

  if (cur().k !== 'eof') throw new DSLParseError('suite_inattendue');

  return {
    collection: collKey,
    mongoCollectionName: COLLECTIONS[collKey],
    filter: { [fieldName]: value },
    limit,
  };
}
