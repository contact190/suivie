// Data Service & LocalStorage Manager for SuiviPRO (Light Mode & Quota Resilient Edition)

const STORAGE_KEY = 'suivie_orders_v2';
const GAMMES_STORAGE_KEY = 'suivie_custom_gammes_v1';

// In-memory fallback if LocalStorage quota is strictly locked by browser
let inMemoryOrdersStore = null;

// Presets for Menuiseries Gammes (Only user defined gammes)
export const DEFAULT_GAMMES = [
  'h36 2p',
  'h31 2p',
  'h40 1v',
  'h40 vasistas'
];

// Presets for Special Volet Roulant
export const DEFAULT_TYPES_LAME = [
  'Lame Aluminium 45mm DP (Alu double paroi thermo-lacqué)',
  'Lame Aluminium 55mm Réforcée',
  'Lame PVC 40mm Standard',
  'Lame Aluminium Extrudé Sécurité 50mm',
  'Lame Orientable (Bi-climatisation)',
  'Lame Micro-Perforée'
];

export const DEFAULT_TYPES_CAISSON = [
  'Caisson Pan Coupé 45° (Rénovation)',
  'Caisson Quart-de-Rond (Arrondi Rénovation)',
  'Caisson Carré 90°',
  'Caisson Monobloc (Bloc-Baie Intégré)',
  'Caisson Encastré / Tunnel',
  'Caisson Traditionnel (Coffre sous linteau)'
];

export const DEFAULT_TYPES_MANOEUVRE = [
  'Moteur Radio Somfy io / RTS',
  'Moteur Filaire à Inverseur',
  'Moteur Solaire Autonome avec Panneau',
  'Manivelle / Treuil Manuel',
  'Sangle / Tirage Direct avec Serrure'
];

export const DEFAULT_COLORIS = [
  'RAL 9016 Blanc Brillant',
  'RAL 7016 Anthracite Structuré',
  'RAL 9005 Noir Mat',
  'Chêne Doré (Imitation Bois)',
  'RAL 8019 Brun Gris',
  'RAL 7035 Gris Clair'
];

// Clean obsolete storage keys to free browser space
export function cleanupStorageQuota() {
  try {
    const keysToRemove = ['suivie_orders_v1', 'suivie_orders_v0', 'suivie_demo_v1', 'loglevel'];
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // Also remove any random large temp keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('temp_') || key.includes('cache_'))) {
        localStorage.removeItem(key);
      }
    }
  } catch (e) {
    console.error('Failed to cleanup storage quota:', e);
  }
}

// Get stored gammes list
export function getStoredGammes() {
  try {
    const customData = localStorage.getItem(GAMMES_STORAGE_KEY);
    let custom = [];
    if (customData) {
      try { custom = JSON.parse(customData); } catch (e) { custom = []; }
    }
    const all = [...DEFAULT_GAMMES, ...custom];
    return Array.from(new Set(all));
  } catch (e) {
    return DEFAULT_GAMMES;
  }
}

export function saveStoredGamme(newGamme) {
  if (!newGamme || !newGamme.trim()) return getStoredGammes();
  const trimmed = newGamme.trim();
  try {
    const customData = localStorage.getItem(GAMMES_STORAGE_KEY);
    let custom = [];
    if (customData) {
      try { custom = JSON.parse(customData); } catch (e) { custom = []; }
    }
    if (!custom.includes(trimmed) && !DEFAULT_GAMMES.includes(trimmed)) {
      custom.push(trimmed);
      localStorage.setItem(GAMMES_STORAGE_KEY, JSON.stringify(custom));
    }
  } catch (e) {
    console.warn('Could not save custom gamme to localStorage:', e);
  }
  return getStoredGammes();
}

// Initialize & load stored orders
export function getOrders() {
  if (inMemoryOrdersStore !== null) {
    return inMemoryOrdersStore;
  }
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      inMemoryOrdersStore = [];
      return [];
    }
    const parsed = JSON.parse(data);
    inMemoryOrdersStore = parsed;
    return parsed;
  } catch (e) {
    console.error('Failed to parse orders from localStorage', e);
    inMemoryOrdersStore = [];
    return [];
  }
}

