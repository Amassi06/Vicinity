import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext.js';
import { ZoneEditor } from './ZoneEditor.js';
import { apiFetch } from '../lib/api.js';

vi.mock('../lib/api.js', () => ({
  apiFetch: vi.fn(),
  getAccessToken: () => 'test-token',
}));

vi.mock('pdfjs-dist/build/pdf.worker.mjs?url', () => ({ default: 'worker.js' }));

const { destroyMock } = vi.hoisted(() => ({ destroyMock: vi.fn().mockResolvedValue(undefined) }));

vi.mock('pdfjs-dist', () => {
  const fakePage = {
    getViewport: () => ({ width: 600, height: 800 }),
    render: () => ({ promise: Promise.resolve() }),
  };
  const fakePdf = {
    getPage: () => Promise.resolve(fakePage),
    destroy: destroyMock,
  };
  return {
    GlobalWorkerOptions: {},
    getDocument: () => ({ promise: Promise.resolve(fakePdf) }),
  };
});

const mockedApiFetch = vi.mocked(apiFetch);

function renderEditor(onSaved = vi.fn()): { onSaved: typeof onSaved } {
  render(
    <I18nProvider>
      <ZoneEditor documentId="doc-1" onSaved={onSaved} />
    </I18nProvider>,
  );
  return { onSaved };
}

beforeEach(() => {
  mockedApiFetch.mockReset();
  destroyMock.mockClear();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }),
  );
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    clearRect: vi.fn(),
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ZoneEditor — loading and error states', () => {
  it('shows a loading indicator while the PDF is being fetched, then the canvas', async () => {
    renderEditor();
    expect(screen.getByRole('status')).toHaveTextContent('Chargement du PDF…');
    expect(await screen.findByRole('img')).toBeInTheDocument();
  });

  it('shows an error message instead of the canvas when the PDF request fails', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) } as Response);
    renderEditor();
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger le PDF.');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('ZoneEditor — drawing zones on the canvas', () => {
  it('creates a zone from two clicks, scaling displayed coordinates to the canvas native resolution', async () => {
    renderEditor();
    const canvas = await screen.findByRole('img');
    canvas.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 0,
      top: 0,
      width: 300,
      height: 400,
      right: 300,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.click(canvas, { clientX: 50, clientY: 60 });
    fireEvent.click(canvas, { clientX: 100, clientY: 120 });

    expect(await screen.findByText(/x:100 y:120 w:100 h:120/)).toBeInTheDocument();
  });

  it('rejects a zone drawn from two clicks that are too close together', async () => {
    renderEditor();
    const canvas = await screen.findByRole('img');
    canvas.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 0,
      top: 0,
      width: 600,
      height: 800,
      right: 600,
      bottom: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.click(canvas, { clientX: 50, clientY: 60 });
    fireEvent.click(canvas, { clientX: 51, clientY: 61 });

    expect(
      await screen.findByText('Cliquez un deuxième coin différent du premier pour dessiner la zone.'),
    ).toBeInTheDocument();
  });
});

describe('ZoneEditor — manual keyboard-accessible zone entry', () => {
  it('adds a zone from the manual form without requiring canvas clicks', async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByRole('img');

    await user.click(screen.getByText('Ajouter une zone manuellement (clavier)'));
    await user.type(screen.getByLabelText('X'), '10');
    await user.type(screen.getByLabelText('Y'), '20');
    await user.type(screen.getByLabelText('Largeur'), '150');
    await user.type(screen.getByLabelText('Hauteur'), '40');
    await user.click(screen.getByRole('button', { name: 'Ajouter la zone' }));

    expect(await screen.findByText(/x:10 y:20 w:150 h:40/)).toBeInTheDocument();
  });
});

describe('ZoneEditor — saving zones', () => {
  it('disables the save button and shows a saving label while the request is in flight', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    renderEditor(onSaved);
    await screen.findByRole('img');

    await user.click(screen.getByText('Ajouter une zone manuellement (clavier)'));
    await user.type(screen.getByLabelText('X'), '10');
    await user.type(screen.getByLabelText('Y'), '20');
    await user.type(screen.getByLabelText('Largeur'), '150');
    await user.type(screen.getByLabelText('Hauteur'), '40');
    await user.click(screen.getByRole('button', { name: 'Ajouter la zone' }));

    const pending: { resolve: (() => void) | null } = { resolve: null };
    mockedApiFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          pending.resolve = () => resolve(undefined);
        }),
    );

    await user.click(screen.getByRole('button', { name: 'Enregistrer les zones' }));
    expect(await screen.findByRole('button', { name: 'Enregistrement…' })).toBeDisabled();

    pending.resolve?.();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mockedApiFetch).toHaveBeenCalledWith('/documents/doc-1/zones', {
      method: 'POST',
      json: { zones: [{ page: 1, x: 10, y: 20, width: 150, height: 40, required: true }] },
    });
  });
});
