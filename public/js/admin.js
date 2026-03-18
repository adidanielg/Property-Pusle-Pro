
// ── Funciones críticas — definidas primero ────────────────
function cerrarModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
}

let idAEliminar = null, tipoAEliminar = null;
function confirmarEliminar(btn) {
    idAEliminar    = btn.dataset.id;
    tipoAEliminar  = btn.dataset.tipo;
    const nombre   = document.getElementById('eliminarNombre');
    if (nombre) nombre.textContent = btn.dataset.nombre;
    const modal = document.getElementById('eliminarModal');
    if (modal) modal.classList.add('open');
}

function abrirEditarCliente(btn) {
    document.getElementById('ecId').value      = btn.dataset.id;
    document.getElementById('ecNombre').value  = btn.dataset.nombre;
    document.getElementById('ecEmpresa').value = btn.dataset.empresa || '';
    document.getElementById('ecEmail').value   = btn.dataset.email;
    document.getElementById('ecTel').value     = btn.dataset.telefono;
    document.getElementById('ecTipo').value    = btn.dataset.tipo;
    document.getElementById('editarClienteModal').classList.add('open');
}

function abrirEditarTecnico(btn) {
    document.getElementById('etId').value    = btn.dataset.id;
    document.getElementById('etNombre').value= btn.dataset.nombre;
    document.getElementById('etEmail').value = btn.dataset.email;
    document.getElementById('etTel').value   = btn.dataset.telefono;
    document.getElementById('etEsp').value   = btn.dataset.especialidad;
    document.getElementById('editarTecnicoModal').classList.add('open');
}

// ─────────────────────────────────────────────────────────
const ticketsSection = document.getElementById('tickets');
let totalTickets = parseInt(ticketsSection?.dataset.totalTickets) || 0;
const PAGE_SIZE   = parseInt(ticketsSection?.dataset.pageSize) || 20;
let currentPage   = 1;
let totalPages    = Math.ceil(totalTickets / PAGE_SIZE) || 1;

updatePaginacionUI(1, totalPages, totalTickets);

document.querySelectorAll('.adm-overlay').forEach(el => el.addEventListener('click', e => { if (e.target===el) el.classList.remove('open'); }));

// TICKETS
function updatePaginacionUI(page, pages, total) {
    const pI = document.getElementById('paginacionInfo');
    const pP = document.getElementById('paginacionPages');
    const bP = document.getElementById('btnPrev');
    const bN = document.getElementById('btnNext');
    const tC = document.getElementById('ticketCount');
    if (pI) pI.textContent = total + ' tickets en total';
    if (pP) pP.textContent = `Pág ${page} / ${pages||1}`;
    if (bP) bP.disabled = page <= 1;
    if (bN) bN.disabled = page >= pages;
    if (tC) tC.textContent = '(' + total + ')';
}

async function filtrarTickets() { currentPage=1; await cargarTickets(); }
async function cambiarPagina(dir) { const n=currentPage+dir; if(n<1||n>totalPages)return; currentPage=n; await cargarTickets(); }

async function cargarTickets() {
    const cat    = document.getElementById('filtroCategoria').value;
    const estado = document.getElementById('filtroEstado').value;
    const search = document.getElementById('buscarTicket')?.value || '';
    const params = new URLSearchParams({ page: currentPage });
    if (cat)    params.append('categoria', cat);
    if (estado) params.append('estado', estado);
    if (search) params.append('search', search);
    const tbody = document.getElementById('ticketsBody');
    tbody.innerHTML = '<tr><td colspan="7" class="adm-empty">Cargando...</td></tr>';
    try {
        const res  = await fetch(`/admin/tickets?${params}`);
        const data = await res.json();
        totalPages   = data.totalPages;
        totalTickets = data.total;
        updatePaginacionUI(data.page, data.totalPages, data.total);
        renderTickets(data.tickets);
    } catch { tbody.innerHTML = '<tr><td colspan="7" class="adm-empty" style="color:#f87171">Error cargando tickets</td></tr>'; }
}

