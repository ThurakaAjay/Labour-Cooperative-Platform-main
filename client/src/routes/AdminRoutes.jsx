import React from 'react';
import { Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import AdminShell from '../apps/admin/AdminShell';
import AdminDashboard from '../apps/admin/pages/AdminDashboard';
import WorkerManagement from '../apps/admin/pages/WorkerManagement';
import AdminCustomers from '../apps/admin/pages/AdminCustomers';
import AdminServicesScreen from '../apps/admin/pages/AdminServicesScreen';
import AllBookings from '../apps/admin/pages/AllBookings';
import ComplaintsScreen from '../apps/admin/pages/ComplaintsScreen';
import DemandForecast from '../apps/admin/pages/DemandForecast';
import AdminMapScreen from '../apps/admin/pages/AdminMapScreen';
import CooperativeEconomics from '../apps/admin/pages/CooperativeEconomics';
import AdminSettings from '../apps/admin/pages/AdminSettings';

const wrapAdmin = (element, tab = 'dashboard') => (
  <ProtectedRoute requiredRole="admin">
    <AdminShell initialTab={tab}>{element}</AdminShell>
  </ProtectedRoute>
);

export const adminRoutes = [
  <Route key="a-dash" path="/admin/dashboard" element={wrapAdmin(<AdminDashboard />, 'dashboard')} />,
  <Route key="a-workers" path="/admin/workers" element={wrapAdmin(<WorkerManagement />, 'workers')} />,
  <Route key="a-customers" path="/admin/customers" element={wrapAdmin(<AdminCustomers />, 'customers')} />,
  <Route key="a-jobs" path="/admin/jobs" element={wrapAdmin(<WorkerManagement />, 'workers')} />,
  <Route key="a-services" path="/admin/services" element={wrapAdmin(<AdminServicesScreen />, 'services')} />,
  <Route key="a-bookings" path="/admin/bookings" element={wrapAdmin(<AllBookings />, 'bookings')} />,
  <Route key="a-complaints" path="/admin/complaints" element={wrapAdmin(<ComplaintsScreen />, 'complaints')} />,
  <Route key="a-reports" path="/admin/reports" element={wrapAdmin(<DemandForecast />, 'reports')} />,
  <Route key="a-forecast" path="/admin/forecast" element={wrapAdmin(<DemandForecast />, 'reports')} />,
  <Route key="a-map" path="/admin/map" element={wrapAdmin(<AdminMapScreen />, 'map')} />,
  <Route key="a-coop" path="/admin/cooperative" element={wrapAdmin(<CooperativeEconomics />, 'cooperative')} />,
  <Route key="a-settings" path="/admin/settings" element={wrapAdmin(<AdminSettings />, 'settings')} />,

  // Case-Insensitive & Alternate Admin Aliases
  <Route key="a-alias-dash" path="/Admin/dashboard" element={wrapAdmin(<AdminDashboard />, 'dashboard')} />,
  <Route key="a-alias-services" path="/Admin/services" element={wrapAdmin(<AdminServicesScreen />, 'services')} />,
  <Route key="a-alias-workers" path="/Admin/workers" element={wrapAdmin(<WorkerManagement />, 'workers')} />,
  <Route key="a-alias-bookings" path="/Admin/bookings" element={wrapAdmin(<AllBookings />, 'bookings')} />,
  <Route key="a-alias-map" path="/Admin/map" element={wrapAdmin(<AdminMapScreen />, 'map')} />,
  <Route key="a-alias-coop" path="/Admin/cooperative" element={wrapAdmin(<CooperativeEconomics />, 'cooperative')} />,
  <Route key="a-alias-forcas-1" path="/admin/forcas" element={wrapAdmin(<DemandForecast />, 'reports')} />,
  <Route key="a-alias-forcas-2" path="/Admin/forcas" element={wrapAdmin(<DemandForecast />, 'reports')} />,
  <Route key="a-alias-forecast-cap" path="/Admin/forecast" element={wrapAdmin(<DemandForecast />, 'reports')} />,
  <Route key="a-alias-complaints" path="/Admin/complaints" element={wrapAdmin(<ComplaintsScreen />, 'complaints')} />,
  <Route key="a-wildcard-1" path="/admin/*" element={<ProtectedRoute requiredRole="admin"><AdminShell /></ProtectedRoute>} />,
  <Route key="a-wildcard-2" path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminShell /></ProtectedRoute>} />,
  <Route key="a-wildcard-3" path="/Admin" element={<ProtectedRoute requiredRole="admin"><AdminShell /></ProtectedRoute>} />
];

export default adminRoutes;
