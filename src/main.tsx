import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DashboardApp } from './dashboard/DashboardApp.tsx'

// No router - there are only ever two areas, so a plain pathname check picks
// between them once, at startup. This app's nginx already serves index.html
// for any path (SPA fallback), so /dashboard and /dashboard/login both load
// this same bundle.
const isDashboard = window.location.pathname.startsWith('/dashboard')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isDashboard ? <DashboardApp /> : <App />}</StrictMode>,
)
