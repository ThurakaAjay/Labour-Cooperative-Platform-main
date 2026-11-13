import apiClient from './apiClient';

export const authAPI = {
  login: (credentials) => apiClient.post('/auth/login', credentials).then(res => res.data),
  register: (userData) => apiClient.post('/auth/register', userData).then(res => res.data),
  sendOtp: (phone) => apiClient.post('/auth/send-otp', { phone }).then(res => res.data),
  verifyOtp: (payload) => apiClient.post('/auth/verify-otp', payload).then(res => res.data),
  getMe: (params) => apiClient.get('/auth/me', { params }).then(res => res.data),
  updateProfile: (data) => apiClient.put('/auth/profile', data).then(res => res.data)
};

export default authAPI;
