import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './Navbar.css'

function Navbar() {
    const { isLoggedIn } = useAuth()

    return (
        <nav className="navbar">

            <div className="navbar-container">

                <Link to="/" className="navbar-logo">
                    RentIQ
                </Link>

                <div className="navbar-links">

                    <Link to="/">
                        Home
                    </Link>

                    <Link to="/vehicles">
                        Vehicles
                    </Link>

                    {!isLoggedIn ? (
                        <>
                            <Link to="/login">
                                Login
                            </Link>

                            <Link to="/register" className="navbar-register">
                                Register
                            </Link>
                        </>
                    ) : (
                        <Link to="/profile" className="navbar-profile">
                            👤
                        </Link>
                    )}

                </div>

            </div>

        </nav>
    )
}

export default Navbar