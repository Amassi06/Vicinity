import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { CheckCircle2 } from 'lucide-react';

type Toast = { id: number; message: string };

type ToastValue = {
  /** Affiche une confirmation éphémère (succès), auto-fermée après 3,2 s. */
  showToast: (message: string) => void;
};

const TOAST_DURATION_MS = 3200;

const Ctx = createContext<ToastValue | null>(null);

let nextToastId = 0;

export function ToastProvider({ children }: { children: ReactNode }): ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string) => {
    nextToastId += 1;
    const id = nextToastId;
    setToasts((previous) => [...previous, { id, message }]);
    setTimeout(() => {
      setToasts((previous) => previous.filter((toast) => toast.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  const value = useMemo((): ToastValue => ({ showToast }), [showToast]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="animate-rise flex items-center gap-2 rounded-full border border-border bg-card/90 px-4 py-2 text-sm shadow-xl backdrop-blur-md"
          >
            <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
            {toast.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast hors provider');
  return v;
}
