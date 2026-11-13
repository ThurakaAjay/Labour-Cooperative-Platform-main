import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { CustomerProvider } from './apps/customer/context/CustomerContext';
import { WorkerProvider } from './apps/worker/context/WorkerContext';
import { ErrorBoundary } from './components';
import AppRoutes from './routes';

/**
 * WorkHive Unified Root Application
 * Hosts Global Providers & Root Router
 */
export function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <CustomerProvider>
            <WorkerProvider>
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <AppRoutes />
              </BrowserRouter>
            </WorkerProvider>
          </CustomerProvider>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
