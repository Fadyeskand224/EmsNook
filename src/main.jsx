import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { PlantDefs } from './components/Plants';
import { WoodDefs } from './components/Woodwork';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PlantDefs />
    <WoodDefs />
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
