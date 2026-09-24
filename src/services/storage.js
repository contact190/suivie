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

// Predefined Height & Width Ranges for Menuiserie Articles
export const HEIGHT_WIDTH_RANGES = [
  '< 1000 mm (< 1m)',
  '1000 - 1500 mm',
  '1500 - 2000 mm',
  '2000 - 2500 mm',
  '2500 - 3000 mm',
  '3000 - 3500 mm',
  '3500 - 4000 mm',
  '> 4000 mm'
];

export function getDimensionRange(val) {
  if (!val) return '1000 - 1500 mm';
  const strVal = String(val).trim();
  if (HEIGHT_WIDTH_RANGES.includes(strVal)) return strVal;
  
  const num = parseInt(strVal, 10);
  if (isNaN(num)) return '1000 - 1500 mm';
  if (num < 1000) return '< 1000 mm (< 1m)';
  if (num < 1500) return '1000 - 1500 mm';
  if (num < 2000) return '1500 - 2000 mm';
  if (num < 2500) return '2000 - 2500 mm';
  if (num < 3000) return '2500 - 3000 mm';
  if (num < 3500) return '3000 - 3500 mm';
  if (num < 4000) return '3500 - 4000 mm';
  return '> 4000 mm';
}

export function parseRangeToMidpoint(val) {
  if (typeof val === 'number') return val;
  const s = String(val || '');
  if (s.includes('< 1000')) return 800;
  if (s.includes('1000 - 1500')) return 1250;
  if (s.includes('1500 - 2000')) return 1750;
  if (s.includes('2000 - 2500')) return 2250;
  if (s.includes('2500 - 3000')) return 2750;
  if (s.includes('3000 - 3500')) return 3250;
  if (s.includes('3500 - 4000')) return 3750;
  if (s.includes('> 4000')) return 4250;
  const num = parseInt(s, 10);
  return isNaN(num) ? 1250 : num;
}


// Get deleted order IDs to prevent ghost restoration
export function getDeletedOrderIds() {
  try {
    const data = localStorage.getItem(DELETED_IDS_KEY);
    const list = data ? JSON.parse(data) : [];
    return Array.isArray(list) ? list.map(id => String(id || '').trim().toUpperCase()) : [];
  } catch (e) {
    return [];
  }
}

