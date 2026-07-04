import { BrowserRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import { AuthProvider } from './context/AuthContext.js';
import { AdminShell, RequireAuthGate } from './layout/AdminShell.js';
import { AuthLayout } from './layout/AuthLayout.js';
import { LoginPage } from './pages/LoginPage.js';
import { AdminNeighbourhoodsPage } from './pages/AdminNeighbourhoodsPage.js';
import { DslPage } from './pages/DslPage.js';
import { WalletAdminPage } from './pages/WalletAdminPage.js';
import { SsoPage } from './pages/SsoPage.js';
import { PluginsPage } from './pages/PluginsPage.js';
import { MfaPage } from './pages/MfaPage.js';
import { DocumentsAdminPage } from './pages/DocumentsAdminPage.js';
import { CategoriesAdminPage } from './pages/CategoriesAdminPage.js';
import { ListingsAdminPage } from './pages/ListingsAdminPage.js';
import { IncidentCategoriesAdminPage } from './pages/IncidentCategoriesAdminPage.js';

export function App(): ReactElement {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>
          <Route element={<AdminShell />}>
            <Route element={<RequireAuthGate />}>
              <Route path="/" element={<AdminNeighbourhoodsPage />} />
              <Route path="/dsl" element={<DslPage />} />
              <Route path="/wallet" element={<WalletAdminPage />} />
              <Route path="/sso" element={<SsoPage />} />
              <Route path="/plugins" element={<PluginsPage />} />
              <Route path="/mfa" element={<MfaPage />} />
              <Route path="/documents" element={<DocumentsAdminPage />} />
              <Route path="/categories" element={<CategoriesAdminPage />} />
              <Route path="/annonces" element={<ListingsAdminPage />} />
              <Route path="/incident-categories" element={<IncidentCategoriesAdminPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
