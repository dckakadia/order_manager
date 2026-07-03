import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import './App.css'

import { defineCustomElements } from '@ionic/pwa-elements/loader';

// Initialize PWA elements for Capacitor web plugins
defineCustomElements(window);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
