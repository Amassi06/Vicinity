import type { ReactElement } from 'react';
import { Outlet } from 'react-router-dom';
import { NeighbourhoodProvider } from '../context/NeighbourhoodContext.js';

export function NeighbourhoodOutlet(): ReactElement {
  return (
    <NeighbourhoodProvider>
      <Outlet />
    </NeighbourhoodProvider>
  );
}
