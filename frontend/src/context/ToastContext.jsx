import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import './ToastContext.css';

const ToastContext = createContext();

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'info', duration = 3000) => {
        const id = Date.now() + Math.random().toString(36).substring(2, 9);
        const newToast = { id, message, type };

        setToasts((prev) => [...prev, newToast]);

        if (duration > 0) {
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, duration);
        }

        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast, removeToast }}>
            {children}
            <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
                {toasts.map((toast) => (
                    <div key={toast.id} className={`toast-item toast-${toast.type}`}>
                        <div className="toast-icon" aria-hidden="true">
                            {toast.type === 'success' && <CheckCircle2 size={18} strokeWidth={2.5} />}
                            {toast.type === 'error' && <XCircle size={18} strokeWidth={2.5} />}
                            {toast.type === 'warning' && <AlertTriangle size={18} strokeWidth={2.5} />}
                            {toast.type === 'info' && <Info size={18} strokeWidth={2.5} />}
                        </div>
                        <span className="toast-message">{toast.message}</span>
                        <button
                            type="button"
                            className="toast-close"
                            onClick={() => removeToast(toast.id)}
                            aria-label="Dismiss notification"
                        >
                            &times;
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        return {
            showToast: (msg) => console.log('Toast:', msg),
            removeToast: () => {}
        };
    }
    return context;
}

export default ToastProvider;
