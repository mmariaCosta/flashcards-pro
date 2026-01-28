// ===== ONBOARDING MULTI-STEP =====
import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ===== ESTADO =====
let currentStep = 1;
const totalSteps = 8;
const userData = {};

// ===== ELEMENTOS =====
const progressBar = document.getElementById('progressBar');
const btnBack = document.getElementById('btnBack');
const loading = document.getElementById('loading');

// ===== INICIALIZAÇÃO =====
updateProgress();

btnBack.addEventListener('click', () => {
  if (currentStep > 1) {
    previousStep();
  }
});

// ===== NAVEGAÇÃO ENTRE STEPS =====
window.nextStep = function() {
  if (!validateCurrentStep()) {
    return;
  }

  saveCurrentStepData();

  if (currentStep < totalSteps) {
    currentStep++;
    showStep(currentStep);
    updateProgress();
  }
}

window.previousStep = function() {
  if (currentStep > 1) {
    currentStep--;
    showStep(currentStep);
    updateProgress();
  }
}

function showStep(step) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.querySelector(`[data-step="${step}"]`).classList.add('active');
  
  btnBack.style.display = step > 1 ? 'block' : 'none';
}

function updateProgress() {
  const percent = (currentStep / totalSteps) * 100;
  progressBar.style.width = percent + '%';
}

// ===== VALIDAÇÃO =====
function validateCurrentStep() {
  switch(currentStep) {
    case 1: // Email e Senha
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      
      if (!email || !password) {
        alert('⚠️ Preencha todos os campos');
        return false;
      }
      
      if (password.length < 6) {
        alert('⚠️ A senha deve ter no mínimo 6 caracteres');
        return false;
      }
      
      if (!email.includes('@')) {
        alert('⚠️ Email inválido');
        return false;
      }
      break;

    case 2: // Nome
      const nome = document.getElementById('nome').value.trim();
      if (!nome) {
        alert('⚠️ Digite seu nome');
        return false;
      }
      break;

    case 3: // Idade
      const idade = document.getElementById('idade').value;
      if (!idade || idade < 5 || idade > 120) {
        alert('⚠️ Digite uma idade válida');
        return false;
      }
      break;

    case 4:
      const checked = document.querySelectorAll('input[name="idiomas"]:checked');
      if (checked.length === 0) {
        alert('Selecione pelo menos um idioma para continuar.');
        return false;
      }
      userData.idiomas = Array.from(checked).map(cb => cb.value);
      break;

    case 5: // Objetivo
      const objetivo = document.querySelector('input[name="objetivo"]:checked');
      if (!objetivo) {
        alert('⚠️ Selecione seu objetivo');
        return false;
      }
      break;

    case 6: // Tempo
      const tempo = document.querySelector('input[name="tempo"]:checked');
      if (!tempo) {
        alert('⚠️ Selecione quanto tempo você tem');
        return false;
      }
      break;

    case 7: // Meta
      const meta = document.querySelector('input[name="meta"]:checked');
      if (!meta) {
        alert('⚠️ Selecione sua meta diária');
        return false;
      }
      break;
  }

  return true;
}

// ===== SALVAR DADOS DO STEP ATUAL =====
function saveCurrentStepData() {
  switch(currentStep) {
    case 1:
      userData.email = document.getElementById('email').value.trim();
      userData.password = document.getElementById('password').value;
      break;

    case 2:
      userData.nome = document.getElementById('nome').value.trim();
      break;

    case 3:
      userData.idade = parseInt(document.getElementById('idade').value);
      break;

    case 4:
      userData.idiomas = Array.from(document.querySelectorAll('input[name="idiomas"]:checked'))
        .map(cb => cb.value);
      break;

    case 5:
      userData.objetivo = document.querySelector('input[name="objetivo"]:checked').value;
      break;

    case 6:
      userData.tempo = parseInt(document.querySelector('input[name="tempo"]:checked').value);
      break;

    case 7:
      userData.meta = parseInt(document.querySelector('input[name="meta"]:checked').value);
      break;

    case 8:
      userData.motivacao = document.getElementById('motivacao').value.trim();
      break;
  }
}

