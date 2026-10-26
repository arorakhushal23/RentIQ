import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import store from './store/index.js'
import './index.css'
import App from './App.jsx'
import AuthProvider from './context/AuthContext.jsx'
import ThemeProvider from './context/ThemeContext.jsx'
import ToastProvider from './context/ToastContext.jsx'
import WishlistProvider from './context/WishlistContext.jsx'
import CompareProvider from './context/CompareContext.jsx'

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <Provider store={store}>
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
        </Provider>
    </StrictMode>,
)
