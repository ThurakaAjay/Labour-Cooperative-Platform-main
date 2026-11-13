import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// The "active role" flag in localStorage is shared across every tab of this
// origin. With two tabs open (e.g. admin panel in one, worker job-request in
// another), switching role in one tab silently changes which token the OTHER
// tab sends on its next request too — attaching the wrong account's JWT to
// an action the visible page never asked for. The URL of the tab actually
// making the request is tab-local, so prefer that as the source of truth
// for which role's session to send whenever the current page is clearly
// role-scoped.
const getRoleFromPath = () => {
  const path = window.location.pathname;
  if (/^\/worker(\/|$)/i.test(path)) return 'worker';
  if (/^\/(customer|cutomer)(\/|$)/i.test(path)) return 'customer';
  if (/^\/admin(\/|$)/i.test(path)) return 'admin';
  return null;
};

// Request Interceptor: Automatically attach JWT token from active role session in localStorage
apiClient.interceptors.request.use((config) => {
  try {
    const activeRole = getRoleFromPath() || localStorage.getItem('workhive_active_role') || localStorage.getItem('sahakari_seva_active_role') || 'customer';
    const rawSessions = localStorage.getItem('workhive_role_sessions') || localStorage.getItem('sahakari_seva_role_sessions');
    if (rawSessions) {
      const sessions = JSON.parse(rawSessions);
      // Only ever send the token for the role currently being viewed. Falling
      // back to "whichever other role's session happens to exist" silently
      // attaches the wrong account's credentials (e.g. an admin/customer
      // token on a worker-only action), which the backend correctly rejects
      // but with a confusing "Forbidden: not the assigned worker" message
      // that looks like a data bug instead of an auth/session one.
      const session = sessions[activeRole];
      if (session?.token) {
        config.headers.Authorization = `Bearer ${session.token}`;
      }
    }
  } catch (err) {
    // Ignore JSON parse errors from corrupted storage
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Minimal dependency-free toast for connectivity failures — these happen
// outside any component (an axios interceptor), so there's no React tree to
// raise them through. Reuses one DOM node instead of stacking a new banner
// per failed request when the user is offline and several calls fail at once.
let networkToastEl = null;
let networkToastTimer = null;
const showNetworkErrorToast = (message) => {
  if (typeof document === 'undefined') return;
  if (!networkToastEl) {
    networkToastEl = document.createElement('div');
    networkToastEl.setAttribute('role', 'alert');
    Object.assign(networkToastEl.style, {
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#1F2937',
      color: '#fff',
      padding: '10px 18px',
      borderRadius: '8px',
      fontSize: '13px',
      fontFamily: 'inherit',
      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
      zIndex: 99999,
      maxWidth: '90vw',
      textAlign: 'center'
    });
    document.body.appendChild(networkToastEl);
  }
  networkToastEl.textContent = message;
  networkToastEl.style.display = 'block';
  clearTimeout(networkToastTimer);
  networkToastTimer = setTimeout(() => {
    if (networkToastEl) networkToastEl.style.display = 'none';
  }, 4000);
};

// Response Interceptor: on a rejected authenticated request, clear the stale
// session for the active role and send the user back to log in rather than
// leaving the app silently failing every call with a dead token.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // No `error.response` means the request never reached the server —
    // offline, DNS failure, backend down, CORS rejection, etc. Surface it
    // once as a toast instead of letting every caller's .catch() (or a
    // missing one) fail silently.
    if (!error.response) {
      showNetworkErrorToast('Network error: could not reach the server. Please check your connection.');
    }

    const hadAuthHeader = Boolean(error.config?.headers?.Authorization);
    if (error.response?.status === 401 && hadAuthHeader) {
      try {
        const activeRole = getRoleFromPath() || localStorage.getItem('workhive_active_role') || localStorage.getItem('sahakari_seva_active_role') || 'customer';
        const rawSessions = localStorage.getItem('workhive_role_sessions');
        if (rawSessions) {
          const sessions = JSON.parse(rawSessions);
          delete sessions[activeRole];
          localStorage.setItem('workhive_role_sessions', JSON.stringify(sessions));
        }
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = `/login?role=${activeRole}&expired=true`;
        }
      } catch (err) {
        // Ignore storage errors; the request rejection still propagates below.
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
