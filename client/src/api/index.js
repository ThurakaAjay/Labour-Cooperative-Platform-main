import apiClient from './apiClient';
import { authAPI } from './auth.api';
import { servicesAPI, bookingsAPI, paymentsAPI, geoAPI } from './customer.api';
import { workersAPI, cooperativeAPI, pollsAPI } from './worker.api';
import { adminAPI, complaintsAPI, healthAPI } from './admin.api';

export {
  apiClient,
  authAPI,
  servicesAPI,
  bookingsAPI,
  paymentsAPI,
  geoAPI,
  workersAPI,
  cooperativeAPI,
  pollsAPI,
  adminAPI,
  complaintsAPI,
  healthAPI
};

export default apiClient;
