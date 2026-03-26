import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PAGE_TITLES = {
  '/dashboard': 'Tableau de bord',
  '/leads': 'Leads',
  '/dossiers': 'Dossiers apprenants',
  '/finance': 'Finance',
  '/agenda': 'Agenda',
  '/reporting': 'Reporting',
  '/parametrage/utilisateurs': 'Paramétrage — Utilisateurs',
  '/parametrage/formations': 'Paramétrage — Formations',
  '/parametrage/sessions': 'Paramétrage — Sessions',
  '/profil': 'Mon profil',
};

// 20h → 8h = sombre, 8h → 20h = clair
function getTimeBasedTheme() {
  const h = new Date().getHours();
  return (h >= 20 || h < 8) ? 'dark' : 'light';
}

export default function Topbar() {
  const { pathname } = useLocation();

  const [themeMode, setThemeMode] = useState(
    () => localStorage.getItem('themeMode') || 'auto'
  );
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || getTimeBasedTheme()
  );

  // Appliquer le thème au DOM + le sauvegarder
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Mode AUTO : vérifier l'heure toutes les minutes et basculer si nécessaire
  useEffect(() => {
    if (themeMode !== 'auto') return;

    function syncTime() {
      setTheme(getTimeBasedTheme());
    }

    syncTime(); // appliquer immédiatement
    const interval = setInterval(syncTime, 60_000); // vérifier chaque minute
    return () => clearInterval(interval);
  }, [themeMode]);

  // Bouton toggle : passe en mode manuel et inverse le thème
  function toggleTheme() {
    if (themeMode === 'auto') {
      // Premier clic : passer en manuel avec le thème opposé à l'heure actuelle
      const next = theme === 'dark' ? 'light' : 'dark';
      setThemeMode('manual');
      localStorage.setItem('themeMode', 'manual');
      setTheme(next);
    } else {
      // Déjà en manuel : simple bascule
      setTheme(t => t === 'light' ? 'dark' : 'light');
    }
  }

  // Bouton "Auto" : repasser en mode heure automatique
  function resetAuto() {
    setThemeMode('auto');
    localStorage.setItem('themeMode', 'auto');
    setTheme(getTimeBasedTheme());
  }

  const title = PAGE_TITLES[pathname] || 'LeadFlow CRM';
  const isAuto = themeMode === 'auto';

  return (
    <div className="topbar">
      <span className="topbar-title">{title}</span>

      <div className="search-box">
        <span style={{ fontSize: 13, color: 'var(--txt3)' }}>🔍</span>
        <input placeholder="Rechercher…" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button className="theme-toggle" onClick={toggleTheme} title={isAuto ? 'Mode auto (heure) — cliquer pour forcer' : 'Cliquer pour changer'}>
          <span className="toggle-icon">{theme === 'light' ? '🌙' : '☀️'}</span>
          {theme === 'light' ? 'Sombre' : 'Clair'}
          {isAuto && <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 4 }}>auto</span>}
        </button>

        {/* Bouton reset visible seulement en mode manuel */}
        {!isAuto && (
          <button
            onClick={resetAuto}
            title="Repasser en mode automatique (heure)"
            style={{
              background: 'none', border: '1px solid var(--border)',
              borderRadius: 6, padding: '3px 7px', cursor: 'pointer',
              fontSize: 11, color: 'var(--txt3)',
            }}
          >
            ⟳ auto
          </button>
        )}
      </div>
    </div>
  );
}
