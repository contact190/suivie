import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jxlurmumlsxktjkdpxkg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bHVybXVtbHN4a3Rqa2RweGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNzYxMDcsImV4cCI6MjEwNTc1MjEwN30.3m7nS6DJPY77MpL0mswJMSsw2Uta563Jqhn61mImVqo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Flag to track online connectivity
let isOnline = true;

/**
 * Fetch all orders from Supabase Cloud table 'suivie_orders'
 * Returns array of orders or null if network/table error
 */
export async function fetchCloudOrders() {
  try {
    const { data, error } = await supabase
      .from('suivie_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn("Table 'suivie_orders' error, checking fallback storage...", error.message);
      const fallbackData = await fetchAppStateFallback();
      if (fallbackData) return fallbackData;
      return null;
    }

    isOnline = true;
    if (data && Array.isArray(data)) {
      console.log(`☁️ Supabase Cloud: ${data.length} commande(s) récupérée(s).`);
      return data.map(row => {
        let orderObj = row.data;
        if (typeof orderObj === 'string') {
          try { orderObj = JSON.parse(orderObj); } catch (e) { orderObj = {}; }
        }
        return {
          ...(orderObj || {}),
          id: row.id || orderObj?.id,
          status: row.status || orderObj?.status || 'en_attente',
          updatedAt: row.updated_at || orderObj?.updatedAt
        };
      });
    }
    return [];
  } catch (err) {
    console.error("Cloud fetch error:", err);
    isOnline = false;
    return null;
  }
}

/**
 * Save / Upsert a single order to Supabase Cloud
 */
export async function saveCloudOrder(order) {
  if (!order || !order.id) return null;
  try {
    const rowPayload = {
      id: order.id,
      status: order.status || 'en_attente',
      data: order,
      updated_at: new Date().toISOString()
    };

    console.log(`☁️ Envoi de la commande ${order.id} vers Supabase...`);
    const { error } = await supabase
      .from('suivie_orders')
      .upsert(rowPayload, { onConflict: 'id' });

    if (error) {
      console.warn("⚠️ Upsert 'suivie_orders' échec (Vérifiez RLS dans Supabase):", error.message);
      await saveAppStateFallback(order);
    } else {
      console.log(`✅ Commande ${order.id} sauvegardée sur Supabase !`);
      isOnline = true;
    }
  } catch (e) {
    console.error("Error saving cloud order:", e);
    isOnline = false;
  }
}

/**
 * Bulk save orders array to Cloud
 */
export async function saveAllCloudOrders(orders) {
  if (!orders || !Array.isArray(orders)) return;
  try {
    const rows = orders.map(ord => ({
      id: ord.id,
      status: ord.status || 'en_attente',
      data: ord,
      updated_at: ord.updatedAt || new Date().toISOString()
    }));

    const { error } = await supabase
      .from('suivie_orders')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      console.warn("Bulk upsert fallback to app_state...", error.message);
      await saveAllAppStateFallback(orders);
    } else {
      console.log(`☁️ Supabase Cloud: Sync global de ${orders.length} commande(s) effectuée avec succès.`);
      isOnline = true;
    }
  } catch (e) {
    console.error("Error bulk saving cloud orders:", e);
    isOnline = false;
  }
}

/**
 * Delete an order from Supabase Cloud (both table and fallback)
 */
export async function deleteCloudOrder(orderId) {
  if (!orderId) return;
  const normId = String(orderId).trim().toUpperCase();
  try {
    const { error } = await supabase
      .from('suivie_orders')
      .delete()
      .or(`id.eq.${orderId},id.eq.${normId}`);

    if (error) {
      console.warn("Delete from 'suivie_orders' failed:", error.message);
    }
  } catch (e) {
    console.error("Error deleting cloud order:", e);
  }

  // Always purge from app_state fallback as well
  await deleteAppStateFallback(orderId);
}

async function deleteAppStateFallback(orderId) {
  try {
    const normId = String(orderId).trim().toUpperCase();
    const current = await fetchAppStateFallback();
    if (Array.isArray(current)) {
      const updated = current.filter(o => o && String(o.id || '').trim().toUpperCase() !== normId);
      await saveAllAppStateFallback(updated);
    }
  } catch (e) {
    console.error("Fallback delete failed", e);
  }
}

/**
 * Subscribe to real-time changes on 'suivie_orders'
 */
export function subscribeCloudOrdersRealtime(onOrdersChanged) {
  try {
    const channel = supabase.channel('suivie_orders_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'suivie_orders' },
        (payload) => {
          console.log("⚡ Supabase Realtime Change Event:", payload.eventType, payload);
          if (onOrdersChanged) onOrdersChanged(payload);
        }
      )
      .subscribe((status) => {
        console.log("⚡ Supabase Realtime Subscription Status:", status);
        if (status === 'SUBSCRIBED') {
          isOnline = true;
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (e) {
    console.error("Error subscribing to Supabase Realtime:", e);
    return () => {};
  }
}

/**
 * Fallback helpers using app_state key 'suivie_orders_json'
 */
async function fetchAppStateFallback() {
  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('data')
      .eq('id', 'suivie_orders_json')
      .single();

    if (error || !data || !data.data) return null;
    return data.data;
  } catch (e) {
    return null;
  }
}

async function saveAllAppStateFallback(orders) {
  try {
    await supabase
      .from('app_state')
      .upsert({
        id: 'suivie_orders_json',
        data: orders,
        updated_at: new Date().toISOString()
      });
  } catch (e) {
    console.error("Fallback save failed", e);
  }
}

async function saveAppStateFallback(order) {
  // Read current, update single order, save back
  const current = await fetchAppStateFallback() || [];
  const updated = current.filter(o => o.id !== order.id);
  updated.unshift(order);
  await saveAllAppStateFallback(updated);
}

export function getCloudOnlineStatus() {
  return isOnline;
}
