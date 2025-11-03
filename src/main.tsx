import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Browser compatibility check
function checkBrowserCompatibility() {
  const requiredFeatures = [
    typeof Promise !== 'undefined',
    typeof fetch !== 'undefined',
    typeof Map !== 'undefined',
    typeof Set !== 'undefined',
    typeof Symbol !== 'undefined',
  ];

  // Check for older iOS Safari
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iOSVersion = iOS && ua.match(/OS (\d+)_/);
  const isOldIOS = iOSVersion && parseInt(iOSVersion[1]) < 12;

  return requiredFeatures.every(Boolean) && !isOldIOS;
}

function showFallbackUI(message: string) {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 20px;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        text-align: center;
      ">
        <div style="max-width: 500px;">
          <h1 style="font-size: 24px; margin-bottom: 16px; color: #ff6b6b;">
            ⚠️ Browser Not Supported
          </h1>
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px; opacity: 0.9;">
            ${message}
          </p>
          <p style="font-size: 14px; opacity: 0.7;">
            Please update your browser or try:
          </p>
          <ul style="list-style: none; padding: 0; margin: 16px 0;">
            <li style="margin: 8px 0;">✓ Chrome (latest version)</li>
            <li style="margin: 8px 0;">✓ Safari (iOS 12+)</li>
            <li style="margin: 8px 0;">✓ Firefox (latest version)</li>
          </ul>
        </div>
      </div>
    `;
  }
}

// Check browser compatibility
if (!checkBrowserCompatibility()) {
  showFallbackUI('Your browser version is too old to run this application.');
} else {
  // Global error handler
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    showFallbackUI('An error occurred while loading the application. Please refresh the page or try a different browser.');
  });

  // Safely render the app
  try {
    const rootElement = document.getElementById('root');
    
    if (!rootElement) {
      showFallbackUI('Application root element not found. Please refresh the page.');
    } else {
      createRoot(rootElement).render(<App />);

      // Register service worker after successful render
      if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('SW registered:', registration))
            .catch(error => console.log('SW registration failed:', error));
        });
      }
    }
  } catch (error) {
    console.error('Failed to render app:', error);
    showFallbackUI('Failed to initialize the application. Please refresh the page or try a different browser.');
  }
}
