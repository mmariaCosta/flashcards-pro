// ===== SISTEMA DE AUTENTICAÇÃO - LOGIN =====
import { auth, googleProvider, db } from './firebase-config.js';
import { 
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
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

// ===== VARIÁVEIS DE CONTROLE =====
let autoLoginTimeout = null;
let countdownInterval = null;

// ===== CHECK IF ALREADY LOGGED IN - COM DELAY DE 10 SEGUNDOS =====
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Mostrar mensagem de auto-login
    const authForm = document.querySelector('.auth-form');
    if (authForm) {
      const autoLoginMsg = document.createElement('div');
      autoLoginMsg.className = 'success-message';
      autoLoginMsg.id = 'autoLoginMsg';
      autoLoginMsg.innerHTML = `
        ✅ Conta detectada: <strong>${user.email}</strong><br>
        <small>Redirecionando em <span id="countdown">10</span> segundos...</small><br>
        <button onclick="cancelAutoLogin()" style="margin-top: 0.5rem; padding: 0.5rem 1rem; background: var(--danger); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
          ❌ Cancelar e fazer outro login
        </button>
      `;
      authForm.insertBefore(autoLoginMsg, authForm.firstChild);
    }

    // Countdown de 10 segundos
    let countdown = 10;
    const countdownEl = document.getElementById('countdown');
    
    countdownInterval = setInterval(() => {
      countdown--;
      if (countdownEl) {
        countdownEl.textContent = countdown;
      }
      
      if (countdown <= 0) {
        clearInterval(countdownInterval);
      }
    }, 1000);

    // Auto-login após 10 segundos
    autoLoginTimeout = setTimeout(() => {
      window.location.href = 'app.html';
    }, 10000);
    
    // Função global para cancelar
    window.cancelAutoLogin = () => {
      clearTimeout(autoLoginTimeout);
      clearInterval(countdownInterval);
      
      const msg = document.getElementById('autoLoginMsg');
      if (msg) msg.remove();
      
      // Fazer logout para permitir outro login
      signOut(auth).then(() => {
        console.log('✅ Auto-login cancelado');
        showError('Você pode fazer login com outra conta agora.');
      }).catch(error => {
        console.error('Erro ao cancelar:', error);
      });
    };
  }
});

// ===== EMAIL/PASSWORD LOGIN =====
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Cancelar auto-login se estiver ativo
    if (autoLoginTimeout) {
      clearTimeout(autoLoginTimeout);
      clearInterval(countdownInterval);
    }
    
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

// ===== GOOGLE LOGIN =====
if (googleLoginBtn) {
  googleLoginBtn.addEventListener('click', async () => {
    // Cancelar auto-login se estiver ativo
    if (autoLoginTimeout) {
      clearTimeout(autoLoginTimeout);
      clearInterval(countdownInterval);
      const msg = document.getElementById('autoLoginMsg');
      if (msg) msg.remove();
    }

    showLoading(true);

    try {
      googleProvider.setCustomParameters({
        prompt: 'select_account'
      });

      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if new user
      const userDoc = await getDoc(doc(db, 'users', user.uid));

      if (!userDoc.exists()) {
        // Create basic profile for new Google user
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
      
      if (error.code === 'auth/popup-closed-by-user' || 
          error.code === 'auth/cancelled-popup-request') {
        console.log('Login cancelado');
        return;
      }
      
      handleAuthError(error);
    }
  });
}

// ===== HELPER FUNCTIONS =====
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
  console.error('Auth error:', error);

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
      message = 'Pop-up bloqueado. Permita pop-ups para login com Google.';
      break;
    case 'auth/invalid-credential':
      message = 'Email ou senha incorretos.';
      break;
  }

  showError(message);
}