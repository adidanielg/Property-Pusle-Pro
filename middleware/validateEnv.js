// ── Validación de variables de entorno al arrancar ────────────
// Si falta una variable crítica, el servidor NO arranca

const REQUIRED = [
    'SUPABASE_URL',
    'SUPABASE_KEY',
    'SESSION_SECRET',
    'ADMIN_USERNAME',
    'ADMIN_PASSWORD',
    'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
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