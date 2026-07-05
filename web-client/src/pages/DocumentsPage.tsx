import { FormEvent, useCallback, useEffect, useState, type ReactElement } from 'react';
import { apiFetch, apiFetchObjectUrl, getAccessToken } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiError.js';
import { useAuth } from '../context/AuthContext.js';
import { useNotifications } from '../context/NotificationsContext.js';
import { useT } from '../i18n/I18nContext.js';
import { ZoneEditor } from '../components/ZoneEditor.js';
import { SignaturePad } from '../components/SignaturePad.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Badge } from '@/components/ui/badge.js';
import { cn } from '@/lib/utils.js';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type DocRow = { _id: string; title: string; status: string };
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

/** Affiche l'image de signature (blob authentifié). */
function SignatureImage({
  documentId,
  zoneIndex,
  alt,
}: {
  documentId: string;
  zoneIndex: number;
  alt: string;
}): ReactElement | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoked: string | null = null;
    void apiFetchObjectUrl(`/documents/${documentId}/zones/${zoneIndex}/signature`)
      .then((u) => {
        revoked = u;
        setUrl(u);
      })
      .catch(() => undefined);
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [documentId, zoneIndex]);
  if (!url) return null;
  return <img src={url} alt={alt} className="ml-auto h-10 rounded border border-border bg-white" />;
}

/** Badge de statut : gris (brouillon), orange (en attente), vert (signé). */
function StatusBadge({ status, t }: { status: string; t: (k: string) => string }): ReactElement {
  const cls =
    status === 'signed'
      ? 'border-transparent bg-emerald-500/15 text-emerald-500'
      : status === 'pending_signatures'
        ? 'border-transparent bg-amber-500/15 text-amber-500'
        : status === 'archived'
          ? 'border-transparent bg-muted text-muted-foreground'
          : 'border-transparent bg-zinc-500/15 text-zinc-400';
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium', cls)}>
      {t(`documents.status.${status}`)}
    </span>
  );
}

