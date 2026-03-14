// Ejecutar UNA sola vez localmente para generar el hash del ADMIN_PASSWORD
// node hash_admin_password.js
const bcrypt = require('bcryptjs');
const password = process.env.ADMIN_PASSWORD || 'Deotor123*';
bcrypt.hash(password, 12).then(hash => {
    console.log('\n✅ Copia este hash como tu nuevo ADMIN_PASSWORD en Vercel:\n');
    console.log(hash);
    console.log('\nEjemplo: ADMIN_PASSWORD=' + hash + '\n');
});