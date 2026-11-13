import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Star,
  CheckCircle2,
  Calendar,
  Globe,
  ThumbsUp,
  FileCheck2,
  Building2,
  Loader2,
  Eye,
  X
} from 'lucide-react';
import Button from './Button';
import Card from './Card';
import StarRating from './StarRating';
import EmptyState from './EmptyState';
import { workersAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useWorker } from '../apps/worker/context/WorkerContext';

// Matches the day keys the backend stores weeklyAvailability under
// (server/models/Worker.js) — the profile table below still wants short
// display labels.
const DAY_KEYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' }
];

// The public worker profile — used from two places:
//   - /customer/worker/:workerId (a customer browsing/booking a worker)
//   - /worker/profile/preview    (a worker previewing their own public page,
//     no :workerId in the URL — falls back to their own id from WorkerContext)
// Booking is hidden whenever the viewer IS the worker being viewed, which is
// what actually makes this a "preview" rather than a route-based flag: a
// worker who somehow lands on /customer/worker/:their-own-id sees the same
// disabled state as the dedicated preview route.
export const WorkerPublicProfile = () => {
  const { workerId: routeWorkerId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { worker: ownWorker } = useWorker();

  const targetWorkerId = routeWorkerId || ownWorker.workerId;
  const isOwnProfile = Boolean(
    currentUser?.role === 'worker' &&
    targetWorkerId &&
    (targetWorkerId === ownWorker.workerId || targetWorkerId === currentUser.userId)
  );

  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchWorkerData = async () => {
      if (!targetWorkerId) {
        setLoading(false);
        setError('No worker ID provided');
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await workersAPI.getById(targetWorkerId);
        if (res.success && res.data) {
          const w = res.data;
          setWorker({
            id: w.workerId || w._id,
            name: w.name,
            skill: w.skill,
            avatar: w.avatar || 'WK',
            coopName: 'Chennai Labour Cooperative — Ward 4',
            rating: w.rating || 5.0,
            reviewsCount: w.reviewsCount || 0,
            completedJobs: w.completedJobs || 0,
            experience: w.experience || 'Experienced',
            baseRate: w.priceEstimate || '₹450 fixed visit fee',
            verificationStatus: w.verificationStatus || 'unsubmitted',
            skills: w.skills?.length ? w.skills : [w.skill],
            languages: w.languages?.length ? w.languages : [],
            weeklyAvailability: DAY_KEYS.map(({ key, label }) => {
              const day = w.weeklyAvailability?.[key];
              return { day: label, morning: Boolean(day?.morning), afternoon: Boolean(day?.afternoon), evening: Boolean(day?.evening) };
            }),
            reviews: Array.isArray(w.reviews) ? w.reviews : []
          });
        }
      } catch (err) {
        console.error('Error fetching worker profile:', err);
        setError('Worker not found.');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkerData();
  }, [targetWorkerId]);

  const handleBook = () => {
    if (worker) {
      navigate(`/customer/book/${worker.id}`);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-xl) 0', textAlign: 'center' }}>
        <Loader2 size={32} className="animate-spin" color="var(--color-accent)" style={{ margin: '0 auto var(--space-sm)' }} />
        <p className="text-secondary" style={{ fontSize: '14px' }}>Loading verified worker profile from MongoDB...</p>
      </div>
    );
  }

  if (!worker) {
    return (
      <EmptyState
        title="Worker Not Found"
        message="The requested worker profile could not be found in the database."
        actionLabel="Back to Search"
        onAction={() => navigate(isOwnProfile ? '/worker/profile' : '/customer/search')}
      />
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-md)',
      paddingBottom: isOwnProfile ? 'var(--space-xl)' : '100px', // extra space only for the sticky booking bar
      position: 'relative'
    }}>

      {/* PREVIEW MODE BANNER — only when the viewer is looking at their own profile */}
      {isOwnProfile && (
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 90,
          background: '#1F2937',
          color: 'white',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-sm)',
          fontSize: '12px',
          fontWeight: 600
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Eye size={16} />
            <span>Preview Mode: This is how customers see your profile. Booking actions are disabled.</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/worker/profile')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'white',
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <X size={12} />
            Exit Preview
          </button>
        </div>
      )}

      {/* TOP HEADER WITH BACK BUTTON */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 38,
            height: 38,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-white)',
            cursor: 'pointer'
          }}
          aria-label="Go Back"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold' }}>Worker Profile</h1>
          <p className="text-secondary" style={{ fontSize: '12px' }}>
            Verified Cooperative Partner
          </p>
        </div>
      </div>

      {/* HERO PROFILE CARD */}
      <Card padding="lg">
        <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
          <div style={{
            width: 76,
            height: 76,
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-black)',
            color: 'var(--color-white)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            fontWeight: 'bold',
            flexShrink: 0,
            border: '2px solid var(--color-border)'
          }}>
            {worker.avatar}
          </div>

          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: '0 0 2px' }}>
              {worker.name}
            </h2>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: 'var(--color-success)',
              fontSize: '13px',
              fontWeight: 600,
              background: 'var(--color-success-bg)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              margin: '2px 0 4px'
            }}>
              <CheckCircle2 size={15} />
              <span>✓ Verified Cooperative Worker</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              <Building2 size={13} color="var(--color-accent)" />
              <span>{worker.coopName}</span>
            </div>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--space-xs)',
          background: 'var(--color-bg)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 8px',
          margin: 'var(--space-md) 0 0',
          textAlign: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, fontSize: '17px', fontWeight: 'bold' }}>
              <Star size={16} fill="var(--color-accent)" color="var(--color-accent)" />
              <span>{worker.rating}</span>
            </div>
            <div className="text-secondary" style={{ fontSize: '11px', marginTop: 2 }}>{worker.reviewsCount} reviews</div>
          </div>

          <div style={{ borderLeft: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '17px', fontWeight: 'bold' }}>
              {worker.completedJobs}
            </div>
            <div className="text-secondary" style={{ fontSize: '11px', marginTop: 2 }}>Jobs completed</div>
          </div>

          <div>
            <div style={{ fontSize: '17px', fontWeight: 'bold' }}>
              {worker.experience}
            </div>
            <div className="text-secondary" style={{ fontSize: '11px', marginTop: 2 }}>Experience</div>
          </div>
        </div>
      </Card>

      {/* SKILLS */}
      <Card padding="md">
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: 'var(--space-sm)' }}>
          Trade Skills & Specialties
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {worker.skills.map((skill, idx) => (
            <span
              key={idx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-black)'
              }}
            >
              {skill}
            </span>
          ))}
        </div>
      </Card>

      {/* VERIFIED CREDENTIALS — a fixed statement of what verification means,
          not per-document details (those are never exposed on the public
          profile endpoint, by design — see WorkerService.getWorkerById). */}
      {worker.verificationStatus === 'verified' && (
        <Card padding="md">
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: 'var(--space-sm)' }}>
            Verified Credentials & Safety Checks
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
            padding: '8px 12px',
            background: '#FAFAFA',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13px'
          }}>
            <FileCheck2 size={16} color="var(--color-success)" style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 600 }}>Identity, police background, and trade skill verified by the cooperative</span>
          </div>
        </Card>
      )}

      {/* LANGUAGES */}
      <Card padding="md">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-sm)' }}>
          <Globe size={16} color="var(--color-text-secondary)" />
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>Languages Spoken</h3>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {worker.languages.map((lang, idx) => (
            <span
              key={idx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 10px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                fontSize: '13px',
                fontWeight: 500
              }}
            >
              {lang}
            </span>
          ))}
        </div>
      </Card>

      {/* WEEKLY AVAILABILITY GRID */}
      <Card padding="md">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={16} color="var(--color-accent)" />
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>Weekly Availability</h3>
          </div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)' }} />
              <span>Open</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#CCCCCC' }} />
              <span>Off</span>
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'center' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                <th style={{ padding: '6px 4px', textAlign: 'left' }}>Time</th>
                {worker.weeklyAvailability.map((d) => (
                  <th key={d.day} style={{ padding: '6px 4px', fontWeight: 600 }}>{d.day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
                <td style={{ padding: '8px 4px', textAlign: 'left', fontWeight: 500 }}>9 AM - 1 PM</td>
                {worker.weeklyAvailability.map((d) => (
                  <td key={d.day} style={{ padding: '8px 4px' }}>
                    {d.morning ? <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>✓</span> : <span style={{ color: '#D0D0D0' }}>-</span>}
                  </td>
                ))}
              </tr>
              <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
                <td style={{ padding: '8px 4px', textAlign: 'left', fontWeight: 500 }}>1 PM - 5 PM</td>
                {worker.weeklyAvailability.map((d) => (
                  <td key={d.day} style={{ padding: '8px 4px' }}>
                    {d.afternoon ? <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>✓</span> : <span style={{ color: '#D0D0D0' }}>-</span>}
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: '8px 4px', textAlign: 'left', fontWeight: 500 }}>5 PM - 9 PM</td>
                {worker.weeklyAvailability.map((d) => (
                  <td key={d.day} style={{ padding: '8px 4px' }}>
                    {d.evening ? <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>✓</span> : <span style={{ color: '#D0D0D0' }}>-</span>}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* CUSTOMER REVIEWS */}
      <Card padding="md">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ThumbsUp size={16} color="var(--color-accent)" />
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>Neighbor Reviews ({worker.reviews.length})</h3>
          </div>
          <StarRating rating={worker.rating} showScore={false} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {worker.reviews.map((rev) => (
            <div key={rev.id} style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{rev.customerName}</span>
                  <span className="text-secondary" style={{ fontSize: '12px' }}>• {rev.locality}</span>
                </div>
                <span className="text-secondary" style={{ fontSize: '12px' }}>{rev.date}</span>
              </div>
              <div style={{ display: 'flex', gap: 2, margin: '2px 0 4px' }}>
                <StarRating rating={rev.rating} showScore={false} size={13} />
              </div>
              <p style={{ fontSize: '13px', color: '#444444', lineHeight: 1.4, margin: 0 }}>
                "{rev.comment}"
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* STICKY BOTTOM "BOOK THIS WORKER" BAR — never rendered when the
          viewer is the worker themselves; there is nothing for them to book. */}
      {!isOwnProfile && (
        <div style={{
          position: 'fixed',
          bottom: 64,
          left: 0,
          right: 0,
          zIndex: 80,
          display: 'flex',
          justifyContent: 'center',
          padding: '0 var(--space-md)',
          pointerEvents: 'none'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '440px',
            background: 'var(--color-white)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '10px var(--space-md)',
            boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-md)',
            pointerEvents: 'auto'
          }}>
            <div>
              <div className="text-secondary" style={{ fontSize: '11px', fontWeight: 600 }}>Standard Visit Fee</div>
              <div style={{ fontSize: '17px', fontWeight: 'bold', color: 'var(--color-black)' }}>
                {worker.baseRate}
              </div>
            </div>

            <Button
              variant="primary"
              size="default"
              icon={CheckCircle2}
              onClick={handleBook}
              style={{ flex: 1 }}
            >
              Book This Worker
            </Button>
          </div>
        </div>
      )}

    </div>
  );
};

export default WorkerPublicProfile;
