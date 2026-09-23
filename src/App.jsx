import React, { useState, useEffect } from 'react';
import { PlusCircle, ListFilter, QrCode, LayoutDashboard, Factory, Edit3, Smartphone, X, ExternalLink, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import OrderForm from './components/OrderForm';
import OrderList from './components/OrderList';
import Dashboard from './components/Dashboard';
import QRScannerModal from './components/QRScannerModal';
import FicheAtelierModal from './components/FicheAtelierModal';
import MobileAtelierView from './components/MobileAtelierView';
import { getOrders } from './services/storage';

export default function App() {
  const [activeTab, setActiveTab] = useState('list'); // 'create' | 'list' | 'dashboard' | 'mobile-atelier'
  const [orders, setOrders] = useState([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isMobileQRModalOpen, setIsMobileQRModalOpen] = useState(false);
  const [scannerTargetId, setScannerTargetId] = useState('');
  const [editingOrder, setEditingOrder] = useState(null);
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Load orders on mount & check URL params for mobile mode
  const loadOrders = () => {
    const data = getOrders();
    setOrders(data);
  };

  useEffect(() => {
    loadOrders();

    // Auto open mobile atelier view if URL contains ?mode=mobile or #mobile
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('mode') === 'mobile' || window.location.hash === '#mobile') {
      setActiveTab('mobile-atelier');
    }
  }, []);

  const handleOrderCreatedOrUpdated = () => {
    loadOrders();
    setEditingOrder(null);
    setActiveTab('list');
  };

  const handleEditOrder = (orderToEdit) => {
    setEditingOrder(orderToEdit);
    setActiveTab('create');
  };

  const handleCancelEdit = () => {
    setEditingOrder(null);
    setActiveTab('list');
  };

  const handleOpenScanner = (orderId = '') => {
    setScannerTargetId(orderId);
    setIsScannerOpen(true);
  };

  const handleCreateNewClick = () => {
    setEditingOrder(null);
    setActiveTab('create');
  };

  const [customIp, setCustomIp] = useState(() => {
    return localStorage.getItem('suivie_network_ip') || '';
  });

  const handleIpChange = (newIp) => {
    setCustomIp(newIp);
    localStorage.setItem('suivie_network_ip', newIp);
  };

  const detectLocalIp = () => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      pc.createOffer().then(offer => pc.setLocalDescription(offer));
      pc.onicecandidate = (event) => {
        if (!event || !event.candidate) return;
        const ipMatch = /([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/.exec(event.candidate.candidate);
        if (ipMatch && ipMatch[1] && !ipMatch[1].startsWith('127.')) {
          handleIpChange(ipMatch[1]);
          pc.close();
        }
      };
    } catch (e) {
      console.warn('WebRTC IP detection fallback', e);
    }
  };

  const currentPort = typeof window !== 'undefined' ? (window.location.port || '5173') : '5173';
  const effectiveHost = customIp.trim() 
    ? `${customIp.trim()}:${currentPort}` 
    : (typeof window !== 'undefined' ? window.location.host : 'localhost:5173');
  
  const mobileAccessUrl = typeof window !== 'undefined' 
    ? `${window.location.protocol}//${effectiveHost}${window.location.pathname}?mode=mobile#mobile` 
    : '';

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(mobileAccessUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 3000);
  };

  const countEnCours = orders.filter(o => o.status === 'en_cours').length;
  const countEnAttente = orders.filter(o => o.status === 'en_attente').length;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      {/* Top Navbar */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid var(--border-color)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: 'var(--shadow-sm)'
      }} className="no-print">
        <div style={{
          maxWidth: '1240px',
          margin: '0 auto',
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          
          {/* Brand Logo & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => setActiveTab('list')}>
            <div style={{
              background: 'var(--gradient-brand)',
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(2, 132, 199, 0.25)'
            }}>
              <Factory size={24} style={{ color: '#fff' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.4rem', lineHeight: '1.1' }}>SuiviPRO <span style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem', fontWeight: 'normal' }}>v1.3</span></h1>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Production & QR Code Atelier</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className={`btn ${activeTab === 'mobile-atelier' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('mobile-atelier')}
              style={{
                borderColor: activeTab === 'mobile-atelier' ? 'transparent' : 'var(--accent-cyan)',
                color: activeTab === 'mobile-atelier' ? '#fff' : 'var(--accent-cyan)',
                fontWeight: '700'
              }}
            >
              <Smartphone size={18} /> Atelier Mobile
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => setIsMobileQRModalOpen(true)}
              style={{ borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)', background: 'rgba(2, 132, 199, 0.05)' }}
              title="Connexion Réseau Local Wi-Fi & QR Code smartphone"
            >
              <QrCode size={18} /> QR Accès Tel (Wi-Fi)
            </button>

            <button
              className={`btn ${activeTab === 'create' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={handleCreateNewClick}
            >
              {editingOrder ? <Edit3 size={18} /> : <PlusCircle size={18} />}
              {editingOrder ? 'Modifier la Commande' : 'Nouvelle Commande'}
            </button>

            <button
              className={`btn ${activeTab === 'list' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('list')}
              style={{ position: 'relative' }}
            >
              <ListFilter size={18} /> Commandes
              {(countEnAttente + countEnCours) > 0 && (
                <span className="badge badge-amber" style={{ fontSize: '0.7rem', padding: '2px 6px', marginLeft: '4px' }}>
                  {countEnAttente + countEnCours}
                </span>
              )}
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => handleOpenScanner()}
              style={{ borderColor: 'var(--accent-purple)', color: 'var(--accent-purple)' }}
            >
              <QrCode size={18} /> Scanner QR Code
            </button>

            <button
              className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <LayoutDashboard size={18} /> Dashboard
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '30px 20px' }}>
        {activeTab === 'mobile-atelier' && (
          <MobileAtelierView onOrdersUpdated={loadOrders} />
        )}

        {activeTab === 'create' && (
          <OrderForm
            onOrderCreated={handleOrderCreatedOrUpdated}
            editingOrder={editingOrder}
            onCancelEdit={handleCancelEdit}
          />
        )}

        {activeTab === 'list' && (
          <OrderList
            orders={orders}
            onRefresh={loadOrders}
            onOpenScanner={handleOpenScanner}
            onEditOrder={handleEditOrder}
            onPrintOrder={(order) => setSelectedOrderForPrint(order)}
          />
        )}

        {activeTab === 'dashboard' && (
          <Dashboard orders={orders} />
        )}
      </main>

      {/* Global QR Scanner Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onOrderUpdated={loadOrders}
        initialOrderId={scannerTargetId}
      />

      {/* Modal QR Code & Connexion Réseau Local (Wi-Fi) */}
      {isMobileQRModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }} className="no-print">
          <div className="glass-card animate-fade-in" style={{
            background: '#ffffff',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'center',
            position: 'relative',
            boxShadow: 'var(--shadow-glow)'
          }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setIsMobileQRModalOpen(false)}
              style={{ position: 'absolute', right: '16px', top: '16px', borderRadius: '50%', padding: '6px' }}
            >
              <X size={18} />
            </button>

            <div style={{
              background: 'rgba(2, 132, 199, 0.1)',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              color: 'var(--accent-cyan)'
            }}>
              <Smartphone size={30} />
            </div>

            <h3 style={{ fontSize: '1.35rem', marginBottom: '4px' }}>Connexion Réseau Local Wi-Fi</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '16px' }}>
              Connectez n'importe quel smartphone de l'atelier sur le même réseau Wi-Fi.
            </p>

            {/* CONFIGURATION IP RESEAU LOCAL */}
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              padding: '14px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '18px',
              textAlign: 'left'
            }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 'bold', display: 'block', marginBottom: '6px', color: 'var(--text-primary)' }}>
                🌐 Adresse IP locale du PC sur le réseau Wi-Fi :
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ fontSize: '0.9rem', fontFamily: 'monospace', fontWeight: 'bold' }}
                  placeholder="Ex: 192.168.1.50"
                  value={customIp}
                  onChange={(e) => handleIpChange(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={detectLocalIp}
                  style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}
                  title="Tenter de détecter automatiquement l'IP locale"
                >
                  Auto-détecter IP
                </button>
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                💡 Sur Windows: tapez <code>ipconfig</code> dans l'invite de commandes pour trouver votre IP (ex: 192.168.1.XX).
              </div>
            </div>

            {/* QR CODE CONTAINER */}
            <div style={{
              background: '#ffffff',
              padding: '16px',
              borderRadius: '16px',
              border: '2px solid var(--border-color)',
              display: 'inline-block',
              boxShadow: '0 8px 25px rgba(0,0,0,0.06)',
              marginBottom: '16px'
            }}>
              <QRCodeSVG
                value={mobileAccessUrl}
                size={210}
                level="H"
                includeMargin={true}
              />
            </div>

            {/* Direct URL Box & Copy */}
            <div style={{
              background: 'var(--bg-secondary)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              wordBreak: 'break-all',
              border: '1px solid var(--border-color)',
              marginBottom: '16px'
            }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{mobileAccessUrl}</span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleCopyUrl}
                style={{ shrink: 0, padding: '4px 8px' }}
                title="Copier le lien"
              >
                {copiedUrl ? <Check size={14} style={{ color: 'var(--accent-emerald)' }} /> : <Copy size={14} />}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => {
                  setIsMobileQRModalOpen(false);
                  setActiveTab('mobile-atelier');
                }}
              >
                <Smartphone size={18} /> Tester l'interface sur cet écran
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Fiche Atelier Modal (Rendered at root level so zIndex: 99999 sits ON TOP of sticky header and is perfectly centered!) */}
      {selectedOrderForPrint && (
        <FicheAtelierModal
          order={selectedOrderForPrint}
          onClose={() => setSelectedOrderForPrint(null)}
        />
      )}

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-color)',
        padding: '16px 20px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.85rem',
        background: '#ffffff'
      }} className="no-print">
        SuiviPRO Atelier • Gestion de production sur-mesure & QR Code • {orders.length} commande(s) enregistrée(s)
      </footer>
    </div>
  );
}
