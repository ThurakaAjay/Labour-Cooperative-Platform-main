import React from 'react';
import { Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import CustomerShell from '../apps/customer/CustomerShell';
import CustomerHome from '../apps/customer/pages/CustomerHome';
import ServiceSearch from '../apps/customer/pages/ServiceSearch';
import SmartMatchResults from '../apps/customer/pages/SmartMatchResults';
import WorkerPublicProfile from '../components/WorkerPublicProfile';
import BookingFlow from '../apps/customer/pages/BookingFlow';
import BookingTracking from '../apps/customer/pages/BookingTracking';
import EmergencyService from '../apps/customer/pages/EmergencyService';
import MyBookings from '../apps/customer/pages/MyBookings';
import CustomerPayments from '../apps/customer/pages/CustomerPayments';
import PaymentCheckout from '../apps/customer/pages/PaymentCheckout';
import RatingFeedback from '../apps/customer/pages/RatingFeedback';
import CustomerProfile from '../apps/customer/pages/CustomerProfile';

const wrapCustomer = (element) => (
  <ProtectedRoute requiredRole="customer">
    <CustomerShell>{element}</CustomerShell>
  </ProtectedRoute>
);

export const customerRoutes = [
  <Route
    key="c-root"
    path="/customer"
    element={<Navigate to="/customer/home" replace />}
  />,
  <Route
    key="c-onboarding"
    path="/customer/onboarding"
    element={<Navigate to="/customer/home" replace />}
  />,
  <Route key="c-home" path="/customer/home" element={wrapCustomer(<CustomerHome />)} />,
  <Route key="c-search" path="/customer/search" element={wrapCustomer(<ServiceSearch />)} />,
  <Route key="c-matching" path="/customer/matching" element={wrapCustomer(<SmartMatchResults />)} />,
  <Route key="c-smart-match" path="/customer/smart-match" element={wrapCustomer(<SmartMatchResults />)} />,
  <Route key="c-worker-view" path="/customer/worker/:workerId" element={wrapCustomer(<WorkerPublicProfile />)} />,
  <Route key="c-book-id" path="/customer/book/:workerId" element={wrapCustomer(<BookingFlow />)} />,
  <Route key="c-booking" path="/customer/booking" element={wrapCustomer(<BookingFlow />)} />,
  <Route key="c-track-id" path="/customer/tracking/:bookingId" element={wrapCustomer(<BookingTracking />)} />,
  <Route key="c-track-id-alt" path="/customer/track/:bookingId" element={wrapCustomer(<BookingTracking />)} />,
  <Route key="c-track" path="/customer/tracking" element={wrapCustomer(<BookingTracking />)} />,
  <Route key="c-track-alt" path="/customer/track" element={wrapCustomer(<BookingTracking />)} />,
  <Route key="c-checkout-id" path="/customer/payment-checkout/:bookingId" element={wrapCustomer(<PaymentCheckout />)} />,
  <Route key="c-checkout" path="/customer/payment-checkout" element={wrapCustomer(<PaymentCheckout />)} />,
  <Route key="c-rating-id" path="/customer/rating/:bookingId" element={wrapCustomer(<RatingFeedback />)} />,
  <Route key="c-rating" path="/customer/rating" element={wrapCustomer(<RatingFeedback />)} />,
  <Route key="c-emergency" path="/customer/emergency" element={wrapCustomer(<EmergencyService />)} />,
  <Route key="c-bookings" path="/customer/bookings" element={wrapCustomer(<MyBookings />)} />,
  <Route key="c-payments" path="/customer/payments" element={wrapCustomer(<CustomerPayments />)} />,
  <Route key="c-profile" path="/customer/profile" element={wrapCustomer(<CustomerProfile />)} />,

  // Case-Insensitive & Common Aliases
  <Route key="c-alias-home-1" path="/Customer/home" element={wrapCustomer(<CustomerHome />)} />,
  <Route key="c-alias-home-2" path="/Cutomer/home" element={wrapCustomer(<CustomerHome />)} />,
  <Route key="c-alias-bookings" path="/Customer/bookings" element={wrapCustomer(<MyBookings />)} />,
  <Route key="c-alias-payments" path="/Customer/payments" element={wrapCustomer(<CustomerPayments />)} />,
  <Route key="c-alias-profile" path="/Customer/profile" element={wrapCustomer(<CustomerProfile />)} />,
  <Route key="c-alias-emergency-1" path="/Customer/emergency" element={wrapCustomer(<EmergencyService />)} />,
  <Route key="c-alias-emergency-2" path="/emergency" element={wrapCustomer(<EmergencyService />)} />,
  <Route key="c-wildcard" path="/customer/*" element={<ProtectedRoute requiredRole="customer"><CustomerShell /></ProtectedRoute>} />
];

export default customerRoutes;
