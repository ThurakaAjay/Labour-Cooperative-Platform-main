import apiClient from './apiClient';

export const workersAPI = {
  getAll: (params) => apiClient.get('/workers', { params }).then(res => res.data),
  getById: (id) => apiClient.get(`/workers/${id}`).then(res => res.data),
  create: (data) => apiClient.post('/workers', data).then(res => res.data),
  update: (id, data) => apiClient.put(`/workers/${id}`, data).then(res => res.data),
  // Same partial merge-update as `update`, exposed under PATCH for callers
  // that only intend to touch a nested slice (e.g. nominee, payment method).
  patch: (id, data) => apiClient.patch(`/workers/${id}`, data).then(res => res.data),
  delete: (id) => apiClient.delete(`/workers/${id}`).then(res => res.data),
  // files: array of File objects (PDF/JPG/PNG). docType: 'id_proof' | 'certificate' | 'other'
  uploadDocuments: (id, files, docType = 'other') => {
    const formData = new FormData();
    files.forEach((file) => formData.append('documents', file));
    formData.append('docType', docType);
    return apiClient
      .post(`/workers/${id}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(res => res.data);
  },
  // decision: 'approve' | 'reject'; rejectionReason required when rejecting
  reviewVerification: (id, decision, rejectionReason) =>
    apiClient.put(`/workers/${id}/verify`, { decision, rejectionReason }).then(res => res.data),
  // Own welfare/insurance/payout snapshot (admins may pass a workerId)
  getWelfare: (workerId) => apiClient.get('/workers/welfare', { params: workerId ? { workerId } : {} }).then(res => res.data),
  getCooperative: () => apiClient.get('/workers/cooperative').then(res => res.data),
  // Admin: issue/update { healthInsurance, accidentCoverage } coverage terms
  issueInsurance: (id, data) => apiClient.put(`/workers/${id}/insurance`, data).then(res => res.data),
  // Admin: { amount, reason } — positive to credit, negative to debit
  adjustWelfareBalance: (id, amount, reason) => apiClient.put(`/workers/${id}/welfare-balance`, { amount, reason }).then(res => res.data),
  // Admin: verificationStatus: 'unverified' | 'pending' | 'verified'
  verifyPaymentDetails: (id, verificationStatus) => apiClient.put(`/workers/${id}/payment-verification`, { verificationStatus }).then(res => res.data)
};

export const cooperativeAPI = {
  getStats: () => apiClient.get('/cooperative/stats').then(res => res.data),
  getClaims: () => apiClient.get('/cooperative/claims').then(res => res.data),
  createClaim: (data) => apiClient.post('/cooperative/claims', data).then(res => res.data),
  // Admin: status: 'Pending Review' | 'Approved' | 'Disbursed' | 'Settled' | 'Rejected'
  updateClaimStatus: (id, status, resolutionNotes) =>
    apiClient.put(`/cooperative/claims/${id}`, { status, resolutionNotes }).then(res => res.data)
};

export const pollsAPI = {
  // includeAll (admin only): also returns drafts / closed / upcoming polls
  getAll: (includeAll = false) => apiClient.get('/polls', { params: includeAll ? { all: 'true' } : {} }).then(res => res.data),
  getById: (id) => apiClient.get(`/polls/${id}`).then(res => res.data),
  create: (data) => apiClient.post('/polls', data).then(res => res.data),
  update: (id, data) => apiClient.patch(`/polls/${id}`, data).then(res => res.data),
  // choice: 'yes' | 'no'
  vote: (id, choice) => apiClient.post(`/polls/${id}/vote`, { choice }).then(res => res.data)
};

export default {
  workersAPI,
  cooperativeAPI,
  pollsAPI
};
