import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // 1. Get store_id and profile_id from cash_sessions
  const { data: activeSessions, error: sessionError } = await supabase
    .from('cash_sessions')
    .select('store_id, opened_by')
    .eq('status', 'open')
    .limit(1);

  if (sessionError || !activeSessions || activeSessions.length === 0) {
    console.error('Error fetching cash sessions:', sessionError || 'No active sessions');
    return;
  }

  const { store_id, opened_by: profile_id } = activeSessions[0];
  console.log('Using Store ID:', store_id, 'Profile ID:', profile_id);

  // 2. Get a valid product ID
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, price')
    .limit(1);

  if (prodErr || !products || products.length === 0) {
    console.error('Error fetching product:', prodErr || 'No products found');
    return;
  }

  const product = products[0];
  console.log('Using Product:', product);

  const saleId = crypto.randomUUID();
  const mockItems = [{
    id: product.id,
    price: product.price || 100,
    quantity: 1,
    tax: 0.18,
    cost_includes_tax: false
  }];

  console.log('Invoking RPC create_sale_transaction_v3...');
  const { data: rpcResult, error: rpcError } = await supabase.rpc('create_sale_transaction_v3', {
    p_sale_id: saleId,
    p_customer_id: null,
    p_invoice_type_id: 'B02',
    p_subtotal: 100,
    p_discount_total: 0,
    p_tax_total: 18,
    p_total: 118,
    p_payment_method: 'cash',
    p_amount_received: 200,
    p_change_amount: 82,
    p_split_cash: null,
    p_split_method: null,
    p_payment_status: 'paid',
    p_due_date: null,
    p_store_id: store_id,
    p_profile_id: profile_id,
    p_items: mockItems
  });

  if (rpcError) {
    console.error('RPC Error details:', rpcError);
  } else {
    console.log('RPC Success result:', rpcResult);
    return;
  }

  console.log('Attempting direct insert into sales table...');
  const { data: insertResult, error: insertError } = await supabase
    .from('sales')
    .insert([{
      id: saleId,
      invoice_number: 'TEST-99999999',
      customer_id: null,
      invoice_type_id: 'B02',
      subtotal: 100,
      discount_total: 0,
      tax_total: 18,
      total: 118,
      payment_method: 'cash',
      amount_received: 200,
      change_amount: 82,
      payment_status: 'paid',
      store_id: store_id,
      profile_id: profile_id
    }])
    .select();

  if (insertError) {
    console.error('Direct Insert Error:', insertError);
  } else {
    console.log('Direct Insert Success:', insertResult);
  }
}

run();
