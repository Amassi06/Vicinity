import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useNeighbourhoods } from '../context/NeighbourhoodContext.js';
import { NeighbourhoodSelect } from '../components/NeighbourhoodSelect.js';

export function HomePage(): ReactElement {
  const { selected } = useNeighbourhoods();

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Vicinity</h1>
      <p>Plateforme de quartier : cartographie, événements, annonces, sondages et messagerie.</p>
      <NeighbourhoodSelect />
      {selected ? (
        <p className="muted">
          Quartier actif : <strong>{selected.name}</strong>
        </p>
      ) : (
        <p className="muted">Choisissez un quartier pour utiliser les modules métier.</p>
      )}
      <nav className="tile-grid">
        <Link className="tile" to="/quartiers">
          Carte des quartiers
        </Link>
        <Link className="tile" to="/evenements">
          Événements
        </Link>
        <Link className="tile" to="/annonces">
          Annonces
        </Link>
        <Link className="tile" to="/sondages">
          Sondages
        </Link>
        <Link className="tile" to="/messages">
          Messages
        </Link>
        <Link className="tile" to="/portefeuille">
          Portefeuille
        </Link>
      </nav>
    </section>
  );
}
