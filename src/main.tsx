import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DashboardApp } from './dashboard/DashboardApp.tsx'
import { SerialCheckApp } from './serial-check/SerialCheckApp.tsx'

// No router - there are only ever three areas, so a plain pathname check
// picks between them once, at startup. This app's nginx already serves
// index.html for any path (SPA fallback), so /dashboard, /dashboard/login
// and /serial-check all load this same bundle.
const path = window.location.pathname
const isDashboard = path.startsWith('/dashboard')
// Deliberately no login, unlike the other two areas - see SerialCheckApp.tsx
// for why.
const isSerialCheck = path.startsWith('/serial-check')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isDashboard ? <DashboardApp /> : isSerialCheck ? <SerialCheckApp /> : <App />}
  </StrictMode>,
)
