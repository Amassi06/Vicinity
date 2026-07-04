import { FormEvent, useCallback, useEffect, useState, type ReactElement } from 'react';
import { apiFetch, getAccessToken } from '../lib/api.js';
import { useT } from '../i18n/I18nContext.js';
import { ZoneEditor } from '../components/ZoneEditor.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Badge } from '@/components/ui/badge.js';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type DocRow = {
  _id: string;
  title: string;
  status: string;
};

type ZoneRow = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  signedBy: string | null;
};

type DocDetail = DocRow & { zones: ZoneRow[] };

export function DocumentsPage(): ReactElement {
  const t = useT();
  const [items, setItems] = useState<DocRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocDetail | null>(null);
  const [signingIndex, setSigningIndex] = useState<number | null>(null);
  const [signTokens, setSignTokens] = useState<Record<number, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ items: DocRow[] }>('/documents');
      setItems(res.items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.error.generic'));
    } finally {
      setListLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadSelectedDoc = useCallback(
    async (id: string) => {
      try {
        const doc = await apiFetch<DocDetail>(`/documents/${id}`);
        setSelectedDoc(doc);
      } catch (e) {
        setErr(e instanceof Error ? e.message : t('common.error.generic'));
      }
    },
    [t],
  );

  useEffect(() => {
    if (!selectedId) {
      setSelectedDoc(null);
      return;
    }
    void loadSelectedDoc(selectedId);
  }, [selectedId, loadSelectedDoc]);

  async function upload(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    setErr(null);
    if (!file) {
      setErr(t('documents.form.chooseFile'));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setErr(t('documents.form.chooseFile'));
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title);
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        body: fd,
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setErr(data.error ?? res.statusText);
        return;
      }
      setTitle('');
      setFile(null);
      setMsg(t('documents.uploaded'));
      await load();
    } finally {
      setUploading(false);
    }
  }

  async function sign(ev: FormEvent, index: number): Promise<void> {
    ev.preventDefault();
    if (!selectedId) return;
    setErr(null);
    setSigningIndex(index);
    try {
      await apiFetch(`/documents/${selectedId}/zones/${index}/sign`, {
        method: 'POST',
        json: { token: signTokens[index] ?? '' },
      });
      setMsg(t('documents.signed'));
      setSignTokens((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      await Promise.all([load(), loadSelectedDoc(selectedId)]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('documents.errorSign'));
    } finally {
      setSigningIndex(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('documents.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => void upload(e)}>
          <div className="space-y-1">
            <Label htmlFor="doc-title">{t('documents.form.title')}</Label>
            <Input
              id="doc-title"
              className="max-w-56"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('documents.form.title')}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="doc-file">{t('documents.form.chooseFile')}</Label>
            <Input
              id="doc-file"
              type="file"
              className="max-w-56"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button type="submit" disabled={uploading}>
            {uploading ? t('documents.uploading') : t('documents.form.upload')}
          </Button>
        </form>
        {listLoading ? (
          <div role="status" aria-live="polite" className="text-muted-foreground">
            {t('documents.loading')}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-input p-8 text-center text-muted-foreground">
            {t('documents.empty')}
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((d) => (
              <li
                key={d._id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/40 p-4 transition-colors hover:border-primary/40"
              >
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => setSelectedId(d._id)}
                >
                  {d.title}
                </button>
                <Badge variant="secondary">{d.status}</Badge>
                <a
                  href={`/api/documents/${d._id}/file`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {t('documents.pdfLink')}
                </a>
              </li>
            ))}
          </ul>
        )}
        {selectedId && selectedDoc?.status === 'draft' ? (
          <ZoneEditor documentId={selectedId} onSaved={() => void loadSelectedDoc(selectedId)} />
        ) : null}
        {selectedDoc && selectedDoc.zones.length > 0 ? (
          <ul className="space-y-2">
            {selectedDoc.zones.map((z, i) => (
              <li
                key={`${z.x}-${z.y}-${i}`}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm"
              >
                <span>
                  {t('documents.sign.zone')} {i}
                </span>
                <Badge variant={z.required ? 'default' : 'secondary'}>
                  {z.required ? t('documents.sign.required') : t('documents.sign.optional')}
                </Badge>
                {z.signedBy ? (
                  <Badge variant="secondary">{t('documents.sign.signedBy')}</Badge>
                ) : (
                  <>
                    <Badge variant="destructive">{t('documents.sign.unsigned')}</Badge>
                    <form
                      className="flex flex-wrap items-center gap-2"
                      onSubmit={(e) => void sign(e, i)}
                    >
                      <Label htmlFor={`sign-token-${i}`} className="sr-only">
                        {t('documents.sign.token')}
                      </Label>
                      <Input
                        id={`sign-token-${i}`}
                        className="max-w-32"
                        value={signTokens[i] ?? ''}
                        onChange={(e) =>
                          setSignTokens((prev) => ({ ...prev, [i]: e.target.value }))
                        }
                        placeholder={t('documents.sign.token')}
                        maxLength={6}
                      />
                      <Button type="submit" variant="secondary" disabled={signingIndex !== null}>
                        {signingIndex === i ? t('documents.zoneEditor.saving') : t('documents.sign.submit')}
                      </Button>
                    </form>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {msg ? <p aria-live="polite">{msg}</p> : null}
        {err ? (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
