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
import { Bar, Doughnut } from 'react-chartjs-2';
import { Clock, CheckCircle2, PlayCircle, Layers, Box, Maximize2, TrendingUp, Cpu, Award, Disc, Sliders, AlertTriangle, Zap, Hourglass } from 'lucide-react';
import { formatDuration } from '../services/storage';

// Register ChartJS modules
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
  // Compute deep analytics metrics across all orders
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const enAttente = orders.filter(o => o.status === 'en_attente').length;
    const enCoursOrders = orders.filter(o => o.status === 'en_cours');
    const finies = orders.filter(o => o.status === 'fini');

    const totalFinished = finies.length;
    const completionRate = totalOrders > 0 ? Math.round((totalFinished / totalOrders) * 100) : 0;

    // --- 1. Temps Global & Ratio Min / m² ---
    let totalFinishedMinutes = 0;
    let totalFinishedSqM = 0;

    finies.forEach(o => {
      if (o.durationMinutes) totalFinishedMinutes += o.durationMinutes;
      o.articles.forEach(art => {
        const sqM = (art.hauteur / 1000) * (art.largeur / 1000) * art.quantity;
        totalFinishedSqM += sqM;
      });
    });

    const avgDurationGlobal = totalFinished > 0 ? Math.round(totalFinishedMinutes / totalFinished) : 0;
    const minutesPerSqM = totalFinishedSqM > 0 ? Math.round(totalFinishedMinutes / totalFinishedSqM) : 0;

    // --- 2. Queue Time (Temps de réaction : Création -> Lancement) ---
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

    // --- 3. Temps Moyen Coulissant vs Ouvrant ---
    let coulissantTime = { total: 0, count: 0 };
    let ouvrantTime = { total: 0, count: 0 };

    finies.forEach(o => {
      if (!o.durationMinutes) return;
      const isCoulissant = o.articles.some(a => (a.typeMenuiserie || '').toLowerCase() === 'coulissant' || a.designation.toLowerCase().includes('coulissant'));
      const isOuvrant = o.articles.some(a => (a.typeMenuiserie || '').toLowerCase() === 'ouvrant' || a.designation.toLowerCase().includes('ouvrant'));

      if (isCoulissant) {
        coulissantTime.total += o.durationMinutes;
        coulissantTime.count += 1;
      }
      if (isOuvrant) {
        ouvrantTime.total += o.durationMinutes;
        ouvrantTime.count += 1;
      }
    });

    const avgTimeCoulissant = coulissantTime.count > 0 ? Math.round(coulissantTime.total / coulissantTime.count) : 0;
    const avgTimeOuvrant = ouvrantTime.count > 0 ? Math.round(ouvrantTime.total / ouvrantTime.count) : 0;

    // --- 4. Impact des Options (Caisson & Fixe) ---
    let timeWithCaisson = { total: 0, count: 0 };
    let timeWithoutCaisson = { total: 0, count: 0 };
    let timeWithFixe = { total: 0, count: 0 };
    let timeWithoutFixe = { total: 0, count: 0 };

    finies.forEach(o => {
      if (!o.durationMinutes) return;
      const hasCaisson = o.articles.some(a => a.avecCaisson);
      const hasFixe = o.articles.some(a => a.avecFixe);

      if (hasCaisson) {
        timeWithCaisson.total += o.durationMinutes;
        timeWithCaisson.count += 1;
      } else {
        timeWithoutCaisson.total += o.durationMinutes;
        timeWithoutCaisson.count += 1;
      }

      if (hasFixe) {
        timeWithFixe.total += o.durationMinutes;
        timeWithFixe.count += 1;
      } else {
        timeWithoutFixe.total += o.durationMinutes;
        timeWithoutFixe.count += 1;
      }
    });

    const avgWithCaisson = timeWithCaisson.count > 0 ? Math.round(timeWithCaisson.total / timeWithCaisson.count) : 0;
    const avgWithoutCaisson = timeWithoutCaisson.count > 0 ? Math.round(timeWithoutCaisson.total / timeWithoutCaisson.count) : 0;
    const extraMinutesCaisson = avgWithCaisson > avgWithoutCaisson ? avgWithCaisson - avgWithoutCaisson : 0;

    const avgWithFixe = timeWithFixe.count > 0 ? Math.round(timeWithFixe.total / timeWithFixe.count) : 0;
    const avgWithoutFixe = timeWithoutFixe.count > 0 ? Math.round(timeWithoutFixe.total / timeWithoutFixe.count) : 0;
    const extraMinutesFixe = avgWithFixe > avgWithoutFixe ? avgWithFixe - avgWithoutFixe : 0;

    // --- 5. Tranches de Taille (Petite < 1.4m, Moyenne 1.4-2.0m, Grande > 2.0m) ---
    const bracketStats = {
      'Petites (< 1.4m)': { totalTime: 0, count: 0 },
      'Moyennes (1.4m - 2.0m)': { totalTime: 0, count: 0 },
      'Grandes (> 2.0m)': { totalTime: 0, count: 0 }
    };

    finies.forEach(o => {
      if (!o.durationMinutes) return;
      o.articles.forEach(art => {
        const maxDim = Math.max(art.hauteur, art.largeur);
        let key = 'Petites (< 1.4m)';
        if (maxDim >= 2000) key = 'Grandes (> 2.0m)';
        else if (maxDim >= 1400) key = 'Moyennes (1.4m - 2.0m)';

        bracketStats[key].totalTime += o.durationMinutes;
        bracketStats[key].count += 1;
      });
    });

    const bracketLabels = Object.keys(bracketStats);
    const bracketAvgTimes = bracketLabels.map(k =>
      bracketStats[k].count > 0 ? Math.round(bracketStats[k].totalTime / bracketStats[k].count) : 0
    );

    // --- 6. Commandes Bloquées / En retard (Dépassement de la durée moyenne) ---
    const thresholdMinutes = avgDurationGlobal > 0 ? avgDurationGlobal : 60;
    const delayedOrders = enCoursOrders.map(o => {
      const launchTime = o.launchedAt ? new Date(o.launchedAt).getTime() : Date.now();
      const elapsedMin = Math.round((Date.now() - launchTime) / (1000 * 60));
      const exceedMin = elapsedMin - thresholdMinutes;
      return {
        ...o,
        elapsedMin,
        isDelayed: elapsedMin > thresholdMinutes,
        exceedMin: Math.max(0, exceedMin)
      };
    }).filter(o => o.isDelayed);

    // --- 7. Temps par Gamme ---
    const gammeStats = {};
    finies.forEach(o => {
      if (!o.durationMinutes) return;
      o.articles.forEach(art => {
        const g = art.gamme || 'Inconnue';
        if (!gammeStats[g]) {
          gammeStats[g] = { totalTime: 0, count: 0 };
        }
        gammeStats[g].totalTime += o.durationMinutes;
        gammeStats[g].count += 1;
      });
    });

    const gammeLabels = Object.keys(gammeStats);
    const gammeAvgTimes = gammeLabels.map(g => Math.round(gammeStats[g].totalTime / gammeStats[g].count));

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
      bracketLabels,
      bracketAvgTimes,
      delayedOrders,
      gammeLabels,
      gammeAvgTimes,
      thresholdMinutes
    };
  }, [orders]);

  // Chart 1: Temps Coulissant vs Ouvrant
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

  // Chart 2: Temps par Tranche de Taille
  const dimensionChartData = {
    labels: stats.bracketLabels,
    datasets: [
      {
        label: 'Temps Moyen (Minutes)',
        data: stats.bracketAvgTimes,
        backgroundColor: 'rgba(37, 99, 235, 0.8)',
        borderColor: '#2563eb',
        borderWidth: 2,
        borderRadius: 8
      }
    ]
  };

  // Chart 3: Temps par Gamme
  const gammeChartData = {
    labels: stats.gammeLabels.length > 0 ? stats.gammeLabels : ['Aucune commande terminée'],
    datasets: [
      {
        label: 'Temps Moyen par Gamme (Minutes)',
        data: stats.gammeAvgTimes.length > 0 ? stats.gammeAvgTimes : [0],
        backgroundColor: 'rgba(5, 150, 105, 0.8)',
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
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* Title */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <TrendingUp style={{ color: 'var(--accent-emerald)' }} />
          Analyse des Temps de Fabrication & Productivity
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Suivi de la vitesse d'assemblage par Type, Gamme, Options et Détection des retards en temps réel.
        </p>
      </div>

      {/* ALERT SECTION: COMMANDES BLOQUÉES / EN RETARD */}
      {stats.delayedOrders.length > 0 && (
        <div style={{ background: 'rgba(225, 29, 72, 0.08)', border: '2px solid rgba(225, 29, 72, 0.3)', borderRadius: 'var(--radius-md)', padding: '20px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#e11d48', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '12px' }}>
            <AlertTriangle size={24} />
            <span>⚠️ ALERTE : {stats.delayedOrders.length} Commande(s) en Cours Dépassent le Temps Moyen !</span>
          </div>
          <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '14px' }}>
            La durée moyenne normale d'assemblage est de <strong>{formatDuration(stats.thresholdMinutes)}</strong>. Les commandes ci-dessous nécessitent une attention particulière en atelier :
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {stats.delayedOrders.map(o => (
              <div key={o.id} style={{ background: '#ffffff', border: '1px solid #fecdd3', padding: '14px', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span className="badge badge-purple">{o.id}</span>
                  <span className="badge" style={{ background: 'rgba(225,29,72,0.15)', color: '#e11d48' }}>
                    +{o.exceedMin} min de retard
                  </span>
                </div>
                <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{o.nomCommande}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Client : {o.client}</div>
                <div style={{ fontSize: '0.8rem', color: '#e11d48', marginTop: '6px', fontWeight: '600' }}>
                  ⏱️ En fabrication depuis : {formatDuration(o.elapsedMin)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TOP KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        
        {/* KPI 1: Durée Moyenne Globale */}
        <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-cyan)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>DURÉE MOYENNE GLOBALE</span>
            <Clock size={18} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', marginTop: '6px', color: 'var(--accent-cyan)' }}>
            {formatDuration(stats.avgDurationGlobal)}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Calculé sur {stats.totalFinished} commande(s) terminée(s)
          </div>
        </div>

        {/* KPI 2: Ratio Min / m² */}
        <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-emerald)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>RATIO MIN / M²</span>
            <Zap size={18} style={{ color: 'var(--accent-emerald)' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', marginTop: '6px', color: 'var(--accent-emerald)' }}>
            {stats.minutesPerSqM} min / m²
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Cadence d'assemblage au m²
          </div>
        </div>

        {/* KPI 3: Queue Time (Temps de Réaction) */}
        <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-purple)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>QUEUE TIME (RÉACTION)</span>
            <Hourglass size={18} style={{ color: 'var(--accent-purple)' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', marginTop: '6px', color: 'var(--accent-purple)' }}>
            {formatDuration(stats.avgQueueTimeMinutes)}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Délai entre création et lancement scan
          </div>
        </div>

        {/* KPI 4: Taux de Finition */}
        <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-blue)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>TAUX DE FINITION</span>
            <CheckCircle2 size={18} style={{ color: 'var(--accent-blue)' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', marginTop: '6px', color: 'var(--accent-blue)' }}>
            {stats.completionRate}%
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {stats.totalFinished} sur {stats.totalOrders} commandes
          </div>
        </div>

      </div>

      {/* SECTION 1: TEMPS COULISSANT VS OUVRANT & TRANCHES DE TAILLE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px', marginBottom: '28px' }}>
        
        {/* Chart 1: Coulissant vs Ouvrant */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} style={{ color: 'var(--accent-cyan)' }} />
            Temps Moyen : Coulissant vs Ouvrant
          </h3>
          <div style={{ height: '260px' }}>
            <Bar data={coulissantVsOuvrantChartData} options={chartOptionsLight} />
          </div>
          <div style={{ marginTop: '14px', fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
            💡 <strong>Observation :</strong> {stats.avgTimeCoulissant > stats.avgTimeOuvrant ? `Les coulissants prennent en moyenne ${stats.avgTimeCoulissant - stats.avgTimeOuvrant} min de plus à fabriquer que les ouvrants.` : `Les ouvrants et coulissants ont une cadence similaire.`}
          </div>
        </div>

        {/* Chart 2: Tranches de Dimensions */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Maximize2 size={18} style={{ color: 'var(--accent-blue)' }} />
            Temps Moyen par Tranche de Taille (H x L)
          </h3>
          <div style={{ height: '260px' }}>
            <Bar data={dimensionChartData} options={chartOptionsLight} />
          </div>
          <div style={{ marginTop: '14px', fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
            📏 <strong>Manutention :</strong> Petites (&lt;1.4m), Moyennes (1.4-2.0m) et Grandes (&gt;2.0m nécessite 2 opérateurs).
          </div>
        </div>

      </div>

      {/* SECTION 2: TEMPS PAR GAMME & IMPACT DES OPTIONS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px', marginBottom: '28px' }}>
        
        {/* Chart 3: Temps par Gamme */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} style={{ color: 'var(--accent-emerald)' }} />
            Temps Moyen de Fabrication par Gamme
          </h3>
          <div style={{ height: '260px' }}>
            <Bar data={gammeChartData} options={chartOptionsLight} />
          </div>
        </div>

        {/* Chart 4: Impact des Options (Caisson / Fixe) */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Box size={18} style={{ color: 'var(--accent-amber)' }} />
            Impact des Options (Caisson & Fixe) sur le Temps
          </h3>
          <div style={{ height: '260px' }}>
            <Bar data={optionsImpactData} options={chartOptionsLight} />
          </div>
        </div>

      </div>

      {/* SUMMARY OPTIONS CARD */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Award size={20} style={{ color: 'var(--accent-purple)' }} />
          Synthèse des Impact Options sur la Ligne d'Assemblage
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--accent-amber)' }}>
              📦 Option Caisson
            </div>
            <div style={{ fontSize: '0.88rem', marginTop: '6px', color: 'var(--text-secondary)' }}>
              Temps moyen avec caisson : <strong>{formatDuration(stats.avgWithCaisson)}</strong>
              <br />
              Temps moyen sans caisson : <strong>{formatDuration(stats.avgWithoutCaisson)}</strong>
              <br />
              <span style={{ color: 'var(--accent-amber)', fontWeight: 'bold' }}>
                ➡️ Surcoût temps : +{stats.extraMinutesCaisson} min par commande
              </span>
            </div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--accent-cyan)' }}>
              📐 Option Fixe (Imposte / Allège)
            </div>
            <div style={{ fontSize: '0.88rem', marginTop: '6px', color: 'var(--text-secondary)' }}>
              Temps moyen avec fixe : <strong>{formatDuration(stats.avgWithFixe)}</strong>
              <br />
              Temps moyen sans fixe : <strong>{formatDuration(stats.avgWithoutFixe)}</strong>
              <br />
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
                ➡️ Surcoût temps : +{stats.extraMinutesFixe} min par commande
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
