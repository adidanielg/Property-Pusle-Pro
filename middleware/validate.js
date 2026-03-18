// ── Validación de esquema en endpoints ────────────────────────
// Uso: router.post('/ruta', validate(schema), async (req, res) => {...})

function validate(schema) {
    return (req, res, next) => {
        const errors = [];

        for (const [field, rules] of Object.entries(schema)) {
            const value = req.body[field];

            // Requerido
            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push(`${field} es requerido`);
                continue;
            }

            // Si no es requerido y está vacío, saltar
            if (value === undefined || value === null || value === '') continue;

            // Tipo string
            if (rules.type === 'string' && typeof value !== 'string') {
                errors.push(`${field} debe ser texto`);
                continue;
            }

            // Longitud mínima
            if (rules.minLength && String(value).trim().length < rules.minLength) {
                errors.push(`${field} debe tener al menos ${rules.minLength} caracteres`);
            }

            // Longitud máxima
            if (rules.maxLength && String(value).trim().length > rules.maxLength) {
                errors.push(`${field} no puede superar ${rules.maxLength} caracteres`);
            }

            // Valores permitidos (enum)
            if (rules.enum && !rules.enum.includes(value)) {
                errors.push(`${field} debe ser uno de: ${rules.enum.join(', ')}`);
            }

            // Email
            if (rules.email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                    errors.push(`${field} debe ser un email válido`);
                }
            }

            // Número mínimo
            if (rules.min !== undefined && Number(value) < rules.min) {
                errors.push(`${field} debe ser al menos ${rules.min}`);
            }

            // Número máximo
            if (rules.max !== undefined && Number(value) > rules.max) {
                errors.push(`${field} no puede superar ${rules.max}`);
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({ error: errors[0], errors });
        }

        next();
    };
}

// ── Esquemas por endpoint ─────────────────────────────────────
const schemas = {

    // Auth
    register: {
        nombre:   { required: true,  type: 'string', minLength: 2, maxLength: 100 },
        apellido: { required: true,  type: 'string', minLength: 2, maxLength: 100 },
        email:    { required: true,  email: true },
        telefono: { required: true,  type: 'string', minLength: 7, maxLength: 20 },
        password: { required: true,  type: 'string', minLength: 6, maxLength: 100 },
        role:     { required: true,  enum: ['cliente', 'tecnico'] },
    },

    login: {
        username: { required: true, type: 'string', minLength: 2 },
        password: { required: true, type: 'string', minLength: 1 },
        role:     { required: true, enum: ['cliente', 'tecnico', 'admin'] },
    },

    // Tickets
    crearTicket: {
        propiedad_id: { required: true,  type: 'string', minLength: 36, maxLength: 36 },
        motivo:       { required: true,  type: 'string', minLength: 2,  maxLength: 200 },
        descripcion:  { required: true,  type: 'string', minLength: 5,  maxLength: 1000 },
        categoria:    { required: false, type: 'string', maxLength: 100 },
    },

    cancelarTicket: {
        motivo: { required: true, type: 'string', minLength: 3, maxLength: 500 },
    },

    mensajeChat: {
        mensaje: { required: true, type: 'string', minLength: 1, maxLength: 1000 },
    },

    // Propiedades
    crearPropiedad: {
        direccion: { required: true, type: 'string', minLength: 5, maxLength: 300 },
    },

    // Calificaciones
    calificar: {
        ticket_id: { required: true,  type: 'string', minLength: 36, maxLength: 36 },
        estrellas:  { required: true,  min: 1, max: 5 },
        comentario: { required: false, type: 'string', maxLength: 500 },
    },

    // Perfil cliente
    perfilCliente: {
        nombre_contacto: { required: true,  type: 'string', minLength: 2,  maxLength: 100 },
        nombre_empresa:  { required: false, type: 'string', maxLength: 100 },
        email:           { required: true,  email: true },
        telefono:        { required: true,  type: 'string', minLength: 7,  maxLength: 20 },
    },

    // Perfil técnico
    perfilTecnico: {
        nombre:       { required: true,  type: 'string', minLength: 2, maxLength: 100 },
        email:        { required: true,  email: true },
        telefono:     { required: true,  type: 'string', minLength: 7, maxLength: 20 },
        especialidad: { required: true,  type: 'string', minLength: 2, maxLength: 100 },
    },

    // Estado ticket (técnico)
    estadoTicket: {
        estado: { required: true, enum: ['en_proceso', 'completado'] },
    },

    // Admin
    editarCliente: {
        nombre_contacto: { required: true, type: 'string', minLength: 2, maxLength: 100 },
        email:           { required: true, email: true },
        telefono:        { required: true, type: 'string', minLength: 7, maxLength: 20 },
    },

    editarTecnico: {
        nombre:       { required: true, type: 'string', minLength: 2, maxLength: 100 },
        email:        { required: true, email: true },
        telefono:     { required: true, type: 'string', minLength: 7, maxLength: 20 },
        especialidad: { required: true, type: 'string', minLength: 2, maxLength: 100 },
    },

    cotizacion: {
        precio:      { required: true,  min: 1, max: 99999 },
        descripcion: { required: true,  type: 'string', minLength: 5, maxLength: 1000 },
    },
};

module.exports = { validate, schemas };