/**
 * RentIQ AI Vehicle Recommendation Card
 *
 * File: frontend/src/components/ai/VehicleRecommendationCard.jsx
 *
 * Renders an interactive vehicle card inside the AI chat interface with
 * live availability badge, match score, specifications, and navigation actions.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Settings2, Fuel, Zap, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { getVehicleImageUrl, handleVehicleImageError } from '../../utils/vehicleImages';
import './VehicleRecommendationCard.css';

function VehicleRecommendationCard({ vehicle, onActionClick }) {
    if (!vehicle) return null;

    const {
        vehicle_id,
        name,
        brand,
        model,
        category,
        price_per_day,
        seating_capacity,
        transmission,
        fuel_type,
        image_url,
        is_available,
        booking_eligible,
        availability_status,
        availability_badge,
        availability_reason,
        matchPercentage,
        matchExplanation
    } = vehicle;

    const displayName = name.toLowerCase().startsWith((brand || '').toLowerCase())
        ? name
        : `${brand || ''} ${name}`.trim();

    const imageSource = getVehicleImageUrl({
        name,
        vehicle_name: name,
        image_url
    });

    const isEv = (category && category.toLowerCase() === 'ev') || (fuel_type && fuel_type.toLowerCase() === 'electric');

    const isBookable = Boolean(booking_eligible !== undefined ? booking_eligible : is_available);

    const badgeText = availability_badge?.text || (
        availability_status === 'compliance_required' ? 'Compliance Required' :
        availability_status === 'under_maintenance' ? 'Under Maintenance' :
        isBookable ? 'Available' : 'Unavailable'
    );

    const badgeVariant = (
        availability_status === 'compliance_required' ? 'badge-compliance' :
        availability_status === 'under_maintenance' ? 'badge-maintenance' :
        isBookable ? 'badge-available' : 'badge-unavailable'
    );

    const handleNavigate = () => {
        if (typeof onActionClick === 'function') {
            onActionClick();
        }
    };

    return (
        <div className="ai-recommendation-card" role="article" aria-label={`Recommended vehicle: ${displayName}`}>
            <div className="ai-card-media">
                <img
                    src={imageSource}
                    alt={displayName}
                    className="ai-card-img"
                    loading="lazy"
                    onError={handleVehicleImageError}
                />
                <div className="ai-card-badges">
                    {category && (
                        <span className="ai-category-tag">
                            {category}
                        </span>
                    )}
                    <span className={`ai-status-badge ${badgeVariant}`}>
                        {badgeText}
                    </span>
                </div>

                {matchPercentage && (
                    <div className="ai-match-score-pill" title={matchExplanation || 'Match score'}>
                        <span>{matchPercentage}% Match</span>
                    </div>
                )}
            </div>

            <div className="ai-card-body">
                <div className="ai-card-header">
                    <h4 className="ai-card-title">{displayName}</h4>
                    {model && model !== name && <span className="ai-card-model">{model}</span>}
                </div>

                {matchExplanation && (
                    <p className="ai-match-explanation">
                        {matchExplanation}
                    </p>
                )}

                <div className="ai-spec-chips">
                    <span className="ai-spec-chip" title="Seating Capacity">
                        <Users size={12} aria-hidden="true" />
                        {seating_capacity} Seats
                    </span>
                    <span className="ai-spec-chip" title="Transmission">
                        <Settings2 size={12} aria-hidden="true" />
                        {transmission ? transmission.charAt(0).toUpperCase() + transmission.slice(1) : 'Manual'}
                    </span>
                    <span className="ai-spec-chip" title="Fuel Type">
                        {isEv ? <Zap size={12} aria-hidden="true" /> : <Fuel size={12} aria-hidden="true" />}
                        {fuel_type ? fuel_type.charAt(0).toUpperCase() + fuel_type.slice(1) : 'Petrol'}
                    </span>
                </div>

                <div className="ai-card-footer">
                    <div className="ai-price-block">
                        <span className="ai-price-label">Rate</span>
                        <span className="ai-price-value">₹{Number(price_per_day).toLocaleString('en-IN')}</span>
                        <span className="ai-price-period">/day</span>
                    </div>

                    <div className="ai-card-actions">
                        <Link
                            to={`/vehicles/${vehicle_id}`}
                            className="ai-btn-details"
                            onClick={handleNavigate}
                        >
                            View Details
                        </Link>

                        {isBookable ? (
                            <Link
                                to={`/vehicles/${vehicle_id}#book`}
                                className="ai-btn-book"
                                onClick={handleNavigate}
                            >
                                Book Now
                                <ArrowRight size={13} aria-hidden="true" />
                            </Link>
                        ) : (
                            <span
                                className="ai-btn-disabled"
                                title={availability_reason || 'Vehicle currently unavailable for instant booking'}
                            >
                                Unavailable
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default VehicleRecommendationCard;
