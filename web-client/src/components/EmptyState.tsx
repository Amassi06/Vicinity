import type { ReactElement } from 'react';
import type { LucideIcon } from 'lucide-react';

/** État vide unique : icône discrète + phrase, dans un cadre pointillé. */
export function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }): ReactElement {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-input p-8 text-center">
      <Icon className="size-6 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
