import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Vote,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  Scale,
  ArrowLeft,
  Clock,
  Loader2,
  Plus
} from 'lucide-react';
import { Button, Card, Badge, EmptyState } from '../../../components';
import { pollsAPI } from '../../../api';
import { useAuth } from '../../../context/AuthContext';

const formatDateTime = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

// Local <input type="datetime-local"> string, defaulted `daysFromNow` ahead
const defaultLocalDateTime = (daysFromNow = 0) => {
  const d = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export const CooperativeVoting = ({ isAdminView = false }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [polls, setPolls] = useState([]);
  const [activePoll, setActivePoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [votingLoading, setVotingLoading] = useState(false);
  const [voteError, setVoteError] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStartsAt, setNewStartsAt] = useState(() => defaultLocalDateTime(0));
  const [newEndsAt, setNewEndsAt] = useState(() => defaultLocalDateTime(7));
  const [newIsActive, setNewIsActive] = useState(true);
  const [createError, setCreateError] = useState('');

  const canVote = currentUser?.role === 'worker';

  const fetchPolls = async () => {
    try {
      setLoading(true);
      const res = await pollsAPI.getAll(isAdminView);
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setPolls(res.data);
        setActivePoll(res.data[0]);
      } else {
        setPolls([]);
        setActivePoll(null);
      }
    } catch (err) {
      console.error('Error fetching polls from MongoDB:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolls();
  }, [isAdminView]);

  const yesCount = activePoll?.yesCount || 0;
  const noCount = activePoll?.noCount || 0;
  const totalVotes = yesCount + noCount;
  const yesPercent = totalVotes > 0 ? Math.round((yesCount / totalVotes) * 100) : 50;
  const noPercent = totalVotes > 0 ? 100 - yesPercent : 50;
  // The server is the only source of truth for "did I already vote" —
  // no localStorage guess that could be wrong on a new device/browser.
  const userVote = activePoll?.myVote || null;

  const handleCastVote = async (choice) => {
    if (!activePoll || votingLoading || userVote) return;
    setVotingLoading(true);
    setVoteError('');

    try {
      const res = await pollsAPI.vote(activePoll.pollId, choice);
      if (res.success && res.data) {
        setActivePoll(res.data);
        setPolls((prev) => prev.map((p) => (p.pollId === res.data.pollId ? res.data : p)));
      }
    } catch (err) {
      setVoteError(err.response?.data?.message || 'Could not cast your vote. Please try again.');
    } finally {
      setVotingLoading(false);
    }
  };

  const handleCreatePoll = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) return;
    setCreateError('');

    if (new Date(newEndsAt) <= new Date(newStartsAt)) {
      setCreateError('The closing time must be after the opening time.');
      return;
    }

    try {
      const res = await pollsAPI.create({
        title: newTitle,
        description: newDesc,
        startsAt: new Date(newStartsAt).toISOString(),
        endsAt: new Date(newEndsAt).toISOString(),
        isActive: newIsActive
      });
      if (res.success) {
        setShowNewModal(false);
        setNewTitle('');
        setNewDesc('');
        setNewStartsAt(defaultLocalDateTime(0));
        setNewEndsAt(defaultLocalDateTime(7));
        setNewIsActive(true);
        fetchPolls();
      }
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Could not create the poll.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingBottom: 'var(--space-xl)' }}>

      {/* 1. TOP HEADER NAVIGATION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          {!isAdminView && (
            <button
              type="button"
              onClick={() => navigate('/worker/welfare')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--color-text-secondary)', fontSize: '13px', cursor: 'pointer', padding: '4px 0' }}
            >
              <ArrowLeft size={16} />
              <span>Welfare</span>
            </button>
          )}
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
            Cooperative Governance & Voting
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
          {isAdminView && (
            <Button variant="outline" size="small" icon={Plus} onClick={() => setShowNewModal(true)}>
              Create Poll
            </Button>
          )}
          <Badge variant="success" style={{ fontSize: '11px' }}>
            1 Worker = 1 Vote System
          </Badge>
        </div>
      </div>

      {/* 2. DEMOCRACY EXPLANATION BANNER */}
      <div style={{ background: '#F0FDF4', border: '1.5px solid #22C55E', borderRadius: 'var(--radius-md)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
        <Scale size={20} color="#16A34A" style={{ flexShrink: 0 }} />
        <p style={{ fontSize: '13px', color: '#15803D', margin: 0, lineHeight: 1.4 }}>
          <strong>Democratic Principle:</strong> In our cooperative society, every registered worker holds an equal vote on surplus fund allocation, tariff regulations, and worker welfare policies.
        </p>
      </div>

      {loading ? (
        <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
          <Loader2 size={24} className="ss-spinner" style={{ animation: 'spin 1s linear infinite' }} />
          <p className="text-secondary" style={{ fontSize: '13px', marginTop: 8 }}>Loading active polls from MongoDB...</p>
        </div>
      ) : !activePoll ? (
        <EmptyState
          icon={Vote}
          title="No Active Polls"
          description="There are currently no active polls open for member voting. When the cooperative committee drafts new polls, they will appear here."
        />
      ) : (
        <>
          {/* 3. ACTIVE POLL BALLOT CARD */}
          <Card padding="md" style={{ border: '2px solid var(--color-black)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xs)' }}>
              <Badge variant={activePoll.isActive ? 'active' : 'neutral'} style={{ fontSize: '11px' }}>
                {activePoll.pollId} • {activePoll.isActive ? 'Active Poll' : 'Closed'}
              </Badge>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                <Clock size={14} />
                <span>Closes {formatDateTime(activePoll.endsAt)}</span>
              </div>
            </div>

            <h2 style={{ fontSize: '17px', fontWeight: 'bold', margin: '4px 0 8px', color: 'var(--color-black)', lineHeight: 1.3 }}>
              {activePoll.title}
            </h2>

            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 var(--space-md)' }}>
              {activePoll.description}
            </p>

            {/* Voting Options (Yes / No) — workers only */}
            {canVote ? (
              <div style={{ display: 'flex', gap: 'var(--space-sm)', margin: 'var(--space-md) 0' }}>
                <button
                  type="button"
                  onClick={() => handleCastVote('yes')}
                  disabled={votingLoading || Boolean(userVote)}
                  style={{
                    flex: 1, padding: '14px', borderRadius: 'var(--radius-md)',
                    border: `2px solid ${userVote === 'yes' ? '#22C55E' : 'var(--color-border)'}`,
                    background: userVote === 'yes' ? '#F0FDF4' : 'white',
                    cursor: userVote ? 'default' : 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ThumbsUp size={18} color={userVote === 'yes' ? '#16A34A' : 'var(--color-black)'} />
                    <span style={{ fontWeight: 'bold', fontSize: '15px', color: userVote === 'yes' ? '#16A34A' : 'var(--color-black)' }}>Vote YES</span>
                  </div>
                  <span className="text-secondary" style={{ fontSize: '11px' }}>In favor of resolution</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCastVote('no')}
                  disabled={votingLoading || Boolean(userVote)}
                  style={{
                    flex: 1, padding: '14px', borderRadius: 'var(--radius-md)',
                    border: `2px solid ${userVote === 'no' ? '#EF4444' : 'var(--color-border)'}`,
                    background: userVote === 'no' ? '#FEF2F2' : 'white',
                    cursor: userVote ? 'default' : 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ThumbsDown size={18} color={userVote === 'no' ? '#DC2626' : 'var(--color-black)'} />
                    <span style={{ fontWeight: 'bold', fontSize: '15px', color: userVote === 'no' ? '#DC2626' : 'var(--color-black)' }}>Vote NO</span>
                  </div>
                  <span className="text-secondary" style={{ fontSize: '11px' }}>Oppose resolution</span>
                </button>
              </div>
            ) : (
              <div style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', margin: 'var(--space-md) 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Only registered workers may cast a vote. Admins can view live results below.
              </div>
            )}

            {voteError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #EF4444', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: '12px', fontWeight: 600, color: '#B91C1C', marginBottom: 'var(--space-sm)' }}>
                {voteError}
              </div>
            )}

            {userVote && (
              <div style={{
                background: userVote === 'yes' ? '#F0FDF4' : '#FEF2F2',
                border: `1px solid ${userVote === 'yes' ? '#22C55E' : '#EF4444'}`,
                borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: '12px', fontWeight: 'bold',
                color: userVote === 'yes' ? '#15803D' : '#B91C1C',
                display: 'flex', alignItems: 'center', gap: 6
              }}>
                <CheckCircle2 size={16} />
                <span>Your ballot has been cast ({userVote.toUpperCase()}) and saved to the cooperative ledger.</span>
              </div>
            )}

            {/* 4. LIVE AUDITED RESULTS BAR */}
            <div style={{ marginTop: 'var(--space-lg)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: 6 }}>
                <span>YES ({yesCount} vote{yesCount === 1 ? '' : 's'} • {yesPercent}%)</span>
                <span>NO ({noCount} vote{noCount === 1 ? '' : 's'} • {noPercent}%)</span>
              </div>

              <div style={{ width: '100%', height: 10, borderRadius: 'var(--radius-full)', background: noCount > 0 ? '#EF4444' : '#E2E8F0', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${yesPercent}%`, background: yesCount > 0 ? '#22C55E' : '#E2E8F0', transition: 'width 0.3s ease' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: 6 }}>
                <span>Total Ballots: <strong>{totalVotes}</strong></span>
                <span>Opened {formatDateTime(activePoll.startsAt)}</span>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* DRAFT NEW POLL MODAL (Admin) */}
      {showNewModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-md)' }}>
          <Card padding="md" style={{ maxWidth: '460px', width: '100%', background: 'white' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 12px' }}>
              Create New Cooperative Poll
            </h3>
            <form onSubmit={handleCreatePoll} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-secondary)' }}>Poll Question / Title</label>
                <input
                  type="text"
                  className="ss-input"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Should we increase tool subsidy cap to ₹5,000?"
                  required
                  style={{ width: '100%', marginTop: 2 }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-secondary)' }}>Description & Impact</label>
                <textarea
                  rows={3}
                  className="ss-input"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Details of the proposal..."
                  required
                  style={{ width: '100%', marginTop: 2, resize: 'none' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-secondary)' }}>Opens At</label>
                  <input
                    type="datetime-local"
                    className="ss-input"
                    value={newStartsAt}
                    onChange={(e) => setNewStartsAt(e.target.value)}
                    required
                    style={{ width: '100%', marginTop: 2 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-secondary)' }}>Closes At</label>
                  <input
                    type="datetime-local"
                    className="ss-input"
                    value={newEndsAt}
                    onChange={(e) => setNewEndsAt(e.target.value)}
                    required
                    style={{ width: '100%', marginTop: 2 }}
                  />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={newIsActive} onChange={(e) => setNewIsActive(e.target.checked)} />
                <span>Publish as active immediately</span>
              </label>

              {createError && (
                <div style={{ fontSize: '12px', color: 'var(--color-danger)', fontWeight: 600 }}>{createError}</div>
              )}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <Button variant="outline" size="small" type="button" onClick={() => setShowNewModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="small" type="submit">
                  Publish Poll
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

    </div>
  );
};

export default CooperativeVoting;
