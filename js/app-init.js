// ===== FIREBASE IMPORTS =====
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
  doc, 
  getDoc, 
  updateDoc,
  collection,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ===== APP STATE =====
export const appState = {
  user: null,
  userData: null,
  decks: [],
  folders: [],
  stats: {
    studiedToday: 0,
    newCardsToday: 0,    // ✅ Novos cards estudados hoje
    reviewsToday: 0,     // ✅ Revisões feitas hoje
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
  },
  currentDeck: null,
  currentCardIndex: 0,
  isFlipped: false,
  studyMode: 'normal',
  notificationCheckInterval: null,
  speechSynthesis: window.speechSynthesis
};

// ===== LOADING =====
export function showLoading(show) {
  const loader = document.getElementById('loading');
  if (loader) {
    loader.style.display = show ? 'flex' : 'none';
  }
}

// ===== LOAD USER DATA FROM FIREBASE =====
export async function loadUserData() {
  console.log('🔥 Carregando dados do usuário...');
  
  try {
    const userDocRef = doc(db, 'users', appState.user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      appState.userData = userDoc.data();
      appState.stats = appState.userData.stats || appState.stats;
      appState.settings = appState.userData.settings || appState.settings;
      
      // ✅ CARREGAR CONTADORES DO DIA ATUAL (com fallback para studyHistory)
      const today = new Date().toISOString().split('T')[0];
      const studyHistory = appState.userData.studyHistory || {};
      
      if (studyHistory[today]) {
        // Contadores do histórico
        appState.stats.studiedToday = studyHistory[today].cards || 0;
        appState.stats.newCardsToday = studyHistory[today].newCards || 0;
        appState.stats.reviewsToday = studyHistory[today].reviews || 0;
        
        console.log('📊 Dados de hoje (do histórico):');
        console.log('  Total estudado:', appState.stats.studiedToday);
        console.log('  Novos cards:', appState.stats.newCardsToday);
        console.log('  Revisões:', appState.stats.reviewsToday);
      } else if (appState.userData.stats) {
        // Fallback para stats diretos (se existirem)
        appState.stats.studiedToday = appState.userData.stats.studiedToday || 0;
        appState.stats.newCardsToday = appState.userData.stats.newCardsToday || 0;
        appState.stats.reviewsToday = appState.userData.stats.reviewsToday || 0;
        
        console.log('📊 Dados de hoje (de stats):');
        console.log('  Total estudado:', appState.stats.studiedToday);
        console.log('  Novos cards:', appState.stats.newCardsToday);
        console.log('  Revisões:', appState.stats.reviewsToday);
      } else {
        appState.stats.studiedToday = 0;
        appState.stats.newCardsToday = 0;
        appState.stats.reviewsToday = 0;
        console.log('📊 Nenhum card estudado hoje ainda');
      }
      
      console.log('✅ Dados do usuário carregados');
      console.log('⚙️  Settings:');
      console.log('   Meta de novos cards/dia:', appState.settings.newCardsPerDay);
      console.log('   Meta de revisões/dia:', appState.settings.reviewsPerDay);
      
      const userNameEl = document.getElementById('userName');
      if (userNameEl) {
        userNameEl.textContent = appState.userData.nome || appState.user.email;
      }
    } else {
      console.log('⚠️ Documento do usuário não existe');
    }

    // Carregar decks
    console.log('📚 Carregando decks...');
    const decksSnapshot = await getDocs(collection(db, 'users', appState.user.uid, 'decks'));
    appState.decks = decksSnapshot.docs.map(doc => {
      const data = doc.data();
      console.log('  ✔ Deck encontrado:', data.name);
      return {
        id: doc.id,
        ...data
      };
    });
    console.log(`✅ ${appState.decks.length} decks carregados`);

    // Carregar pastas
    console.log('📁 Carregando pastas...');
    const foldersSnapshot = await getDocs(collection(db, 'users', appState.user.uid, 'folders'));
    appState.folders = foldersSnapshot.docs.map(doc => {
      const data = doc.data();
      console.log('  ✔ Pasta encontrada:', data.name);
      return {
        id: doc.id,
        ...data
      };
    });
    console.log(`✅ ${appState.folders.length} pastas carregadas`);

    updateStreak();
    
    console.log('🎉 Todos os dados carregados com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao carregar dados:', error);
    console.error('Detalhes do erro:', error.message);
    throw error;
  }
}

// ===== SAVE STATS =====
export async function saveStats() {
  try {
    const userDocRef = doc(db, 'users', appState.user.uid);
    await updateDoc(userDocRef, {
      stats: appState.stats
    });
    console.log('✅ Stats salvos:', appState.stats);
  } catch (error) {
    console.error('❌ Erro ao salvar stats:', error);
  }
}

// ===== SAVE SETTINGS =====
export async function saveSettings() {
  try {
    appState.settings.newCardsPerDay = parseInt(document.getElementById('settingNewCards')?.value) || 20;
    appState.settings.reviewsPerDay = parseInt(document.getElementById('settingReviews')?.value) || 100;
    
    const userDocRef = doc(db, 'users', appState.user.uid);
    await updateDoc(userDocRef, {
      settings: appState.settings,
      metaDiaria: appState.settings.newCardsPerDay // ✅ Sincronizar com metaDiaria
    });
    
    alert('✅ Configurações salvas!');
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    alert('Erro ao salvar configurações.');
  }
}

