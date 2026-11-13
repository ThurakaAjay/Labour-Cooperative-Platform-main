import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HeartHandshake,
  ExternalLink,
  Scale,
  Coins,
  ArrowRight,
  X,
  Edit3
} from 'lucide-react';
import { Button, Card, Badge } from '../../../components';
import { useWorker } from '../context/WorkerContext';
import { useAuth } from '../../../context/AuthContext';
import { workersAPI, cooperativeAPI } from '../../../api';

const emptyWelfareSnapshot = () => ({
  welfareFundBalance: 0,
  healthInsurance: { active: false, policyNumber: '', coverageAmount: 500000, provider: '' },
  accidentCoverage: { active: false, policyNumber: '', coverageAmount: 500000, provider: '', nominee: { name: '', relation: '', payout: '' } },
  paymentDetails: { payoutType: 'upi', upiId: '', verificationStatus: 'unverified' }
});

export const WorkerWelfare = () => {
  const navigate = useNavigate();
  const { worker, updateWorker } = useWorker();
  const { currentUser } = useAuth();

  // Server-authoritative snapshot (GET /api/workers/welfare) rather than
  // reading straight off the shared `worker` context — this page is the one
  // place admin-issued insurance and balance adjustments need to show up
  // reliably without depending on when the context last happened to re-sync.
  const [welfare, setWelfare] = useState(emptyWelfareSnapshot());
  const [coopStats, setCoopStats] = useState({ totalWorkers: 0, totalEarnings: 0 });
  const [loading, setLoading] = useState(true);

  // Modal States
  const [activeClaimModal, setActiveClaimModal] = useState(null); // 'tools' | 'loan' | 'withdrawal' | null
  const [claimAmount, setClaimAmount] = useState('');
  const [claimDetails, setClaimDetails] = useState('');
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimSuccessMsg, setClaimSuccessMsg] = useState('');
  const [claimFormError, setClaimFormError] = useState('');

  // Scheme Modal State
  const [selectedScheme, setSelectedScheme] = useState(null);

  // Nominee Edit Modal
  const [isEditingNominee, setIsEditingNominee] = useState(false);
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeRelation, setNomineeRelation] = useState('Family');

  const activeWorkerId = worker.workerId || currentUser?.userId;

  const fetchWelfareData = async () => {
    try {
      setLoading(true);
      const [welfareRes, statsRes] = await Promise.allSettled([
        workersAPI.getWelfare(),
        cooperativeAPI.getStats()
      ]);

      if (welfareRes.status === 'fulfilled' && welfareRes.value.success && welfareRes.value.data) {
        setWelfare({ ...emptyWelfareSnapshot(), ...welfareRes.value.data });
      }

      if (statsRes.status === 'fulfilled' && statsRes.value.success && statsRes.value.data) {
        setCoopStats({
          totalWorkers: statsRes.value.data.totalWorkers || 0,
          totalEarnings: statsRes.value.data.todayEarnings || 0
        });
      }
    } catch (err) {
      console.warn('Welfare data load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWelfareData();
  }, [activeWorkerId]);

  // The nominee edit form is seeded from the freshly-fetched snapshot, not
  // the initial (possibly stale) render — re-syncs whenever the snapshot
  // reloads, e.g. after saving.
  useEffect(() => {
    setNomineeName(welfare.accidentCoverage?.nominee?.name || '');
    setNomineeRelation(welfare.accidentCoverage?.nominee?.relation || 'Family');
  }, [welfare.accidentCoverage?.nominee?.name, welfare.accidentCoverage?.nominee?.relation]);

  const displayName = worker.name || currentUser?.name || 'Worker Member';

  const govtSchemes = [
    {
      id: 'pmjjby',
      name: 'Pradhan Mantri Jeevan Jyoti Bima Yojana (PMJJBY)',
      description: '₹2,00,000 life insurance protection for unorganized workers subsidized by the cooperative.',
      tag: 'Central Govt Scheme',
      details: 'Life insurance coverage of ₹2 Lakh for death due to any cause. Annual premium of ₹436 is 100% reimbursed through the Cooperative Welfare Reserve.',
      eligibility: 'All cooperative members aged 18–50 with an active savings bank account.',
      documents: 'Aadhaar Card, Bank Passbook, Society Membership ID.'
    },
    {
      id: 'eshram',
      name: 'e-Shram Universal Social Security Card',
      description: 'Central registry linking accidental insurance, pension benefits, and state welfare aid.',
      tag: 'National Social Registry',
      details: 'National database of unorganized workers with 12-digit UAN card. Eligible for ₹2 Lakh accidental death cover and direct DBT disaster relief.',
      eligibility: 'All workers in unorganized sectors aged 16–59.',
      documents: 'Aadhaar-linked Mobile Number, Bank Account details.'
    },
    {
      id: 'tnuwwb',
      name: 'Tamil Nadu Unorganised Workers Welfare Board (TNUWWB)',
      description: 'State welfare support including children education grants, maternity benefits, and monthly old-age pension.',
      tag: 'State Board Scheme',
      details: 'Provides ₹1,000/month old-age pension after 60, ₹50,000 accidental assistance, ₹4,000/yr higher education grants for children, and marriage grants.',
      eligibility: 'Tamil Nadu residents working in verified trades for at least 90 days a year.',
      documents: 'Proof of trade from Chennai Labour Cooperative, Ration Card, Aadhaar.'
    }
  ];

  const [nomineeSaving, setNomineeSaving] = useState(false);
  const [nomineeError, setNomineeError] = useState('');

  const handleSaveNominee = async (e) => {
    e.preventDefault();
    if (!nomineeName.trim()) return;
    setNomineeSaving(true);
    setNomineeError('');
    const result = await updateWorker({
      accidentCoverage: {
        nominee: {
          name: nomineeName.trim(),
          relation: nomineeRelation,
          payout: `${nomineeName.toLowerCase().replace(/\s+/g, '')}@okaxis`
        }
      }
    });
    setNomineeSaving(false);
    if (result.success) {
      setIsEditingNominee(false);
      fetchWelfareData();
    } else {
      setNomineeError(result.message || 'Could not save nominee. Please try again.');
    }
  };

  const CLAIM_META = {
    tools: { title: 'Tool Upgrade & Safety Gear Subsidy', category: 'tool_subsidy' },
    loan: { title: 'Emergency Hardship Loan (0% APR)', category: 'emergency_credit' },
    withdrawal: { title: 'Welfare Fund Withdrawal', category: 'welfare_withdrawal' }
  };

  const handleClaimSubmit = async (e) => {
    e.preventDefault();
    const amount = Number(claimAmount);
    setClaimFormError('');
    if (!amount || amount <= 0) return;

    if (activeClaimModal === 'withdrawal' && amount > welfare.welfareFundBalance) {
      setClaimFormError(`Amount cannot exceed your available balance of ₹${welfare.welfareFundBalance.toLocaleString()}.`);
      return;
    }

    setClaimSubmitting(true);
    try {
      const meta = CLAIM_META[activeClaimModal];
      const res = await cooperativeAPI.createClaim({
        title: meta.title,
        workerId: activeWorkerId,
        workerName: displayName,
        amount,
        category: meta.category,
        details: claimDetails || `Requested by ${displayName}`
      });

      if (res.success) {
        setClaimSuccessMsg(`Claim #${res.data?.claimId || 'CLM-SUCCESS'} submitted for cooperative admin review.`);
        setTimeout(() => {
          setActiveClaimModal(null);
          setClaimSuccessMsg('');
          setClaimAmount('');
          setClaimDetails('');
          fetchWelfareData();
        }, 2000);
      }
    } catch (err) {
      setClaimFormError(err.response?.data?.message || err.message || 'Error submitting claim.');
    } finally {
      setClaimSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingBottom: 'var(--space-xl)' }}>
      
      {/* 1. HEADER */}
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: '0 0 2px' }}>
          Worker Welfare & Insurance
        </h1>
        <p className="text-secondary" style={{ fontSize: '13px', margin: 0 }}>
          Member: <strong>{displayName}</strong> • Chennai Labour Cooperative Society
        </p>

        {/* Mission Statement */}
        <div style={{
          background: '#F0FDF4',
          border: '1.5px solid #22C55E',
          borderRadius: 'var(--radius-md)',
          padding: '10px 12px',
          marginTop: 'var(--space-xs)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)'
        }}>
          <Scale size={18} color="#16A34A" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#15803D', margin: 0, lineHeight: 1.4 }}>
            "This is a worker-owned marketplace — cooperative workers earn directly, not a private company."
          </p>
        </div>
      </div>

      {/* COOPERATIVE SHORTCUTS: ECONOMICS & DEMOCRATIC VOTING */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xs)' }}>
        <Card
          padding="sm"
          style={{
            border: '1.5px solid var(--color-border)',
            cursor: 'pointer',
            background: 'var(--color-bg)'
          }}
          onClick={() => navigate('/worker/cooperative')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Coins size={18} color="var(--color-black)" />
              <ArrowRight size={14} color="var(--color-text-secondary)" />
            </div>
            <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--color-black)' }}>
              Coop Economics
            </div>
            <div className="text-secondary" style={{ fontSize: '10px' }}>
              {coopStats.totalWorkers} member{coopStats.totalWorkers === 1 ? '' : 's'} registered in Atlas
            </div>
          </div>
        </Card>

        <Card
          padding="sm"
          style={{
            border: '1.5px solid var(--color-accent)',
            cursor: 'pointer',
            background: '#FFFDFB'
          }}
          onClick={() => navigate('/worker/voting')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '16px' }}>🗳️</span>
              <Badge variant="active" style={{ fontSize: '9px', padding: '1px 5px' }}>Live Ballot</Badge>
            </div>
            <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--color-black)' }}>
              Member Voting
            </div>
            <div className="text-secondary" style={{ fontSize: '10px' }}>
              1 Worker = 1 Vote Governance
            </div>
          </div>
        </Card>
      </div>

      {/* 2. INSURANCE POLICY CARDS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
        
        {/* Card 1: Health Insurance */}
        <Card padding="md" style={welfare.healthInsurance.active ? { border: '1.5px solid #22C55E', background: '#F9FFF9' } : { border: '1.5px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
              <span style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: welfare.healthInsurance.active ? '#00E676' : '#9E9E9E',
                boxShadow: welfare.healthInsurance.active ? '0 0 0 3px rgba(0, 230, 118, 0.25)' : 'none',
                flexShrink: 0
              }} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: 'var(--color-black)' }}>
                    Health Insurance
                  </h2>
                  <span style={{ color: welfare.healthInsurance.active ? 'var(--color-success)' : 'var(--color-text-secondary)', fontWeight: 'bold', fontSize: '13px' }}>
                    {welfare.healthInsurance.active ? '— Active' : '— Not Issued Yet'}
                  </span>
                </div>
                <p className="text-secondary" style={{ fontSize: '12px', margin: '2px 0 0' }}>
                  {welfare.healthInsurance.active
                    ? `₹${welfare.healthInsurance.coverageAmount.toLocaleString()} cashless medical hospitalization coverage for worker & dependents.`
                    : 'Your cooperative admin has not issued health coverage yet.'}
                </p>
              </div>
            </div>

            <Badge variant={welfare.healthInsurance.active ? 'success' : 'neutral'} style={{ fontSize: '10px' }}>
              {welfare.healthInsurance.active ? 'Covered' : 'Pending'}
            </Badge>
          </div>

          {welfare.healthInsurance.active && (
            <div style={{
              background: 'white',
              border: '1px solid #E0E0E0',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 10px',
              marginTop: 'var(--space-sm)',
              fontSize: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span className="text-secondary">Policy: #{welfare.healthInsurance.policyNumber}</span>
              <span className="text-bold">{welfare.healthInsurance.provider}</span>
            </div>
          )}
        </Card>

        {/* Card 2: Accident Coverage */}
        <Card padding="md" style={welfare.accidentCoverage.active ? { border: '1.5px solid #22C55E', background: '#F9FFF9' } : { border: '1.5px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
              <span style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: welfare.accidentCoverage.active ? '#00E676' : '#9E9E9E',
                boxShadow: welfare.accidentCoverage.active ? '0 0 0 3px rgba(0, 230, 118, 0.25)' : 'none',
                flexShrink: 0
              }} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: 'var(--color-black)' }}>
                    Accident Coverage
                  </h2>
                  <span style={{ color: welfare.accidentCoverage.active ? 'var(--color-success)' : 'var(--color-text-secondary)', fontWeight: 'bold', fontSize: '13px' }}>
                    {welfare.accidentCoverage.active ? '— Active' : '— Not Issued Yet'}
                  </span>
                </div>
                <p className="text-secondary" style={{ fontSize: '12px', margin: '2px 0 0' }}>
                  {welfare.accidentCoverage.active
                    ? `₹${welfare.accidentCoverage.coverageAmount.toLocaleString()} 24x7 on-duty accident and accidental disability protection.`
                    : 'Your cooperative admin has not issued accident coverage yet — you can still set a nominee now.'}
                </p>
              </div>
            </div>

            <Badge variant={welfare.accidentCoverage.active ? 'success' : 'neutral'} style={{ fontSize: '10px' }}>
              {welfare.accidentCoverage.active ? 'Covered' : 'Pending'}
            </Badge>
          </div>

          <div style={{
            background: 'white',
            border: '1px solid #E0E0E0',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 10px',
            marginTop: 'var(--space-sm)',
            fontSize: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="text-secondary">Nominee:</span>
              <strong>{welfare.accidentCoverage.nominee?.name || 'Not assigned yet'}</strong>
              {welfare.accidentCoverage.nominee?.relation && <span className="text-secondary">({welfare.accidentCoverage.nominee.relation})</span>}
            </div>
            <button
              type="button"
              onClick={() => setIsEditingNominee(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-accent)',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '11px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2
              }}
            >
              <Edit3 size={11} />
              <span>{welfare.accidentCoverage.nominee?.name ? 'Edit' : 'Add Nominee'}</span>
            </button>
          </div>
        </Card>

      </div>

      {/* 3. WELFARE FUND BALANCE CARD (DYNAMIC FROM MONGODB) */}
      <Card padding="md" style={{ background: 'var(--color-black)', color: 'var(--color-white)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#BBB', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              YOUR ACCUMULATED WELFARE FUND
            </span>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--color-white)', margin: '4px 0 2px' }}>
              ₹{welfare.welfareFundBalance.toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: '#00E676', fontWeight: 600 }}>
              ✓ Fully Vested & Claimable from Society Pool
            </div>
          </div>

          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(255, 106, 0, 0.2)',
            color: 'var(--color-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <HeartHandshake size={22} />
          </div>
        </div>

        <p style={{ fontSize: '13px', color: '#E0E0E0', lineHeight: 1.4, margin: 'var(--space-md) 0 var(--space-md)' }}>
          5% of every completed job is automatically deposited into this cooperative escrow to cover your emergency insurance, tool subsidies, and safety gear.
        </p>

        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          <button
            type="button"
            onClick={() => {
              setActiveClaimModal('tools');
              setClaimAmount('500');
              setClaimDetails('Tool safety equipment replacement');
            }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              background: 'white',
              color: 'var(--color-black)',
              border: 'none',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Claim for Tools
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveClaimModal('loan');
              setClaimAmount('5000');
              setClaimDetails('Emergency family medical cash assistance');
            }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255, 255, 255, 0.15)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Emergency 0% Loan
          </button>
        </div>

        <button
          type="button"
          disabled={welfare.welfareFundBalance <= 0}
          onClick={() => {
            setActiveClaimModal('withdrawal');
            setClaimAmount(String(welfare.welfareFundBalance));
            setClaimDetails('Welfare fund withdrawal to my registered payout method');
          }}
          style={{
            width: '100%',
            marginTop: 'var(--space-xs)',
            padding: '10px',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: welfare.welfareFundBalance <= 0 ? '#777' : 'var(--color-accent)',
            border: `1px solid ${welfare.welfareFundBalance <= 0 ? 'rgba(255,255,255,0.15)' : 'var(--color-accent)'}`,
            fontSize: '13px',
            fontWeight: 'bold',
            cursor: welfare.welfareFundBalance <= 0 ? 'not-allowed' : 'pointer'
          }}
        >
          Request Withdrawal
        </button>
      </Card>

      {/* 4. GOVERNMENT WELFARE SCHEMES SECTION */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-xs)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
            Government Welfare Schemes
          </h2>
          <span className="text-secondary" style={{ fontSize: '12px' }}>
            3 Active Links
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          {govtSchemes.map((scheme) => (
            <Card key={scheme.id} padding="md">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Badge variant="active" style={{ fontSize: '10px', marginBottom: 4 }}>
                    {scheme.tag}
                  </Badge>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '2px 0 4px', color: 'var(--color-black)' }}>
                    {scheme.name}
                  </h3>
                  <p className="text-secondary" style={{ fontSize: '12px', margin: 0, lineHeight: 1.4 }}>
                    {scheme.description}
                  </p>
                </div>
              </div>

              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setSelectedScheme(scheme)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: '12px',
                    color: 'var(--color-accent)',
                    fontWeight: 'bold',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <span>Learn more & Apply</span>
                  <ExternalLink size={12} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* MODAL 1: SUBMIT TOOL / LOAN / WITHDRAWAL CLAIM */}
      {activeClaimModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(3px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <Card padding="lg" style={{ maxWidth: '420px', width: '100%', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
                {activeClaimModal === 'tools' && 'Submit Tool Subsidy Claim'}
                {activeClaimModal === 'loan' && 'Apply for 0% Emergency Loan'}
                {activeClaimModal === 'withdrawal' && 'Request Welfare Fund Withdrawal'}
              </h3>
              <button type="button" onClick={() => setActiveClaimModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {claimSuccessMsg ? (
              <div style={{ background: '#F0FDF4', border: '1px solid #22C55E', borderRadius: 'var(--radius-sm)', padding: '12px', color: '#15803D', fontSize: '13px', fontWeight: 600 }}>
                ✓ {claimSuccessMsg}
              </div>
            ) : (
              <form onSubmit={handleClaimSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {claimFormError && (
                  <div style={{ fontSize: '12px', color: 'var(--color-danger)', fontWeight: 600 }}>{claimFormError}</div>
                )}

                <div className="ss-form-group">
                  <label className="ss-label">
                    {activeClaimModal === 'withdrawal'
                      ? `Withdrawal Amount (₹) — Available: ₹${welfare.welfareFundBalance.toLocaleString()}`
                      : 'Claim Amount (₹):'}
                  </label>
                  <input
                    type="number"
                    required
                    min="100"
                    max={activeClaimModal === 'withdrawal' ? welfare.welfareFundBalance : 15000}
                    className="ss-input"
                    value={claimAmount}
                    onChange={(e) => setClaimAmount(e.target.value)}
                  />
                </div>

                <div className="ss-form-group">
                  <label className="ss-label">Purpose / Description:</label>
                  <textarea
                    rows={3}
                    required
                    className="ss-input"
                    value={claimDetails}
                    onChange={(e) => setClaimDetails(e.target.value)}
                    placeholder="e.g. Safety shoes, toolkit repair, medical prescription..."
                  />
                </div>

                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', background: 'var(--color-bg)', padding: '8px', borderRadius: '4px' }}>
                  {activeClaimModal === 'withdrawal'
                    ? `Dispatched as a pending request to the Ward 4 Cooperative admin for approval — paid to your registered ${welfare.paymentDetails?.payoutType === 'bank' ? 'bank account' : 'UPI ID'} once settled.`
                    : 'Submitted as a pending request for review by the Ward 4 Society admin.'}
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-xs)', marginTop: 8 }}>
                  <Button type="button" variant="outline" fullWidth onClick={() => setActiveClaimModal(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" fullWidth disabled={claimSubmitting}>
                    {claimSubmitting ? 'Submitting...' : 'Submit Claim'}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      )}

      {/* MODAL 2: EDIT NOMINEE */}
      {isEditingNominee && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(3px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <Card padding="lg" style={{ maxWidth: '380px', width: '100%', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
                Update Insurance Nominee
              </h3>
              <button type="button" onClick={() => setIsEditingNominee(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveNominee} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {nomineeError && (
                <div style={{ fontSize: '12px', color: 'var(--color-danger)', fontWeight: 600 }}>{nomineeError}</div>
              )}

              <div className="ss-form-group">
                <label className="ss-label">Nominee Full Name:</label>
                <input
                  type="text"
                  required
                  className="ss-input"
                  placeholder="e.g. Ananya Kumar"
                  value={nomineeName}
                  onChange={(e) => setNomineeName(e.target.value)}
                />
              </div>

              <div className="ss-form-group">
                <label className="ss-label">Relationship to Worker:</label>
                <select
                  className="ss-input"
                  value={nomineeRelation}
                  onChange={(e) => setNomineeRelation(e.target.value)}
                >
                  <option value="Spouse">Spouse</option>
                  <option value="Parent">Parent</option>
                  <option value="Child">Child</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Family">Other Family Member</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-xs)', marginTop: 8 }}>
                <Button type="button" variant="outline" fullWidth onClick={() => setIsEditingNominee(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" fullWidth disabled={nomineeSaving}>
                  {nomineeSaving ? 'Saving...' : 'Save Nominee'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 3: GOVERNMENT SCHEME DETAILS */}
      {selectedScheme && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(3px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <Card padding="lg" style={{ maxWidth: '440px', width: '100%', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-sm)' }}>
              <div>
                <Badge variant="active" style={{ fontSize: '10px' }}>{selectedScheme.tag}</Badge>
                <h3 style={{ fontSize: '17px', fontWeight: 'bold', margin: '4px 0 0' }}>
                  {selectedScheme.name}
                </h3>
              </div>
              <button type="button" onClick={() => setSelectedScheme(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', margin: 'var(--space-md) 0' }}>
              <div>
                <strong style={{ display: 'block', color: 'var(--color-black)' }}>Scheme Benefits:</strong>
                <p style={{ margin: '2px 0 0', color: 'var(--color-text-secondary)' }}>{selectedScheme.details}</p>
              </div>

              <div>
                <strong style={{ display: 'block', color: 'var(--color-black)' }}>Eligibility:</strong>
                <p style={{ margin: '2px 0 0', color: 'var(--color-text-secondary)' }}>{selectedScheme.eligibility}</p>
              </div>

              <div>
                <strong style={{ display: 'block', color: 'var(--color-black)' }}>Documents Required:</strong>
                <p style={{ margin: '2px 0 0', color: 'var(--color-text-secondary)' }}>{selectedScheme.documents}</p>
              </div>
            </div>

            <div style={{ background: '#F0FDF4', border: '1px solid #22C55E', borderRadius: 'var(--radius-sm)', padding: '10px', fontSize: '12px', color: '#15803D' }}>
              Cooperative officers assist with documentation and filing free of charge at Ward 4 Society Office.
            </div>

            <div style={{ marginTop: 'var(--space-md)' }}>
              <Button variant="primary" fullWidth onClick={() => setSelectedScheme(null)}>
                Got It
              </Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
};

export default WorkerWelfare;