function renderTickets(tickets) {
    const tbody = document.getElementById('ticketsBody');
    if (!tickets.length) { tbody.innerHTML='<tr><td colspan="7" class="adm-empty">No hay tickets.</td></tr>'; return; }
    const badges = { pendiente:'<span class="adm-badge adm-b-pendiente">Pendiente</span>', en_proceso:'<span class="adm-badge adm-b-en_proceso">En proceso</span>', completado:'<span class="adm-badge adm-b-completado">Completado</span>', cancelado:'<span class="adm-badge adm-b-cancelado">Cancelado</span>' };
    tbody.innerHTML = tickets.map(t => `
        <tr>
            <td class="adm-mono" style="font-size:.7rem;color:#4a5568">${t.id.slice(0,8)}…</td>
            <td><div style="font-weight:500;font-size:.83rem;color:#c9d1e0">${t.motivo||''}</div>${t.categoria?`<span class="adm-badge adm-b-cat" style="margin-top:.2rem">${t.categoria}</span>`:''}</td>
            <td style="font-size:.78rem;color:#8892a4">${t.propiedades?.direccion||'—'}</td>
            <td style="font-size:.78rem;color:#8892a4">${t.companias?.nombre_contacto||t.companias?.nombre_empresa||'—'}</td>
            <td style="font-size:.78rem;color:#8892a4">${t.tecnicos?.nombre||'<span style="color:#252836">Sin asignar</span>'}</td>
            <td>${badges[t.estado]||t.estado}</td>
            <td class="adm-mono" style="font-size:.73rem;color:#4a5568">${new Date(t.created_at).toLocaleDateString()}</td>
        </tr>
    `).join('');
}

// TÉCNICOS
async function guardarTecnico() {
    const id=document.getElementById('tec_id').value, btn=document.getElementById('btnGuardarTec');
    btn.disabled=true; btn.textContent='Guardando...';
    try {
        const res=await fetch(`/admin/tecnicos/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:document.getElementById('tec_nombre').value,email:document.getElementById('tec_email').value,telefono:document.getElementById('tec_telefono').value,especialidad:document.getElementById('tec_especialidad').value,activo:document.getElementById('tec_activo').value==='true'})});
        const data=await res.json();
        if(data.success){cerrarModal('editarTecnicoModal');showToast('✅ Técnico actualizado');setTimeout(()=>location.reload(),800);}
        else showToast(data.error||'Error','error');
    }catch{showToast('Error de conexión','error');}
    btn.disabled=false; btn.textContent='Guardar cambios';
}

// CLIENTES
async function guardarCliente() {
    const id=document.getElementById('cli_id').value, btn=document.getElementById('btnGuardarCli');
    btn.disabled=true; btn.textContent='Guardando...';
    try {
        const res=await fetch(`/admin/clientes/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre_contacto:document.getElementById('cli_nombre').value,nombre_empresa:document.getElementById('cli_empresa').value||'Individual',email:document.getElementById('cli_email').value,telefono:document.getElementById('cli_telefono').value,tipo_cliente:document.getElementById('cli_tipo').value})});
        const data=await res.json();
        if(data.success){cerrarModal('editarClienteModal');showToast('✅ Cliente actualizado');setTimeout(()=>location.reload(),800);}
        else showToast(data.error||'Error','error');
    }catch{showToast('Error de conexión','error');}
    btn.disabled=false; btn.textContent='Guardar cambios';
}

// ELIMINAR
async function ejecutarEliminar() {
    if(!idAEliminar)return;
    const btn=document.getElementById('btnEliminar'); btn.disabled=true; btn.textContent='Eliminando...';
    const url=tipoAEliminar==='tecnico'?`/admin/tecnicos/${idAEliminar}`:`/admin/clientes/${idAEliminar}`;
    try{const res=await fetch(url,{method:'DELETE'});const data=await res.json();if(data.success){cerrarModal('eliminarModal');showToast('✅ Eliminado');setTimeout(()=>location.reload(),800);}else showToast(data.error,'error');}catch{showToast('Error','error');}
    btn.disabled=false; btn.textContent='Sí, eliminar'; idAEliminar=null; tipoAEliminar=null;
}

