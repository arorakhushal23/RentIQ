import FormError from './FormError';
import './FormFields.css';

function InputField({
    label,
    name,
    id,
    type = 'text',
    value,
    onChange,
    onBlur,
    placeholder,
    required = false,
    disabled = false,
    error,
    helperText,
    className = '',
    autoComplete,
    min,
    max,
    step,
    maxLength,
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

            <div className="form-input-wrapper">
                <input
                    id={fieldId}
                    name={name}
                    type={type}
                    value={value ?? ''}
                    onChange={onChange}
                    onBlur={onBlur}
                    placeholder={placeholder}
                    required={required}
                    disabled={disabled}
                    autoComplete={autoComplete}
                    min={min}
                    max={max}
                    step={step}
                    maxLength={maxLength}
                    aria-required={required}
                    aria-invalid={Boolean(error)}
                    aria-describedby={describedBy}
                    className={`form-field-input ${error ? 'input-error' : ''}`}
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

export default InputField;
