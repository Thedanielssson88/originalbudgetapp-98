import React from 'react'
import { createRoot } from 'react-dom/client'
import './polyfills'
import './debug-env'
import App from './App.tsx'
import './index.css'

// Force reload timestamp: 2025-01-14T18:05:00Z - FIXED OAUTH DOMAIN
console.log('🚀 Main.tsx loaded - Fixed OAuth domain to app.stack-auth.com:', {
  projectId: import.meta.env.VITE_STACK_PROJECT_ID,
  publishableKey: import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY ? 'Set' : 'Missing',
  mode: import.meta.env.MODE
});

createRoot(document.getElementById("root")!).render(<App />);
