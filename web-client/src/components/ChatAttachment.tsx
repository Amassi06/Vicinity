import { useEffect, useState, type ReactElement } from 'react';
import { apiFetchObjectUrl } from '../lib/api.js';

type Attachment = { storageKey: string; contentType: string; kind: string };

/** Affiche une pièce jointe (image/vocal) récupérée en blob authentifié. */
export function ChatAttachment({
  conversationId,
  attachment,
}: {
  conversationId: string;
  attachment: Attachment;
}): ReactElement | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    let active = true;
    void apiFetchObjectUrl(
      `/conversations/${conversationId}/attachments/${attachment.storageKey}`,
    )
      .then((u) => {
        if (active) {
          revoked = u;
          setUrl(u);
        } else {
          URL.revokeObjectURL(u);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [conversationId, attachment.storageKey]);

  if (!url) return <span className="text-xs opacity-70">…</span>;
  if (attachment.kind === 'image') {
    return <img src={url} alt="" className="mt-1 max-h-[200px] max-w-[200px] rounded-md" />;
  }
  if (attachment.kind === 'audio') {
    return <audio controls preload="metadata" src={url} className="mt-1 h-9 max-w-full" />;
  }
  return (
    <a href={url} download className="mt-1 block text-xs underline">
      {attachment.kind}
    </a>
  );
}
