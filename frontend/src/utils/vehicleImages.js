/**
 * Shared Vehicle Image Resolution Utility
 * 
 * Provides consistent image-resolution across:
 * 1. Vehicles browsing page (/vehicles)
 * 2. Vehicle details page (/vehicles/:id)
 * 3. Customer Rental History (/profile)
 * 4. Booking Details modal (/profile)
 */

// Neutral, consistent vector fallback image for when a vehicle image is unavailable or fails to load.
// Embedded SVG data URI ensures it never fails over network and prevents broken image icons.
export const DEFAULT_VEHICLE_FALLBACK =
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 250' width='100%' height='100%'><rect width='100%' height='100%' fill='%23e2e8f0'/><g transform='translate(120, 60)' fill='%2394a3b8'><path d='M130 30c-2-6-7.5-10-14-10H44c-6.5 0-12 4-14 10L10 90v80c0 5.5 4.5 10 10 10h10c5.5 0 10-4.5 10-10v-10h80v10c0 5.5 4.5 10 10 10h10c5.5 0 10-4.5 10-10V90l-20-60zM45 130c-8.3 0-15-6.7-15-15s6.7-15 15-15 15 6.7 15 15-6.7 15-15 15zm70 0c-8.3 0-15-6.7-15-15s6.7-15 15-15 15 6.7 15 15-6.7 15-15 15zM30 80l15-45h70l15 45H30z'/></g><text x='50%' y='195' text-anchor='middle' font-family='sans-serif' font-size='13' fill='%2364748b' font-weight='600'>Vehicle Image Unavailable</text></svg>";

// Catalog images aligned with the database records for RentIQ vehicles
const vehicleImages = {
    Swift: 'https://tse4.mm.bing.net/th/id/OIP.W2GdfD-GwFiGCQm79lezkAAAAA?r=0&rs=1&pid=ImgDetMain&o=7&rm=3',
    i20: 'https://tse4.mm.bing.net/th/id/OIP.1APn4Zs6XXD0KRrXfE8XVQHaD4?r=0&rs=1&pid=ImgDetMain&o=7&rm=3',
    City: 'https://tse4.mm.bing.net/th/id/OIP.3W3M0fETgvXz2vxwcSTnAwHaE8?r=0&w=930&h=620&rs=1&pid=ImgDetMain&o=7&rm=3',
    Verna: 'https://cdni.autocarindia.com/ExtraImages/20230220030433_Verna.jpg',
    Creta: 'https://tse3.mm.bing.net/th/id/OIP.l9YdD9hRn3jI0v9LbHJAcAHaEK?r=0&o=7rm=3&rs=1&pid=ImgDetMain&o=7&rm=3',
    Scorpio: 'https://www.theindianwire.com/wp-content/uploads/2024/02/Mahindra-Scorpio-N-Z8-Select-Launched-2048x1152.jpg',
    'Classic 350': 'https://tse2.mm.bing.net/th/id/OIP.6woaXmRqhgP9JTnJt5W-GwHaFj?r=0&w=954&h=716&rs=1&pid=ImgDetMain&o=7&rm=3',
    'Pulsar 150': 'https://tse2.mm.bing.net/th/id/OIP.nB4U7aB7im4U0GcLzBQwHaFj?r=0&rs=1&pid=ImgDetMain&o=7&rm=3',
    Activa: 'https://cdn.bikedekho.com/processedimages/honda/activa-6g/source/activa-6g65e80a97062a4.jpg',
    'Nexon EV': 'https://tse4.mm.bing.net/th/id/OIP.-EvgiTmOXRuNoFlgnSiZGAHaE8?r=0&w=930&h=620&rs=1&pid=ImgDetMain&o=7&rm=3',
    Seltos: 'https://kia.com.do/wp-content/uploads/2023/02/1366_2000-1.jpg',
};

/**
 * Resolves the vehicle image URL consistently for any vehicle or booking entity.
 * Priority:
 * 1. Actual database image_url / imageUrl from record
 * 2. Specific vehicle model dictionary lookup matching real database images
 * 3. Consistent, neutral generic fallback image
 */
export function getVehicleImageUrl(vehicleOrBooking) {
    if (!vehicleOrBooking) {
        return DEFAULT_VEHICLE_FALLBACK;
    }

    // 1. Prefer database image_url (or camelCase imageUrl)
    const dbUrl = vehicleOrBooking.image_url || vehicleOrBooking.imageUrl;
    if (dbUrl && typeof dbUrl === 'string' && dbUrl.trim() && dbUrl.trim() !== 'null' && dbUrl.trim() !== 'undefined') {
        return dbUrl.trim();
    }

    // 2. Exact vehicle name lookup from catalog
    const name = (vehicleOrBooking.vehicle_name || vehicleOrBooking.name || '').trim();
    if (name && vehicleImages[name]) {
        return vehicleImages[name];
    }

    // 3. Case-insensitive exact name lookup
    if (name) {
        const lowerName = name.toLowerCase();
        const matchedKey = Object.keys(vehicleImages).find(k => k.toLowerCase() === lowerName);
        if (matchedKey) {
            return vehicleImages[matchedKey];
        }
    }

    // 4. Neutral fallback image (does not substitute an unrelated car)
    return DEFAULT_VEHICLE_FALLBACK;
}

/**
 * Image error handler that safely falls back to DEFAULT_VEHICLE_FALLBACK
 * without causing an infinite error loop.
 */
export function handleVehicleImageError(event) {
    if (event && event.currentTarget) {
        if (event.currentTarget.src !== DEFAULT_VEHICLE_FALLBACK) {
            event.currentTarget.src = DEFAULT_VEHICLE_FALLBACK;
        }
    }
}

export default vehicleImages;