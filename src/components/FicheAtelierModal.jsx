import React, { useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, X, Disc } from 'lucide-react';
import { formatDuration } from '../services/storage';

export default function FicheAtelierModal({ order, onClose }) {
  if (!order) return null;

  const isVoletOrder = order.orderCategory === 'volet';

  // Compute essential summary metrics for workshop printable sheet
  const summary = useMemo(() => {
    let countCoulissant = 0;
    let countOuvrant = 0;
    let countCoulissantFixe = 0;
    let countOuvrantFixe = 0;
    let countCoulissantCaisson = 0;
    let countOuvrantCaisson = 0;
    let countTotalVolets = 0;
    let totalPiecesCount = 0;
    const gammesSet = new Set();

    (order.articles || []).forEach(art => {
      const isCoulissant = (art.typeMenuiserie || '').toLowerCase() === 'coulissant' || (art.designation || '').toLowerCase().includes('coulissant');
      const qty = art.quantity || 1;
      totalPiecesCount += qty;

      if (art.gamme) gammesSet.add(art.gamme);
      if (art.fixeDetails?.gamme) gammesSet.add(art.fixeDetails.gamme);

      if (isVoletOrder) {
        countTotalVolets += qty;
      } else {
        if (isCoulissant) {
          countCoulissant += qty;
          if (art.avecFixe) countCoulissantFixe += qty;
          if (art.avecCaisson) countCoulissantCaisson += qty;
        } else {
          countOuvrant += qty;
          if (art.avecFixe) countOuvrantFixe += qty;
          if (art.avecCaisson) countOuvrantCaisson += qty;
        }
        if (art.avecCaisson) countTotalVolets += qty;
      }
    });

    return {
      totalPiecesCount,
      countCoulissant,
      countOuvrant,
      countCoulissantFixe,
      countOuvrantFixe,
      countCoulissantCaisson,
      countOuvrantCaisson,
      countTotalVolets,
      gammesList: Array.from(gammesSet)
    };
  }, [order, isVoletOrder]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fiche-atelier-modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '16px'
    }}>
      <div className="glass-card fiche-atelier-modal-card animate-fade-in" style={{
        width: '100%',
        maxWidth: '800px',
        maxHeight: '92vh',
        overflowY: 'auto',
        padding: '24px',
        background: '#ffffff',
        position: 'relative',
        zIndex: 100000,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
        borderRadius: 'var(--radius-md)'
      }}>
        {/* Header Actions (Sticky top inside modal card, hidden on print) */}
        <div className="no-print" style={{
          position: 'sticky',
          top: '-24px',
          background: '#ffffff',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          borderBottom: '2px solid var(--border-color)',
          paddingTop: '6px',
          paddingBottom: '12px',
          marginTop: '-6px'
        }}>
          <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
            {isVoletOrder ? <Disc style={{ color: 'var(--accent-purple)' }} /> : null}
            Fiche Synthétique A4 & QR Code
          </h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-primary btn-sm" onClick={handlePrint}>
              <Printer size={16} /> Imprimer Fiche A4
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              <X size={16} /> Fermer
            </button>
          </div>
        </div>

        {/* Printable Sheet (EXACT A4 FORMAT FIT - SYNTHÈSE COMPACTE SUR 1 PAGE) */}
        <div className="fiche-atelier-print">
          
          {/* Top Order Header */}
          <div style={{
            display: 'flex',
            justify: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2px solid #0f172a',
            paddingBottom: '12px',
            marginBottom: '14px'
          }}>
            <div>
              <h1 style={{ fontSize: '1.6rem', color: '#0f172a', margin: 0, fontWeight: '900', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                {isVoletOrder ? 'FICHE ATELIER - SPÉCIAL VOLETS' : 'FICHE ATELIER SYNTHÉTIQUE'}
              </h1>
              <h2 style={{ fontSize: '1.25rem', color: isVoletOrder ? '#7c3aed' : '#0284c7', marginTop: '2px', fontWeight: 'bold' }}>{order.id}</h2>
              <div style={{ marginTop: '6px', fontSize: '1rem', color: '#1e293b', display: 'grid', gap: '2px' }}>
                <div><strong>Nom Commande :</strong> {order.nomCommande}</div>
                <div><strong>Client / Destinataire :</strong> {order.client}</div>
              </div>
              {order.notes && (
                <div style={{ marginTop: '6px', fontSize: '0.9rem', color: '#334155', background: '#f8fafc', padding: '6px 10px', borderRadius: '4px', borderLeft: '4px solid #0284c7' }}>
                  <strong>Notes Atelier :</strong> {order.notes}
                </div>
              )}
            </div>

            {/* High-res Compact QR Code */}
            <div style={{ textAlign: 'center', padding: '8px', background: '#fff', border: '2px solid #0f172a', borderRadius: '8px', flexShrink: 0, marginLeft: '16px' }}>
              <QRCodeSVG
                value={order.id}
                size={110}
                level="H"
                includeMargin={true}
              />
              <div style={{ fontSize: '0.85rem', fontWeight: '900', marginTop: '4px', color: '#000', letterSpacing: '0.03em' }}>
                {order.id}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#475569', fontWeight: 'bold' }}>SCANNER EN ATELIER</div>
            </div>
          </div>

          {/* Workflow Status Line */}
          <div style={{
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            background: '#f1f5f9',
            padding: '8px 14px',
            borderRadius: '6px',
            marginBottom: '14px',
            border: '1px solid #cbd5e1',
            color: '#0f172a',
            fontSize: '0.9rem',
            fontWeight: '700'
          }}>
            <div>Statut : <span style={{ color: order.status === 'fini' ? '#059669' : order.status === 'en_cours' ? '#0284c7' : '#d97706' }}>{order.status.toUpperCase()}</span></div>
            <div>Date création : {new Date(order.createdAt).toLocaleDateString('fr-FR')} à {new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
            {order.completedAt && <div>Durée fab. : {formatDuration(order.durationMinutes)}</div>}
          </div>

          {/* 🌟 LE CŒUR DE LA FICHE A4 : SYNTHÈSE ESSENTIELLE UNIQUEMENT */}
          <div style={{
            background: '#ffffff',
            border: '2px solid #0f172a',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <div style={{
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              borderBottom: '2px solid #0f172a',
              paddingBottom: '8px',
              marginBottom: '14px'
            }}>
              <span style={{ fontSize: '1.15rem', color: '#0f172a', fontWeight: '800', letterSpacing: '0.03em' }}>
                📋 SYNTHÈSE ESSENTIELLE DE LA COMMANDE
              </span>
              <span style={{ fontSize: '1rem', background: '#0f172a', color: '#fff', padding: '4px 12px', borderRadius: '16px', fontWeight: '800' }}>
                TOTAL : {summary.totalPiecesCount} PIÈCE(S)
              </span>
            </div>

            {/* Grid of Essential Counters (3 Compact Columns) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isVoletOrder ? '1fr' : 'repeat(3, 1fr)',
              gap: '12px',
              marginBottom: '14px'
            }}>
              
              {!isVoletOrder && (
                <>
                  {/* Coulissants Box */}
                  <div style={{ background: '#f8fafc', border: '1.5px solid #0284c7', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.95rem', color: '#0284c7', fontWeight: '900', textTransform: 'uppercase' }}>⚡ Coulissant(s)</div>
                    <div style={{ fontSize: '2.2rem', fontWeight: '900', color: '#0f172a', margin: '2px 0', lineHeight: 1 }}>
                      {summary.countCoulissant} <span style={{ fontSize: '0.85rem', fontWeight: 'normal' }}>pce(s)</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#1e293b', borderTop: '1px solid #cbd5e1', paddingTop: '6px', marginTop: '6px', display: 'grid', gap: '2px', fontWeight: '600' }}>
                      <div>• Dont avec Fixe : <strong style={{ color: '#0284c7' }}>{summary.countCoulissantFixe}</strong></div>
                      <div>• Dont avec Caisson : <strong style={{ color: '#d97706' }}>{summary.countCoulissantCaisson}</strong></div>
                    </div>
                  </div>

                  {/* Ouvrants Box */}
                  <div style={{ background: '#f8fafc', border: '1.5px solid #7c3aed', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.95rem', color: '#7c3aed', fontWeight: '900', textTransform: 'uppercase' }}>🚪 Ouvrant(s)</div>
                    <div style={{ fontSize: '2.2rem', fontWeight: '900', color: '#0f172a', margin: '2px 0', lineHeight: 1 }}>
                      {summary.countOuvrant} <span style={{ fontSize: '0.85rem', fontWeight: 'normal' }}>pce(s)</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#1e293b', borderTop: '1px solid #cbd5e1', paddingTop: '6px', marginTop: '6px', display: 'grid', gap: '2px', fontWeight: '600' }}>
                      <div>• Dont avec Fixe : <strong style={{ color: '#0284c7' }}>{summary.countOuvrantFixe}</strong></div>
                      <div>• Dont avec Caisson : <strong style={{ color: '#d97706' }}>{summary.countOuvrantCaisson}</strong></div>
                    </div>
                  </div>
                </>
              )}

              {/* Volets / Caissons Box */}
              <div style={{ background: '#f8fafc', border: '1.5px solid #d97706', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.95rem', color: '#d97706', fontWeight: '900', textTransform: 'uppercase' }}>🌀 Volet(s) / Caisson(s)</div>
                <div style={{ fontSize: '2.2rem', fontWeight: '900', color: '#0f172a', margin: '2px 0', lineHeight: 1 }}>
                  {summary.countTotalVolets} <span style={{ fontSize: '0.85rem', fontWeight: 'normal' }}>pce(s)</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#1e293b', borderTop: '1px solid #cbd5e1', paddingTop: '6px', marginTop: '6px', fontWeight: '600' }}>
                  Total ouvertures avec volet
                </div>
              </div>

            </div>

            {/* GAMMES UTILISÉES */}
            <div style={{ background: '#f8fafc', border: '1.5px solid #0f172a', padding: '12px', borderRadius: '8px' }}>
              <strong style={{ fontSize: '0.9rem', color: '#0f172a', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                📐 Gamme(s) Utilisée(s) dans cette Commande :
              </strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {summary.gammesList.length > 0 ? (
                  summary.gammesList.map(g => (
                    <span key={g} style={{
                      background: '#0f172a',
                      color: '#ffffff',
                      padding: '4px 12px',
                      borderRadius: '4px',
                      fontSize: '0.95rem',
                      fontWeight: '800'
                    }}>
                      {g}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Aucune gamme spécifiée</span>
                )}
              </div>
            </div>
          </div>

          {/* Signatures & Quality Control Section */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            paddingTop: '10px',
            borderTop: '1px dashed #94a3b8'
          }}>
            <div style={{ border: '1.5px solid #cbd5e1', padding: '10px', borderRadius: '6px', height: '85px' }}>
              <strong style={{ fontSize: '0.85rem', color: '#0f172a', textTransform: 'uppercase' }}>Validation Lancement Assemblage :</strong>
              <div style={{ marginTop: '28px', borderBottom: '1.5px dashed #64748b', width: '60%' }}></div>
            </div>
            <div style={{ border: '1.5px solid #cbd5e1', padding: '10px', borderRadius: '6px', height: '85px' }}>
              <strong style={{ fontSize: '0.85rem', color: '#0f172a', textTransform: 'uppercase' }}>Contrôle Qualité & Finition :</strong>
              <div style={{ marginTop: '28px', borderBottom: '1.5px dashed #64748b', width: '60%' }}></div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
