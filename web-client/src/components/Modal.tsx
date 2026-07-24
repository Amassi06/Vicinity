import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useT } from '../i18n/I18nContext.js';

/**
 * Boîte de dialogue accessible : rôle dialog, fermeture par Échap et clic
 * sur le voile, focus posé sur la boîte à l'ouverture.
 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}): ReactElement {
  const t = useT();
  const dialogRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  dialogRef.current?.focus();
}, []);

useEffect(() => {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') onClose();
  };

  document.addEventListener('keydown', onKeyDown);

  return () => {
    document.removeEventListener('keydown', onKeyDown);
  };
}, [onClose]);

  // Portal vers <body> : un ancêtre avec transform (ex. .animate-rise de
  // l'AppShell) deviendrait sinon le référentiel du position:fixed et la
  // modale se calerait sur la page au lieu du viewport.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="animate-rise flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-border bg-background p-6 shadow-2xl outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
