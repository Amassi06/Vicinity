import { BrowserRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import { AuthProvider } from './context/AuthContext.js';
import { AdminShell, RequireAuthGate } from './layout/AdminShell.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { AdminNeighbourhoodsPage } from './pages/AdminNeighbourhoodsPage.js';
import { DslPage } from './pages/DslPage.js';
import { WalletAdminPage } from './pages/WalletAdminPage.js';
import { SsoPage } from './pages/SsoPage.js';
import { PluginsPage } from './pages/PluginsPage.js';
import { MfaPage } from './pages/MfaPage.js';
import { DocumentsAdminPage } from './pages/DocumentsAdminPage.js';

export function App(): ReactElement {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AdminShell />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route element={<RequireAuthGate />}>
              <Route path="/" element={<AdminNeighbourhoodsPage />} />
              <Route path="/dsl" element={<DslPage />} />
              <Route path="/wallet" element={<WalletAdminPage />} />
              <Route path="/sso" element={<SsoPage />} />
              <Route path="/plugins" element={<PluginsPage />} />
              <Route path="/mfa" element={<MfaPage />} />
              <Route path="/documents" element={<DocumentsAdminPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
