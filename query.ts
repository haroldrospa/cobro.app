import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://xxx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'xxx';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      id, created_at, status, notes,
      sale_items ( product:products(name, category_id) )
    `);
  if (error) console.error(error);
  
  let countProduct = 0;
  let countNote = 0;
  let countStatus = 0;
  for (const s of (data || [])) {
    let hasDelivery = false;
    for (const i of (s.sale_items || [])) {
      if (i.product && i.product.name === 'Delivery') {
        hasDelivery = true;
      }
    }
    if (hasDelivery) {
        countProduct++;
        console.log('Sale with Delivery product:', s.created_at, s.status, s.notes);
    }
    if (s.notes && s.notes.includes('PARA LLEVAR')) {
        countNote++;
        console.log('Sale with Para Llevar note:', s.created_at, s.status, s.notes, `Has Delivery Prod: ${hasDelivery}`);
    }
    if (s.status === 'Delivery') {
        countStatus++;
        console.log('Sale with Delivery Status:', s.created_at, s.status, s.notes);
    }
  }
  console.log('Total sales with Delivery product:', countProduct);
  console.log('Total sales with [PARA LLEVAR] note:', countNote);
  console.log('Total sales with Delivery status:', countStatus);
}
run();
