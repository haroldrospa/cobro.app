const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://xyz.supabase.co', 'xyz');

const query = supabase.from('sales').select('id');
query.range(0, 9);
console.log(query.url.toString());
query.range(10, 19);
console.log(query.url.toString());
