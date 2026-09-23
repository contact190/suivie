import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Copy, Save, Layers, Box, Maximize2, AlertCircle, Sparkles, Disc, Search, Check, Edit3, X } from 'lucide-react';
import { addOrder, updateOrder, getStoredGammes, saveStoredGamme, DEFAULT_TYPES_LAME, DEFAULT_TYPES_CAISSON, DEFAULT_TYPES_MANOEUVRE, DEFAULT_COLORIS } from '../services/storage';

// Searchable & Creatable Gamme Combobox Component
function GammeCombobox({ value, onChange }) {
  const [query, setQuery] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [availableGammes, setAvailableGammes] = useState(() => getStoredGammes());
  const containerRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = availableGammes.filter(g => g.toLowerCase().includes(query.toLowerCase()));
  const exactMatch = availableGammes.some(g => g.toLowerCase() === query.trim().toLowerCase());

  const handleSelect = (gammeName) => {
    setQuery(gammeName);
    onChange(gammeName);
    setIsOpen(false);
  };

  const handleAddNew = () => {
    if (!query.trim()) return;
    const trimmed = query.trim();
    const updatedList = saveStoredGamme(trimmed);
    setAvailableGammes(updatedList);
    handleSelect(trimmed);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Rechercher ou saisir une gamme..."
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setIsOpen(true);
          }}
          style={{ paddingRight: '30px' }}
        />
        <Search size={16} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 100,
          maxHeight: '220px',
          overflowY: 'auto',
          background: '#ffffff',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid #cbd5e1',
          marginTop: '4px',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.15)'
        }}>
          {filtered.length > 0 ? (
            filtered.map(g => (
              <div
                key={g}
                onClick={() => handleSelect(g)}
                style={{
                  padding: '9px 12px',
                  cursor: 'pointer',
                  background: value === g ? 'var(--bg-secondary)' : 'transparent',
                  fontWeight: value === g ? '700' : '500',
                  color: value === g ? 'var(--accent-cyan)' : 'var(--text-primary)',
                  fontSize: '0.9rem',
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>{g}</span>
                {value === g && <Check size={14} style={{ color: 'var(--accent-cyan)' }} />}
              </div>
            ))
          ) : (
            <div style={{ padding: '10px 12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Aucune gamme correspondante.
            </div>
          )}

          {!exactMatch && query.trim().length > 0 && (
            <div
              onClick={handleAddNew}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                background: 'rgba(2, 132, 199, 0.08)',
                color: 'var(--accent-cyan)',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                borderTop: '1px solid #cbd5e1',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={16} /> Ajouter la nouvelle gamme "{query.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OrderForm({ onOrderCreated, editingOrder, onCancelEdit }) {
  const isEditMode = Boolean(editingOrder);

  const [orderCategory, setOrderCategory] = useState('menuiserie');
  const [nomCommande, setNomCommande] = useState('');
  const [client, setClient] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Initial Menuiserie article generator
  const createEmptyMenuiserieArticle = () => {
    const gammes = getStoredGammes();
    return {
      id: `art-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      typeMenuiserie: 'Coulissant',
      designation: 'Coulissant Standard',
      quantity: 1,
      hauteur: 1450,
      largeur: 1200,
      gamme: gammes[0] || 'h36 2p',
      avecCaisson: false,
      caissonHauteur: 200,
      avecFixe: false,
      fixeDetails: {
        hauteur: 400,
        largeur: 1200,
        gamme: gammes[0] || 'h36 2p'
      }
    };
  };

  // Initial Volet article generator
  const createEmptyVoletArticle = () => ({
    id: `vlt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    designation: 'Volet Roulant Fenêtre',
    quantity: 1,
    hauteur: 1400,
    largeur: 1200,
    typeLame: DEFAULT_TYPES_LAME[0],
    typeCaisson: DEFAULT_TYPES_CAISSON[0],
    typeManoeuvre: DEFAULT_TYPES_MANOEUVRE[0],
    coloris: DEFAULT_COLORIS[0]
  });

  const [articles, setArticles] = useState([createEmptyMenuiserieArticle()]);

  // Pre-fill fields when editing an order
  useEffect(() => {
    if (editingOrder) {
      setOrderCategory(editingOrder.orderCategory || 'menuiserie');
      setNomCommande(editingOrder.nomCommande || '');
      setClient(editingOrder.client || '');
      setNotes(editingOrder.notes || '');

      if (editingOrder.articles && editingOrder.articles.length > 0) {
        const sanitized = editingOrder.articles.map(art => ({
          ...art,
          gamme: art.gamme || 'h36 2p',
          designation: art.designation || art.typeMenuiserie || 'Article',
          typeMenuiserie: art.typeMenuiserie || 'Coulissant',
          quantity: art.quantity || 1,
          hauteur: art.hauteur || 1000,
          largeur: art.largeur || 1000,
          typeLame: art.typeLame || DEFAULT_TYPES_LAME[0],
          typeCaisson: art.typeCaisson || DEFAULT_TYPES_CAISSON[0],
          typeManoeuvre: art.typeManoeuvre || DEFAULT_TYPES_MANOEUVRE[0],
          coloris: art.coloris || DEFAULT_COLORIS[0]
        }));
        setArticles(sanitized);
      }
    }
  }, [editingOrder]);

  const handleCategorySwitch = (newCat) => {
    setOrderCategory(newCat);
    if (!isEditMode) {
      if (newCat === 'volet') {
        setArticles([createEmptyVoletArticle()]);
      } else {
        setArticles([createEmptyMenuiserieArticle()]);
      }
    }
  };

  const handleAddArticle = () => {
    if (orderCategory === 'volet') {
      setArticles([...articles, createEmptyVoletArticle()]);
    } else {
      setArticles([...articles, createEmptyMenuiserieArticle()]);
    }
  };

  const handleDuplicateArticle = (index) => {
    const artToCopy = articles[index];
    const duplicated = {
      ...artToCopy,
      id: `${orderCategory === 'volet' ? 'vlt' : 'art'}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      fixeDetails: artToCopy.fixeDetails ? { ...artToCopy.fixeDetails } : undefined
    };
    const newArticles = [...articles];
    newArticles.splice(index + 1, 0, duplicated);
    setArticles(newArticles);
  };

  const handleRemoveArticle = (index) => {
    if (articles.length === 1) {
      setErrorMsg('Une commande doit comporter au moins 1 article.');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    setArticles(articles.filter((_, i) => i !== index));
  };

  const handleArticleChange = (index, field, value) => {
    const newArticles = [...articles];
    let updatedArticle = { ...newArticles[index], [field]: value };
    if (field === 'typeMenuiserie') {
      updatedArticle.designation = `${value} Standard`;
    }
    newArticles[index] = updatedArticle;
    setArticles(newArticles);
  };

  const handleFixeChange = (index, field, value) => {
    const newArticles = [...articles];
    const currentFixe = newArticles[index].fixeDetails || { hauteur: 400, largeur: newArticles[index].largeur, gamme: newArticles[index].gamme };
    newArticles[index].fixeDetails = {
      ...currentFixe,
      [field]: value
    };
    setArticles(newArticles);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!nomCommande || !nomCommande.trim()) {
      setErrorMsg('Veuillez saisir le nom ou la référence de la commande.');
      return;
    }

    if (!client || !client.trim()) {
      setErrorMsg('Veuillez saisir le nom du client.');
      return;
    }

    // Validate articles safely
    for (let i = 0; i < articles.length; i++) {
      const art = articles[i];
      if (!art.hauteur || art.hauteur <= 0 || !art.largeur || art.largeur <= 0) {
        setErrorMsg(`Article #${i + 1} : La hauteur et la largeur doivent être supérieures à 0.`);
        return;
      }
      if (orderCategory === 'menuiserie') {
        const gammeVal = String(art.gamme || '').trim();
        if (!gammeVal) {
          setErrorMsg(`Article #${i + 1} : Veuillez renseigner ou sélectionner une Gamme.`);
          return;
        }
      }
    }

    try {
      let savedOrder;
      if (isEditMode && editingOrder) {
        savedOrder = {
          ...editingOrder,
          orderCategory,
          nomCommande: nomCommande.trim(),
          client: client.trim(),
          notes: notes ? notes.trim() : '',
          articles
        };
        updateOrder(savedOrder);
        setSuccessMsg(`La commande ${savedOrder.id} a été mise à jour avec succès !`);
      } else {
        savedOrder = addOrder({
          orderCategory,
          nomCommande: nomCommande.trim(),
          client: client.trim(),
          notes: notes ? notes.trim() : '',
          articles
        });
        setSuccessMsg(`La commande ${savedOrder.id} a été créée avec succès !`);
      }

      setTimeout(() => {
        onOrderCreated(savedOrder);
      }, 700);
    } catch (err) {
      console.error('Error during order submit:', err);
      setErrorMsg(`Erreur : ${err.message || 'Impossible d\'enregistrer la commande.'}`);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* Edit Mode Header Banner */}
      {isEditMode && (
        <div style={{ background: 'rgba(2, 132, 199, 0.1)', border: '1px solid var(--accent-cyan)', padding: '14px 20px', borderRadius: 'var(--radius-md)', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
            <Edit3 size={20} />
            <span>Modification de la commande : {editingOrder.id}</span>
          </div>
          {onCancelEdit && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onCancelEdit}>
              <X size={16} /> Annuler la modification
            </button>
          )}
        </div>
      )}

      {/* Category Switcher */}
      <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '24px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
          Type de Commande :
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button
            type="button"
            className={`btn ${orderCategory === 'menuiserie' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleCategorySwitch('menuiserie')}
            style={{ padding: '14px', fontSize: '1rem', justifyContent: 'center' }}
          >
            <Layers size={20} />
            Commande Menuiserie (Coulissant / Ouvrant)
          </button>

          <button
            type="button"
            className={`btn ${orderCategory === 'volet' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleCategorySwitch('volet')}
            style={orderCategory === 'volet' ? { background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)', color: '#fff', padding: '14px', fontSize: '1rem', justifyContent: 'center' } : { padding: '14px', fontSize: '1rem', justifyContent: 'center' }}
          >
            <Disc size={20} />
            Commande Spécial Volet Roulant
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isEditMode ? <Edit3 style={{ color: 'var(--accent-cyan)' }} /> : <Plus style={{ color: orderCategory === 'volet' ? 'var(--accent-purple)' : 'var(--accent-cyan)' }} />}
          {isEditMode ? `Modifier la Commande ${editingOrder.id}` : (orderCategory === 'volet' ? 'Création Commande Spécial Volet Roulant' : 'Nouvelle Commande Menuiserie')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          {isEditMode ? 'Modifiez les détails de la commande ou les articles tant qu\'elle est en attente.' : (orderCategory === 'volet' ? 'Renseignez les volets roulants.' : 'Renseignez les menuiseries.')}
        </p>
      </div>

      {errorMsg && (
        <div style={{ background: 'rgba(225, 29, 72, 0.1)', border: '1px solid rgba(225, 29, 72, 0.3)', color: '#e11d48', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ background: 'rgba(5, 150, 105, 0.1)', border: '1px solid rgba(5, 150, 105, 0.3)', color: '#059669', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sparkles size={20} />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Order Header Card */}
        <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            📋 En-tête de Commande
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Nom / Réf. Commande *</label>
              <input
                type="text"
                className="form-input"
                placeholder={orderCategory === 'volet' ? "ex: Chantier Lotissement Volets" : "ex: Chantier Résidence Les Alizés"}
                value={nomCommande}
                onChange={(e) => setNomCommande(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Client / Destinataire *</label>
              <input
                type="text"
                className="form-input"
                placeholder="ex: Client Mr. Laurent"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0, marginTop: '8px' }}>
            <label className="form-label">Notes & Instructions Atelier</label>
            <input
              type="text"
              className="form-input"
              placeholder="ex: RAL 7016 Anthracite..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Dynamic Articles Header */}
        {(() => {
          const totalFormPieces = articles.reduce((sum, a) => sum + (parseInt(a.quantity) || 1), 0);
          return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {orderCategory === 'volet' ? <Disc style={{ color: 'var(--accent-purple)' }} /> : <Layers style={{ color: 'var(--accent-cyan)' }} />}
                {orderCategory === 'volet'
                  ? `Volets Roulants (${articles.length} ligne(s) • Total : ${totalFormPieces} pièce(s))`
                  : `Articles Menuiserie (${articles.length} ligne(s) • Total : ${totalFormPieces} pièce(s))`
                }
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAddArticle}
              >
                <Plus size={16} /> Ajouter un {orderCategory === 'volet' ? 'volet' : 'article'}
              </button>
            </div>
          );
        })()}

        {/* Articles List */}
        {articles.map((article, idx) => (
          <div key={article.id} className="glass-card" style={{ padding: '24px', marginBottom: '20px', borderLeft: `4px solid ${orderCategory === 'volet' ? 'var(--accent-purple)' : 'var(--accent-cyan)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <span className={`badge ${orderCategory === 'volet' ? 'badge-purple' : 'badge-cyan'}`}>
                {orderCategory === 'volet' ? `Volet #${idx + 1}` : `Article #${idx + 1}`}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleDuplicateArticle(idx)}
                >
                  <Copy size={15} /> Dupliquer
                </button>
                {articles.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => handleRemoveArticle(idx)}
                  >
                    <Trash2 size={15} /> Supprimer
                  </button>
                )}
              </div>
            </div>

            {/* MENUISERIE MODE */}
            {orderCategory === 'menuiserie' ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  
                  {/* TYPE SELECTOR */}
                  <div className="form-group">
                    <label className="form-label">Type de Menuiserie *</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <button
                        type="button"
                        className={`btn btn-sm ${article.typeMenuiserie === 'Coulissant' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleArticleChange(idx, 'typeMenuiserie', 'Coulissant')}
                        style={{ padding: '8px', fontSize: '0.9rem', justifyContent: 'center' }}
                      >
                        ⚡ Coulissant
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${article.typeMenuiserie === 'Ouvrant' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleArticleChange(idx, 'typeMenuiserie', 'Ouvrant')}
                        style={{ padding: '8px', fontSize: '0.9rem', justifyContent: 'center' }}
                      >
                        🚪 Ouvrant
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Quantité</label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      value={article.quantity || 1}
                      onChange={(e) => handleArticleChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                      required
                    />
                  </div>

                  {/* GAMME COMBOBOX */}
                  <div className="form-group">
                    <label className="form-label">Gamme *</label>
                    <GammeCombobox
                      value={article.gamme || 'h36 2p'}
                      onChange={(newGamme) => handleArticleChange(idx, 'gamme', newGamme)}
                    />
                  </div>
                </div>

                {/* Dimensions */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
                  <div className="form-group">
                    <label className="form-label">Hauteur (mm)</label>
                    <input
                      type="number"
                      min="100"
                      className="form-input"
                      placeholder="1450"
                      value={article.hauteur || ''}
                      onChange={(e) => handleArticleChange(idx, 'hauteur', parseInt(e.target.value) || 0)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Largeur (mm)</label>
                    <input
                      type="number"
                      min="100"
                      className="form-input"
                      placeholder="1200"
                      value={article.largeur || ''}
                      onChange={(e) => handleArticleChange(idx, 'largeur', parseInt(e.target.value) || 0)}
                      required
                    />
                  </div>
                </div>

                {/* Options Caisson & Fixe */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '16px' }}>
                  <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <div
                      className="toggle-group"
                      style={{ background: 'transparent', border: 'none', padding: 0 }}
                      onClick={() => handleArticleChange(idx, 'avecCaisson', !article.avecCaisson)}
                    >
                      <span style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                        <Box size={18} style={{ color: 'var(--accent-amber)' }} />
                        Avec Caisson
                      </span>
                      <div className={`toggle-switch ${article.avecCaisson ? 'active' : ''}`} />
                    </div>

                    {article.avecCaisson && (
                      <div className="animate-fade-in" style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border-color)' }}>
                        <label className="form-label">Hauteur Caisson (mm)</label>
                        <input
                          type="number"
                          min="50"
                          className="form-input"
                          placeholder="200"
                          value={article.caissonHauteur || 200}
                          onChange={(e) => handleArticleChange(idx, 'caissonHauteur', parseInt(e.target.value) || 0)}
                        />
                      </div>
                    )}
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <div
                      className="toggle-group"
                      style={{ background: 'transparent', border: 'none', padding: 0 }}
                      onClick={() => handleArticleChange(idx, 'avecFixe', !article.avecFixe)}
                    >
                      <span style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                        <Maximize2 size={18} style={{ color: 'var(--accent-cyan)' }} />
                        Avec Fixe (Imposte / Allège)
                      </span>
                      <div className={`toggle-switch ${article.avecFixe ? 'active' : ''}`} />
                    </div>

                    {article.avecFixe && (
                      <div className="animate-fade-in" style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border-color)', display: 'grid', gap: '10px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label className="form-label">Hauteur Fixe (mm)</label>
                            <input
                              type="number"
                              min="50"
                              className="form-input"
                              value={article.fixeDetails?.hauteur || 400}
                              onChange={(e) => handleFixeChange(idx, 'hauteur', parseInt(e.target.value) || 0)}
                            />
                          </div>
                          <div>
                            <label className="form-label">Largeur Fixe (mm)</label>
                            <input
                              type="number"
                              min="50"
                              className="form-input"
                              value={article.fixeDetails?.largeur || article.largeur}
                              onChange={(e) => handleFixeChange(idx, 'largeur', parseInt(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* VOLET MODE */
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Désignation du Volet</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="ex: Volet Porte-Fenêtre Séjour"
                      value={article.designation || 'Volet Roulant'}
                      onChange={(e) => handleArticleChange(idx, 'designation', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Quantité</label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      value={article.quantity || 1}
                      onChange={(e) => handleArticleChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Largeur (mm) *</label>
                    <input
                      type="number"
                      min="100"
                      className="form-input"
                      placeholder="1200"
                      value={article.largeur || ''}
                      onChange={(e) => handleArticleChange(idx, 'largeur', parseInt(e.target.value) || 0)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Hauteur (mm) *</label>
                    <input
                      type="number"
                      min="100"
                      className="form-input"
                      placeholder="1400"
                      value={article.hauteur || ''}
                      onChange={(e) => handleArticleChange(idx, 'hauteur', parseInt(e.target.value) || 0)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Type de Lame</label>
                    <select
                      className="form-select"
                      value={article.typeLame || DEFAULT_TYPES_LAME[0]}
                      onChange={(e) => handleArticleChange(idx, 'typeLame', e.target.value)}
                    >
                      {DEFAULT_TYPES_LAME.map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Type de Caisson</label>
                    <select
                      className="form-select"
                      value={article.typeCaisson || DEFAULT_TYPES_CAISSON[0]}
                      onChange={(e) => handleArticleChange(idx, 'typeCaisson', e.target.value)}
                    >
                      {DEFAULT_TYPES_CAISSON.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Type de Manœuvre</label>
                    <select
                      className="form-select"
                      value={article.typeManoeuvre || DEFAULT_TYPES_MANOEUVRE[0]}
                      onChange={(e) => handleArticleChange(idx, 'typeManoeuvre', e.target.value)}
                    >
                      {DEFAULT_TYPES_MANOEUVRE.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Coloris / Finition</label>
                    <select
                      className="form-select"
                      value={article.coloris || DEFAULT_COLORIS[0]}
                      onChange={(e) => handleArticleChange(idx, 'coloris', e.target.value)}
                    >
                      {DEFAULT_COLORIS.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleAddArticle}
            style={{ flex: 1 }}
          >
            <Plus size={18} /> Ajouter un autre {orderCategory === 'volet' ? 'volet' : 'article'}
          </button>
          
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ flex: 2, background: orderCategory === 'volet' ? 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)' : 'var(--gradient-brand)' }}
          >
            <Save size={20} /> {isEditMode ? 'Enregistrer les Modifications' : 'Enregistrer la Commande & Générer QR Code'}
          </button>
        </div>
      </form>
    </div>
  );
}
