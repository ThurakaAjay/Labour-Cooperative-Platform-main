import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  CheckCircle2,
  Clock,
  Ban,
  Eye,
  FileText,
  AlertTriangle,
  X,
  Check,
  ExternalLink,
  ShieldAlert,
  RotateCcw,
  Loader2,
  HeartPulse,
  ShieldCheck,
  Wallet,
  BadgeCheck
} from 'lucide-react';
import { Button, Card, Badge, EmptyState } from '../../../components';
import { adminAPI, workersAPI } from '../../../api';

const VERIFICATION_LABEL = {
  unsubmitted: { text: 'No Documents Yet', variant: 'neutral' },
  pending: { text: 'Awaiting Admin Review', variant: 'active' },
  verified: { text: 'Verified', variant: 'success' },
  rejected: { text: 'Rejected', variant: 'danger' }
};

export const WorkerManagement = () => {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'pending' | 'verified' | 'rejected' | 'unsubmitted' | 'Suspended'

  const [selectedWorker, setSelectedWorker] = useState(null);
  const [suspendingWorker, setSuspendingWorker] = useState(null);
  const [rejectingWorker, setRejectingWorker] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminAPI.getWorkers();
      if (res.success && Array.isArray(res.data)) {
        const mapped = res.data.map(w => ({
          id: w.workerId || w._id,
          workerId: w.workerId || w._id,
          name: w.name,
          phone: w.phone,
          coopId: w.societyReg || '',
          skill: w.skill,
          subSkills: w.skills || [w.skill],
          status: w.status || 'Pending',
          verificationStatus: w.verificationStatus || 'unsubmitted',
          rejectionReason: w.rejectionReason || '',
          rating: w.rating || 0,
          jobsCompleted: w.completedJobs || 0,
          totalBookings: w.totalBookings || 0,
          completedBookings: w.completedBookings || 0,
          experience: w.experience || '',
          zone: w.locality || '',
          avatar: w.avatar || 'WK',
          documents: w.documents || [],
          paymentDetails: w.paymentDetails || { payoutType: 'upi', upiId: '', bankAccount: {}, verificationStatus: 'unverified' },
          welfareFundBalance: w.welfareFundBalance || 0,
          healthInsurance: w.healthInsurance || { active: false, policyNumber: '', coverageAmount: 500000, provider: '' },
          accidentCoverage: w.accidentCoverage || { active: false, policyNumber: '', coverageAmount: 500000, provider: '', nominee: {} }
        }));
        setWorkers(mapped);
      }
    } catch (err) {
      console.error('Error loading workers from MongoDB:', err);
      setError('Unable to load worker records from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredWorkers = workers.filter((w) => {
    const matchesFilter =
      statusFilter === 'All' ||
      (statusFilter === 'Suspended' ? w.status === 'Suspended' : w.verificationStatus === statusFilter);
    const matchesSearch =
      w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.skill.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.phone.includes(searchTerm);
    return matchesFilter && matchesSearch;
  });

  const applyWorkerPatch = (id, patch) => {
    setWorkers((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
    if (selectedWorker?.id === id) {
      setSelectedWorker((prev) => ({ ...prev, ...patch }));
    }
  };

  // Action: Approve verification documents
  const handleApprove = async (workerId, name) => {
    setActionLoading(true);
    try {
      const res = await workersAPI.reviewVerification(workerId, 'approve');
      applyWorkerPatch(workerId, {
        status: res.data.status,
        verificationStatus: res.data.verificationStatus,
        rejectionReason: ''
      });
      showToast(`✓ ${name} verified & approved!`);
    } catch (err) {
      showToast(`⚠️ ${err.response?.data?.message || `Failed to approve ${name}`}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Reject verification documents (with reason)
  const handleConfirmReject = async () => {
    if (!rejectingWorker || !rejectionReason.trim()) return;
    setActionLoading(true);
    try {
      const res = await workersAPI.reviewVerification(rejectingWorker.id, 'reject', rejectionReason.trim());
      applyWorkerPatch(rejectingWorker.id, {
        status: res.data.status,
        verificationStatus: res.data.verificationStatus,
        rejectionReason: res.data.rejectionReason
      });
      showToast(`⚠️ ${rejectingWorker.name}'s documents were rejected.`);
      setRejectingWorker(null);
      setRejectionReason('');
    } catch (err) {
      showToast(`⚠️ ${err.response?.data?.message || 'Failed to reject documents'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Suspend / Reactivate (RBAC status toggle). This endpoint returns
  // the updated User document, not the Worker document — the real,
  // server-decided Worker.status (which depends on verificationStatus) is
  // re-fetched rather than guessed at client-side.
  const handleConfirmSuspend = async () => {
    if (!suspendingWorker) return;
    setActionLoading(true);
    try {
      await adminAPI.updateUserStatus(suspendingWorker.id, 'Suspended');
      await fetchWorkers();
      setSelectedWorker(null);
      showToast(`⚠️ ${suspendingWorker.name} suspended. Job allocations paused.`);
      setSuspendingWorker(null);
    } catch (err) {
      showToast(`⚠️ ${err.response?.data?.message || 'Failed to suspend worker'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async (workerId, name) => {
    setActionLoading(true);
    try {
      await adminAPI.updateUserStatus(workerId, 'Active');
      await fetchWorkers();
      setSelectedWorker(null);
      showToast(`✓ ${name} reactivated.`);
    } catch (err) {
      showToast(`⚠️ ${err.response?.data?.message || `Failed to reactivate ${name}`}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Issue (or update, if already active) health/accident cooperative
  // insurance. Coverage amount defaults to ₹5,00,000 per the society's
  // standard policy; toggling an already-active block off revokes it instead.
  const handleToggleInsurance = async (worker, kind) => {
    const current = worker[kind === 'health' ? 'healthInsurance' : 'accidentCoverage'];
    setActionLoading(true);
    try {
      const payload = kind === 'health'
        ? { healthInsurance: { active: !current.active, coverageAmount: current.coverageAmount || 500000, provider: current.provider || 'Chennai Coop Health Network' } }
        : { accidentCoverage: { active: !current.active, coverageAmount: current.coverageAmount || 500000, provider: current.provider || 'Chennai Coop Health Network' } };
      const res = await workersAPI.issueInsurance(worker.id, payload);
      applyWorkerPatch(worker.id, { healthInsurance: res.data.healthInsurance, accidentCoverage: res.data.accidentCoverage });
      showToast(current.active ? `${kind === 'health' ? 'Health' : 'Accident'} coverage revoked for ${worker.name}.` : `${kind === 'health' ? 'Health' : 'Accident'} coverage issued to ${worker.name}.`);
    } catch (err) {
      showToast(`⚠️ ${err.response?.data?.message || 'Failed to update insurance coverage'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Mark a worker's declared UPI/bank payout details verified — this
  // is what unlocks the "Instant Auto-Credit" badge on the worker's own
  // Earnings page. Toggling back to unverified is available in case a
  // payout detail turns out to be wrong after the fact.
  const handleTogglePaymentVerification = async (worker) => {
    const next = worker.paymentDetails.verificationStatus === 'verified' ? 'unverified' : 'verified';
    setActionLoading(true);
    try {
      const res = await workersAPI.verifyPaymentDetails(worker.id, next);
      applyWorkerPatch(worker.id, { paymentDetails: res.data.paymentDetails });
      showToast(next === 'verified' ? `✓ ${worker.name}'s payout details verified.` : `${worker.name}'s payout details marked unverified.`);
    } catch (err) {
      showToast(`⚠️ ${err.response?.data?.message || 'Failed to update payment verification'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Manual welfare fund balance correction (credit/debit)
  const [balanceAdjustWorker, setBalanceAdjustWorker] = useState(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceReason, setBalanceReason] = useState('');

  const handleConfirmAdjustBalance = async () => {
    const amount = Number(balanceAmount);
    if (!amount) return;
    setActionLoading(true);
    try {
      const res = await workersAPI.adjustWelfareBalance(balanceAdjustWorker.id, amount, balanceReason);
      applyWorkerPatch(balanceAdjustWorker.id, { welfareFundBalance: res.data.welfareFundBalance });
      showToast(`✓ ${balanceAdjustWorker.name}'s welfare balance ${amount > 0 ? 'credited' : 'debited'} by ₹${Math.abs(amount).toLocaleString()}.`);
      setBalanceAdjustWorker(null);
      setBalanceAmount('');
      setBalanceReason('');
    } catch (err) {
      showToast(`⚠️ ${err.response?.data?.message || 'Failed to adjust welfare balance'}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingBottom: 'var(--space-xl)' }}>

      {/* 1. TOP HEADER & TOAST NOTIFICATION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: '0 0 2px' }}>
            Worker Roster & Accreditation
          </h1>
          <p className="text-secondary" style={{ fontSize: '13px', margin: 0 }}>
            Review submitted documents and manage cooperative worker verification & standing
          </p>
        </div>

        <Badge variant="active" style={{ fontSize: '12px' }}>
          {workers.length} Total Registered Workers
        </Badge>
      </div>

      {toastMessage && (
        <div style={{
          background: 'var(--color-black)',
          color: 'white',
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px',
          fontWeight: 'bold',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <span>{toastMessage}</span>
          <button type="button" onClick={() => setToastMessage(null)} style={{ color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
      )}

      {/* 2. SEARCH BAR & FILTER CHIPS */}
      <Card padding="md">
        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
            <input
              type="text"
              className="ss-input"
              style={{ paddingLeft: '38px', height: '42px', fontSize: '13px' }}
              placeholder="Search by worker name, trade skill, or phone number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={16} color="var(--color-text-secondary)" style={{ position: 'absolute', left: 12, top: 13 }} />
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'All', label: `All (${workers.length})` },
              { id: 'pending', label: `Awaiting Review (${workers.filter((w) => w.verificationStatus === 'pending').length})` },
              { id: 'verified', label: `Verified (${workers.filter((w) => w.verificationStatus === 'verified').length})` },
              { id: 'rejected', label: `Rejected (${workers.filter((w) => w.verificationStatus === 'rejected').length})` },
              { id: 'Suspended', label: `Suspended (${workers.filter((w) => w.status === 'Suspended').length})` }
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setStatusFilter(chip.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-full)',
                  background: statusFilter === chip.id ? 'var(--color-black)' : 'var(--color-bg)',
                  color: statusFilter === chip.id ? 'white' : 'var(--color-black)',
                  border: `1px solid ${statusFilter === chip.id ? 'var(--color-black)' : 'var(--color-border)'}`,
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* 3. WORKERS DATA TABLE */}
      {loading ? (
        <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
          <Loader2 size={24} className="ss-spinner" style={{ animation: 'spin 1s linear infinite' }} />
          <p className="text-secondary" style={{ fontSize: '13px', marginTop: 8 }}>Loading worker roster from MongoDB...</p>
        </div>
      ) : filteredWorkers.length === 0 ? (
        <Card padding="lg" style={{ textAlign: 'center' }}>
          <EmptyState
            icon={Users}
            title={workers.length === 0 ? 'No Registered Workers in Database' : 'No Workers Match Your Filter'}
            description={workers.length === 0
              ? 'When trade professionals register through the Worker Portal, their verification dossiers will appear here for administrative accreditation.'
              : 'Try adjusting your search terms or filter selection to view matching cooperative workers.'}
          />
        </Card>
      ) : (
        <Card padding="none" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg)', borderBottom: '1.5px solid var(--color-border)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>Worker</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>Trade Skill</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>Verification</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>Bookings</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkers.map((w, index) => (
                  <tr key={w.id} style={{ borderBottom: '1px solid var(--color-border)', background: index % 2 === 0 ? 'white' : '#FCFCFC' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--color-black)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold' }}>
                          {w.avatar}
                        </div>
                        <div>
                          <div style={{ fontWeight: 'bold', color: 'var(--color-black)' }}>{w.name}</div>
                          <div className="text-secondary" style={{ fontSize: '11px' }}>{w.phone} • {w.zone}</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', fontWeight: 600, fontSize: '12px' }}>
                        {w.skill}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                        <Badge variant={w.status === 'Suspended' ? 'danger' : VERIFICATION_LABEL[w.verificationStatus].variant}>
                          {w.status === 'Suspended' ? '⛔ Suspended' : VERIFICATION_LABEL[w.verificationStatus].text}
                        </Badge>
                        {w.documents.length > 0 && (
                          <span className="text-secondary" style={{ fontSize: '11px' }}>{w.documents.length} document{w.documents.length === 1 ? '' : 's'} submitted</span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                      {w.completedBookings} / {w.totalBookings}
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                        {w.verificationStatus === 'pending' && w.status !== 'Suspended' && (
                          <>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleApprove(w.id, w.name)}
                              style={{ padding: '4px 10px', borderRadius: '4px', background: 'var(--color-success)', color: 'white', border: 'none', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                              Approve ✓
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => { setRejectingWorker(w); setRejectionReason(''); }}
                              style={{ padding: '4px 10px', borderRadius: '4px', background: 'var(--color-bg)', color: 'var(--color-danger)', border: '1px solid var(--color-border)', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {w.status === 'Verified' && (
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => setSuspendingWorker(w)}
                            style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--color-bg)', color: 'var(--color-danger)', border: '1px solid var(--color-border)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Suspend
                          </button>
                        )}

                        {w.status === 'Suspended' && (
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleReactivate(w.id, w.name)}
                            style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--color-black)', color: 'white', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Reactivate
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedWorker(w)}
                          style={{ padding: '4px 10px', borderRadius: '4px', background: 'var(--color-bg)', color: 'var(--color-black)', border: '1px solid var(--color-border)', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                        >
                          <Eye size={12} />
                          <span>View Profile</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 4. "VIEW PROFILE" ADMIN SIDE PANEL / MODAL */}
      {selectedWorker && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: 'var(--color-white)', width: '100%', maxWidth: '520px', height: '100vh', overflowY: 'auto', padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', boxShadow: 'var(--shadow-xl)' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', background: 'var(--color-black)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 'bold' }}>
                  {selectedWorker.avatar}
                </div>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>{selectedWorker.name}</h2>
                  <div className="text-secondary" style={{ fontSize: '12px' }}>{selectedWorker.phone}</div>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedWorker(null)} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--color-border)', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <Card padding="sm" style={{ background: 'var(--color-bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className="text-secondary" style={{ fontSize: '11px' }}>VERIFICATION STATUS</span>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    {selectedWorker.status === 'Suspended' ? '🔴 Suspended by Committee' : VERIFICATION_LABEL[selectedWorker.verificationStatus].text}
                  </div>
                  {selectedWorker.verificationStatus === 'rejected' && selectedWorker.rejectionReason && (
                    <div style={{ fontSize: '12px', color: 'var(--color-danger)', marginTop: 4 }}>
                      Reason: {selectedWorker.rejectionReason}
                    </div>
                  )}
                </div>
                <Badge variant={selectedWorker.status === 'Suspended' ? 'danger' : VERIFICATION_LABEL[selectedWorker.verificationStatus].variant}>
                  {selectedWorker.status === 'Suspended' ? 'Suspended' : selectedWorker.verificationStatus}
                </Badge>
              </div>
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-xs)', fontSize: '13px' }}>
              <div style={{ background: 'var(--color-bg)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                <span className="text-secondary" style={{ fontSize: '11px' }}>PRIMARY SKILL</span>
                <div style={{ fontWeight: 'bold' }}>{selectedWorker.skill}</div>
              </div>
              <div style={{ background: 'var(--color-bg)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                <span className="text-secondary" style={{ fontSize: '11px' }}>EXPERIENCE</span>
                <div style={{ fontWeight: 'bold' }}>{selectedWorker.experience || '—'}</div>
              </div>
              <div style={{ background: 'var(--color-bg)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                <span className="text-secondary" style={{ fontSize: '11px' }}>COMPLETED / TOTAL BOOKINGS</span>
                <div style={{ fontWeight: 'bold' }}>{selectedWorker.completedBookings} / {selectedWorker.totalBookings}</div>
              </div>
              <div style={{ background: 'var(--color-bg)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                <span className="text-secondary" style={{ fontSize: '11px' }}>MEMBER RATING</span>
                <div style={{ fontWeight: 'bold', color: 'var(--color-accent)' }}>{selectedWorker.rating ? `${selectedWorker.rating} ⭐` : 'No ratings yet'}</div>
              </div>
            </div>

            {/* SUBMITTED VERIFICATION DOCUMENTS — real Cloudinary links */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>
                Submitted Verification Documents ({selectedWorker.documents.length})
              </h3>
              {selectedWorker.documents.length === 0 ? (
                <div style={{ background: 'var(--color-bg)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  No documents submitted yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedWorker.documents.map((doc, idx) => (
                    <a
                      key={doc.publicId || idx}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg)', textDecoration: 'none', color: 'var(--color-black)' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px' }}>
                        <FileText size={16} color="var(--color-black)" />
                        <div>
                          <div style={{ fontWeight: 600 }}>{doc.name}</div>
                          <div className="text-secondary" style={{ fontSize: '11px', textTransform: 'capitalize' }}>{doc.docType?.replace('_', ' ') || 'document'} • {doc.format}</div>
                        </div>
                      </div>
                      <ExternalLink size={14} color="var(--color-text-secondary)" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* COOPERATIVE WELFARE, INSURANCE & PAYMENT CONTROLS */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>
                Welfare Fund, Insurance & Payout
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

                <div style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="text-secondary" style={{ fontSize: '11px' }}>WELFARE FUND BALANCE</span>
                    <div style={{ fontWeight: 'bold', fontSize: '15px' }}>₹{selectedWorker.welfareFundBalance.toLocaleString()}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setBalanceAdjustWorker(selectedWorker); setBalanceAmount(''); setBalanceReason(''); }}
                    style={{ padding: '5px 10px', borderRadius: '4px', background: 'var(--color-black)', color: 'white', border: 'none', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Adjust Balance
                  </button>
                </div>

                <div style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <HeartPulse size={16} color={selectedWorker.healthInsurance.active ? 'var(--color-success)' : 'var(--color-text-secondary)'} />
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '13px' }}>Health Insurance</div>
                      <div className="text-secondary" style={{ fontSize: '11px' }}>
                        {selectedWorker.healthInsurance.active ? `Active • ₹${selectedWorker.healthInsurance.coverageAmount.toLocaleString()}` : 'Not issued'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleToggleInsurance(selectedWorker, 'health')}
                    style={{ padding: '5px 10px', borderRadius: '4px', background: selectedWorker.healthInsurance.active ? 'var(--color-bg)' : 'var(--color-success)', color: selectedWorker.healthInsurance.active ? 'var(--color-danger)' : 'white', border: selectedWorker.healthInsurance.active ? '1px solid var(--color-border)' : 'none', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    {selectedWorker.healthInsurance.active ? 'Revoke' : 'Issue ₹5L Cover'}
                  </button>
                </div>

                <div style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={16} color={selectedWorker.accidentCoverage.active ? 'var(--color-success)' : 'var(--color-text-secondary)'} />
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '13px' }}>Accident Coverage</div>
                      <div className="text-secondary" style={{ fontSize: '11px' }}>
                        {selectedWorker.accidentCoverage.active ? `Active • ₹${selectedWorker.accidentCoverage.coverageAmount.toLocaleString()}` : 'Not issued'}
                        {selectedWorker.accidentCoverage.nominee?.name && ` • Nominee: ${selectedWorker.accidentCoverage.nominee.name}`}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleToggleInsurance(selectedWorker, 'accident')}
                    style={{ padding: '5px 10px', borderRadius: '4px', background: selectedWorker.accidentCoverage.active ? 'var(--color-bg)' : 'var(--color-success)', color: selectedWorker.accidentCoverage.active ? 'var(--color-danger)' : 'white', border: selectedWorker.accidentCoverage.active ? '1px solid var(--color-border)' : 'none', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    {selectedWorker.accidentCoverage.active ? 'Revoke' : 'Issue ₹5L Cover'}
                  </button>
                </div>

                <div style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Wallet size={16} color="var(--color-black)" />
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '13px' }}>
                        {selectedWorker.paymentDetails.payoutType === 'bank' ? 'Bank Payout' : 'UPI Payout'}
                      </div>
                      <div className="text-secondary" style={{ fontSize: '11px' }}>
                        {selectedWorker.paymentDetails.payoutType === 'bank'
                          ? (selectedWorker.paymentDetails.bankAccount?.accountNumber || 'Not added yet')
                          : (selectedWorker.paymentDetails.upiId || 'Not added yet')}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleTogglePaymentVerification(selectedWorker)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: '4px', background: selectedWorker.paymentDetails.verificationStatus === 'verified' ? 'var(--color-bg)' : 'var(--color-success)', color: selectedWorker.paymentDetails.verificationStatus === 'verified' ? 'var(--color-danger)' : 'white', border: selectedWorker.paymentDetails.verificationStatus === 'verified' ? '1px solid var(--color-border)' : 'none', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    {selectedWorker.paymentDetails.verificationStatus === 'verified' ? (
                      <>Unverify</>
                    ) : (
                      <><BadgeCheck size={12} /><span>Verify Payout</span></>
                    )}
                  </button>
                </div>

              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 'var(--space-md)', display: 'flex', gap: 'var(--space-xs)' }}>
              {selectedWorker.verificationStatus === 'pending' && selectedWorker.status !== 'Suspended' && (
                <>
                  <Button variant="primary" fullWidth icon={CheckCircle2} disabled={actionLoading} onClick={() => handleApprove(selectedWorker.id, selectedWorker.name)}>
                    Approve & Verify
                  </Button>
                  <Button variant="danger" fullWidth icon={ShieldAlert} disabled={actionLoading} onClick={() => { setRejectingWorker(selectedWorker); setRejectionReason(''); }}>
                    Reject
                  </Button>
                </>
              )}

              {selectedWorker.status === 'Verified' && (
                <Button variant="danger" fullWidth icon={Ban} onClick={() => setSuspendingWorker(selectedWorker)}>
                  Suspend Worker
                </Button>
              )}

              {selectedWorker.status === 'Suspended' && (
                <Button variant="primary" fullWidth icon={RotateCcw} onClick={() => handleReactivate(selectedWorker.id, selectedWorker.name)}>
                  Reactivate Worker
                </Button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* 5. REJECT (WITH REASON) MODAL */}
      {rejectingWorker && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-md)' }}>
          <Card padding="lg" style={{ maxWidth: '440px', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <ShieldAlert size={22} color="var(--color-danger)" />
              <h2 style={{ fontSize: '17px', fontWeight: 'bold', margin: 0 }}>Reject {rejectingWorker.name}'s Documents</h2>
            </div>
            <p className="text-secondary" style={{ fontSize: '13px', margin: '4px 0 12px' }}>
              A reason is required so the worker knows what to fix and resubmit.
            </p>
            <textarea
              rows={3}
              className="ss-input"
              style={{ width: '100%', resize: 'none' }}
              placeholder="e.g. Aadhaar photo is blurry, please re-upload a clearer scan."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <Button variant="outline" style={{ flex: 1 }} onClick={() => { setRejectingWorker(null); setRejectionReason(''); }}>
                Cancel
              </Button>
              <Button variant="danger" style={{ flex: 1 }} disabled={!rejectionReason.trim() || actionLoading} onClick={handleConfirmReject}>
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 6. SUSPENSION CONFIRMATION DIALOG MODAL */}
      {suspendingWorker && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-md)' }}>
          <Card padding="lg" style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-xs)' }}>
              <AlertTriangle size={28} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '4px 0' }}>Suspend {suspendingWorker.name}?</h2>
            <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.4, margin: '8px 0 var(--space-md)' }}>
              Suspend this worker? They won't receive new job requests.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
              <Button variant="outline" style={{ flex: 1 }} onClick={() => setSuspendingWorker(null)}>Cancel</Button>
              <Button variant="danger" style={{ flex: 1 }} disabled={actionLoading} onClick={handleConfirmSuspend}>Confirm Suspend</Button>
            </div>
          </Card>
        </div>
      )}

      {/* 7. ADJUST WELFARE FUND BALANCE MODAL */}
      {balanceAdjustWorker && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-md)' }}>
          <Card padding="lg" style={{ maxWidth: '420px', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Wallet size={22} color="var(--color-black)" />
              <h2 style={{ fontSize: '17px', fontWeight: 'bold', margin: 0 }}>Adjust {balanceAdjustWorker.name}'s Welfare Balance</h2>
            </div>
            <p className="text-secondary" style={{ fontSize: '13px', margin: '4px 0 12px' }}>
              Current balance: ₹{balanceAdjustWorker.welfareFundBalance.toLocaleString()}. Enter a positive amount to credit, or a negative amount to debit.
            </p>
            <div className="ss-form-group">
              <label className="ss-label">Amount (₹) — use a minus sign to debit</label>
              <input
                type="number"
                className="ss-input"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                placeholder="e.g. 500 or -500"
                autoFocus
              />
            </div>
            <div className="ss-form-group" style={{ marginBottom: 0 }}>
              <label className="ss-label">Reason (for the audit trail)</label>
              <textarea
                rows={2}
                className="ss-input"
                style={{ resize: 'none' }}
                value={balanceReason}
                onChange={(e) => setBalanceReason(e.target.value)}
                placeholder="e.g. Manual reconciliation correction"
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <Button variant="outline" style={{ flex: 1 }} onClick={() => setBalanceAdjustWorker(null)}>
                Cancel
              </Button>
              <Button variant="primary" style={{ flex: 1 }} disabled={!Number(balanceAmount) || actionLoading} onClick={handleConfirmAdjustBalance}>
                {actionLoading ? 'Saving...' : 'Apply Adjustment'}
              </Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
};

export default WorkerManagement;
