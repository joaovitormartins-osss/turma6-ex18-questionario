let perguntasCache = [];

function validarPergunta(dados) {
    const erros = [];

    if (!dados.enunciado || dados.enunciado.trim() === '') {
        erros.push('O enunciado da pergunta é obrigatório.');
    }

    const tiposValidos = ['multipla_escolha', 'texto_curto', 'texto_longo', 'checkbox'];
    if (!tiposValidos.includes(dados.tipo)) {
        erros.push('Tipo de pergunta inválido.');
    }

    if (dados.tipo === 'multipla_escolha' || dados.tipo === 'checkbox') {
        const alternativas = dados.alternativas || [];
        const alternativasFiltradas = alternativas.filter(a => a && a.trim() !== '');
        
        if (dados.tipo === 'multipla_escolha') {
            if (alternativasFiltradas.length < 2) erros.push('Múltipla Escolha: mínimo de 2 alternativas.');
            if (alternativasFiltradas.length > 10) erros.push('Múltipla Escolha: máximo de 10 alternativas.');
        } else {
            if (alternativasFiltradas.length < 3) erros.push('Checkbox: mínimo de 3 alternativas.');
            if (alternativasFiltradas.length > 15) erros.push('Checkbox: máximo de 15 alternativas.');
        }

        if (alternativas.some(a => a.trim() === '')) {
            erros.push('Alternativas não podem estar vazias.');
        }

        const alternativasNormalizadas = alternativasFiltradas.map(a => a.trim().toLowerCase());
        const duplicadas = alternativasNormalizadas.filter((a, i) => alternativasNormalizadas.indexOf(a) !== i);
        if (duplicadas.length > 0) {
            erros.push('Alternativas duplicadas: ' + [...new Set(duplicadas)].join(', '));
        }
    }

    return erros;
}

