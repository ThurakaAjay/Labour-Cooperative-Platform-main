import React from 'react';
import { Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import WorkerShell from '../apps/worker/WorkerShell';
import WorkerDashboard from '../apps/worker/pages/WorkerDashboard';
import WorkerJobs from '../apps/worker/pages/WorkerJobs';
import WorkerEarnings from '../apps/worker/pages/WorkerEarnings';
import WorkerWelfare from '../apps/worker/pages/WorkerWelfare';
import SkillProfile from '../apps/worker/pages/SkillProfile';
import WorkerPublicProfile from '../components/WorkerPublicProfile';
import VerificationStatus from '../apps/worker/pages/VerificationStatus';
import JobRequestScreen from '../apps/worker/pages/JobRequestScreen';
import JobManagement from '../apps/worker/pages/JobManagement';
import WorkerCooperativeEconomics from '../apps/worker/pages/WorkerCooperativeEconomics';
import CooperativeVoting from '../apps/worker/pages/CooperativeVoting';

const wrapWorker = (element) => (
  <ProtectedRoute requiredRole="worker">
    <WorkerShell>{element}</WorkerShell>
  </ProtectedRoute>
);

export const workerRoutes = [
  // Canonical Worker Root Redirections
  <Route key="w-root" path="/worker" element={<Navigate to="/worker/dashboard" replace />} />,
  <Route key="w-root-workers" path="/workers" element={<Navigate to="/worker/dashboard" replace />} />,
  <Route key="w-root-cap" path="/Worker" element={<Navigate to="/worker/dashboard" replace />} />,
  <Route key="w-root-workers-cap" path="/Workers" element={<Navigate to="/worker/dashboard" replace />} />,
  <Route key="w-alias-home-1" path="/worker/home" element={<Navigate to="/worker/dashboard" replace />} />,
  <Route key="w-alias-home-2" path="/workers/home" element={<Navigate to="/worker/dashboard" replace />} />,

  // Worker Sub-Routes
  <Route key="w-dash" path="/worker/dashboard" element={wrapWorker(<WorkerDashboard />)} />,
  <Route key="w-jobs" path="/worker/jobs" element={wrapWorker(<WorkerJobs />)} />,
  <Route key="w-req-id" path="/worker/job-request/:jobId" element={wrapWorker(<JobRequestScreen />)} />,
  <Route key="w-req" path="/worker/job-request" element={wrapWorker(<JobRequestScreen />)} />,
  <Route key="w-mgmt-id" path="/worker/job-management/:jobId" element={wrapWorker(<JobManagement />)} />,
  <Route key="w-mgmt" path="/worker/job-management" element={wrapWorker(<JobManagement />)} />,
  <Route key="w-verif" path="/worker/verification" element={wrapWorker(<VerificationStatus />)} />,
  <Route key="w-earn" path="/worker/earnings" element={wrapWorker(<WorkerEarnings />)} />,
  <Route key="w-earn-alias" path="/worker/earningss" element={wrapWorker(<WorkerEarnings />)} />,
  <Route key="w-welfare" path="/worker/welfare" element={wrapWorker(<WorkerWelfare />)} />,
  <Route key="w-coop" path="/worker/cooperative" element={wrapWorker(<WorkerCooperativeEconomics />)} />,
  <Route key="w-voting" path="/worker/voting" element={wrapWorker(<CooperativeVoting />)} />,
  <Route key="w-profile" path="/worker/profile" element={wrapWorker(<SkillProfile />)} />,
  <Route key="w-profile-preview" path="/worker/profile/preview" element={wrapWorker(<WorkerPublicProfile />)} />,

  // Plural and Case-Insensitive Worker Aliases
  <Route key="w-alias-dash-1" path="/Worker/dashboard" element={wrapWorker(<WorkerDashboard />)} />,
  <Route key="w-alias-dash-2" path="/workers/dashboard" element={wrapWorker(<WorkerDashboard />)} />,
  <Route key="w-alias-dash-3" path="/Workers/dashboard" element={wrapWorker(<WorkerDashboard />)} />,
  <Route key="w-alias-jobs-1" path="/Worker/jobs" element={wrapWorker(<WorkerJobs />)} />,
  <Route key="w-alias-jobs-2" path="/workers/jobs" element={wrapWorker(<WorkerJobs />)} />,
  <Route key="w-alias-earn-1" path="/Worker/earnings" element={wrapWorker(<WorkerEarnings />)} />,
  <Route key="w-alias-earn-2" path="/workers/earnings" element={wrapWorker(<WorkerEarnings />)} />,
  <Route key="w-alias-welfare-1" path="/Worker/welfare" element={wrapWorker(<WorkerWelfare />)} />,
  <Route key="w-alias-welfare-2" path="/workers/welfare" element={wrapWorker(<WorkerWelfare />)} />,
  <Route key="w-alias-profile-1" path="/Worker/profile" element={wrapWorker(<SkillProfile />)} />,
  <Route key="w-alias-profile-2" path="/workers/profile" element={wrapWorker(<SkillProfile />)} />,
  <Route key="w-alias-voting-1" path="/Worker/voting" element={wrapWorker(<CooperativeVoting />)} />,
  <Route key="w-alias-voting-2" path="/workers/voting" element={wrapWorker(<CooperativeVoting />)} />,
  <Route key="w-alias-coop-1" path="/workers/cooperative" element={wrapWorker(<WorkerCooperativeEconomics />)} />,

  // Fallback Wildcards
  <Route key="w-wildcard-1" path="/worker/*" element={<Navigate to="/worker/dashboard" replace />} />,
  <Route key="w-wildcard-2" path="/workers/*" element={<Navigate to="/worker/dashboard" replace />} />
];

export default workerRoutes;