// CANCELACIONES
async function cargarCancelaciones() {
    try {
        const res=await fetch('/admin/cancelaciones'); const data=await res.json();
        const tbody=document.getElementById('cancelaciones-tbody');
        const count=document.getElementById('cancel-count');
        if(count) count.textContent='('+( data.cancelaciones?.length||0)+')';
        if(!data.cancelaciones?.length){tbody.innerHTML='<tr><td colspan="6" class="adm-empty">No hay cancelaciones registradas.</td></tr>';return;}
        tbody.innerHTML=data.cancelaciones.map(c=>`
            <tr>
                <td class="adm-mono" style="font-size:.73rem;color:#4a5568">${new Date(c.created_at).toLocaleDateString()}</td>
                <td><span class="adm-badge ${c.cancelado_por==='cliente'?'adm-b-en_proceso':'adm-b-inactive'}">${c.cancelado_por}</span></td>
                <td style="font-size:.8rem;color:#8892a4">${c.usuario_nombre||'—'}</td>
                <td style="font-size:.8rem;color:#c9d1e0">${c.titulo||'—'}</td>
                <td style="font-size:.78rem">${c.categoria?`<span class="adm-badge adm-b-cat">${c.categoria}</span>`:'—'}</td>
                <td style="font-size:.78rem;color:#8892a4">${c.motivo||'—'}</td>
            </tr>
        `).join('');
    }catch{console.error('Error cancelaciones');}
}

// FEES - eliminado
// async function cargarFees() {}

cargarCancelaciones();

// ── Códigos de invitación ────────────────────────────────────
async function cargarCodigos() {
    try {
        const res  = await fetch('/admin/codigos');
        const data = await res.json();
        const lista = document.getElementById('codigos-lista');
        if (!lista) return;

        if (!data.codigos?.length) {
            lista.innerHTML = '<div style="color:#4a5568;font-size:.85rem;font-style:italic">No hay códigos generados. Genera uno para invitar técnicos.</div>';
            return;
        }

        lista.innerHTML = data.codigos.map(c => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem .85rem;background:${c.usado ? '#0d0f14' : '#141720'};border:1px solid ${c.usado ? '#1e2235' : 'rgba(124,109,250,.3)'};border-radius:8px;margin-bottom:.4rem">
                <div style="display:flex;align-items:center;gap:.75rem">
                    <span style="font-family:monospace;font-size:.95rem;font-weight:700;color:${c.usado ? '#4a5568' : '#7c74ff'};letter-spacing:.1em">${c.codigo}</span>
                    ${c.usado
                        ? `<span style="font-size:.72rem;color:#4a5568">Usado por <strong style="color:#8892a4">${c.tecnicos?.nombre || 'técnico'}</strong> · ${new Date(c.usado_at).toLocaleDateString()}</span>`
                        : '<span style="background:rgba(52,211,153,.15);color:#34d399;font-size:.68rem;font-weight:700;padding:.2rem .5rem;border-radius:99px">✅ Disponible</span>'
                    }
                </div>
                ${!c.usado ? `<button class="ab ab-red ab-sm" onclick="eliminarCodigo('${c.id}')">🗑️</button>` : ''}
            </div>
        `).join('');
    } catch (err) {
        console.error('[CODIGOS]', err);
    }
}

async function generarCodigo() {
    try {
        const res  = await fetch('/admin/codigos', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            await cargarCodigos();
            // Copiar al clipboard
            navigator.clipboard?.writeText(data.codigo.codigo).catch(() => {});
            alert(`✅ Código generado: ${data.codigo.codigo}

(Copiado al portapapeles)`);
        }
    } catch (err) {
        alert('Error generando código');
    }
}

async function eliminarCodigo(id) {
    if (!confirm('¿Eliminar este código?')) return;
    try {
        await fetch(`/admin/codigos/${id}`, { method: 'DELETE' });
        await cargarCodigos();
    } catch (err) {
        alert('Error eliminando código');
    }
}

cargarCodigos();

// ── Acordeón compañías ────────────────────────────────────────
function toggleCompania(btnOrIdx) {
    const idx   = typeof btnOrIdx === 'object' ? btnOrIdx.dataset.idx : btnOrIdx;
    const el    = document.getElementById('compania-' + idx);
    const arrow = document.getElementById('arrow-' + idx);
    if (!el) return;
    const isOpen = el.style.display !== 'none';
    el.style.display    = isOpen ? 'none' : 'block';
    if (arrow) arrow.textContent = isOpen ? '▼' : '▲';
}
