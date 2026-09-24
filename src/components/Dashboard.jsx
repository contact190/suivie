import React, { useMemo, useState } from 'react';
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
  PackageCheck,
  Target,
  Filter,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import {
  formatDuration,
  HEIGHT_WIDTH_RANGES,
  getDimensionRange,
  parseRangeToMidpoint,
  getGammeTargets,
  getDailySizeTargets,
  calculateOrderSmartTarget
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
  const [smartFilter, setSmartFilter] = useState('all'); // 'all' | 'delayed' | 'ontime' | 'encours'

  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const enAttente = orders.filter(o => o.status === 'en_attente').length;
    const enCoursOrders = orders.filter(o => o.status === 'en_cours');
    const finies = orders.filter(o => o.status === 'fini');

    const totalFinished = finies.length;
    const completionRate = totalOrders > 0 ? Math.round((totalFinished / totalOrders) * 100) : 0;

    // Target Configs
    const gammeTargetsConfig = getGammeTargets();
    const dailySizeTargetsConfig = getDailySizeTargets();

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

    // 5. Tranches de Hauteur & Tranches de Largeur
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
        const g = art.gamme || 'h36 2p';
        if (!gammeStats[g]) {
          gammeStats[g] = { totalTime: 0, count: 0 };
        }
        gammeStats[g].totalTime += dur;
        gammeStats[g].count += 1;
      });
    });

    const gammeLabels = Array.from(new Set([...Object.keys(gammeTargetsConfig), ...Object.keys(gammeStats)]));
    const gammeRealAvgTimes = gammeLabels.map(g => gammeStats[g] && gammeStats[g].count > 0 ? Math.round(gammeStats[g].totalTime / gammeStats[g].count) : 0);
    const gammeTargetAvgTimes = gammeLabels.map(g => (gammeTargetsConfig[g]?.targetTimeMinutes) || 45);

    // 7. REAL VS TARGET FOR DAILY VOLUME BY SIZE RANGE & TYPE
    const dailyVolumeVsTarget = {};
    HEIGHT_WIDTH_RANGES.forEach(range => {
      const targetConfig = dailySizeTargetsConfig[range] || { coulissantDailyTarget: 10, ouvrantDailyTarget: 12 };
      
      let realCoulissant = 0;
      let realOuvrant = 0;

      orders.forEach(o => {
        (o.articles || []).forEach(art => {
          const hRange = getDimensionRange(art.hauteur);
          const wRange = getDimensionRange(art.largeur);
          if (hRange === range || wRange === range) {
            const typeStr = (art.typeMenuiserie || art.designation || '').toLowerCase();
            const qty = parseInt(art.quantity) || 1;
            if (typeStr.includes('coulissant')) realCoulissant += qty;
            else realOuvrant += qty;
          }
        });
      });

      dailyVolumeVsTarget[range] = {
        realCoulissant,
        targetCoulissant: targetConfig.coulissantDailyTarget || 0,
        realOuvrant,
        targetOuvrant: targetConfig.ouvrantDailyTarget || 0
      };
    });

    // 8. SMART CALCULATION FOR EACH ORDER (COMPARAISON RÉEL VS OBJECTIF CALCULÉ SUR-MESURE)
    const evaluatedOrders = orders.map(o => {
      const evalResult = calculateOrderSmartTarget(o, gammeTargetsConfig);
      return {
        ...o,
        smartTarget: evalResult.targetMinutes,
        elapsedMinutes: evalResult.elapsedMinutes,
        varianceMinutes: evalResult.varianceMinutes,
        evalResult
      };
    });

    const smartDelayedCount = evaluatedOrders.filter(o => o.evalResult.statusEvaluation.code === 'en_retard' || o.evalResult.statusEvaluation.code === 'depassement').length;
    const smartOnTimeCount = evaluatedOrders.filter(o => o.evalResult.statusEvaluation.code === 'dans_les_temps' || o.evalResult.statusEvaluation.code === 'objectif_atteint').length;
    const smartWatchCount = evaluatedOrders.filter(o => o.evalResult.statusEvaluation.code === 'a_surveiller').length;

    // 9. Tracked En Cours (Existant)
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

    // 10. SOUS-COMMANDES & NON-FINIS METRICS
    const subOrdersList = orders.filter(o => o.isSubOrder);
    const totalSubOrders = subOrdersList.length;
    const parentOrdersCount = orders.filter(o => !o.isSubOrder).length;
    const avgSubOrdersPerOrder = parentOrdersCount > 0 ? (totalSubOrders / parentOrdersCount).toFixed(2) : '0.00';

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

    const ordersOver24h = enCoursOrders.filter(o => {
      if (!o.launchedAt) return false;
      const elapsedMinutes = (Date.now() - new Date(o.launchedAt).getTime()) / (1000 * 60);
      return elapsedMinutes >= 24 * 60;
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
      gammeAvgTimes: gammeRealAvgTimes,
      gammeRealAvgTimes,
      gammeTargetAvgTimes,
      dailyVolumeVsTarget,
      evaluatedOrders,
      smartDelayedCount,
      smartOnTimeCount,
      smartWatchCount,
      trackedEnCours,
      thresholdMinutes,
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

  // Chart: Réel vs Objectif par Gamme
  const gammeRealVsTargetChartData = {
    labels: stats.gammeLabels,
    datasets: [
      {
        label: '⏱️ Temps Réel Moyen (min)',
        data: stats.gammeRealAvgTimes,
        backgroundColor: 'rgba(2, 132, 199, 0.85)',
        borderColor: '#0284c7',
        borderWidth: 2,
        borderRadius: 6
      },
      {
        label: '🎯 Objectif Souhaité (min)',
        data: stats.gammeTargetAvgTimes,
        backgroundColor: 'rgba(16, 185, 129, 0.85)',
        borderColor: '#10b981',
        borderWidth: 2,
        borderRadius: 6
      }
    ]
  };

  // Chart: Réel vs Objectif Coulissant vs Ouvrant
  const coulissantVsOuvrantChartData = {
    labels: ['⚡ Coulissant', '🚪 Ouvrant'],
    datasets: [
      {
        label: 'Temps Moyen Réel (Minutes)',
        data: [stats.avgTimeCoulissant, stats.avgTimeOuvrant],
        backgroundColor: ['rgba(2, 132, 199, 0.85)', 'rgba(124, 58, 237, 0.85)'],
        borderColor: ['#0284c7', '#7c3aed'],
        borderWidth: 2,
        borderRadius: 8
      },
      {
        label: 'Objectif Cible (Minutes)',
        data: [50, 40], // Default targets for Coulissant & Ouvrant
        backgroundColor: ['rgba(148, 163, 184, 0.6)', 'rgba(148, 163, 184, 0.6)'],
        borderColor: ['#64748b', '#64748b'],
        borderWidth: 2,
        borderRadius: 8
      }
    ]
  };

  // Chart: Volume de Production Réel vs Objectif par Tranche
  const volumeVsTargetChartData = {
    labels: HEIGHT_WIDTH_RANGES,
    datasets: [
      {
        label: '⚡ Réel Coulissant',
        data: HEIGHT_WIDTH_RANGES.map(r => stats.dailyVolumeVsTarget[r]?.realCoulissant || 0),
        backgroundColor: 'rgba(2, 132, 199, 0.85)',
        borderRadius: 4
      },
      {
        label: '⚡ Objectif Coulissant / jour',
        data: HEIGHT_WIDTH_RANGES.map(r => stats.dailyVolumeVsTarget[r]?.targetCoulissant || 0),
        backgroundColor: 'rgba(125, 211, 252, 0.5)',
        borderRadius: 4
      },
      {
        label: '🚪 Réel Ouvrant',
        data: HEIGHT_WIDTH_RANGES.map(r => stats.dailyVolumeVsTarget[r]?.realOuvrant || 0),
        backgroundColor: 'rgba(124, 58, 237, 0.85)',
        borderRadius: 4
      },
      {
        label: '🚪 Objectif Ouvrant / jour',
        data: HEIGHT_WIDTH_RANGES.map(r => stats.dailyVolumeVsTarget[r]?.targetOuvrant || 0),
        backgroundColor: 'rgba(216, 180, 254, 0.5)',
        borderRadius: 4
      }
    ]
  };

  // Chart: Tranches de Hauteur
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

  // Chart: Tranches de Largeur
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

  // Chart: Impact Options
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

  // Filter smart evaluated orders
  const filteredSmartOrders = stats.evaluatedOrders.filter(o => {
    const code = o.evalResult.statusEvaluation.code;
    if (smartFilter === 'delayed') return code === 'en_retard' || code === 'depassement';
    if (smartFilter === 'ontime') return code === 'dans_les_temps' || code === 'objectif_atteint';
    if (smartFilter === 'encours') return o.status === 'en_cours';
    return true;
  });

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* Title Banner */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <TrendingUp style={{ color: 'var(--accent-emerald)' }} />
          Tableau de Bord Productivité & Analyse Réel vs Objectifs
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Comparaison en temps réel entre la fabrication réelle et les objectifs par Gamme, Type, Taille et évaluation intelligente par commande.
        </p>
      </div>

      {/* 📌 SECTION NOUTEAU ET CENTRALE: 🎯 COMPARAISON RÉEL VS OBJECTIFS (GAMMES & TYPE & VOLUMES) */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.3rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '8px' }}>
          <Target style={{ color: 'var(--accent-cyan)' }} />
          🎯 Comparaison Réel vs Objectifs (Temps & Volumes par Gamme / Type)
        </h3>

        {/* 3 HIGHLIGHT CARDS FOR REAL VS TARGET */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          
          <div className="glass-card" style={{ padding: '20px', borderLeft: '5px solid var(--accent-cyan)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-cyan)' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '800', textTransform: 'uppercase' }}>RESPECT DES TEMPS CIBLES</span>
              <CheckCircle size={22} />
            </div>
            <div style={{ fontSize: '2.3rem', fontWeight: '800', marginTop: '6px', color: 'var(--accent-cyan)' }}>
              {stats.smartOnTimeCount} <span style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>/ {stats.totalOrders} cmd</span>
            </div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Commandes dans l'objectif de temps calculé sur-mesure
            </div>
          </div>

          <div className="glass-card" style={{ padding: '20px', borderLeft: '5px solid var(--accent-amber)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-amber)' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '800', textTransform: 'uppercase' }}>À SURVEILLER (&gt;85% CIBLE)</span>
              <Hourglass size={22} />
            </div>
            <div style={{ fontSize: '2.3rem', fontWeight: '800', marginTop: '6px', color: 'var(--accent-amber)' }}>
              {stats.smartWatchCount} <span style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>cmd en cours</span>
            </div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Proches de la limite du temps objectif
            </div>
          </div>

          <div className="glass-card" style={{ padding: '20px', borderLeft: '5px solid var(--accent-rose)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-rose)' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '800', textTransform: 'uppercase' }}>DÉPASSEMENTS / RETARDS</span>
              <AlertTriangle size={22} />
            </div>
            <div style={{ fontSize: '2.3rem', fontWeight: '800', marginTop: '6px', color: 'var(--accent-rose)' }}>
              {stats.smartDelayedCount} <span style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>cmd</span>
            </div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Dépassement du temps moyen objectif
            </div>
          </div>

        </div>

        {/* 2 COMPARAISON CHARTS: RÉEL VS OBJECTIF PAR GAMME & VOLUME PAR TRANCHE */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
          
          {/* Chart Réel vs Objectif Temps par Gamme */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} style={{ color: 'var(--accent-cyan)' }} />
              Temps Moyen Réel vs Objectif Souhaité par Gamme (Minutes)
            </h4>
            <div style={{ height: '260px' }}>
              <Bar data={gammeRealVsTargetChartData} options={chartOptionsLight} />
            </div>
          </div>

          {/* Chart Réel vs Objectif Production Volume par Tranche & Type */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Ruler size={16} style={{ color: 'var(--accent-purple)' }} />
              Volume de Production Réel vs Objectif Quotidien par Tranche & Type
            </h4>
            <div style={{ height: '260px' }}>
              <Bar data={volumeVsTargetChartData} options={chartOptionsLight} />
            </div>
          </div>

        </div>
      </div>

      {/* 📌 SECTION INTELLIGENTE: 🧠 CALCUL INTELLIGENT DU RESPECT DES DÉLAIS PAR COMMANDE */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', margin: 0 }}>
            <Zap style={{ color: 'var(--accent-purple)' }} />
            🧠 Calcul Intelligent par Commande selon Taille, Gamme & Type
          </h3>

          {/* Filter tabs for orders */}
          <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
            <button
              className={`btn btn-sm ${smartFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSmartFilter('all')}
              style={{ fontSize: '0.78rem' }}
            >
              Toutes ({stats.evaluatedOrders.length})
            </button>
            <button
              className={`btn btn-sm ${smartFilter === 'ontime' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSmartFilter('ontime')}
              style={{ fontSize: '0.78rem', background: smartFilter === 'ontime' ? '#10b981' : undefined }}
            >
              🟢 Dans les temps ({stats.smartOnTimeCount})
            </button>
            <button
              className={`btn btn-sm ${smartFilter === 'delayed' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSmartFilter('delayed')}
              style={{ fontSize: '0.78rem', background: smartFilter === 'delayed' ? '#e11d48' : undefined }}
            >
              🔴 En retard / Dépassement ({stats.smartDelayedCount})
            </button>
            <button
              className={`btn btn-sm ${smartFilter === 'encours' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSmartFilter('encours')}
              style={{ fontSize: '0.78rem' }}
            >
              ⚙️ En Cours ({stats.enCoursCount})
            </button>
          </div>
        </div>

        {/* ORDER EVALUATION TABLE */}
        {filteredSmartOrders.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
            Aucune commande ne correspond au filtre sélectionné.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                  <th style={{ padding: '10px 14px' }}>Commande & Client</th>
                  <th style={{ padding: '10px 14px' }}>Articles, Gamme & Type</th>
                  <th style={{ padding: '10px 14px' }}>🎯 Objectif Sur-Mesure</th>
                  <th style={{ padding: '10px 14px' }}>⏱️ Temps Réel / Écoulé</th>
                  <th style={{ padding: '10px 14px' }}>Écart (Variance)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Évaluation Intelligente</th>
                </tr>
              </thead>
              <tbody>
                {filteredSmartOrders.map(o => {
                  const evalRes = o.evalResult;
                  const statusInfo = evalRes.statusEvaluation;
                  const isDelayed = statusInfo.code === 'en_retard' || statusInfo.code === 'depassement';
                  
                  return (
                    <tr key={o.id} style={{ borderBottom: '1px solid var(--border-color)', background: isDelayed ? '#fff1f2' : 'transparent' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '800', color: 'var(--text-primary)' }}>{o.id}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{o.nomCommande}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Client: {o.client}</div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {(o.articles || []).slice(0, 2).map((art, idx) => (
                          <div key={idx} style={{ fontSize: '0.8rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span className="badge badge-purple" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>{art.gamme || 'Standard'}</span>
                            <span>{art.typeMenuiserie || art.designation || 'Menuiserie'} ({art.hauteur}×{art.largeur})</span>
                          </div>
                        ))}
                        {(o.articles || []).length > 2 && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            +{(o.articles || []).length - 2} autre(s) article(s)
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: '800', color: 'var(--accent-purple)' }}>
                        {formatDuration(o.smartTarget)}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: '800', color: isDelayed ? '#e11d48' : 'var(--accent-cyan)' }}>
                        {o.status === 'en_attente' ? 'Pas encore lancé' : formatDuration(o.elapsedMinutes)}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 'bold' }}>
                        {o.status === 'en_attente' ? (
                          <span style={{ color: 'var(--text-muted)' }}>--</span>
                        ) : o.varianceMinutes > 0 ? (
                          <span style={{ color: '#e11d48', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <ArrowUpRight size={14} /> +{o.varianceMinutes} min
                          </span>
                        ) : (
                          <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <ArrowDownRight size={14} /> {o.varianceMinutes} min
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span className={`badge ${statusInfo.badgeClass}`} style={{ fontSize: '0.78rem' }}>
                          {statusInfo.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 📌 SECTION EXISTANTE: 🔄 SOUS-COMMANDES ET ARTICLES NON FINIS */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.3rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '8px' }}>
          <GitBranch style={{ color: 'var(--accent-amber)' }} />
          🔄 Suivi des Sous-Commandes & Articles Non Finis
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          
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

      {/* 📌 SECTION EXISTANTE 1: ⏱️ TEMPS DE FABRICATION & PRODUCTIVITÉ */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.3rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '8px' }}>
          <Activity style={{ color: 'var(--accent-cyan)' }} />
          ⏱️ Temps de Fabrication & Productivité Globale
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
          
          <div className="glass-card" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={16} style={{ color: 'var(--accent-cyan)' }} />
              Coulissant vs Ouvrant (Temps Moyen Réel vs Objectif)
            </h4>
            <div style={{ height: '230px' }}>
              <Bar data={coulissantVsOuvrantChartData} options={chartOptionsLight} />
            </div>
          </div>

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

      {/* 📌 SECTION EXISTANTE 2: 📐 ANALYSE PAR TRANCHES DE HAUTEUR ET LARGEUR */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.3rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '8px' }}>
          <Ruler style={{ color: 'var(--accent-emerald)' }} />
          📐 Analyse par Tranches de Hauteur & Largeur (&lt; 1m à &gt; 4000mm)
        </h3>

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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
          
          <div className="glass-card" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Ruler size={16} style={{ color: 'var(--accent-cyan)' }} />
              Répartition & Temps Moyen par Tranche de Hauteur
            </h4>
            <div style={{ height: '260px' }}>
              <Bar data={heightRangeChartData} options={dualAxisChartOptions} />
            </div>
          </div>

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

    </div>
  );
}
