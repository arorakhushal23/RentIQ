const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
    getWishlist,
    addToWishlist,
    removeFromWishlist
} = require('../controllers/wishlistController');

// All wishlist routes require authentication
router.use(authMiddleware);

router.get('/', getWishlist);
router.post('/', addToWishlist);
router.post('/:vehicleId', addToWishlist);
router.delete('/:vehicleId', removeFromWishlist);

module.exports = router;