export function recordDeletedOrderId(orderId) {
  if (!orderId) return;
  const normId = String(orderId).trim().toUpperCase();
  try {
    const list = getDeletedOrderIds();
    if (!list.includes(normId)) {
      list.push(normId);
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
    const localOrders = (rawLocalOrders || []).filter(o => o && o.id && !deletedIds.includes(String(o.id).trim().toUpperCase()));
    
    let cloudOrders = [];
    if (rawCloudOrders && Array.isArray(rawCloudOrders)) {
      for (const c of rawCloudOrders) {
        if (c && c.id) {
          const normCId = String(c.id).trim().toUpperCase();
          if (deletedIds.includes(normCId)) {
            deleteCloudOrder(c.id);
          } else {
            cloudOrders.push(c);
          }
        }
      }
    }

    if (cloudOrders && Array.isArray(cloudOrders)) {
      const orderMap = new Map();
      
      // Load local first
      localOrders.forEach(o => {
        if (o && o.id) orderMap.set(String(o.id).trim().toUpperCase(), o);
      });

      // Override with cloud
      cloudOrders.forEach(c => {
        if (!c || !c.id) return;
        const normId = String(c.id).trim().toUpperCase();
        const local = orderMap.get(normId);
        if (!local) {
          orderMap.set(normId, c);
        } else {
          const localTime = new Date(local.updatedAt || local.createdAt || 0).getTime();
          const cloudTime = new Date(c.updatedAt || c.createdAt || 0).getTime();
          if (cloudTime >= localTime) {
            orderMap.set(normId, c);
          }
        }
      });

      const merged = Array.from(orderMap.values()).filter(o => o && o.id && !deletedIds.includes(String(o.id).trim().toUpperCase()));
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
    .filter(ord => ord && ord.id && !deletedIds.includes(String(ord.id).trim().toUpperCase()))
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
      parentOrderId: ord.parentOrderId || null,
      isSubOrder: Boolean(ord.isSubOrder),
      subOrders: Array.isArray(ord.subOrders) ? ord.subOrders : [],
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
        coloris: a.coloris,
        isFinished: Boolean(a.isFinished)
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

  return list.filter(o => o && o.id && !deletedIds.includes(String(o.id).trim().toUpperCase()));
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
  
  const normTargetId = String(orderId).trim().toUpperCase();
  recordDeletedOrderId(normTargetId);
  
  const orders = getOrders();
  const targetOrder = orders.find(o => o && String(o.id || '').trim().toUpperCase() === normTargetId);
  
  const idsToDelete = new Set([normTargetId]);
  if (targetOrder && Array.isArray(targetOrder.subOrders)) {
    targetOrder.subOrders.forEach(subId => {
      if (subId) idsToDelete.add(String(subId).trim().toUpperCase());
    });
  }

  idsToDelete.forEach(id => recordDeletedOrderId(id));

  // Remove target order and any of its suborders, and clean up parent order references
  const updated = orders
    .filter(o => o && o.id && !idsToDelete.has(String(o.id).trim().toUpperCase()))
    .map(o => {
      if (o && Array.isArray(o.subOrders)) {
        return {
          ...o,
          subOrders: o.subOrders.filter(subId => !idsToDelete.has(String(subId).trim().toUpperCase()))
        };
      }
      return o;
    });

  saveOrdersLocally(updated);
  saveAllCloudOrders(updated);
  
  idsToDelete.forEach(id => {
    deleteCloudOrder(id);
  });

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
  saveAllCloudOrders([]);
  return [];
}

// Create a Sub-Order for orders launched > 24 hours ago
export function createSubOrder(parentOrderId, selectedArticles, subOrderNotes = '') {
  const orders = getOrders();
  const parentOrder = orders.find(o => o.id === parentOrderId);
  if (!parentOrder) return null;

  const existingSubCount = (parentOrder.subOrders || []).length;
  const subOrderId = `${parentOrder.id}-S${existingSubCount + 1}`;

  const newSubOrder = {
    id: subOrderId,
    orderCategory: parentOrder.orderCategory || 'menuiserie',
    nomCommande: `${parentOrder.nomCommande} (Sous-commande S${existingSubCount + 1})`,
    client: parentOrder.client || '',
    notes: subOrderNotes ? `[Sous-commande de ${parentOrder.id}] ${subOrderNotes}` : `[Sous-commande de ${parentOrder.id}] Articles non finis après +24h`,
    status: 'en_attente',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    parentOrderId: parentOrder.id,
    isSubOrder: true,
    subOrders: [],
    articles: selectedArticles.map((art, idx) => ({
      ...art,
      id: `${subOrderId}-ART-${idx + 1}`,
      isFinished: false
    }))
  };

  const updatedSubOrdersList = [...(parentOrder.subOrders || []), subOrderId];
  const updatedParentOrder = {
    ...parentOrder,
    subOrders: updatedSubOrdersList,
    updatedAt: new Date().toISOString()
  };

  const newOrdersList = [newSubOrder, ...orders.map(o => o.id === parentOrderId ? updatedParentOrder : o)];
  saveOrders(newOrdersList);

  return newSubOrder;
}

export function toggleArticleFinished(orderId, articleId) {
  const orders = getOrders();
  let modifiedOrder = null;

  const updated = orders.map(ord => {
    if (ord.id === orderId) {
      const updatedArticles = (ord.articles || []).map(art => {
        if (art.id === articleId) {
          return { ...art, isFinished: !art.isFinished };
        }
        return art;
      });

      const allFinished = updatedArticles.length > 0 && updatedArticles.every(a => a.isFinished);
      let newStatus = ord.status;
      if (allFinished && ord.status === 'en_cours') {
        newStatus = 'fini';
      }

      modifiedOrder = {
        ...ord,
        articles: updatedArticles,
        status: newStatus,
        updatedAt: new Date().toISOString()
      };
      return modifiedOrder;
    }
    return ord;
  });

  saveOrders(updated);
  return updated;
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
