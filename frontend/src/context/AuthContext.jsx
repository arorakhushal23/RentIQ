
import { createContext, useContext, useState } from 'react'

const AuthContext = createContext()

function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            const savedUser = localStorage.getItem('user')

            return savedUser
                ? JSON.parse(savedUser)
                : null
        } catch (error) {
            console.error(
                'Failed to restore user session:',
                error
            )

            localStorage.removeItem('user')
            localStorage.removeItem('token')

            return null
        }
    })

    const login = (userData, token) => {
        localStorage.setItem(
            'user',
            JSON.stringify(userData)
        )

        localStorage.setItem(
            'token',
            token
        )

        setUser(userData)
    }

    const logout = () => {
        localStorage.removeItem('user')
        localStorage.removeItem('token')

        setUser(null)
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                login,
                logout,
                isLoggedIn: !!user,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    return useContext(AuthContext)
}

export default AuthProvider

