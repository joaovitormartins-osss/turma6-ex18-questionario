let paginaAtual = 'dashboard';
let dadosDashboard = {
    totalPerguntas: 0,
    totalFormularios: 0,
    totalRespostas: 0,
    formulariosAtivos: 0
};

document.addEventListener('DOMContentLoaded', function() {
    atualizarRelogio();
    setInterval(atualizarRelogio, 1000);
    configurarNavegacao();
    configurarMenuToggle();
    configurarFecharModalExterno();
    carregarDashboard();
    console.log('🚀 Sistema de Questionários inicializado!');
});

function atualizarRelogio() {
    const el = document.getElementById('datetime');
    if (el) {
        el.textContent = new Date().toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });
    }
}

function configurarNavegacao() {
    document.querySelectorAll('.sidebar-menu li').forEach(item => {
        item.addEventListener('click', function() {
            const page = this.dataset.page;
            if (page) navegarPara(page);
        });
    });
}

function navegarPara(page) {
    document.querySelectorAll('.sidebar-menu li').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    const titles = {
        'dashboard': 'Dashboard',
        'perguntas': 'Gerenciar Perguntas',
        'formularios': 'Gerenciar Formulários',
        'respostas': 'Listar Respostas'
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = titles[page] || page;

    paginaAtual = page;
    const paginas = {
        'dashboard': carregarDashboard,
        'perguntas': carregarPaginaPerguntas,
        'formularios': carregarPaginaFormularios,
        'respostas': carregarPaginaRespostas
    };
    if (paginas[page]) {
        paginas[page]();
    }

    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('open');
    }
}

function configurarMenuToggle() {
    const toggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (toggle) {
        toggle.addEventListener('click', function(e) {
            e.stopPropagation();
            if (sidebar) sidebar.classList.toggle('open');
        });
    }

    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) && toggle && !toggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });
}

function configurarFecharModalExterno() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });
}

function abrirModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function fecharModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        try {
            document.dispatchEvent(new CustomEvent('modalClosed', { detail: { id } }));
        } catch (e) {}
    }
}

function mostrarLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        if (show) {
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    }
}

async function carregarDashboard() {
    const container = document.getElementById('contentArea');
    if (!container) return;

    mostrarLoading(true);
    try {
        const [perguntas, formularios, respostas] = await Promise.all([
            apiPerguntas.listar(),
            apiFormularios.listar(),
            apiRespostas.listar()
        ]);

        const totalPerguntas = perguntas.length;
        const totalFormularios = formularios.length;
        const totalRespostas = respostas.length;
        const formulariosAtivos = formularios.filter(f => f.status === 'publicado').length;

        dadosDashboard = { totalPerguntas, totalFormularios, totalRespostas, formulariosAtivos };

        container.innerHTML = `
            <div class="stats-grid">
                ${[
                    { icon: 'question-circle', color: 'blue', value: totalPerguntas, label: 'Perguntas Cadastradas' },
                    { icon: 'file-alt', color: 'green', value: totalFormularios, label: 'Formulários Criados' },
                    { icon: 'reply-all', color: 'yellow', value: totalRespostas, label: 'Respostas Recebidas' },
                    { icon: 'rocket', color: 'red', value: formulariosAtivos, label: 'Formulários Ativos' }
                ].map(s => `
                    <div class="stat-card">
                        <div class="stat-icon ${s.color}"><i class="fas fa-${s.icon}"></i></div>
                        <div class="stat-info">
                            <h4>${s.value}</h4>
                            <p>${s.label}</p>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="section-header">
                <h3>📋 Últimos Formulários</h3>
                <button class="btn btn-primary" onclick="navegarPara('formularios')">
                    <i class="fas fa-plus"></i> Ver Todos
                </button>
            </div>
            ${renderizarUltimosFormularios(formularios)}

            <div class="section-header" style="margin-top: 32px;">
                <h3>📨 Últimas Respostas</h3>
                <button class="btn btn-primary" onclick="navegarPara('respostas')">
                    <i class="fas fa-list"></i> Ver Todas
                </button>
            </div>
            ${renderizarUltimasRespostas(respostas, formularios)}
        `;

    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i>
                <h4>Erro ao carregar dashboard</h4>
                <p>${error.message}</p>
                <button class="btn btn-primary" onclick="carregarDashboard()">
                    <i class="fas fa-sync"></i> Tentar Novamente
                </button>
            </div>
        `;
    } finally {
        mostrarLoading(false);
    }
}