// ===== FINALIZAR CADASTRO =====
window.finalizarCadastro = async function() {
  saveCurrentStepData();

  loading.style.display = 'flex';

  try {
    // Criar usuário no Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      userData.email, 
      userData.password
    );

    const user = userCredential.user;

    // Criar plano de estudos personalizado
    const planoDeEstudos = gerarPlanoDeEstudos(userData);

    // Salvar dados no Firestore
    await setDoc(doc(db, 'users', user.uid), {
      nome: userData.nome,
      idade: userData.idade,
      idiomas: userData.idiomas,
      objetivo: userData.objetivo,
      tempoDiario: userData.tempo,
      metaDiaria: userData.meta,
      motivacao: userData.motivacao,
      planoDeEstudos: planoDeEstudos,
      criadoEm: new Date().toISOString(),
      stats: {
        studiedToday: 0,
        totalCorrect: 0,
        totalWrong: 0,
        streak: 0,
        lastStudyDate: null
      }
    });

    // Redirecionar para o app
    window.location.href = 'app.html';

  } catch (error) {
    loading.style.display = 'none';
    console.error('Erro ao criar conta:', error);
    
    let message = 'Erro ao criar conta. Tente novamente.';
    
    if (error.code === 'auth/email-already-in-use') {
      message = '⚠️ Este email já está em uso. Faça login.';
    } else if (error.code === 'auth/weak-password') {
      message = '⚠️ Senha muito fraca. Use no mínimo 6 caracteres.';
    } else if (error.code === 'auth/invalid-email') {
      message = '⚠️ Email inválido.';
    }
    
    alert(message);
  }
}

// ===== GERAR PLANO DE ESTUDOS PERSONALIZADO =====
function gerarPlanoDeEstudos(dados) {
  const plano = {
    titulo: `Plano Personalizado de ${dados.nome}`,
    idiomas: dados.idiomas,
    objetivo: dados.objetivo,
    tempoDiario: dados.tempo,
    metaDiaria: dados.meta,
    descricao: `Aprender ${dados.idiomas.join(', ')} para ${dados.objetivo.toLowerCase()}`,
    recomendacoes: []
  };

  // Recomendações baseadas no tempo disponível
  if (dados.tempo <= 10) {
    plano.recomendacoes.push('Foque em 5-10 palavras por dia');
    plano.recomendacoes.push('Revise cards todos os dias, mesmo que rapidamente');
  } else if (dados.tempo <= 20) {
    plano.recomendacoes.push('Aprenda 10-15 palavras novas por dia');
    plano.recomendacoes.push('Pratique com frases completas');
  } else {
    plano.recomendacoes.push('Aprenda 20+ palavras novas por dia');
    plano.recomendacoes.push('Combine com áudio e escrita');
    plano.recomendacoes.push('Tente criar seus próprios flashcards');
  }

  // Recomendações baseadas no objetivo
  switch(dados.objetivo) {
    case 'Viagem':
      plano.recomendacoes.push('Foque em frases práticas do cotidiano');
      plano.recomendacoes.push('Aprenda números, direções e pedidos');
      break;
    case 'Trabalho':
      plano.recomendacoes.push('Vocabulário profissional é essencial');
      plano.recomendacoes.push('Pratique apresentações e emails');
      break;
    case 'Estudo':
      plano.recomendacoes.push('Construa base sólida de gramática');
      plano.recomendacoes.push('Pratique leitura e escrita acadêmica');
      break;
  }

  // Adicionar decks sugeridos baseados nos idiomas escolhidos
  plano.decksSugeridos = dados.idiomas.map(idioma => ({
    idioma: idioma,
    deck: `${idioma} - 30 Palavras Essenciais`,
    prioridade: 'Alta'
  }));

  return plano;
}