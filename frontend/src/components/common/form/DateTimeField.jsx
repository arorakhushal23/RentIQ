import FormError from './FormError';
import './FormFields.css';

function DateTimeField({
    label,
    name,
    id,
    type = 'date', // 'date' | 'time' | 'datetime-local'
    value,
    onChange,
    onBlur,
    min,
    max,
    step,
    required = false,
    disabled = false,
    error,
    helperText,
    className = '',
    ...restProps
}) {
    const fieldId = id || (name ? `field-${name}` : undefined);
    const errorId = error && fieldId ? `${fieldId}-error` : undefined;
    const helperId = helperText && fieldId ? `${fieldId}-helper` : undefined;

    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

    return (
        <div className={`form-field-group ${error ? 'has-error' : ''} ${disabled ? 'is-disabled' : ''} ${className}`.trim()}>
            {label && (
                <label htmlFor={fieldId} className="form-field-label">
                    <span>{label}</span>
                    {required && (
                        <span className="form-required-marker" aria-hidden="true" title="Required">
                            *
                        </span>
                    )}
                </label>
            )}

            <div className="form-input-wrapper form-datetime-wrapper">
                <input
                    id={fieldId}
                    name={name}
                    type={type}
                    value={value ?? ''}
                    onChange={onChange}
                    onBlur={onBlur}
                    min={min}
                    max={max}
                    step={step}
                    required={required}
                    disabled={disabled}
                    aria-required={required}
                    aria-invalid={Boolean(error)}
                    aria-describedby={describedBy}
                    className={`form-field-input form-field-datetime ${error ? 'input-error' : ''}`}
                    {...restProps}
                />
            </div>

            {helperText && !error && (
                <p id={helperId} className="form-field-helper">
                    {helperText}
                </p>
            )}

            {error && (
                <FormError id={errorId} message={error} />
            )}
        </div>
    );
}

export default DateTimeField;
