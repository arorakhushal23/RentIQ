import { useState, useRef, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import { DateTimeField, FormError } from '../common/form';
import BookingConfirmation from './BookingConfirmation';
import LocationPickerMap from '../map/LocationPickerMap';
import {
    formatLocalDate,
    formatLocalTime,
    parseDateTime,
    calculateRentalDuration,
    calculateRentalPrice,
    formatDisplayDateTime
} from '../../utils/bookingUtils';
import './BookingForm.css';

const STEPS = [
    { number: 1, title: 'Vehicle', subtitle: 'Confirm Selection' },
    { number: 2, title: 'Location', subtitle: 'Pickup & Drop' },
    { number: 3, title: 'Schedule', subtitle: 'Dates & Times' },
    { number: 4, title: 'Review', subtitle: 'Price Breakdown' },
    { number: 5, title: 'Confirm', subtitle: 'Reserve Vehicle' }
];

function BookingForm({
    vehicleId,
    vehicleName,
    pricePerDay,
    isAvailable
}) {
    const { user, isLoggedIn } = useAuth();
    const location = useLocation();

    // Step state: 1, 2, 3, 4, 5
    const [currentStep, setCurrentStep] = useState(1);

    // Initial date & times
    const now = useMemo(() => new Date(), []);
    const todayStr = useMemo(() => formatLocalDate(now), [now]);

    const initialPickupTime = useMemo(() => {
        const next = new Date(now.getTime() + 60 * 60 * 1000);
        return formatLocalTime(next);
    }, [now]);

    const initialReturnTime = useMemo(() => {
        const returnT = new Date(now.getTime() + 4 * 60 * 60 * 1000);
        return formatLocalTime(returnT);
    }, [now]);

    // Step 2 Form Data: Location & Delivery
    const [pickupAddress, setPickupAddress] = useState('RentIQ Central Hub, Sector 17, Chandigarh');
    const [pickupCoords, setPickupCoords] = useState({ lat: 30.7398, lng: 76.7827 });
    const [dropAddress, setDropAddress] = useState('RentIQ Central Hub, Sector 17, Chandigarh');
    const [dropCoords, setDropCoords] = useState({ lat: 30.7398, lng: 76.7827 });
    const [sameAsPickup, setSameAsPickup] = useState(true);

    const [routeInfo, setRouteInfo] = useState({
        route_distance_km: 0,
        estimated_travel_time: '0 mins',
        delivery_charge: 0,
        is_free_delivery: true
    });

    // Step 3 Form Data: Dates & Times
    const [pickupDate, setPickupDate] = useState(todayStr);
    const [returnDate, setReturnDate] = useState(todayStr);
    const [pickupTime, setPickupTime] = useState(initialPickupTime);
    const [returnTime, setReturnTime] = useState(initialReturnTime);

    // Step 5 Form Data: Terms check
    const [agreeToTerms, setAgreeToTerms] = useState(true);

    // Driving licence status
    const [licenseStatus, setLicenseStatus] = useState(null);
    const [licenceRedirect, setLicenceRedirect] = useState(null);

    // Phase 3: Add-on accessories & Smart Pricing Breakdown
    const [availableAddons, setAvailableAddons] = useState([]);
    const [selectedAddonIds, setSelectedAddonIds] = useState([]);
    const [smartPricing, setSmartPricing] = useState(null);
    const [pricingLoading, setPricingLoading] = useState(false);

    // Errors & state
    const [error, setError] = useState('');
    const [stepErrors, setStepErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [confirmedBooking, setConfirmedBooking] = useState(null);

    const isSubmittingRef = useRef(false);

    // Fetch active add-ons from pricing config
    useEffect(() => {
        let isMounted = true;
        axiosInstance.get('/pricing/config')
            .then(res => {
                if (isMounted && res.data?.availableAddons) {
                    setAvailableAddons(res.data.availableAddons);
                }
            })
            .catch(() => {});
        return () => { isMounted = false; };
    }, []);

    // Fetch user licence verification status on mount
    useEffect(() => {
        if (!isLoggedIn) {
            setLicenseStatus(null);
            return;
        }

        let isMounted = true;
        axiosInstance.get('/licenses/my-license')
            .then(res => {
                if (isMounted) {
                    setLicenseStatus(res.data?.status || 'not_submitted');
                }
            })
            .catch(() => {
                if (isMounted) setLicenseStatus('not_submitted');
            });

        return () => { isMounted = false; };
    }, [isLoggedIn]);

    // Recalculate route and delivery fee when coordinates change
    useEffect(() => {
        if (!pickupCoords?.lat || !pickupCoords?.lng) return;

        let isMounted = true;
        const targetDropLat = sameAsPickup ? pickupCoords.lat : dropCoords?.lat;
        const targetDropLng = sameAsPickup ? pickupCoords.lng : dropCoords?.lng;

        axiosInstance.post('/locations/calculate-route', {
            pickupLat: pickupCoords.lat,
            pickupLng: pickupCoords.lng,
            dropLat: targetDropLat,
            dropLng: targetDropLng
        }).then(res => {
            if (isMounted && res.data) {
                setRouteInfo(res.data);
            }
        }).catch(() => {
            // keep graceful default
        });

        return () => { isMounted = false; };
    }, [pickupCoords, dropCoords, sameAsPickup]);

    // Formatted ISO-style strings for duration calculation and backend payload
    const pickupDatetime = pickupDate && pickupTime ? `${pickupDate}T${pickupTime}` : '';
    const returnDatetime = returnDate && returnTime ? `${returnDate}T${returnTime}` : '';

    // Calculate duration live
    const durationInfo = useMemo(() => {
        if (!pickupDatetime || !returnDatetime) {
            return { totalMinutes: 0, durationHours: 0, display: '' };
        }
        return calculateRentalDuration(pickupDatetime, returnDatetime);
    }, [pickupDatetime, returnDatetime]);

    const isDurationValid = durationInfo.totalMinutes > 0;

    // Live Smart Pricing Calculation
    useEffect(() => {
        if (!vehicleId || !pickupDatetime || !returnDatetime) return;
        const pDate = new Date(pickupDatetime);
        const rDate = new Date(returnDatetime);
        if (isNaN(pDate.getTime()) || isNaN(rDate.getTime()) || rDate <= pDate) return;

        let isMounted = true;
        setPricingLoading(true);

        axiosInstance.post('/pricing/calculate', {
            vehicleId,
            pickupDatetime,
            returnDatetime,
            selectedAddons: selectedAddonIds,
            deliveryDistanceKm: routeInfo?.route_distance_km || 0
        }).then(res => {
            if (isMounted && res.data) {
                setSmartPricing(res.data);
            }
        }).catch(() => {
            // Keep graceful fallback to standard calculation
        }).finally(() => {
            if (isMounted) setPricingLoading(false);
        });

        return () => { isMounted = false; };
    }, [vehicleId, pickupDatetime, returnDatetime, selectedAddonIds, routeInfo?.route_distance_km]);

    // Price calculations: Smart authoritative price with fallback
    const baseRentalPrice = useMemo(() => {
        if (!isDurationValid) return 0;
        return calculateRentalPrice(pricePerDay, durationInfo.durationHours);
    }, [isDurationValid, pricePerDay, durationInfo.durationHours]);

    const deliveryFee = Number(routeInfo?.delivery_charge || 0);
    const finalTotalPrice = smartPricing?.finalTotal !== undefined
        ? smartPricing.finalTotal
        : Number((baseRentalPrice + deliveryFee).toFixed(2));

    const hourlyRate = (Number(pricePerDay) / 24).toFixed(2).replace(/\.00$/, '');

    const clearErrors = () => {
        setError('');
        setStepErrors({});
    };

    const handlePickupDateChange = (val) => {
        setPickupDate(val);
        clearErrors();
    };

    const handlePickupTimeChange = (val) => {
        setPickupTime(val);
        clearErrors();
    };

    const handleReturnDateChange = (val) => {
        setReturnDate(val);
        clearErrors();
    };

    const handleReturnTimeChange = (val) => {
        setReturnTime(val);
        clearErrors();
    };

    // Validation for Step 3: Schedule
    const validateSchedule = () => {
        const errors = {};

        if (!pickupDate) errors.pickupDate = 'Please select a pickup date.';
        if (!pickupTime) errors.pickupTime = 'Please select a pickup time.';
        if (!returnDate) errors.returnDate = 'Please select a return date.';
        if (!returnTime) errors.returnTime = 'Please select a return time.';

        if (Object.keys(errors).length > 0) {
            setStepErrors(errors);
            setError('Please complete all schedule fields.');
            return false;
        }

        const parsedPickup = parseDateTime(pickupDatetime);
        const parsedReturn = parseDateTime(returnDatetime);

        if (!parsedPickup || !parsedReturn) {
            setError('Please enter valid date and time values.');
            return false;
        }

        const currentTime = new Date();
        if (parsedPickup.date.getTime() < currentTime.getTime() - 60000) {
            errors.pickupDate = 'Pickup date and time cannot be in the past.';
            setStepErrors(errors);
            setError('Pickup date and time cannot be in the past.');
            return false;
        }

        if (parsedReturn.date.getTime() <= parsedPickup.date.getTime()) {
            errors.returnTime = 'Return datetime must be after pickup datetime.';
            setStepErrors(errors);
            setError('Return date and time must be strictly after pickup date and time.');
            return false;
        }

        return true;
    };

    const handleNextStep = () => {
        setError('');
        setStepErrors({});

        if (currentStep === 1) {
            if (!isAvailable) {
                setError('This vehicle is currently marked unavailable for reservations.');
                return;
            }
            setCurrentStep(2);
        } else if (currentStep === 2) {
            if (!pickupAddress) {
                setError('Please select or enter a valid pickup address.');
                return;
            }
            setCurrentStep(3);
        } else if (currentStep === 3) {
            if (!validateSchedule()) return;
            setCurrentStep(4);
        } else if (currentStep === 4) {
            if (!isDurationValid) {
                setError('Please adjust your dates and times to ensure a valid rental duration.');
                return;
            }
            setCurrentStep(5);
        }
    };

    const handlePrevStep = () => {
        setError('');
        setStepErrors({});
        if (currentStep > 1) {
            setCurrentStep((prev) => prev - 1);
        }
    };

    const handleStepJump = (targetStep) => {
        if (targetStep < currentStep) {
            setError('');
            setStepErrors({});
            setCurrentStep(targetStep);
        } else if (targetStep === 2 && currentStep === 1) {
            handleNextStep();
        } else if (targetStep === 3 && currentStep === 2) {
            setCurrentStep(3);
        } else if (targetStep === 4 && (currentStep === 2 || currentStep === 3)) {
            if (validateSchedule()) setCurrentStep(4);
        } else if (targetStep === 5 && currentStep < 5) {
            if (validateSchedule()) setCurrentStep(5);
        }
    };

    const handleBookAnother = () => {
        setConfirmedBooking(null);
        setCurrentStep(1);
        setPickupDate(todayStr);
        setReturnDate(todayStr);
        setPickupTime(initialPickupTime);
        setReturnTime(initialReturnTime);
        setAgreeToTerms(true);
        setError('');
        setStepErrors({});
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (isSubmittingRef.current) return;

        if (!isLoggedIn) {
            setError('Authentication required: Please log in to complete your booking.');
            return;
        }

        if (!agreeToTerms) {
            setError('Please accept the rental terms and agreement to proceed.');
            return;
        }

        if (!validateSchedule()) {
            setCurrentStep(3);
            return;
        }

        if (!isAvailable) {
            setError('This vehicle is currently unavailable for rental.');
            return;
        }

        isSubmittingRef.current = true;
        setIsSubmitting(true);
        setError('');

        try {
            const finalDropAddr = sameAsPickup ? pickupAddress : dropAddress;
            const finalDropLat = sameAsPickup ? pickupCoords?.lat : dropCoords?.lat;
            const finalDropLng = sameAsPickup ? pickupCoords?.lng : dropCoords?.lng;

            const response = await axiosInstance.post('/bookings', {
                vehicleId,
                pickupDatetime,
                returnDatetime,
                startDate: pickupDatetime,
                endDate: returnDatetime,
                selectedAddons: selectedAddonIds,
                pickupAddress,
                pickupLatitude: pickupCoords?.lat,
                pickupLongitude: pickupCoords?.lng,
                dropAddress: finalDropAddr,
                dropLatitude: finalDropLat,
                dropLongitude: finalDropLng
            });

            if (response.data && response.data.booking) {
                setConfirmedBooking(response.data.booking);
                setError('');
            } else {
                setError('Unexpected response received from the server.');
            }
        } catch (err) {
            console.error('Booking submission error:', err);
            const errData = err.response?.data;
            if (errData?.redirectUrl) {
                setLicenceRedirect({
                    message: errData.message,
                    redirectUrl: errData.redirectUrl
                });
            }
            setError(
                errData?.message ||
                'Unable to create booking. Please check availability and try again.'
            );
        } finally {
            isSubmittingRef.current = false;
            setIsSubmitting(false);
        }
    };

    if (confirmedBooking) {
        return (
            <BookingConfirmation
                booking={confirmedBooking}
                vehicleName={vehicleName}
                onBookAnother={handleBookAnother}
            />
        );
    }

    return (
        <section className="booking-form multi-step-booking" aria-labelledby="booking-heading">
            <header className="booking-header-area">
                <h2 id="booking-heading">Book This Vehicle</h2>
                <p className="booking-form-subtitle">
                    Configure your pickup & drop locations, schedule, review transparent pricing, and reserve.
                </p>
            </header>

            {/* STEP PROGRESS INDICATOR */}
            <nav className="booking-stepper" aria-label="Booking steps">
                <ol className="stepper-list">
                    {STEPS.map((s) => {
                        const isDone = s.number < currentStep;
                        const isCurrent = s.number === currentStep;

                        return (
                            <li
                                key={s.number}
                                className={`stepper-item ${isCurrent ? 'active' : ''} ${isDone ? 'completed' : ''}`}
                            >
                                <button
                                    type="button"
                                    className="stepper-btn"
                                    onClick={() => handleStepJump(s.number)}
                                    disabled={s.number > currentStep && currentStep < 2}
                                    aria-current={isCurrent ? 'step' : undefined}
                                >
                                    <span className="stepper-badge" aria-hidden="true">
                                        {isDone ? '✓' : s.number}
                                    </span>
                                    <div className="stepper-text">
                                        <span className="stepper-title">{s.title}</span>
                                        <span className="stepper-subtitle">{s.subtitle}</span>
                                    </div>
                                </button>
                                {s.number < STEPS.length && <div className="stepper-connector" aria-hidden="true" />}
                            </li>
                        );
                    })}
                </ol>
            </nav>

            {/* DRIVING LICENCE VERIFICATION NOTICE */}
            {isLoggedIn && licenseStatus && (
                <div className={`booking-lic-strip lic-${licenseStatus}`}>
                    {licenseStatus === 'verified' ? (
                        <div className="lic-verified-msg">
                            <span>✓ Driver Verified & Authorized to Rent</span>
                        </div>
                    ) : (
                        <div className="lic-warning-msg">
                            <span>
                                {licenseStatus === 'pending'
                                    ? 'Licence review pending: Admin verification required before pickup.'
                                    : licenseStatus === 'rejected'
                                        ? 'Licence verification rejected: Please update documents.'
                                        : licenseStatus === 'expired'
                                            ? 'Licence expired: Please update documents.'
                                            : 'Verified driving licence required to reserve vehicles.'}
                            </span>
                            <Link to="/profile?tab=license" className="lic-verify-link">
                                {licenseStatus === 'pending' ? 'View Status' : 'Verify Licence →'}
                            </Link>
                        </div>
                    )}
                </div>
            )}

            {licenceRedirect && (
                <div className="licence-redirect-callout">
                    <p>{licenceRedirect.message}</p>
                    <Link to={licenceRedirect.redirectUrl} className="licence-redirect-btn">
                        Go to Driving Licence Verification →
                    </Link>
                </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
                {/* STEP 1: VEHICLE CONFIRMATION */}
                {currentStep === 1 && (
                    <div className="booking-step-panel" role="region" aria-label="Step 1: Vehicle Confirmation">
                        <div className="panel-header">
                            <span className="panel-badge">Step 1 of 5</span>
                            <h3 className="panel-title">Confirm Vehicle Selection</h3>
                        </div>

                        <div className="vehicle-confirm-card">
                            <div className="vehicle-confirm-meta">
                                <h4>{vehicleName}</h4>
                                <div className="vehicle-rate-pill">
                                    <strong>₹{Number(pricePerDay).toLocaleString('en-IN')}/day</strong>
                                    <span>(₹{hourlyRate}/hr)</span>
                                </div>
                            </div>

                            <div className="vehicle-status-row">
                                <span className="status-label">Availability Status:</span>
                                {isAvailable ? (
                                    <span className="badge-available">● Ready to Book</span>
                                ) : (
                                    <span className="badge-unavailable">● Currently Unavailable</span>
                                )}
                            </div>

                            <ul className="vehicle-booking-perks">
                                <li>✓ Instant digital rental agreement generation upon confirmation</li>
                                <li>✓ Pre-rental digital photo inspection & condition verification</li>
                                <li>✓ Flexible hourly or multi-day rental billing with zero hidden fees</li>
                            </ul>
                        </div>

                        {!isAvailable && (
                            <FormError message="This vehicle is currently unavailable. Please browse other vehicles in our fleet." />
                        )}

                        <div className="step-actions right-align">
                            <button
                                type="button"
                                className="step-btn next-btn"
                                onClick={handleNextStep}
                                disabled={!isAvailable}
                            >
                                Next: Choose Locations & Map →
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 2: INTERACTIVE PICKUP & DROP LOCATION WITH MAPS */}
                {currentStep === 2 && (
                    <div className="booking-step-panel" role="region" aria-label="Step 2: Pickup and Drop Location">
                        <div className="panel-header">
                            <span className="panel-badge">Step 2 of 5</span>
                            <h3 className="panel-title">Select Pickup & Drop Location</h3>
                        </div>

                        <LocationPickerMap
                            pickupAddress={pickupAddress}
                            pickupCoords={pickupCoords}
                            dropAddress={dropAddress}
                            dropCoords={dropCoords}
                            onPickupChange={({ address, lat, lng }) => {
                                setPickupAddress(address);
                                setPickupCoords({ lat, lng });
                            }}
                            onDropChange={({ address, lat, lng }) => {
                                setDropAddress(address);
                                setDropCoords({ lat, lng });
                            }}
                            sameAsPickup={sameAsPickup}
                            onSameAsPickupToggle={() => {
                                setSameAsPickup(prev => !prev);
                                if (!sameAsPickup) {
                                    setDropAddress(pickupAddress);
                                    setDropCoords(pickupCoords);
                                }
                            }}
                            routeInfo={routeInfo}
                        />

                        {error && <FormError message={error} />}

                        <div className="step-actions split-align">
                            <button
                                type="button"
                                className="step-btn back-btn"
                                onClick={handlePrevStep}
                            >
                                ← Back: Vehicle
                            </button>

                            <button
                                type="button"
                                className="step-btn next-btn"
                                onClick={handleNextStep}
                            >
                                Next: Select Schedule →
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: DATES AND TIMES SELECTION */}
                {currentStep === 3 && (
                    <div className="booking-step-panel" role="region" aria-label="Step 3: Dates and Times">
                        <div className="panel-header">
                            <span className="panel-badge">Step 3 of 5</span>
                            <h3 className="panel-title">Select Pickup & Return Schedule</h3>
                        </div>

                        <div className="booking-grid-2col">
                            <DateTimeField
                                label="Pickup Date"
                                id="booking-pickup-date"
                                name="pickupDate"
                                type="date"
                                min={todayStr}
                                value={pickupDate}
                                onChange={(e) => handlePickupDateChange(e.target.value)}
                                required
                                error={stepErrors.pickupDate}
                            />

                            <DateTimeField
                                label="Pickup Time"
                                id="booking-pickup-time"
                                name="pickupTime"
                                type="time"
                                value={pickupTime}
                                onChange={(e) => handlePickupTimeChange(e.target.value)}
                                required
                                error={stepErrors.pickupTime}
                            />
                        </div>

                        <div className="booking-grid-2col">
                            <DateTimeField
                                label="Return Date"
                                id="booking-return-date"
                                name="returnDate"
                                type="date"
                                min={pickupDate || todayStr}
                                value={returnDate}
                                onChange={(e) => handleReturnDateChange(e.target.value)}
                                required
                                error={stepErrors.returnDate}
                            />

                            <DateTimeField
                                label="Return Time"
                                id="booking-return-time"
                                name="returnTime"
                                type="time"
                                value={returnTime}
                                onChange={(e) => handleReturnTimeChange(e.target.value)}
                                required
                                error={stepErrors.returnTime}
                            />
                        </div>

                        {/* Live Duration pill */}
                        {isDurationValid && (
                            <div className="schedule-preview-pill">
                                <span className="pill-icon">⏱</span>
                                <span className="pill-text">
                                    Calculated Duration: <strong>{durationInfo.display}</strong>
                                </span>
                            </div>
                        )}

                        {/* Optional Add-on Accessories */}
                        {availableAddons.length > 0 && (
                            <div className="addons-selection-block">
                                <h4 className="addons-title">Enhance Your Journey (Optional Add-ons)</h4>
                                <div className="addons-options-grid">
                                    {availableAddons.map(addon => {
                                        const isSelected = selectedAddonIds.includes(addon.id);
                                        return (
                                            <label key={addon.id} className={`addon-option-pill ${isSelected ? 'selected' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        if (isSelected) {
                                                            setSelectedAddonIds(selectedAddonIds.filter(id => id !== addon.id));
                                                        } else {
                                                            setSelectedAddonIds([...selectedAddonIds, addon.id]);
                                                        }
                                                    }}
                                                />
                                                <div className="addon-option-info">
                                                    <span className="addon-opt-name">{addon.charge_name}</span>
                                                    <span className="addon-opt-price">+₹{addon.rate} / {addon.unit.replace('_', ' ')}</span>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {error && <FormError message={error} />}

                        <div className="step-actions split-align">
                            <button
                                type="button"
                                className="step-btn back-btn"
                                onClick={handlePrevStep}
                            >
                                ← Back: Location
                            </button>

                            <button
                                type="button"
                                className="step-btn next-btn"
                                onClick={handleNextStep}
                            >
                                Next: Review Pricing →
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 4: REVIEW & PRICE BREAKDOWN */}
                {currentStep === 4 && (
                    <div className="booking-step-panel" role="region" aria-label="Step 4: Review and Price Breakdown">
                        <div className="panel-header">
                            <span className="panel-badge">Step 4 of 5</span>
                            <h3 className="panel-title">Review Booking & Price Breakdown</h3>
                        </div>

                        <div className="price-breakdown-card">
                            <div className="breakdown-vehicle-header">
                                <div>
                                    <span className="breakdown-tag">RESERVATION SUMMARY</span>
                                    <h4>{vehicleName}</h4>
                                </div>
                                <span className="breakdown-rate">
                                    ₹{pricePerDay}/day <small>(₹{hourlyRate}/hr)</small>
                                </span>
                            </div>

                            <div className="breakdown-schedule-grid">
                                <div className="schedule-block">
                                    <span className="block-label">Pickup Schedule</span>
                                    <strong className="block-val">{formatDisplayDateTime(pickupDatetime)}</strong>
                                    <small style={{ display: 'block', color: 'var(--text-secondary, #64748b)', marginTop: '4px' }}>
                                        📍 {pickupAddress}
                                    </small>
                                </div>
                                <div className="schedule-block">
                                    <span className="block-label">Return Schedule</span>
                                    <strong className="block-val">{formatDisplayDateTime(returnDatetime)}</strong>
                                    <small style={{ display: 'block', color: 'var(--text-secondary, #64748b)', marginTop: '4px' }}>
                                        🏁 {sameAsPickup ? pickupAddress : dropAddress}
                                    </small>
                                </div>
                            </div>

                            <div className="breakdown-divider" />

                            <div className="breakdown-line-items">
                                <div className="line-item">
                                    <span>Rental Duration</span>
                                    <strong>{durationInfo.display} ({durationInfo.durationHours} hrs)</strong>
                                </div>
                                <div className="line-item">
                                    <span>Base Rental ({smartPricing ? smartPricing.rentalDays : Math.max(1, Math.ceil(durationInfo.durationHours / 24))} day{smartPricing?.rentalDays > 1 ? 's' : ''})</span>
                                    <span>₹{Number(smartPricing ? smartPricing.baseRentalPrice : baseRentalPrice).toLocaleString('en-IN')}</span>
                                </div>

                                {smartPricing?.weekendAdjustment > 0 && (
                                    <div className="line-item" style={{ color: '#ea580c' }}>
                                        <span>Weekend Peak Surcharge ({smartPricing.weekendDaysCount} weekend day{smartPricing.weekendDaysCount > 1 ? 's' : ''})</span>
                                        <strong>+₹{smartPricing.weekendAdjustment.toFixed(2)}</strong>
                                    </div>
                                )}

                                {smartPricing?.seasonalAdjustment > 0 && (
                                    <div className="line-item" style={{ color: '#ea580c' }}>
                                        <span>Seasonal Peak ({smartPricing.seasonName || 'Holiday Calendar'})</span>
                                        <strong>+₹{smartPricing.seasonalAdjustment.toFixed(2)}</strong>
                                    </div>
                                )}

                                {smartPricing?.durationDiscount > 0 && (
                                    <div className="line-item" style={{ color: '#059669' }}>
                                        <span>Duration Discount ({smartPricing.discountRuleName})</span>
                                        <strong>-₹{smartPricing.durationDiscount.toFixed(2)}</strong>
                                    </div>
                                )}

                                <div className="line-item">
                                    <span>Transit / Delivery Fee ({routeInfo.route_distance_km} km)</span>
                                    <span>
                                        {deliveryFee === 0 ? (
                                            <strong style={{ color: '#10b981' }}>FREE (Within Free Radius)</strong>
                                        ) : (
                                            `₹${Number(deliveryFee).toLocaleString('en-IN')}`
                                        )}
                                    </span>
                                </div>

                                {smartPricing?.appliedAddons?.length > 0 && (
                                    <>
                                        {smartPricing.appliedAddons.map(a => (
                                            <div key={a.addonId} className="line-item" style={{ color: '#2563eb' }}>
                                                <span>Add-on: {a.name} ({a.units} {a.unit.replace('_', ' ')})</span>
                                                <strong>+₹{a.totalCost.toFixed(2)}</strong>
                                            </div>
                                        ))}
                                    </>
                                )}

                                <div className="line-item green-text">
                                    <span>Standard Damage Waiver & Insurance</span>
                                    <span>Included (₹0)</span>
                                </div>
                                <div className="line-item green-text">
                                    <span>24/7 Roadside Assistance Hotline</span>
                                    <span>Included (₹0)</span>
                                </div>
                                <div className="line-item">
                                    <span>Applicable GST & Platform Tolls</span>
                                    <span>Included</span>
                                </div>
                            </div>

                            <div className="breakdown-divider" />

                            <div className="breakdown-total-row">
                                <span className="total-title">Total Rental Payable</span>
                                <strong className="total-amount">
                                    ₹{Number(finalTotalPrice).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </strong>
                            </div>
                        </div>

                        {error && <FormError message={error} />}

                        <div className="step-actions split-align">
                            <button
                                type="button"
                                className="step-btn back-btn"
                                onClick={handlePrevStep}
                            >
                                ← Back: Schedule
                            </button>

                            <button
                                type="button"
                                className="step-btn next-btn"
                                onClick={handleNextStep}
                            >
                                Next: Confirm & Reserve →
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 5: CONFIRMATION & SUBMIT */}
                {currentStep === 5 && (
                    <div className="booking-step-panel" role="region" aria-label="Step 5: Final Confirmation">
                        <div className="panel-header">
                            <span className="panel-badge">Step 5 of 5</span>
                            <h3 className="panel-title">Finalize Reservation</h3>
                        </div>

                        <div className="booking-final-summary">
                            <div className="final-summary-row">
                                <span className="f-label">Vehicle:</span>
                                <strong className="f-val">{vehicleName}</strong>
                            </div>
                            <div className="final-summary-row">
                                <span className="f-label">Pickup:</span>
                                <span className="f-val">{formatDisplayDateTime(pickupDatetime)} ({pickupAddress})</span>
                            </div>
                            <div className="final-summary-row">
                                <span className="f-label">Return:</span>
                                <span className="f-val">{formatDisplayDateTime(returnDatetime)} ({sameAsPickup ? pickupAddress : dropAddress})</span>
                            </div>
                            <div className="final-summary-row">
                                <span className="f-label">Route:</span>
                                <span className="f-val">{routeInfo.route_distance_km} km ({routeInfo.estimated_travel_time})</span>
                            </div>
                            <div className="final-summary-row">
                                <span className="f-label">Duration:</span>
                                <span className="f-val">{durationInfo.display}</span>
                            </div>
                            <div className="final-summary-row total-highlight">
                                <span className="f-label">Grand Total:</span>
                                <strong className="f-val total-price">
                                    ₹{Number(finalTotalPrice).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </strong>
                            </div>
                        </div>

                        {/* Customer Authentication Check */}
                        {isLoggedIn && user ? (
                            <div className="customer-info-box">
                                <span className="customer-info-title">Booking As</span>
                                <div className="customer-info-details">
                                    <strong>{user.name}</strong>
                                    <span>{user.email}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="booking-auth-warning" role="alert">
                                <strong>Account Login Required</strong>
                                <p>
                                    You must be logged in to complete your vehicle booking.
                                </p>
                                <Link
                                    to="/login"
                                    state={{ from: location }}
                                    className="booking-login-link"
                                >
                                    Log In to RentIQ →
                                </Link>
                            </div>
                        )}

                        <div className="terms-checkbox-wrap">
                            <label className="terms-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={agreeToTerms}
                                    onChange={(e) => setAgreeToTerms(e.target.checked)}
                                    className="terms-checkbox"
                                    id="booking-terms-agree"
                                />
                                <span>
                                    I agree to RentIQ&apos;s rental agreement terms, age/driver requirements, and digital vehicle inspection process.
                                </span>
                            </label>
                        </div>

                        {error && <FormError message={error} />}

                        <div className="step-actions split-align">
                            <button
                                type="button"
                                className="step-btn back-btn"
                                onClick={handlePrevStep}
                                disabled={isSubmitting}
                            >
                                ← Back: Review
                            </button>

                            <button
                                type="submit"
                                className="step-btn confirm-submit-btn"
                                disabled={isSubmitting || !isAvailable || !isDurationValid || !isLoggedIn || !agreeToTerms}
                            >
                                {isSubmitting ? (
                                    <span className="submitting-spinner">Reserving Vehicle...</span>
                                ) : (
                                    <span>Confirm & Book Now (₹{Number(finalTotalPrice).toLocaleString('en-IN')})</span>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </form>
        </section>
    );
}

export default BookingForm;
