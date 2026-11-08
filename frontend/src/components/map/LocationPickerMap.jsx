import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Search, Crosshair, RefreshCw, AlertCircle, X } from 'lucide-react';
import './LocationPickerMap.css';

// Custom SVG HTML Icons for robust rendering in all bundler environments
const createCustomMarkerIcon = (type = 'pickup') => {
    const isPickup = type === 'pickup';
    const bgCol = isPickup ? '#10b981' : '#f43f5e';
    const borderCol = isPickup ? '#059669' : '#e11d48';
    const textLabel = isPickup ? 'P' : 'D';

    return L.divIcon({
        className: `custom-map-marker marker-${type}`,
        html: `
            <div style="
                background: ${bgCol};
                border: 2px solid ${borderCol};
                color: #ffffff;
                width: 32px;
                height: 32px;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: inherit;
                font-weight: 700;
                font-size: 13px;
                box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            ">
                <span style="transform: rotate(45deg);">${textLabel}</span>
            </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
};

function LocationPickerMap({
    pickupAddress,
    pickupCoords,
    dropAddress,
    dropCoords,
    onPickupChange,
    onDropChange,
    sameAsPickup,
    onSameAsPickupToggle,
    routeInfo
}) {
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const pickupMarkerRef = useRef(null);
    const dropMarkerRef = useRef(null);
    const routePolylineRef = useRef(null);
    const searchContainerRef = useRef(null);

    // Active selection mode: 'pickup' | 'drop'
    const [activeTarget, setActiveTarget] = useState('pickup');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [geoLoading, setGeoLoading] = useState(false);

    // Keep active refs to avoid stale closures in map event handlers
    const activeTargetRef = useRef(activeTarget);
    activeTargetRef.current = activeTarget;

    const sameAsPickupRef = useRef(sameAsPickup);
    sameAsPickupRef.current = sameAsPickup;

    const onPickupChangeRef = useRef(onPickupChange);
    onPickupChangeRef.current = onPickupChange;

    const onDropChangeRef = useRef(onDropChange);
    onDropChangeRef.current = onDropChange;

    // Dismiss search dropdown on click outside
    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
                setSearchResults([]);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, []);

    // Reverse geocode and update coordinates
    const handleMapLocationSelect = async (lat, lng) => {
        let resolvedAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
                headers: { 'Accept-Language': 'en' }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.display_name) {
                    resolvedAddress = data.display_name;
                }
            }
        } catch (err) {
            // Keep coordinates as fallback address
        }

        const currentTarget = activeTargetRef.current;
        const currentSameAsPickup = sameAsPickupRef.current;

        if (currentTarget === 'pickup') {
            onPickupChangeRef.current?.({ address: resolvedAddress, lat, lng });
            if (currentSameAsPickup) {
                onDropChangeRef.current?.({ address: resolvedAddress, lat, lng });
            }
        } else {
            onDropChangeRef.current?.({ address: resolvedAddress, lat, lng });
        }
    };

    // Initialize Leaflet Map
    useEffect(() => {
        if (!mapContainerRef.current) return;

        const defaultLat = pickupCoords?.lat || 30.7398;
        const defaultLng = pickupCoords?.lng || 76.7827;

        const map = L.map(mapContainerRef.current, {
            center: [defaultLat, defaultLng],
            zoom: 12,
            zoomControl: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);

        mapInstanceRef.current = map;

        // Map click handler to place marker for currently active target
        map.on('click', async (e) => {
            setSearchResults([]);
            setSearchError('');
            const { lat, lng } = e.latlng;
            await handleMapLocationSelect(lat, lng);
        });

        return () => {
            map.remove();
            mapInstanceRef.current = null;
        };
    }, []);

    // Update Pickup Marker
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        if (pickupCoords?.lat && pickupCoords?.lng) {
            if (pickupMarkerRef.current) {
                pickupMarkerRef.current.setLatLng([pickupCoords.lat, pickupCoords.lng]);
            } else {
                pickupMarkerRef.current = L.marker([pickupCoords.lat, pickupCoords.lng], {
                    icon: createCustomMarkerIcon('pickup'),
                    draggable: true
                }).addTo(map);

                pickupMarkerRef.current.on('dragend', async (e) => {
                    const pos = e.target.getLatLng();
                    await handleMapLocationSelect(pos.lat, pos.lng);
                });
            }
            pickupMarkerRef.current.bindPopup(`<b>Pickup Location</b><br/>${pickupAddress || ''}`);
        }
    }, [pickupCoords, pickupAddress]);

    // Update Drop Marker
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        if (dropCoords?.lat && dropCoords?.lng && !sameAsPickup) {
            if (dropMarkerRef.current) {
                dropMarkerRef.current.setLatLng([dropCoords.lat, dropCoords.lng]);
            } else {
                dropMarkerRef.current = L.marker([dropCoords.lat, dropCoords.lng], {
                    icon: createCustomMarkerIcon('drop'),
                    draggable: true
                }).addTo(map);

                dropMarkerRef.current.on('dragend', async (e) => {
                    const pos = e.target.getLatLng();
                    setActiveTarget('drop');
                    await handleMapLocationSelect(pos.lat, pos.lng);
                });
            }
            dropMarkerRef.current.bindPopup(`<b>Drop Location</b><br/>${dropAddress || ''}`);
        } else if (dropMarkerRef.current) {
            map.removeLayer(dropMarkerRef.current);
            dropMarkerRef.current = null;
        }
    }, [dropCoords, dropAddress, sameAsPickup]);

    // Draw route line and fit bounds
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        if (pickupCoords?.lat && dropCoords?.lat && !sameAsPickup) {
            const p = [pickupCoords.lat, pickupCoords.lng];
            const d = [dropCoords.lat, dropCoords.lng];

            if (routePolylineRef.current) {
                routePolylineRef.current.setLatLngs([p, d]);
            } else {
                routePolylineRef.current = L.polyline([p, d], {
                    color: '#0284c7',
                    weight: 4,
                    opacity: 0.8,
                    dashArray: '6, 8'
                }).addTo(map);
            }

            const bounds = L.latLngBounds([p, d]);
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        } else {
            if (routePolylineRef.current) {
                map.removeLayer(routePolylineRef.current);
                routePolylineRef.current = null;
            }
            if (pickupCoords?.lat && pickupCoords?.lng) {
                const center = map.getCenter();
                const dist = Math.hypot(center.lat - pickupCoords.lat, center.lng - pickupCoords.lng);
                if (dist > 0.0001) {
                    map.setView([pickupCoords.lat, pickupCoords.lng], Math.max(map.getZoom(), 13));
                }
            }
        }
    }, [pickupCoords, dropCoords, sameAsPickup]);

    // Browser Geolocation for Current Location
    const handleGetCurrentLocation = () => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser.');
            return;
        }

        setGeoLoading(true);
        setSearchError('');
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                await handleMapLocationSelect(latitude, longitude);
                if (mapInstanceRef.current) {
                    mapInstanceRef.current.flyTo([latitude, longitude], 14);
                }
                setGeoLoading(false);
            },
            (err) => {
                setGeoLoading(false);
                alert(`Unable to retrieve your location: ${err.message}`);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    // Address Search via Nominatim Geocoding
    const handleSearch = async (e) => {
        if (e && typeof e.preventDefault === 'function') {
            e.preventDefault();
        }
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }

        const query = searchQuery.trim();
        if (!query) {
            setSearchError('Please enter a location or landmark to search.');
            setSearchResults([]);
            return;
        }

        if (isSearching) return;

        setIsSearching(true);
        setSearchError('');

        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=in`,
                { headers: { 'Accept-Language': 'en' } }
            );

            if (!res.ok) {
                throw new Error(`Geocoding server responded with HTTP ${res.status}`);
            }

            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) {
                setSearchError(`No location found for "${query}". Try another city or landmark.`);
                setSearchResults([]);
                return;
            }

            setSearchResults(data);

            // Automatically focus on primary result and update location
            const primaryMatch = data[0];
            const lat = parseFloat(primaryMatch.lat);
            const lng = parseFloat(primaryMatch.lon);
            const address = primaryMatch.display_name;

            const currentTarget = activeTargetRef.current;
            const currentSame = sameAsPickupRef.current;

            if (currentTarget === 'pickup') {
                onPickupChangeRef.current?.({ address, lat, lng });
                if (currentSame) {
                    onDropChangeRef.current?.({ address, lat, lng });
                }
            } else {
                onDropChangeRef.current?.({ address, lat, lng });
            }

            if (mapInstanceRef.current) {
                mapInstanceRef.current.flyTo([lat, lng], 14, {
                    duration: 1.2
                });
            }
        } catch (err) {
            console.error('Nominatim search error:', err);
            setSearchError('Location search failed. Please check your network and try again.');
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectSearchResult = (result) => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        const address = result.display_name;

        const currentTarget = activeTargetRef.current;
        const currentSameAsPickup = sameAsPickupRef.current;

        if (currentTarget === 'pickup') {
            onPickupChangeRef.current?.({ address, lat, lng });
            if (currentSameAsPickup) {
                onDropChangeRef.current?.({ address, lat, lng });
            }
        } else {
            onDropChangeRef.current?.({ address, lat, lng });
        }

        if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([lat, lng], 14, { duration: 1.2 });
        }

        setSearchResults([]);
        setSearchError('');
        setSearchQuery(address);
    };

    return (
        <div className="location-picker-map-widget">
            {/* Header controls & target switcher */}
            <div className="location-controls-header">
                <div className="target-toggle-group">
                    <button
                        type="button"
                        className={`target-btn ${activeTarget === 'pickup' ? 'active-pickup' : ''}`}
                        onClick={() => {
                            setActiveTarget('pickup');
                            setSearchError('');
                        }}
                    >
                        <MapPin size={16} />
                        <span>Pickup Location</span>
                    </button>
                    <button
                        type="button"
                        className={`target-btn ${activeTarget === 'drop' ? 'active-drop' : ''}`}
                        onClick={() => {
                            if (sameAsPickup) onSameAsPickupToggle();
                            setActiveTarget('drop');
                            setSearchError('');
                        }}
                    >
                        <Navigation size={16} />
                        <span>Drop Location</span>
                    </button>
                </div>

                <div className="map-quick-actions">
                    <button
                        type="button"
                        className="geo-btn"
                        onClick={handleGetCurrentLocation}
                        disabled={geoLoading}
                        title="Use my current GPS location"
                    >
                        {geoLoading ? <RefreshCw size={14} className="spin-icon" /> : <Crosshair size={14} />}
                        <span>Current Location</span>
                    </button>

                    <label className="same-pickup-checkbox-label">
                        <input
                            type="checkbox"
                            checked={sameAsPickup}
                            onChange={onSameAsPickupToggle}
                        />
                        <span>Same for Drop</span>
                    </label>
                </div>
            </div>

            {/* Address search bar - non-form container to prevent outer form submission */}
            <div ref={searchContainerRef} className="map-search-form" role="search">
                <div className="map-search-input-wrap">
                    <Search size={16} className="search-icon-map" />
                    <input
                        type="text"
                        placeholder={`Search ${activeTarget === 'pickup' ? 'pickup' : 'drop'} address or landmark...`}
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            if (searchError) setSearchError('');
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                                handleSearch(e);
                            }
                        }}
                        className="map-search-input"
                        disabled={isSearching}
                        aria-label="Search map location"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            className="clear-search-btn"
                            onClick={() => {
                                setSearchQuery('');
                                setSearchError('');
                                setSearchResults([]);
                            }}
                            title="Clear search"
                            aria-label="Clear search"
                        >
                            <X size={14} />
                        </button>
                    )}
                    <button
                        type="button"
                        className="map-search-submit-btn"
                        onClick={handleSearch}
                        disabled={isSearching}
                        aria-label="Search location"
                    >
                        {isSearching ? (
                            <>
                                <RefreshCw size={13} className="spin-icon" />
                                <span>Searching...</span>
                            </>
                        ) : (
                            <span>Search</span>
                        )}
                    </button>
                </div>

                {searchError && (
                    <div className="map-search-error-msg" role="alert">
                        <AlertCircle size={14} className="search-err-icon" />
                        <span>{searchError}</span>
                    </div>
                )}

                {searchResults.length > 0 && (
                    <div className="map-search-dropdown">
                        {searchResults.map((item, idx) => (
                            <div
                                key={idx}
                                className="search-result-item"
                                onClick={() => handleSelectSearchResult(item)}
                            >
                                <MapPin size={14} className="result-pin" />
                                <span>{item.display_name}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Interactive Leaflet Map Canvas */}
            <div className="leaflet-map-frame">
                <div ref={mapContainerRef} className="leaflet-map-element" />
                <div className="map-click-hint">
                    <span>Click anywhere on the map to set <b>{activeTarget}</b> location</span>
                </div>
            </div>

            {/* Selected locations summary */}
            <div className="selected-locations-dossier">
                <div className="location-summary-card pickup-card">
                    <div className="card-badge-header">
                        <span className="dot-pill pickup-dot" />
                        <strong>Pickup Address</strong>
                    </div>
                    <p className="address-text">{pickupAddress || 'Click map or search above'}</p>
                </div>

                {!sameAsPickup && (
                    <div className="location-summary-card drop-card">
                        <div className="card-badge-header">
                            <span className="dot-pill drop-dot" />
                            <strong>Drop Address</strong>
                        </div>
                        <p className="address-text">{dropAddress || 'Click map or search above'}</p>
                    </div>
                )}
            </div>

            {/* Route metrics badge bar */}
            {routeInfo && (
                <div className="route-metrics-bar">
                    <div className="metric-pill">
                        <span className="metric-lbl">Transit Distance</span>
                        <strong className="metric-val">{routeInfo.route_distance_km} km</strong>
                    </div>
                    <div className="metric-pill">
                        <span className="metric-lbl">Est. Travel Time</span>
                        <strong className="metric-val">{routeInfo.estimated_travel_time}</strong>
                    </div>
                    <div className="metric-pill">
                        <span className="metric-lbl">Delivery Fee</span>
                        <strong className="metric-val">
                            {routeInfo.is_free_delivery || Number(routeInfo.delivery_charge) === 0 ? (
                                <span className="free-badge">FREE</span>
                            ) : (
                                `₹${Number(routeInfo.delivery_charge).toLocaleString('en-IN')}`
                            )}
                        </strong>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LocationPickerMap;
