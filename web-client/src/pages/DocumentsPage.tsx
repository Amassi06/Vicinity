import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { FileText } from 'lucide-react';
import { apiFetch, apiFetchObjectUrl, apiUpload } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiError.js';
import { useAuth } from '../context/AuthContext.js';
import { useNotifications } from '../context/NotificationsContext.js';
import { useToast } from '../context/ToastContext.js';
import { useT } from '../i18n/I18nContext.js';
import { ZoneEditor } from '../components/ZoneEditor.js';
import { SignaturePad } from '../components/SignaturePad.js';
import { PageHeader } from '../components/PageHeader.js';
import { EmptyState } from '../components/EmptyState.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Badge } from '@/components/ui/badge.js';
import { ListSkeleton } from '@/components/ui/skeleton.js';
import { cn } from '@/lib/utils.js';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type DocumentRow = { _id: string; title: string; status: string };
type SignatureZone = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  signedBy: string | null;
};
type DocumentDetail = DocumentRow & { zones: SignatureZone[] };

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
    let objectUrl: string | null = null;
    void apiFetchObjectUrl(`/documents/${documentId}/zones/${zoneIndex}/signature`)
      .then((fetchedUrl) => {
        objectUrl = fetchedUrl;
        setUrl(fetchedUrl);
      })
      .catch(() => undefined);
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, zoneIndex]);
  if (!url) return null;
  return <img src={url} alt={alt} className="ml-auto h-10 rounded border border-border bg-white" />;
}

/** Badge de statut : gris (brouillon), orange (en attente), vert (signé). */
function StatusBadge({ status }: { status: string }): ReactElement {
  const t = useT();
  const colorClass =
    status === 'signed'
      ? 'border-transparent bg-emerald-500/15 text-emerald-500'
      : status === 'pending_signatures'
        ? 'border-transparent bg-amber-500/15 text-amber-500'
        : status === 'archived'
          ? 'border-transparent bg-muted text-muted-foreground'
          : 'border-transparent bg-zinc-500/15 text-zinc-400';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium',
        colorClass,
      )}
    >
      {t(`documents.status.${status}`)}
    </span>
  );
}

