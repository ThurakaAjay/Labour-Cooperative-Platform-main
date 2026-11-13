import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Building2,
  UploadCloud,
  ArrowRight,
  X,
  FileText,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Button, Card, Badge } from '../../../components';
import { useWorker } from '../context/WorkerContext';
import { workersAPI } from '../../../api';

const DOC_TYPES = [
  { id: 'id_proof', label: 'Government Identity (Aadhaar / Voter ID)' },
  { id: 'certificate', label: 'Skill & Trade Certificate (ITI / Diploma)' },
  { id: 'other', label: 'Other Supporting Document' }
];

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILES = 5;

export const VerificationStatus = () => {
  const navigate = useNavigate();
  const { worker, syncWorkerFromAuthAndDB } = useWorker();

  const [docType, setDocType] = useState('id_proof');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const verificationStatus = worker.verificationStatus || 'unsubmitted';
  const isVerified = verificationStatus === 'verified';
  const isPending = verificationStatus === 'pending';
  const isRejected = verificationStatus === 'rejected';

  const handleSelectFiles = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    setUploadError('');
    setUploadSuccess(false);

    const rejected = files.filter((f) => !ACCEPTED_TYPES.includes(f.type));
    if (rejected.length > 0) {
      setUploadError('Only PDF, JPG, or PNG files are allowed.');
      return;
    }

    setSelectedFiles((prev) => {
      const combined = [...prev, ...files];
      if (combined.length > MAX_FILES) {
        setUploadError(`You can attach up to ${MAX_FILES} documents at a time.`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
  };

  const handleRemoveFile = (idx) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setUploadError('Please attach at least one document.');
      return;
    }

    setUploading(true);
    setUploadError('');
    try {
      await workersAPI.uploadDocuments(worker.workerId, selectedFiles, docType);
      setSelectedFiles([]);
      setUploadSuccess(true);
      await syncWorkerFromAuthAndDB();
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Could not upload documents. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingBottom: 'var(--space-xl)' }}>

      {/* 1. TOP HEADER */}
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: '0 0 2px' }}>
          Verification Status
        </h1>
        <p className="text-secondary" style={{ fontSize: '13px', margin: 0 }}>
          Official trade registration with Chennai Labour Cooperative Society
        </p>
      </div>

      {/* 2. STATUS BANNER */}
      <Card padding="md" style={{
        border: `1.5px solid ${isVerified ? '#22C55E' : isRejected ? 'var(--color-danger)' : 'var(--color-accent)'}`,
        background: isVerified ? '#F9FFF9' : isRejected ? '#FFF0ED' : '#FFFDF9'
      }}>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: isVerified ? 'var(--color-success-bg)' : isRejected ? 'var(--color-danger-bg)' : 'var(--color-accent-subtle)',
            color: isVerified ? 'var(--color-success)' : isRejected ? 'var(--color-danger)' : 'var(--color-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {isVerified ? <ShieldCheck size={24} /> : isRejected ? <ShieldAlert size={24} /> : <Clock size={24} />}
          </div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
              {isVerified && 'Verified Cooperative Worker'}
              {isPending && 'Documents Under Review'}
              {isRejected && 'Documents Rejected — Resubmission Needed'}
              {verificationStatus === 'unsubmitted' && 'No Documents Submitted Yet'}
            </div>
            <div className="text-secondary" style={{ fontSize: '12px', marginTop: 2 }}>
              {isVerified && 'Your cooperative office has approved your credentials.'}
              {isPending && 'Your cooperative office is reviewing this. This usually takes 1-2 days.'}
              {isRejected && (worker.rejectionReason || 'Please review the reason below and re-upload.')}
              {verificationStatus === 'unsubmitted' && 'Upload your identity and trade credentials below to begin the review.'}
            </div>
          </div>
        </div>
      </Card>

      {/* 3. UPLOAD FORM — shown whenever a submission is needed or allowed (not yet verified) */}
      {!isVerified && (
        <Card padding="md">
          <h2 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: 'var(--space-sm)' }}>
            {isRejected ? 'Re-upload Documents' : 'Upload Verification Documents'}
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            <div>
              <label className="ss-label" style={{ display: 'block', marginBottom: 4, fontSize: '12px', fontWeight: 600 }}>
                Document Type
              </label>
              <select
                className="ss-input"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                style={{ width: '100%' }}
                disabled={uploading}
              >
                {DOC_TYPES.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{
                background: 'var(--color-bg)',
                border: '1px dashed var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px',
                width: '100%',
                cursor: uploading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontSize: '13px',
                fontWeight: 600
              }}>
                <UploadCloud size={18} />
                <span>Attach PDF, JPG, or PNG (up to {MAX_FILES} files)</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  multiple
                  hidden
                  disabled={uploading}
                  onChange={handleSelectFiles}
                />
              </label>

              {selectedFiles.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {selectedFiles.map((f, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 10px',
                      fontSize: '12px'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <FileText size={14} />
                        {f.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        disabled={uploading}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
                        aria-label={`Remove ${f.name}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {uploadError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-danger)', fontSize: '12px', fontWeight: 600 }}>
                <AlertCircle size={14} />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-success)', fontSize: '12px', fontWeight: 600 }}>
                <CheckCircle2 size={14} />
                <span>Documents submitted. Your cooperative office will review them shortly.</span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              fullWidth
              icon={uploading ? Loader2 : UploadCloud}
              disabled={uploading || selectedFiles.length === 0}
            >
              {uploading ? 'Uploading...' : 'Submit for Verification'}
            </Button>
          </form>
        </Card>
      )}

      {/* 4. ALREADY-SUBMITTED DOCUMENTS */}
      {worker.documents?.length > 0 && (
        <Card padding="md">
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: 'var(--space-sm)' }}>
            Submitted Documents ({worker.documents.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {worker.documents.map((doc, idx) => (
              <a
                key={doc.publicId || idx}
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  background: 'var(--color-bg)',
                  textDecoration: 'none',
                  color: 'var(--color-black)'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px' }}>
                  <FileText size={16} />
                  <span>{doc.name}</span>
                </span>
                <Badge variant="active" style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                  {doc.format || 'file'}
                </Badge>
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* 5. IF VERIFIED: CERTIFICATE CARD */}
      {isVerified && (
        <div style={{
          background: 'linear-gradient(135deg, #FFFFFF 0%, #F9FFF9 100%)',
          border: '2px solid #22C55E',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)',
          boxShadow: '0 8px 24px rgba(34, 197, 94, 0.12)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            right: '-20px',
            bottom: '-20px',
            opacity: 0.05,
            fontSize: '140px',
            fontWeight: 'bold',
            pointerEvents: 'none',
            userSelect: 'none'
          }}>
            स
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--color-success-bg)',
                color: 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ShieldCheck size={30} strokeWidth={2.5} />
              </div>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  OFFICIAL COOPERATIVE ACCREDITATION
                </span>
                <h2 style={{ fontSize: '19px', fontWeight: 'bold', margin: '2px 0 0', color: 'var(--color-black)' }}>
                  ✓ Verified Cooperative Worker
                </h2>
              </div>
            </div>

            <Badge variant="success" style={{ padding: '3px 8px' }}>
              ACTIVE
            </Badge>
          </div>

          <div style={{
            background: 'var(--color-white)',
            border: '1px solid #E0E0E0',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '13px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-secondary">Accredited Member:</span>
              <span className="text-bold">{worker.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-secondary">Trade Category:</span>
              <span className="text-bold">{worker.skills?.[0] || worker.skill}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-secondary">Cooperative Society ID:</span>
              <span className="text-bold">{worker.societyReg || 'Chennai Labour Cooperative'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-secondary">Ward / Locality:</span>
              <span className="text-bold">{worker.locality}</span>
            </div>
          </div>

          <Button
            variant="primary"
            fullWidth
            icon={ArrowRight}
            iconPosition="right"
            onClick={() => navigate('/worker')}
          >
            Open Live Job Dashboard
          </Button>
        </div>
      )}

      {/* 6. COOPERATIVE LOCAL OFFICE DETAILS */}
      <Card padding="md">
        <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Building2 size={22} color="var(--color-black)" />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
              Chennai Labour Cooperative Society
            </div>
            <div className="text-secondary" style={{ fontSize: '12px' }}>
              Ward 4 Community Centre, 1st Cross Street, Adyar, Chennai - 600020
            </div>
          </div>
        </div>
      </Card>

    </div>
  );
};

export default VerificationStatus;
