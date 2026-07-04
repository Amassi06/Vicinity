import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext.js';
import { DocumentsPage } from './DocumentsPage.js';
import { apiFetch } from '../lib/api.js';

vi.mock('../lib/api.js', () => ({
  apiFetch: vi.fn(),
  getAccessToken: () => 'test-token',
}));

vi.mock('../components/ZoneEditor.js', () => ({
  ZoneEditor: () => <div data-testid="zone-editor" />,
}));

const mockedApiFetch = vi.mocked(apiFetch);

function renderPage(): ReturnType<typeof render> {
  return render(
    <I18nProvider>
      <DocumentsPage />
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
  it('shows the empty state once the document list resolves empty', async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [] });
    renderPage();
    expect(await screen.findByText("Aucun document pour l'instant.")).toBeInTheDocument();
  });

  it('renders each document with its status badge and a PDF link', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      items: [{ _id: 'doc-1', title: 'Bail appartement', status: 'draft' }],
    });
    renderPage();
    expect(await screen.findByText('Bail appartement')).toBeInTheDocument();
    expect(screen.getByText('draft')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'PDF' })).toHaveAttribute(
      'href',
      '/api/documents/doc-1/file',
    );
  });
});

describe('DocumentsPage — upload flow', () => {
  it('disables the submit button and shows the uploading label while the request is in flight', async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [] });
    const user = userEvent.setup();
    const pending: { resolve: (() => void) | null } = { resolve: null };
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          pending.resolve = () =>
            resolve(
              new Response(JSON.stringify({ _id: 'doc-2' }), {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
              }),
            );
        }),
    );
    renderPage();
    await screen.findByText("Aucun document pour l'instant.");

    const titleInput = screen.getByLabelText('Titre');
    const fileInput = screen.getByLabelText('Choisissez un PDF.');
    const file = new File(['%PDF-1.4'], 'bail.pdf', { type: 'application/pdf' });
    await user.type(titleInput, 'Bail');
    await user.upload(fileInput, file);

    mockedApiFetch.mockResolvedValueOnce({ items: [] });
    const submit = screen.getByRole('button', { name: 'Téléverser' });
    await user.click(submit);

    expect(await screen.findByRole('button', { name: 'Téléversement…' })).toBeDisabled();
    pending.resolve?.();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Téléverser' })).not.toBeDisabled());
  });

  it('shows a validation error and never calls fetch when no file was chosen', async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [] });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Aucun document pour l'instant.");
    await user.type(screen.getByLabelText('Titre'), 'Bail');
    await user.click(screen.getByRole('button', { name: 'Téléverser' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choisissez un PDF.');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('DocumentsPage — per-zone signature flow', () => {
  it('lists zones with signed/unsigned status and signs an unsigned zone with a TOTP token', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      items: [{ _id: 'doc-3', title: 'Convention', status: 'pending_signatures' }],
    });
    mockedApiFetch.mockResolvedValueOnce({
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

    const zoneOneRow = (await screen.findByText('zone 1')).closest('li');
    expect(zoneOneRow).not.toBeNull();
    expect(within(zoneOneRow as HTMLElement).getByText('Signée')).toBeInTheDocument();

    const zoneZeroRow = screen.getByText('zone 0').closest('li') as HTMLElement;
    expect(within(zoneZeroRow).getByText('Non signée')).toBeInTheDocument();

    mockedApiFetch.mockResolvedValueOnce({});
    mockedApiFetch.mockResolvedValueOnce({ items: [] });
    mockedApiFetch.mockResolvedValueOnce({
      _id: 'doc-3',
      title: 'Convention',
      status: 'signed',
      zones: [],
    });

    await user.type(within(zoneZeroRow).getByPlaceholderText('TOTP 6 chiffres'), '123456');
    await user.click(within(zoneZeroRow).getByRole('button', { name: 'Signer' }));

    await waitFor(() =>
      expect(mockedApiFetch).toHaveBeenCalledWith('/documents/doc-3/zones/0/sign', {
        method: 'POST',
        json: { token: '123456' },
      }),
    );
  });
});
