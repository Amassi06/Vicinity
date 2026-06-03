import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import 'leaflet/dist/leaflet.css';
import './leaflet-icons.js';
import { App } from './App.js';

const el = document.getElementById('root');
if (el === null) throw new Error('missing #root');

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
