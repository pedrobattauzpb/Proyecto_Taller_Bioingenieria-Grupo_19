import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AlertsProvider } from './context/AlertsContext';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

import { LoginPage } from './pages/LoginPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { ProfilePage } from './pages/ProfilePage';
import { ForbiddenPage } from './pages/ForbiddenPage';
import { DashboardPage } from './pages/DashboardPage';
import { HistoryPage } from './pages/HistoryPage';
import { InspectionPage } from './pages/InspectionPage';
import { ReportsPage } from './pages/ReportsPage';
import { AlertsPage } from './pages/AlertsPage';
import { NotificationSettingsPage } from './pages/NotificationSettingsPage';
import { UsersAdminPage } from './pages/admin/UsersAdminPage';

// Monta AlertsProvider solo con sesión activa para evitar llamadas SSE anónimas (401)
const AuthenticatedAppLayout: React.FC = () => {
  const { status } = useAuth();

  if (status !== 'authenticated') {
    return <ProtectedRoute />;
  }

  return (
    <AlertsProvider>
      <ProtectedRoute />
    </AlertsProvider>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Ruta pública de acceso */}
            <Route path="/login" element={<LoginPage />} />

            {/* Rutas con autenticación obligatoria y control de acceso RBAC */}
            <Route element={<AuthenticatedAppLayout />}>
              <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="inspections" element={<HistoryPage />} />
                <Route path="inspections/:id" element={<InspectionPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="alerts" element={<AlertsPage />} />

                {/* Rutas con permisos específicos */}
                <Route
                  path="settings/notifications"
                  element={
                    <ProtectedRoute requiredPermission="notifications:manage">
                      <NotificationSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/users"
                  element={
                    <ProtectedRoute requiredPermission="users:read">
                      <UsersAdminPage />
                    </ProtectedRoute>
                  }
                />

                {/* Perfil, contraseña y acceso denegado */}
                <Route path="profile" element={<ProfilePage />} />
                <Route path="change-password" element={<ChangePasswordPage />} />
                <Route path="forbidden" element={<ForbiddenPage />} />

                {/* Redirecciones de conveniencia y comodín */}
                <Route path="notifications" element={<Navigate to="/settings/notifications" replace />} />
                <Route path="history" element={<Navigate to="/inspections" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
