import { compileMongoFindDsl, DSLParseError } from '../src/dsl/mini-find-lang.js';

describe('mini-find DSL compiler (jison/lex-yacc generated parser)', () => {
  test('parses FIND / WHERE / EQ / LIMIT', () => {
    const q = compileMongoFindDsl(
      `FIND messages WHERE conversationId EQ "demo-conv-1" LIMIT 10`,
    );
    expect(q.collection).toBe('messages');
    expect(q.mongoCollectionName).toBe('messages');
    expect(q.filter).toEqual({ conversationId: 'demo-conv-1' });
    expect(q.limit).toBe(10);
  });

  test('defaults limit to 50', () => {
    const q = compileMongoFindDsl(`FIND listings WHERE neighbourhoodId EQ "00000000-0000-0000-0000-000000000000"`);
    expect(q.collection).toBe('listings');
    expect(q.limit).toBe(50);
  });

  test('accepts numeric literals', () => {
    const q = compileMongoFindDsl(`FIND events WHERE capacity EQ 42`);
    expect(q.filter).toEqual({ capacity: 42 });
  });

  test('rejects an unknown collection', () => {
    expect(() => compileMongoFindDsl(`FIND unknown_coll WHERE x EQ 1`)).toThrow(DSLParseError);
  });

  test('rejects malformed input', () => {
    expect(() => compileMongoFindDsl(`FIND messages WHERE`)).toThrow(DSLParseError);
  });
});
