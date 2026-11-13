import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Protected Route Guard with Role Validation and 7-Day Session Expiration Check
 */
export const ProtectedRoute = ({ children, requiredRole = 'customer' }) => {
  const { isSessionValid, getRoleSession, activeRole, switchRole } = useAuth();
  const location = useLocation();

  const hasValidSession = isSessionValid(requiredRole);

  // Keep the active session in sync with the role actually being viewed, so a
  // user holding two simultaneous role sessions can't end up on e.g. /worker/*
  // while currentUser still resolves to their customer session.
  useEffect(() => {
    if (hasValidSession && activeRole !== requiredRole) {
      switchRole(requiredRole);
    }
  }, [hasValidSession, activeRole, requiredRole, switchRole]);

  if (!hasValidSession) {
    // Check if user had an expired session to show custom notification
    const rawSession = getRoleSession(requiredRole, false);
    const isExpired = rawSession && rawSession.expiresAt && Date.now() > rawSession.expiresAt;
    const targetPath = encodeURIComponent(location.pathname + location.search);

    return (
      <Navigate
        to={`/login?role=${requiredRole}&redirect=${targetPath}${isExpired ? '&expired=true' : ''}`}
        replace
      />
    );
  }

  return children;
};

export default ProtectedRoute;
