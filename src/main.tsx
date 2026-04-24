import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Basic environment check
console.log("PIPELINE MAIN START");
try {
  if (window.fetch) {
    console.log("Native fetch detected");
  }
} catch(e) {
  console.error("Fetch detection error:", e);
}

// Global error handler to catch non-fatal errors that might block execution
window.onerror = (message, source, lineno, colno, error) => {
  console.error("GLOBAL ERROR:", message, "at", source, lineno, colno, error);
  // Prevent default handling if it's the recursive fetch error
  if (typeof message === 'string' && message.includes('fetch')) {
    console.warn("Recovering from fetch-related error...");
    return true; 
  }
  return false;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
