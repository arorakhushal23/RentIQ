import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// In-memory cache for scroll positions keyed by history entry key and pathname
const scrollPositions = new Map()

function ScrollToTop() {
    const location = useLocation()
    const navigationType = useNavigationType()
    const prevLocationRef = useRef(location)

    // Ensure manual scroll restoration so browser does not fight our route-based scroll management
    useEffect(() => {
        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual'
        }
    }, [])

    // Save scroll position both continuously and immediately before navigating away
    useEffect(() => {
        const handleScroll = () => {
            scrollPositions.set(location.key, window.scrollY)
            scrollPositions.set(location.pathname, window.scrollY)
        }

        window.addEventListener('scroll', handleScroll, { passive: true })

        return () => {
            window.removeEventListener('scroll', handleScroll)
            // Record exact scroll position as page unmounts/navigates away
            scrollPositions.set(location.key, window.scrollY)
            scrollPositions.set(location.pathname, window.scrollY)
        }
    }, [location])

    useEffect(() => {
        const prevLocation = prevLocationRef.current
        const isDifferentPath = prevLocation.pathname !== location.pathname

        if (isDifferentPath) {
            if (navigationType === 'POP') {
                // Browser back/forward navigation: restore previous scroll position if recorded
                const savedY = scrollPositions.get(location.key) ?? scrollPositions.get(location.pathname)

                if (typeof savedY === 'number' && savedY > 0) {
                    window.scrollTo({ top: savedY, left: 0, behavior: 'instant' })

                    // If the target page loads data asynchronously, re-apply once height is available
                    let attempts = 0
                    const timer = setInterval(() => {
                        attempts++
                        if (window.scrollY >= savedY || attempts >= 20) {
                            clearInterval(timer)
                        } else {
                            window.scrollTo({ top: savedY, left: 0, behavior: 'instant' })
                        }
                    }, 50)
                } else {
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
                }
            } else {
                // Normal navigation ('PUSH' or 'REPLACE' to a new page route): immediately scroll to top
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
                document.documentElement.scrollTop = 0
                document.body.scrollTop = 0
            }
        }
        // If pathname is unchanged (e.g. only query parameters changed on the same page),
        // we intentionally avoid resetting scroll position.

        prevLocationRef.current = location
    }, [location, navigationType])

    return null
}

export default ScrollToTop
