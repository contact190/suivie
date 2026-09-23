import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uxfktjdibabwcjinynlk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4Zmt0amRpYmFid2NqaW55bmxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDczNTUsImV4cCI6MjA5OTY4MzM1NX0.p7tzcrPlxmes7pyoWES6bKsf7tO7HAGfgn7Cs5r_AE0';

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
      // Fallback: If table 'suivie_orders' doesn't exist yet, check generic storage 'app_state'
      console.warn("Table 'suivie_orders' error, checking fallback storage...", error.message);
      return await fetchAppStateFallback();
    }

    isOnline = true;
    if (data && Array.isArray(data)) {
      return data.map(row => ({
        ...row.data,
        id: row.id || row.data?.id,
        status: row.status || row.data?.status || 'en_attente',
        updatedAt: row.updated_at || row.data?.updatedAt
      }));
    }
    return [];
  } catch (err) {
    console.error("Cloud fetch error:", err);
    isOnline = false;
    return null; // Return null so storage service can fallback to LocalStorage
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

    const { error } = await supabase
      .from('suivie_orders')
      .upsert(rowPayload, { onConflict: 'id' });

    if (error) {
      console.warn("Upsert to 'suivie_orders' failed, using fallback app_state...", error.message);
      await saveAppStateFallback(order);
    } else {
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
      isOnline = true;
    }
  } catch (e) {
    console.error("Error bulk saving cloud orders:", e);
    isOnline = false;
  }
}

/**
 * Delete an order from Supabase Cloud
 */
export async function deleteCloudOrder(orderId) {
  if (!orderId) return;
  try {
    const { error } = await supabase
      .from('suivie_orders')
      .delete()
      .eq('id', orderId);

    if (error) {
      console.warn("Delete from 'suivie_orders' failed:", error.message);
    }
  } catch (e) {
    console.error("Error deleting cloud order:", e);
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
