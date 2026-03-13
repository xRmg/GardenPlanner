import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/index.css'
import '@/app/i18n/config'
import App from '../app/App'
import { AppErrorBoundary } from '../app/components/AppErrorBoundary'
import { Toaster } from '../app/components/ui/sonner'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AppErrorBoundary>
            <App />
        </AppErrorBoundary>
        <Toaster position="top-right" richColors closeButton />
    </StrictMode>,
)