// Safe saveOrders with QuotaExceeded Error Handling & Pruning
export function saveOrders(orders) {
  // Sanitize orders to store only lightweight JSON fields
  const cleanOrders = orders.map(ord => ({
    id: ord.id,
    orderCategory: ord.orderCategory || 'menuiserie',
    nomCommande: ord.nomCommande || '',
    client: ord.client || '',
    notes: ord.notes || '',
    status: ord.status || 'en_attente',
    createdAt: ord.createdAt,
    launchedAt: ord.launchedAt,
    completedAt: ord.completedAt,
    durationMinutes: ord.durationMinutes,
    updatedAt: ord.updatedAt,
    articles: (ord.articles || []).map(a => ({
      id: a.id,
      designation: a.designation || '',
      typeMenuiserie: a.typeMenuiserie,
      quantity: a.quantity || 1,
      hauteur: a.hauteur || 1000,
      largeur: a.largeur || 1000,
      gamme: a.gamme || 'h36 2p',
      avecCaisson: Boolean(a.avecCaisson),
      caissonHauteur: a.caissonHauteur,
      avecFixe: Boolean(a.avecFixe),
      fixeDetails: a.fixeDetails,
      typeLame: a.typeLame,
      typeCaisson: a.typeCaisson,
      typeManoeuvre: a.typeManoeuvre,
      coloris: a.coloris
    }))
  }));

  // Always update in-memory store
  inMemoryOrdersStore = cleanOrders;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanOrders));
  } catch (err) {
    console.warn('QuotaExceededError encountered! Triggering automatic quota cleanup...', err);
    cleanupStorageQuota();

    try {
      // Try again after cleanup
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanOrders));
    } catch (err2) {
      console.warn('Still exceeding quota. Pruning oldest finished orders...', err2);
      // Keep all en_attente and en_cours, and keep up to 20 most recent finished orders
      const pending = cleanOrders.filter(o => o.status !== 'fini');
      const finished = cleanOrders.filter(o => o.status === 'fini').slice(0, 20);
      const pruned = [...pending, ...finished];
      
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
        inMemoryOrdersStore = pruned;
      } catch (err3) {
        console.error('Critical quota error. Operating in memory fallback:', err3);
      }
    }
  }
}

export function addOrder(orderData) {
  const orders = getOrders();
  const prefix = orderData.orderCategory === 'volet' ? 'VLT' : 'CMD';
  const newOrder = {
    ...orderData,
    id: orderData.id || `${prefix}-${new Date().getFullYear()}-${String(orders.length + 1).padStart(3, '0')}`,
    orderCategory: orderData.orderCategory || 'menuiserie',
    status: 'en_attente',
    createdAt: new Date().toISOString(),
  };
  const updated = [newOrder, ...orders];
  saveOrders(updated);
  return newOrder;
}

export function updateOrder(updatedOrderData) {
  const orders = getOrders();
  const targetId = String(updatedOrderData.id || '').trim().toUpperCase();
  let found = false;

  const updated = orders.map(ord => {
    const currentId = String(ord.id || '').trim().toUpperCase();
    if (currentId === targetId) {
      found = true;
      return {
        ...ord,
        ...updatedOrderData,
        status: ord.status || 'en_attente',
        updatedAt: new Date().toISOString()
      };
    }
    return ord;
  });

  if (!found) {
    updated.unshift({
      ...updatedOrderData,
      status: 'en_attente',
      updatedAt: new Date().toISOString()
    });
  }

  saveOrders(updated);
  return updated;
}

export function updateOrderStatus(orderId, newStatus) {
  const orders = getOrders();
  const updated = orders.map(ord => {
    if (ord.id === orderId) {
      const now = new Date().toISOString();
      let launchedAt = ord.launchedAt;
      let completedAt = ord.completedAt;
      let durationMinutes = ord.durationMinutes;

      if (newStatus === 'en_cours' && !launchedAt) {
        launchedAt = now;
      } else if (newStatus === 'fini') {
        if (!launchedAt) launchedAt = now;
        completedAt = now;
        const launchTime = new Date(launchedAt).getTime();
        const finishTime = new Date(completedAt).getTime();
        durationMinutes = Math.max(1, Math.round((finishTime - launchTime) / (1000 * 60)));
      } else if (newStatus === 'en_attente') {
        launchedAt = undefined;
        completedAt = undefined;
        durationMinutes = undefined;
      }

      return {
        ...ord,
        status: newStatus,
        launchedAt,
        completedAt,
        durationMinutes
      };
    }
    return ord;
  });

  saveOrders(updated);
  return updated;
}

export function deleteOrder(orderId) {
  const orders = getOrders();
  const updated = orders.filter(o => o.id !== orderId);
  saveOrders(updated);
  return updated;
}

export function clearAllOrders() {
  inMemoryOrdersStore = [];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  } catch (e) {
    console.error(e);
  }
  return [];
}

// Utility: Format duration in readable French text
export function formatDuration(minutes) {
  if (!minutes || isNaN(minutes)) return 'N/A';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
}
