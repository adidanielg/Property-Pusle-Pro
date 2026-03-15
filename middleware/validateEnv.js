const REQUIRED = [
    'SUPABASE_URL',
    'SUPABASE_KEY',
    'SESSION_SECRET',
    'ADMIN_USERNAME',
    'ADMIN_PASSWORD',
    'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_STARTER',
    'STRIPE_PRICE_PRO',
    'STRIPE_PRICE_BUSINESS',
];

function validateEnv() {
    const missing = REQUIRED.filter(key => !process.env[key]);
    if (missing.length > 0) {
        console.error('\n❌  VARIABLES DE ENTORNO FALTANTES:');
        missing.forEach(k => console.error(`    → ${k}`));
        console.error('\nAgrega estas variables en Vercel o en tu .env local.\n');
        process.exit(1);
    }
    console.log('✅  Variables de entorno validadas');
}

module.exports = validateEnv;