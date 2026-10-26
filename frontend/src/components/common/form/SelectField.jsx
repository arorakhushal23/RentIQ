import FormError from './FormError';
import './FormFields.css';

function SelectField({
    label,
    name,
    id,
    value,
    onChange,
    onBlur,
    options = [],
    placeholder,
    required = false,
    disabled = false,
    error,
    helperText,
    className = '',
    children,
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

            <div className="form-input-wrapper form-select-wrapper">
                <select
                    id={fieldId}
                    name={name}
                    value={value ?? ''}
                    onChange={onChange}
                    onBlur={onBlur}
                    required={required}
                    disabled={disabled}
                    aria-required={required}
                    aria-invalid={Boolean(error)}
                    aria-describedby={describedBy}
                    className={`form-field-select ${error ? 'input-error' : ''}`}
                    {...restProps}
                >
                    {placeholder && (
                        <option value="" disabled>
                            {placeholder}
                        </option>
                    )}
                    {options && options.length > 0
                        ? options.map((opt) => {
                            if (typeof opt === 'string') {
                                return (
                                    <option key={opt} value={opt}>
                                        {opt}
                                    </option>
                                );
                            }
                            return (
                                <option
                                    key={opt.value}
                                    value={opt.value}
                                    disabled={opt.disabled}
                                >
                                    {opt.label || opt.name || opt.value}
                                </option>
                            );
                        })
                        : children}
                </select>
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

export default SelectField;
