// ── Validación de variables de entorno al arrancar ────────────
// Si falta una variable crítica, el servidor NO arranca

const REQUIRED = [
    'SUPABASE_URL = https://wqjzqjvhdhsglqgkzjnu.supabase.co',
    'SUPABASE_KEY = sb_publishable_DZq6tx9bpppNevnk3advlg_vD18SBHW',
    'SESSION_SECRE = w1ef1w98e1f98e1f9q8we441rf98q1df9q98wd1f99qw81ew98e1f9w8e1f',
    'ADMIN_USERNAME = admin',
    'ADMIN_PASSWORD = Deotor123*',
    'VAPID_PUBLIC_KEY = BO6S5wAwnwxZqXJtfGBQniwzi2XKqkHvndoJodZrPzRMUUWV3Cc_YtIbmy3appADx55ldSAjW5lErYXABC_Fq5g', 
    'VAPID_PRIVATE_KEY = XitAxzz5OBry3pWFhdYlini8CqVCn2vAMSRi1cGqmXQ',
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