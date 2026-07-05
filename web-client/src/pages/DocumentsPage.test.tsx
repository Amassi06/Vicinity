import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext.js';
import { ToastProvider } from '../context/ToastContext.js';
import { DocumentsPage } from './DocumentsPage.js';
import { apiFetch, apiUpload } from '../lib/api.js';

vi.mock('../lib/api.js', () => ({
  apiFetch: vi.fn(),
  apiFetchObjectUrl: vi.fn().mockResolvedValue('blob:fake'),
  apiUpload: vi.fn(),
  getAccessToken: () => 'test-token',
}));

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({ user: { sub: 'me', role: 'HABITANT' } }),
}));

vi.mock('../context/NotificationsContext.js', () => ({
  useNotifications: () => ({ refresh: vi.fn() }),
}));

vi.mock('../components/ZoneEditor.js', () => ({
  ZoneEditor: () => <div data-testid="zone-editor" />,
}));

// SignaturePad simplifié : un bouton qui simule un dessin validé.
vi.mock('../components/SignaturePad.js', () => ({
  SignaturePad: ({ onSubmit }: { onSubmit: (d: string) => void }) => (
    <button type="button" onClick={() => onSubmit('data:image/png;base64,AAAA')}>
      draw-and-sign
    </button>
  ),
}));

const mockedApiFetch = vi.mocked(apiFetch);

function renderPage(): ReturnType<typeof render> {
  return render(
    <I18nProvider>
      <ToastProvider>
        <DocumentsPage />
      </ToastProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  mockedApiFetch.mockReset();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DocumentsPage — list and empty state', () => {
  it('shows the empty state once the lists resolve empty', async () => {
    // /documents puis /documents/inbox
    mockedApiFetch.mockResolvedValueOnce({ items: [] }).mockResolvedValueOnce({ items: [] });
    renderPage();
    expect(await screen.findByText("Aucun document pour l'instant.")).toBeInTheDocument();
    expect(screen.getByText('Aucun document en attente de votre signature.')).toBeInTheDocument();
  });

  it('renders a document with a coloured status badge (draft -> Brouillon)', async () => {
    mockedApiFetch
      .mockResolvedValueOnce({ items: [{ _id: 'doc-1', title: 'Bail appartement', status: 'draft' }] })
      .mockResolvedValueOnce({ items: [] });
    renderPage();
    expect(await screen.findByText('Bail appartement')).toBeInTheDocument();
    expect(screen.getByText('Brouillon')).toBeInTheDocument();
  });
});

describe('DocumentsPage — upload flow', () => {
  it('shows a validation error and never uploads when no file was chosen', async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [] }).mockResolvedValueOnce({ items: [] });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Aucun document pour l'instant.");
    await user.type(screen.getByLabelText('Titre'), 'Bail');
    await user.click(screen.getByRole('button', { name: 'Téléverser' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choisissez un PDF.');
    expect(vi.mocked(apiUpload)).not.toHaveBeenCalled();
  });
});

describe('DocumentsPage — handwritten signature flow', () => {
  it('signs an unsigned zone with a drawn signature image', async () => {
    mockedApiFetch
      .mockResolvedValueOnce({ items: [{ _id: 'doc-3', title: 'Convention', status: 'pending_signatures' }] })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({
        _id: 'doc-3',
        title: 'Convention',
        status: 'pending_signatures',
        zones: [
          { page: 1, x: 0, y: 0, width: 10, height: 10, required: true, signedBy: null },
          { page: 1, x: 0, y: 20, width: 10, height: 10, required: true, signedBy: 'user-9' },
        ],
      });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByText('Convention'));

    const zoneZeroRow = (await screen.findByText('zone 0')).closest('li') as HTMLElement;
    expect(within(zoneZeroRow).getByText('Non signée')).toBeInTheDocument();

    // clics de rechargement post-signature
    mockedApiFetch
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ _id: 'doc-3', title: 'Convention', status: 'signed', zones: [] });

    await user.click(within(zoneZeroRow).getByRole('button', { name: 'draw-and-sign' }));

    await waitFor(() =>
      expect(mockedApiFetch).toHaveBeenCalledWith('/documents/doc-3/zones/0/sign', {
        method: 'POST',
        json: { signatureImage: 'data:image/png;base64,AAAA' },
      }),
    );
  });
});
