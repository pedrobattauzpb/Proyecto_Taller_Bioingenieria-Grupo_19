import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AlertsProvider } from './context/AlertsContext';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { HistoryPage } from './pages/HistoryPage';
import { InspectionPage } from './pages/InspectionPage';
import { ReportsPage } from './pages/ReportsPage';
import { AlertsPage } from './pages/AlertsPage';
import { NotificationSettingsPage } from './pages/NotificationSettingsPage';

export function App() {
  return (
    <ThemeProvider>
      <AlertsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="inspections" element={<HistoryPage />} />
              <Route path="inspections/:id" element={<InspectionPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="alerts" element={<AlertsPage />} />
              <Route path="settings/notifications" element={<NotificationSettingsPage />} />
              <Route path="notifications" element={<Navigate to="/settings/notifications" replace />} />
              <Route path="history" element={<Navigate to="/inspections" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AlertsProvider>
    </ThemeProvider>
  );
}

export default App;
