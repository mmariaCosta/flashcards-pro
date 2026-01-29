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
  try {
    const userDocRef = doc(db, 'users', appState.user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      appState.userData = userDoc.data();
      appState.stats = appState.userData.stats || appState.stats;
      appState.settings = appState.userData.settings || appState.settings;
      
      const userNameEl = document.getElementById('userName');
      if (userNameEl) {
        userNameEl.textContent = appState.userData.nome || appState.user.email;
      }
    }

    const decksSnapshot = await getDocs(collection(db, 'users', appState.user.uid, 'decks'));
    appState.decks = decksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const foldersSnapshot = await getDocs(collection(db, 'users', appState.user.uid, 'folders'));
    appState.folders = foldersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    updateStreak();
    
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    alert('Erro ao carregar seus dados. Tente novamente.');
  }
}

// ===== SAVE STATS =====
export async function saveStats() {
  try {
    const userDocRef = doc(db, 'users', appState.user.uid);
    await updateDoc(userDocRef, {
      stats: appState.stats
    });
  } catch (error) {
    console.error('Erro ao salvar stats:', error);
  }
}

// ===== SAVE SETTINGS =====
export async function saveSettings() {
  try {
    appState.settings.newCardsPerDay = parseInt(document.getElementById('settingNewCards')?.value) || 20;
    appState.settings.reviewsPerDay = parseInt(document.getElementById('settingReviews')?.value) || 100;
    
    const userDocRef = doc(db, 'users', appState.user.uid);
    await updateDoc(userDocRef, {
      settings: appState.settings
    });
    
    alert('✅ Configurações salvas!');
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    alert('Erro ao salvar configurações.');
  }
}

// ===== SAVE STUDY HISTORY =====
export async function saveStudyToHistory(correct) {
  if (!appState.user) return;

  const today = new Date().toISOString().split('T')[0];
  const userRef = doc(db, 'users', appState.user.uid);

  try {
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();
    const studyHistory = userData.studyHistory || {};

    if (!studyHistory[today]) {
      studyHistory[today] = {
        cards: 0,
        correct: 0,
        wrong: 0,
        date: today
      };
    }

    studyHistory[today].cards += 1;
    if (correct) {
      studyHistory[today].correct += 1;
    } else {
      studyHistory[today].wrong += 1;
    }

    await updateDoc(userRef, {
      studyHistory: studyHistory
    });

    console.log('✅ Histórico atualizado:', studyHistory[today]);
  } catch (error) {
    console.error('Erro ao salvar histórico:', error);
  }
}

// ===== UPDATE STREAK =====
export function updateStreak() {
  const today = new Date().toISOString().split('T')[0];
  const lastStudy = appState.stats.lastStudyDate;

  if (!lastStudy) {
    appState.stats.streak = 0;
    return;
  }

  const lastDate = new Date(lastStudy);
  const todayDate = new Date(today);
  const diffTime = Math.abs(todayDate - lastDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 1) {
    appState.stats.streak = 0;
    saveStats();
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
  showLoading(true);
  
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      appState.user = user;
      await loadUserData();
      showLoading(false);
      return true;
    } else {
      window.location.href = 'index.html';
      return false;
    }
  });
}

console.log('✅ app-init.js carregado!');