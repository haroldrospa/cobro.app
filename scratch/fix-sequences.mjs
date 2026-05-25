import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hkzgxdmnvyoviwketxva.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhremd4ZG1udnlvdml3a2V0eHZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMjUzNzUsImV4cCI6MjA2NjgwMTM3NX0.roSANiwzCTmjsDCsVBnHg6c1mr1XKpWXpopFcDaIdrQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fixSequences() {
    console.log('🔧 Iniciando reparación de secuencias de factura...\n');

    // 1. Get distinct invoice_type_id + store_id combinations from sales
    const { data: sales, error: salesErr } = await supabase
        .from('sales')
        .select('invoice_number, invoice_type_id, store_id')
        .not('invoice_number', 'is', null)
        .not('store_id', 'is', null)
        .order('invoice_number', { ascending: false });

    if (salesErr) {
        console.error('❌ Error leyendo sales:', salesErr);
        return;
    }

    console.log(`📊 Total ventas encontradas: ${sales.length}`);

    // 2. Group by store_id + invoice_type_id and find max number
    const groups = {};
    for (const sale of sales) {
        const key = `${sale.store_id}::${sale.invoice_type_id}`;
        if (!groups[key]) {
            groups[key] = {
                store_id: sale.store_id,
                invoice_type_id: sale.invoice_type_id,
                max_number: 0,
                examples: []
            };
        }
        const m = sale.invoice_number?.match(/-(\d+)$/);
        if (m) {
            const n = parseInt(m[1], 10);
            if (n > groups[key].max_number) {
                groups[key].max_number = n;
                groups[key].top_invoice = sale.invoice_number;
            }
        }
        if (groups[key].examples.length < 3) {
            groups[key].examples.push(sale.invoice_number);
        }
    }

    console.log(`\n📋 Grupos encontrados: ${Object.keys(groups).length}\n`);

    for (const [key, group] of Object.entries(groups)) {
        console.log(`📌 Store: ${group.store_id?.slice(0,8)}... | Type: ${group.invoice_type_id} | Max: ${group.max_number} | Top: ${group.top_invoice}`);
        console.log(`   Ejemplos: ${group.examples.join(', ')}`);

        // Check if sequence row exists
        const { data: existing } = await supabase
            .from('invoice_sequences')
            .select('id, current_number')
            .eq('store_id', group.store_id)
            .eq('invoice_type_id', group.invoice_type_id)
            .maybeSingle();

        if (existing) {
            if (group.max_number > existing.current_number) {
                const { error } = await supabase
                    .from('invoice_sequences')
                    .update({ current_number: group.max_number, updated_at: new Date().toISOString() })
                    .eq('id', existing.id);
                console.log(`   ⚡ ACTUALIZADO: ${existing.current_number} → ${group.max_number} ${error ? '❌ ' + error.message : '✅'}`);
            } else {
                console.log(`   ✅ OK: ya tiene ${existing.current_number} ≥ ${group.max_number}`);
            }
        } else {
            // Create new row
            const { error } = await supabase
                .from('invoice_sequences')
                .insert({
                    store_id: group.store_id,
                    invoice_type_id: group.invoice_type_id,
                    current_number: group.max_number,
                });
            console.log(`   🆕 CREADO: new row with ${group.max_number} ${error ? '❌ ' + error.message : '✅'}`);
        }
        console.log('');
    }

    // Verify
    const { data: finalSeq } = await supabase.from('invoice_sequences').select('*');
    console.log(`\n📊 Estado final de invoice_sequences (${finalSeq?.length} filas):`);
    finalSeq?.forEach(s => console.log(`   type=${s.invoice_type_id} | store=${s.store_id?.slice(0,8)}... | current=${s.current_number}`));
    
    console.log('\n✅ Reparación completada. Recarga la página del POS.');
}

fixSequences().catch(console.error);
