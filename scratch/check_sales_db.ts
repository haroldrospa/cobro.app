import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const storeId = '54d86334-fb76-4c22-98b0-292c739ead6a';
  const invoiceTypes = ['B01', 'B03', 'B04', 'B14', 'B15', 'B16'];

  for (const typeId of invoiceTypes) {
    console.log(`Checking old colliding sales for type ${typeId}...`);

    const { data: sales, error: fetchError } = await supabase
      .from('sales')
      .select('id, invoice_number')
      .eq('store_id', storeId)
      .eq('invoice_type_id', typeId)
      .like('invoice_number', `${typeId}-000001%`)
      .lt('created_at', '2026-07-01T00:00:00Z');

    if (fetchError) {
      console.error(`Error fetching sales for ${typeId}:`, fetchError);
      continue;
    }

    if (sales && sales.length > 0) {
      const saleIds = sales.map(s => s.id);
      console.log(`Found ${sales.length} sales to delete for type ${typeId}. Invoice numbers:`, sales.map(s => s.invoice_number));

      // Delete from sale_items
      const { error: itemsError } = await supabase
        .from('sale_items')
        .delete()
        .in('sale_id', saleIds);

      if (itemsError) {
        console.error(`Error deleting items for ${typeId}:`, itemsError);
        continue;
      }

      // Delete from sales
      const { error: salesError } = await supabase
        .from('sales')
        .delete()
        .in('id', saleIds);

      if (salesError) {
        console.error(`Error deleting sales for ${typeId}:`, salesError);
        continue;
      }
    } else {
      console.log(`No old colliding sales found for type ${typeId}.`);
    }

    // Update sequence to 119 in Supabase (next number will be 120)
    console.log(`Setting sequence for ${typeId} to 119 in Supabase...`);
    const { error: seqError } = await supabase
      .from('invoice_sequences')
      .update({ current_number: 119 })
      .eq('store_id', storeId)
      .eq('invoice_type_id', typeId);

    if (seqError) {
      console.error(`Error resetting sequence for ${typeId}:`, seqError);
    }
  }

  console.log('All sequences updated/verified successfully!');
}

run();
