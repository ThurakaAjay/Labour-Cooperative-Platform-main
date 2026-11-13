import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import publicRoutes from './PublicRoutes';
import authRoutes from './AuthRoutes';
import customerRoutes from './CustomerRoutes';
import workerRoutes from './WorkerRoutes';
import adminRoutes from './AdminRoutes';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* 1. Public Routes */}
      {publicRoutes}

      {/* 2. Authentication & Onboarding Routes */}
      {authRoutes}

      {/* 3. Customer Role Routes */}
      {customerRoutes}

      {/* 4. Worker Role Routes */}
      {workerRoutes}

      {/* 5. Admin Role Routes */}
      {adminRoutes}

      {/* 6. Catch-all fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
