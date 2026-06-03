require('dotenv').config();

console.log('Available environment variable keys:');
Object.keys(process.env).forEach(key => {
  if (key.includes('SUPABASE') || key.includes('KEY') || key.includes('SERVICE')) {
    console.log(`- ${key}: ${process.env[key] ? 'Present' : 'Absent'}`);
  }
});
