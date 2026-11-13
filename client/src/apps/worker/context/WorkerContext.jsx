import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { workersAPI, authAPI } from '../../../api';

const WorkerContext = createContext();

export const WorkerProvider = ({ children }) => {
  const { currentUser, getRoleSession } = useAuth();
  const workerSession = getRoleSession('worker') || (currentUser?.role === 'worker' ? currentUser : null);

  // False until the real DB record has been fetched (or the fetch has
  // failed) at least once — gates the profile-completion route redirect in
  // WorkerShell so it can't fire against the default `isProfileComplete:
  // false` seed before we actually know the worker's real state.
  const [profileLoaded, setProfileLoaded] = useState(false);
  // True whenever the last attempt to fetch the real worker record failed
  // (network hiccup, server restart mid-request, etc). WorkerShell uses this
  // to fail OPEN rather than closed: a worker who is actually
  // isProfileComplete:true in the database must never get stuck being
  // redirected to /worker/profile just because one fetch attempt failed —
  // that's a client-side gate for UX, not a security boundary (the backend
  // independently enforces anything that actually matters).
  const [profileFetchFailed, setProfileFetchFailed] = useState(false);

  const emptyPaymentDetails = () => ({
    payoutType: 'upi',
    upiId: '',
    bankAccount: { accountNumber: '', ifsc: '', bankName: '' },
    verificationStatus: 'unverified'
  });
  const emptyHealthInsurance = () => ({ active: false, policyNumber: '', coverageAmount: 500000, provider: '', issuedAt: null });
  const emptyAccidentCoverage = () => ({ active: false, policyNumber: '', coverageAmount: 500000, provider: '', issuedAt: null, nominee: { name: '', relation: '', payout: '' } });

  const [worker, setWorker] = useState(() => {
    if (workerSession) {
      return {
        workerId: workerSession.userId,
        name: workerSession.name || 'Worker Member',
        phone: workerSession.phone || '',
        email: workerSession.email || '',
        address: workerSession.locality || 'Ward 4, Adyar, Chennai',
        locality: workerSession.locality || 'Ward 4, Adyar, Chennai',
        serviceRadius: null,
        languages: [],
        weeklyAvailability: null,
        isProfileComplete: false,
        skill: workerSession.skill || 'General Services',
        skills: workerSession.skills || [workerSession.skill || 'General Services'],
        experience: workerSession.experience || '3 years',
        idDocument: workerSession.idDocument || null,
        certDocument: workerSession.certDocument || null,
        paymentDetails: workerSession.paymentDetails || emptyPaymentDetails(),
        welfareFundBalance: workerSession.welfareFundBalance || 0,
        healthInsurance: workerSession.healthInsurance || emptyHealthInsurance(),
        accidentCoverage: workerSession.accidentCoverage || emptyAccidentCoverage(),
        isRegistered: true,
        status: workerSession.status || 'Pending',
        verificationStatus: 'unsubmitted',
        rejectionReason: '',
        documents: [],
        isOnline: workerSession.status === 'Verified' && Boolean(workerSession.isOnline),
        avatar: workerSession.avatar || 'W',
        completedJobs: 0,
        rating: 5.0
      };
    }
    return {
      workerId: '',
      phone: '',
      name: '',
      address: '',
      locality: 'Ward 4, Chennai',
      serviceRadius: null,
      languages: [],
      weeklyAvailability: null,
      isProfileComplete: false,
      skill: '',
      skills: [],
      experience: '',
      paymentDetails: emptyPaymentDetails(),
      welfareFundBalance: 0,
      healthInsurance: emptyHealthInsurance(),
      accidentCoverage: emptyAccidentCoverage(),
      isRegistered: false,
      status: 'Pending',
      verificationStatus: 'unsubmitted',
      rejectionReason: '',
      documents: [],
      isOnline: false,
      avatar: 'W',
      completedJobs: 0,
      rating: 0
    };
  });

  // Sync worker state whenever a new/different worker logs in
  const syncWorkerFromAuthAndDB = useCallback(async () => {
    if (!workerSession) return;

    const baseData = {
      workerId: workerSession.userId,
      name: workerSession.name || 'Worker Member',
      phone: workerSession.phone || '',
      email: workerSession.email || '',
      address: workerSession.locality || 'Ward 4, Adyar, Chennai',
      locality: workerSession.locality || 'Ward 4, Adyar, Chennai',
      serviceRadius: null,
      languages: [],
      weeklyAvailability: null,
      isProfileComplete: false,
      skill: workerSession.skill || 'General Services',
      skills: workerSession.skills || [workerSession.skill || 'General Services'],
      experience: workerSession.experience || '3 years',
      paymentDetails: emptyPaymentDetails(),
      welfareFundBalance: 0,
      healthInsurance: emptyHealthInsurance(),
      accidentCoverage: emptyAccidentCoverage(),
      isRegistered: true,
      status: workerSession.status || 'Pending',
      verificationStatus: 'unsubmitted',
      rejectionReason: '',
      documents: [],
      isOnline: workerSession.status === 'Verified' && Boolean(workerSession.isOnline),
      avatar: workerSession.avatar || 'W',
      completedJobs: 0,
      rating: 5.0
    };

    setWorker(prev => ({ ...prev, ...baseData }));

    // Fetch the real worker record from MongoDB — this is the only source
    // of truth for verificationStatus/documents/rejectionReason. The admin
    // review pipeline (server/services/worker.service.js reviewVerification)
    // is what actually sets these fields; nothing on the client can.
    try {
      const res = await workersAPI.getById(workerSession.userId);
      if (res.success && res.data) {
        setWorker(prev => ({
          ...prev,
          ...res.data,
          workerId: res.data.workerId || workerSession.userId,
          name: res.data.name || workerSession.name,
          phone: res.data.phone || workerSession.phone,
          skill: res.data.skill || workerSession.skill,
          skills: res.data.skills || [res.data.skill],
          avatar: res.data.avatar || workerSession.avatar,
          status: res.data.status || 'Pending',
          verificationStatus: res.data.verificationStatus || 'unsubmitted',
          rejectionReason: res.data.rejectionReason || '',
          documents: res.data.documents || [],
          languages: res.data.languages || [],
          serviceRadius: res.data.serviceRadius ?? null,
          weeklyAvailability: res.data.weeklyAvailability || null,
          isProfileComplete: Boolean(res.data.isProfileComplete),
          isOnline: res.data.status === 'Verified' && Boolean(res.data.isOnline)
        }));
        setProfileFetchFailed(false);
      }
    } catch {
      // Fall back to base session data — and flag the failure so the
      // profile-completion gate in WorkerShell doesn't treat this unknown
      // state as a confirmed "profile incomplete".
      setProfileFetchFailed(true);
    } finally {
      setProfileLoaded(true);
    }
  }, [workerSession]);

  useEffect(() => {
    if (!workerSession) {
      setProfileLoaded(true);
      return;
    }
    syncWorkerFromAuthAndDB();
  }, [workerSession, syncWorkerFromAuthAndDB]);

  // Resolves to { success, error, message } rather than throwing — most
  // callers (toggleAvailability, etc.) fire this without awaiting, so a
  // rejection would surface as an unhandled promise rejection for them.
  // Callers that do care about the outcome (SkillProfile's save, the online
  // toggle) check the return value and/or show `message` as a toast.
  const updateWorker = async (fields) => {
    const previous = worker;
    setWorker((prev) => ({ ...prev, ...fields }));

    if (worker.workerId) {
      try {
        const res = await workersAPI.patch(worker.workerId, fields);
        // The server recomputes isProfileComplete server-side (and may
        // reject/strip other fields) — reconcile local state with what
        // actually got persisted instead of trusting the optimistic set above.
        if (res?.success && res.data) {
          setWorker((prev) => ({ ...prev, ...res.data }));
        }
        return { success: true };
      } catch (e) {
        // The server rejected this update (e.g. an unverified worker trying
        // to go online) — the optimistic set above never actually took
        // effect in the database, so roll the UI back to match reality
        // instead of showing a status that isn't real.
        setWorker(previous);
        const message = e.response?.data?.message || e.message;
        console.warn('Could not persist worker updates to MongoDB:', message);
        return { success: false, error: e, message };
      }
    }
    return { success: true };
  };

  const completeRegistration = (data = {}) => {
    setWorker((prev) => ({
      ...prev,
      ...data,
      isRegistered: true,
      // Registration alone doesn't submit any documents — verificationStatus
      // only moves to 'pending' once the worker actually uploads something
      // (see VerificationStatus.jsx / workersAPI.uploadDocuments).
      verificationStatus: 'unsubmitted'
    }));
  };

  // Returns the updateWorker result so callers can show a toast when the
  // backend rejects the toggle (e.g. "Only verified workers can go online.").
  const toggleAvailability = () => {
    const nextOnline = !worker.isOnline;
    return updateWorker({ isOnline: nextOnline });
  };

  const resetWorker = () => {
    setWorker({});
  };

  return (
    <WorkerContext.Provider
      value={{
        worker,
        profileLoaded,
        profileFetchFailed,
        updateWorker,
        completeRegistration,
        toggleAvailability,
        resetWorker,
        syncWorkerFromAuthAndDB
      }}
    >
      {children}
    </WorkerContext.Provider>
  );
};

export const useWorker = () => {
  const context = useContext(WorkerContext);
  if (!context) {
    throw new Error('useWorker must be used within WorkerProvider');
  }
  return context;
};

export default WorkerContext;
