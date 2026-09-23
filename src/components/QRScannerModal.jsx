import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import { QrCode, PlayCircle, CheckCircle2, AlertCircle, X, Search, Camera, RotateCcw, Clock } from 'lucide-react';
import { getOrders, updateOrderStatus, formatDuration } from '../services/storage';

export default function QRScannerModal({ isOpen, onClose, onOrderUpdated, initialOrderId }) {
  const [scannedId, setScannedId] = useState(initialOrderId || '');
  const [manualInput, setManualInput] = useState('');
  const [matchedOrder, setMatchedOrder] = useState(null);
  const [scanError, setScanError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);

  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  // Sync initial order id if passed directly
  useEffect(() => {
    if (initialOrderId) {
      setScannedId(initialOrderId);
      findAndSetOrder(initialOrderId);
    }
  }, [initialOrderId]);

  const findAndSetOrder = (orderId) => {
    const orders = getOrders();
    const cleanId = orderId.trim().toUpperCase();
    const found = orders.find(o => o.id.toUpperCase() === cleanId);
    if (found) {
      setMatchedOrder(found);
      setScanError('');
    } else {
      setMatchedOrder(null);
      setScanError(`Aucune commande trouvée avec la référence "${orderId}".`);
    }
  };

  const handleManualSearch = (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    setScannedId(manualInput);
    findAndSetOrder(manualInput);
  };

  const handleLaunchProduction = () => {
    if (!matchedOrder) return;
    const updatedList = updateOrderStatus(matchedOrder.id, 'en_cours');
    const newOrd = updatedList.find(o => o.id === matchedOrder.id);
    setMatchedOrder(newOrd);
    setActionSuccess(`🚀 Commande ${newOrd.id} lancée en production avec succès !`);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    if (onOrderUpdated) onOrderUpdated();
    setTimeout(() => setActionSuccess(''), 4000);
  };

  const handleFinishProduction = () => {
    if (!matchedOrder) return;
    const updatedList = updateOrderStatus(matchedOrder.id, 'fini');
    const newOrd = updatedList.find(o => o.id === matchedOrder.id);
    setMatchedOrder(newOrd);
    setActionSuccess(`✅ Commande ${newOrd.id} terminée ! Temps total : ${formatDuration(newOrd.durationMinutes)}`);
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
    if (onOrderUpdated) onOrderUpdated();
    setTimeout(() => setActionSuccess(''), 4000);
  };

  // Start HTML5 QR Code Camera Scanner
  const startCamera = async () => {
    setIsCameraActive(true);
    setScanError('');
    setTimeout(async () => {
      try {
        if (!html5QrCodeRef.current) {
          html5QrCodeRef.current = new Html5Qrcode('qr-reader-container');
        }
        await html5QrCodeRef.current.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            // On QR Code scanned
            setScannedId(decodedText);
            findAndSetOrder(decodedText);
            stopCamera();
          },
          (errorMessage) => {
            // Ignore frame parse errors
          }
        );
      } catch (err) {
        console.error('Camera scan error:', err);
        setScanError('Impossible d\'accéder à la caméra ou permission refusée. Utilisez la saisie manuelle ci-dessous.');
        setIsCameraActive(false);
      }
    }, 100);
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (e) {
        console.error(e);
      }
    }
    setIsCameraActive(false);
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  if (!isOpen) return null;

  const orders = getOrders();

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '20px'
    }}>
      <div className="glass-card animate-fade-in" style={{
        width: '100%',
        maxWidth: '650px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '28px',
        background: '#121824',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
          <h3 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <QrCode style={{ color: 'var(--accent-purple)' }} />
            Scanner & Workflow de Production
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        {/* Action Success Toast */}
        {actionSuccess && (
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontWeight: 'bold' }}>
            {actionSuccess}
          </div>
        )}

        {/* Camera / Manual Scanner Toggle */}
        <div style={{ background: 'rgba(10, 13, 20, 0.6)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '20px', textAlign: 'center' }}>
          {!isCameraActive ? (
            <div>
              <button className="btn btn-primary" onClick={startCamera} style={{ marginBottom: '16px' }}>
                <Camera size={18} /> Activer la Caméra pour Scanner le QR Code
              </button>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>ou recherchez la référence manuellement ci-dessous :</div>
            </div>
          ) : (
            <div>
              <div id="qr-reader-container" style={{ width: '100%', maxHeight: '300px', overflow: 'hidden', borderRadius: '8px', margin: '0 auto' }}></div>
              <button className="btn btn-secondary btn-sm" onClick={stopCamera} style={{ marginTop: '12px' }}>
                Arrêter la caméra
              </button>
            </div>
          )}

          {/* Manual Input form */}
          <form onSubmit={handleManualSearch} style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: CMD-2026-001"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              <Search size={16} /> Rechercher
            </button>
          </form>

          {/* Quick Select Buttons for easy testing */}
          <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px dashed var(--border-color)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
              Test rapide (Sélectionnez une commande) :
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
              {orders.map(o => (
                <button
                  key={o.id}
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setScannedId(o.id);
                    setManualInput(o.id);
                    findAndSetOrder(o.id);
                  }}
                  style={{
                    fontSize: '0.78rem',
                    padding: '4px 8px',
                    borderColor: matchedOrder?.id === o.id ? 'var(--accent-cyan)' : 'transparent'
                  }}
                >
                  {o.id} ({o.status === 'en_attente' ? 'Attente' : o.status === 'en_cours' ? 'En cours' : 'Fini'})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scan Error */}
        {scanError && (
          <div style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#f43f5e', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} /> {scanError}
          </div>
        )}

        {/* Matched Order Result & Workflow Action Controls */}
        {matchedOrder && (
          <div className="glass-card animate-fade-in" style={{ padding: '20px', borderLeft: '4px solid var(--accent-cyan)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <span className="badge badge-purple" style={{ marginBottom: '6px' }}>{matchedOrder.id}</span>
                <h4 style={{ fontSize: '1.2rem' }}>{matchedOrder.nomCommande}</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Client : {matchedOrder.client}</p>
              </div>

              {/* Status Badge */}
              {matchedOrder.status === 'en_attente' && (
                <span className="badge badge-amber"><Clock size={12} /> EN ATTENTE</span>
              )}
              {matchedOrder.status === 'en_cours' && (
                <span className="badge badge-cyan"><PlayCircle size={12} /> EN COURS DE PRODUCTION</span>
              )}
              {matchedOrder.status === 'fini' && (
                <span className="badge badge-emerald"><CheckCircle2 size={12} /> FABRICATION FINIE</span>
              )}
            </div>

            {/* Order Articles Summary */}
            <div style={{ background: 'rgba(10, 13, 20, 0.4)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.88rem' }}>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>Contenu ({matchedOrder.articles.length} article(s)) :</div>
              {matchedOrder.articles.map((art, i) => (
                <div key={i} style={{ color: 'var(--text-secondary)' }}>
                  • {art.quantity}x {art.designation} ({art.hauteur} x {art.largeur} mm - Gamme: {art.gamme})
                  {art.avecCaisson && <span style={{ color: 'var(--accent-amber)', marginLeft: '6px' }}>[Caisson Oui]</span>}
                  {art.avecFixe && <span style={{ color: 'var(--accent-cyan)', marginLeft: '6px' }}>[Fixe Oui]</span>}
                </div>
              ))}
            </div>

            {/* Workflow Timestamps */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              <div>Créé : {new Date(matchedOrder.createdAt).toLocaleTimeString()}</div>
              {matchedOrder.launchedAt && <div>Lancé : {new Date(matchedOrder.launchedAt).toLocaleTimeString()}</div>}
              {matchedOrder.completedAt && (
                <div>Terminé : {new Date(matchedOrder.completedAt).toLocaleTimeString()} ({formatDuration(matchedOrder.durationMinutes)})</div>
              )}
            </div>

            {/* WORKFLOW ACTION BUTTONS WITH STRICT LANCÉ / FINI RULES */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* BOUTON LANCÉ */}
              {matchedOrder.status === 'en_attente' ? (
                <button className="btn btn-primary btn-lg" style={{ width: '100%', fontSize: '1.05rem', padding: '14px' }} onClick={handleLaunchProduction}>
                  <PlayCircle size={22} /> 1. LANCER LA PRODUCTION (LANCÉ)
                </button>
              ) : (
                <button className="btn btn-secondary btn-lg" disabled style={{ width: '100%', opacity: 0.7, cursor: 'not-allowed' }}>
                  <CheckCircle2 size={18} style={{ color: 'var(--accent-emerald)' }} /> COMMANDE DÉJÀ LANCÉE
                </button>
              )}

              {/* BOUTON FINI */}
              {matchedOrder.status === 'en_attente' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button className="btn btn-secondary btn-lg" disabled style={{ width: '100%', opacity: 0.6, cursor: 'not-allowed', background: '#e2e8f0', color: '#94a3b8' }}>
                    <AlertCircle size={20} /> 2. MARQUER FINI (VERROUILLÉ)
                  </button>
                  <div style={{ fontSize: '0.78rem', color: '#f43f5e', textAlign: 'center', fontWeight: 'bold' }}>
                    ⚠️ Vous ne pouvez pas marquer "FINI" une commande non lancée. Lancez-la d'abord !
                  </div>
                </div>
              ) : matchedOrder.status === 'en_cours' ? (
                <button className="btn btn-emerald btn-lg" style={{ width: '100%', fontSize: '1.05rem', padding: '14px' }} onClick={handleFinishProduction}>
                  <CheckCircle2 size={22} /> 2. MARQUER FABRICATION FINIE (FINI)
                </button>
              ) : (
                <div style={{ width: '100%', textAlign: 'center' }}>
                  <div style={{ color: 'var(--accent-emerald)', fontWeight: 'bold', marginBottom: '8px' }}>
                    ✨ Cette commande a été entièrement produite !
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => updateOrderStatus(matchedOrder.id, 'en_attente')}>
                    <RotateCcw size={14} /> Réinitialiser le statut
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
