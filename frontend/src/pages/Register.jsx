import { useState } from 'react'
import { Link } from 'react-router-dom'
import './Register.css'

function Register() {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    const handleSubmit = (event) => {
        event.preventDefault()

        console.log({
            name,
            email,
            password,
            confirmPassword,
        })
    }

    return (
        <main className="register-page">
            <section className="register-card">

                <header className="register-header">
                    <h1>RentIQ</h1>
                    <p>Find your ride, book it, go.</p>
                </header>

                <div className="auth-tabs">
                    <Link to="/login" className="auth-tab">
                        Login
                    </Link>

                    <Link to="/register" className="auth-tab active">
                        Register
                    </Link>
                </div>

                <form className="register-form" onSubmit={handleSubmit}>

                    <div className="form-group">
                        <label htmlFor="name">Name</label>

                        <input
                            id="name"
                            type="text"
                            placeholder="Your name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email</label>

                        <input
                            id="email"
                            type="email"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>

                        <input
                            id="password"
                            type="password"
                            placeholder="Create a password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm Password</label>

                        <input
                            id="confirmPassword"
                            type="password"
                            placeholder="Confirm your password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                        />
                    </div>

                    <button type="submit" className="auth-button">
                        Create Account
                    </button>
                </form>

                <p className="auth-footer">
                    Already have an account?{' '}
                    <Link to="/login">Login</Link>
                </p>

            </section>
        </main>
    )
}

export default Register