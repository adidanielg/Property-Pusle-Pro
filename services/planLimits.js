const supabase = require('./supabaseClient');

const PLANES = {
    starter:  { propiedades: 3,        tickets: 10,       tecnicos: 1,        precio: 9  },
    pro:      { propiedades: 15,       tickets: 50,       tecnicos: 5,        precio: 29 },
    business: { propiedades: Infinity, tickets: Infinity, tecnicos: Infinity, precio: 79 }
};

async function checkPropiedadLimit(companiaId) {
    const { data: c } = await supabase.from('companias').select('plan').eq('id', companiaId).single();
    const { count }   = await supabase.from('propiedades').select('*', { count: 'exact', head: true }).eq('compania_id', companiaId);
    const limite = PLANES[c?.plan || 'starter'].propiedades;
    if (count >= limite) return { allowed: false, plan: c.plan, limite, actual: count };
    return { allowed: true, actual: count, limite };
}

async function checkTicketLimit(companiaId) {
    const { data: c } = await supabase.from('companias').select('plan').eq('id', companiaId).single();
    const { count }   = await supabase.from('tickets').select('*', { count: 'exact', head: true })
        .eq('cliente_id', companiaId).in('estado', ['pendiente', 'en_proceso']);
    const limite = PLANES[c?.plan || 'starter'].tickets;
    if (count >= limite) return { allowed: false, plan: c.plan, limite, actual: count };
    return { allowed: true, actual: count, limite };
}

async function getLimits(companiaId) {
    const { data: c } = await supabase.from('companias').select('plan').eq('id', companiaId).single();
    const plan = c?.plan || 'starter';
    const limites = PLANES[plan];

    const [{ count: props }, { count: tickets }] = await Promise.all([
        supabase.from('propiedades').select('*', { count: 'exact', head: true }).eq('compania_id', companiaId),
        supabase.from('tickets').select('*', { count: 'exact', head: true })
            .eq('cliente_id', companiaId).in('estado', ['pendiente', 'en_proceso'])
    ]);

    const propPct    = limites.propiedades === Infinity ? 0 : Math.round((props    / limites.propiedades) * 100);
    const ticketsPct = limites.tickets     === Infinity ? 0 : Math.round((tickets  / limites.tickets)     * 100);

    return {
        plan,
        propiedades:     { actual: props,   limite: limites.propiedades, pct: propPct    },
        tickets:         { actual: tickets, limite: limites.tickets,     pct: ticketsPct },
        show_upgrade:    propPct >= 80 || ticketsPct >= 80,
        siguiente_plan:  { starter: 'pro', pro: 'business' }[plan] || null
    };
}

function getSiguientePlan(plan) {
    return { starter: 'pro', pro: 'business' }[plan] || null;
}

module.exports = { PLANES, checkPropiedadLimit, checkTicketLimit, getLimits, getSiguientePlan };