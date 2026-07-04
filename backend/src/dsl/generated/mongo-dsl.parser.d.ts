export interface ParsedMongoDslQuery {
  collection: string;
  field: string;
  value: string | number;
  limit: number | null;
}

export interface MongoDslParser {
  parse(input: string): ParsedMongoDslQuery;
}

export const parser: MongoDslParser;
