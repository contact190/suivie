import React, { useState } from 'react';
import { X, Layers, Clock, CheckSquare, Square, PlusCircle, AlertCircle } from 'lucide-react';
import { createSubOrder, formatDuration } from '../services/storage';

export default function CreateSubOrderModal({ parentOrder, onClose, onSubOrderCreated }) {
  if (!parentOrder) return null;

  // Track selected article IDs for the sub-order (default to all non-finished or all articles)
  const initialSelected = (parentOrder.articles || [])
    .filter(a => !a.isFinished)
    .map(a => a.id);

  const [selectedArticleIds, setSelectedArticleIds] = useState(
    initialSelected.length > 0 ? initialSelected : (parentOrder.articles || []).map(a => a.id)
  );

  const [subOrderNotes, setSubOrderNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Calculate elapsed launch time
  const launchTime = parentOrder.launchedAt ? new Date(parentOrder.launchedAt).getTime() : 0;
  const elapsedMinutes = launchTime > 0 ? Math.max(0, Math.round((Date.now() - launchTime) / (1000 * 60))) : 0;
  const elapsedHours = (elapsedMinutes / 60).toFixed(1);

  const toggleArticleSelection = (articleId) => {
    setSelectedArticleIds(prev =>
      prev.includes(articleId)
        ? prev.filter(id => id !== articleId)
        : [...prev, articleId]
    );
  };

  const handleSelectAll = () => {
    setSelectedArticleIds((parentOrder.articles || []).map(a => a.id));
  };

  const handleDeselectAll = () => {
    setSelectedArticleIds([]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedArticleIds.length === 0) {
      setErrorMsg('Veuillez sélectionner au moins un article non fini pour la sous-commande.');
      return;
    }

    const selectedArticles = (parentOrder.articles || []).filter(a => selectedArticleIds.includes(a.id));

    const newSubOrder = createSubOrder(parentOrder.id, selectedArticles, subOrderNotes);
    if (newSubOrder) {
      if (onSubOrderCreated) onSubOrderCreated(newSubOrder);
      onClose();
    } else {
      setErrorMsg('Erreur lors de la création de la sous-commande.');
    }
  };

  return (
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
        maxWidth: '620px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '26px',
        borderRadius: 'var(--radius-lg)',
        position: 'relative',
        boxShadow: 'var(--shadow-glow)'
      }}>
        {/* Close Button */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onClose}
          style={{ position: 'absolute', right: '16px', top: '16px', borderRadius: '50%', padding: '6px' }}
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{
            background: 'rgba(217, 119, 6, 0.15)',
            color: 'var(--accent-amber)',
            padding: '10px',
            borderRadius: '12px'
          }}>
            <Clock size={26} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.3rem', margin: 0, color: 'var(--text-primary)' }}>
              Créer une Sous-Commande (&gt; 24h)
            </h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Commande initiale : <strong>{parentOrder.id}</strong> — {parentOrder.nomCommande}
            </span>
          </div>
        </div>

        {/* Info Banner on 24h delay */}
        <div style={{
          background: 'rgba(217, 119, 6, 0.1)',
          border: '1px solid rgba(217, 119, 6, 0.3)',
          padding: '12px 14px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '20px',
          fontSize: '0.88rem',
          color: '#b45309'
        }}>
          ⏱️ Commande lancée il y a <strong>{formatDuration(elapsedMinutes)}</strong> ({elapsedHours} heures).
          Sélectionnez ci-dessous les articles <strong>non finis</strong> à détacher ou fabriquer dans une nouvelle sous-commande.
        </div>

        {errorMsg && (
          <div style={{
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            color: '#e11d48',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.88rem',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={18} /> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Section: Article Selection */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={16} style={{ color: 'var(--accent-cyan)' }} />
                Sélection des Articles Non Finis ({selectedArticleIds.length} / {parentOrder.articles?.length || 0}) :
              </label>
              
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleSelectAll}
                  style={{ fontSize: '0.78rem', padding: '3px 8px' }}
                >
                  Tout cocher
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleDeselectAll}
                  style={{ fontSize: '0.78rem', padding: '3px 8px' }}
                >
                  Tout décocher
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
              {(parentOrder.articles || []).map((art, idx) => {
                const isSelected = selectedArticleIds.includes(art.id);

                return (
                  <div
                    key={art.id || idx}
                    onClick={() => toggleArticleSelection(art.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: isSelected ? '2px solid var(--accent-amber)' : '1px solid var(--border-color)',
                      background: isSelected ? 'rgba(217, 119, 6, 0.05)' : 'var(--bg-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ color: isSelected ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
                        {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                          {art.quantity}x {art.typeMenuiserie || art.designation}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          📐 {art.largeur} x {art.hauteur} mm • Gamme: <strong>{art.gamme}</strong>
                          {art.avecCaisson && ' • [Caisson]'}
                          {art.avecFixe && ' • [Fixe]'}
                        </div>
                      </div>
                    </div>

                    <span className={`badge ${isSelected ? 'badge-amber' : 'badge-cyan'}`} style={{ fontSize: '0.75rem' }}>
                      {isSelected ? 'NON FINI (A Inclure)' : 'Fini / Exclu'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Custom Sub-order Notes */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{ fontWeight: '700', fontSize: '0.88rem', display: 'block', marginBottom: '6px', color: 'var(--text-primary)' }}>
              📝 Note explicative pour la sous-commande (Optionnel) :
            </label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="Ex: Pièces en attente d'usinage spécial, relancées après 24h..."
              value={subOrderNotes}
              onChange={(e) => setSubOrderNotes(e.target.value)}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ background: 'var(--gradient-amber)', border: 'none' }}
            >
              <PlusCircle size={18} /> Créer la Sous-Commande
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
