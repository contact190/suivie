import React, { useState } from 'react';
import {
  Target,
  Clock,
  Layers,
  Ruler,
  Plus,
  Save,
  CheckCircle,
  HelpCircle,
  Zap,
  RotateCcw,
  Sliders,
  Sparkles,
  Info,
  Check,
  Building2,
  Cpu
} from 'lucide-react';
import {
  getStoredGammes,
  saveStoredGamme,
  getGammeTargets,
  saveGammeTargets,
  getDailySizeTargets,
  saveDailySizeTargets,
  HEIGHT_WIDTH_RANGES,
  DEFAULT_GAMME_TARGETS,
  DEFAULT_DAILY_SIZE_TARGETS,
  calculateOrderSmartTarget
} from '../services/storage';

export default function GammeTargetsPage() {
  const [activeSubTab, setActiveSubTab] = useState('gammes'); // 'gammes' | 'daily' | 'simulator'
  
  // Gammes list & Gamme Target times state
  const [gammesList, setGammesList] = useState(() => getStoredGammes());
  const [gammeTargets, setGammeTargetsState] = useState(() => getGammeTargets());
  const [dailyTargets, setDailyTargetsState] = useState(() => getDailySizeTargets());
  
  // Add Gamme form state
  const [newGammeName, setNewGammeName] = useState('');
  const [newGammeBaseTime, setNewGammeBaseTime] = useState(45);
  const [newGammeCoulissantTime, setNewGammeCoulissantTime] = useState(50);
  const [newGammeOuvrantTime, setNewGammeOuvrantTime] = useState(40);

  // Status message
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Interactive simulator state
  const [simGamme, setSimGamme] = useState(gammesList[0] || 'h36 2p');
  const [simType, setSimType] = useState('Coulissant');
  const [simHeight, setSimHeight] = useState('1500 - 2000 mm');
  const [simWidth, setSimWidth] = useState('1000 - 1500 mm');
  const [simCaisson, setSimCaisson] = useState(false);
  const [simFixe, setSimFixe] = useState(false);
  const [simQty, setSimQty] = useState(1);

  // Save all Gammes Targets
  const handleSaveGammeTargets = () => {
    saveGammeTargets(gammeTargets);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Save Daily Size Targets
  const handleSaveDailyTargets = () => {
    saveDailySizeTargets(dailyTargets);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Add a new Gamme
  const handleAddGamme = (e) => {
    e.preventDefault();
    if (!newGammeName.trim()) return;
    const trimmed = newGammeName.trim();
    saveStoredGamme(trimmed);
    const updatedGammes = getStoredGammes();
    setGammesList(updatedGammes);

    const updatedTargets = {
      ...gammeTargets,
      [trimmed]: {
        targetTimeMinutes: parseInt(newGammeBaseTime) || 45,
        targetCoulissantMinutes: parseInt(newGammeCoulissantTime) || 50,
        targetOuvrantMinutes: parseInt(newGammeOuvrantTime) || 40
      }
    };
    setGammeTargetsState(updatedTargets);
    saveGammeTargets(updatedTargets);

    setNewGammeName('');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Handler for target field update
  const handleGammeChange = (gamme, field, value) => {
    const num = Math.max(1, parseInt(value) || 0);
    setGammeTargetsState(prev => ({
      ...prev,
      [gamme]: {
        ...(prev[gamme] || { targetTimeMinutes: 45, targetCoulissantMinutes: 50, targetOuvrantMinutes: 40 }),
        [field]: num
      }
    }));
  };

  const handleDailyChange = (range, field, value) => {
    const num = Math.max(0, parseInt(value) || 0);
    setDailyTargetsState(prev => ({
      ...prev,
      [range]: {
        ...(prev[range] || { coulissantDailyTarget: 10, ouvrantDailyTarget: 12 }),
        [field]: num
      }
    }));
  };

  // Reset to default presets
  const handleResetDefaults = () => {
    if (window.confirm('Voulez-vous réinitialiser tous les objectifs aux valeurs d\'usine standards ?')) {
      setGammeTargetsState(DEFAULT_GAMME_TARGETS);
      saveGammeTargets(DEFAULT_GAMME_TARGETS);
      setDailyTargetsState(DEFAULT_DAILY_SIZE_TARGETS);
      saveDailySizeTargets(DEFAULT_DAILY_SIZE_TARGETS);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  // Compute total target daily capacity
  const totalDailyCapacityCoulissant = Object.values(dailyTargets).reduce((acc, curr) => acc + (curr.coulissantDailyTarget || 0), 0);
  const totalDailyCapacityOuvrant = Object.values(dailyTargets).reduce((acc, curr) => acc + (curr.ouvrantDailyTarget || 0), 0);
  const totalDailyCapacityCombined = totalDailyCapacityCoulissant + totalDailyCapacityOuvrant;

  // Simulator calculation result
  const dummyOrderForSim = {
    status: 'en_attente',
    articles: [
      {
        id: 'SIM-ART-1',
        designation: `Menuiserie ${simType} ${simGamme}`,
        gamme: simGamme,
        typeMenuiserie: simType,
        hauteur: simHeight,
        largeur: simWidth,
        avecCaisson: simCaisson,
        avecFixe: simFixe,
        quantity: simQty
      }
    ]
  };
  const simResult = calculateOrderSmartTarget(dummyOrderForSim, gammeTargets);

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#ffffff',
        padding: '28px',
        borderRadius: 'var(--radius-lg)',
        marginBottom: '24px',
        boxShadow: 'var(--shadow-glow)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                background: 'var(--gradient-brand)',
                padding: '12px',
                borderRadius: '16px',
                display: 'flex',
                boxShadow: '0 4px 20px rgba(2, 132, 199, 0.4)'
              }}>
                <Target size={32} style={{ color: '#fff' }} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: '800', margin: 0 }}>
                  Gestion des Gammes & Temps Moyen Souhaité
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '0.92rem', marginTop: '4px' }}>
                  Définissez les objectifs de temps par Gamme / Type et la capacité de production par tranche de dimensions.
                </p>
              </div>
            </div>

            {/* Global Success Notification Badge */}
            {saveSuccess && (
              <div className="animate-fade-in" style={{
                background: '#10b981',
                color: '#ffffff',
                padding: '8px 16px',
                borderRadius: '20px',
                fontWeight: '700',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
              }}>
                <CheckCircle size={18} /> Modifications enregistrées !
              </div>
            )}
          </div>

          {/* Sub Navigation Tabs */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '24px', flexWrap: 'wrap' }}>
            <button
              className={`btn ${activeSubTab === 'gammes' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveSubTab('gammes')}
              style={{
                borderColor: activeSubTab === 'gammes' ? 'transparent' : '#334155',
                color: activeSubTab === 'gammes' ? '#fff' : '#cbd5e1',
                background: activeSubTab === 'gammes' ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.05)'
              }}
            >
              <Clock size={18} /> Temps par Gamme & Type
            </button>

            <button
              className={`btn ${activeSubTab === 'daily' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveSubTab('daily')}
              style={{
                borderColor: activeSubTab === 'daily' ? 'transparent' : '#334155',
                color: activeSubTab === 'daily' ? '#fff' : '#cbd5e1',
                background: activeSubTab === 'daily' ? 'var(--accent-emerald)' : 'rgba(255, 255, 255, 0.05)'
              }}
            >
              <Ruler size={18} /> Objectif / Jour par Tranche & Type
            </button>

            <button
              className={`btn ${activeSubTab === 'simulator' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveSubTab('simulator')}
              style={{
                borderColor: activeSubTab === 'simulator' ? 'transparent' : '#334155',
                color: activeSubTab === 'simulator' ? '#fff' : '#cbd5e1',
                background: activeSubTab === 'simulator' ? 'var(--accent-purple)' : 'rgba(255, 255, 255, 0.05)'
              }}
            >
              <Cpu size={18} /> Simulateur & Calcul Intelligent
            </button>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* TAB 1: TEMPS PAR GAMME ET TYPE */}
      {/* ---------------------------------------------------- */}
      {activeSubTab === 'gammes' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
          
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers style={{ color: 'var(--accent-cyan)' }} />
                  Objectifs de Temps Moyen de Fabrication (Minutes)
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '2px' }}>
                  Ajustez les temps moyens cibles souhaités pour chaque gamme. Utilisés par le Dashboard pour comparer le réel vs objectif.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleResetDefaults}
                  title="Réinitialiser aux valeurs standards"
                >
                  <RotateCcw size={16} /> Valeurs par Défaut
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveGammeTargets}
                  style={{ background: 'var(--accent-cyan)' }}
                >
                  <Save size={18} /> Enregistrer Cibles Gammes
                </button>
              </div>
            </div>

            {/* GAMMES OBJECTIVES TABLE */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.92rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                    <th style={{ padding: '12px 16px' }}>Gamme</th>
                    <th style={{ padding: '12px 16px' }}>⏱️ Temps Moyen Global (min)</th>
                    <th style={{ padding: '12px 16px' }}>⚡ Temps Coulissant (min)</th>
                    <th style={{ padding: '12px 16px' }}>🚪 Temps Ouvrant / Frappe (min)</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Statut Objectif</th>
                  </tr>
                </thead>
                <tbody>
                  {gammesList.map(gamme => {
                    const conf = gammeTargets[gamme] || { targetTimeMinutes: 45, targetCoulissantMinutes: 50, targetOuvrantMinutes: 40 };
                    return (
                      <tr key={gamme} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                        <td style={{ padding: '14px 16px', fontWeight: '800', color: 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="badge badge-purple">{gamme}</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: '110px', fontWeight: 'bold', fontSize: '0.95rem' }}
                            value={conf.targetTimeMinutes || 45}
                            onChange={(e) => handleGammeChange(gamme, 'targetTimeMinutes', e.target.value)}
                            min="1"
                          />
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: '110px', fontWeight: 'bold', fontSize: '0.95rem', borderColor: 'var(--accent-cyan)' }}
                            value={conf.targetCoulissantMinutes || 50}
                            onChange={(e) => handleGammeChange(gamme, 'targetCoulissantMinutes', e.target.value)}
                            min="1"
                          />
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: '110px', fontWeight: 'bold', fontSize: '0.95rem', borderColor: 'var(--accent-purple)' }}
                            value={conf.targetOuvrantMinutes || 40}
                            onChange={(e) => handleGammeChange(gamme, 'targetOuvrantMinutes', e.target.value)}
                            min="1"
                          />
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <span className="badge badge-emerald" style={{ fontSize: '0.75rem' }}>
                            Actif
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ADD NEW GAMME CARD */}
          <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid var(--accent-emerald)' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus style={{ color: 'var(--accent-emerald)' }} />
              Ajouter une Nouvelle Gamme & Ses Cibles
            </h4>
            
            <form onSubmit={handleAddGamme} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', alignItems: 'flex-end' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.84rem' }}>Nom de la Gamme *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: h50 Premium"
                  value={newGammeName}
                  onChange={(e) => setNewGammeName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.84rem' }}>Temps Global (min)</label>
                <input
                  type="number"
                  className="form-input"
                  value={newGammeBaseTime}
                  onChange={(e) => setNewGammeBaseTime(e.target.value)}
                  min="1"
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.84rem' }}>Temps Coulissant (min)</label>
                <input
                  type="number"
                  className="form-input"
                  value={newGammeCoulissantTime}
                  onChange={(e) => setNewGammeCoulissantTime(e.target.value)}
                  min="1"
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.84rem' }}>Temps Ouvrant (min)</label>
                <input
                  type="number"
                  className="form-input"
                  value={newGammeOuvrantTime}
                  onChange={(e) => setNewGammeOuvrantTime(e.target.value)}
                  min="1"
                />
              </div>

              <div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', background: 'var(--accent-emerald)' }}>
                  <Plus size={18} /> Créer Gamme
                </button>
              </div>
            </form>
          </div>

        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 2: OBJECTIF PAR JOUR PAR TRANCHE & TYPE */}
      {/* ---------------------------------------------------- */}
      {activeSubTab === 'daily' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
          
          {/* Summary Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-cyan)' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-muted)' }}>OBJECTIF CUMULÉ COULISSANTS</div>
              <div style={{ fontSize: '2.2rem', fontWeight: '800', marginTop: '4px', color: 'var(--accent-cyan)' }}>
                {totalDailyCapacityCoulissant} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>fenêtres / jour</span>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-purple)' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-muted)' }}>OBJECTIF CUMULÉ OUVRANTS</div>
              <div style={{ fontSize: '2.2rem', fontWeight: '800', marginTop: '4px', color: 'var(--accent-purple)' }}>
                {totalDailyCapacityOuvrant} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>fenêtres / jour</span>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-emerald)' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-muted)' }}>CAPACITÉ TOTAL ATELIER</div>
              <div style={{ fontSize: '2.2rem', fontWeight: '800', marginTop: '4px', color: 'var(--accent-emerald)' }}>
                {totalDailyCapacityCombined} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>fenêtres / jour</span>
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Ruler style={{ color: 'var(--accent-emerald)' }} />
                  Objectif de Nombre de Fenêtres / Jour par Tranche & Type
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '2px' }}>
                  Définissez l'objectif quotidien d'unités produites selon les tranches de hauteur et de largeur.
                </p>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleSaveDailyTargets}
                style={{ background: 'var(--accent-emerald)' }}
              >
                <Save size={18} /> Enregistrer Objectifs / Jour
              </button>
            </div>

            {/* TABLE TRANCHES DE TAILLE ET TYPE */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.92rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                    <th style={{ padding: '12px 16px' }}>Tranche de Dimensions (Largeur / Hauteur)</th>
                    <th style={{ padding: '12px 16px' }}>⚡ Objectif Coulissant (Unités / jour)</th>
                    <th style={{ padding: '12px 16px' }}>🚪 Objectif Ouvrant (Unités / jour)</th>
                    <th style={{ padding: '12px 16px' }}>Objectif Total Tranche</th>
                  </tr>
                </thead>
                <tbody>
                  {HEIGHT_WIDTH_RANGES.map(range => {
                    const conf = dailyTargets[range] || { coulissantDailyTarget: 10, ouvrantDailyTarget: 12 };
                    const totalRange = (conf.coulissantDailyTarget || 0) + (conf.ouvrantDailyTarget || 0);
                    return (
                      <tr key={range} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '14px 16px', fontWeight: '800', color: 'var(--text-primary)' }}>
                          {range}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: '130px', fontWeight: 'bold', fontSize: '0.95rem', borderColor: 'var(--accent-cyan)' }}
                            value={conf.coulissantDailyTarget || 0}
                            onChange={(e) => handleDailyChange(range, 'coulissantDailyTarget', e.target.value)}
                            min="0"
                          />
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: '130px', fontWeight: 'bold', fontSize: '0.95rem', borderColor: 'var(--accent-purple)' }}
                            value={conf.ouvrantDailyTarget || 0}
                            onChange={(e) => handleDailyChange(range, 'ouvrantDailyTarget', e.target.value)}
                            min="0"
                          />
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: '800', color: 'var(--accent-emerald)' }}>
                          {totalRange} fenêtres / jour
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 3: SIMULATEUR ET CALCUL INTELLIGENT */}
      {/* ---------------------------------------------------- */}
      {activeSubTab === 'simulator' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
          
          {/* SIMULATOR INPUT FORM */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu style={{ color: 'var(--accent-purple)' }} />
              Simulateur de Calcul de Temps Cible Sur-Mesure
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="form-label">Gamme</label>
                <select className="form-select" value={simGamme} onChange={(e) => setSimGamme(e.target.value)}>
                  {gammesList.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Type de Menuiserie</label>
                <select className="form-select" value={simType} onChange={(e) => setSimType(e.target.value)}>
                  <option value="Coulissant">⚡ Coulissant</option>
                  <option value="Ouvrant">🚪 Ouvrant / Frappe</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Hauteur</label>
                  <select className="form-select" value={simHeight} onChange={(e) => setSimHeight(e.target.value)}>
                    {HEIGHT_WIDTH_RANGES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Largeur</label>
                  <select className="form-select" value={simWidth} onChange={(e) => setSimWidth(e.target.value)}>
                    {HEIGHT_WIDTH_RANGES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input type="checkbox" checked={simCaisson} onChange={(e) => setSimCaisson(e.target.checked)} />
                  Option Caisson (+15 min)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input type="checkbox" checked={simFixe} onChange={(e) => setSimFixe(e.target.checked)} />
                  Option Fixe (+10 min)
                </label>
              </div>

              <div>
                <label className="form-label">Quantité</label>
                <input
                  type="number"
                  className="form-input"
                  value={simQty}
                  onChange={(e) => setSimQty(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                />
              </div>
            </div>
          </div>

          {/* SIMULATION RESULT DISPLAY */}
          <div className="glass-card" style={{ padding: '24px', background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', borderLeft: '6px solid var(--accent-purple)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-purple)' }}>
              <Zap size={22} />
              Résultat du Calcul Intelligent
            </h3>

            <div style={{ textAlign: 'center', padding: '20px', background: '#ffffff', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', marginBottom: '18px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>OBJECTIF TEMPS CALCULÉ</div>
              <div style={{ fontSize: '3rem', fontWeight: '900', color: 'var(--accent-purple)', margin: '6px 0' }}>
                {simResult.targetMinutes} <span style={{ fontSize: '1.2rem' }}>minutes</span>
              </div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                Pour {simQty} fenêtre(s) en gamme <strong>{simGamme}</strong> ({simType})
              </div>
            </div>

            <div style={{ fontSize: '0.88rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              <h5 style={{ fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>💡 Formule de l'Algorithme :</h5>
              <ul style={{ paddingLeft: '20px', margin: 0 }}>
                <li><strong>Base Gamme & Type :</strong> {simType === 'Coulissant' ? (gammeTargets[simGamme]?.targetCoulissantMinutes || 50) : (gammeTargets[simGamme]?.targetOuvrantMinutes || 40)} min</li>
                <li><strong>Ajustement Dimensions :</strong> Facteur appliqué selon max(Hauteur, Largeur)</li>
                {simCaisson && <li><strong>Option Caisson :</strong> +15 min</li>}
                {simFixe && <li><strong>Option Fixe :</strong> +10 min</li>}
                <li><strong>Quantité :</strong> × {simQty} unité(s)</li>
              </ul>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
