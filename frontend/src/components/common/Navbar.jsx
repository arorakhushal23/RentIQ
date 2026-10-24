import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import './Navbar.css'
import rentiqLogo from '../../assets/logo/rentiq-logo.png'

function Navbar() {
    const { user, isLoggedIn } = useAuth()
    const { isDarkMode, toggleTheme } = useTheme()

    return (
        <nav className="navbar">
            <div className="navbar-container">

                <Link to="/" className="navbar-logo">
                    <img
                        src={rentiqLogo}
                        alt="RentIQ"
                    />
                </Link>

                <div className="navbar-links">

                    <Link to="/">
                        Home
                    </Link>

                    <Link to="/vehicles">
                        Vehicles
                    </Link>

                    <Link to="/contact">
                        Contact
                    </Link>

                    {user?.role === 'admin' && (
                        <Link to="/admin" className="navbar-admin">
                            Admin
                        </Link>
                    )}

                    {!isLoggedIn ? (
                        <>
                            <Link to="/login">
                                Login
                            </Link>

                            <Link
                                to="/register"
                                className="navbar-register"
                            >
                                Register
                            </Link>
                        </>
                    ) : (
                        <Link
                            to="/profile"
                            className="navbar-profile"
                            aria-label="Profile"
                        >
                            <span>👤</span>
                        </Link>
                    )}

                    <button
                        type="button"
                        className="theme-toggle-btn"
                        onClick={toggleTheme}
                        aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                        title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
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

                </div>

            </div>
        </nav>
    )
}

export default Navbar