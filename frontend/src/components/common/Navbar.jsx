import { useState, useEffect, useRef } from 'react'
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useWishlist } from '../../context/WishlistContext'
import rentiqLogo from '../../assets/logo/rentiq-logo.png'
import rentiqLogoDark from '../../assets/logo/rentiq-logo-dark.png'
import './Navbar.css'

function Navbar() {
    const { user, isLoggedIn, logout } = useAuth()
    const { isDarkMode, toggleTheme } = useTheme()
    const { wishlistCount } = useWishlist()
    const navigate = useNavigate()
    const location = useLocation()

    const currentLogo = isDarkMode ? rentiqLogoDark : rentiqLogo

    // Search state
    const [searchQuery, setSearchQuery] = useState('')
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)

    // Dropdown and Mobile drawer states
    const [isProfileOpen, setIsProfileOpen] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    const profileRef = useRef(null)
    const searchInputRef = useRef(null)
    const mobileSearchInputRef = useRef(null)

    const locationKey = location.pathname + location.search
    const [prevLocationKey, setPrevLocationKey] = useState(locationKey)

    if (prevLocationKey !== locationKey) {
        setPrevLocationKey(locationKey)
        const params = new URLSearchParams(location.search)
        setSearchQuery(location.pathname === '/vehicles' ? (params.get('search') || '') : '')
        setIsProfileOpen(false)
        setIsMobileMenuOpen(false)
        setIsMobileSearchOpen(false)
    }

    // Lock body scroll when mobile menu is open
    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [isMobileMenuOpen])

    // Handle click outside & escape key
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setIsProfileOpen(false)
            }
        }

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsProfileOpen(false)
                setIsMobileMenuOpen(false)
                setIsMobileSearchOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [])

    // Focus mobile search input when mobile search is toggled
    useEffect(() => {
        if (isMobileSearchOpen && mobileSearchInputRef.current) {
            mobileSearchInputRef.current.focus()
        }
    }, [isMobileSearchOpen])

    const handleSearchSubmit = (e) => {
        e.preventDefault()
        const trimmed = searchQuery.trim()
        if (trimmed) {
            navigate(`/vehicles?search=${encodeURIComponent(trimmed)}`)
        } else {
            navigate('/vehicles')
        }
        setIsMobileSearchOpen(false)
    }

    const handleClearSearch = () => {
        setSearchQuery('')
        if (location.pathname === '/vehicles') {
            navigate('/vehicles')
        }
        if (searchInputRef.current) {
            searchInputRef.current.focus()
        }
    }

    const handleLogout = () => {
        setIsProfileOpen(false)
        setIsMobileMenuOpen(false)
        logout()
        navigate('/')
    }

    // Avatar display logic
    const userInitial = user?.name ? user.name.trim().charAt(0).toUpperCase() : null

    // Wishlist count formatted (caps at 99+)
    const formattedWishlistCount = wishlistCount > 99 ? '99+' : wishlistCount

    return (
        <nav className="navbar" role="navigation" aria-label="Main Navigation">
            <div className="navbar-container">

                {/* 1. Left Section — Brand Logo */}
                <div className="navbar-brand">
                    <Link to="/" className="navbar-logo" aria-label="RentIQ Home">
                        <img
                            src={currentLogo}
                            alt="RentIQ"
                            className="navbar-logo-img"
                        />
                    </Link>
                </div>

                {/* 2. Center Section — Main Navigation Links */}
                <div className="navbar-nav-center">
                    <NavLink
                        to="/"
                        end
                        className={({ isActive }) => `navbar-nav-link ${isActive ? 'active' : ''}`}
                    >
                        <span>Home</span>
                    </NavLink>

                    <NavLink
                        to="/vehicles"
                        className={({ isActive }) => `navbar-nav-link ${isActive ? 'active' : ''}`}
                    >
                        <span>Vehicles</span>
                    </NavLink>

                    <NavLink
                        to="/contact"
                        className={({ isActive }) => `navbar-nav-link ${isActive ? 'active' : ''}`}
                    >
                        <span>Contact</span>
                    </NavLink>
                </div>

                {/* 3. Right Section — Search, Wishlist, Profile, Theme */}
                <div className="navbar-actions">

                    {/* Desktop Vehicle Search */}
                    <form
                        className="navbar-search-desktop"
                        onSubmit={handleSearchSubmit}
                        role="search"
                        aria-label="Search vehicles"
                    >
                        <div className="navbar-search-box">
                            <svg
                                className="navbar-search-icon"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>

                            <input
                                ref={searchInputRef}
                                type="text"
                                className="navbar-search-input"
                                placeholder="Search vehicles..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                aria-label="Search vehicles"
                            />

                            {searchQuery && (
                                <button
                                    type="button"
                                    className="navbar-search-clear-btn"
                                    onClick={handleClearSearch}
                                    aria-label="Clear search text"
                                    title="Clear search"
                                >
                                    &times;
                                </button>
                            )}
                        </div>
                    </form>

                    {/* Mobile Search Toggle Button */}
                    <button
                        type="button"
                        className={`navbar-action-btn navbar-search-toggle-btn ${isMobileSearchOpen ? 'active' : ''}`}
                        onClick={() => setIsMobileSearchOpen((prev) => !prev)}
                        aria-label="Toggle search field"
                        title="Search vehicles"
                        aria-expanded={isMobileSearchOpen}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                    </button>

                    {/* Wishlist Icon Button (Icon Only — No "Wishlist" text) */}
                    <Link
                        to="/wishlist"
                        className={`navbar-action-btn navbar-wishlist-btn ${wishlistCount > 0 ? 'has-items' : ''}`}
                        aria-label={`Wishlist${wishlistCount > 0 ? ` (${wishlistCount} items)` : ''}`}
                        title="Wishlist"
                        id="nav-wishlist-btn"
                    >
                        <svg
                            className={`navbar-heart-icon ${wishlistCount > 0 ? 'filled' : ''}`}
                            viewBox="0 0 24 24"
                            fill={wishlistCount > 0 ? '#ef4444' : 'none'}
                            stroke={wishlistCount > 0 ? '#ef4444' : 'currentColor'}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>

                        {/* Dynamic Count Badge — Hidden when count is 0 */}
                        {wishlistCount > 0 && (
                            <span className="navbar-wishlist-badge" id="nav-wishlist-count">
                                {formattedWishlistCount}
                            </span>
                        )}
                    </Link>

                    {/* Profile Button and Dropdown Menu */}
                    <div className="navbar-profile-wrapper" ref={profileRef}>
                        <button
                            type="button"
                            className={`navbar-action-btn navbar-profile-trigger ${isProfileOpen ? 'active' : ''}`}
                            onClick={() => setIsProfileOpen((prev) => !prev)}
                            aria-label="User account menu"
                            aria-haspopup="true"
                            aria-expanded={isProfileOpen}
                            id="navbar-profile-trigger"
                            title="Account menu"
                        >
                            {userInitial ? (
                                <span className="profile-avatar-initial">{userInitial}</span>
                            ) : (
                                <svg
                                    className="profile-avatar-icon"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            )}
                        </button>

                        {/* Profile Dropdown Menu */}
                        {isProfileOpen && (
                            <div
                                className="navbar-profile-dropdown"
                                role="menu"
                                aria-label="Account options"
                                id="navbar-profile-dropdown"
                            >
                                {isLoggedIn ? (
                                    <>
                                        <div className="profile-dropdown-header">
                                            <div className="profile-dropdown-avatar">
                                                {userInitial || 'U'}
                                            </div>
                                            <div className="profile-dropdown-user-details">
                                                <div className="profile-dropdown-name" title={user?.name}>
                                                    {user?.name || 'Customer'}
                                                </div>
                                                {user?.email && (
                                                    <div className="profile-dropdown-email" title={user.email}>
                                                        {user.email}
                                                    </div>
                                                )}
                                                {user?.role === 'admin' && (
                                                    <span className="profile-dropdown-role-tag">Admin</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="profile-dropdown-divider" />

                                        <Link
                                            to="/profile"
                                            className="profile-dropdown-item"
                                            role="menuitem"
                                            onClick={() => setIsProfileOpen(false)}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                <circle cx="12" cy="7" r="4" />
                                            </svg>
                                            <span>My Profile</span>
                                        </Link>

                                        <Link
                                            to="/wishlist"
                                            className="profile-dropdown-item"
                                            role="menuitem"
                                            onClick={() => setIsProfileOpen(false)}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                            </svg>
                                            <span className="profile-dropdown-item-label">My Wishlist</span>
                                            {wishlistCount > 0 && (
                                                <span className="profile-dropdown-badge">
                                                    {formattedWishlistCount}
                                                </span>
                                            )}
                                        </Link>

                                        {user?.role === 'admin' && (
                                            <Link
                                                to="/admin"
                                                className="profile-dropdown-item"
                                                role="menuitem"
                                                onClick={() => setIsProfileOpen(false)}
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                    <rect x="3" y="3" width="7" height="7" />
                                                    <rect x="14" y="3" width="7" height="7" />
                                                    <rect x="14" y="14" width="7" height="7" />
                                                    <rect x="3" y="14" width="7" height="7" />
                                                </svg>
                                                <span>Admin Dashboard</span>
                                            </Link>
                                        )}

                                        <div className="profile-dropdown-divider" />

                                        <button
                                            type="button"
                                            className="profile-dropdown-item logout-action"
                                            role="menuitem"
                                            onClick={handleLogout}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                                <polyline points="16 17 21 12 16 7" />
                                                <line x1="21" y1="12" x2="9" y2="12" />
                                            </svg>
                                            <span>Logout</span>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div className="profile-dropdown-guest-header">
                                            <div className="guest-header-title">Welcome to RentIQ</div>
                                            <div className="guest-header-subtitle">Sign in to manage your bookings and wishlist.</div>
                                        </div>

                                        <div className="profile-dropdown-divider" />

                                        <Link
                                            to="/login"
                                            className="profile-dropdown-item login-action"
                                            role="menuitem"
                                            onClick={() => setIsProfileOpen(false)}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                                                <polyline points="10 17 15 12 10 7" />
                                                <line x1="15" y1="12" x2="3" y2="12" />
                                            </svg>
                                            <span>Login</span>
                                        </Link>

                                        <Link
                                            to="/register"
                                            className="profile-dropdown-item register-action"
                                            role="menuitem"
                                            onClick={() => setIsProfileOpen(false)}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                                <circle cx="8.5" cy="7" r="4" />
                                                <line x1="20" y1="8" x2="20" y2="14" />
                                                <line x1="23" y1="11" x2="17" y2="11" />
                                            </svg>
                                            <span>Create Account</span>
                                        </Link>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Theme Toggle Button */}
                    <button
                        type="button"
                        className="navbar-action-btn theme-toggle-btn"
                        onClick={toggleTheme}
                        aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                        title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                        id="navbar-theme-toggle"
                    >
                        {isDarkMode ? (
                            <svg
                                className="theme-toggle-icon sun-icon"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <circle cx="12" cy="12" r="5" fill="currentColor" fillOpacity="0.25" />
                                <line x1="12" y1="1" x2="12" y2="3" />
                                <line x1="12" y1="21" x2="12" y2="23" />
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                <line x1="1" y1="12" x2="3" y2="12" />
                                <line x1="21" y1="12" x2="23" y2="12" />
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                            </svg>
                        ) : (
                            <svg
                                className="theme-toggle-icon moon-icon"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path
                                    d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                                    fill="currentColor"
                                    fillOpacity="0.2"
                                />
                            </svg>
                        )}
                    </button>

                    {/* Mobile Hamburger Menu Button */}
                    <button
                        type="button"
                        className={`navbar-hamburger-btn ${isMobileMenuOpen ? 'open' : ''}`}
                        onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                        aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                        aria-expanded={isMobileMenuOpen}
                        aria-controls="navbar-mobile-drawer"
                        id="navbar-hamburger-btn"
                    >
                        <span className="hamburger-bar top" />
                        <span className="hamburger-bar middle" />
                        <span className="hamburger-bar bottom" />
                    </button>

                </div>

            </div>

            {/* Mobile Collapsible Search Panel */}
            {isMobileSearchOpen && (
                <div className="navbar-mobile-search-panel" id="navbar-mobile-search">
                    <form
                        className="mobile-search-form"
                        onSubmit={handleSearchSubmit}
                        role="search"
                    >
                        <svg
                            className="navbar-search-icon"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            ref={mobileSearchInputRef}
                            type="text"
                            className="mobile-search-input"
                            placeholder="Search vehicles..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            aria-label="Search vehicles"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                className="navbar-search-clear-btn"
                                onClick={handleClearSearch}
                                aria-label="Clear search"
                            >
                                &times;
                            </button>
                        )}
                        <button
                            type="button"
                            className="mobile-search-close-btn"
                            onClick={() => setIsMobileSearchOpen(false)}
                            aria-label="Close search"
                        >
                            Cancel
                        </button>
                    </form>
                </div>
            )}

            {/* Mobile Navigation Drawer Backdrop Overlay */}
            <div
                className={`navbar-mobile-backdrop ${isMobileMenuOpen ? 'visible' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
                aria-hidden="true"
            />

            {/* Mobile Navigation Expanded Drawer */}
            <aside
                className={`navbar-mobile-drawer ${isMobileMenuOpen ? 'open' : ''}`}
                id="navbar-mobile-drawer"
                role="dialog"
                aria-modal="true"
                aria-label="Mobile Navigation Menu"
            >
                <div className="mobile-drawer-header">
                    <Link
                        to="/"
                        className="mobile-drawer-logo"
                        onClick={() => setIsMobileMenuOpen(false)}
                        aria-label="RentIQ Home"
                    >
                        <img src={currentLogo} alt="RentIQ" />
                    </Link>

                    <button
                        type="button"
                        className="mobile-drawer-close-btn"
                        onClick={() => setIsMobileMenuOpen(false)}
                        aria-label="Close menu"
                        id="mobile-drawer-close-btn"
                    >
                        &times;
                    </button>
                </div>

                {/* Mobile Drawer User Card */}
                {isLoggedIn && (
                    <div className="mobile-drawer-user-card">
                        <div className="mobile-drawer-avatar">
                            {userInitial || 'U'}
                        </div>
                        <div className="mobile-drawer-user-info">
                            <span className="mobile-user-name">{user?.name || 'Customer'}</span>
                            {user?.email && (
                                <span className="mobile-user-email">{user.email}</span>
                            )}
                            {user?.role === 'admin' && (
                                <span className="profile-dropdown-role-tag">Admin</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Mobile Drawer Navigation Links */}
                <div className="mobile-drawer-links">
                    <NavLink
                        to="/"
                        end
                        className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        <span>Home</span>
                    </NavLink>

                    <NavLink
                        to="/vehicles"
                        className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="1" y="3" width="15" height="13" />
                            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                            <circle cx="5.5" cy="18.5" r="2.5" />
                            <circle cx="18.5" cy="18.5" r="2.5" />
                        </svg>
                        <span>Vehicles</span>
                    </NavLink>

                    <NavLink
                        to="/contact"
                        className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <polyline points="22,6 12,13 2,6" />
                        </svg>
                        <span>Contact</span>
                    </NavLink>

                    <div className="mobile-drawer-divider" />

                    {/* Wishlist Link inside Drawer (allowed to contain text "My Wishlist") */}
                    <NavLink
                        to="/wishlist"
                        className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill={wishlistCount > 0 ? '#ef4444' : 'none'}
                            stroke={wishlistCount > 0 ? '#ef4444' : 'currentColor'}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06-1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                        <span className="mobile-nav-label">My Wishlist</span>
                        {wishlistCount > 0 && (
                            <span className="mobile-nav-badge">
                                {formattedWishlistCount}
                            </span>
                        )}
                    </NavLink>

                    {isLoggedIn ? (
                        <>
                            <NavLink
                                to="/profile"
                                className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                                <span>My Profile</span>
                            </NavLink>

                            {user?.role === 'admin' && (
                                <NavLink
                                    to="/admin"
                                    className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <rect x="3" y="3" width="7" height="7" />
                                        <rect x="14" y="3" width="7" height="7" />
                                        <rect x="14" y="14" width="7" height="7" />
                                        <rect x="3" y="14" width="7" height="7" />
                                    </svg>
                                    <span>Admin Dashboard</span>
                                </NavLink>
                            )}

                            <div className="mobile-drawer-divider" />

                            <button
                                type="button"
                                className="mobile-nav-link mobile-logout-btn"
                                onClick={handleLogout}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                                <span>Logout</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="mobile-drawer-divider" />

                            <NavLink
                                to="/login"
                                className="mobile-nav-link mobile-login-btn"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                                    <polyline points="10 17 15 12 10 7" />
                                    <line x1="15" y1="12" x2="3" y2="12" />
                                </svg>
                                <span>Login</span>
                            </NavLink>

                            <NavLink
                                to="/register"
                                className="mobile-nav-link mobile-register-action"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="8.5" cy="7" r="4" />
                                    <line x1="20" y1="8" x2="20" y2="14" />
                                    <line x1="23" y1="11" x2="17" y2="11" />
                                </svg>
                                <span>Create Account</span>
                            </NavLink>
                        </>
                    )}
                </div>
            </aside>
        </nav>
    )
}

export default Navbar