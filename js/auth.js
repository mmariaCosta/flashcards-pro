// ===== SISTEMA DE AUTENTICAÇÃO =====
import { auth, googleProvider, db } from './firebase-config.js';
import { 
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
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

// ===== VERIFICAR REDIRECT DO GOOGLE =====
checkRedirectResult();

async function checkRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      showLoading(true);
      await handleGoogleUser(result.user);
    }
  } catch (error) {
    console.error('Erro no redirect:', error);
    handleAuthError(error);
  }
}

// ===== VERIFICAR SE JÁ ESTÁ LOGADO =====
onAuthStateChanged(auth, (user) => {
  if (user) {
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
      googleProvider.setCustomParameters({
        prompt: 'select_account'
      });

      // Detectar se é mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      if (isMobile) {
        console.log('📱 Mobile: usando signInWithRedirect');
        await signInWithRedirect(auth, googleProvider);
      } else {
        console.log('💻 Desktop: usando signInWithPopup');
        try {
          const result = await signInWithPopup(auth, googleProvider);
          await handleGoogleUser(result.user);
        } catch (popupError) {
          if (popupError.code === 'auth/popup-blocked') {
            console.log('🚫 Popup bloqueado, usando redirect');
            await signInWithRedirect(auth, googleProvider);
          } else {
            throw popupError;
          }
        }
      }
    } catch (error) {
      showLoading(false);
      
      if (error.code === 'auth/popup-closed-by-user' || 
          error.code === 'auth/cancelled-popup-request') {
        console.log('Login cancelado');
        return;
      }
      
      handleAuthError(error);
    }
  });
}

// ===== HANDLE GOOGLE USER =====
async function handleGoogleUser(user) {
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));

    if (!userDoc.exists()) {
      await setDoc(doc(db, 'users', user.uid), {
        nome: user.displayName || 'Usuário',
        email: user.email,
        criadoEm: new Date().toISOString(),
        idiomas: ['Inglês'],
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

    window.location.href = 'app.html';
  } catch (error) {
    showLoading(false);
    console.error('Erro ao processar usuário:', error);
    alert('Erro ao fazer login. Tente novamente.');
  }
}

// ===== FUNÇÕES AUXILIARES =====
function showLoading(show) {
  if (loading) {
    loading.style.display = show ? 'flex' : 'none';
  }
}

function showError(message) {
  const existingError = document.querySelector('.error-message');
  if (existingError) existingError.remove();

  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  
  if (loginForm) {
    loginForm.insertBefore(errorDiv, loginForm.firstChild);
    setTimeout(() => errorDiv.remove(), 5000);
  }
}

function handleAuthError(error) {
  console.error('Erro de autenticação:', error);

  let message = 'Erro ao fazer login. Tente novamente.';

  switch (error.code) {
    case 'auth/user-not-found':
      message = 'Usuário não encontrado.';
      break;
    case 'auth/wrong-password':
      message = 'Senha incorreta.';
      break;
    case 'auth/invalid-email':
      message = 'Email inválido.';
      break;
    case 'auth/user-disabled':
      message = 'Conta desativada.';
      break;
    case 'auth/too-many-requests':
      message = 'Muitas tentativas. Aguarde.';
      break;
    case 'auth/network-request-failed':
      message = 'Erro de conexão.';
      break;
    case 'auth/popup-blocked':
      message = 'Permita pop-ups ou aguarde redirecionamento.';
      break;
    case 'auth/invalid-credential':
      message = 'Email ou senha incorretos.';
      break;
    case 'auth/account-exists-with-different-credential':
      message = 'Email já usado com outro método.';
      break;
  }

  showError(message);
}