import React from 'react';
import { Route } from 'react-router-dom';
import AuthPortal from '../pages/AuthPortal';
import RegisterPortal from '../pages/RegisterPortal';
import WorkerRegistrationFlow from '../apps/worker/pages/registration/WorkerRegistrationFlow';
import AdminLogin from '../apps/admin/pages/AdminLogin';

export const authRoutes = [
  // Universal Portal
  <Route key="login" path="/login" element={<AuthPortal />} />,
  <Route key="register" path="/register" element={<RegisterPortal />} />,
  <Route key="signup" path="/signup" element={<RegisterPortal />} />,

  // Customer Aliases
  <Route key="cust-login" path="/customer/login" element={<AuthPortal />} />,
  <Route key="cust-register" path="/customer/register" element={<RegisterPortal />} />,
  <Route key="cust-signup" path="/customer/signup" element={<RegisterPortal />} />,

  // Worker Aliases & Registration Flow
  <Route key="work-login" path="/worker/login" element={<AuthPortal />} />,
  <Route key="work-register" path="/worker/register" element={<WorkerRegistrationFlow />} />,
  <Route key="work-signup" path="/worker/signup" element={<WorkerRegistrationFlow />} />,
  <Route key="work-onboarding" path="/worker/onboarding" element={<WorkerRegistrationFlow />} />,

  // Admin Aliases
  <Route key="adm-login" path="/admin/login" element={<AdminLogin />} />,
  <Route key="adm-login-cap" path="/Admin/login" element={<AdminLogin />} />,
  <Route key="adm-signup" path="/admin/signup" element={<RegisterPortal />} />,
  <Route key="adm-register" path="/admin/register" element={<RegisterPortal />} />
];

export default authRoutes;