// ===== SAVE STUDY HISTORY =====
export async function saveStudyToHistory(correct, isNewCard = false) {
  if (!appState.user) return;

  const today = new Date().toISOString().split('T')[0];
  const userRef = doc(db, 'users', appState.user.uid);

  try {
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.error('❌ Documento do usuário não existe!');
      return;
    }
    
    const userData = userDoc.data();
    const studyHistory = userData.studyHistory || {};

    // Inicializar entrada do dia se não existir
    if (!studyHistory[today]) {
      studyHistory[today] = {
        cards: 0,
        newCards: 0,    // ✅ Contador de novos cards
        reviews: 0,     // ✅ Contador de revisões
        correct: 0,
        wrong: 0,
        date: today
      };
    }

    // Incrementar contadores
    studyHistory[today].cards = (studyHistory[today].cards || 0) + 1;
    
    // ✅ Diferenciar novos cards de revisões
    if (isNewCard) {
      studyHistory[today].newCards = (studyHistory[today].newCards || 0) + 1;
      // ❌ REMOVIDO: appState.stats.newCardsToday++ (estava duplicando)
    } else {
      studyHistory[today].reviews = (studyHistory[today].reviews || 0) + 1;
      // ❌ REMOVIDO: appState.stats.reviewsToday++ (estava duplicando)
    }
    
    if (correct) {
      studyHistory[today].correct = (studyHistory[today].correct || 0) + 1;
    } else {
      studyHistory[today].wrong = (studyHistory[today].wrong || 0) + 1;
    }

    // Salvar no Firebase
    await updateDoc(userRef, {
      studyHistory: studyHistory,
      'stats.newCardsToday': appState.stats.newCardsToday,
      'stats.reviewsToday': appState.stats.reviewsToday
    });

    console.log('✅ Histórico atualizado:', studyHistory[today]);
  } catch (error) {
    console.error('❌ Erro ao salvar histórico:', error);
    console.error('Detalhes:', error.message);
  }
}

// ===== UPDATE STREAK =====
export function updateStreak() {
  const today = new Date().toISOString().split('T')[0];
  const lastStudy = appState.stats.lastStudyDate;

  console.log('🔄 Verificando sequência...');
  console.log('  Hoje:', today);
  console.log('  Último estudo:', lastStudy);
  console.log('  Streak atual:', appState.stats.streak);

  if (!lastStudy) {
    console.log('  ℹ️ Nenhum estudo anterior registrado');
    return;
  }

  // Se o último estudo NÃO foi hoje
  if (lastStudy !== today) {
    const lastDate = new Date(lastStudy + 'T00:00:00');
    const todayDate = new Date(today + 'T00:00:00');
    const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

    console.log('  📅 Diferença de dias:', diffDays);

    if (diffDays > 1) {
      // Quebrou a sequência
      console.log('  ❌ Sequência quebrada! Resetando para 0');
      appState.stats.streak = 0;
      appState.stats.studiedToday = 0;
      appState.stats.newCardsToday = 0;
      appState.stats.reviewsToday = 0;
      saveStats();
    } else if (diffDays === 1) {
      // Ontem - mantém sequência, mas reseta contador diário
      console.log('  ✅ Último estudo foi ontem - mantém sequência');
      appState.stats.studiedToday = 0;
      appState.stats.newCardsToday = 0;
      appState.stats.reviewsToday = 0;
      saveStats();
    }
  } else {
    console.log('  ✅ Último estudo foi hoje - mantém tudo');
  }
}

// ===== LOGOUT =====
export function setupLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (confirm('Deseja sair?')) {
        try {
          await signOut(auth);
          window.location.href = 'index.html';
        } catch (error) {
          console.error('Erro ao sair:', error);
          alert('Erro ao sair. Tente novamente.');
        }
      }
    });
  }
}

// ===== CHECK IF CARD IS DUE =====
export function isCardDue(card) {
  if (!card.nextReview) return true;
  return new Date(card.nextReview) <= new Date();
}

// ===== INITIALIZE APP =====
export async function initApp() {
  console.log('🚀 Iniciando aplicativo...');
  showLoading(true);
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log('⏱️ Timeout - redirecionando para login');
      showLoading(false);
      window.location.href = 'index.html';
      resolve(false);
    }, 10000); // 10 segundos de timeout

    onAuthStateChanged(auth, async (user) => {
      clearTimeout(timeout);
      
      if (user) {
        console.log('✅ Usuário autenticado:', user.email);
        appState.user = user;
        
        try {
          await loadUserData();
          console.log('✅ Dados carregados com sucesso');
          console.log('📊 Decks carregados:', appState.decks.length);
          showLoading(false);
          resolve(true);
        } catch (error) {
          console.error('❌ Erro ao carregar dados:', error);
          showLoading(false);
          alert('Erro ao carregar seus dados. Tente fazer login novamente.');
          window.location.href = 'index.html';
          resolve(false);
        }
      } else {
        console.log('❌ Nenhum usuário autenticado - redirecionando');
        showLoading(false);
        window.location.href = 'index.html';
        resolve(false);
      }
    });
  });
}

console.log('✅ app-init.js carregado!');