function renderizarUltimosFormularios(formularios) {
    const recentes = formularios.slice(-5).reverse();
    if (!recentes.length) {
        return '<div class="empty-state" style="padding: 20px;"><p>Nenhum formulário criado ainda.</p></div>';
    }

    const statusLabels = { 'rascunho': 'Rascunho', 'publicado': 'Publicado', 'encerrado': 'Encerrado' };
    
    return `
        <div class="table-container">
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Título</th>
                            <th>Status</th>
                            <th>Perguntas</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${recentes.map(f => `
                            <tr>
                                <td><strong>${f.titulo || 'Sem título'}</strong></td>
                                <td><span class="status-badge ${f.status || 'rascunho'}">${statusLabels[f.status] || f.status}</span></td>
                                <td>${f.perguntas?.length || 0}</td>
                                <td>
                                    <button class="btn btn-success btn-sm" onclick="responderFormulario('${f.id}')" title="Responder">
                                        <i class="fas fa-pen"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderizarUltimasRespostas(respostas, formularios) {
    const recentes = respostas.slice(-5).reverse();
    if (!recentes.length) {
        return '<div class="empty-state" style="padding: 20px;"><p>Nenhuma resposta recebida ainda.</p></div>';
    }

    return `
        <div class="table-container">
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Respondente</th>
                            <th>Formulário</th>
                            <th>Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${recentes.map(r => {
                            const f = formularios.find(f => f.id === r.formularioId);
                            return `
                                <tr>
                                    <td>
                                        <strong>${r.nome || 'Anônimo'}</strong>
                                        <br>
                                        <span style="font-size: 12px; color: var(--gray-500);">${r.email || ''}</span>
                                    </td>
                                    <td>${f ? f.titulo : 'Formulário removido'}</td>
                                    <td>${r.enviadoEm ? formatarData(r.enviadoEm) : '—'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function carregarPaginaPerguntas() {
    const container = document.getElementById('contentArea');
    if (!container) return;
    
    container.innerHTML = `
        <div class="section-header">
            <h3><i class="fas fa-question-circle"></i> Gerenciar Perguntas</h3>
            <div>
                <button class="btn btn-primary" onclick="novaPergunta()">
                    <i class="fas fa-plus"></i> Nova Pergunta
                </button>
                <button class="btn btn-secondary" onclick="carregarPerguntas()">
                    <i class="fas fa-sync"></i> Atualizar
                </button>
            </div>
        </div>
        <div id="perguntasContainer"></div>
    `;
    await carregarPerguntas();
}

async function carregarPaginaFormularios() {
    const container = document.getElementById('contentArea');
    if (!container) return;
    
    container.innerHTML = `
        <div class="section-header">
            <h3><i class="fas fa-file-alt"></i> Gerenciar Formulários</h3>
            <div>
                <button class="btn btn-primary" onclick="novoFormulario()">
                    <i class="fas fa-plus"></i> Novo Formulário
                </button>
                <button class="btn btn-secondary" onclick="carregarFormularios()">
                    <i class="fas fa-sync"></i> Atualizar
                </button>
            </div>
        </div>
        <div id="formulariosContainer"></div>
    `;
    await carregarFormularios();
}

async function carregarPaginaRespostas() {
    const container = document.getElementById('contentArea');
    if (!container) return;
    
    container.innerHTML = `
        <div class="section-header">
            <h3><i class="fas fa-reply-all"></i> Listar Respostas</h3>
            <button class="btn btn-secondary" onclick="carregarRespostas()">
                <i class="fas fa-sync"></i> Atualizar
            </button>
        </div>
        <div id="respostasContainer"></div>
    `;
    await carregarRespostas();
}

async function novoFormulario() {
    const form = document.getElementById('formFormulario');
    if (form) form.reset();
    
    const idField = document.getElementById('formularioId');
    if (idField) idField.value = '';
    
    const titleField = document.getElementById('modalFormularioTitle');
    if (titleField) titleField.textContent = 'Novo Formulário';
    
    await carregarPerguntasChecklist([]);
    
    const now = new Date();
    const inicio = new Date(now);
    inicio.setDate(now.getDate() + 1);
    const fim = new Date(now);
    fim.setDate(now.getDate() + 30);
    
    const dataInicioField = document.getElementById('dataInicio');
    const dataFimField = document.getElementById('dataFim');
    if (dataInicioField) dataInicioField.value = formatarDatetimeLocal(inicio);
    if (dataFimField) dataFimField.value = formatarDatetimeLocal(fim);
    
    abrirModal('modalFormulario');
}

async function responderFormulario(id) {
    try {
        const formulario = await apiFormularios.buscar(id);
        if (!formulario) {
            throw new Error('Formulário não encontrado');
        }

        if (formulario.status !== 'publicado') {
            Swal.fire({ icon: 'warning', title: 'Indisponível', text: 'Este formulário não está publicado.' });
            return;
        }

        if (formulario.dataInicio && new Date() < new Date(formulario.dataInicio)) {
            Swal.fire({ icon: 'warning', title: 'Indisponível', text: 'Este formulário ainda não está disponível para resposta.' });
            return;
        }

        if (formulario.dataFim && new Date() > new Date(formulario.dataFim)) {
            Swal.fire({ icon: 'warning', title: 'Indisponível', text: 'Este formulário está encerrado.' });
            return;
        }

        const perguntas = await Promise.all((formulario.perguntas || []).map(id => apiPerguntas.buscar(id)));

        const formularioIdField = document.getElementById('responderFormularioId');
        if (formularioIdField) formularioIdField.value = formulario.id;
        
        const titleField = document.getElementById('modalResponderTitle');
        if (titleField) titleField.textContent = `Responder: ${formulario.titulo}`;
        
        const nomeField = document.getElementById('responderNome');
        const emailField = document.getElementById('responderEmail');
        if (nomeField) nomeField.value = '';
        if (emailField) emailField.value = '';

        const container = document.getElementById('perguntasResponder');
        if (!container) return;
        
        container.innerHTML = perguntas.map((p, idx) => {
            if (!p) return '';
            const obrigatorio = p.obrigatoria ? '<span class="obrigatorio-tag">* Obrigatória</span>' : '';
            let inputHtml = '';

            switch(p.tipo) {
                case 'multipla_escolha':
                    inputHtml = `<div class="opcoes">${p.alternativas.map((alt, i) => `
                        <div class="opcao">
                            <input type="radio" name="pergunta_${p.id}" value="${alt}" id="pergunta_${p.id}_${i}">
                            <label for="pergunta_${p.id}_${i}">${alt}</label>
                        </div>
                    `).join('')}</div>`;
                    break;
                case 'checkbox':
                    inputHtml = `<div class="opcoes">${p.alternativas.map((alt, i) => `
                        <div class="opcao">
                            <input type="checkbox" name="pergunta_${p.id}" value="${alt}" id="pergunta_${p.id}_${i}">
                            <label for="pergunta_${p.id}_${i}">${alt}</label>
                        </div>
                    `).join('')}</div>`;
                    break;
                case 'texto_curto':
                    inputHtml = `<input type="text" name="pergunta_${p.id}" maxlength="200" placeholder="Digite sua resposta...">`;
                    break;
                case 'texto_longo':
                    inputHtml = `<textarea name="pergunta_${p.id}" rows="3" placeholder="Digite sua resposta..."></textarea>`;
                    break;
                default:
                    inputHtml = `<p style="color: var(--danger);">Tipo não suportado</p>`;
            }

            return `
                <div class="pergunta-responder">
                    <div class="enunciado">${idx+1}. ${p.enunciado} ${obrigatorio}</div>
                    ${inputHtml}
                </div>
            `;
        }).join('');

        abrirModal('modalResponder');
    } catch (error) {
        console.error('Erro ao responder formulário:', error);
        Swal.fire({ icon: 'error', title: 'Erro!', text: error.message });
    }
}

async function verRespostasFormulario(id) {
    try {
        const formulario = await apiFormularios.buscar(id);
        const respostas = await apiRespostas.buscarPorFormulario(id);
        
        if (!respostas || respostas.length === 0) {
            Swal.fire({ icon: 'info', title: 'Nenhuma resposta', text: `"${formulario.titulo}" ainda não possui respostas.` });
            return;
        }

        navegarPara('respostas');
        setTimeout(() => carregarRespostas(id), 300);
    } catch (error) {
        console.error('Erro ao ver respostas:', error);
        Swal.fire({ icon: 'error', title: 'Erro!', text: error.message });
    }
}

function formatarData(dataStr) {
    if (!dataStr) return '—';
    try {
        return new Date(dataStr).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch {
        return dataStr;
    }
}

function formatarDatetimeLocal(date) {
    if (!date) return '';
    try {
        return date.toISOString().slice(0, 16);
    } catch {
        return '';
    }
}

function escaparHTML(texto) {
    if (!texto) return '';
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

function atualizarDashboard() {
    if (paginaAtual === 'dashboard') {
        carregarDashboard();
    }
}

window.navegarPara = navegarPara;
window.novaPergunta = novaPergunta;
window.editarPergunta = editarPergunta;
window.excluirPergunta = excluirPergunta;
window.novoFormulario = novoFormulario;
window.editarFormulario = editarFormulario;
window.excluirFormulario = excluirFormulario;
window.responderFormulario = responderFormulario;
window.verRespostasFormulario = verRespostasFormulario;
window.carregarPerguntas = carregarPerguntas;
window.carregarFormularios = carregarFormularios;
window.carregarRespostas = carregarRespostas;
window.carregarDashboard = carregarDashboard;
window.abrirModal = abrirModal;
window.fecharModal = fecharModal;
window.mostrarLoading = mostrarLoading;
window.adicionarAlternativa = adicionarAlternativa;
window.removerAlternativa = removerAlternativa;
window.formatarData = formatarData;
window.formatarDatetimeLocal = formatarDatetimeLocal;
window.escaparHTML = escaparHTML;
window.atualizarDashboard = atualizarDashboard;