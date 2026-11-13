import apiClient from './apiClient';

export const servicesAPI = {
  getAll: (params) => apiClient.get('/services', { params }).then(res => res.data),
  getById: (id) => apiClient.get(`/services/${id}`).then(res => res.data),
  create: (data) => apiClient.post('/services', data).then(res => res.data),
  update: (id, data) => apiClient.put(`/services/${id}`, data).then(res => res.data),
  delete: (id) => apiClient.delete(`/services/${id}`).then(res => res.data)
};

export const bookingsAPI = {
  getAll: (params) => apiClient.get('/bookings', { params }).then(res => res.data),
  getById: (id) => apiClient.get(`/bookings/${id}`).then(res => res.data),
  create: (data) => apiClient.post('/bookings', data).then(res => res.data),
  updateStatus: (id, data) => apiClient.put(`/bookings/${id}/status`, data).then(res => res.data),
  reject: (id, reason) => apiClient.put(`/bookings/${id}/reject`, { reason }).then(res => res.data),
  proposeReschedule: (id, { windowStart, windowEnd, reason }) =>
    apiClient.put(`/bookings/${id}/reschedule`, { windowStart, windowEnd, reason }).then(res => res.data),
  respondToReschedule: (id, action, selectedStart) =>
    apiClient.put(`/bookings/${id}/reschedule/respond`, { action, selectedStart }).then(res => res.data),
  verifyPin: (id, pin) => apiClient.post(`/bookings/${id}/verify-pin`, { pin }).then(res => res.data),
  cancel: (id, reason) => apiClient.patch(`/bookings/${id}/cancel`, { reason }).then(res => res.data),
  uploadPhoto: (id, file) => {
    const formData = new FormData();
    formData.append('photo', file);
    return apiClient
      .post(`/bookings/${id}/photos`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(res => res.data);
  },
  delete: (id) => apiClient.delete(`/bookings/${id}`).then(res => res.data)
};

export const paymentsAPI = {
  getConfig: () => apiClient.get('/payments/config').then(res => res.data),
  createOrder: (bookingId) => apiClient.post('/payments/create-order', { bookingId }).then(res => res.data),
  verify: (data) => apiClient.post('/payments/verify', data).then(res => res.data),
  getHistory: (params) => apiClient.get('/payments/history', { params }).then(res => res.data)
};

export const geoAPI = {
  geocode: (address) => apiClient.get('/geo/geocode', { params: { address } }).then(res => res.data)
};

export default {
  servicesAPI,
  bookingsAPI,
  paymentsAPI,
  geoAPI
};
