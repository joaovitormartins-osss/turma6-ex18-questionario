// ============================================
// MÓDULO RESPOSTAS - CRUD e Validações
// ============================================

let respostasCache = [];

function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email.trim());
}

function validarResposta(dados) {
    const erros = [];

    if (!dados.nome || dados.nome.trim().length < 2) {
        erros.push('Nome é obrigatório e deve ter pelo menos 2 caracteres.');
    }

    if (!dados.email || !validarEmail(dados.email)) {
        erros.push('E-mail é obrigatório e deve ser válido.');
    }

    return erros;
}

function renderizarRespostas(respostas, formularios, filtroFormularioId = null) {
    const container = document.getElementById('respostasContainer');
    if (!container) return;

    let dadosExibir = respostas;
    if (filtroFormularioId) {
        dadosExibir = respostas.filter(r => r.formularioId === filtroFormularioId);
    }

    if (!dadosExibir || dadosExibir.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-reply-all"></i>
                <h4>Nenhuma resposta encontrada</h4>
                <p>${filtroFormularioId ? 'Este formulário ainda não possui respostas.' : 'Nenhuma resposta foi registrada ainda.'}</p>
                ${filtroFormularioId ? `<button class="btn btn-primary" onclick="carregarRespostas()">Ver todas</button>` : ''}
            </div>
        `;
        return;
    }

    let html = `
        <div style="margin-bottom: 16px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
            <span style="font-size: 14px; color: var(--gray-500);">
                Total: <strong>${dadosExibir.length}</strong> resposta(s)
            </span>
            ${filtroFormularioId ? `
                <button class="btn btn-secondary btn-sm" onclick="carregarRespostas()">
                    <i class="fas fa-times"></i> Limpar filtro
                </button>
            ` : ''}
        </div>
        <div class="table-container">
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Respondente</th>
                            <th>E-mail</th>
                            <th>Formulário</th>
                            <th>Enviado em</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    dadosExibir.forEach(r => {
        const formulario = formularios.find(f => f.id === r.formularioId);
        const nomeFormulario = formulario ? formulario.titulo : 'Formulário removido';
        const data = r.enviadoEm ? formatarData(r.enviadoEm) : '—';

        // CONVERTER ID PARA STRING PARA GARANTIR COMPARAÇÃO
        const respostaId = String(r.id);

        html += `
            <tr>
                <td><strong>${r.nome || 'Anônimo'}</strong></td>
                <td>${r.email || '—'}</td>
                <td>${nomeFormulario}</td>
                <td>${data}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="visualizarResposta('${respostaId}')" title="Ver detalhes">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="excluirResposta('${respostaId}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div></div>`;
    container.innerHTML = html;
}

// ========== CARREGAR RESPOSTAS ==========
async function carregarRespostas(filtroFormularioId = null) {
    mostrarLoading(true);
    try {
        const [respostas, formularios] = await Promise.all([
            apiRespostas.listar(),
            apiFormularios.listar()
        ]);

        // ATUALIZAR O CACHE COM OS DADOS RECEBIDOS
        respostasCache = respostas;
        console.log('📦 Cache atualizado com:', respostasCache.length, 'respostas');
        
        renderizarRespostas(respostas, formularios, filtroFormularioId);

        if (typeof paginaAtual !== 'undefined' && paginaAtual === 'dashboard') {
            if (typeof atualizarDashboard === 'function') {
                atualizarDashboard();
            }
        }

        return { respostas, formularios };

    } catch (error) {
        console.error('Erro ao carregar respostas:', error);
        const container = document.getElementById('respostasContainer');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i>
                    <h4>Erro ao carregar respostas</h4>
                    <p>${error.message}</p>
                    <button class="btn btn-primary" onclick="carregarRespostas()">
                        <i class="fas fa-sync"></i> Tentar Novamente
                    </button>
                </div>
            `;
        }
        return { respostas: [], formularios: [] };
    } finally {
        mostrarLoading(false);
    }
}

// ========== VISUALIZAR RESPOSTA ==========
async function visualizarResposta(id) {
    try {
        // CONVERTER ID PARA STRING
        const respostaId = String(id);
        const resposta = await apiRespostas.buscar(respostaId);
        
        if (!resposta) {
            Swal.fire({
                icon: 'error',
                title: 'Erro!',
                text: 'Resposta não encontrada.',
                confirmButtonColor: '#4F46E5'
            });
            return;
        }

        const perguntas = await apiPerguntas.listar();
        const formulario = await apiFormularios.buscar(resposta.formularioId);

        let html = `
            <div style="margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--gray-200);">
                <p><strong>Formulário:</strong> ${formulario ? formulario.titulo : 'Não encontrado'}</p>
                <p><strong>Respondente:</strong> ${resposta.nome}</p>
                <p><strong>E-mail:</strong> ${resposta.email}</p>
                <p><strong>Enviado em:</strong> ${resposta.enviadoEm ? formatarData(resposta.enviadoEm) : '—'}</p>
            </div>
            <h4 style="margin-bottom: 12px;">Respostas:</h4>
        `;

        if (resposta.respostas && resposta.respostas.length > 0) {
            resposta.respostas.forEach(resp => {
                const pergunta = perguntas.find(p => p.id === resp.perguntaId);
                const enunciado = pergunta ? pergunta.enunciado : `Pergunta ${resp.perguntaId}`;
                let valor = resp.valor;
                
                if (Array.isArray(valor)) {
                    valor = valor.join(', ');
                } else if (!valor || valor === '') {
                    valor = '—';
                }

                html += `
                    <div class="resposta-detalhe">
                        <strong>${enunciado}</strong>
                        <div class="valor">${valor}</div>
                    </div>
                `;
            });
        } else {
            html += `<p style="color: var(--gray-500);">Nenhuma resposta detalhada disponível.</p>`;
        }

        document.getElementById('visualizarRespostaBody').innerHTML = html;
        abrirModal('modalVisualizarResposta');

    } catch (error) {
        console.error('Erro ao visualizar resposta:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: error.message,
            confirmButtonColor: '#4F46E5'
        });
    }
}

// ========== EXCLUIR RESPOSTA - CORRIGIDA ==========
async function excluirResposta(id) {
    // CONVERTER ID PARA STRING PARA GARANTIR COMPARAÇÃO
    const respostaId = String(id);
    console.log('🔴 Tentando excluir resposta ID:', respostaId);
    console.log('📦 Cache atual:', respostasCache);
    
    try {
        // Buscar a resposta no cache COMPARANDO COMO STRING
        const resposta = respostasCache.find(r => String(r.id) === respostaId);
        
        if (!resposta) {
            console.error('❌ Resposta não encontrada no cache');
            console.log('🔍 IDs no cache:', respostasCache.map(r => String(r.id)));
            
            // Tentar buscar diretamente da API
            try {
                const respostaApi = await apiRespostas.buscar(respostaId);
                if (respostaApi) {
                    console.log('✅ Resposta encontrada na API, atualizando cache...');
                    // Atualizar o cache com a resposta
                    const index = respostasCache.findIndex(r => String(r.id) === respostaId);
                    if (index !== -1) {
                        respostasCache[index] = respostaApi;
                    } else {
                        respostasCache.push(respostaApi);
                    }
                    // Chamar a função novamente com a resposta encontrada
                    return excluirResposta(respostaId);
                }
            } catch (apiError) {
                console.error('❌ Erro ao buscar resposta na API:', apiError);
            }
            
            Swal.fire({
                icon: 'error',
                title: 'Erro!',
                text: 'Resposta não encontrada.',
                confirmButtonColor: '#4F46E5'
            });
            return;
        }

        console.log('📝 Resposta encontrada:', resposta);

        const confirm = await Swal.fire({
            icon: 'question',
            title: 'Confirmar exclusão',
            text: `Tem certeza que deseja excluir a resposta de "${resposta.nome}"?`,
            showCancelButton: true,
            confirmButtonText: 'Sim, excluir',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#EF4444',
            cancelButtonColor: '#6B7280'
        });

        if (!confirm.isConfirmed) {
            console.log('❌ Exclusão cancelada pelo usuário');
            return;
        }

        console.log('✅ Confirmado, excluindo...');
        mostrarLoading(true);

        const resultado = await apiRespostas.excluir(respostaId);
        console.log('📡 Resultado da API:', resultado);
        
        if (resultado) {
            // Remover do cache local
            respostasCache = respostasCache.filter(r => String(r.id) !== respostaId);
            console.log('🗑️ Removido do cache. Total restante:', respostasCache.length);
            
            // Recarregar a lista
            await carregarRespostas();
            
            Swal.fire({
                icon: 'success',
                title: 'Excluída!',
                text: 'Resposta excluída com sucesso.',
                timer: 2000,
                showConfirmButton: false
            });

            if (typeof paginaAtual !== 'undefined' && paginaAtual === 'dashboard') {
                if (typeof carregarDashboard === 'function') {
                    await carregarDashboard();
                }
            }
        }

    } catch (error) {
        console.error('❌ Erro ao excluir resposta:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro ao excluir!',
            text: error.message || 'Não foi possível excluir a resposta.',
            confirmButtonColor: '#4F46E5'
        });
    } finally {
        mostrarLoading(false);
    }
}

// ========== ENVIAR RESPOSTA ==========
async function enviarResposta(event) {
    event.preventDefault();
    
    const btnEnviar = document.getElementById('btnEnviarResposta');
    if (btnEnviar) {
        btnEnviar.disabled = true;
        btnEnviar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    }
    
    const formularioId = document.getElementById('responderFormularioId').value;
    const nome = document.getElementById('responderNome').value.trim();
    const email = document.getElementById('responderEmail').value.trim();

    const erros = validarResposta({ nome, email });
    if (erros.length > 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Validação',
            html: erros.map(e => `• ${e}`).join('<br>'),
            confirmButtonColor: '#4F46E5'
        });
        if (btnEnviar) {
            btnEnviar.disabled = false;
            btnEnviar.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Respostas';
        }
        return;
    }

    try {
        const duplicado = await verificarDuplicidadeResposta(formularioId, email);
        if (duplicado) {
            Swal.fire({
                icon: 'warning',
                title: 'Resposta duplicada',
                text: `O e-mail "${email}" já respondeu este formulário.`,
                confirmButtonColor: '#4F46E5'
            });
            if (btnEnviar) {
                btnEnviar.disabled = false;
                btnEnviar.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Respostas';
            }
            return;
        }
    } catch (error) {
        console.error('Erro ao verificar duplicidade:', error);
    }

    const perguntaElements = document.querySelectorAll('.pergunta-responder');
    const respostas = [];
    const obrigatoriasFaltando = [];

    for (const el of perguntaElements) {
        const enunciadoEl = el.querySelector('.enunciado');
        const isObrigatoria = enunciadoEl?.textContent?.includes('*') || false;
        
        const input = el.querySelector('input, textarea');
        if (!input) continue;
        
        let perguntaId = '';
        const name = input.getAttribute('name');
        if (name && name.startsWith('pergunta_')) {
            perguntaId = name.replace('pergunta_', '');
        }
        
        if (!perguntaId) continue;

        let valor = null;
        let tipoPergunta = '';

        if (input.type === 'radio') {
            tipoPergunta = 'multipla_escolha';
            const checked = el.querySelector('input[type="radio"]:checked');
            valor = checked ? checked.value : null;
        } else if (input.type === 'checkbox') {
            tipoPergunta = 'checkbox';
            const checked = el.querySelectorAll('input[type="checkbox"]:checked');
            valor = Array.from(checked).map(cb => cb.value);
            if (valor.length === 0) valor = null;
        } else if (input.tagName === 'TEXTAREA') {
            tipoPergunta = 'texto_longo';
            valor = input.value.trim() || null;
        } else if (input.type === 'text') {
            tipoPergunta = 'texto_curto';
            valor = input.value.trim() || null;
        }

        if (tipoPergunta === 'texto_curto' && valor && valor.length > 200) {
            Swal.fire({
                icon: 'warning',
                title: 'Texto muito longo',
                text: 'Resposta deve ter no máximo 200 caracteres.',
                confirmButtonColor: '#4F46E5'
            });
            if (btnEnviar) {
                btnEnviar.disabled = false;
                btnEnviar.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Respostas';
            }
            return;
        }

        if (isObrigatoria && (valor === null || valor === undefined || 
            (Array.isArray(valor) && valor.length === 0) || 
            (typeof valor === 'string' && valor.trim() === ''))) {
            obrigatoriasFaltando.push(perguntaId);
        }

        if (valor !== null && valor !== undefined && 
            !(Array.isArray(valor) && valor.length === 0) &&
            !(typeof valor === 'string' && valor.trim() === '')) {
            respostas.push({
                perguntaId: perguntaId,
                valor: valor
            });
        }
    }

    if (obrigatoriasFaltando.length > 0) {
        try {
            const perguntas = await apiPerguntas.listar();
            const nomesFaltando = obrigatoriasFaltando.map(id => {
                const p = perguntas.find(p => p.id === id);
                return p ? p.enunciado : id;
            });
            
            Swal.fire({
                icon: 'warning',
                title: 'Perguntas obrigatórias',
                html: `As seguintes perguntas são obrigatórias e não foram respondidas:<br><br>${nomesFaltando.map(n => `• ${n}`).join('<br>')}`,
                confirmButtonColor: '#4F46E5'
            });
            if (btnEnviar) {
                btnEnviar.disabled = false;
                btnEnviar.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Respostas';
            }
            return;
        } catch (error) {
            console.error('Erro ao buscar perguntas:', error);
        }
    }

    if (respostas.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Nenhuma resposta',
            text: 'Você precisa responder pelo menos uma pergunta.',
            confirmButtonColor: '#4F46E5'
        });
        if (btnEnviar) {
            btnEnviar.disabled = false;
            btnEnviar.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Respostas';
        }
        return;
    }

    fecharModal('modalResponder');
    await new Promise(resolve => setTimeout(resolve, 300));

    const confirm = await Swal.fire({
        icon: 'question',
        title: 'Confirmar envio',
        text: 'Tem certeza que deseja enviar suas respostas?',
        showCancelButton: true,
        confirmButtonText: 'Sim, enviar',
        cancelButtonText: 'Revisar',
        confirmButtonColor: '#4F46E5',
        cancelButtonColor: '#6B7280'
    });

    if (!confirm.isConfirmed) {
        abrirModal('modalResponder');
        if (btnEnviar) {
            btnEnviar.disabled = false;
            btnEnviar.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Respostas';
        }
        return;
    }

    mostrarLoading(true);
    try {
        const dadosResposta = {
            formularioId: formularioId,
            nome: nome,
            email: email,
            respostas: respostas
        };

        await apiRespostas.criar(dadosResposta);

        await Swal.fire({
            icon: 'success',
            title: 'Enviado!',
            text: 'Suas respostas foram enviadas com sucesso.',
            timer: 3000,
            showConfirmButton: false
        });

        document.getElementById('formResponder').reset();
        document.getElementById('perguntasResponder').innerHTML = '';

        await carregarRespostas();
        if (typeof paginaAtual !== 'undefined' && paginaAtual === 'dashboard') {
            if (typeof carregarDashboard === 'function') {
                await carregarDashboard();
            }
        }

    } catch (error) {
        console.error('Erro ao enviar resposta:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: error.message || 'Não foi possível enviar sua resposta.',
            confirmButtonColor: '#4F46E5'
        });
        abrirModal('modalResponder');
    } finally {
        mostrarLoading(false);
        if (btnEnviar) {
            btnEnviar.disabled = false;
            btnEnviar.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Respostas';
        }
    }
}

// ========== EVENTOS ==========
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('formResponder');
    if (form) {
        form.addEventListener('submit', enviarResposta);
    }
});

// ========== EXPOR FUNÇÕES GLOBAIS ==========
window.carregarRespostas = carregarRespostas;
window.visualizarResposta = visualizarResposta;
window.excluirResposta = excluirResposta;
window.enviarResposta = enviarResposta;