function renderizarPerguntas(perguntas) {
    const container = document.getElementById('perguntasContainer');
    if (!container) return;

    if (!perguntas || perguntas.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-question-circle"></i>
                <h4>Nenhuma pergunta cadastrada</h4>
                <p>Clique em "Nova Pergunta" para começar.</p>
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

    let html = `
        <div class="table-container">
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Enunciado</th>
                            <th>Tipo</th>
                            <th>Obrigatória</th>
                            <th>Alternativas</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    perguntas.forEach(p => {
        const alternativasStr = p.alternativas?.length > 0 ? p.alternativas.join(', ') : '-';
        html += `
            <tr>
                <td><strong>${p.enunciado || 'Sem enunciado'}</strong></td>
                <td><span class="status-badge rascunho">${tipoLabels[p.tipo] || p.tipo}</span></td>
                <td>${p.obrigatoria ? '✅ Sim' : '❌ Não'}</td>
                <td style="max-width: 200px; font-size: 12px; word-break: break-word;">${alternativasStr}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="editarPergunta('${p.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="excluirPergunta('${p.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div></div>`;
    container.innerHTML = html;
}

async function carregarPerguntas() {
    mostrarLoading(true);
    try {
        perguntasCache = await apiPerguntas.listar();
        renderizarPerguntas(perguntasCache);
        return perguntasCache;
    } catch (error) {
        console.error('Erro ao carregar perguntas:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: 'Não foi possível carregar as perguntas: ' + error.message,
            confirmButtonColor: '#4F46E5'
        });
        return [];
    } finally {
        mostrarLoading(false);
    }
}

async function salvarPergunta(event) {
    event.preventDefault();
    
    const id = document.getElementById('perguntaId').value;
    const enunciado = document.getElementById('enunciado').value.trim();
    const tipo = document.getElementById('tipoPergunta').value;
    const obrigatoria = document.getElementById('obrigatoria').checked;
    
    const altInputs = document.querySelectorAll('.alternativa-input');
    const alternativas = Array.from(altInputs).map(input => input.value.trim());

    const dados = { enunciado, tipo, obrigatoria, alternativas };

    const erros = validarPergunta(dados);
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
            const temRespostas = await verificarRespostasPorPergunta(id);
            if (temRespostas) {
                const perguntaOriginal = perguntasCache.find(p => p.id === id);
                if (perguntaOriginal) {
                    const tipoMudou = perguntaOriginal.tipo !== tipo;
                    const alternativasMudaram = JSON.stringify(perguntaOriginal.alternativas) !== JSON.stringify(alternativas);
                    
                    if (tipoMudou || alternativasMudaram) {
                        const confirm = await Swal.fire({
                            icon: 'warning',
                            title: 'Atenção!',
                            text: 'Esta pergunta já possui respostas. Alterar tipo ou alternativas pode invalidar as respostas existentes. Deseja continuar?',
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
            await apiPerguntas.atualizar(id, dados);
            Swal.fire({
                icon: 'success',
                title: 'Atualizado!',
                text: 'Pergunta atualizada com sucesso.',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            await apiPerguntas.criar(dados);
            Swal.fire({
                icon: 'success',
                title: 'Criada!',
                text: 'Pergunta criada com sucesso.',
                timer: 2000,
                showConfirmButton: false
            });
        }

        fecharModal('modalPergunta');
        document.getElementById('formPergunta').reset();
        document.getElementById('perguntaId').value = '';
        await carregarPerguntas();

    } catch (error) {
        console.error('Erro ao salvar pergunta:', error);
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

async function editarPergunta(id) {
    try {
        const pergunta = perguntasCache.find(p => p.id === id);
        if (!pergunta) {
            Swal.fire({
                icon: 'error',
                title: 'Erro!',
                text: 'Pergunta não encontrada.',
                confirmButtonColor: '#4F46E5'
            });
            return;
        }

        const temRespostas = await verificarRespostasPorPergunta(id);
        if (temRespostas) {
            const confirm = await Swal.fire({
                icon: 'info',
                title: 'Atenção!',
                text: 'Esta pergunta já possui respostas. Algumas alterações podem ser restritas.',
                confirmButtonText: 'Entendi, continuar',
                confirmButtonColor: '#4F46E5'
            });
            if (!confirm.isConfirmed) return;
        }

        document.getElementById('perguntaId').value = pergunta.id;
        document.getElementById('enunciado').value = pergunta.enunciado;
        document.getElementById('tipoPergunta').value = pergunta.tipo;
        document.getElementById('obrigatoria').checked = pergunta.obrigatoria;

        const container = document.getElementById('alternativasContainer');
        container.innerHTML = '';
        
        if (pergunta.alternativas?.length > 0) {
            pergunta.alternativas.forEach((alt, index) => {
                const row = document.createElement('div');
                row.className = 'alternativa-row';
                row.innerHTML = `
                    <input type="text" class="alternativa-input" value="${alt}" placeholder="Alternativa ${index + 1}">
                    <button type="button" class="btn-remove-alt" onclick="removerAlternativa(this)">×</button>
                `;
                container.appendChild(row);
            });
        } else {
            for (let i = 0; i < 2; i++) {
                const row = document.createElement('div');
                row.className = 'alternativa-row';
                row.innerHTML = `
                    <input type="text" class="alternativa-input" placeholder="Alternativa ${i + 1}">
                    <button type="button" class="btn-remove-alt" onclick="removerAlternativa(this)">×</button>
                `;
                container.appendChild(row);
            }
        }

        atualizarHelperAlternativas();
        document.getElementById('modalPerguntaTitle').textContent = 'Editar Pergunta';
        abrirModal('modalPergunta');

    } catch (error) {
        console.error('Erro ao editar pergunta:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: error.message,
            confirmButtonColor: '#4F46E5'
        });
    }
}

async function excluirPergunta(id) {
    const pergunta = perguntasCache.find(p => p.id === id);
    if (!pergunta) {
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: 'Pergunta não encontrada.',
            confirmButtonColor: '#4F46E5'
        });
        return;
    }

    const temRespostas = await verificarRespostasPorPergunta(id);
    if (temRespostas) {
        Swal.fire({
            icon: 'warning',
            title: 'Não é possível excluir',
            text: 'Esta pergunta já possui respostas vinculadas e não pode ser excluída.',
            confirmButtonColor: '#4F46E5'
        });
        return;
    }

    try {
        const formularios = await apiFormularios.listar();
        const emUso = formularios.some(f => f.perguntas?.includes(id));
        if (emUso) {
            Swal.fire({
                icon: 'warning',
                title: 'Pergunta em uso',
                text: 'Esta pergunta está sendo usada em um formulário. Remova-a do formulário antes de excluir.',
                confirmButtonColor: '#4F46E5'
            });
            return;
        }
    } catch (error) {
        console.error('Erro ao verificar uso:', error);
    }

    const confirm = await Swal.fire({
        icon: 'question',
        title: 'Confirmar exclusão',
        text: `Tem certeza que deseja excluir a pergunta "${pergunta.enunciado}"?`,
        showCancelButton: true,
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#6B7280'
    });

    if (!confirm.isConfirmed) return;

    mostrarLoading(true);
    try {
        await apiPerguntas.excluir(id);
        Swal.fire({
            icon: 'success',
            title: 'Excluída!',
            text: 'Pergunta excluída com sucesso.',
            timer: 2000,
            showConfirmButton: false
        });
        await carregarPerguntas();
    } catch (error) {
        console.error('Erro ao excluir pergunta:', error);
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

function adicionarAlternativa() {
    const container = document.getElementById('alternativasContainer');
    const rows = container.querySelectorAll('.alternativa-row');
    const index = rows.length + 1;
    
    const row = document.createElement('div');
    row.className = 'alternativa-row';
    row.innerHTML = `
        <input type="text" class="alternativa-input" placeholder="Alternativa ${index}">
        <button type="button" class="btn-remove-alt" onclick="removerAlternativa(this)">×</button>
    `;
    container.appendChild(row);
    atualizarHelperAlternativas();
}

function removerAlternativa(btn) {
    const container = document.getElementById('alternativasContainer');
    const rows = container.querySelectorAll('.alternativa-row');
    
    if (rows.length <= 2) {
        Swal.fire({
            icon: 'warning',
            title: 'Mínimo de alternativas',
            text: 'É necessário manter pelo menos 2 alternativas.',
            confirmButtonColor: '#4F46E5'
        });
        return;
    }
    
    btn.closest('.alternativa-row').remove();
    const remainingRows = container.querySelectorAll('.alternativa-row');
    remainingRows.forEach((row, index) => {
        const input = row.querySelector('.alternativa-input');
        input.placeholder = `Alternativa ${index + 1}`;
    });
    atualizarHelperAlternativas();
}

function atualizarHelperAlternativas() {
    const tipo = document.getElementById('tipoPergunta').value;
    const helper = document.getElementById('altHelper');
    const rows = document.querySelectorAll('#alternativasContainer .alternativa-row');
    const count = rows.length;
    const grupo = document.getElementById('alternativasGroup');
    
    if (tipo === 'multipla_escolha') {
        helper.textContent = `Mín: 2 | Máx: 10 | Atual: ${count}`;
        if (grupo) grupo.style.display = 'block';
    } else if (tipo === 'checkbox') {
        helper.textContent = `Mín: 3 | Máx: 15 | Atual: ${count}`;
        if (grupo) grupo.style.display = 'block';
    } else {
        helper.textContent = '';
        if (grupo) grupo.style.display = 'none';
    }
}

function novaPergunta() {
    document.getElementById('formPergunta').reset();
    document.getElementById('perguntaId').value = '';
    document.getElementById('modalPerguntaTitle').textContent = 'Nova Pergunta';
    
    const container = document.getElementById('alternativasContainer');
    container.innerHTML = '';
    for (let i = 0; i < 2; i++) {
        const row = document.createElement('div');
        row.className = 'alternativa-row';
        row.innerHTML = `
            <input type="text" class="alternativa-input" placeholder="Alternativa ${i + 1}">
            <button type="button" class="btn-remove-alt" onclick="removerAlternativa(this)">×</button>
        `;
        container.appendChild(row);
    }
    
    const tipoSelect = document.getElementById('tipoPergunta');
    tipoSelect.value = 'multipla_escolha';
    tipoSelect.dispatchEvent(new Event('change'));
    
    abrirModal('modalPergunta');
}

document.addEventListener('DOMContentLoaded', function() {
    const formPergunta = document.getElementById('formPergunta');
    if (formPergunta) {
        formPergunta.addEventListener('submit', salvarPergunta);
    }

    const tipoSelect = document.getElementById('tipoPergunta');
    if (tipoSelect) {
        tipoSelect.addEventListener('change', function() {
            const grupo = document.getElementById('alternativasGroup');
            if (this.value === 'multipla_escolha' || this.value === 'checkbox') {
                if (grupo) grupo.style.display = 'block';
                atualizarHelperAlternativas();
            } else {
                if (grupo) grupo.style.display = 'none';
            }
        });
        tipoSelect.dispatchEvent(new Event('change'));
    }
});

window.carregarPerguntas = carregarPerguntas;
window.editarPergunta = editarPergunta;
window.excluirPergunta = excluirPergunta;
window.novaPergunta = novaPergunta;
window.adicionarAlternativa = adicionarAlternativa;
window.removerAlternativa = removerAlternativa;
window.salvarPergunta = salvarPergunta;



