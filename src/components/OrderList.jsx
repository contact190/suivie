import React, { useState } from 'react';
import { Search, PlayCircle, CheckCircle, Clock, QrCode, Trash2, Filter, Edit3, Disc, Layers, HardDrive, Sparkles, ChevronDown, ChevronRight, ChevronsUpDown, GitBranch, PlusCircle } from 'lucide-react';
import { updateOrderStatus, deleteOrder, formatDuration, cleanupStorageQuota, toggleArticleFinished } from '../services/storage';
import CreateSubOrderModal from './CreateSubOrderModal';

export default function OrderList({ orders, onRefresh, onOpenScanner, onEditOrder, onPrintOrder }) {
  const [filterStatus, setFilterStatus] = useState('toutes');
  const [filterCategory, setFilterCategory] = useState('tous'); // 'tous' | 'menuiserie' | 'volet'
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [expandedOrders, setExpandedOrders] = useState({});
  const [subOrderTargetOrder, setSubOrderTargetOrder] = useState(null);
  const [deletingOrderId, setDeletingOrderId] = useState(null);

  const toggleExpand = (orderId, e) => {
    if (e) e.stopPropagation();
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const handleExpandAll = () => {
    const allExpanded = {};
    orders.forEach(o => { allExpanded[o.id] = true; });
    setExpandedOrders(allExpanded);
  };

  const handleCollapseAll = () => {
    setExpandedOrders({});
  };

  const handleStatusChange = (orderId, newStatus, e) => {
    if (e) e.stopPropagation();
    updateOrderStatus(orderId, newStatus);
    onRefresh();
  };

  const confirmDelete = (orderId, e) => {
    if (e) e.stopPropagation();
    setDeletingOrderId(orderId);
  };

  const executeDelete = () => {
    if (!deletingOrderId) return;
    const targetId = deletingOrderId;
    deleteOrder(targetId);
    setDeletingOrderId(null);
    setToastMsg(`🗑️ Commande ${targetId} supprimée avec succès !`);
    setTimeout(() => setToastMsg(''), 4000);
    onRefresh();
  };

  const handleCleanupStorage = () => {
    cleanupStorageQuota();
    setToastMsg('🧹 Espace mémoire navigateur optimisé avec succès !');
    setTimeout(() => setToastMsg(''), 3500);
    onRefresh();
  };

  const handleToggleArticle = (orderId, articleId, e) => {
    if (e) e.stopPropagation();
    toggleArticleFinished(orderId, articleId);
    onRefresh();
  };

  // Helper: check if order was launched > 24 hours ago
  const isLaunchedOver24h = (order) => {
    if (!order.launchedAt) return false;
    const launchTime = new Date(order.launchedAt).getTime();
    if (isNaN(launchTime)) return false;
    const elapsedMinutes = (Date.now() - launchTime) / (1000 * 60);
    return elapsedMinutes >= 24 * 60; // 24 hours
  };

  // Filter & Search Logic
  const filteredOrders = orders.filter(o => {
    const matchesStatus = filterStatus === 'toutes' || o.status === filterStatus;
    const matchesCategory = filterCategory === 'tous' || (o.orderCategory || 'menuiserie') === filterCategory;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      o.id.toLowerCase().includes(searchLower) ||
      o.nomCommande.toLowerCase().includes(searchLower) ||
      o.client.toLowerCase().includes(searchLower) ||
      (o.parentOrderId && o.parentOrderId.toLowerCase().includes(searchLower)) ||
      o.articles.some(a => 
        (a.designation && a.designation.toLowerCase().includes(searchLower)) || 
        (a.gamme && a.gamme.toLowerCase().includes(searchLower)) ||
        (a.typeLame && a.typeLame.toLowerCase().includes(searchLower))
      );
    return matchesStatus && matchesCategory && matchesSearch;
  });

  const countEnAttente = orders.filter(o => o.status === 'en_attente').length;
  const countEnCours = orders.filter(o => o.status === 'en_cours').length;
  const countFini = orders.filter(o => o.status === 'fini').length;
  const countOver24h = orders.filter(o => isLaunchedOver24h(o)).length;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{ background: 'rgba(5, 150, 105, 0.1)', border: '1px solid rgba(5, 150, 105, 0.3)', color: '#059669', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
          <Sparkles size={18} /> {toastMsg}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingOrderId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 999999
        }}>
          <div className="glass-card" style={{ background: '#fff', padding: '24px', borderRadius: '12px', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '12px', color: '#e11d48' }}>Confirmer la suppression</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
              Voulez-vous vraiment supprimer la commande <strong>{deletingOrderId}</strong> ? Cette action est irréversible.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setDeletingOrderId(null)}>Annuler</button>
              <button className="btn btn-danger" onClick={executeDelete}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers style={{ color: 'var(--accent-cyan)' }} />
            Suivi des Commandes ({filteredOrders.length})
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Cliquez sur une ligne de commande pour afficher le détail des articles ou créer une sous-commande.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleExpandAll} title="Tout ouvrir">
            <ChevronsUpDown size={15} /> Tout Déplier
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleCollapseAll} title="Tout fermer">
            Tout Replier
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleCleanupStorage} title="Libérer mémoire">
            <HardDrive size={15} /> Mémoire
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="glass-card" style={{ padding: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Status & Category Filters */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          
          {/* Category Filter Pills */}
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginRight: '8px' }}>
            <button
              className={`btn btn-sm`}
              onClick={() => setFilterCategory('tous')}
              style={{ border: 'none', background: filterCategory === 'tous' ? 'var(--accent-cyan)' : 'transparent', color: filterCategory === 'tous' ? '#fff' : 'var(--text-primary)' }}
            >
              Tous
            </button>
            <button
              className={`btn btn-sm`}
              onClick={() => setFilterCategory('menuiserie')}
              style={{ border: 'none', background: filterCategory === 'menuiserie' ? 'var(--accent-cyan)' : 'transparent', color: filterCategory === 'menuiserie' ? '#fff' : 'var(--text-primary)' }}
            >
              🪟 Menuiseries
            </button>
            <button
              className={`btn btn-sm`}
              onClick={() => setFilterCategory('volet')}
              style={{ border: 'none', background: filterCategory === 'volet' ? 'var(--accent-purple)' : 'transparent', color: filterCategory === 'volet' ? '#fff' : 'var(--text-primary)' }}
            >
              🌀 Volets Roulants
            </button>
          </div>

          {/* Status Pills */}
          <button
            className={`btn btn-sm ${filterStatus === 'toutes' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterStatus('toutes')}
          >
            Toutes ({orders.length})
          </button>
          <button
            className={`btn btn-sm ${filterStatus === 'en_attente' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterStatus('en_attente')}
            style={filterStatus === 'en_attente' ? { background: 'var(--gradient-amber)' } : {}}
          >
            <Clock size={14} /> Attente ({countEnAttente})
          </button>
          <button
            className={`btn btn-sm ${filterStatus === 'en_cours' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterStatus('en_cours')}
          >
            <PlayCircle size={14} /> En cours ({countEnCours})
          </button>
          <button
            className={`btn btn-sm ${filterStatus === 'fini' ? 'btn-emerald' : 'btn-secondary'}`}
            onClick={() => setFilterStatus('fini')}
          >
            <CheckCircle size={14} /> Fini ({countFini})
          </button>

          {countOver24h > 0 && (
            <span className="badge badge-amber" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
              ⏰ {countOver24h} lancée(s) &gt; 24h
            </span>
          )}
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '36px' }}
            placeholder="Rechercher (ex: CMD, client, gamme)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Empty State */}
      {filteredOrders.length === 0 && (
        <div className="glass-card" style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Filter size={44} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <h3>Aucune commande correspondant aux critères</h3>
          <p style={{ marginTop: '6px', fontSize: '0.95rem' }}>
            {orders.length === 0
              ? 'Aucune commande enregistrée. Cliquez sur "Nouvelle Commande" pour commencer.'
              : 'Essayez de modifier votre filtre ou terme de recherche.'
            }
          </p>
        </div>
      )}

      {/* SCROLLABLE ACCORDION LIST CONTAINER */}
      {filteredOrders.length > 0 && (
        <div style={{
          maxHeight: 'calc(100vh - 240px)',
          overflowY: 'auto',
          paddingRight: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {filteredOrders.map((order) => {
            const isVolet = order.orderCategory === 'volet';
            const isExpanded = Boolean(expandedOrders[order.id]);
            const totalQty = order.articles.reduce((acc, a) => acc + (a.quantity || 1), 0);
            const isPending = order.status === 'en_attente';
            const launchedOver24h = isLaunchedOver24h(order);
            const hasSubOrders = (order.subOrders || []).length > 0;

            return (
              <div
                key={order.id}
                className="glass-card"
                style={{
                  borderLeft: order.isSubOrder
                    ? '5px solid var(--accent-amber)'
                    : isVolet ? '5px solid var(--accent-purple)' : '5px solid var(--accent-cyan)',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* ACCORDION ROW HEADER */}
                <div
                  onClick={(e) => toggleExpand(order.id, e)}
                  style={{
                    padding: '16px 20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    flexWrap: 'wrap',
                    background: isExpanded ? 'var(--bg-secondary)' : '#ffffff',
                    borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none',
                    borderRadius: isExpanded ? 'var(--radius-md) var(--radius-md) 0 0' : 'var(--radius-md)'
                  }}
                >
                  {/* Left Column: Chevron + ID + Sub-order badge + Title + Client */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '300px' }}>
                    <div style={{ color: 'var(--text-muted)' }}>
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className={`badge ${order.isSubOrder ? 'badge-amber' : isVolet ? 'badge-purple' : 'badge-cyan'}`} style={{ fontSize: '0.8rem' }}>
                          {order.id}
                        </span>
                        
                        {order.isSubOrder && (
                          <span className="badge badge-amber" style={{ fontSize: '0.72rem', padding: '2px 6px' }}>
                            <GitBranch size={11} /> Sous-commande de {order.parentOrderId}
                          </span>
                        )}

                        {hasSubOrders && (
                          <span className="badge badge-cyan" style={{ fontSize: '0.72rem', padding: '2px 6px' }}>
                            📦 {order.subOrders.length} sous-commande(s)
                          </span>
                        )}

                        {launchedOver24h && (
                          <span className="badge badge-amber" style={{ fontSize: '0.72rem', padding: '2px 6px', animation: 'pulse 2s infinite' }}>
                            ⏰ Lancée &gt; 24h
                          </span>
                        )}

                        {isVolet && !order.isSubOrder && (
                          <span className="badge badge-purple" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                            <Disc size={11} /> VOLET
                          </span>
                        )}

                        <span style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                          {order.nomCommande}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Client : <strong>{order.client}</strong> • <span style={{ color: 'var(--accent-cyan)', fontWeight: '600' }}>{order.articles.length} article(s) ({totalQty} pce)</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle Column: Status Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {order.status === 'en_attente' && (
                      <span className="badge badge-amber"><Clock size={12} /> En attente</span>
                    )}
                    {order.status === 'en_cours' && (
                      <span className="badge badge-cyan"><PlayCircle size={12} /> En cours</span>
                    )}
                    {order.status === 'fini' && (
                      <span className="badge badge-emerald"><CheckCircle size={12} /> Fini ({formatDuration(order.durationMinutes)})</span>
                    )}
                  </div>

                  {/* Right Column: Quick Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                    
                    {/* BUTTON TO CREATE SUB-ORDER FOR ORDERS LAUNCHED > 24H AGO */}
                    {launchedOver24h && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSubOrderTargetOrder(order);
                        }}
                        style={{
                          background: 'rgba(217, 119, 6, 0.1)',
                          borderColor: 'var(--accent-amber)',
                          color: '#b45309',
                          fontWeight: '700'
                        }}
                        title="Créer une sous-commande avec les articles non finis"
                      >
                        <PlusCircle size={14} /> Sous-commande (&gt;24h)
                      </button>
                    )}

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onPrintOrder(order)}
                      title="Imprimer Fiche Atelier & QR Code"
                    >
                      <QrCode size={14} /> Fiche QR
                    </button>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onOpenScanner(order.id)}
                      title="Ouvrir le scanner"
                    >
                      <PlayCircle size={14} /> Scan
                    </button>

                    {isPending && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onEditOrder(order)}
                        style={{ color: 'var(--accent-cyan)', borderColor: 'rgba(2,132,199,0.3)' }}
                        title="Modifier la commande"
                      >
                        <Edit3 size={14} /> Modifier
                      </button>
                    )}

                    {order.status === 'en_attente' && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={(e) => handleStatusChange(order.id, 'en_cours', e)}
                      >
                        Lancer
                      </button>
                    )}
                    {order.status === 'en_cours' && (
                      <button
                        className="btn btn-emerald btn-sm"
                        onClick={(e) => handleStatusChange(order.id, 'fini', e)}
                      >
                        Terminer
                      </button>
                    )}

                    <button
                      className="btn btn-danger btn-sm"
                      onClick={(e) => confirmDelete(order.id, e)}
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* EXPANDABLE ACCORDION BODY */}
                {isExpanded && (
                  <div className="animate-fade-in" style={{ padding: '20px', background: '#ffffff', borderTop: '1px solid var(--border-color)', borderRadius: '0 0 var(--radius-md) var(--radius-md)' }}>
                    
                    {order.notes && (
                      <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                        <strong>Notes / Consignes :</strong> {order.notes}
                      </div>
                    )}

                    {/* Sub-Orders List Link if any */}
                    {hasSubOrders && (
                      <div style={{ background: 'rgba(217, 119, 6, 0.08)', border: '1px solid rgba(217, 119, 6, 0.25)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.85rem' }}>
                        <strong style={{ color: '#b45309' }}>Sous-commandes rattachées :</strong>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                          {order.subOrders.map(subId => (
                            <span key={subId} className="badge badge-amber" style={{ fontSize: '0.78rem' }}>
                              <GitBranch size={11} /> {subId}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Bar for Sub-order creation if launched > 24h */}
                    {launchedOver24h && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fffbeb', border: '1px solid #fef3c7', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '0.88rem', color: '#92400e' }}>
                          ⏰ Cette commande a été lancée depuis plus de 24 heures. Vous pouvez extraire les articles non finis vers une sous-commande.
                        </div>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => setSubOrderTargetOrder(order)}
                          style={{ background: 'var(--gradient-amber)', border: 'none', whiteSpace: 'nowrap' }}
                        >
                          <PlusCircle size={15} /> Créer une Sous-Commande
                        </button>
                      </div>
                    )}

                    {/* Articles Table */}
                    <h4 style={{ fontSize: '1rem', marginBottom: '10px', color: 'var(--text-primary)' }}>
                      Détail des Articles à Fabriquer ({order.articles.length}) :
                    </h4>

                    <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)', textTransform: 'uppercase', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '8px 12px', textAlign: 'center', width: '40px' }}>#</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Désignation / Type</th>
                            <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qté</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Dimensions (L x H)</th>
                            {isVolet ? (
                              <>
                                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Lame</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Caisson</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Manœuvre / Coloris</th>
                              </>
                            ) : (
                              <>
                                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Gamme</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Option Caisson</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Option Fixe</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {order.articles.map((art, idx) => (
                            <tr key={art.id || idx} style={{ borderBottom: '1px solid var(--border-color)', background: art.isFinished ? 'rgba(16, 185, 129, 0.04)' : 'transparent' }}>
                              <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                              <td style={{ padding: '8px 12px', fontWeight: '600' }}>
                                {art.typeMenuiserie ? `${art.typeMenuiserie}` : art.designation}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 'bold' }}>{art.quantity}</td>
                              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 'bold', color: isVolet ? 'var(--accent-purple)' : 'var(--accent-cyan)' }}>
                                {isVolet ? `${art.largeur} x ${art.hauteur} mm` : `H: ${art.hauteur} | L: ${art.largeur}`}
                              </td>

                              {isVolet ? (
                                <>
                                  <td style={{ padding: '8px 12px', fontSize: '0.82rem' }}>{art.typeLame}</td>
                                  <td style={{ padding: '8px 12px', fontSize: '0.82rem' }}>{art.typeCaisson}</td>
                                  <td style={{ padding: '8px 12px', fontSize: '0.82rem' }}>
                                    <div>{art.typeManoeuvre}</div>
                                    <div style={{ color: 'var(--text-muted)' }}>{art.coloris}</div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td style={{ padding: '8px 12px', fontWeight: '600' }}>{art.gamme}</td>
                                  <td style={{ padding: '8px 12px' }}>
                                    {art.avecCaisson ? <span style={{ color: 'var(--accent-amber)', fontWeight: 'bold' }}>Oui (H: {art.caissonHauteur}mm)</span> : <span style={{ color: 'var(--text-muted)' }}>Non</span>}
                                  </td>
                                  <td style={{ padding: '8px 12px' }}>
                                    {art.avecFixe && art.fixeDetails ? (
                                      <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
                                        Oui ({art.fixeDetails.direction === 'vertical' ? `Vertical L:${art.fixeDetails.largeur || 400}mm` : `Horizontal H:${art.fixeDetails.hauteur || 400}mm`})
                                      </span>
                                    ) : (
                                      <span style={{ color: 'var(--text-muted)' }}>Non</span>
                                    )}
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Timestamps */}
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--text-muted)', paddingTop: '10px', borderTop: '1px dashed var(--border-color)' }}>
                      <div>📅 <strong>Créé le :</strong> {new Date(order.createdAt).toLocaleDateString('fr-FR')} à {new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                      {order.launchedAt && <div>🚀 <strong>Lancé le :</strong> {new Date(order.launchedAt).toLocaleDateString('fr-FR')} à {new Date(order.launchedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>}
                      {order.completedAt && (
                        <div style={{ color: 'var(--accent-emerald)', fontWeight: 'bold' }}>
                          ✅ <strong>Terminé le :</strong> {new Date(order.completedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} (Durée: {formatDuration(order.durationMinutes)})
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sub-order Modal */}
      {subOrderTargetOrder && (
        <CreateSubOrderModal
          parentOrder={subOrderTargetOrder}
          onClose={() => setSubOrderTargetOrder(null)}
          onSubOrderCreated={(newSubOrder) => {
            setToastMsg(`🎉 Sous-commande ${newSubOrder.id} créée avec succès !`);
            setTimeout(() => setToastMsg(''), 4500);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
