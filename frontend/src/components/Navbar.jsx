import { Link } from 'react-router-dom'
import './Navbar.css'

function Navbar() {
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

                    <Link to="/login">
                        Login
                    </Link>

                    <Link to="/register" className="navbar-register">
                        Register
                    </Link>

                </div>

            </div>

        </nav>
    )
}

export default Navbar