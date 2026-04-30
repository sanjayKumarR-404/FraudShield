import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
// Assume Analytics & Recovery Cases pages exist. We will define them next.
import AnalyticsPage from './pages/AnalyticsPage';
import RecoveryCasesPage from './pages/RecoveryCasesPage';
import Sidebar from './components/Sidebar';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('fraudshield_token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const MobileTab = ({ to, label }: { to: string, label: string }) => {
  return (
    <NavLink to={to} className={({ isActive }) => `flex flex-col items-center p-2 rounded-lg transition-colors flex-1 ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </NavLink>
  );
};

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex bg-[var(--color-bg-primary)] h-screen overflow-hidden w-full">
      <Sidebar expanded={expanded} setExpanded={setExpanded} />
      <div className="flex-1 flex flex-col h-screen overflow-y-auto custom-scrollbar relative px-0 pb-16 md:pb-0">
        {children}
      </div>

      {/* Mobile Bottom Tab Navigation */}
      <div className="md:hidden fixed bottom-0 w-full bg-[var(--color-bg-card)] border-t border-[var(--color-border)] z-50 flex justify-around p-1 pb-safe backdrop-blur-md bg-opacity-95 items-center">
        <MobileTab to="/dashboard" label="Dashboard" />
        <MobileTab to="/analytics" label="Analytics" />
        <MobileTab to="/recovery" label="Disputes" />
      </div>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Core Layout Map */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout><DashboardPage /></DashboardLayout></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><DashboardLayout><AnalyticsPage /></DashboardLayout></ProtectedRoute>} />
        <Route path="/recovery" element={<ProtectedRoute><DashboardLayout><RecoveryCasesPage /></DashboardLayout></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;