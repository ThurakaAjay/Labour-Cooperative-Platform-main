import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Bell,
  MapPin,
  Clock,
  Navigation,
  PhoneCall,
  ShieldCheck,
  CheckCircle2,
  X,
  CalendarClock,
  Loader2
} from 'lucide-react';
import { Button, Card, Badge, EmptyState } from '../../../components';
import { bookingsAPI } from '../../../api';

export const JobRequestScreen = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [proposedDate, setProposedDate] = useState('');
  const [windowStartTime, setWindowStartTime] = useState('');
  const [windowEndTime, setWindowEndTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');

  const RESCHEDULE_SLOT_HOURS = 2;
  const rescheduleWindow = proposedDate && windowStartTime && windowEndTime
    ? { start: new Date(`${proposedDate}T${windowStartTime}`), end: new Date(`${proposedDate}T${windowEndTime}`) }
    : null;
  const isRescheduleWindowValid = Boolean(
    rescheduleWindow &&
    rescheduleWindow.end.getTime() - rescheduleWindow.start.getTime() >= RESCHEDULE_SLOT_HOURS * 3600000 &&
    rescheduleWindow.start.getTime() > Date.now()
  );

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return;
    }
    let isMounted = true;
    bookingsAPI.getById(jobId)
      .then((res) => {
        if (isMounted && res.success) setBooking(res.data);
      })
      .catch((err) => {
        if (isMounted) setError(err.response?.data?.message || 'Could not load this job request.');
      })
      .finally(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, [jobId]);

  const handleAccept = async () => {
    setActionLoading(true);
    setError('');
    try {
      const res = await bookingsAPI.updateStatus(jobId, { status: 'accepted' });
      if (res.success) {
        navigate(`/worker/job-management/${jobId}`, { state: { toastMessage: '✅ Job accepted! Head to the customer location.' } });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not accept this job. It may have already been taken.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    setError('');
    try {
      const res = await bookingsAPI.reject(jobId, rejectReason);
      if (res.success) {
        navigate('/worker/dashboard', { state: { toastMessage: 'Request declined. Your availability remains active for new matches.' } });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not decline this request.');
      setActionLoading(false);
    }
  };

  const handleProposeReschedule = async () => {
    if (!isRescheduleWindowValid) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await bookingsAPI.proposeReschedule(jobId, {
        windowStart: rescheduleWindow.start.toISOString(),
        windowEnd: rescheduleWindow.end.toISOString(),
        reason: rescheduleReason
      });
      if (res.success) {
        navigate('/worker/dashboard', { state: { toastMessage: '📅 Alternative time sent to the customer for approval.' } });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not propose a new time.');
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
        <p className="text-secondary" style={{ fontSize: '13px', marginTop: 8 }}>Loading job request...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <EmptyState
        icon={Bell}
        title="Job Request Not Found"
        description={error || 'This request may have been withdrawn or already handled.'}
      />
    );
  }

  if (booking.status !== 'pending') {
    return (
      <EmptyState
        icon={CheckCircle2}
        title={`This job is already '${booking.status.replace('_', ' ')}'`}
        description="Nothing left to respond to here."
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingBottom: 'var(--space-xl)' }}>

      {/* 1. TOP NOTIFICATION HEADER */}
      <div style={{
        background: 'var(--color-black)', color: 'var(--color-white)', borderRadius: 'var(--radius-md)',
        padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)'
      }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bell size={18} />
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>🔔 New Service Request</div>
          <div style={{ fontSize: '11px', color: '#BBB' }}>Direct Cooperative Smart Match</div>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* 2. MAIN REQUEST CARD */}
      <Card padding="md" style={{ border: '2px solid var(--color-accent)', background: '#FFFDFB' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {booking.isEmergency && <Badge variant="danger" style={{ marginBottom: 4 }}>Emergency Request</Badge>}
            {!booking.isEmergency && <Badge variant="active" style={{ marginBottom: 4 }}>Service Request</Badge>}
            <h1 style={{ fontSize: '19px', fontWeight: 'bold', margin: '2px 0 4px', color: 'var(--color-black)' }}>
              {booking.serviceCategory}
            </h1>
            <p style={{ fontSize: '14px', color: '#444', margin: 0, lineHeight: 1.4 }}>
              {booking.serviceDetails}
            </p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 'var(--space-sm)' }}>
            <span className="text-secondary" style={{ fontSize: '11px' }}>ESTIMATED EARNING</span>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-accent)', margin: '1px 0' }}>
              ₹{Math.round((booking.amount || 0) * 0.95)}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--color-success)', fontWeight: 600 }}>95% Direct Payout</div>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--color-border)', margin: 'var(--space-md) 0' }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
          <div style={{ background: 'var(--color-bg)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
            <span className="text-secondary" style={{ fontSize: '11px' }}>CUSTOMER</span>
            <div style={{ fontWeight: 'bold', fontSize: '13px', margin: '2px 0' }}>{booking.customerName}</div>
          </div>
          <div style={{ background: 'var(--color-bg)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
            <span className="text-secondary" style={{ fontSize: '11px' }}>LOCATION</span>
            <div style={{ fontWeight: 'bold', fontSize: '13px', margin: '2px 0', color: 'var(--color-black)' }}>
              {booking.customerAddress}
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', fontSize: '13px' }}>
          <Clock size={16} color="var(--color-accent)" style={{ flexShrink: 0 }} />
          <div>
            <span className="text-secondary">Requested: </span>
            <strong style={{ color: 'var(--color-black)' }}>{booking.dateString || 'Today • Immediate'}</strong>
          </div>
        </div>

        {booking.photos?.length > 0 && (
          <div>
            <label className="ss-label" style={{ display: 'block', marginBottom: '6px' }}>
              Customer Attached Photos ({booking.photos.length})
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-xs)' }}>
              {booking.photos.map((p, idx) => (
                <div key={p.publicId || idx} style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--color-border)', height: '110px' }}>
                  <img src={p.url} alt={`Attached issue ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--radius-sm)', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: '#166534' }}>
        <ShieldCheck size={16} style={{ flexShrink: 0 }} />
        <span>₹5,00,000 on-duty cooperative insurance applies to this job.</span>
      </div>

      {/* 3. THREE ACTIONS: REJECT / PROPOSE RESCHEDULE / ACCEPT */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xs)' }}>
        <Button variant="outline" size="large" icon={X} style={{ flex: 1, height: '54px' }} disabled={actionLoading} onClick={() => setIsRejectModalOpen(true)}>
          Reject
        </Button>
        <Button variant="outline" size="large" icon={CalendarClock} style={{ flex: 1, height: '54px' }} disabled={actionLoading} onClick={() => setIsRescheduleModalOpen(true)}>
          Reschedule
        </Button>
        <Button variant="primary" size="large" icon={CheckCircle2} style={{ flex: 2, height: '54px', fontWeight: 'bold' }} disabled={actionLoading} onClick={handleAccept}>
          {actionLoading ? 'Accepting...' : 'Accept'}
        </Button>
      </div>

      {/* REJECT MODAL */}
      {isRejectModalOpen && (
        <ModalShell onClose={() => setIsRejectModalOpen(false)} title="Decline This Request">
          <textarea
            className="ss-input"
            placeholder="Reason (optional) — e.g. too far away, fully booked today..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            style={{ minHeight: 80, padding: 10 }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <Button variant="outline" style={{ flex: 1 }} onClick={() => setIsRejectModalOpen(false)}>Cancel</Button>
            <Button variant="primary" style={{ flex: 1 }} disabled={actionLoading} onClick={handleReject}>
              {actionLoading ? 'Declining...' : 'Confirm Decline'}
            </Button>
          </div>
        </ModalShell>
      )}

      {/* RESCHEDULE MODAL */}
      {isRescheduleModalOpen && (
        <ModalShell onClose={() => setIsRescheduleModalOpen(false)} title="Propose an Available Window">
          <label className="ss-label" style={{ display: 'block', marginBottom: 6 }}>Date You're Free</label>
          <input
            type="date"
            className="ss-input"
            value={proposedDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setProposedDate(e.target.value)}
            style={{ marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="ss-label" style={{ display: 'block', marginBottom: 6 }}>From</label>
              <input
                type="time"
                className="ss-input"
                value={windowStartTime}
                onChange={(e) => setWindowStartTime(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="ss-label" style={{ display: 'block', marginBottom: 6 }}>Until</label>
              <input
                type="time"
                className="ss-input"
                value={windowEndTime}
                onChange={(e) => setWindowEndTime(e.target.value)}
              />
            </div>
          </div>
          {proposedDate && windowStartTime && windowEndTime && !isRescheduleWindowValid && (
            <p style={{ fontSize: '12px', color: '#B91C1C', margin: '0 0 10px' }}>
              Window must be at least {RESCHEDULE_SLOT_HOURS} hours long and start in the future.
            </p>
          )}
          <label className="ss-label" style={{ display: 'block', marginBottom: 6 }}>Reason (optional)</label>
          <textarea
            className="ss-input"
            placeholder="e.g. Currently finishing another job nearby..."
            value={rescheduleReason}
            onChange={(e) => setRescheduleReason(e.target.value)}
            style={{ minHeight: 60, padding: 10 }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <Button variant="outline" style={{ flex: 1 }} onClick={() => setIsRescheduleModalOpen(false)}>Cancel</Button>
            <Button variant="primary" style={{ flex: 1 }} disabled={!isRescheduleWindowValid || actionLoading} onClick={handleProposeReschedule}>
              {actionLoading ? 'Sending...' : 'Send to Customer'}
            </Button>
          </div>
        </ModalShell>
      )}

    </div>
  );
};

const ModalShell = ({ title, onClose, children }) => (
  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-md)' }}>
    <div style={{ background: 'var(--color-white)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '400px', padding: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>{title}</h3>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export default JobRequestScreen;
