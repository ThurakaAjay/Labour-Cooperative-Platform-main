import React, { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '../../../components';

const CANCEL_REASONS = [
  'Emergency',
  'No longer needed',
  'Worker unresponsive',
  'Booked by mistake',
  'Found another service',
  'Other'
];

// Shared cancellation confirmation modal used from both the live tracking
// screen and the bookings list — a reason is always required so cancellation
// analytics (and any refund/support follow-up) have context, not just a bare
// status flip.
export const CancelBookingModal = ({ isOpen, onClose, onConfirm, isSubmitting, error }) => {
  const [selectedReason, setSelectedReason] = useState(CANCEL_REASONS[0]);
  const [otherReason, setOtherReason] = useState('');

  if (!isOpen) return null;

  const isOther = selectedReason === 'Other';
  const finalReason = isOther ? otherReason.trim() : selectedReason;
  const canSubmit = Boolean(finalReason) && !isSubmitting;

  const handleConfirm = () => {
    if (!canSubmit) return;
    onConfirm(finalReason);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-md)'
      }}
    >
      <div
        style={{
          background: 'var(--color-white)',
          width: '100%',
          maxWidth: '420px',
          borderRadius: '16px',
          padding: 'var(--space-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#FEF2F2',
              color: '#DC2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>Cancel Booking?</h3>
              <p className="text-secondary" style={{ fontSize: '12px', marginTop: 2 }}>
                This cannot be undone. The worker will be notified immediately.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{ padding: 4, cursor: isSubmitting ? 'not-allowed' : 'pointer', flexShrink: 0 }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div>
          <label className="ss-label" style={{ display: 'block', marginBottom: 4 }}>
            Reason for cancellation
          </label>
          <select
            className="ss-input"
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
            disabled={isSubmitting}
            style={{ width: '100%' }}
          >
            {CANCEL_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {isOther && (
          <div>
            <label className="ss-label" style={{ display: 'block', marginBottom: 4 }}>
              Please specify
            </label>
            <textarea
              className="ss-input"
              rows={3}
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
              placeholder="Tell us why you're cancelling..."
              disabled={isSubmitting}
              style={{ width: '100%', resize: 'vertical' }}
              autoFocus
            />
          </div>
        )}

        {error && (
          <div style={{ fontSize: '12px', color: 'var(--color-danger)' }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" fullWidth onClick={onClose} disabled={isSubmitting}>
            Keep Booking
          </Button>
          <Button
            variant="primary"
            fullWidth
            onClick={handleConfirm}
            disabled={!canSubmit}
            style={{ background: '#DC2626', borderColor: '#DC2626' }}
          >
            {isSubmitting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Confirm Cancellation'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CancelBookingModal;
