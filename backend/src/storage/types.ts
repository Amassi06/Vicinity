/** Résultat d’un enregistrement PDF (clé opaque + empreinte SHA-256). */
export interface StoredFile {
  storageKey: string;
  sha256: string;
  bytes: number;
}
