let formulariosCache = [];

function validarFormulario(dados) {
    const erros = [];

    if (!dados.titulo || dados.titulo.trim() === '') {
        erros.push('O título do formulário é obrigatório.');
    }

    if (!dados.perguntas || dados.perguntas.length === 0) {
        erros.push('O formulário deve conter pelo menos 1 pergunta.');
    }

    return erros;
}

function renderizarFormularios(formularios) {
    const container = document.getElementById('formulariosContainer');
    if (!container) return;

    if (!formularios || formularios.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-file-alt"></i>
                <h4>Nenhum formulário cadastrado</h4>
                <p>Clique em "Novo Formulário" para começar.</p>
            </div>
        `;
        return;
    }

    const statusLabels = {
        'rascunho': 'Rascunho',
        'publicado': 'Publicado',
        'encerrado': 'Encerrado'
    };

    let html = `
        <div class="table-container">
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Título</th>
                            <th>Status</th>
                            <th>Vigência</th>
                            <th>Perguntas</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    formularios.forEach(f => {
        const statusClass = f.status || 'rascunho';
        const vigencia = f.dataInicio && f.dataFim
            ? `${formatarData(f.dataInicio)} a ${formatarData(f.dataFim)}`
            : 'Sem período definido';
        const qtdPerguntas = f.perguntas?.length || 0;

        html += `
            <tr>
                <td>
                    <strong>${f.titulo || 'Sem título'}</strong>
                    ${f.descricao ? `<br><span style="font-size: 12px; color: var(--gray-500);">${f.descricao}</span>` : ''}
                </td>
                <td><span class="status-badge ${statusClass}">${statusLabels[statusClass] || statusClass}</span></td>
                <td style="font-size: 12px;">${vigencia}</td>
                <td>${qtdPerguntas} pergunta(s)</td>
                <td>
                    <button class="btn btn-success btn-sm" onclick="responderFormulario('${f.id}')" title="Responder">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="editarFormulario('${f.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="excluirFormulario('${f.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn btn-warning btn-sm" onclick="verRespostasFormulario('${f.id}')" title="Ver Respostas">
                        <i class="fas fa-list"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div></div>`;
    container.innerHTML = html;
}

async function carregarPerguntasChecklist(selectedIds = []) {
    try {
        const perguntas = await apiPerguntas.listar();
        const container = document.getElementById('perguntasChecklist');
        if (!container) return;

        if (!perguntas || perguntas.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 20px;">
                    <p>Nenhuma pergunta cadastrada. <a href="#" onclick="novaPergunta(); return false;">Crie uma pergunta</a> primeiro.</p>
                </div>
            `;
            return;
        }

        const tipoLabels = {
            'multipla_escolha': 'Múltipla Escolha',
            'texto_curto': 'Texto Curto',
            'texto_longo': 'Texto Longo',
            'checkbox': 'Checkbox'
        };

        let html = '';
        perguntas.forEach(p => {
            const checked = selectedIds.includes(p.id) ? 'checked' : '';
            html += `
                <div class="pergunta-check-item">
                    <input type="checkbox" id="chk_${p.id}" value="${p.id}" ${checked}>
                    <label for="chk_${p.id}">
                        ${p.enunciado}
                        <span class="tag">${tipoLabels[p.tipo] || p.tipo}</span>
                        ${p.obrigatoria ? '<span class="tag" style="background:#DBEAFE;color:#1E40AF;">Obrigatória</span>' : ''}
                    </label>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error('Erro ao carregar perguntas:', error);
        const container = document.getElementById('perguntasChecklist');
        if (container) {
            container.innerHTML = `<p style="color: var(--danger);">Erro ao carregar perguntas: ${error.message}</p>`;
        }
    }
}

async function carregarFormularios() {
    mostrarLoading(true);
    try {
        formulariosCache = await apiFormularios.listar();
        renderizarFormularios(formulariosCache);
        return formulariosCache;
    } catch (error) {
        console.error('Erro ao carregar formulários:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: 'Não foi possível carregar os formulários: ' + error.message,
            confirmButtonColor: '#4F46E5'
        });
        return [];
    } finally {
        mostrarLoading(false);
    }
}

async function salvarFormulario(event) {
    event.preventDefault();
    
    const id = document.getElementById('formularioId').value;
    const titulo = document.getElementById('titulo').value.trim();
    const descricao = document.getElementById('descricao').value.trim();
    const status = document.getElementById('status').value;
    const dataInicio = document.getElementById('dataInicio').value;
    const dataFim = document.getElementById('dataFim').value;

    const checkboxes = document.querySelectorAll('#perguntasChecklist input[type="checkbox"]:checked');
    const perguntas = Array.from(checkboxes).map(cb => cb.value);

    const dados = { titulo, descricao, status, dataInicio, dataFim, perguntas };

    const erros = validarFormulario(dados);
    if (erros.length > 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Validação',
            html: erros.map(e => `• ${e}`).join('<br>'),
            confirmButtonColor: '#4F46E5'
        });
        return;
    }

    mostrarLoading(true);
    try {
        if (id) {
            const formularioExistente = formulariosCache.find(f => f.id === id);
            if (formularioExistente) {
                const temRespostas = await verificarRespostasPorFormulario(id);
                if (temRespostas && formularioExistente.status === 'publicado') {
                    const perguntasOriginais = formularioExistente.perguntas || [];
                    const perguntasMudaram = JSON.stringify(perguntasOriginais.sort()) !== JSON.stringify(perguntas.sort());
                    
                    if (perguntasMudaram) {
                        const confirm = await Swal.fire({
                            icon: 'warning',
                            title: 'Atenção!',
                            text: 'Este formulário já possui respostas. Alterar as perguntas pode afetar os dados existentes. Deseja continuar?',
                            showCancelButton: true,
                            confirmButtonText: 'Sim, continuar',
                            cancelButtonText: 'Cancelar',
                            confirmButtonColor: '#4F46E5',
                            cancelButtonColor: '#EF4444'
                        });
                        if (!confirm.isConfirmed) {
                            mostrarLoading(false);
                            return;
                        }
                    }
                }
            }

            await apiFormularios.atualizar(id, dados);
            Swal.fire({
                icon: 'success',
                title: 'Atualizado!',
                text: 'Formulário atualizado com sucesso.',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            await apiFormularios.criar(dados);
            Swal.fire({
                icon: 'success',
                title: 'Criado!',
                text: 'Formulário criado com sucesso.',
                timer: 2000,
                showConfirmButton: false
            });
        }

        fecharModal('modalFormulario');
        document.getElementById('formFormulario').reset();
        document.getElementById('formularioId').value = '';
        await carregarFormularios();
        atualizarDashboard();

    } catch (error) {
        console.error('Erro ao salvar formulário:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: error.message,
            confirmButtonColor: '#4F46E5'
        });
    } finally {
        mostrarLoading(false);
    }
}

async function editarFormulario(id) {
    try {
        const formulario = formulariosCache.find(f => f.id === id);
        if (!formulario) {
            Swal.fire({
                icon: 'error',
                title: 'Erro!',
                text: 'Formulário não encontrado.',
                confirmButtonColor: '#4F46E5'
            });
            return;
        }

        const temRespostas = await verificarRespostasPorFormulario(id);
        if (temRespostas && formulario.status === 'publicado') {
            const confirm = await Swal.fire({
                icon: 'info',
                title: 'Atenção!',
                text: 'Este formulário já possui respostas. Edições podem ser limitadas.',
                confirmButtonText: 'Entendi, continuar',
                confirmButtonColor: '#4F46E5'
            });
            if (!confirm.isConfirmed) return;
        }

        document.getElementById('formularioId').value = formulario.id;
        document.getElementById('titulo').value = formulario.titulo || '';
        document.getElementById('descricao').value = formulario.descricao || '';
        document.getElementById('status').value = formulario.status || 'rascunho';
        
        if (formulario.dataInicio) {
            document.getElementById('dataInicio').value = formatarDatetimeLocal(new Date(formulario.dataInicio));
        }
        if (formulario.dataFim) {
            document.getElementById('dataFim').value = formatarDatetimeLocal(new Date(formulario.dataFim));
        }

        await carregarPerguntasChecklist(formulario.perguntas || []);
        document.getElementById('modalFormularioTitle').textContent = 'Editar Formulário';
        abrirModal('modalFormulario');

    } catch (error) {
        console.error('Erro ao editar formulário:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: error.message,
            confirmButtonColor: '#4F46E5'
        });
    }
}

async function excluirFormulario(id) {
    const formulario = formulariosCache.find(f => f.id === id);
    if (!formulario) {
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: 'Formulário não encontrado.',
            confirmButtonColor: '#4F46E5'
        });
        return;
    }

    const temRespostas = await verificarRespostasPorFormulario(id);
    if (temRespostas) {
        Swal.fire({
            icon: 'warning',
            title: 'Não é possível excluir',
            text: 'Este formulário já possui respostas. Altere o status para "encerrado" em vez de excluir.',
            confirmButtonColor: '#4F46E5'
        });
        return;
    }

    const confirm = await Swal.fire({
        icon: 'question',
        title: 'Confirmar exclusão',
        text: `Tem certeza que deseja excluir o formulário "${formulario.titulo}"?`,
        showCancelButton: true,
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#6B7280'
    });

    if (!confirm.isConfirmed) return;

    mostrarLoading(true);
    try {
        await apiFormularios.excluir(id);
        Swal.fire({
            icon: 'success',
            title: 'Excluído!',
            text: 'Formulário excluído com sucesso.',
            timer: 2000,
            showConfirmButton: false
        });
        await carregarFormularios();
        atualizarDashboard();
    } catch (error) {
        console.error('Erro ao excluir formulário:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: error.message,
            confirmButtonColor: '#4F46E5'
        });
    } finally {
        mostrarLoading(false);
    }
}

async function novoFormulario() {
    document.getElementById('formFormulario').reset();
    document.getElementById('formularioId').value = '';
    document.getElementById('modalFormularioTitle').textContent = 'Novo Formulário';
    
    await carregarPerguntasChecklist([]);
    
    const now = new Date();
    const inicio = new Date(now);
    inicio.setDate(now.getDate() + 1);
    const fim = new Date(now);
    fim.setDate(now.getDate() + 30);
    
    document.getElementById('dataInicio').value = formatarDatetimeLocal(inicio);
    document.getElementById('dataFim').value = formatarDatetimeLocal(fim);
    abrirModal('modalFormulario');
}

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('formFormulario');
    if (form) {
        form.addEventListener('submit', salvarFormulario);
    }
});

window.carregarFormularios = carregarFormularios;
window.editarFormulario = editarFormulario;
window.excluirFormulario = excluirFormulario;
window.novoFormulario = novoFormulario;
window.carregarPerguntasChecklist = carregarPerguntasChecklist;
window.salvarFormulario = salvarFormulario;