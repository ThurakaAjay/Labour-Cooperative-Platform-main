import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Ban,
  RotateCcw,
  AlertTriangle,
  Loader2,
  Calendar
} from 'lucide-react';
import { Button, Card, Badge, EmptyState } from '../../../components';
import { adminAPI } from '../../../api';

export const AdminCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Active' | 'Suspended'

  const [suspendingUser, setSuspendingUser] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminAPI.getCustomers();
      if (res.success && Array.isArray(res.data)) {
        setCustomers(res.data);
      }
    } catch (err) {
      console.error('Error loading customers from MongoDB:', err);
      setError('Unable to load customer records from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filtered = customers.filter((c) => {
    const matchesFilter = statusFilter === 'All' || c.status === statusFilter;
    const matchesSearch =
      (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone || '').includes(searchTerm) ||
      (c.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleConfirmSuspend = async () => {
    if (!suspendingUser) return;
    setActionLoading(true);
    try {
      await adminAPI.updateUserStatus(suspendingUser.userId, 'Suspended');
      showToast(`⚠️ ${suspendingUser.name} suspended.`);
      setSuspendingUser(null);
      fetchCustomers();
    } catch (err) {
      showToast(`⚠️ ${err.response?.data?.message || 'Failed to suspend account'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async (userId, name) => {
    setActionLoading(true);
    try {
      await adminAPI.updateUserStatus(userId, 'Active');
      showToast(`✓ ${name} reactivated.`);
      fetchCustomers();
    } catch (err) {
      showToast(`⚠️ ${err.response?.data?.message || `Failed to reactivate ${name}`}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingBottom: 'var(--space-xl)' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: '0 0 2px' }}>
            Customer Directory
          </h1>
          <p className="text-secondary" style={{ fontSize: '13px', margin: 0 }}>
            Registered customer accounts, booking history, and account standing
          </p>
        </div>
        <Badge variant="active" style={{ fontSize: '12px' }}>
          {customers.length} Total Registered Customers
        </Badge>
      </div>

      {toastMessage && (
        <div style={{ background: 'var(--color-black)', color: 'white', padding: '12px 18px', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-lg)' }}>
          <span>{toastMessage}</span>
          <button type="button" onClick={() => setToastMessage(null)} style={{ color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
      )}

      <Card padding="md">
        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
            <input
              type="text"
              className="ss-input"
              style={{ paddingLeft: '38px', height: '42px', fontSize: '13px' }}
              placeholder="Search by name, phone, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={16} color="var(--color-text-secondary)" style={{ position: 'absolute', left: 12, top: 13 }} />
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'All', label: `All (${customers.length})` },
              { id: 'Active', label: `Active (${customers.filter((c) => c.status === 'Active').length})` },
              { id: 'Suspended', label: `Suspended (${customers.filter((c) => c.status === 'Suspended').length})` }
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

      {loading ? (
        <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
          <Loader2 size={24} className="ss-spinner" style={{ animation: 'spin 1s linear infinite' }} />
          <p className="text-secondary" style={{ fontSize: '13px', marginTop: 8 }}>Loading customer directory from MongoDB...</p>
        </div>
      ) : error ? (
        <Card padding="lg" style={{ textAlign: 'center', color: 'var(--color-danger)' }}>{error}</Card>
      ) : filtered.length === 0 ? (
        <Card padding="lg" style={{ textAlign: 'center' }}>
          <EmptyState
            icon={Users}
            title={customers.length === 0 ? 'No Registered Customers in Database' : 'No Customers Match Your Filter'}
            description={customers.length === 0
              ? 'When customers register through the app, their profiles will appear here.'
              : 'Try adjusting your search terms or filter selection.'}
          />
        </Card>
      ) : (
        <Card padding="none" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg)', borderBottom: '1.5px solid var(--color-border)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>Customer</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>Contact</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>Role</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>Bookings</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>Registered</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, index) => (
                  <tr key={c.userId} style={{ borderBottom: '1px solid var(--color-border)', background: index % 2 === 0 ? 'white' : '#FCFCFC' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--color-black)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold' }}>
                          {c.avatar || (c.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 'bold', color: 'var(--color-black)' }}>{c.name}</div>
                          <div className="text-secondary" style={{ fontSize: '11px' }}>{c.locality}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div>{c.phone}</div>
                      <div className="text-secondary" style={{ fontSize: '11px' }}>{c.email}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant="active" style={{ fontSize: '11px', textTransform: 'capitalize' }}>
                        {c.role}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant={c.status === 'Suspended' ? 'danger' : 'success'}>
                        {c.status === 'Suspended' ? '⛔ Suspended' : '🟢 Active'}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                      {c.completedBookings || 0} / {c.totalBookings || 0}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        <Calendar size={12} />
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {c.status === 'Suspended' ? (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleReactivate(c.userId, c.name)}
                          style={{ padding: '4px 10px', borderRadius: '4px', background: 'var(--color-black)', color: 'white', border: 'none', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                        >
                          <RotateCcw size={12} />
                          <span>Reactivate</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => setSuspendingUser(c)}
                          style={{ padding: '4px 10px', borderRadius: '4px', background: 'var(--color-bg)', color: 'var(--color-danger)', border: '1px solid var(--color-border)', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                        >
                          <Ban size={12} />
                          <span>Suspend</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {suspendingUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-md)' }}>
          <Card padding="lg" style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-xs)' }}>
              <AlertTriangle size={28} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '4px 0' }}>Suspend {suspendingUser.name}?</h2>
            <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.4, margin: '8px 0 var(--space-md)' }}>
              Suspend this account? They won't be able to sign in or book services until reactivated.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
              <Button variant="outline" style={{ flex: 1 }} onClick={() => setSuspendingUser(null)}>Cancel</Button>
              <Button variant="danger" style={{ flex: 1 }} disabled={actionLoading} onClick={handleConfirmSuspend}>Confirm Suspend</Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
};

export default AdminCustomers;
