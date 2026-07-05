import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
} from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { apiFetch, getAccessToken } from '../lib/api.js';
import { toCanvasPoint, isZoneTooSmall, buildZoneFromCorners, type Point } from '../lib/zoneGeometry.js';
import { useT } from '../i18n/I18nContext.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MIN_ZONE_SIZE_PX = 8;
type Zone = { page: number; x: number; y: number; width: number; height: number; required: boolean };

export function ZoneEditor({
  documentId,
  onSaved,
}: {
  documentId: string;
  onSaved: () => void;
}): ReactElement {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pageRef = useRef<PDFPageProxy | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [pendingCorner, setPendingCorner] = useState<Point | null>(null);
  const [required, setRequired] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [saving, setSaving] = useState(false);
  const [manualX, setManualX] = useState('');
  const [manualY, setManualY] = useState('');
  const [manualWidth, setManualWidth] = useState('');
  const [manualHeight, setManualHeight] = useState('');
  // Signataires choisis parmi les habitants du quartier (par leur nom).
  const [neighbours, setNeighbours] = useState<Array<{ id: string; displayName: string }>>([]);
  const [selectedSigners, setSelectedSigners] = useState<Set<string>>(new Set());

  useEffect(() => {
    void apiFetch<{ items: Array<{ id: string; displayName: string }> }>('/me/neighbours')
      .then((r) => setNeighbours(r.items))
      .catch(() => setNeighbours([]));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let pdf: PDFDocumentProxy | null = null;
    setLoadingPdf(true);
    setLoadError(null);
    void (async () => {
      const res = await fetch(`/api/documents/${documentId}/file`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(t('documents.zoneEditor.loadError'));
      }
      const buf = await res.arrayBuffer();
      if (cancelled) return;
      pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      if (cancelled) return;
      const page = await pdf.getPage(1);
      if (cancelled) return;
      pageRef.current = page;
      setLoadingPdf(false);
    })().catch((e: unknown) => {
      if (cancelled) return;
      setLoadingPdf(false);
      setLoadError(e instanceof Error ? e.message : t('documents.zoneEditor.loadError'));
    });
    return () => {
      cancelled = true;
      controller.abort();
      pageRef.current = null;
      void pdf?.destroy();
    };
  }, [documentId, t]);

  useEffect(() => {
    const page = pageRef.current;
    const canvas = canvasRef.current;
    if (!page || !canvas || loadingPdf) return;
    let cancelled = false;
    void (async () => {
      const viewport = page.getViewport({ scale: 1 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;
      if (cancelled) return;
      ctx.fillStyle = 'rgba(37, 99, 235, 0.25)';
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.9)';
      ctx.lineWidth = 2;
      for (const zone of zones) {
        ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
        ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
      }
      if (pendingCorner) {
        ctx.fillStyle = 'rgba(220, 38, 38, 0.9)';
        ctx.beginPath();
        ctx.arc(pendingCorner.x, pendingCorner.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [zones, pendingCorner, loadingPdf]);

  function addZone(zone: Zone): void {
    setErr(null);
    setZones((prev) => [...prev, zone]);
  }

  function handleClick(ev: ReactMouseEvent<HTMLCanvasElement>): void {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const point = toCanvasPoint(ev.clientX, ev.clientY, rect, canvas.width, canvas.height);
    if (!pendingCorner) {
      setPendingCorner(point);
      return;
    }
    const zone = buildZoneFromCorners(pendingCorner, point, 1, required);
    if (isZoneTooSmall(zone.width, zone.height, MIN_ZONE_SIZE_PX)) {
      setErr(t('documents.zoneEditor.tooSmall'));
      return;
    }
    addZone(zone);
    setPendingCorner(null);
  }

  function removeZone(index: number): void {
    setZones((prev) => prev.filter((_, i) => i !== index));
  }

  function submitManualZone(ev: FormEvent): void {
    ev.preventDefault();
    const x = Number(manualX);
    const y = Number(manualY);
    const width = Number(manualWidth);
    const height = Number(manualHeight);
    if (isZoneTooSmall(width, height, MIN_ZONE_SIZE_PX) || Number.isNaN(x) || Number.isNaN(y)) {
      setErr(t('documents.zoneEditor.tooSmall'));
      return;
    }
    addZone({ page: 1, x, y, width, height, required });
    setManualX('');
    setManualY('');
    setManualWidth('');
    setManualHeight('');
  }

  async function save(): Promise<void> {
    setErr(null);
    setSaving(true);
    try {
      const participantIds = [...selectedSigners];
      await apiFetch(`/documents/${documentId}/zones`, {
        method: 'POST',
        json: participantIds.length ? { zones, participants: participantIds } : { zones },
      });
      setMsg(t('documents.zoneEditor.saved'));
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.error.generic'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('documents.zoneEditor.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground">{t('documents.zoneEditor.instructions')}</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
          />
          {t('documents.zoneEditor.required')}
        </label>
        <div className="space-y-1.5">
          <Label>{t('documents.zoneEditor.participants')}</Label>
          {neighbours.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('documents.zoneEditor.noNeighbours')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {neighbours.map((n) => {
                const checked = selectedSigners.has(n.id);
                return (
                  <label
                    key={n.id}
                    className={
                      'flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm ' +
                      (checked ? 'border-primary bg-primary/5' : 'border-input')
                    }
                  >
                    <input
                      type="checkbox"
                      className="size-3.5"
                      checked={checked}
                      onChange={(e) =>
                        setSelectedSigners((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(n.id);
                          else next.delete(n.id);
                          return next;
                        })
                      }
                    />
                    {n.displayName}
                  </label>
                );
              })}
            </div>
          )}
        </div>
        {loadingPdf ? (
          <div
            role="status"
            aria-live="polite"
            className="flex h-64 items-center justify-center rounded-md border border-dashed border-input text-muted-foreground"
          >
            {t('documents.zoneEditor.loading')}
          </div>
        ) : loadError ? null : (
          <canvas
            ref={canvasRef}
            onClick={handleClick}
            role="img"
            aria-label={
              pendingCorner
                ? t('documents.zoneEditor.pendingCorner')
                : t('documents.zoneEditor.instructions')
            }
            className="max-w-full rounded-md border border-border"
          />
        )}
        <ul className="space-y-2">
          {zones.map((z, i) => (
            <li key={`${z.x}-${z.y}-${i}`} className="flex flex-wrap items-center gap-2 text-sm">
              page {z.page} — x:{Math.round(z.x)} y:{Math.round(z.y)} w:{Math.round(z.width)} h:
              {Math.round(z.height)} {z.required ? `(${t('documents.zoneEditor.required')})` : ''}
              <Button size="sm" variant="secondary" onClick={() => removeZone(i)}>
                {t('documents.zoneEditor.remove')}
              </Button>
            </li>
          ))}
        </ul>
        <details className="rounded-md border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            {t('documents.zoneEditor.manualTitle')}
          </summary>
          <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={submitManualZone}>
            <div className="space-y-1">
              <Label htmlFor="zone-manual-x">{t('documents.zoneEditor.manualX')}</Label>
              <Input
                id="zone-manual-x"
                type="number"
                className="w-24"
                value={manualX}
                onChange={(e) => setManualX(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="zone-manual-y">{t('documents.zoneEditor.manualY')}</Label>
              <Input
                id="zone-manual-y"
                type="number"
                className="w-24"
                value={manualY}
                onChange={(e) => setManualY(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="zone-manual-width">{t('documents.zoneEditor.manualWidth')}</Label>
              <Input
                id="zone-manual-width"
                type="number"
                className="w-24"
                value={manualWidth}
                onChange={(e) => setManualWidth(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="zone-manual-height">{t('documents.zoneEditor.manualHeight')}</Label>
              <Input
                id="zone-manual-height"
                type="number"
                className="w-24"
                value={manualHeight}
                onChange={(e) => setManualHeight(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary">
              {t('documents.zoneEditor.manualAdd')}
            </Button>
          </form>
        </details>
        <Button disabled={!zones.length || saving} onClick={() => void save()}>
          {saving ? t('documents.zoneEditor.saving') : t('documents.zoneEditor.save')}
        </Button>
        {msg ? (
          <p aria-live="polite">{msg}</p>
        ) : null}
        {loadError ? (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}
        {err ? (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
