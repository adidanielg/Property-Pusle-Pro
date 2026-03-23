const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const supabase = require('./supabaseClient');

const authService = {

    // ── LOGIN ─────────────────────────────────────────────────
    async login(username, password, role) {

        // Admin vive en variables de entorno, no en Supabase
        if (role === 'admin') {
            if (username !== process.env.ADMIN_USERNAME) {
                throw new Error('Invalid credentials');
            }
            // Comparar con bcrypt si el password está hasheado, o directo si no
            const adminPass = process.env.ADMIN_PASSWORD || '';
            const isHashed  = adminPass.startsWith('$2');
            const valid = isHashed
                ? await bcrypt.compare(password, adminPass)
                : password === adminPass;
            if (!valid) throw new Error('Invalid credentials');

            const payload = { id: 'admin', username: 'Administrador', role: 'admin' };
            const token   = jwt.sign(payload, process.env.SESSION_SECRET, { expiresIn: '12h' });
            return { user: payload, token };
        }

        // Cliente o Técnico — buscar en Supabase
        const table = role === 'tecnico' ? 'tecnicos' : 'companias';

        const { data: user, error } = await supabase
            .from(table)
            .select('*')
            .eq('username', username)
            .single();

        if (error || !user) throw new Error('Invalid credentials');

        if (role === 'tecnico' && user.deleted_at) {
            throw new Error('Invalid credentials');
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) throw new Error('Invalid credentials');

        const payload = { id: user.id, username: user.username, role };
        const token   = jwt.sign(payload, process.env.SESSION_SECRET, { expiresIn: '8h' });

        delete user.password;
        return { user, token };
    },

    // ── REGISTRO ──────────────────────────────────────────────
    async register(data, role, codigoInvitacion = null) {
        const table = role === 'tecnico' ? 'tecnicos' : 'companias';

        // Generar username: nombre+apellido normalizado + 2 dígitos random
        const base = `${data.nombre}${data.apellido}`
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '');
        const username = `${base}${Math.floor(Math.random() * 90) + 10}`;

        const hashedPassword = await bcrypt.hash(data.password, 10);

        const insertData = role === 'tecnico'
            ? {
                nombre:       `${data.nombre} ${data.apellido}`,
                email:        data.email,
                telefono:     data.telefono,
                especialidad: data.especialidad,
                username,
                password:     hashedPassword
              }
            : {
                nombre_contacto: `${data.nombre} ${data.apellido}`,
                nombre_empresa:  data.nombre_empresa || 'Individual',
                email:           data.email,
                telefono:        data.telefono,
                tipo_cliente:    data.tipo_cliente || 'Individual',
                username,
                password:        hashedPassword
              };

        const { data: newUser, error } = await supabase
            .from(table)
            .insert([insertData])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') throw new Error('El email ya está registrado');
            throw new Error(error.message);
        }

        // Verificar código de invitación para técnicos
        if (role === 'tecnico' && codigoInvitacion) {
            const { data: codigo, error: codigoError } = await supabase
                .from('codigos_invitacion')
                .select('*')
                .eq('codigo', codigoInvitacion.trim().toUpperCase())
                .eq('usado', false)
                .single();

            if (!codigoError && codigo) {
                // Marcar código como usado
                await supabase
                    .from('codigos_invitacion')
                    .update({
                        usado:    true,
                        usado_por: newUser.id,
                        usado_at:  new Date().toISOString()
                    })
                    .eq('id', codigo.id);

                // Activar técnico con plan gratuito
                await supabase
                    .from('tecnicos')
                    .update({ invitado: true })
                    .eq('id', newUser.id);

                console.log(`[CODIGO] Técnico ${newUser.username} activado con código ${codigoInvitacion}`);
            } else {
                console.log(`[CODIGO] Código inválido o ya usado: ${codigoInvitacion}`);
            }
        }

        // Enviar email de bienvenida (async — no bloquea el registro)
        try {
            const emailService = require('./emailService');
            const nombre = role === 'tecnico'
                ? newUser.nombre
                : newUser.nombre_contacto;
            emailService.enviarBienvenida({
                nombre,
                email:    newUser.email,
                username: newUser.username,
                role
            });
        } catch (emailErr) {
            console.error('[EMAIL] Error enviando bienvenida:', emailErr.message);
        }

        return newUser.username;
    }
};

module.exports = authService;