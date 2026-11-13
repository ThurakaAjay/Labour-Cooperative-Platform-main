import apiClient from './apiClient';

export const adminAPI = {
  getStats: () => apiClient.get('/admin/stats').then(res => res.data),
  getCustomers: () => apiClient.get('/admin/customers').then(res => res.data),
  getWorkers: () => apiClient.get('/admin/workers').then(res => res.data),
  // status: 'Active' | 'Suspended'
  updateUserStatus: (userId, status) => apiClient.put(`/admin/users/${userId}/status`, { status }).then(res => res.data),
  resetDemo: () => apiClient.post('/admin/reset-demo').then(res => res.data)
};

export const complaintsAPI = {
  getAll: (params) => apiClient.get('/complaints', { params }).then(res => res.data),
  create: (data) => apiClient.post('/complaints', data).then(res => res.data),
  update: (id, data) => apiClient.put(`/complaints/${id}`, data).then(res => res.data),
  // file: a single File object (image). One request per photo, same as bookingsAPI.uploadPhoto.
  uploadPhoto: (id, file) => {
    const formData = new FormData();
    formData.append('photo', file);
    return apiClient
      .post(`/complaints/${id}/photos`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(res => res.data);
  }
};

export const healthAPI = {
  check: () => apiClient.get('/health').then(res => res.data)
};

export default {
  adminAPI,
  complaintsAPI,
  healthAPI
};
