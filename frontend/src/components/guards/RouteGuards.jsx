import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/useAuth.js';
import Spinner from '../ui/Spinner.jsx';

/**
 * RequireAuth – redirects to /login if not authenticated.
 * Saves the intended destination in state so login can redirect back.
 */
export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner fullPage />;
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

/**
 * RequireRole – redirects signed-out users and denies authenticated users
 * whose role is not in allowedRoles.
 * @param {string[]} allowedRoles
 */
export function RequireRole({ allowedRoles, children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (!allowedRoles.includes(user.role)) {
    return <NoAccessPage />;
  }
  return children;
}

/** Shown when a user hits a route they don't have the role for. */
function NoAccessPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '1rem',
      textAlign: 'center',
      padding: '2rem',
    }}>
      <h1 style={{ fontSize: '1.75rem', color: 'var(--ink)' }}>Access denied</h1>
      <p style={{ color: 'var(--muted)', maxWidth: '40ch' }}>
        You do not have permission to view this page. If you believe this is an
        error, contact your system administrator.
      </p>
      <a href="/" style={{ color: 'var(--accent)' }}>Return to home</a>
    </div>
  );
}