/** Liste de documents dont chaque ligne entière est cliquable pour ouvrir/fermer. */
function DocumentList({
  rows,
  emptyText,
  selectedId,
  onSelect,
}: {
  rows: DocumentRow[];
  emptyText: string;
  selectedId: string | null;
  onSelect: (documentId: string) => void;
}): ReactElement {
  const t = useT();
  if (rows.length === 0) {
    return <EmptyState icon={FileText} text={emptyText} />;
  }
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row._id}>
          <button
            type="button"
            onClick={() => onSelect(row._id)}
            className={cn(
              'flex w-full flex-wrap items-center gap-2 rounded-lg border p-4 text-left transition-colors',
              row._id === selectedId
                ? 'border-primary bg-accent'
                : 'border-border bg-background/40 hover:border-primary/40',
            )}
          >
            <span className="min-w-0 flex-1 truncate font-medium">{row.title}</span>
            <StatusBadge status={row.status} />
            <span className="text-xs text-muted-foreground">
              {row._id === selectedId ? t('documents.close') : t('documents.open')}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function DocumentsPage(): ReactElement {
  const { user } = useAuth();
  const { refresh: refreshNotifications } = useNotifications();
  const { showToast } = useToast();
  const t = useT();
  const [myDocuments, setMyDocuments] = useState<DocumentRow[]>([]);
  const [inboxDocuments, setInboxDocuments] = useState<DocumentRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentDetail | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState(false);
  const [signingIndex, setSigningIndex] = useState<number | null>(null);
  const [signTokens, setSignTokens] = useState<Record<number, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [mine, inbox] = await Promise.all([
        apiFetch<{ items: DocumentRow[] }>('/documents'),
        apiFetch<{ items: DocumentRow[] }>('/documents/inbox'),
      ]);
      setMyDocuments(mine.items);
      setInboxDocuments(inbox.items);
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, t));
    } finally {
      setListLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadSelectedDocument = useCallback(
    async (documentId: string) => {
      try {
        const detail = await apiFetch<DocumentDetail>(`/documents/${documentId}`);
        setSelectedDocument(detail);
      } catch (error) {
        setErrorMessage(apiErrorMessage(error, t));
      }
    },
    [t],
  );

  // Ouvre un document : charge le détail + le PDF (blob authentifié → iframe).
  useEffect(() => {
    if (!selectedId) {
      setSelectedDocument(null);
      setPdfUrl((previousUrl) => {
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        return null;
      });
      return;
    }
    void loadSelectedDocument(selectedId);
    setPdfError(false);
    let objectUrl: string | null = null;
    void apiFetchObjectUrl(`/documents/${selectedId}/file`)
      .then((fetchedUrl) => {
        objectUrl = fetchedUrl;
        setPdfUrl(fetchedUrl);
      })
      .catch(() => setPdfError(true));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedId, loadSelectedDocument]);

  async function upload(formEvent: FormEvent): Promise<void> {
    formEvent.preventDefault();
    setErrorMessage(null);
    if (!file || file.size > MAX_UPLOAD_BYTES) {
      setErrorMessage(t('documents.form.chooseFile'));
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      await apiUpload('/documents', formData);
      setTitle('');
      setFile(null);
      showToast(t('documents.uploaded'));
      await load();
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, t));
    } finally {
      setUploading(false);
    }
  }

  async function sign(zoneIndex: number, signatureImage: string): Promise<void> {
    if (!selectedId) return;
    setErrorMessage(null);
    setSigningIndex(zoneIndex);
    try {
      const mfaToken = signTokens[zoneIndex]?.trim();
      await apiFetch(`/documents/${selectedId}/zones/${zoneIndex}/sign`, {
        method: 'POST',
        json: { signatureImage, ...(mfaToken ? { mfaToken } : {}) },
      });
      showToast(t('documents.signed'));
      setSignTokens((previous) => {
        const next = { ...previous };
        delete next[zoneIndex];
        return next;
      });
      await Promise.all([load(), loadSelectedDocument(selectedId), refreshNotifications()]);
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, t));
    } finally {
      setSigningIndex(null);
    }
  }

  function toggleSelected(documentId: string): void {
    setSelectedId(documentId === selectedId ? null : documentId);
  }

  return (
    <div>
      <PageHeader title={t('documents.title')} description={t('documents.subtitle')} />

      {errorMessage ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-6">
        <form
          className="card-sheen flex flex-wrap items-end gap-2 rounded-xl border border-border/70 bg-card/70 p-4 backdrop-blur-md"
          onSubmit={(formEvent) => void upload(formEvent)}
        >
          <div className="space-y-1">
            <Label htmlFor="doc-title">{t('documents.form.title')}</Label>
            <Input
              id="doc-title"
              className="max-w-56"
              value={title}
              onChange={(changeEvent) => setTitle(changeEvent.target.value)}
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
              onChange={(changeEvent) => setFile(changeEvent.target.files?.[0] ?? null)}
            />
          </div>
          <Button type="submit" disabled={uploading}>
            {uploading ? t('documents.uploading') : t('documents.form.upload')}
          </Button>
        </form>

        {/* Inbox : documents reçus à signer */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{t('documents.received')}</h2>
          {listLoading ? (
            <ListSkeleton rows={2} />
          ) : (
            <DocumentList
              rows={inboxDocuments}
              emptyText={t('documents.inbox.empty')}
              selectedId={selectedId}
              onSelect={toggleSelected}
            />
          )}
        </section>

        {/* Mes documents */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{t('documents.mine')}</h2>
          {listLoading ? (
            <ListSkeleton rows={2} />
          ) : (
            <DocumentList
              rows={myDocuments}
              emptyText={t('documents.empty')}
              selectedId={selectedId}
              onSelect={toggleSelected}
            />
          )}
        </section>

        {/* Visualiseur PDF (blob authentifié) */}
        {selectedId ? (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {t('documents.viewer.title')}
            </h2>
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
          </section>
        ) : null}

        {selectedId && selectedDocument?.status === 'draft' ? (
          <ZoneEditor documentId={selectedId} onSaved={() => void loadSelectedDocument(selectedId)} />
        ) : null}

        {/* Zones de signature : signature manuscrite au canvas */}
        {selectedDocument && selectedDocument.zones.length > 0 ? (
          <ul className="space-y-3">
            {selectedDocument.zones.map((zone, zoneIndex) => {
              const signedByMe = !!user && zone.signedBy === user.sub;
              return (
                <li
                  key={`${zone.x}-${zone.y}-${zoneIndex}`}
                  className="rounded-lg border border-border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span>
                      {t('documents.sign.zone')} {zoneIndex}
                    </span>
                    <Badge variant={zone.required ? 'default' : 'secondary'}>
                      {zone.required ? t('documents.sign.required') : t('documents.sign.optional')}
                    </Badge>
                    {zone.signedBy ? (
                      <Badge variant="success">{t('documents.sign.signedBy')}</Badge>
                    ) : (
                      <Badge variant="destructive">{t('documents.sign.unsigned')}</Badge>
                    )}
                    {zone.signedBy && selectedId ? (
                      <SignatureImage
                        documentId={selectedId}
                        zoneIndex={zoneIndex}
                        alt={signedByMe ? t('documents.sign.signedBy') : ''}
                      />
                    ) : null}
                  </div>

                  {!zone.signedBy ? (
                    <div className="mt-2.5 space-y-2">
                      <p className="text-xs font-medium">{t('documents.sign.title')}</p>
                      {/* Champ TOTP visible seulement si le backend a réclamé le MFA */}
                      {errorMessage === t('errors.mfa_required') ? (
                        <Input
                          className="max-w-32"
                          value={signTokens[zoneIndex] ?? ''}
                          onChange={(changeEvent) =>
                            setSignTokens((previous) => ({
                              ...previous,
                              [zoneIndex]: changeEvent.target.value,
                            }))
                          }
                          placeholder={t('documents.sign.mfaHint')}
                          maxLength={6}
                        />
                      ) : null}
                      <SignaturePad
                        submitting={signingIndex === zoneIndex}
                        onSubmit={(signatureDataUrl) => void sign(zoneIndex, signatureDataUrl)}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
