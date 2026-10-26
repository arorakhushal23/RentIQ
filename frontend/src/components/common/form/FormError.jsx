import { AlertCircle } from 'lucide-react';
import './FormFields.css';

function FormError({ id, message, error, className = '', role = 'alert' }) {
    const text = message || error;
    if (!text) return null;

    return (
        <div
            id={id}
            className={`form-field-error ${className}`.trim()}
            role={role}
            aria-live="polite"
        >
            <span className="form-error-icon" aria-hidden="true">
                <AlertCircle size={14} strokeWidth={2} />
            </span>
            <span className="form-error-text">{text}</span>
        </div>
    );
}

export default FormError;
