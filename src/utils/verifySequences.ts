import { supabase } from '@/integrations/supabase/client';

/**
 * Script para verificar que las secuencias de facturas estén aisladas por tienda
 * Ejecutar desde la consola del navegador
 */

export async function verifySequenceIsolation() {
    console.log('🔍 Verificando aislamiento de secuencias por tienda...\n');

    try {
        // 1. Obtener usuario actual y su tienda
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error('❌ No hay usuario autenticado');
            return;
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('store_id, stores(name)')
            .eq('id', user.id)
            .single();

        if (!profile?.store_id) {
            console.error('❌ Usuario no tiene tienda asignada');
            return;
        }

        console.log(`👤 Usuario: ${user.email}`);
        console.log(`🏪 Tienda: ${(profile.stores as any)?.name} (ID: ${profile.store_id})\n`);

        // 2. Ver secuencias de esta tienda
        const { data: sequences, error: seqError } = await supabase
            .from('invoice_sequences')
            .select('*')
            .eq('store_id', profile.store_id)
            .order('invoice_type_id');

        if (seqError) {
            console.error('❌ Error obteniendo secuencias:', seqError);
            return;
        }

        console.log('📊 Secuencias de esta tienda:');
        console.table(sequences?.map(seq => ({
            Tipo: seq.invoice_type_id,
            'Último Número': seq.current_number,
            'Próximo': `${seq.invoice_type_id}-${String(seq.current_number + 1).padStart(8, '0')}`
        })));

        // 3. Ver últimas facturas de esta tienda
        const { data: lastSales, error: salesError } = await supabase
            .from('sales')
            .select('invoice_number, invoice_type_id, total, created_at')
            .eq('store_id', profile.store_id)
            .order('created_at', { ascending: false })
            .limit(10);

        if (salesError) {
            console.error('❌ Error obteniendo ventas:', salesError);
            return;
        }

        console.log('\n📝 Últimas 10 facturas de esta tienda:');
        console.table(lastSales?.map(sale => ({
            'Número': sale.invoice_number,
            'Tipo': sale.invoice_type_id,
            'Total': `$${sale.total.toFixed(2)}`,
            'Fecha': new Date(sale.created_at).toLocaleString()
        })));

        // 4. Ver si hay otras tiendas en el sistema
        const { data: allStores } = await supabase
            .from('stores')
            .select('id, name')
            .order('created_at');

        console.log(`\n🏬 Total de tiendas en el sistema: ${allStores?.length || 0}`);

        if (allStores && allStores.length > 1) {
            console.log('\n🔄 Verificando aislamiento entre tiendas...');

            for (const store of allStores) {
                const { data: storeSeqs } = await supabase
                    .from('invoice_sequences')
                    .select('invoice_type_id, current_number')
                    .eq('store_id', store.id);

                const { data: storeSales } = await supabase
                    .from('sales')
                    .select('id')
                    .eq('store_id', store.id);

                console.log(`  ${store.name}: ${storeSeqs?.length || 0} secuencias, ${storeSales?.length || 0} ventas`);
            }
        }

        // 5. Verificar que no haya secuencias huérfanas
        const { data: orphanSeqs } = await supabase
            .from('invoice_sequences')
            .select('*')
            .is('store_id', null);

        if (orphanSeqs && orphanSeqs.length > 0) {
            console.warn(`\n⚠️  Encontradas ${orphanSeqs.length} secuencias sin tienda asignada`);
            console.table(orphanSeqs);
        } else {
            console.log('\n✅ No hay secuencias huérfanas');
        }

        // 6. Probar generación de próximo número
        console.log('\n🧪 Probando generación de próximo número...');

        const testType = sequences?.[0]?.invoice_type_id;
        if (testType) {
            const { data: nextNumber, error: rpcError } = await supabase
                .rpc('get_next_invoice_number', { invoice_type_code: testType });

            if (rpcError) {
                console.error('❌ Error en RPC:', rpcError);
            } else {
                console.log(`✅ Próximo número para tipo ${testType}: ${nextNumber}`);

                // Verificar que la secuencia se incrementó
                const { data: updatedSeq } = await supabase
                    .from('invoice_sequences')
                    .select('current_number')
                    .eq('invoice_type_id', testType)
                    .eq('store_id', profile.store_id)
                    .single();

                console.log(`   Secuencia actualizada a: ${updatedSeq?.current_number}`);
            }
        }

        console.log('\n✅ Verificación completada');

    } catch (error) {
        console.error('❌ Error durante la verificación:', error);
    }
}

// Para usar en la consola del navegador:
// import { verifySequenceIsolation } from './verifySequences';
// verifySequenceIsolation();

// O simplemente copiar todo el contenido de esta función en la consola
