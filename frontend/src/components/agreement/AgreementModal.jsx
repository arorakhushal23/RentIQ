import React, { useState, useEffect } from 'react';
import { X, FileText, Download, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import Loader from '../common/Loader';
import './AgreementModal.css';

function AgreementModal({ bookingId, onClose, onAgreementAccepted }) {
    const [agreement, setAgreement] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [accepting, setAccepting] = useState(false);
    const [agreedTerms, setAgreedTerms] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fetchAgreement = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await axiosInstance.get(`/agreements/booking/${bookingId}`);
                if (isMounted) {
                    setAgreement(res.data.agreement);
                }
            } catch (err) {
                if (isMounted) {
                    setError(err.response?.data?.message || 'Failed to load rental agreement.');
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        if (bookingId) {
            fetchAgreement();
        }

        return () => { isMounted = false; };
    }, [bookingId]);

    const handleAccept = async () => {
        if (!agreement || !agreedTerms) return;

        setAccepting(true);
        setError('');
        try {
            const res = await axiosInstance.post(`/agreements/${agreement.id}/accept`);
            setAgreement(prev => ({
                ...prev,
                terms_accepted: true,
                agreement_status: 'accepted',
                accepted_at: res.data.accepted_at
            }));
            if (onAgreementAccepted) onAgreementAccepted(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to accept rental agreement.');
        } finally {
            setAccepting(false);
        }
    };

    const handleDownload = async () => {
        if (!agreement) return;
        try {
            const res = await axiosInstance.get(`/agreements/${agreement.id}/download`, {
                responseType: 'blob'
            });
            const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', `${agreement.agreement_number}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert('Failed to download agreement PDF.');
        }
    };

    const agrData = agreement?.agreement_data || {};
    const company = agrData.company || {};
    const customer = agrData.customer || {};
    const vehicle = agrData.vehicle || {};
    const booking = agrData.booking || {};
    const financials = agrData.financials || {};
    const terms = agrData.terms || [];

    const isAccepted = agreement?.terms_accepted || agreement?.agreement_status === 'accepted';

    return (
        <div className="modal-backdrop-agreement" onClick={onClose}>
            <div className="agreement-modal-window" onClick={(e) => e.stopPropagation()}>
                <header className="agreement-modal-header">
                    <div className="header-title-block">
                        <FileText size={20} className="header-icon" />
                        <div>
                            <h3>Digital Rental Agreement</h3>
                            <span className="agreement-ref">
                                {agreement ? agreement.agreement_number : `Booking #${bookingId}`}
                            </span>
                        </div>
                    </div>
                    <button type="button" className="close-btn" onClick={onClose} aria-label="Close modal">
                        <X size={20} />
                    </button>
                </header>

                <div className="agreement-modal-body">
                    {loading ? (
                        <div className="agreement-loading-wrap">
                            <Loader message="Loading rental agreement dossier..." />
                        </div>
                    ) : error ? (
                        <div className="agreement-error-banner" role="alert">
                            <AlertTriangle size={18} />
                            <span>{error}</span>
                        </div>
                    ) : (
                        <div className="agreement-dossier-content">
                            {/* Status Banner */}
                            {isAccepted ? (
                                <div className="accepted-banner">
                                    <CheckCircle size={20} className="check-icon" />
                                    <div>
                                        <strong>Agreement Digitally Accepted</strong>
                                        <p>
                                            Accepted by {customer.name} on {new Date(agreement.accepted_at || Date.now()).toLocaleString('en-IN')}.
                                        </p>
                                    </div>
                                    <button type="button" className="download-pdf-btn" onClick={handleDownload}>
                                        <Download size={15} />
                                        <span>Download PDF</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="pending-banner">
                                    <AlertTriangle size={18} className="warn-icon" />
                                    <div>
                                        <strong>Digital Review & Acceptance Required</strong>
                                        <p>Please review all rental terms and check acceptance below before vehicle handover.</p>
                                    </div>
                                </div>
                            )}

                            {/* Section 1: Contracting Parties */}
                            <section className="dossier-section">
                                <h4 className="section-title">1. Contracting Parties</h4>
                                <div className="parties-grid">
                                    <div className="party-box lessor-box">
                                        <span className="party-role">Lessor (Rental Provider)</span>
                                        <strong>{company.name || 'RentIQ Vehicle Rentals'}</strong>
                                        <p>{company.legalEntity}</p>
                                        <p>{company.address}</p>
                                        <small>Support: {company.supportEmail} | {company.emergencyHotline}</small>
                                    </div>

                                    <div className="party-box lessee-box">
                                        <span className="party-role">Lessee (Customer & Driver)</span>
                                        <strong>{customer.name}</strong>
                                        <p>{customer.email}</p>
                                        <p>Driving Licence: <b>{customer.licenseNumberMasked}</b></p>
                                        <small>Licence Class: {customer.licenseClass || 'LMV'}</small>
                                    </div>
                                </div>
                            </section>

                            {/* Section 2: Vehicle & Location Details */}
                            <section className="dossier-section">
                                <h4 className="section-title">2. Vehicle & Location Specifications</h4>
                                <div className="specs-table-grid">
                                    <div className="spec-row">
                                        <span className="spec-name">Vehicle</span>
                                        <span className="spec-value">{vehicle.brand} {vehicle.name}</span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-name">Registration Number</span>
                                        <span className="spec-value reg-pill">{vehicle.registrationNumber}</span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-name">Fuel & Transmission</span>
                                        <span className="spec-value">{vehicle.fuelType} • {vehicle.transmission}</span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-name">Pickup Location</span>
                                        <span className="spec-value">{booking.pickupAddress}</span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-name">Drop Location</span>
                                        <span className="spec-value">{booking.dropAddress}</span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-name">Transit Route</span>
                                        <span className="spec-value">{booking.routeDistanceKm} km ({booking.estimatedTravelTime})</span>
                                    </div>
                                </div>
                            </section>

                            {/* Section 3: Financial Terms */}
                            <section className="dossier-section">
                                <h4 className="section-title">3. Financial Breakdown & Deductibles</h4>
                                <div className="financial-card">
                                    <div className="fin-line">
                                        <span>Base Vehicle Rental</span>
                                        <strong>₹{Number(financials.baseRentalAmount || 0).toLocaleString('en-IN')}</strong>
                                    </div>
                                    <div className="fin-line">
                                        <span>Delivery / Transit Charge</span>
                                        <strong>
                                            {financials.deliveryCharge > 0
                                                ? `₹${Number(financials.deliveryCharge).toLocaleString('en-IN')}`
                                                : 'FREE'}
                                        </strong>
                                    </div>
                                    <div className="fin-line">
                                        <span>Refundable Security Deposit</span>
                                        <span>₹{Number(financials.securityDeposit || 3000).toLocaleString('en-IN')} (Refundable at return)</span>
                                    </div>
                                    <div className="fin-total">
                                        <span>Total Booking Amount</span>
                                        <strong className="total-highlight">₹{Number(financials.totalBookingAmount || 0).toLocaleString('en-IN')}</strong>
                                    </div>
                                </div>
                            </section>

                            {/* Section 4: Terms & Conditions */}
                            <section className="dossier-section">
                                <h4 className="section-title">4. Core Rental Terms</h4>
                                <div className="terms-accordion">
                                    {terms.map((t, idx) => (
                                        <div key={idx} className="term-entry">
                                            <strong>{t.title}</strong>
                                            <p>{t.body}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Acceptance Action */}
                            {!isAccepted && (
                                <div className="agreement-acceptance-box">
                                    <label className="acceptance-checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={agreedTerms}
                                            onChange={(e) => setAgreedTerms(e.target.checked)}
                                        />
                                        <span>
                                            I, <b>{customer.name}</b>, confirm that I am the verified driving licence holder, have inspected and understood all rental terms, vehicle liabilities, and speed policies outlined in this agreement.
                                        </span>
                                    </label>

                                    <div className="acceptance-action-row">
                                        <button
                                            type="button"
                                            className="confirm-accept-btn"
                                            onClick={handleAccept}
                                            disabled={!agreedTerms || accepting}
                                        >
                                            <ShieldCheck size={18} />
                                            <span>{accepting ? 'Signing Agreement...' : 'Digitally Accept Agreement'}</span>
                                        </button>
                                        <button type="button" className="download-pdf-outline" onClick={handleDownload}>
                                            <Download size={15} />
                                            <span>Preview PDF</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AgreementModal;

