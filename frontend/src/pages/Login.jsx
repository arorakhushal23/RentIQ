import { useState } from 'react'
import { Link } from 'react-router-dom'
import './Login.css'

function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const handleSubmit = (event) => {
        event.preventDefault()

        console.log({
            email,
            password,
        })
    }

    return (
        <main className="login-page">
            <section className="login-card">

                <header className="login-header">
                    <h1>RentIQ</h1>
                    <p>Find your ride, book it, go.</p>
                </header>

                <div className="auth-tabs">
                    <Link to="/login" className="auth-tab active">
                        Login
                    </Link>

                    <Link to="/register" className="auth-tab">
                        Register
                    </Link>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>

                    <div className="form-group">
                        <label htmlFor="login-email">Email</label>

                        <input
                            id="login-email"
                            type="email"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="login-password">Password</label>

                        <input
                            id="login-password"
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                        />
                    </div>

                    <button type="submit" className="auth-button">
                        Login
                    </button>
                </form>

                <p className="auth-footer">
                    No account?{' '}
                    <Link to="/register">Register</Link>
                </p>

            </section>
        </main>
    )
}

export default Login