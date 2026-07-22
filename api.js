const API_BASE = 'http://localhost:3000';

function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
}

async function handleResponse(response) {
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Erro ${response.status}: ${response.statusText}`);
    }
    return response.json();
}

const apiPerguntas = {
    async listar() {
        const response = await fetch(`${API_BASE}/perguntas`, { method: 'GET', headers: getHeaders() });
        return handleResponse(response);
    },
    async buscar(id) {
        const response = await fetch(`${API_BASE}/perguntas/${id}`, { method: 'GET', headers: getHeaders() });
        return handleResponse(response);
    },
    async criar(pergunta) {
        const response = await fetch(`${API_BASE}/perguntas`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ ...pergunta, criadaEm: new Date().toISOString() })
        });
        return handleResponse(response);
    },
    async atualizar(id, pergunta) {
        const response = await fetch(`${API_BASE}/perguntas/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ ...pergunta, criadaEm: pergunta.criadaEm || new Date().toISOString() })
        });
        return handleResponse(response);
    },
    async excluir(id) {
        const response = await fetch(`${API_BASE}/perguntas/${id}`, { method: 'DELETE', headers: getHeaders() });
        if (!response.ok) throw new Error('Erro ao excluir pergunta');
        return true;
    }
};

const apiFormularios = {
    async listar() {
        const response = await fetch(`${API_BASE}/formularios`, { method: 'GET', headers: getHeaders() });
        return handleResponse(response);
    },
    async buscar(id) {
        const response = await fetch(`${API_BASE}/formularios/${id}`, { method: 'GET', headers: getHeaders() });
        return handleResponse(response);
    },
    async criar(formulario) {
        const response = await fetch(`${API_BASE}/formularios`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ ...formulario, criadoEm: new Date().toISOString() })
        });
        return handleResponse(response);
    },
    async atualizar(id, formulario) {
        const response = await fetch(`${API_BASE}/formularios/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ ...formulario, criadoEm: formulario.criadoEm || new Date().toISOString() })
        });
        return handleResponse(response);
    },
    async excluir(id) {
        const response = await fetch(`${API_BASE}/formularios/${id}`, { method: 'DELETE', headers: getHeaders() });
        if (!response.ok) throw new Error('Erro ao excluir formulário');
        return true;
    }
};

const apiRespostas = {
    async listar() {
        const response = await fetch(`${API_BASE}/respostas`, { method: 'GET', headers: getHeaders() });
        return handleResponse(response);
    },
    async buscar(id) {
        const response = await fetch(`${API_BASE}/respostas/${id}`, { method: 'GET', headers: getHeaders() });
        return handleResponse(response);
    },
    async buscarPorFormulario(formularioId) {
        const response = await fetch(`${API_BASE}/respostas?formularioId=${formularioId}`, { method: 'GET', headers: getHeaders() });
        return handleResponse(response);
    },
    async criar(resposta) {
        const response = await fetch(`${API_BASE}/respostas`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ ...resposta, enviadoEm: new Date().toISOString() })
        });
        return handleResponse(response);
    },
    async excluir(id) {
        try {
            console.log('📡 API: Excluindo resposta ID:', id);
            const response = await fetch(`${API_BASE}/respostas/${id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || `Erro ${response.status}: ${response.statusText}`);
            }

            console.log('✅ Resposta excluída com sucesso');
            return true;
        } catch (error) {
            console.error('❌ Erro na API ao excluir:', error);
            throw error;
        }
    }
};

async function verificarDuplicidadeResposta(formularioId, email) {
    try {
        const emailNormalizado = email.trim().toLowerCase();
        const response = await fetch(`${API_BASE}/respostas?formularioId=${formularioId}`, {
            method: 'GET',
            headers: getHeaders()
        });
        const respostas = await handleResponse(response);
        return respostas.some(r => r.email.trim().toLowerCase() === emailNormalizado);
    } catch (error) {
        console.error('Erro ao verificar duplicidade:', error);
        return false;
    }
}

async function verificarRespostasPorPergunta(perguntaId) {
    try {
        const respostas = await apiRespostas.listar();
        return respostas.some(r => r.respostas && r.respostas.some(resp => resp.perguntaId === perguntaId));
    } catch (error) {
        console.error('Erro ao verificar respostas por pergunta:', error);
        return false;
    }
}

async function verificarRespostasPorFormulario(formularioId) {
    try {
        const respostas = await apiRespostas.buscarPorFormulario(formularioId);
        return respostas && respostas.length > 0;
    } catch (error) {
        console.error('Erro ao verificar respostas por formulário:', error);
        return false;
    }
}