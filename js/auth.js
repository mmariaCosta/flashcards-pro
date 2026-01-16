// ===== SISTEMA DE AUTENTICAÇÃO =====
import { auth, googleProvider, db } from './firebase-config.js';
import { 
  signInWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
  doc, 
  getDoc, 
  setDoc 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ===== ELEMENTOS DO DOM =====
const loginForm = document.getElementById('loginForm');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const loading = document.getElementById('loading');

// ===== VERIFICAR SE JÁ ESTÁ LOGADO =====
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Usuário está logado, redirecionar para o app
    window.location.href = 'app.html';
  }
});

// ===== LOGIN COM EMAIL/SENHA =====
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
      showError('Preencha todos os campos');
      return;
    }

    showLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged vai redirecionar automaticamente
    } catch (error) {
      showLoading(false);
      handleAuthError(error);
    }
  });
}

// ===== LOGIN COM GOOGLE - CORRIGIDO =====
if (googleLoginBtn) {
  googleLoginBtn.addEventListener('click', async () => {
    showLoading(true);

    try {
      // Configurar o provedor do Google
      googleProvider.setCustomParameters({
        prompt: 'select_account'
      });

      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Verificar se é novo usuário
      const userDoc = await getDoc(doc(db, 'users', user.uid));

      if (!userDoc.exists()) {
        // Criar perfil básico para novo usuário do Google
        await setDoc(doc(db, 'users', user.uid), {
          nome: user.displayName || 'Usuário',
          email: user.email,
          criadoEm: new Date().toISOString(),
          idiomas: ['Inglês'], // Idioma padrão
          objetivo: 'Estudar',
          tempoDiario: 10,
          metaDiaria: 10,
          planoDeEstudos: {
            titulo: 'Plano Básico',
            idiomas: ['Inglês'],
            recomendacoes: [
              'Complete seu perfil nas configurações',
              'Comece com 5-10 palavras por dia',
              'Revise cards todos os dias'
            ]
          },
          stats: {
            studiedToday: 0,
            totalCorrect: 0,
            totalWrong: 0,
            streak: 0,
            lastStudyDate: null
          },
          settings: {
            newCardsPerDay: 20,
            reviewsPerDay: 100,
            notificationsEnabled: false,
            notificationTimes: ['09:00', '14:00', '19:00']
          }
        });
      }

      // Redirecionar para o app
      window.location.href = 'app.html';
      
    } catch (error) {
      showLoading(false);
      
      // Não mostrar erro se usuário cancelou
      if (error.code === 'auth/popup-closed-by-user' || 
          error.code === 'auth/cancelled-popup-request') {
        console.log('Login cancelado pelo usuário');
        return;
      }
      
      handleAuthError(error);
    }
  });
}

// ===== FUNÇÕES AUXILIARES =====
function showLoading(show) {
  if (loading) {
    loading.style.display = show ? 'flex' : 'none';
  }
}

function showError(message) {
  // Remove erro anterior se existir
  const existingError = document.querySelector('.error-message');
  if (existingError) existingError.remove();

  // Cria novo erro
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  
  if (loginForm) {
    loginForm.insertBefore(errorDiv, loginForm.firstChild);
    
    // Remove após 5 segundos
    setTimeout(() => errorDiv.remove(), 5000);
  }
}

function handleAuthError(error) {
  console.error('Erro de autenticação:', error);

  let message = 'Erro ao fazer login. Tente novamente.';

  switch (error.code) {
    case 'auth/user-not-found':
      message = 'Usuário não encontrado. Verifique o email.';
      break;
    case 'auth/wrong-password':
      message = 'Senha incorreta. Tente novamente.';
      break;
    case 'auth/invalid-email':
      message = 'Email inválido.';
      break;
    case 'auth/user-disabled':
      message = 'Esta conta foi desativada.';
      break;
    case 'auth/too-many-requests':
      message = 'Muitas tentativas. Aguarde alguns minutos.';
      break;
    case 'auth/network-request-failed':
      message = 'Erro de conexão. Verifique sua internet.';
      break;
    case 'auth/popup-blocked':
      message = 'Pop-up bloqueado. Permita pop-ups para fazer login com Google.';
      break;
    case 'auth/invalid-credential':
      message = 'Email ou senha incorretos.';
      break;
    case 'auth/account-exists-with-different-credential':
      message = 'Já existe uma conta com este email usando outro método de login.';
      break;
  }

  showError(message);
}