import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Simple render with basic error handling
const rootElement = document.getElementById('root');
if (rootElement) {
  try {
    createRoot(rootElement).render(<App />);
  } catch (error) {
    console.error('Failed to render app:', error);
    rootElement.innerHTML = `
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
            ⚠️ Application Error
          </h1>
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px; opacity: 0.9;">
            Failed to load the application. Please refresh the page.
          </p>
        </div>
      </div>
    `;
  }
} else {
  console.error('Root element not found');
}
