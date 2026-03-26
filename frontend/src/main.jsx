import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';

// ── Thème : appliqué avant le premier render ───────────────────────────────
// Mode 'auto' : suit l'heure (20h→8h = sombre, 8h→20h = clair)
// Mode 'manual' : choix explicite de l'utilisateur (bouton toggle)
function getTimeBasedTheme() {
  const h = new Date().getHours();
  return (h >= 20 || h < 8) ? 'dark' : 'light';
}

const themeMode = localStorage.getItem('themeMode') || 'auto';
const theme     = themeMode === 'manual'
  ? (localStorage.getItem('theme') || getTimeBasedTheme())
  : getTimeBasedTheme();

document.documentElement.setAttribute('data-theme', theme);
localStorage.setItem('theme', theme);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
