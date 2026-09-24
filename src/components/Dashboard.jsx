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
  ShieldAlert,
  GitBranch,
  AlertCircle,
  PackageCheck
} from 'lucide-react';
import {
  formatDuration,
  HEIGHT_WIDTH_RANGES,
  getDimensionRange,
  parseRangeToMidpoint
} from '../services/storage';

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
        const hMm = parseRangeToMidpoint(art.hauteur);
        const wMm = parseRangeToMidpoint(art.largeur);
        const sqM = (hMm / 1000) * (wMm / 1000) * (art.quantity || 1);
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

    // 5. Tranches de Hauteur & Tranches de Largeur (Analyse sur les 8 tranches prédéfinies)
    const heightRangeStats = {};
    const widthRangeStats = {};

    HEIGHT_WIDTH_RANGES.forEach(r => {
      heightRangeStats[r] = { totalTime: 0, count: 0, articlesCount: 0 };
      widthRangeStats[r] = { totalTime: 0, count: 0, articlesCount: 0 };
    });

    orders.forEach(o => {
      const dur = getOrderDuration(o);
      const isFinished = o.status === 'fini';
      (o.articles || []).forEach(art => {
        const hRange = getDimensionRange(art.hauteur);
        const wRange = getDimensionRange(art.largeur);
        const qty = parseInt(art.quantity) || 1;

        if (heightRangeStats[hRange]) {
          heightRangeStats[hRange].articlesCount += qty;
          if (isFinished && dur) {
            heightRangeStats[hRange].totalTime += dur;
            heightRangeStats[hRange].count += 1;
          }
        }
        if (widthRangeStats[wRange]) {
          widthRangeStats[wRange].articlesCount += qty;
          if (isFinished && dur) {
            widthRangeStats[wRange].totalTime += dur;
            widthRangeStats[wRange].count += 1;
          }
        }
      });
    });

    const heightRangeLabels = HEIGHT_WIDTH_RANGES;
    const heightRangeAvgTimes = heightRangeLabels.map(r =>
      heightRangeStats[r].count > 0 ? Math.round(heightRangeStats[r].totalTime / heightRangeStats[r].count) : 0
    );
    const heightRangeCounts = heightRangeLabels.map(r => heightRangeStats[r].articlesCount);

    const widthRangeLabels = HEIGHT_WIDTH_RANGES;
    const widthRangeAvgTimes = widthRangeLabels.map(r =>
      widthRangeStats[r].count > 0 ? Math.round(widthRangeStats[r].totalTime / widthRangeStats[r].count) : 0
    );
    const widthRangeCounts = widthRangeLabels.map(r => widthRangeStats[r].articlesCount);

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

    // 8. 🆕 SOUS-COMMANDES & NON-FINIS METRICS (Calculs requis par l'utilisateur)
    // a) Nombre moyen de sous-commandes par commande
    const subOrdersList = orders.filter(o => o.isSubOrder);
    const totalSubOrders = subOrdersList.length;
    const parentOrdersCount = orders.filter(o => !o.isSubOrder).length;
    const avgSubOrdersPerOrder = parentOrdersCount > 0 ? (totalSubOrders / parentOrdersCount).toFixed(2) : '0.00';

    // b) Nombre moyen des articles non-finis par commande
    let totalUnfinishedArticles = 0;
    let totalUnfinishedQty = 0;

    orders.forEach(o => {
      if (o.status !== 'fini') {
        const unfinished = (o.articles || []).filter(a => !a.isFinished);
        totalUnfinishedArticles += unfinished.length;
        unfinished.forEach(a => {
          totalUnfinishedQty += (parseInt(a.quantity) || 1);
        });
      }
    });

    const avgUnfinishedArticlesPerOrder = totalOrders > 0 ? (totalUnfinishedArticles / totalOrders).toFixed(2) : '0.00';
    const avgUnfinishedQtyPerOrder = totalOrders > 0 ? (totalUnfinishedQty / totalOrders).toFixed(2) : '0.00';

    // c) Commandes lancées > 24h ago
    const ordersOver24h = enCoursOrders.filter(o => {
      if (!o.launchedAt) return false;
      const elapsedMinutes = (Date.now() - new Date(o.launchedAt).getTime()) / (1000 * 60);
      return elapsedMinutes >= 24 * 60; // 24 Hours
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
      heightRangeLabels,
      heightRangeAvgTimes,
      heightRangeCounts,
      widthRangeLabels,
      widthRangeAvgTimes,
      widthRangeCounts,
      gammeLabels,
      gammeAvgTimes,
      trackedEnCours,
      thresholdMinutes,
      // New Sub-orders & Unfinished metrics:
      totalSubOrders,
      parentOrdersCount,
      avgSubOrdersPerOrder,
      totalUnfinishedArticles,
      totalUnfinishedQty,
      avgUnfinishedArticlesPerOrder,
      avgUnfinishedQtyPerOrder,
      ordersOver24h
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

  // Chart 2: Tranches de Hauteur
  const heightRangeChartData = {
    labels: stats.heightRangeLabels,
    datasets: [
      {
        label: 'Nombre d\'Articles',
        data: stats.heightRangeCounts,
        backgroundColor: 'rgba(2, 132, 199, 0.75)',
        borderColor: '#0284c7',
        borderWidth: 1,
        borderRadius: 6,
        yAxisID: 'y'
      },
      {
        label: 'Temps Moyen (Minutes)',
        data: stats.heightRangeAvgTimes,
        backgroundColor: 'rgba(16, 185, 129, 0.85)',
        borderColor: '#10b981',
        borderWidth: 1,
        borderRadius: 6,
        yAxisID: 'y1'
      }
    ]
  };

  // Chart 2b: Tranches de Largeur
  const widthRangeChartData = {
    labels: stats.widthRangeLabels,
    datasets: [
      {
        label: 'Nombre d\'Articles',
        data: stats.widthRangeCounts,
        backgroundColor: 'rgba(124, 58, 237, 0.75)',
        borderColor: '#7c3aed',
        borderWidth: 1,
        borderRadius: 6,
        yAxisID: 'y'
      },
      {
        label: 'Temps Moyen (Minutes)',
        data: stats.widthRangeAvgTimes,
        backgroundColor: 'rgba(217, 119, 6, 0.85)',
        borderColor: '#d97706',
        borderWidth: 1,
        borderRadius: 6,
        yAxisID: 'y1'
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

  const dualAxisChartOptions = {
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
      x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: '#e2e8f0' } },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: { display: true, text: 'Nb Articles', color: '#64748b' },
        ticks: { color: '#64748b' },
        grid: { color: '#e2e8f0' }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: { display: true, text: 'Temps Moyen (min)', color: '#10b981' },
        ticks: { color: '#10b981' },
        grid: { drawOnChartArea: false }
      }
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
          Indicateurs de vitesse par Type, Gamme, Options, Non-Finis et Sous-Commandes (+24h).
        </p>
      </div>

      {/* 📌 SECTION SPECIFIQUE DE CHERCHÉE : 🔄 SOU-COMMANDES ET ARTICLES NON FINIS */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.3rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '8px' }}>
          <GitBranch style={{ color: 'var(--accent-amber)' }} />
          🔄 Suivi des Sous-Commandes & Articles Non Finis
        </h3>

        {/* 3 HIGHLIGHT KPI CARDS FOR USER SPECIFIC REQUEST */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          
          {/* KPI 1: NOMBRE MOYEN DES NON FINI PAR COMMANDE */}
          <div className="glass-card" style={{ padding: '20px', borderLeft: '5px solid var(--accent-amber)', background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b45309' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '800', textTransform: 'uppercase' }}>MOYENNE NON FINIS / CMD</span>
              <AlertCircle size={22} style={{ color: 'var(--accent-amber)' }} />
            </div>
            <div style={{ fontSize: '2.3rem', fontWeight: '800', marginTop: '6px', color: 'var(--accent-amber)' }}>
              {stats.avgUnfinishedArticlesPerOrder}
            </div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              <strong>{stats.totalUnfinishedArticles}</strong> articles non finis au total ({stats.totalUnfinishedQty} pièces)
            </div>
          </div>

          {/* KPI 2: NOMBRE MOYEN DE SOUS COMMANDES PAR COMMANDE */}
          <div className="glass-card" style={{ padding: '20px', borderLeft: '5px solid var(--accent-purple)', background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b21a8' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '800', textTransform: 'uppercase' }}>SOUS-COMMANDES / CMD</span>
              <GitBranch size={22} style={{ color: 'var(--accent-purple)' }} />
            </div>
            <div style={{ fontSize: '2.3rem', fontWeight: '800', marginTop: '6px', color: 'var(--accent-purple)' }}>
              {stats.avgSubOrdersPerOrder}
            </div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              <strong>{stats.totalSubOrders}</strong> sous-commande(s) créée(s) pour {stats.parentOrdersCount} commande(s) principales
            </div>
          </div>

          {/* KPI 3: COMMANDES LANCÉES > 24H */}
          <div className="glass-card" style={{ padding: '20px', borderLeft: '5px solid var(--accent-rose)', background: 'linear-gradient(135deg, #ffffff 0%, #fff1f2 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#be123c' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '800', textTransform: 'uppercase' }}>COMMANDES EN COURS &gt; 24H</span>
              <Clock size={22} style={{ color: 'var(--accent-rose)' }} />
            </div>
            <div style={{ fontSize: '2.3rem', fontWeight: '800', marginTop: '6px', color: 'var(--accent-rose)' }}>
              {stats.ordersOver24h.length}
            </div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Éligibles pour création d'une sous-commande
            </div>
          </div>

        </div>
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

      {/* 📌 SECTION 2: 📐 ANALYSE PAR TRANCHES DE HAUTEUR ET LARGEUR */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.3rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '8px' }}>
          <Ruler style={{ color: 'var(--accent-emerald)' }} />
          📐 2. Analyse par Tranches de Hauteur & Largeur (&lt; 1m à &gt; 4000mm)
        </h3>

        {/* Ratio Min / m² KPI Card */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-emerald)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '800' }}>RATIO MINUTES / M²</span>
              <Zap size={18} style={{ color: 'var(--accent-emerald)' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '800', marginTop: '6px', color: 'var(--accent-emerald)' }}>
              {stats.minutesPerSqM} min/m²
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Temps moyen de fabrication pour 1 m² de menuiserie
            </div>
          </div>
        </div>

        {/* 2 CHARTS: TRANCHES DE HAUTEUR ET TRANCHES DE LARGEUR */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
          
          {/* Chart Tranches de Hauteur */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Ruler size={16} style={{ color: 'var(--accent-cyan)' }} />
              Répartition & Temps Moyen par Tranche de Hauteur
            </h4>
            <div style={{ height: '260px' }}>
              <Bar data={heightRangeChartData} options={dualAxisChartOptions} />
            </div>
          </div>

          {/* Chart Tranches de Largeur */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Ruler size={16} style={{ color: 'var(--accent-purple)' }} />
              Répartition & Temps Moyen par Tranche de Largeur
            </h4>
            <div style={{ height: '260px' }}>
              <Bar data={widthRangeChartData} options={dualAxisChartOptions} />
            </div>
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
