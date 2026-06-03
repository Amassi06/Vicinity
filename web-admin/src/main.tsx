import { createRoot } from 'react-dom/client';
import './styles.css';
import { initLeafletGeoman } from './leaflet-geoman-setup.js';

async function bootstrap(): Promise<void> {
  await initLeafletGeoman();
  await import('./leaflet-icons.js');

  const { App } = await import('./App.js');
  const el = document.getElementById('root');
  if (el === null) throw new Error('missing #root');
  createRoot(el).render(<App />);
}

void bootstrap();
