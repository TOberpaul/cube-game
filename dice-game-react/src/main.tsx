import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/design-system.css';
import './styles/app.css';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Check for updates on new service worker
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            // New SW is active and there's an existing controller — reload
            if (
              newWorker.state === 'activated' &&
              navigator.serviceWorker.controller
            ) {
              window.location.reload();
            }
          });
        });
      })
      .catch((error) => {
        console.warn('Service Worker registration failed:', error);
      });
  });
}
