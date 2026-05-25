const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function check() {
    console.log('Fetching recent open_orders...');
    const { data, error } = await supabase
        .from('open_orders')
        .select('id, store_id, source, order_status, created_at, customer_name')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Recent Orders:');
        data.forEach(order => {
            console.log(`[${order.created_at}] ID: ${order.id} | Store: ${order.store_id} | Source: "${order.source}" | Status: ${order.order_status} | Customer: ${order.customer_name}`);
        });
    }
}

check();
