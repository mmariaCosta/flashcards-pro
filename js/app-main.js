// ===== IMPORTS =====
import { 
  initApp, 
  setupLogout, 
  saveSettings,
  appState
} from './app-init.js';

import { 
  setupUI, 
  showView, 
  renderDashboard, 
  renderFolders,
  closeFolderModal,
  updateFolderSelect
} from './app-ui.js';

import { 
  renderDecks, 
  saveDeck, 
  deleteDeck,
  renderExampleDecks,
  importExampleDeck,
  exportData,
  importData
} from './app-decks.js';

import { 
  startStudy, 
  updateStudyCard,
  flipCard,
  checkTypedAnswer,
  rateCard,
  nextCard,
  previousCard
} from './app-study.js';

// ===== NOTIFICATIONS =====
async function setupNotifications() {
  const notifToggle = document.getElementById('notificationToggle');
  const notifStatus = document.getElementById('notificationStatus');
  const timeInputs = document.querySelectorAll('.notification-time-input');

  if (!notifToggle || !notifStatus) return;

  if (!('Notification' in window)) {
    notifStatus.textContent = '❌ Seu navegador não suporta notificações';
    notifToggle.disabled = true;
    return;
  }

  notifToggle.checked = appState.settings.notificationsEnabled;
  updateNotificationStatus();

  timeInputs.forEach((input, index) => {
    if (appState.settings.notificationTimes[index]) {
      input.value = appState.settings.notificationTimes[index];
    }
  });

  notifToggle.addEventListener('change', async () => {
    if (notifToggle.checked) {
      await enableNotifications();
    } else {
      disableNotifications();
    }
  });

  timeInputs.forEach((input, index) => {
    input.addEventListener('change', async () => {
      appState.settings.notificationTimes[index] = input.value;
      await saveSettings();
      
      if (appState.settings.notificationsEnabled) {
        scheduleNotifications();
      }
    });
  });

  const testBtn = document.getElementById('testNotification');
  if (testBtn) {
    testBtn.addEventListener('click', () => sendTestNotification());
  }

  if (appState.settings.notificationsEnabled && Notification.permission === 'granted') {
    scheduleNotifications();
  }
}

async function enableNotifications() {
  try {
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      appState.settings.notificationsEnabled = true;
      await saveSettings();
      updateNotificationStatus();
      scheduleNotifications();
      
      new Notification('🎉 Notificações Ativadas!', {
        body: 'Você receberá lembretes para estudar seus flashcards',
        icon: '/icon-192x192.png'
      });
      
      alert('✅ Notificações ativadas com sucesso!');
    } else {
      const notifToggle = document.getElementById('notificationToggle');
      if (notifToggle) notifToggle.checked = false;
      alert('❌ Você precisa permitir notificações no navegador.');
    }
  } catch (error) {
    console.error('Erro ao ativar notificações:', error);
    const notifToggle = document.getElementById('notificationToggle');
    if (notifToggle) notifToggle.checked = false;
  }
}

function disableNotifications() {
  appState.settings.notificationsEnabled = false;
  saveSettings();
  updateNotificationStatus();
  
  if (appState.notificationCheckInterval) {
    clearInterval(appState.notificationCheckInterval);
    appState.notificationCheckInterval = null;
  }
  
  alert('🔕 Notificações desativadas.');
}

function updateNotificationStatus() {
  const status = document.getElementById('notificationStatus');
  if (!status) return;
  
  if (!('Notification' in window)) {
    status.textContent = '❌ Navegador não suporta notificações';
    status.style.color = 'var(--danger)';
  } else if (Notification.permission === 'denied') {
    status.textContent = '🚫 Notificações bloqueadas. Habilite nas configurações do navegador.';
    status.style.color = 'var(--danger)';
  } else if (appState.settings.notificationsEnabled && Notification.permission === 'granted') {
    status.textContent = '✅ Notificações ativas';
    status.style.color = 'var(--success)';
  } else {
    status.textContent = '⏸️ Notificações desativadas';
    status.style.color = 'var(--text-muted)';
  }
}

function scheduleNotifications() {
  if (appState.notificationCheckInterval) {
    clearInterval(appState.notificationCheckInterval);
  }

  appState.notificationCheckInterval = setInterval(() => {
    checkAndSendNotification();
  }, 30000);

  checkAndSendNotification();
}

function checkAndSendNotification() {
  if (!appState.settings.notificationsEnabled || Notification.permission !== 'granted') {
    return;
  }

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const shouldNotify = appState.settings.notificationTimes.some(time => time === currentTime);

  if (shouldNotify) {
    const lastNotifKey = `lastNotif_${appState.user.uid}_${currentTime}`;
    const lastNotif = localStorage.getItem(lastNotifKey);
    const today = now.toISOString().substring(0, 10);

    if (lastNotif !== today) {
      sendStudyReminder();
      localStorage.setItem(lastNotifKey, today);
    }
  }
}

function sendStudyReminder() {
  let totalDue = 0;
  appState.decks.forEach(deck => {
    if (deck.cards) {
      totalDue += deck.cards.filter(card => {
        if (!card.nextReview) return true;
        return new Date(card.nextReview) <= new Date();
      }).length;
    }
  });

  if (totalDue === 0) {
    new Notification('🎉 Parabéns!', {
      body: 'Você está em dia com seus estudos!',
      icon: '/icon-192x192.png'
    });
  } else {
    new Notification('📚 Hora de Estudar!', {
      body: `Você tem ${totalDue} cartão${totalDue > 1 ? 'ões' : ''} para revisar`,
      icon: '/icon-192x192.png'
    });
  }
}

function sendTestNotification() {
  if (Notification.permission !== 'granted') {
    alert('⚠️ Você precisa permitir notificações primeiro!');
    return;
  }

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  new Notification('🧪 Notificação de Teste', {
    body: `Funcionando! 🎉\n\n⏰ Hora atual: ${currentTime}`,
    icon: '/icon-192x192.png'
  });

  alert(`✅ Notificação de teste enviada!\n\n⏰ Hora atual: ${currentTime}`);
}

// ===== RENDER ALL =====
function renderAll() {
  renderDashboard();
  renderDecks();
  renderFolders();
  renderExampleDecks();
  updateFolderSelect();
}

// ===== GLOBAL APP OBJECT =====
window.app = {
  // Navigation
  showView,
  
  // Deck Management
  saveDeck,
  deleteDeck,
  
  // Study
  startStudy,
  flipCard,
  rateCard,
  nextCard,
  previousCard,
  
  // Folders
  closeFolderModal,
  
  // Settings
  saveSettings,
  
  // Data
  exportData,
  importData
};

// ===== EVENT LISTENERS =====
document.addEventListener('renderAll', renderAll);
document.addEventListener('renderDashboard', renderDashboard);

document.addEventListener('showView', (e) => {
  showView(e.detail.view);
});

document.addEventListener('startStudy', (e) => {
  startStudy(e.detail.deckId);
});

document.addEventListener('flipCard', flipCard);
document.addEventListener('checkTypedAnswer', checkTypedAnswer);

// ===== INITIALIZATION =====
async function main() {
  const initialized = await initApp();
  
  if (initialized !== false) {
    setupUI();
    setupLogout();
    setupNotifications();
    renderAll();
  }
}

// Start app
main();

console.log('✅ Flashcards Pro iniciado com sucesso!');