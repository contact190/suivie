import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import {
  Clock,
  CheckCircle2,
  PlayCircle,
  Layers,
  Box,
  Maximize2,
  TrendingUp,
  Award,
  AlertTriangle,
  Zap,
  Hourglass,
  Ruler,
  Activity,
  ShieldAlert
} from 'lucide-react';
import { formatDuration } from '../services/storage';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

export default function Dashboard({ orders }) {
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const enAttente = orders.filter(o => o.status === 'en_attente').length;
    const enCoursOrders = orders.filter(o => o.status === 'en_cours');
    const finies = orders.filter(o => o.status === 'fini');

    const totalFinished = finies.length;
    const completionRate = totalOrders > 0 ? Math.round((totalFinished / totalOrders) * 100) : 0;

    // Helper: calculate order duration in minutes
    const getOrderDuration = (o) => {
      if (o.durationMinutes && o.durationMinutes > 0) return o.durationMinutes;
      if (o.launchedAt && o.completedAt) {
        return Math.max(1, Math.round((new Date(o.completedAt).getTime() - new Date(o.launchedAt).getTime()) / (1000 * 60)));
      }
      return 0;
    };

    // 1. Durée Globale & Ratio Min / m²
    let totalFinishedMinutes = 0;
    let totalFinishedSqM = 0;

    finies.forEach(o => {
      const dur = getOrderDuration(o);
      totalFinishedMinutes += dur;
      (o.articles || []).forEach(art => {
        const sqM = ((art.hauteur || 1000) / 1000) * ((art.largeur || 1000) / 1000) * (art.quantity || 1);
        totalFinishedSqM += sqM;
      });
    });

    const avgDurationGlobal = totalFinished > 0 ? Math.round(totalFinishedMinutes / totalFinished) : 0;
    const minutesPerSqM = totalFinishedSqM > 0 ? Math.round(totalFinishedMinutes / totalFinishedSqM) : 0;

    // 2. Queue Time (Temps de réaction : Création -> Lancement)
    let totalQueueMinutes = 0;
    let queueCount = 0;

    orders.forEach(o => {
      if (o.launchedAt && o.createdAt) {
        const queueMin = (new Date(o.launchedAt).getTime() - new Date(o.createdAt).getTime()) / (1000 * 60);
        if (queueMin >= 0) {
          totalQueueMinutes += queueMin;
          queueCount += 1;
        }
      }
    });

    const avgQueueTimeMinutes = queueCount > 0 ? Math.round(totalQueueMinutes / queueCount) : 0;

    // 3. Temps Moyen Coulissant vs Ouvrant
    let coulissantTime = { total: 0, count: 0 };
    let ouvrantTime = { total: 0, count: 0 };

    finies.forEach(o => {
      const dur = getOrderDuration(o);
      if (!dur) return;
      const isCoulissant = (o.articles || []).some(a => (a.typeMenuiserie || '').toLowerCase() === 'coulissant' || (a.designation || '').toLowerCase().includes('coulissant'));
      const isOuvrant = (o.articles || []).some(a => (a.typeMenuiserie || '').toLowerCase() === 'ouvrant' || (a.designation || '').toLowerCase().includes('ouvrant'));

      if (isCoulissant) {
        coulissantTime.total += dur;
        coulissantTime.count += 1;
      }
      if (isOuvrant) {
        ouvrantTime.total += dur;
        ouvrantTime.count += 1;
      }
    });

    const avgTimeCoulissant = coulissantTime.count > 0 ? Math.round(coulissantTime.total / coulissantTime.count) : 0;
    const avgTimeOuvrant = ouvrantTime.count > 0 ? Math.round(ouvrantTime.total / ouvrantTime.count) : 0;

    // 4. Impact des Options (Caisson & Fixe)
    let timeWithCaisson = { total: 0, count: 0 };
    let timeWithoutCaisson = { total: 0, count: 0 };
    let timeWithFixe = { total: 0, count: 0 };
    let timeWithoutFixe = { total: 0, count: 0 };

    finies.forEach(o => {
      const dur = getOrderDuration(o);
      if (!dur) return;
      const hasCaisson = (o.articles || []).some(a => a.avecCaisson);
      const hasFixe = (o.articles || []).some(a => a.avecFixe);

      if (hasCaisson) {
        timeWithCaisson.total += dur;
        timeWithCaisson.count += 1;
      } else {
        timeWithoutCaisson.total += dur;
        timeWithoutCaisson.count += 1;
      }

      if (hasFixe) {
        timeWithFixe.total += dur;
        timeWithFixe.count += 1;
      } else {
        timeWithoutFixe.total += dur;
        timeWithoutFixe.count += 1;
      }
    });

    const avgWithCaisson = timeWithCaisson.count > 0 ? Math.round(timeWithCaisson.total / timeWithCaisson.count) : 0;
    const avgWithoutCaisson = timeWithoutCaisson.count > 0 ? Math.round(timeWithoutCaisson.total / timeWithoutCaisson.count) : 0;
    const extraMinutesCaisson = avgWithCaisson > avgWithoutCaisson ? avgWithCaisson - avgWithoutCaisson : 0;

    const avgWithFixe = timeWithFixe.count > 0 ? Math.round(timeWithFixe.total / timeWithFixe.count) : 0;
    const avgWithoutFixe = timeWithoutFixe.count > 0 ? Math.round(timeWithoutFixe.total / timeWithoutFixe.count) : 0;
    const extraMinutesFixe = avgWithFixe > avgWithoutFixe ? avgWithFixe - avgWithoutFixe : 0;

    // 5. Tranches de Taille
    const bracketStats = {
      'Petites (< 1.4m)': { totalTime: 0, count: 0 },
      'Moyennes (1.4m - 2.0m)': { totalTime: 0, count: 0 },
      'Grandes (> 2.0m)': { totalTime: 0, count: 0 }
    };

    finies.forEach(o => {
      const dur = getOrderDuration(o);
      if (!dur) return;
      (o.articles || []).forEach(art => {
        const maxDim = Math.max(art.hauteur || 1000, art.largeur || 1000);
        let key = 'Petites (< 1.4m)';
        if (maxDim > 2000) key = 'Grandes (> 2.0m)';
        else if (maxDim >= 1400) key = 'Moyennes (1.4m - 2.0m)';

        bracketStats[key].totalTime += dur;
        bracketStats[key].count += 1;
      });
    });

    const bracketLabels = Object.keys(bracketStats);
    const bracketAvgTimes = bracketLabels.map(k =>
      bracketStats[k].count > 0 ? Math.round(bracketStats[k].totalTime / bracketStats[k].count) : 0
    );

    // 6. Temps par Gamme
    const gammeStats = {};
    finies.forEach(o => {
      const dur = getOrderDuration(o);
      if (!dur) return;
      (o.articles || []).forEach(art => {
        const g = art.gamme || 'Gamme Standard';
        if (!gammeStats[g]) {
          gammeStats[g] = { totalTime: 0, count: 0 };
        }
        gammeStats[g].totalTime += dur;
        gammeStats[g].count += 1;
      });
    });

    const gammeLabels = Object.keys(gammeStats);
    const gammeAvgTimes = gammeLabels.map(g => Math.round(gammeStats[g].totalTime / gammeStats[g].count));

    // 7. Analysis of All In-Progress Orders (Retards / Suivi)
    const thresholdMinutes = avgDurationGlobal > 0 ? avgDurationGlobal : 45;
    const trackedEnCours = enCoursOrders.map(o => {
      const launchTime = o.launchedAt ? new Date(o.launchedAt).getTime() : Date.now();
      const elapsedMin = Math.round((Date.now() - launchTime) / (1000 * 60));
      const isDelayed = elapsedMin > thresholdMinutes;
      const exceedMin = Math.max(0, elapsedMin - thresholdMinutes);
      return {
        ...o,
        elapsedMin,
        isDelayed,
        exceedMin
      };
    });

    return {
      totalOrders,
      enAttente,
      enCoursCount: enCoursOrders.length,
      totalFinished,
      completionRate,
      avgDurationGlobal,
      minutesPerSqM,
      avgQueueTimeMinutes,
      avgTimeCoulissant,
      avgTimeOuvrant,
      avgWithCaisson,
      avgWithoutCaisson,
      extraMinutesCaisson,
      avgWithFixe,
      avgWithoutFixe,
      extraMinutesFixe,
      bracketStats,
      bracketLabels,
      bracketAvgTimes,
      gammeLabels,
      gammeAvgTimes,
      trackedEnCours,
      thresholdMinutes
    };
  }, [orders]);

  // Chart 1: Coulissant vs Ouvrant
  const coulissantVsOuvrantChartData = {
    labels: ['⚡ Coulissant', '🚪 Ouvrant'],
    datasets: [
      {
        label: 'Temps Moyen de Fabrication (Minutes)',
        data: [stats.avgTimeCoulissant, stats.avgTimeOuvrant],
        backgroundColor: ['rgba(2, 132, 199, 0.85)', 'rgba(124, 58, 237, 0.85)'],
        borderColor: ['#0284c7', '#7c3aed'],
        borderWidth: 2,
        borderRadius: 8
      }
    ]
  };

  // Chart 2: Tranches de Tailles
  const dimensionChartData = {
    labels: stats.bracketLabels,
    datasets: [
      {
        label: 'Temps Moyen par Taille (Minutes)',
        data: stats.bracketAvgTimes,
        backgroundColor: ['#10b981', '#2563eb', '#e11d48'],
        borderRadius: 8
      }
    ]
  };

  // Chart 3: Temps par Gamme
  const gammeChartData = {
    labels: stats.gammeLabels.length > 0 ? stats.gammeLabels : ['Aucune gamme enregistrée'],
    datasets: [
      {
        label: 'Temps Moyen par Gamme (Minutes)',
        data: stats.gammeAvgTimes.length > 0 ? stats.gammeAvgTimes : [0],
        backgroundColor: 'rgba(5, 150, 105, 0.85)',
        borderColor: '#059669',
        borderWidth: 2,
        borderRadius: 8
      }
    ]
  };

  // Chart 4: Impact Options (Caisson / Fixe)
  const optionsImpactData = {
    labels: ['Avec Caisson', 'Sans Caisson', 'Avec Fixe', 'Sans Fixe'],
    datasets: [
      {
        label: 'Temps Moyen (Minutes)',
        data: [stats.avgWithCaisson, stats.avgWithoutCaisson, stats.avgWithFixe, stats.avgWithoutFixe],
        backgroundColor: ['#d97706', '#94a3b8', '#0284c7', '#94a3b8'],
        borderRadius: 6
      }
    ]
  };

  const chartOptionsLight = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#475569', font: { family: 'Plus Jakarta Sans', weight: '600' } }
      },
      tooltip: {
        backgroundColor: '#ffffff',
        titleColor: '#0f172a',
        bodyColor: '#0284c7',
        borderColor: '#e2e8f0',
        borderWidth: 1
      }
    },
    scales: {
      x: { ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' } },
      y: { ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' } }
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* Title Banner */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <TrendingUp style={{ color: 'var(--accent-emerald)' }} />
          Tableau de Bord Productivité & Analyse de Fabrication
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Indicateurs de vitesse par Type, Gamme, Options (Caisson/Fixe), Dimensions et Détection des retards.
        </p>
      </div>

      {/* 📌 SECTION 1: ⏱️ TEMPS DE FABRICATION & PRODUCTIVITÉ */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.3rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '8px' }}>
          <Activity style={{ color: 'var(--accent-cyan)' }} />
          ⏱️ 1. Temps de Fabrication & Productivité
        </h3>

        {/* 4 KPI CARDS FOR SECTION 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          
          {/* Durée Moyenne Globale */}
          <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-cyan)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '800' }}>DURÉE MOYENNE GLOBALE</span>
              <Clock size={18} style={{ color: 'var(--accent-cyan)' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '800', marginTop: '6px', color: 'var(--accent-cyan)' }}>
              {formatDuration(stats.avgDurationGlobal)}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Temps moyen de fabrication par commande
            </div>
          </div>

          {/* Queue Time (Temps de réaction) */}
          <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-purple)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '800' }}>QUEUE TIME (RÉACTION)</span>
              <Hourglass size={18} style={{ color: 'var(--accent-purple)' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '800', marginTop: '6px', color: 'var(--accent-purple)' }}>
              {formatDuration(stats.avgQueueTimeMinutes)}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Délai moyen entre création et lancement
            </div>
          </div>

          {/* Impact Caisson */}
          <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-amber)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '800' }}>IMPACT OPTION CAISSON</span>
              <Box size={18} style={{ color: 'var(--accent-amber)' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '800', marginTop: '6px', color: 'var(--accent-amber)' }}>
              +{stats.extraMinutesCaisson} min
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Temps moyen avec caisson : {formatDuration(stats.avgWithCaisson)}
            </div>
          </div>

          {/* Impact Fixe */}
          <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-blue)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '800' }}>IMPACT OPTION FIXE</span>
              <Maximize2 size={18} style={{ color: 'var(--accent-blue)' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '800', marginTop: '6px', color: 'var(--accent-blue)' }}>
              +{stats.extraMinutesFixe} min
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Temps moyen avec fixe : {formatDuration(stats.avgWithFixe)}
            </div>
          </div>

        </div>

        {/* CHARTS FOR SECTION 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
          
          {/* Chart 1: Coulissant vs Ouvrant */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={16} style={{ color: 'var(--accent-cyan)' }} />
              Coulissant vs Ouvrant (Temps moyen)
            </h4>
            <div style={{ height: '230px' }}>
              <Bar data={coulissantVsOuvrantChartData} options={chartOptionsLight} />
            </div>
          </div>

          {/* Chart 2: Temps par Gamme */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} style={{ color: 'var(--accent-emerald)' }} />
              Temps Moyen par Gamme
            </h4>
            <div style={{ height: '230px' }}>
              <Bar data={gammeChartData} options={chartOptionsLight} />
            </div>
          </div>

          {/* Chart 3: Impact Options */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Box size={16} style={{ color: 'var(--accent-amber)' }} />
              Impact des Options (Caisson / Fixe)
            </h4>
            <div style={{ height: '230px' }}>
              <Bar data={optionsImpactData} options={chartOptionsLight} />
            </div>
          </div>

        </div>
      </div>

      {/* 📌 SECTION 2: 📐 ANALYSE PAR DIMENSIONS & TRANCHES DE TAILLE */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.3rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '8px' }}>
          <Ruler style={{ color: 'var(--accent-emerald)' }} />
          📐 2. Analyse par Dimensions & Tranches de Taille
        </h3>

        {/* 4 KPI CARDS FOR SECTION 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          
          {/* Ratio Min / m² */}
          <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-emerald)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '800' }}>RATIO MINUTES / M²</span>
              <Zap size={18} style={{ color: 'var(--accent-emerald)' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '800', marginTop: '6px', color: 'var(--accent-emerald)' }}>
              {stats.minutesPerSqM} min/m²
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Temps nécessaire pour fabriquer 1 m²
            </div>
          </div>

          {/* Petites (<1.4m) */}
          <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #10b981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '800' }}>PETITES (&lt; 1.4m)</span>
              <Ruler size={18} style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '800', marginTop: '6px', color: '#10b981' }}>
              {formatDuration(stats.bracketAvgTimes[0])}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Assemblage rapide en atelier
            </div>
          </div>

          {/* Moyennes (1.4m - 2.0m) */}
          <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #2563eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '800' }}>MOYENNES (1.4m - 2.0m)</span>
              <Ruler size={18} style={{ color: '#2563eb' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '800', marginTop: '6px', color: '#2563eb' }}>
              {formatDuration(stats.bracketAvgTimes[1])}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Taille standard atelier
            </div>
          </div>

          {/* Grandes (>2.0m) */}
          <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #e11d48' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '800' }}>GRANDES (&gt; 2.0m)</span>
              <Ruler size={18} style={{ color: '#e11d48' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '800', marginTop: '6px', color: '#e11d48' }}>
              {formatDuration(stats.bracketAvgTimes[2])}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Nécessite 2 opérateurs / manutention
            </div>
          </div>

        </div>

        {/* CHART FOR SECTION 2 */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h4 style={{ fontSize: '1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Ruler size={16} style={{ color: 'var(--accent-blue)' }} />
            Temps Moyen par Tranche de Taille (Petite / Moyenne / Grande)
          </h4>
          <div style={{ height: '240px' }}>
            <Bar data={dimensionChartData} options={chartOptionsLight} />
          </div>
        </div>
      </div>

      {/* 📌 SECTION 3: 🚨 DÉTECTION DES COMMANDES EN COURS & RETARDS */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.3rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <ShieldAlert style={{ color: 'var(--accent-rose)' }} />
          🚨 3. Suivi des Commandes en Cours & Détections de Retards ({stats.trackedEnCours.length})
        </h3>

        {stats.trackedEnCours.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.92rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
            Aucune commande actuellement en cours de fabrication sur les postes atelier.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
            {stats.trackedEnCours.map(o => (
              <div
                key={o.id}
                style={{
                  background: o.isDelayed ? '#fff1f2' : '#ffffff',
                  border: o.isDelayed ? '2px solid #fecdd3' : '1px solid var(--border-color)',
                  padding: '16px',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span className="badge badge-purple">{o.id}</span>
                  {o.isDelayed ? (
                    <span className="badge" style={{ background: '#e11d48', color: '#fff', fontSize: '0.75rem' }}>
                      ⚠️ RETARD (+{o.exceedMin} min)
                    </span>
                  ) : (
                    <span className="badge badge-emerald" style={{ fontSize: '0.75rem' }}>
                      🟢 DANS LES TEMPS
                    </span>
                  )}
                </div>

                <div style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--text-primary)' }}>{o.nomCommande}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Client : <strong>{o.client}</strong></div>
                
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Temps écoulé :</span>
                  <strong style={{ color: o.isDelayed ? '#e11d48' : 'var(--accent-cyan)' }}>
                    {formatDuration(o.elapsedMin)}
                  </strong>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '2px' }}>
                  Objectif moyen : {formatDuration(stats.thresholdMinutes)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
