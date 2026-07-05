import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import { Button } from '@/components/ui/button.js';
import { useT } from '../i18n/I18nContext.js';

/**
 * Pad de signature manuscrite : l'utilisateur dessine sa signature au doigt/à la
 * souris ; `onSubmit` reçoit l'image PNG en data URL. Remplace la saisie de code.
 */
export function SignaturePad({
  onSubmit,
  submitting,
}: {
  onSubmit: (dataUrl: string) => void;
  submitting: boolean;
}): ReactElement {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  }, []);

  function pos(ev: ReactPointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = ev.currentTarget.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  function start(ev: ReactPointerEvent<HTMLCanvasElement>): void {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawingRef.current = true;
    const { x, y } = pos(ev);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // La capture du pointeur peut échouer sur certains environnements ; sans
    // conséquence sur le dessin, donc on ne laisse pas l'erreur casser le trait.
    try {
      ev.currentTarget.setPointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
  }

  function move(ev: ReactPointerEvent<HTMLCanvasElement>): void {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pos(ev);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  }

  function end(): void {
    drawingRef.current = false;
  }

  function clear(): void {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  function submit(): void {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    onSubmit(canvas.toDataURL('image/png'));
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={320}
        height={120}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="touch-none rounded-md border border-input bg-white"
        aria-label={t('documents.sign.canvasLabel')}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={submit} disabled={!hasInk || submitting}>
          {submitting ? t('documents.zoneEditor.saving') : t('documents.sign.submit')}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={clear} disabled={submitting}>
          {t('documents.sign.clear')}
        </Button>
        <span className="text-xs text-muted-foreground">{t('documents.sign.drawHint')}</span>
      </div>
    </div>
  );
}