export function DocumentsPage(): ReactElement {
  const { user } = useAuth();
  const { refresh: refreshNotifs } = useNotifications();
  const t = useT();
  const [items, setItems] = useState<DocRow[]>([]);
  const [inbox, setInbox] = useState<DocRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocDetail | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState(false);
  const [signingIndex, setSigningIndex] = useState<number | null>(null);
  const [signTokens, setSignTokens] = useState<Record<number, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [mine, box] = await Promise.all([
        apiFetch<{ items: DocRow[] }>('/documents'),
        apiFetch<{ items: DocRow[] }>('/documents/inbox'),
      ]);
      setItems(mine.items);
      setInbox(box.items);
    } catch (e) {
      setErr(apiErrorMessage(e, t));
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
        setErr(apiErrorMessage(e, t));
      }
    },
    [t],
  );

  // Ouvre un document : charge le détail + le PDF (blob authentifié → iframe).
  useEffect(() => {
    if (!selectedId) {
      setSelectedDoc(null);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    void loadSelectedDoc(selectedId);
    setPdfError(false);
    let revoked: string | null = null;
    void apiFetchObjectUrl(`/documents/${selectedId}/file`)
      .then((u) => {
        revoked = u;
        setPdfUrl(u);
      })
      .catch(() => setPdfError(true));
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [selectedId, loadSelectedDoc]);

  async function upload(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    setErr(null);
    if (!file || file.size > MAX_UPLOAD_BYTES) {
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

  async function sign(index: number, signatureImage: string): Promise<void> {
    if (!selectedId) return;
    setErr(null);
    setSigningIndex(index);
    try {
      const token = signTokens[index]?.trim();
      await apiFetch(`/documents/${selectedId}/zones/${index}/sign`, {
        method: 'POST',
        json: { signatureImage, ...(token ? { mfaToken: token } : {}) },
      });
      setMsg(t('documents.signed'));
      setSignTokens((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      await Promise.all([load(), loadSelectedDoc(selectedId), refreshNotifs()]);
    } catch (e) {
      setErr(apiErrorMessage(e, t));
    } finally {
      setSigningIndex(null);
    }
  }

  function DocList({ rows, emptyKey }: { rows: DocRow[]; emptyKey: string }): ReactElement {
    if (rows.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-input p-6 text-center text-sm text-muted-foreground">
          {t(emptyKey)}
        </div>
      );
    }
    return (
      <ul className="space-y-2">
        {rows.map((d) => (
          <li key={d._id}>
            {/* Ligne ENTIÈRE cliquable pour ouvrir le document */}
            <button
              type="button"
              onClick={() => setSelectedId(d._id === selectedId ? null : d._id)}
              className={cn(
                'flex w-full flex-wrap items-center gap-2 rounded-lg border p-4 text-left transition-colors',
                d._id === selectedId
                  ? 'border-primary bg-accent'
                  : 'border-border bg-background/40 hover:border-primary/40',
              )}
            >
              <span className="min-w-0 flex-1 truncate font-medium">{d.title}</span>
              <StatusBadge status={d.status} t={t} />
              <span className="text-xs text-muted-foreground">
                {d._id === selectedId ? t('documents.close') : t('documents.open')}
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('documents.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
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

        {/* Inbox : documents reçus à signer */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">{t('documents.received')}</h2>
          {listLoading ? (
            <p className="text-sm text-muted-foreground">{t('documents.loading')}</p>
          ) : (
            <DocList rows={inbox} emptyKey="documents.inbox.empty" />
          )}
        </div>

        {/* Mes documents */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">{t('documents.mine')}</h2>
          {listLoading ? (
            <p className="text-sm text-muted-foreground">{t('documents.loading')}</p>
          ) : (
            <DocList rows={items} emptyKey="documents.empty" />
          )}
        </div>

        {/* Visualiseur PDF (blob authentifié, plus de lien cassé) */}
        {selectedId ? (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">{t('documents.viewer.title')}</h2>
            {pdfError ? (
              <p className="text-sm text-destructive">{t('documents.viewer.error')}</p>
            ) : pdfUrl ? (
              <iframe
                title={t('documents.viewer.title')}
                src={pdfUrl}
                className="h-[60vh] w-full rounded-lg border border-border"
              />
            ) : (
              <p className="text-sm text-muted-foreground">{t('documents.viewer.loading')}</p>
            )}
          </div>
        ) : null}

        {selectedId && selectedDoc?.status === 'draft' ? (
          <ZoneEditor documentId={selectedId} onSaved={() => void loadSelectedDoc(selectedId)} />
        ) : null}

        {/* Zones de signature : signature manuscrite au canvas */}
        {selectedDoc && selectedDoc.zones.length > 0 ? (
          <ul className="space-y-3">
            {selectedDoc.zones.map((z, i) => {
              const mine = !!user && z.signedBy === user.sub;
              return (
                <li key={`${z.x}-${z.y}-${i}`} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>
                      {t('documents.sign.zone')} {i}
                    </span>
                    <Badge variant={z.required ? 'default' : 'secondary'}>
                      {z.required ? t('documents.sign.required') : t('documents.sign.optional')}
                    </Badge>
                    {z.signedBy ? (
                      <Badge variant="success">{t('documents.sign.signedBy')}</Badge>
                    ) : (
                      <Badge variant="destructive">{t('documents.sign.unsigned')}</Badge>
                    )}
                    {z.signedBy && selectedId ? (
                      <SignatureImage
                        documentId={selectedId}
                        zoneIndex={i}
                        alt={mine ? t('documents.sign.signedBy') : ''}
                      />
                    ) : null}
                  </div>

                  {!z.signedBy ? (
                    <div className="mt-2.5 space-y-2">
                      <p className="text-xs font-medium">{t('documents.sign.title')}</p>
                      {/* Champ TOTP visible seulement si le backend a réclamé le MFA */}
                      {err === t('errors.mfa_required') ? (
                        <Input
                          className="max-w-32"
                          value={signTokens[i] ?? ''}
                          onChange={(e) => setSignTokens((prev) => ({ ...prev, [i]: e.target.value }))}
                          placeholder={t('documents.sign.mfaHint')}
                          maxLength={6}
                        />
                      ) : null}
                      <SignaturePad
                        submitting={signingIndex === i}
                        onSubmit={(dataUrl) => void sign(i, dataUrl)}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
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
