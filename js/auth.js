// ===== FIREBASE IMPORTS =====
import { 
  getAuth, 
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
  getFirestore,
  doc, 
  getDoc, 
  setDoc 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ===== FIREBASE INITIALIZATION =====
const auth = getAuth();
const db = getFirestore();
const googleProvider = new GoogleAuthProvider();

// ===== DOM ELEMENTS =====
const loginForm = document.getElementById('loginForm');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const loading = document.getElementById('loading');

// ===== CHECK IF ALREADY LOGGED IN =====
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = 'app.html';
  }
});

// ===== EMAIL/PASSWORD LOGIN =====
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
      // onAuthStateChanged will redirect
    } catch (error) {
      showLoading(false);
      handleAuthError(error);
    }
  });
}

// ===== GOOGLE LOGIN =====
if (googleLoginBtn) {
  googleLoginBtn.addEventListener('click', async () => {
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

/**
 * Show/hide loading overlay
 */
function showLoading(show) {
  if (loading) {
    loading.style.display = show ? 'flex' : 'none';
  }
}

/**
 * Display error message
 */
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

/**
 * Handle authentication errors
 */
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

console.log('✅ Auth module carregado com sucesso!');