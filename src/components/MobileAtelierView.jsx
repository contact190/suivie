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
  ChevronRight,
  Sparkles,
  Check
} from 'lucide-react';
import { getOrders, updateOrderStatus, formatDuration } from '../services/storage';

// Synthesize subtle audio beep feedback for workshop scanners using Web Audio API
function playScanBeep(type = 'success') {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.12); // A6
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } else if (type === 'launch') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.08); // E5
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
    // AudioContext not supported or muted
  }
}

export default function MobileAtelierView({ onOrdersUpdated }) {
  const [orders, setOrders] = useState([]);
  const [scannedId, setScannedId] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [matchedOrder, setMatchedOrder] = useState(null);
  const [scanError, setScanError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'pending' | 'in_progress'

  const html5QrCodeRef = useRef(null);

  // Load orders on mount
  const refreshOrders = () => {
    const list = getOrders();
    setOrders(list);

    // If there is a matched order, keep it updated
    if (matchedOrder) {
      const reFound = list.find(o => o.id === matchedOrder.id);
      if (reFound) setMatchedOrder(reFound);
    }
    if (onOrdersUpdated) onOrdersUpdated();
  };

  useEffect(() => {
    refreshOrders();
  }, []);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const selectOrder = (orderId) => {
    const cleanId = String(orderId).trim().toUpperCase();
    const found = orders.find(o => o.id.toUpperCase() === cleanId);
    if (found) {
      setMatchedOrder(found);
      setScannedId(found.id);
      setManualInput(found.id);
      setScanError('');
      playScanBeep('success');
    } else {
      setMatchedOrder(null);
      setScanError(`Commande "${orderId}" introuvable dans la base.`);
      playScanBeep('error');
    }
  };

  const handleManualSearch = (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    selectOrder(manualInput);
  };

  // Launch Order Action
  const handleLaunchOrder = () => {
    if (!matchedOrder) return;
    if (matchedOrder.status !== 'en_attente') return;

    const updated = updateOrderStatus(matchedOrder.id, 'en_cours');
    const newOrd = updated.find(o => o.id === matchedOrder.id);
    
    playScanBeep('launch');
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
    
    setMatchedOrder(newOrd);
    setActionSuccess(`🚀 Commande ${newOrd.id} LANCÉE avec succès !`);
    refreshOrders();
    setTimeout(() => setActionSuccess(''), 4500);
  };

  // Finish Order Action
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
    setTimeout(() => setActionSuccess(''), 4500);
  };

  // Camera handling
  const startCamera = async () => {
    setIsCameraActive(true);
    setScanError('');
    setTimeout(async () => {
      try {
        if (!html5QrCodeRef.current) {
          html5QrCodeRef.current = new Html5Qrcode('mobile-qr-reader');
        }
        await html5QrCodeRef.current.start(
          { facingMode: 'environment' },
          { fps: 12, qrbox: { width: 230, height: 230 } },
          (decodedText) => {
            selectOrder(decodedText);
            stopCamera();
          },
          () => {} // Ignore quiet parsing errors
        );
      } catch (err) {
        console.error('Mobile camera start error:', err);
        setScanError('Accès caméra non autorisé ou indisponible. Saisissez la référence ci-dessous.');
        setIsCameraActive(false);
      }
    }, 100);
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (e) {
        console.error('Stop camera err', e);
      }
    }
    setIsCameraActive(false);
  };

  const pendingOrders = orders.filter(o => o.status === 'en_attente');
  const inProgressOrders = orders.filter(o => o.status === 'en_cours');
  const finishedOrders = orders.filter(o => o.status === 'fini');

  const filteredOrdersList = orders.filter(o => {
    if (activeFilter === 'pending') return o.status === 'en_attente';
    if (activeFilter === 'in_progress') return o.status === 'en_cours';
    return true;
  });

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* Mobile Top Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#ffffff',
        padding: '20px',
        borderRadius: 'var(--radius-md)',
        marginBottom: '20px',
        boxShadow: '0 10px 25px rgba(15, 23, 42, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'var(--gradient-brand)',
              padding: '10px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Smartphone size={24} style={{ color: '#fff' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.35rem', color: '#ffffff', margin: 0 }}>Atelier Mobile</h2>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Scannez & Gérez le workflow direct</span>
            </div>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={refreshOrders}
            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }}
            title="Rafraîchir"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {/* Quick Counters */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ background: 'rgba(217, 119, 6, 0.15)', border: '1px solid rgba(217, 119, 6, 0.3)', padding: '8px 10px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fbbf24' }}>{pendingOrders.length}</div>
            <div style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>En attente</div>
          </div>
          <div style={{ background: 'rgba(2, 132, 199, 0.15)', border: '1px solid rgba(2, 132, 199, 0.3)', padding: '8px 10px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#38bdf8' }}>{inProgressOrders.length}</div>
            <div style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>En cours</div>
          </div>
          <div style={{ background: 'rgba(5, 150, 105, 0.15)', border: '1px solid rgba(5, 150, 105, 0.3)', padding: '8px 10px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#34d399' }}>{finishedOrders.length}</div>
            <div style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>Terminées</div>
          </div>
        </div>
      </div>

      {/* Action Success Toast */}
      {actionSuccess && (
        <div className="animate-fade-in" style={{
          background: '#ecfdf5',
          border: '2px solid #10b981',
          color: '#065f46',
          padding: '16px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          fontWeight: '700',
          fontSize: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 8px 20px rgba(16, 185, 129, 0.2)'
        }}>
          <Sparkles size={24} style={{ color: '#10b981' }} />
          <div>{actionSuccess}</div>
        </div>
      )}

      {/* Camera & Scan Box */}
      <div className="glass-card" style={{ padding: '18px', marginBottom: '20px', background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <QrCode size={20} style={{ color: 'var(--accent-purple)' }} />
            Scanner QR Code Atelier
          </h3>
          
          {!isCameraActive ? (
            <button className="btn btn-primary btn-sm" onClick={startCamera}>
              <Camera size={16} /> Activer Caméra
            </button>
          ) : (
            <button className="btn btn-danger btn-sm" onClick={stopCamera}>
              Arrêter Caméra
            </button>
          )}
        </div>

        {/* Live Camera View Container */}
        {isCameraActive && (
          <div style={{ marginBottom: '16px', borderRadius: '12px', overflow: 'hidden', border: '3px solid var(--accent-cyan)', background: '#000' }}>
            <div id="mobile-qr-reader" style={{ width: '100%', minHeight: '250px' }}></div>
            <div style={{ background: '#0f172a', color: '#cbd5e1', padding: '8px', textAlign: 'center', fontSize: '0.8rem' }}>
              Pointez la caméra vers le QR Code sur la fiche atelier
            </div>
          </div>
        )}

        {/* Manual Search Input */}
        <form onSubmit={handleManualSearch} style={{ display: 'flex', gap: '8px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '38px', height: '46px', fontSize: '1rem', fontWeight: '600' }}
              placeholder="Scanner ou saisir ex: CMD-2026-001..."
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ height: '46px', padding: '0 20px' }}>
            OK
          </button>
        </form>

        {scanError && (
          <div style={{ marginTop: '12px', background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48', padding: '10px 14px', borderRadius: '8px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} /> {scanError}
          </div>
        )}
      </div>

      {/* MATCHED ORDER CARD WITH STRICT WORKFLOW CONTROLS */}
      {matchedOrder ? (
        <div className="glass-card animate-fade-in" style={{
          padding: '22px',
          marginBottom: '24px',
          borderLeft: `6px solid ${
            matchedOrder.status === 'en_attente' ? 'var(--accent-amber)' :
            matchedOrder.status === 'en_cours' ? 'var(--accent-cyan)' : 'var(--accent-emerald)'
          }`,
          boxShadow: 'var(--shadow-glow)'
        }}>
          {/* Header info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
            <div>
              <span className="badge badge-purple" style={{ fontSize: '0.85rem', marginBottom: '6px' }}>
                {matchedOrder.id}
              </span>
              <h3 style={{ fontSize: '1.4rem', margin: '4px 0 2px 0' }}>{matchedOrder.nomCommande}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>Client : <strong>{matchedOrder.client}</strong></p>
            </div>

            {/* Current Status Badge */}
            <div>
              {matchedOrder.status === 'en_attente' && (
                <span className="badge badge-amber" style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
                  <Clock size={14} /> EN ATTENTE
                </span>
              )}
              {matchedOrder.status === 'en_cours' && (
                <span className="badge badge-cyan" style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
                  <PlayCircle size={14} /> EN COURS
                </span>
              )}
              {matchedOrder.status === 'fini' && (
                <span className="badge badge-emerald" style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
                  <CheckCircle2 size={14} /> FINI
                </span>
              )}
            </div>
          </div>

          {/* Articles list overview */}
          <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '20px' }}>
            <div style={{ fontWeight: '700', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={16} style={{ color: 'var(--accent-cyan)' }} />
              Détail de la commande ({matchedOrder.articles.length} article(s)) :
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {matchedOrder.articles.map((art, idx) => (
                <div key={idx} style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                  <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                    {art.quantity}x {art.designation}
                  </div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    <span>📐 <strong>{art.hauteur} x {art.largeur} mm</strong></span>
                    <span>🏷️ Gamme : <strong>{art.gamme}</strong></span>
                    {art.avecCaisson && <span style={{ color: 'var(--accent-amber)', fontWeight: 'bold' }}>[Caisson Oui]</span>}
                    {art.avecFixe && <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>[Fixe Oui]</span>}
                  </div>
                </div>
              ))}
            </div>

            {matchedOrder.notes && (
              <div style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', background: '#fff', padding: '8px', borderRadius: '6px' }}>
                📝 Note : {matchedOrder.notes}
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '22px', flexWrap: 'wrap', gap: '6px' }}>
            <div>Créée : {new Date(matchedOrder.createdAt).toLocaleTimeString()}</div>
            {matchedOrder.launchedAt && <div>Lancée : {new Date(matchedOrder.launchedAt).toLocaleTimeString()}</div>}
            {matchedOrder.completedAt && (
              <div>Terminée : {new Date(matchedOrder.completedAt).toLocaleTimeString()} ({formatDuration(matchedOrder.durationMinutes)})</div>
            )}
          </div>

          {/* THE TWO MANDATORY WORKSHOP ACTION BUTTONS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* BOUTON 1 : LANCÉ */}
            {matchedOrder.status === 'en_attente' ? (
              <button
                className="btn btn-primary btn-lg"
                onClick={handleLaunchOrder}
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '1.15rem',
                  fontWeight: '800',
                  letterSpacing: '0.02em',
                  boxShadow: '0 6px 20px rgba(2, 132, 199, 0.4)'
                }}
              >
                <PlayCircle size={26} /> 1. LANCER LA COMMANDE (LANCÉ)
              </button>
            ) : (
              <button
                className="btn btn-secondary btn-lg"
                disabled
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: '1rem',
                  opacity: 0.8,
                  background: '#f1f5f9',
                  color: '#475569',
                  borderColor: '#cbd5e1',
                  cursor: 'not-allowed',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <Check size={20} style={{ color: 'var(--accent-emerald)' }} />
                COMMANDE DÉJÀ LANCÉE
                {matchedOrder.launchedAt && (
                  <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>
                    ({new Date(matchedOrder.launchedAt).toLocaleTimeString()})
                  </span>
                )}
              </button>
            )}

            {/* BOUTON 2 : FINI */}
            {matchedOrder.status === 'en_attente' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  className="btn btn-secondary btn-lg"
                  disabled
                  style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: '1.1rem',
                    fontWeight: '700',
                    background: '#e2e8f0',
                    color: '#94a3b8',
                    borderColor: '#cbd5e1',
                    cursor: 'not-allowed'
                  }}
                >
                  <Lock size={22} style={{ color: '#64748b' }} /> 2. MARQUER FINI (VERROUILLÉ)
                </button>
                <div style={{
                  fontSize: '0.8rem',
                  color: 'var(--accent-rose)',
                  textAlign: 'center',
                  fontWeight: '600',
                  background: '#fff1f2',
                  padding: '6px',
                  borderRadius: '6px',
                  border: '1px dashed #fecdd3'
                }}>
                  ⚠️ Action impossible : Vous ne pouvez pas marquer "FINI" une commande non lancée. Lancez-la d'abord !
                </div>
              </div>
            ) : matchedOrder.status === 'en_cours' ? (
              <button
                className="btn btn-emerald btn-lg"
                onClick={handleFinishOrder}
                style={{
                  width: '100%',
                  padding: '18px',
                  fontSize: '1.2rem',
                  fontWeight: '800',
                  letterSpacing: '0.02em',
                  boxShadow: '0 6px 20px rgba(5, 150, 105, 0.4)'
                }}
              >
                <CheckCircle2 size={26} /> 2. MARQUER FABRICATION FINIE (FINI)
              </button>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '16px',
                background: '#ecfdf5',
                borderRadius: 'var(--radius-md)',
                border: '2px solid var(--accent-emerald)'
              }}>
                <div style={{ color: 'var(--accent-emerald)', fontWeight: '800', fontSize: '1.1rem', marginBottom: '8px' }}>
                  🎉 FABRICATION TERMINÉE ET VALIDÉE
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    updateOrderStatus(matchedOrder.id, 'en_attente');
                    refreshOrders();
                  }}
                  style={{ marginTop: '4px' }}
                >
                  <RotateCcw size={14} /> Réinitialiser le statut (Test)
                </button>
              </div>
            )}

          </div>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', marginBottom: '24px' }}>
          <QrCode size={48} style={{ color: 'var(--accent-purple)', opacity: 0.4, marginBottom: '12px' }} />
          <h4 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '6px' }}>Scannez un QR Code ou sélectionnez une commande</h4>
          <p style={{ fontSize: '0.88rem' }}>Utilisez la caméra ci-dessus ou choisissez une commande dans la file d'attente ci-dessous.</p>
        </div>
      )}

      {/* QUICK SELECT LIST OF WORKSHOP ORDERS */}
      <div className="glass-card" style={{ padding: '18px', background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <h4 style={{ fontSize: '1.05rem', margin: 0 }}>File d'attente Atelier ({orders.length})</h4>
          
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              className={`btn btn-sm ${activeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveFilter('all')}
              style={{ fontSize: '0.78rem', padding: '4px 8px' }}
            >
              Toutes
            </button>
            <button
              className={`btn btn-sm ${activeFilter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveFilter('pending')}
              style={{ fontSize: '0.78rem', padding: '4px 8px' }}
            >
              En attente ({pendingOrders.length})
            </button>
            <button
              className={`btn btn-sm ${activeFilter === 'in_progress' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveFilter('in_progress')}
              style={{ fontSize: '0.78rem', padding: '4px 8px' }}
            >
              En cours ({inProgressOrders.length})
            </button>
          </div>
        </div>

        {filteredOrdersList.length === 0 ? (
          <div style={{ textStyle: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
            Aucune commande dans cette catégorie.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
            {filteredOrdersList.map(ord => (
              <div
                key={ord.id}
                onClick={() => selectOrder(ord.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: matchedOrder?.id === ord.id ? '2px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                  background: matchedOrder?.id === ord.id ? 'rgba(2, 132, 199, 0.05)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: '800', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{ord.id}</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>- {ord.nomCommande}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Client : {ord.client} • {ord.articles?.length || 0} article(s)
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {ord.status === 'en_attente' && (
                    <span className="badge badge-amber" style={{ fontSize: '0.7rem' }}>En attente</span>
                  )}
                  {ord.status === 'en_cours' && (
                    <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>En cours</span>
                  )}
                  {ord.status === 'fini' && (
                    <span className="badge badge-emerald" style={{ fontSize: '0.7rem' }}>Fini</span>
                  )}
                  <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
