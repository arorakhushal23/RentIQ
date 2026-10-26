import { useEffect, useRef } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

/**
 * AdminRoute Guard
 *
 * Protects administrative routes on the client side:
 * 1. Unauthenticated users (guests) are redirected to /login with state.from preserved.
 * 2. Authenticated non-admin users (customers) are redirected to / (home) with an access denied alert.
 * 3. Authenticated administrators (user.role === 'admin') are granted access.
 */
function AdminRoute({ children }) {
    const { user, isLoggedIn } = useAuth();
    const location = useLocation();
    const { showToast } = useToast();
    const alertSentRef = useRef(false);

    useEffect(() => {
        if (isLoggedIn && user && user.role !== 'admin' && !alertSentRef.current) {
            alertSentRef.current = true;
            showToast('Access denied: Administrator privileges required', 'error');
        }
    }, [isLoggedIn, user, showToast]);

    // 1. If not authenticated, redirect to login while preserving the attempted destination
    if (!isLoggedIn || !user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 2. If authenticated but role is not admin, redirect to customer home
    if (user.role !== 'admin') {
        return <Navigate to="/" replace />;
    }

    // 3. Authorized administrator: render nested route or child components
    return children ? children : <Outlet />;
}

export default AdminRoute;
