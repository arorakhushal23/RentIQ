import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AuthProvider from './context/AuthContext.jsx'
import ThemeProvider from './context/ThemeContext.jsx'
import ToastProvider from './context/ToastContext.jsx'
import WishlistProvider from './context/WishlistContext.jsx'
import CompareProvider from './context/CompareContext.jsx'

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <ThemeProvider>
            <ToastProvider>
                <AuthProvider>
                    <WishlistProvider>
                        <CompareProvider>
                            <App />
                        </CompareProvider>
                    </WishlistProvider>
                </AuthProvider>
            </ToastProvider>
        </ThemeProvider>
    </StrictMode>,
)