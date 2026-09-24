import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import {
  Smartphone,
  QrCode,
  Camera,
  PlayCircle,
  CheckCircle2,
  Lock,
  AlertCircle,
  Search,
  RotateCcw,
  Clock,
  Layers,
  Sparkles,
  Check,
  Info,
  ArrowLeft,
  X,
  FileText,
  TrendingUp,
  Box,
  Calendar
} from 'lucide-react';
import { getOrders, updateOrderStatus, formatDuration } from '../services/storage';

// Synthesize audio feedback using Web Audio API
function playScanBeep(type = 'success') {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } else if (type === 'launch') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    }
  } catch (e) {
    // Audio context unavailable or muted
  }
}

export default function MobileAtelierView({ onOrdersUpdated }) {
  // Screen mode: 'scan' (Écran 1: Caméra) | 'order' (Écran 2: Actions Lancé/Fini)
  const [currentScreen, setCurrentScreen] = useState('scan');
  
  // Data states
  const [orders, setOrders] = useState([]);
  const [manualInput, setManualInput] = useState('');
  const [matchedOrder, setMatchedOrder] = useState(null);
  const [scanError, setScanError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  
  // Camera & Modal states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [searchFilter, setSearchFilter] = useState('all'); // 'all' | 'pending' | 'in_progress'

  const html5QrCodeRef = useRef(null);

  // Load latest orders
  const refreshOrders = () => {
    const list = getOrders();
    setOrders(list);

    if (matchedOrder) {
      const reFound = list.find(o => o.id === matchedOrder.id);
      if (reFound) setMatchedOrder(reFound);
    }
    if (onOrdersUpdated) onOrdersUpdated();
  };

  useEffect(() => {
    refreshOrders();
  }, []);

  // Handle screen changes to auto-start/stop camera
  useEffect(() => {
    if (currentScreen === 'scan') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [currentScreen]);

  // Select an order by ID & navigate to Screen 2
  const selectOrder = (orderId) => {
    const cleanId = String(orderId).trim().toUpperCase();
    const list = getOrders();
    const found = list.find(o => o.id.toUpperCase() === cleanId);
    
    if (found) {
      setMatchedOrder(found);
      setScanError('');
      playScanBeep('success');
      stopCamera();
      setCurrentScreen('order');
    } else {
      setScanError(`Commande "${orderId}" introuvable dans la base.`);
      playScanBeep('error');
    }
  };

  const handleManualSearch = (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    selectOrder(manualInput);
  };

  // Launch Order Action (Écran 2)
  const handleLaunchOrder = () => {
    if (!matchedOrder) return;
    if (matchedOrder.status !== 'en_attente') return;

    const updated = updateOrderStatus(matchedOrder.id, 'en_cours');
    const newOrd = updated.find(o => o.id === matchedOrder.id);
    
    playScanBeep('launch');
    confetti({ particleCount: 70, spread: 70, origin: { y: 0.7 } });
    
    setMatchedOrder(newOrd);
    setActionSuccess(`🚀 Commande ${newOrd.id} LANCÉE avec succès !`);
    refreshOrders();
    setTimeout(() => setActionSuccess(''), 4000);
  };

  // Finish Order Action (Écran 2) - ONLY ACTIVE IF LAUNCHED!
  const handleFinishOrder = () => {
    if (!matchedOrder) return;
    if (matchedOrder.status !== 'en_cours') {
      playScanBeep('error');
      setScanError("Impossible de terminer une commande non lancée !");
      return;
    }

    const updated = updateOrderStatus(matchedOrder.id, 'fini');
    const newOrd = updated.find(o => o.id === matchedOrder.id);
    
    playScanBeep('success');
    confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });

    setMatchedOrder(newOrd);
    setActionSuccess(`✅ Commande ${newOrd.id} TERMINÉE ! Durée : ${formatDuration(newOrd.durationMinutes)}`);
    refreshOrders();
    setTimeout(() => setActionSuccess(''), 4000);
  };

  // Camera Management
  const startCamera = async () => {
    setIsCameraActive(true);
    setScanError('');
    setTimeout(async () => {
      try {
        const qrContainer = document.getElementById('mobile-qr-reader');
        if (!qrContainer) return;

        if (!html5QrCodeRef.current) {
          html5QrCodeRef.current = new Html5Qrcode('mobile-qr-reader');
        } else if (html5QrCodeRef.current.isScanning) {
          return;
        }

        await html5QrCodeRef.current.start(
          { facingMode: 'environment' },
          { fps: 12, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            selectOrder(decodedText);
          },
          () => {}
        );
      } catch (err) {
        console.warn('Camera start issue:', err);
        setScanError('Caméra non disponible ou accès refusé. Saisissez la référence ci-dessous.');
        setIsCameraActive(false);
      }
    }, 150);
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (e) {
        console.warn('Camera stop issue:', e);
      }
    }
    setIsCameraActive(false);
  };

  // Filter lists
  const pendingOrders = orders.filter(o => o.status === 'en_attente');
  const inProgressOrders = orders.filter(o => o.status === 'en_cours');
  const finishedOrders = orders.filter(o => o.status === 'fini');

  const filteredOrders = orders.filter(o => {
    if (searchFilter === 'pending') return o.status === 'en_attente';
    if (searchFilter === 'in_progress') return o.status === 'en_cours';
    return true;
  });

  // Elapsed time calculation for active orders
  const getElapsedTimeString = (order) => {
    if (!order) return '';
    if (order.status === 'fini' && order.durationMinutes) {
      return formatDuration(order.durationMinutes);
    }
    if (order.status === 'en_cours' && order.launchedAt) {
      const diffMs = Date.now() - new Date(order.launchedAt).getTime();
      const mins = Math.max(1, Math.floor(diffMs / 60000));
      return `${formatDuration(mins)} (en cours)`;
    }
    return 'Non démarré';
  };

  const totalArticlesQty = matchedOrder
    ? matchedOrder.articles.reduce((acc, a) => acc + (parseInt(a.quantity) || 1), 0)
    : 0;

  return (
    <div style={{ maxWidth: '520px', margin: '0 auto', paddingBottom: '30px', fontFamily: 'inherit' }}>
      
      {/* Toast Notification */}
      {actionSuccess && (
        <div className="animate-fade-in" style={{
          background: '#065f46',
          color: '#ffffff',
          padding: '14px 18px',
          borderRadius: '14px',
          marginBottom: '16px',
          fontWeight: '700',
          fontSize: '0.95rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 8px 25px rgba(6, 95, 70, 0.4)'
        }}>
          <Sparkles size={22} style={{ color: '#34d399' }} />
          <div style={{ flex: 1 }}>{actionSuccess}</div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ÉCRAN 1 : SCAN CAMERA & SELECTION DE COMMANDE           */}
      {/* ======================================================== */}
      {currentScreen === 'scan' && (
        <div className="animate-fade-in">
          
          {/* Header Écran 1 */}
          <div style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
            padding: '16px 20px',
            borderRadius: '16px',
            marginBottom: '16px',
            boxShadow: '0 8px 20px rgba(15, 23, 42, 0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  background: 'var(--gradient-brand)',
                  padding: '8px',
                  borderRadius: '10px',
                  display: 'flex'
                }}>
                  <QrCode size={22} style={{ color: '#fff' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', color: '#fff', margin: 0, fontWeight: '800' }}>Écran 1 : Scanner QR Code</h2>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Scannez ou sélectionnez une commande</span>
                </div>
              </div>

              <button
                className="btn btn-secondary btn-sm"
                onClick={refreshOrders}
                style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '8px' }}
                title="Rafraîchir"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>

          {/* Zone de Scan Caméra Live */}
          <div className="glass-card" style={{ padding: '16px', marginBottom: '16px', background: '#ffffff', borderRadius: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={18} style={{ color: 'var(--accent-purple)' }} />
                Viseur Caméra Scan
              </div>

              {!isCameraActive ? (
                <button className="btn btn-primary btn-sm" onClick={startCamera}>
                  <Camera size={14} /> Activer Caméra
                </button>
              ) : (
                <button className="btn btn-danger btn-sm" onClick={stopCamera}>
                  Désactiver
                </button>
              )}
            </div>

            {/* Container du lecteur QR Code */}
            <div style={{
              borderRadius: '14px',
              overflow: 'hidden',
              background: '#0f172a',
              position: 'relative',
              minHeight: '220px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              border: '2px solid var(--accent-cyan)'
            }}>
              <div id="mobile-qr-reader" style={{ width: '100%', minHeight: '220px' }}></div>
              {!isCameraActive && (
                <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                  <QrCode size={40} style={{ opacity: 0.4, marginBottom: '8px' }} />
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>Caméra inactive. Cliquez sur <strong>Activer Caméra</strong> ou saisissez le code ci-dessous.</p>
                </div>
              )}
            </div>

            {/* Saisie Manuelle de Référence */}
            <form onSubmit={handleManualSearch} style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '36px', height: '44px', fontSize: '0.95rem', fontWeight: '600' }}
                  placeholder="Tapez ex: CMD-2026-001..."
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ height: '44px', padding: '0 18px', fontWeight: '800' }}>
                Valider
              </button>
            </form>

            {scanError && (
              <div style={{ marginTop: '10px', background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48', padding: '10px 12px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} /> {scanError}
              </div>
            )}
          </div>

          {/* Quick Select Order List */}
          <div className="glass-card" style={{ padding: '16px', background: '#ffffff', borderRadius: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '0.95rem', margin: 0, fontWeight: '800' }}>Sélection Rapide ({orders.length})</h4>
              
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  className={`btn btn-sm ${searchFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSearchFilter('all')}
                  style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                >
                  Toutes
                </button>
                <button
                  className={`btn btn-sm ${searchFilter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSearchFilter('pending')}
                  style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                >
                  Attente ({pendingOrders.length})
                </button>
                <button
                  className={`btn btn-sm ${searchFilter === 'in_progress' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSearchFilter('in_progress')}
                  style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                >
                  En cours ({inProgressOrders.length})
                </button>
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div style={{ padding: '14px', color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center' }}>
                Aucune commande disponible dans ce filtre.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {filteredOrders.map(ord => (
                  <div
                    key={ord.id}
                    onClick={() => selectOrder(ord.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-card)',
                      cursor: 'pointer'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: '800', fontSize: '0.92rem', color: 'var(--text-primary)' }}>{ord.id}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{ord.nomCommande}</span>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                        Client: {ord.client} • {ord.articles?.length || 0} article(s)
                      </div>
                    </div>

                    <div>
                      {ord.status === 'en_attente' && (
                        <span className="badge badge-amber" style={{ fontSize: '0.72rem', padding: '4px 8px' }}>
                          En attente
                        </span>
                      )}
                      {ord.status === 'en_cours' && (
                        <span className="badge badge-cyan" style={{ fontSize: '0.72rem', padding: '4px 8px' }}>
                          En cours
                        </span>
                      )}
                      {ord.status === 'fini' && (
                        <span className="badge badge-emerald" style={{ fontSize: '0.72rem', padding: '4px 8px' }}>
                          Fini
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ÉCRAN 2 : FICHE COMMANDE ET WORKFLOW (LANCÉ / FINI)     */}
      {/* ======================================================== */}
      {currentScreen === 'order' && matchedOrder && (
        <div className="animate-fade-in">
          
          {/* Header Navigation Écran 2 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setCurrentScreen('scan')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', borderRadius: '10px' }}
            >
              <ArrowLeft size={16} /> Scanner autre commande
            </button>

            {/* Bouton Info pour ouvrir les détails & stats */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowInfoModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: '700',
                borderColor: 'var(--accent-purple)',
                color: 'var(--accent-purple)',
                background: 'rgba(124, 58, 237, 0.08)',
                borderRadius: '10px',
                padding: '6px 14px'
              }}
            >
              <Info size={18} /> Info & Stats
            </button>
          </div>

          {/* Card Info Principale */}
          <div className="glass-card" style={{
            padding: '20px',
            marginBottom: '20px',
            borderRadius: '18px',
            borderLeft: `6px solid ${
              matchedOrder.status === 'en_attente' ? 'var(--accent-amber)' :
              matchedOrder.status === 'en_cours' ? 'var(--accent-cyan)' : 'var(--accent-emerald)'
            }`,
            background: '#ffffff',
            boxShadow: '0 8px 25px rgba(0,0,0,0.06)'
          }}>
            
            {/* Top order summary */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <span className="badge badge-purple" style={{ fontSize: '0.85rem', marginBottom: '6px' }}>
                  {matchedOrder.id}
                </span>
                <h3 style={{ fontSize: '1.35rem', margin: '4px 0 2px 0', color: 'var(--text-primary)', fontWeight: '800' }}>
                  {matchedOrder.nomCommande}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: 0 }}>
                  Client : <strong>{matchedOrder.client}</strong>
                </p>
              </div>

              {/* Status Badge */}
              <div>
                {matchedOrder.status === 'en_attente' && (
                  <span className="badge badge-amber" style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: '700' }}>
                    <Clock size={14} /> EN ATTENTE
                  </span>
                )}
                {matchedOrder.status === 'en_cours' && (
                  <span className="badge badge-cyan" style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: '700' }}>
                    <PlayCircle size={14} /> EN COURS
                  </span>
                )}
                {matchedOrder.status === 'fini' && (
                  <span className="badge badge-emerald" style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: '700' }}>
                    <CheckCircle2 size={14} /> FINI
                  </span>
                )}
              </div>
            </div>

            {/* Condensed Summary */}
            <div style={{
              background: 'var(--bg-secondary)',
              padding: '12px 14px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)'
            }}>
              <div>📦 <strong>{matchedOrder.articles?.length || 0}</strong> type(s) d'articles ({totalArticlesQty} pce)</div>
              <div>⏱️ <strong>{getElapsedTimeString(matchedOrder)}</strong></div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* DEUX BOUTONS PRINCIPAUX : LANCÉ ET FINI                  */}
          {/* ======================================================== */}
          <div className="glass-card" style={{ padding: '20px', borderRadius: '18px', background: '#ffffff' }}>
            <h4 style={{ fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px', fontWeight: '800' }}>
              Actions Workflow Atelier
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* BOUTON 1 : LANCÉ */}
              {matchedOrder.status === 'en_attente' ? (
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleLaunchOrder}
                  style={{
                    width: '100%',
                    padding: '18px',
                    fontSize: '1.25rem',
                    fontWeight: '800',
                    borderRadius: '14px',
                    boxShadow: '0 8px 25px rgba(2, 132, 199, 0.35)',
                    justifyContent: 'center',
                    gap: '10px'
                  }}
                >
                  <PlayCircle size={26} /> 🚀 LANCÉ
                </button>
              ) : (
                <button
                  className="btn btn-secondary btn-lg"
                  disabled
                  style={{
                    width: '100%',
                    padding: '14px',
                    fontSize: '0.95rem',
                    fontWeight: '700',
                    background: '#f1f5f9',
                    color: '#475569',
                    borderColor: '#cbd5e1',
                    borderRadius: '14px',
                    cursor: 'not-allowed',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Check size={20} style={{ color: 'var(--accent-emerald)' }} />
                  COMMANDE DÉJÀ LANCÉE
                </button>
              )}

              {/* BOUTON 2 : FINI (SEULEMENT ACTIF SI LA COMMANDE EST LANCÉE) */}
              {matchedOrder.status === 'en_attente' ? (
                /* DESACTIVÉ SI SEULEMENT EN ATTENTE */
                <button
                  className="btn btn-secondary btn-lg"
                  disabled
                  style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: '1.05rem',
                    fontWeight: '700',
                    background: '#e2e8f0',
                    color: '#94a3b8',
                    borderColor: '#cbd5e1',
                    borderRadius: '14px',
                    cursor: 'not-allowed',
                    justifyContent: 'center',
                    gap: '10px',
                    opacity: 0.7
                  }}
                >
                  <Lock size={22} style={{ color: '#64748b' }} />
                  ✅ FINI (Verrouillé - Lancez la commande d'abord)
                </button>
              ) : matchedOrder.status === 'en_cours' ? (
                /* ACTIF QUAND LE STATUT EST EN COURS (LANCÉ) */
                <button
                  className="btn btn-emerald btn-lg animate-pulse-glow"
                  onClick={handleFinishOrder}
                  style={{
                    width: '100%',
                    padding: '20px',
                    fontSize: '1.3rem',
                    fontWeight: '800',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    color: '#ffffff',
                    border: 'none',
                    boxShadow: '0 8px 25px rgba(16, 185, 129, 0.4)',
                    justifyContent: 'center',
                    gap: '10px'
                  }}
                >
                  <CheckCircle2 size={28} /> ✅ FINI
                </button>
              ) : (
                /* STATUT FINI */
                <div style={{
                  textAlign: 'center',
                  padding: '16px',
                  background: '#ecfdf5',
                  borderRadius: '14px',
                  border: '2px solid var(--accent-emerald)',
                  color: 'var(--accent-emerald)',
                  fontWeight: '800',
                  fontSize: '1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}>
                  <CheckCircle2 size={24} /> COMMANDE TERMINÉE (FINI)
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* OVERLAY / ECRAN DÉTAILS ET STATS ALLÉGÉ (BOUTON INFO)   */}
      {/* ======================================================== */}
      {showInfoModal && matchedOrder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div className="glass-card animate-fade-in" style={{
            background: '#ffffff',
            maxWidth: '480px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            borderRadius: '20px',
            padding: '22px',
            position: 'relative',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            {/* Close Modal Button */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowInfoModal(false)}
              style={{ position: 'absolute', right: '16px', top: '16px', borderRadius: '50%', padding: '6px' }}
            >
              <X size={18} />
            </button>

            {/* Header Modal */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                background: 'rgba(124, 58, 237, 0.1)',
                color: 'var(--accent-purple)',
                padding: '10px',
                borderRadius: '12px'
              }}>
                <FileText size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', margin: 0, fontWeight: '800' }}>Détails & Stats Commande</h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Vue synthétique allégée</span>
              </div>
            </div>

            {/* Section 1: Information Commande */}
            <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: '12px', marginBottom: '14px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>
                📌 Informations générales
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.88rem' }}>
                <div>Réf : <strong>{matchedOrder.id}</strong></div>
                <div>Client : <strong>{matchedOrder.client}</strong></div>
                <div style={{ gridColumn: 'span 2' }}>Nom : <strong>{matchedOrder.nomCommande}</strong></div>
              </div>
            </div>

            {/* Section 2: Statistiques & Chrono */}
            <div style={{ background: 'rgba(2, 132, 199, 0.05)', border: '1px solid rgba(2, 132, 199, 0.2)', padding: '14px', borderRadius: '12px', marginBottom: '14px' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--accent-cyan)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TrendingUp size={16} /> Chrono & Temps de Fabrication
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.86rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>📅 Date création :</span>
                  <strong>{new Date(matchedOrder.createdAt).toLocaleDateString()} {new Date(matchedOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                </div>
                {matchedOrder.launchedAt && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>🚀 Date lancement :</span>
                    <strong>{new Date(matchedOrder.launchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px dashed #cbd5e1' }}>
                  <span style={{ color: '#64748b' }}>⏱️ Temps de fab. :</span>
                  <strong style={{ color: 'var(--accent-cyan)' }}>{getElapsedTimeString(matchedOrder)}</strong>
                </div>
              </div>
            </div>

            {/* Section 3: Liste Allégée des Articles */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Box size={16} style={{ color: 'var(--accent-purple)' }} />
                Articles ({matchedOrder.articles?.length || 0}) — Total: {totalArticlesQty} pièce(s)
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                {matchedOrder.articles?.map((art, idx) => (
                  <div key={idx} style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.86rem' }}>
                    <div style={{ fontWeight: '700', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{art.quantity}x {art.designation}</span>
                      <span style={{ color: 'var(--accent-purple)' }}>{art.gamme}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <span>📐 H: {art.hauteur} | L: {art.largeur}</span>
                      {art.avecCaisson && <span style={{ color: 'var(--accent-amber)', fontWeight: 'bold' }}>[Caisson]</span>}
                      {art.avecFixe && (
                        <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
                          [Fixe {art.fixeDetails?.direction === 'vertical' ? `Vert. (${art.fixeDetails?.largeur || 400}mm)` : `Horiz. (${art.fixeDetails?.hauteur || 400}mm)`}]
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes si présentes */}
            {matchedOrder.notes && (
              <div style={{ fontSize: '0.82rem', color: '#475569', fontStyle: 'italic', background: '#fff7ed', border: '1px solid #ffedd5', padding: '10px', borderRadius: '10px', marginBottom: '16px' }}>
                📝 Note: {matchedOrder.notes}
              </div>
            )}

            {/* Button Close */}
            <button
              className="btn btn-primary"
              onClick={() => setShowInfoModal(false)}
              style={{ width: '100%', padding: '12px', borderRadius: '12px', fontWeight: '800' }}
            >
              Fermer les détails
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
