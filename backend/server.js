const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config();

const db = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const contactRoutes = require('./routes/contactRoutes');
const adminRoutes = require('./routes/adminRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const licenseRoutes = require('./routes/licenseRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const locationRoutes = require('./routes/locationRoutes');
const agreementRoutes = require('./routes/agreementRoutes');
const inspectionRoutes = require('./routes/inspectionRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const pricingRoutes = require('./routes/pricingRoutes');
const aiRoutes = require('./routes/aiRoutes');
const { ensureUploadFiles } = require('./utils/ensureUploadFiles');

// Initialize upload storage and seeded sample documents
ensureUploadFiles();

const app = express();

app.use(cors({
    origin: true,
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'Content-Type']
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/licenses', licenseRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/agreements', agreementRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/ai', aiRoutes);

app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');

        res.json({
            status: 'ok',
            message: 'RentIQ backend is running',
            database: 'connected'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Database connection failed',
            error: error.message
        });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
    console.log(`RentIQ backend running on port ${PORT}`);

    try {
        await db.query('SELECT 1');
        console.log('Database connected successfully');
    } catch (error) {
        console.error(
            'Database connection failed on startup:',
            error.message
        );
    }
});
