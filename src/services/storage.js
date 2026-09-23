// Data Service & LocalStorage Manager for SuiviPRO (With Supabase Cloud Realtime Sync & Anti-Zombie Deletion)
import {
  fetchCloudOrders,
  saveCloudOrder,
  saveAllCloudOrders,
  deleteCloudOrder,
  subscribeCloudOrdersRealtime
} from './supabaseClient';

const STORAGE_KEY = 'suivie_orders_v2';
const GAMMES_STORAGE_KEY = 'suivie_custom_gammes_v1';
const DELETED_IDS_KEY = 'suivie_deleted_order_ids_v1';

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

// Get deleted order IDs to prevent ghost restoration
export function getDeletedOrderIds() {
  try {
    const data = localStorage.getItem(DELETED_IDS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

export function recordDeletedOrderId(orderId) {
  if (!orderId) return;
  try {
    const list = getDeletedOrderIds();
    if (!list.includes(orderId)) {
      list.push(orderId);
      localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(list));
    }
  } catch (e) {}
}

// Clean obsolete storage keys to free browser space
export function cleanupStorageQuota() {
  try {
    const keysToRemove = ['suivie_orders_v1', 'suivie_orders_v0', 'suivie_demo_v1', 'loglevel'];
    keysToRemove.forEach(k => localStorage.removeItem(k));

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

// Synchronize orders with Supabase Cloud
export async function syncOrdersWithCloud(onSyncCompleted) {
  try {
    const deletedIds = getDeletedOrderIds();
    const rawCloudOrders = await fetchCloudOrders();
    const rawLocalOrders = getOrders();

    // Filter out deleted IDs from both sources
    const localOrders = (rawLocalOrders || []).filter(o => o && o.id && !deletedIds.includes(o.id));
    
    let cloudOrders = [];
    if (rawCloudOrders && Array.isArray(rawCloudOrders)) {
      // If any deleted order is still in cloud, purge it from cloud
      rawCloudOrders.forEach(c => {
        if (c && c.id && deletedIds.includes(c.id)) {
          deleteCloudOrder(c.id);
        } else if (c && c.id) {
          cloudOrders.push(c);
        }
      });
    }

    if (cloudOrders && Array.isArray(cloudOrders)) {
      const orderMap = new Map();
      
      // Load local first
      localOrders.forEach(o => {
        if (o && o.id) orderMap.set(o.id, o);
      });

      // Override with cloud
      cloudOrders.forEach(c => {
        if (!c || !c.id) return;
        const local = orderMap.get(c.id);
        if (!local) {
          orderMap.set(c.id, c);
        } else {
          const localTime = new Date(local.updatedAt || local.createdAt || 0).getTime();
          const cloudTime = new Date(c.updatedAt || c.createdAt || 0).getTime();
          if (cloudTime >= localTime) {
            orderMap.set(c.id, c);
          }
        }
      });

      const merged = Array.from(orderMap.values()).filter(o => o && o.id && !deletedIds.includes(o.id));
      merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      saveOrdersLocally(merged);
      
      if (onSyncCompleted) onSyncCompleted(merged);
      return merged;
    }
  } catch (e) {
    console.warn("Cloud sync warning:", e);
  }
  return getOrders();
}

// Internal Local Storage Saver
function saveOrdersLocally(orders) {
  const deletedIds = getDeletedOrderIds();
  const cleanOrders = orders
    .filter(ord => ord && ord.id && !deletedIds.includes(ord.id))
    .map(ord => ({
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
      updatedAt: ord.updatedAt || new Date().toISOString(),
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

  inMemoryOrdersStore = cleanOrders;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanOrders));
  } catch (err) {
    cleanupStorageQuota();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanOrders));
    } catch (err2) {
      console.error('Critical quota error. Operating in memory fallback:', err2);
    }
  }
}

// Initialize & load stored orders
export function getOrders() {
  const deletedIds = getDeletedOrderIds();
  let list = [];

  if (inMemoryOrdersStore !== null) {
    list = inMemoryOrdersStore;
  } else {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
        inMemoryOrdersStore = [];
        return [];
      }
      list = JSON.parse(data);
      inMemoryOrdersStore = list;
    } catch (e) {
      console.error('Failed to parse orders from localStorage', e);
      inMemoryOrdersStore = [];
      return [];
    }
  }

  return list.filter(o => o && o.id && !deletedIds.includes(o.id));
}

// Save orders locally + push to cloud
export function saveOrders(orders) {
  saveOrdersLocally(orders);
  saveAllCloudOrders(orders);
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
    updatedAt: new Date().toISOString(),
  };
  const updated = [newOrder, ...orders];
  saveOrdersLocally(updated);
  saveCloudOrder(newOrder);
  return newOrder;
}

export function updateOrder(updatedOrderData) {
  const orders = getOrders();
  const targetId = String(updatedOrderData.id || '').trim().toUpperCase();
  let found = false;
  let modifiedOrder = null;

  const updated = orders.map(ord => {
    const currentId = String(ord.id || '').trim().toUpperCase();
    if (currentId === targetId) {
      found = true;
      modifiedOrder = {
        ...ord,
        ...updatedOrderData,
        status: ord.status || 'en_attente',
        updatedAt: new Date().toISOString()
      };
      return modifiedOrder;
    }
    return ord;
  });

  if (!found) {
    modifiedOrder = {
      ...updatedOrderData,
      status: 'en_attente',
      createdAt: updatedOrderData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    updated.unshift(modifiedOrder);
  }

  saveOrdersLocally(updated);
  saveCloudOrder(modifiedOrder);
  return updated;
}

export function updateOrderStatus(orderId, newStatus) {
  const orders = getOrders();
  let modifiedOrder = null;

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

      modifiedOrder = {
        ...ord,
        status: newStatus,
        launchedAt,
        completedAt,
        durationMinutes,
        updatedAt: now
      };
      return modifiedOrder;
    }
    return ord;
  });

  saveOrdersLocally(updated);
  if (modifiedOrder) {
    saveCloudOrder(modifiedOrder);
  }
  return updated;
}

export function deleteOrder(orderId) {
  if (!orderId) return getOrders();
  
  recordDeletedOrderId(orderId);
  const orders = getOrders();
  const updated = orders.filter(o => o.id !== orderId);
  
  saveOrdersLocally(updated);
  deleteCloudOrder(orderId);
  return updated;
}

export function clearAllOrders() {
  const current = getOrders();
  current.forEach(o => {
    if (o && o.id) {
      recordDeletedOrderId(o.id);
      deleteCloudOrder(o.id);
    }
  });
  
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

export { subscribeCloudOrdersRealtime };
