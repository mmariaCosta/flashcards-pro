// ===== APP.JS - PARTE 1 DE 8 (COMPLETA E CORRIGIDA) =====
// ===== IMPORTAÇÕES E CONFIGURAÇÃO INICIAL =====
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { 
  doc, 
  getDoc, 
  updateDoc,
  collection,
  getDocs,
  addDoc,
  deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { EXAMPLE_DECKS } from './example-decks.js';

// ===== CLASSE PRINCIPAL =====
class FlashcardsApp {
  constructor() {
    // Dados do usuário
    this.user = null;
    this.userData = null;
    
    // Dados do app
    this.decks = [];
    this.folders = [];
    
    // Estatísticas
    this.stats = {
      studiedToday: 0,
      totalCorrect: 0,
      totalWrong: 0,
      streak: 0,
      lastStudyDate: null
    };
    
    // Configurações
    this.settings = {
      newCardsPerDay: 20,
      reviewsPerDay: 100,
      notificationsEnabled: false,
      notificationTimes: ['09:00', '14:00', '19:00']
    };
    
    // Estado do estudo
    this.currentDeck = null;
    this.currentCardIndex = 0;
    this.isFlipped = false;
    this.studyMode = 'normal';
    
    // Outros
    this.notificationCheckInterval = null;
    this.speechSynthesis = window.speechSynthesis;
    
    this.init();
  }

  // ===== INICIALIZAÇÃO =====
  async init() {
    this.showLoading(true);
    
    // Configurar PWA Install
    this.setupPWA();
    
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        this.user = user;
        await this.loadUserData();
        this.setupUI();
        this.render();
        this.showLoading(false);
      } else {
        window.location.href = 'index.html';
      }
    });
  }

  // ===== SETUP PWA INSTALLATION =====
  setupPWA() {
    let deferredPrompt;
    const installPrompt = document.getElementById('installPrompt');
    const installButton = document.getElementById('installButton');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      
      if (installPrompt) {
        installPrompt.style.display = 'block';
      }

      console.log('✅ PWA: Pronto para instalação');
    });

    if (installButton) {
      installButton.addEventListener('click', async () => {
        if (!deferredPrompt) {
          alert('ℹ️ Para instalar:\n\n• Chrome: Menu (⋮) → "Instalar app"\n• Safari: Compartilhar → "Adicionar à Tela Inicial"');
          return;
        }

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          console.log('✅ App instalado!');
          if (installPrompt) installPrompt.style.display = 'none';
        }
        
        deferredPrompt = null;
      });
    }

    window.addEventListener('appinstalled', () => {
      console.log('✅ PWA instalado com sucesso!');
      if (installPrompt) installPrompt.style.display = 'none';
      alert('🎉 Aplicativo instalado com sucesso!\n\nAgora você pode usá-lo como um app nativo.');
    });
  }

  // ===== LOADING =====
  showLoading(show) {
    const loader = document.getElementById('loading');
    if (loader) {
      loader.style.display = show ? 'flex' : 'none';
    }
  }

  // ===== CARREGAR DADOS DO FIREBASE =====
  async loadUserData() {
    try {
      const userDocRef = doc(db, 'users', this.user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        this.userData = userDoc.data();
        this.stats = this.userData.stats || this.stats;
        this.settings = this.userData.settings || this.settings;
        
        const userNameEl = document.getElementById('userName');
        if (userNameEl) {
          userNameEl.textContent = this.userData.nome || this.user.email;
        }
      }

      const decksSnapshot = await getDocs(collection(db, 'users', this.user.uid, 'decks'));
      this.decks = decksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const foldersSnapshot = await getDocs(collection(db, 'users', this.user.uid, 'folders'));
      this.folders = foldersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // CORRIGIDO: Resetar e atualizar sequência
      await this.checkAndResetDailyStats();
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      alert('Erro ao carregar seus dados. Tente novamente.');
    }
  }

  // ===== VERIFICAR E RESETAR ESTATÍSTICAS DIÁRIAS (NOVO) =====
  async checkAndResetDailyStats() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastStudy = this.stats.lastStudyDate;

    console.log('📅 Verificando data:', {
      hoje: today,
      ultimoEstudo: lastStudy,
      estudadosHoje: this.stats.studiedToday
    });

    // Se nunca estudou antes
    if (!lastStudy) {
      this.stats.streak = 0;
      this.stats.studiedToday = 0;
      console.log('🆕 Primeiro estudo - resetando stats');
      return;
    }

    // Se o último estudo foi em outro dia
    if (lastStudy !== today) {
      const lastDate = new Date(lastStudy + 'T00:00:00');
      const todayDate = new Date(today + 'T00:00:00');
      const diffTime = todayDate - lastDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      console.log('📊 Diferença de dias:', diffDays);

      // RESETAR contador diário
      this.stats.studiedToday = 0;

      // Atualizar sequência
      if (diffDays === 1) {
        // Estudou ontem - mantém sequência
        console.log('✅ Estudou ontem - mantendo sequência:', this.stats.streak);
      } else if (diffDays > 1) {
        // Quebrou a sequência
        this.stats.streak = 0;
        console.log('❌ Sequência quebrada - resetando para 0');
      }

      // Salvar no Firebase
      await this.saveStats();
    } else {
      console.log('✅ Já estudou hoje - mantendo contador:', this.stats.studiedToday);
    }
  }

  // ===== SALVAR ESTATÍSTICAS =====
  async saveStats() {
    try {
      const userDocRef = doc(db, 'users', this.user.uid);
      await updateDoc(userDocRef, {
        stats: this.stats
      });
      console.log('💾 Stats salvos:', this.stats);
    } catch (error) {
      console.error('Erro ao salvar stats:', error);
    }
  }

  // ===== SALVAR CONFIGURAÇÕES =====
  async saveSettings() {
    try {
      this.settings.newCardsPerDay = parseInt(document.getElementById('settingNewCards')?.value) || 20;
      this.settings.reviewsPerDay = parseInt(document.getElementById('settingReviews')?.value) || 100;
      
      const userDocRef = doc(db, 'users', this.user.uid);
      await updateDoc(userDocRef, {
        settings: this.settings
      });
      
      alert('✅ Configurações salvas!');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      alert('Erro ao salvar configurações.');
    }
  }

  // ===== LOGOUT =====
  setupLogout() {
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

// ===== FIM DA PARTE 1 - CONTINUE COM A PARTE 2 =====
// ===== FIM DA PARTE 1 - CONTINUE COM A PARTE 2 =====
// ===== APP.JS - PARTE 2 DE 8 =====
// ===== SETUP DA INTERFACE E NAVEGAÇÃO =====

  // ===== CONFIGURAR TODA A UI =====
  setupUI() {
    this.setupNavigation();
    this.setupMenu();
    this.setupFolderSelector();
    this.setupModeSelector();
    this.setupTypingMode();
    this.setupNotifications();
    this.setupLogout();
    this.setupFlashcardClick();

    const newCardsEl = document.getElementById('settingNewCards');
    const reviewsEl = document.getElementById('settingReviews');
    
    if (newCardsEl) newCardsEl.value = this.settings.newCardsPerDay;
    if (reviewsEl) reviewsEl.value = this.settings.reviewsPerDay;
  }

  // ===== NAVEGAÇÃO ENTRE VIEWS =====
  setupNavigation() {
    document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        this.showView(view);
        
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  showView(viewName) {
    document.querySelectorAll('.view').forEach(view => {
      view.classList.remove('active');
    });

    const view = document.getElementById(viewName);
    if (view) {
      view.classList.add('active');
      
      if (viewName === 'dashboard') {
        this.renderDashboard();
      } else if (viewName === 'decks') {
        this.renderDecks();
      } else if (viewName === 'folders') {
        this.renderFolders();
      } else if (viewName === 'examples') {
        this.renderExampleDecks();
      }
    }
  }

  // ===== MENU LATERAL (SIDEBAR) =====
  setupMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const mainContent = document.querySelector('.main-content');
    const navButtons = document.querySelectorAll('.nav-btn');

    if (!menuToggle || !sidebar || !overlay || !mainContent) return;

    const checkScreenSize = () => {
      if (window.innerWidth > 1024) {
        sidebar.classList.remove('closed');
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        menuToggle.classList.remove('active');
        mainContent.classList.remove('expanded');
      } else {
        sidebar.classList.add('closed');
        mainContent.classList.add('expanded');
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    menuToggle.addEventListener('click', () => {
      const isOpen = sidebar.classList.contains('open');
      
      if (isOpen) {
        sidebar.classList.remove('open');
        sidebar.classList.add('closed');
        overlay.classList.remove('active');
        menuToggle.classList.remove('active');
      } else {
        sidebar.classList.add('open');
        sidebar.classList.remove('closed');
        overlay.classList.add('active');
        menuToggle.classList.add('active');
      }
    });

    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      sidebar.classList.add('closed');
      overlay.classList.remove('active');
      menuToggle.classList.remove('active');
    });

    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.innerWidth <= 1024) {
          sidebar.classList.remove('open');
          sidebar.classList.add('closed');
          overlay.classList.remove('active');
          menuToggle.classList.remove('active');
        }
      });
    });
  }

  // ===== SELETOR DE PASTA =====
  setupFolderSelector() {
    const select = document.getElementById('deckFolder');
    const newFolderGroup = document.getElementById('newFolderGroup');
    
    if (!select || !newFolderGroup) return;
    
    select.addEventListener('change', (e) => {
      if (e.target.value === '__new__') {
        newFolderGroup.style.display = 'block';
      } else {
        newFolderGroup.style.display = 'none';
      }
    });
  }

  updateFolderSelect() {
    const select = document.getElementById('deckFolder');
    if (!select) return;
    
    const options = select.querySelectorAll('option:not([value=""]):not([value="__new__"])');
    options.forEach(opt => opt.remove());

    this.folders.forEach(folder => {
      const option = document.createElement('option');
      option.value = folder.name;
      option.textContent = folder.name;
      select.insertBefore(option, select.querySelector('[value="__new__"]'));
    });
  }

  // ===== SELETOR DE MODO DE ESTUDO =====
  setupModeSelector() {
    document.querySelectorAll('.mode-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.studyMode = card.getAttribute('data-mode');
        
        if (this.currentDeck) {
          this.updateStudyCard();
        }
      });
    });
  }

  // ===== MODO DE DIGITAÇÃO =====
  setupTypingMode() {
    const input = document.getElementById('typingInput');
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && this.studyMode === 'typing') {
          this.checkTypedAnswer();
        }
      });
    }
  }

  // ===== CLICK NO FLASHCARD =====
  setupFlashcardClick() {
    const flashcardContainer = document.getElementById('flashcardContainer');
    if (flashcardContainer) {
      flashcardContainer.addEventListener('click', () => {
        if (this.currentDeck) {
          this.flipCard();
        }
      });
    }
  }

  // ===== RENDERIZAÇÃO GERAL =====
  render() {
    this.renderDashboard();
    this.renderDecks();
    this.renderFolders();
    this.renderExampleDecks();
    this.updateFolderSelect();
  }

// ===== FIM DA PARTE 2 - CONTINUE COM A PARTE 3 =====
// ===== APP.JS - PARTE 3 DE 8 =====
// ===== RENDERIZAÇÃO DO DASHBOARD =====

  renderDashboard() {
    // ===== PLANO PERSONALIZADO =====
    if (this.userData && this.userData.planoDeEstudos) {
      const plano = this.userData.planoDeEstudos;
      const planContent = document.getElementById('planContent');
      
      if (planContent) {
        planContent.innerHTML = `
          <p><strong>Objetivo:</strong> ${this.userData.objetivo || 'Não definido'}</p>
          <p><strong>Idiomas:</strong> ${plano.idiomas ? plano.idiomas.join(', ') : 'Não definido'}</p>
          <p><strong>Tempo diário:</strong> ${this.userData.tempoDiario || 0} minutos</p>
          <p><strong>Meta diária:</strong> ${this.userData.metaDiaria || 0} flashcards</p>
          <h4 style="margin-top: 1rem;">Recomendações:</h4>
          <ul>
            ${plano.recomendacoes ? plano.recomendacoes.map(r => `<li>${r}</li>`).join('') : '<li>Nenhuma recomendação disponível</li>'}
          </ul>
        `;
      }
    }

    // ===== ESTATÍSTICAS =====
    const statToday = document.getElementById('statToday');
    const statAccuracy = document.getElementById('statAccuracy');
    const statStreak = document.getElementById('statStreak');
    const statDecks = document.getElementById('statDecks');
    const statCards = document.getElementById('statCards');

    if (statToday) statToday.textContent = this.stats.studiedToday;
    
    const total = this.stats.totalCorrect + this.stats.totalWrong;
    const accuracy = total > 0 ? Math.round((this.stats.totalCorrect / total) * 100) : 0;
    if (statAccuracy) statAccuracy.textContent = accuracy + '%';
    
    if (statStreak) statStreak.textContent = this.stats.streak;
    if (statDecks) statDecks.textContent = this.decks.length;
    
    const totalCards = this.decks.reduce((sum, deck) => sum + (deck.cards?.length || 0), 0);
    if (statCards) statCards.textContent = `${totalCards} cartões`;

    // ===== REVISÕES PENDENTES =====
    const reviewContainer = document.getElementById('reviewCards');
    if (!reviewContainer) return;
    
    reviewContainer.innerHTML = '';

    const dueDecks = this.decks.filter(deck => {
      return deck.cards && deck.cards.some(card => this.isCardDue(card));
    });

    if (dueDecks.length === 0) {
      reviewContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎉</div>
          <h3>Parabéns!</h3>
          <p style="margin-top: 0.5rem;">Você está em dia com as revisões</p>
        </div>
      `;
    } else {
      dueDecks.forEach(deck => {
        const dueCount = deck.cards.filter(card => this.isCardDue(card)).length;
        const card = document.createElement('div');
        card.className = 'card';
        card.onclick = () => this.startStudy(deck.id);
        card.innerHTML = `
          <div class="card-title">${deck.name}</div>
          <div class="card-subtitle">${deck.description || 'Sem descrição'}</div>
          <div class="card-stats">
            <div class="card-stat">
              <span>⏰</span>
              <span>${dueCount} para revisar</span>
            </div>
            <div class="card-stat">
              <span>📝</span>
              <span>${deck.cards.length} total</span>
            </div>
          </div>
        `;
        reviewContainer.appendChild(card);
      });
    }
  }

  // ===== VERIFICAR SE CARTÃO PRECISA DE REVISÃO =====
  isCardDue(card) {
    if (!card.nextReview) return true;
    return new Date(card.nextReview) <= new Date();
  }

// ===== FIM DA PARTE 3 - CONTINUE COM A PARTE 4 =====
// ===== APP.JS - PARTE 4 DE 8 =====
// ===== RENDERIZAÇÃO DE MEUS DECKS =====

  renderDecks() {
    const container = document.getElementById('decksList');
    const empty = document.getElementById('emptyDecks');
    
    if (!container || !empty) return;
    
    if (this.decks.length === 0) {
      container.style.display = 'none';
      empty.style.display = 'block';
      return;
    }

    container.style.display = 'grid';
    empty.style.display = 'none';
    container.innerHTML = '';

    this.decks.forEach(deck => {
      const dueCount = deck.cards?.filter(card => this.isCardDue(card)).length || 0;
      const newCount = deck.cards?.filter(card => !card.level || card.level === 0).length || 0;
      
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-title">${deck.name}</div>
        <div class="card-subtitle">${deck.description || 'Sem descrição'}</div>
        ${deck.language ? `<div style="margin-top: 0.5rem; color: var(--text-muted); font-weight: 600;">📚 ${deck.language}</div>` : ''}
        
        <div class="card-stats">
          <div class="card-stat">
            <span>⏰</span>
            <span>${dueCount} pendentes</span>
          </div>
          <div class="card-stat">
            <span>✨</span>
            <span>${newCount} novos</span>
          </div>
          <div class="card-stat">
            <span>📝</span>
            <span>${deck.cards?.length || 0} total</span>
          </div>
        </div>
        
        <div class="card-actions">
          <button class="card-action-btn" onclick="app.startStudy('${deck.id}')">
            📖 Estudar
          </button>
        </div>

        <div class="share-buttons">
          <button class="share-btn share-btn-primary" onclick="app.shareCard('${deck.id}')" title="Compartilhar com outros usuários">
            📤
          </button>
          <button class="share-btn" onclick="app.shareExternal('${deck.id}')" title="Enviar por WhatsApp, etc">
            📱
          </button>
          <button class="share-btn card-action-btn danger" onclick="app.deleteDeck('${deck.id}')" title="Excluir card">
            🗑️
          </button>
        </div>
      `;
      
      container.appendChild(card);
    });
  }

  // ===== CRIAR NOVO DECK =====
  async saveDeck() {
    const name = document.getElementById('deckName').value.trim();
    const desc = document.getElementById('deckDesc').value.trim();
    const deckLanguage = document.getElementById('deckLanguage').value.trim();
    const folderSelect = document.getElementById('deckFolder').value;
    const newFolderName = document.getElementById('newFolderName').value.trim();
    const cardsText = document.getElementById('deckCards').value.trim();

    if (!name || !cardsText) {
      alert('⚠️ Preencha o nome do deck e adicione pelo menos um cartão!');
      return;
    }

    const lines = cardsText.split('\n').filter(l => l.trim());
    if (lines.length < 2 || lines.length % 2 !== 0) {
      alert('⚠️ Adicione pares de linhas (frente e verso)!\nCada cartão precisa de 2 linhas.');
      return;
    }

    this.showLoading(true);

    try {
      let folderName = '';
      if (folderSelect === '__new__' && newFolderName) {
        folderName = newFolderName;
        const folderExists = this.folders.some(f => f.name === folderName);
        if (!folderExists) {
          await addDoc(collection(db, 'users', this.user.uid, 'folders'), {
            name: folderName,
            createdAt: new Date().toISOString()
          });
        }
      } else if (folderSelect) {
        folderName = folderSelect;
      }

      const cards = [];
      for (let i = 0; i < lines.length; i += 2) {
        cards.push({
          id: Date.now() + i,
          front: lines[i].trim(),      // PORTUGUÊS (frente)
          back: lines[i + 1].trim(),   // IDIOMA ESTRANGEIRO (verso)
          level: 0,
          nextReview: new Date().toISOString(),
          history: [],
          createdAt: new Date().toISOString()
        });
      }

      const newDeck = {
        name: name,
        description: desc,
        folder: folderName,
        language: deckLanguage || folderName,
        cards: cards,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'users', this.user.uid, 'decks'), newDeck);
      
      await this.loadUserData();
      this.clearForm();
      this.showView('decks');
      this.render();
      this.showLoading(false);

      alert(`✅ Deck "${name}" criado!\n\n${cards.length} cartões adicionados.`);
      
    } catch (error) {
      console.error('Erro ao criar deck:', error);
      this.showLoading(false);
      alert('Erro ao criar deck. Tente novamente.');
    }
    async function saveStudyToHistory(correct) {
  if (!auth.currentUser) return;

  const today = new Date().toISOString().split('T')[0];
  const userRef = doc(db, 'users', auth.currentUser.uid);

  try {
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();
    const studyHistory = userData.studyHistory || {};

    if (!studyHistory[today]) {
      studyHistory[today] = { cards: 0, correct: 0, wrong: 0, date: today };
    }

    studyHistory[today].cards += 1;
    if (correct) {
      studyHistory[today].correct += 1;
    } else {
      studyHistory[today].wrong += 1;
    }

    await updateDoc(userRef, { studyHistory: studyHistory });
  } catch (error) {
    console.error('Erro ao salvar histórico:', error);
  }
}
  }

  // ===== LIMPAR FORMULÁRIO =====
  clearForm() {
    const deckName = document.getElementById('deckName');
    const deckDesc = document.getElementById('deckDesc');
    const deckFolder = document.getElementById('deckFolder');
    const newFolderName = document.getElementById('newFolderName');
    const deckCards = document.getElementById('deckCards');
    const newFolderGroup = document.getElementById('newFolderGroup');
    
    if (deckName) deckName.value = '';
    if (deckDesc) deckDesc.value = '';
    if (deckFolder) deckFolder.value = '';
    if (newFolderName) newFolderName.value = '';
    if (deckCards) deckCards.value = '';
    if (newFolderGroup) newFolderGroup.style.display = 'none';
  }

  // ===== EXCLUIR DECK =====
  async deleteDeck(deckId) {
    const deck = this.decks.find(d => d.id === deckId);
    if (!deck) return;
    
    if (!confirm(`Deseja realmente excluir "${deck.name}"?\n\nEsta ação não pode ser desfeita.`)) return;
    
    this.showLoading(true);
    
    try {
      await deleteDoc(doc(db, 'users', this.user.uid, 'decks', deckId));
      await this.loadUserData();
      this.render();
      this.showLoading(false);
      alert('✅ Deck excluído!');
    } catch (error) {
      console.error('Erro ao excluir deck:', error);
      this.showLoading(false);
      alert('Erro ao excluir deck.');
    }
  }

// ===== APP.JS - PARTE 5 DE 8 (TOTALMENTE CORRIGIDA) =====
// ===== DECKS DE EXEMPLO E PASTAS COM EDIÇÃO COMPLETA =====

  renderExampleDecks() {
    const container = document.getElementById('exampleDecksList');
    if (!container) return;
    
    container.innerHTML = '';

    Object.entries(EXAMPLE_DECKS).forEach(([key, deck]) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-title">${deck.name}</div>
        <div class="card-subtitle">${deck.description}</div>
        <div class="card-stats">
          <div class="card-stat">
            <span>🌍</span>
            <span>${deck.language}</span>
          </div>
          <div class="card-stat">
            <span>📝</span>
            <span>${deck.cards.length} cartões</span>
          </div>
        </div>
        <button class="btn btn-primary" style="margin-top: 1rem; width: 100%;">
          ➕ Importar Deck
        </button>
      `;
      
      card.querySelector('.btn-primary').onclick = (e) => {
        e.stopPropagation();
        this.importExampleDeck(key);
      };
      
      container.appendChild(card);
    });
  }

  // ===== IMPORTAR DECK DE EXEMPLO =====
  async importExampleDeck(deckKey) {
    this.showLoading(true);
    
    try {
      const exampleDeck = EXAMPLE_DECKS[deckKey];
      
      const cards = exampleDeck.cards.map((card, i) => ({
        id: Date.now() + i,
        front: card.front,
        back: card.back,
        level: 0,
        nextReview: new Date().toISOString(),
        history: [],
        createdAt: new Date().toISOString()
      }));

      const newDeck = {
        name: exampleDeck.name,
        description: exampleDeck.description,
        folder: exampleDeck.language,
        language: languageName,
        cards: cards,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'users', this.user.uid, 'decks'), newDeck);
      
      const folderExists = this.folders.some(f => f.name === exampleDeck.language);
      if (!folderExists) {
        await addDoc(collection(db, 'users', this.user.uid, 'folders'), {
          name: exampleDeck.language,
          createdAt: new Date().toISOString()
        });
      }
      
      await this.loadUserData();
      this.render();
      this.showLoading(false);
      
      alert(`✅ Deck "${exampleDeck.name}" importado com sucesso!\n\n${cards.length} cartões adicionados.`);
      
    } catch (error) {
      console.error('Erro ao importar deck:', error);
      this.showLoading(false);
      alert('Erro ao importar deck. Tente novamente.');
    }
  }

// ===== PASTAS COM EDIÇÃO E DELEÇÃO =====

  renderFolders() {
    const container = document.getElementById('foldersList');
    if (!container) return;
    
    if (this.folders.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📁</div>
          <h3>Nenhuma pasta criada</h3>
          <p style="margin-top: 0.5rem;">As pastas ajudam a organizar seus decks</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    this.folders.forEach(folder => {
      const deckCount = this.decks.filter(d => d.folder === folder.name).length;
      
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-title">📁 ${folder.name}</div>
        <div class="card-subtitle">${deckCount} deck(s) nesta pasta</div>
        
        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          <button class="btn btn-primary" style="flex: 1;">
            👁️ Ver Cartões
          </button>
          <button class="btn btn-secondary" style="padding: 0.875rem 1rem;" title="Excluir pasta">
            🗑️
          </button>
        </div>
      `;
      
      const buttons = card.querySelectorAll('button');
      buttons[0].onclick = (e) => {
        e.stopPropagation();
        this.viewFolderCards(folder.name);
      };
      
      buttons[1].onclick = (e) => {
        e.stopPropagation();
        this.deleteFolder(folder.id, folder.name);
      };
      
      container.appendChild(card);
    });
  }

  // ===== VER CARTÕES DA PASTA (COM EDIÇÃO) =====
  viewFolderCards(folderName) {
    const decksInFolder = this.decks.filter(d => d.folder === folderName);
    const allCards = [];
    
    decksInFolder.forEach(deck => {
      if (deck.cards) {
        deck.cards.forEach(card => {
          allCards.push({
            ...card,
            deckName: deck.name,
            deckId: deck.id
          });
        });
      }
    });

    if (allCards.length === 0) {
      alert('Esta pasta não contém cartões ainda.');
      return;
    }

    const modal = document.getElementById('folderCardsModal');
    const modalTitle = document.getElementById('modalFolderName');
    const modalContent = document.getElementById('modalCardsContent');
    
    if (!modal || !modalTitle || !modalContent) return;
    
    modalTitle.textContent = `Cartões da Pasta: ${folderName}`;
    
    modalContent.innerHTML = `
      <div style="display: grid; gap: 1rem;">
        ${allCards.map((card) => `
          <div id="card-container-${card.id}" style="background: var(--bg-primary); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 1rem; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
              <strong style="color: var(--text-secondary); font-size: 0.875rem;">${card.deckName}</strong>
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <span style="color: var(--text-muted); font-size: 0.875rem;">Nível ${card.level || 0}</span>
                <button 
                  class="edit-card-btn-${card.id}"
                  style="background: var(--accent); color: white; border: none; padding: 0.4rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.875rem; font-weight: 600;"
                  title="Editar cartão"
                >
                  ✏️ Editar
                </button>
                <button 
                  class="delete-card-btn-${card.id}"
                  style="background: var(--danger); color: white; border: none; padding: 0.4rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.875rem; font-weight: 600;"
                  title="Excluir cartão"
                >
                  🗑️
                </button>
              </div>
            </div>
            
            <!-- MODO VISUALIZAÇÃO -->
            <div id="view-${card.id}" style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 1.5rem; align-items: center;">
              <div>
                <div style="font-weight: 600; margin-bottom: 0.5rem; color: var(--text-secondary);">🇧🇷 Português:</div>
                <div style="font-size: 1.1rem; word-break: break-word;">${this.escapeHtml(card.front)}</div>
              </div>
              <div style="font-size: 1.5rem; color: var(--text-muted);">→</div>
              <div>
                <div style="font-weight: 600; margin-bottom: 0.5rem; color: var(--text-secondary);">🌍 ${folderName}:</div>
                <div style="font-size: 1.1rem; color: var(--accent); word-break: break-word;">${this.escapeHtml(card.back)}</div>
              </div>
            </div>

            <!-- MODO EDIÇÃO -->
            <div id="edit-${card.id}" style="display: none;">
              <div style="margin-bottom: 1rem;">
                <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-secondary);">🇧🇷 Português:</label>
                <input 
                  type="text" 
                  id="front-${card.id}" 
                  value="${this.escapeHtml(card.front)}" 
                  style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: 8px; font-size: 1rem; font-family: inherit;"
                >
              </div>
              <div style="margin-bottom: 1rem;">
                <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-secondary);">🌍 ${folderName}:</label>
                <input 
                  type="text" 
                  id="back-${card.id}" 
                  value="${this.escapeHtml(card.back)}" 
                  style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: 8px; font-size: 1rem; font-family: inherit;"
                >
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button 
                  class="save-card-btn-${card.id}"
                  style="flex: 1; background: var(--success); color: white; border: none; padding: 0.75rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-family: inherit;"
                >
                  ✅ Salvar
                </button>
                <button 
                  class="cancel-card-btn-${card.id}"
                  style="flex: 1; background: var(--text-muted); color: white; border: none; padding: 0.75rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-family: inherit;"
                >
                  ❌ Cancelar
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    
    modal.style.display = 'flex';
    
    // Adicionar event listeners depois que o HTML for renderizado
    allCards.forEach(card => {
      const editBtn = modal.querySelector(`.edit-card-btn-${card.id}`);
      const deleteBtn = modal.querySelector(`.delete-card-btn-${card.id}`);
      const saveBtn = modal.querySelector(`.save-card-btn-${card.id}`);
      const cancelBtn = modal.querySelector(`.cancel-card-btn-${card.id}`);
      
      if (editBtn) {
        editBtn.onclick = () => this.editCard(card.id);
      }
      
      if (deleteBtn) {
        deleteBtn.onclick = () => this.deleteCard(card.deckId, card.id, folderName);
      }
      
      if (saveBtn) {
        saveBtn.onclick = () => this.saveCardEdit(card.deckId, card.id, folderName);
      }
      
      if (cancelBtn) {
        cancelBtn.onclick = () => this.cancelCardEdit(card.id);
      }
    });
  }

  // ===== FUNÇÃO AUXILIAR PARA ESCAPAR HTML =====
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ===== EDITAR CARTÃO =====
  editCard(cardId) {
    const viewDiv = document.getElementById(`view-${cardId}`);
    const editDiv = document.getElementById(`edit-${cardId}`);
    
    if (viewDiv && editDiv) {
      viewDiv.style.display = 'none';
      editDiv.style.display = 'block';
      
      // Focar no primeiro input
      const frontInput = document.getElementById(`front-${cardId}`);
      if (frontInput) frontInput.focus();
    }
  }

  // ===== CANCELAR EDIÇÃO =====
  cancelCardEdit(cardId) {
    const viewDiv = document.getElementById(`view-${cardId}`);
    const editDiv = document.getElementById(`edit-${cardId}`);
    
    if (viewDiv && editDiv) {
      viewDiv.style.display = 'grid';
      editDiv.style.display = 'none';
    }
  }

  // ===== SALVAR EDIÇÃO DO CARTÃO =====
  async saveCardEdit(deckId, cardId, folderName) {
    const frontInput = document.getElementById(`front-${cardId}`);
    const backInput = document.getElementById(`back-${cardId}`);
    
    if (!frontInput || !backInput) {
      alert('❌ Erro: campos não encontrados.');
      return;
    }
    
    const newFront = frontInput.value.trim();
    const newBack = backInput.value.trim();
    
    if (!newFront || !newBack) {
      alert('⚠️ Preencha ambos os campos!');
      return;
    }
    
    this.showLoading(true);
    
    try {
      // Encontrar o deck
      const deck = this.decks.find(d => d.id === deckId);
      if (!deck) {
        throw new Error('Deck não encontrado');
      }
      
      // Encontrar e atualizar o cartão
      const cardIndex = deck.cards.findIndex(c => c.id === cardId);
      if (cardIndex === -1) {
        throw new Error('Cartão não encontrado');
      }
      
      deck.cards[cardIndex].front = newFront;
      deck.cards[cardIndex].back = newBack;
      
      // Salvar no Firebase
      const deckDocRef = doc(db, 'users', this.user.uid, 'decks', deckId);
      await updateDoc(deckDocRef, {
        cards: deck.cards
      });
      
      // Recarregar dados
      await this.loadUserData();
      
      this.showLoading(false);
      
      alert('✅ Cartão atualizado com sucesso!');
      
      // Fechar e reabrir modal
      this.closeFolderModal();
      setTimeout(() => {
        this.viewFolderCards(folderName);
      }, 100);
      
    } catch (error) {
      console.error('Erro ao salvar cartão:', error);
      this.showLoading(false);
      alert('❌ Erro ao salvar cartão: ' + error.message);
    }
  }

  // ===== EXCLUIR CARTÃO =====
  async deleteCard(deckId, cardId, folderName) {
    if (!confirm('❌ Deseja realmente excluir este cartão?\n\nEsta ação não pode ser desfeita.')) {
      return;
    }
    
    this.showLoading(true);
    
    try {
      // Encontrar o deck
      const deck = this.decks.find(d => d.id === deckId);
      if (!deck) {
        throw new Error('Deck não encontrado');
      }
      
      // Remover o cartão
      deck.cards = deck.cards.filter(c => c.id !== cardId);
      
      // Salvar no Firebase
      const deckDocRef = doc(db, 'users', this.user.uid, 'decks', deckId);
      await updateDoc(deckDocRef, {
        cards: deck.cards
      });
      
      // Recarregar dados
      await this.loadUserData();
      
      this.showLoading(false);
      
      alert('✅ Cartão excluído com sucesso!');
      
      // Fechar e reabrir modal
      this.closeFolderModal();
      setTimeout(() => {
        this.viewFolderCards(folderName);
      }, 100);
      
    } catch (error) {
      console.error('Erro ao excluir cartão:', error);
      this.showLoading(false);
      alert('❌ Erro ao excluir cartão: ' + error.message);
    }
  }

  // ===== EXCLUIR PASTA =====
  async deleteFolder(folderId, folderName) {
    const decksInFolder = this.decks.filter(d => d.folder === folderName);
    
    let confirmMessage = `❌ Deseja realmente excluir a pasta "${folderName}"?\n\n`;
    
    if (decksInFolder.length > 0) {
      confirmMessage += `⚠️ ATENÇÃO: Esta pasta contém ${decksInFolder.length} deck(s)!\n\n`;
      confirmMessage += `Os decks não serão excluídos, apenas ficarão sem pasta.\n\n`;
      confirmMessage += `Tem certeza?`;
    } else {
      confirmMessage += `Esta ação não pode ser desfeita.`;
    }
    
    if (!confirm(confirmMessage)) {
      return;
    }
    
    this.showLoading(true);
    
    try {
      // Remover a pasta do Firebase
      await deleteDoc(doc(db, 'users', this.user.uid, 'folders', folderId));
      
      // Atualizar decks que estavam nesta pasta (remover referência)
      for (const deck of decksInFolder) {
        const deckDocRef = doc(db, 'users', this.user.uid, 'decks', deck.id);
        await updateDoc(deckDocRef, {
          folder: ''
        });
      }
      
      // Recarregar dados
      await this.loadUserData();
      this.render();
      this.showLoading(false);
      
      alert(`✅ Pasta "${folderName}" excluída com sucesso!`);
      
    } catch (error) {
      console.error('Erro ao excluir pasta:', error);
      this.showLoading(false);
      alert('❌ Erro ao excluir pasta: ' + error.message);
    }
  }

  // ===== FECHAR MODAL DE PASTA =====
  closeFolderModal() {
    const modal = document.getElementById('folderCardsModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

// ===== APP.JS - PARTE 6 DE 8 (COMPLETA E CORRIGIDA) =====
// ===== SISTEMA DE ESTUDO (COM ÁUDIO) =====
// ===== PARTE 6: PASTAS E COMPARTILHAMENTO =====

  // ===== APP.JS - PARTE 6 DE 8 (COMPLETA) =====
// ===== SISTEMA DE ESTUDO (COM ÁUDIO PREMIUM) =====

  // ===== INICIAR ESTUDO =====
  startStudy(deckId) {
    const deck = this.decks.find(d => d.id === deckId);
    if (!deck || !deck.cards) return;

    const dueCards = deck.cards.filter(card => this.isCardDue(card));
    
    if (dueCards.length === 0) {
      alert('🎉 Parabéns!\n\nNenhum cartão precisa de revisão neste deck agora.');
      return;
    }

    this.currentDeck = {
      ...deck,
      cards: [...dueCards]
    };

    this.currentCardIndex = 0;
    this.isFlipped = false;

    const studyDeckName = document.getElementById('studyDeckName');
    const typingInput = document.getElementById('typingInput');
    
    if (studyDeckName) studyDeckName.textContent = deck.name;
    if (typingInput) typingInput.value = '';
    
    this.updateStudyCard();
    this.showView('study');
  }

  // ===== ATUALIZAR CARTÃO DE ESTUDO =====
  updateStudyCard() {
    if (!this.currentDeck || !this.currentDeck.cards.length) return;

    const card = this.currentDeck.cards[this.currentCardIndex];
    const progress = `Cartão ${this.currentCardIndex + 1} de ${this.currentDeck.cards.length}`;
    const percent = ((this.currentCardIndex + 1) / this.currentDeck.cards.length) * 100;

    const studyProgress = document.getElementById('studyProgress');
    const studyProgressBar = document.getElementById('studyProgressBar');
    const textEl = document.getElementById('flashcardText');
    const hintEl = document.getElementById('flashcardHint');
    const typingInput = document.getElementById('typingInput');
    const ratingButtons = document.getElementById('ratingButtons');

    if (studyProgress) studyProgress.textContent = progress;
    if (studyProgressBar) studyProgressBar.style.width = percent + '%';

    if (!textEl || !hintEl || !typingInput || !ratingButtons) return;

    // ===== MODO DIGITAÇÃO =====
    if (this.studyMode === 'typing' && !this.isFlipped) {
      textEl.textContent = card.front; // Mostra PORTUGUÊS
      hintEl.innerHTML = 'Digite a resposta em <strong>' + (this.currentDeck.folder || 'outro idioma') + '</strong> e pressione Enter';
      typingInput.style.display = 'block';
      typingInput.focus();
      ratingButtons.style.display = 'none';
      this.removeAudioButton();
    } 
    // ===== MODO NORMAL/REVERSO =====
    else {
      typingInput.style.display = 'none';
      
      if (this.isFlipped) {
        // VERSO: Mostra IDIOMA ESTRANGEIRO + BOTÃO DE ÁUDIO
        textEl.textContent = card.back;
        ratingButtons.style.display = 'block';
        this.addAudioButton(card.back);
      } else {
        // FRENTE: Mostra PORTUGUÊS
        textEl.textContent = card.front;
        ratingButtons.style.display = 'none';
        this.removeAudioButton();
      }
    }
  }

  // ===== ADICIONAR BOTÃO DE ÁUDIO =====
  addAudioButton(text) {
    this.removeAudioButton(); // Remove se já existir

    const hintEl = document.getElementById('flashcardHint');
    if (!hintEl) return;

    const audioBtn = document.createElement('button');
    audioBtn.id = 'audioBtn';
    audioBtn.className = 'flashcard-audio';
    audioBtn.innerHTML = '🔊';
    audioBtn.title = 'Ouvir pronúncia';
    audioBtn.onclick = (e) => {
      e.stopPropagation();
      this.speakText(text);
    };

    hintEl.appendChild(audioBtn);
  }

  // ===== REMOVER BOTÃO DE ÁUDIO =====
  removeAudioButton() {
    const audioBtn = document.getElementById('audioBtn');
    if (audioBtn) {
      audioBtn.remove();
    }
  }

  // ===== FALAR TEXTO (TEXT-TO-SPEECH) - VERSÃO PREMIUM =====

  speakText(text) {
    if (!this.speechSynthesis) {
      alert('⚠️ Seu navegador não suporta síntese de voz.');
      return;
    }

    this.speechSynthesis.cancel(); // Para qualquer fala anterior

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Detectar idioma baseado na pasta do deck ou no campo language
    const folderName = this.currentDeck.language || this.currentDeck.folder || '';
    const langCode = this.getLanguageCode(folderName);
    
    utterance.lang = langCode;
    utterance.rate = 0.85; // Velocidade um pouco mais lenta para melhor compreensão
    utterance.pitch = 1;
    utterance.volume = 1;

    // Tentar selecionar uma voz nativa do idioma
    const voices = this.speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => voice.lang.startsWith(langCode.split('-')[0]));
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      console.log(`🎤 Voz selecionada: ${preferredVoice.name} (${preferredVoice.lang})`);
    } else {
      console.warn(`⚠️ Nenhuma voz nativa encontrada para ${langCode}`);
    }

    this.speechSynthesis.speak(utterance);
    
    console.log(`🔊 Reproduzindo áudio: "${text}" em ${folderName} (${langCode})`);
  }

  // ===== OBTER CÓDIGO DO IDIOMA =====
// ===== OBTER CÓDIGO DO IDIOMA =====
  getLanguageCode(folderName) {
    const languageMap = {
      // Idiomas populares
      'Inglês': 'en-US',
      'Espanhol': 'es-ES',
      'Francês': 'fr-FR',
      'Italiano': 'it-IT',
      'Alemão': 'de-DE',
      'Japonês': 'ja-JP',
      'Coreano': 'ko-KR',
      'Chinês': 'zh-CN',
      'Russo': 'ru-RU',
      'Árabe': 'ar-SA',
      'Hindi': 'hi-IN',
      'Turco': 'tr-TR',
      'Holandês': 'nl-NL',
      'Sueco': 'sv-SE',
      'Norueguês': 'no-NO',
      'Dinamarquês': 'da-DK',
      'Finlandês': 'fi-FI',
      'Polonês': 'pl-PL',
      'Grego': 'el-GR',
      'Hebraico': 'he-IL',
      'Tailandês': 'th-TH',
      'Vietnamita': 'vi-VN',
      'Indonésio': 'id-ID',
      'Malaio': 'ms-MY',
      'Tagalo': 'tl-PH',
      'Ucraniano': 'uk-UA',
      'Tcheco': 'cs-CZ',
      'Húngaro': 'hu-HU',
      'Romeno': 'ro-RO',
      'Búlgaro': 'bg-BG',
      'Croata': 'hr-HR',
      'Sérvio': 'sr-RS',
      'Catalão': 'ca-ES',
      'Persa': 'fa-IR',
      'Swahili': 'sw-KE',
      'Africâner': 'af-ZA',
      'Bengali': 'bn-BD',
      'Urdu': 'ur-PK',
      'Português': 'pt-BR'
    };

    // Buscar o idioma no mapa
    const langCode = languageMap[folderName];
    
    if (langCode) {
      console.log(`🔊 Idioma detectado: ${folderName} -> ${langCode}`);
      return langCode;
    }
    
    // Se não encontrar, tentar buscar parcialmente
    const folderLower = folderName.toLowerCase();
    for (const [key, value] of Object.entries(languageMap)) {
      if (key.toLowerCase().includes(folderLower) || folderLower.includes(key.toLowerCase())) {
        console.log(`🔊 Idioma detectado (parcial): ${folderName} -> ${value}`);
        return value;
      }
    }
    
    // Fallback para inglês se não encontrar
    console.warn(`⚠️ Idioma não reconhecido: ${folderName}, usando inglês como padrão`);
    return 'en-US';
  }

  // ===== CONFIGURAÇÕES OTIMIZADAS POR IDIOMA =====
  getLanguageSettings(folderName) {
    const settings = {
      'Inglês': { rate: 0.85, pitch: 1.0 },
      'Espanhol': { rate: 0.80, pitch: 1.0 },
      'Francês': { rate: 0.80, pitch: 1.0 },
      'Italiano': { rate: 0.85, pitch: 1.0 },
      'Alemão': { rate: 0.75, pitch: 0.95 },
      'Japonês': { rate: 0.75, pitch: 1.15 },
      'Coreano': { rate: 0.80, pitch: 1.1 },
      'Chinês': { rate: 0.75, pitch: 1.15 },
      'Russo': { rate: 0.80, pitch: 0.95 },
      'Árabe': { rate: 0.75, pitch: 1.0 },
      'Português': { rate: 0.85, pitch: 1.0 },
      'Holandês': { rate: 0.85, pitch: 1.0 },
      'Sueco': { rate: 0.85, pitch: 1.05 },
      'Norueguês': { rate: 0.85, pitch: 1.05 },
      'Dinamarquês': { rate: 0.85, pitch: 1.05 },
      'Finlandês': { rate: 0.80, pitch: 1.0 },
      'Polonês': { rate: 0.80, pitch: 1.0 },
      'Turco': { rate: 0.80, pitch: 1.0 },
      'Hindi': { rate: 0.80, pitch: 1.1 },
      'Tailandês': { rate: 0.75, pitch: 1.15 },
      'Vietnamita': { rate: 0.80, pitch: 1.1 },
      'Grego': { rate: 0.80, pitch: 1.0 },
      'Hebraico': { rate: 0.80, pitch: 1.0 },
      'Tcheco': { rate: 0.80, pitch: 1.0 },
      'Húngaro': { rate: 0.80, pitch: 1.0 },
      'Romeno': { rate: 0.80, pitch: 1.0 },
      'Búlgaro': { rate: 0.80, pitch: 1.0 }
    };

    return settings[folderName] || { rate: 0.85, pitch: 1.0 };
  }

  // ===== SELECIONAR MELHOR VOZ (ALGORITMO MELHORADO) =====
  getBestVoiceForLanguage(voices, langCode, folderName) {
    if (!voices || voices.length === 0) {
      console.warn('⚠️ Nenhuma voz disponível no sistema');
      return null;
    }

    const langPrefix = langCode.substring(0, 2);
    
    // 1. Filtrar vozes do idioma
    let matchingVoices = voices.filter(v => v.lang.startsWith(langPrefix));
    
    if (matchingVoices.length === 0) {
      console.warn(`⚠️ Nenhuma voz encontrada para ${langPrefix}`);
      return null;
    }

    console.log(`🔍 ${matchingVoices.length} vozes encontradas para ${folderName}`);

    // 2. Prioridade: Vozes Google (melhor qualidade)
    let googleVoices = matchingVoices.filter(v => 
      v.name.toLowerCase().includes('google') || 
      v.name.includes('(Google)')
    );
    
    if (googleVoices.length > 0) {
      console.log('✅ Usando voz Google');
      return googleVoices[0];
    }

    // 3. Prioridade: Vozes Microsoft
    let microsoftVoices = matchingVoices.filter(v => 
      v.name.toLowerCase().includes('microsoft') ||
      v.name.includes('Microsoft')
    );
    
    if (microsoftVoices.length > 0) {
      console.log('✅ Usando voz Microsoft');
      return microsoftVoices[0];
    }

    // 4. Preferências específicas por idioma
    const preferences = {
      'es': ['Helena', 'Paulina', 'Monica', 'Jorge', 'Diego'],
      'fr': ['Julie', 'Thomas', 'Amelie', 'Celine'],
      'it': ['Elsa', 'Alice', 'Luca', 'Cosimo'],
      'de': ['Hedda', 'Anna', 'Hans', 'Markus'],
      'ja': ['Haruka', 'Kyoko', 'Otoya'],
      'ko': ['Yuna', 'Heami'],
      'zh': ['Huihui', 'Ting-Ting', 'Yaoyao'],
      'ru': ['Irina', 'Milena', 'Yuri'],
      'ar': ['Hoda', 'Maged', 'Laila'],
      'pt': ['Luciana', 'Heloisa', 'Daniel']
    };

    const prefList = preferences[langPrefix] || [];
    for (const pref of prefList) {
      const voice = matchingVoices.find(v => v.name.includes(pref));
      if (voice) {
        console.log(`✅ Usando voz preferida: ${voice.name}`);
        return voice;
      }
    }

    // 5. Vozes locais do idioma exato
    const exactVoices = matchingVoices.filter(v => v.lang === langCode && v.localService);
    if (exactVoices.length > 0) {
      console.log('✅ Usando voz local do sistema');
      return exactVoices[0];
    }

    // 6. Qualquer voz do idioma exato
    const exactMatch = matchingVoices.find(v => v.lang === langCode);
    if (exactMatch) {
      console.log('✅ Usando voz do idioma exato');
      return exactMatch;
    }

    // 7. Primeira voz disponível do idioma
    console.log('⚠️ Usando primeira voz disponível');
    return matchingVoices[0];
  }

  // ===== VIRAR CARTÃO =====
  flipCard() {
    if (this.studyMode === 'typing' && !this.isFlipped) {
      this.checkTypedAnswer();
    } else {
      this.isFlipped = !this.isFlipped;
      this.updateStudyCard();
    }
  }

  // ===== VERIFICAR RESPOSTA DIGITADA =====
  checkTypedAnswer() {
    const input = document.getElementById('typingInput');
    if (!input) return;
    
    const userAnswer = input.value.trim().toLowerCase();
    const card = this.currentDeck.cards[this.currentCardIndex];
    const correctAnswer = card.back.toLowerCase();

    const similarity = this.calculateSimilarity(userAnswer, correctAnswer);
    
    this.isFlipped = true;
    this.updateStudyCard();

    const textEl = document.getElementById('flashcardText');
    if (textEl) {
      if (similarity > 0.8) {
        textEl.style.color = 'var(--success)';
      } else if (similarity > 0.5) {
        textEl.style.color = 'var(--warning)';
      } else {
        textEl.style.color = 'var(--danger)';
      }

      setTimeout(() => {
        textEl.style.color = 'var(--text-primary)';
      }, 2000);
    }
  }

  // ===== CALCULAR SIMILARIDADE (Levenshtein) =====
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

// ===== FIM DA PARTE 6 CORRIGIDA - CONTINUE COM A PARTE 7 =====
// ===== APP.JS - PARTE 7 DE 8 =====
// ===== AVALIAÇÃO DE CARTÕES E NAVEGAÇÃO =====
// ===== SALVAR HISTÓRICO DE ESTUDOS =====
async saveStudyToHistory(correct) {
  if (!this.user) return;

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const userRef = doc(db, 'users', this.user.uid);

  try {
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();
    const studyHistory = userData.studyHistory || {};

    // Inicializa o dia se não existir
    if (!studyHistory[today]) {
      studyHistory[today] = {
        cards: 0,
        correct: 0,
        wrong: 0,
        date: today
      };
    }

    // Atualiza os contadores
    studyHistory[today].cards += 1;
    if (correct) {
      studyHistory[today].correct += 1;
    } else {
      studyHistory[today].wrong += 1;
    }

    // Salva no Firebase
    await updateDoc(userRef, {
      studyHistory: studyHistory
    });

    console.log('✅ Histórico atualizado:', studyHistory[today]);
  } catch (error) {
    console.error('Erro ao salvar histórico:', error);
  }
}
// ===== AVALIAR CARTÃO (CORRIGIDO) =====
 async rateCard(rating) {
  const card = this.currentDeck.cards[this.currentCardIndex];
  const now = new Date();
  
  // ⭐ Salvar histórico - AQUI na ordem certa
  const wasCorrect = rating >= 3;
  await this.saveStudyToHistory(wasCorrect);

  const originalDeck = this.decks.find(d => d.id === this.currentDeck.id);
  const today = now.toISOString().split('T')[0];

  const originalCard = originalDeck.cards.find(c => c.id === card.id);

  originalCard.history.push({
    date: now.toISOString(),
    rating: rating
  });

  if (rating === 1) {
    originalCard.level = 0;
    originalCard.nextReview = new Date(now.getTime() + 60000).toISOString();
    this.stats.totalWrong++;
  } else if (rating === 2) {
    originalCard.level = Math.max(0, (originalCard.level || 0));
    originalCard.nextReview = new Date(now.getTime() + 600000).toISOString();
    this.stats.totalCorrect++;
  } else if (rating === 3) {
    originalCard.level = (originalCard.level || 0) + 1;
    const days = Math.pow(2, originalCard.level);
    originalCard.nextReview = new Date(now.getTime() + days * 86400000).toISOString();
    this.stats.totalCorrect++;
  } else if (rating === 4) {
    originalCard.level = (originalCard.level || 0) + 2;
    const days = Math.pow(2, originalCard.level);
    originalCard.nextReview = new Date(now.getTime() + days * 86400000).toISOString();
    this.stats.totalCorrect++;
  }

  // CORRIGIDO: Incrementar contador diário
  this.stats.studiedToday++;
  
  // CORRIGIDO: Atualizar data e sequência
  const lastStudy = this.stats.lastStudyDate;
  
  if (!lastStudy || lastStudy !== today) {
    // Primeiro card do dia
    if (lastStudy) {
      const lastDate = new Date(lastStudy + 'T00:00:00');
      const todayDate = new Date(today + 'T00:00:00');
      const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        // Estudou ontem - incrementa sequência
        this.stats.streak++;
        console.log('🔥 Sequência incrementada:', this.stats.streak);
      } else if (diffDays > 1) {
        // Quebrou a sequência - começa nova
        this.stats.streak = 1;
        console.log('🆕 Nova sequência iniciada');
      }
    } else {
      // Primeiro estudo de todos
      this.stats.streak = 1;
      console.log('🎯 Primeira sequência!');
    }
    
    this.stats.lastStudyDate = today;
  }

  try {
    const deckDocRef = doc(db, 'users', this.user.uid, 'decks', this.currentDeck.id);
    await updateDoc(deckDocRef, {
      cards: originalDeck.cards
    });
    
    await this.saveStats();
    
    // Atualizar dashboard em tempo real
    this.renderDashboard();
    
  } catch (error) {
    console.error('Erro ao salvar progresso:', error);
  }

  if (this.currentCardIndex < this.currentDeck.cards.length - 1) {
    this.nextCard();
  } else {
    this.finishStudySession();
  }
}

  // ===== FINALIZAR SESSÃO =====
  finishStudySession() {
    const cardsStudied = this.currentDeck.cards.length;
    const accuracy = Math.round((this.stats.totalCorrect / (this.stats.totalCorrect + this.stats.totalWrong)) * 100) || 0;
    
    alert(`🎉 Parabéns!\n\nSessão concluída!\n\n📊 Estatísticas:\n• ${cardsStudied} cartões\n• Acerto: ${accuracy}%\n• Sequência: ${this.stats.streak} dias`);
    
    this.showView('dashboard');
    this.render();
  }

  // ===== PRÓXIMO/ANTERIOR CARTÃO =====
  nextCard() {
    if (this.currentCardIndex < this.currentDeck.cards.length - 1) {
      this.currentCardIndex++;
      this.isFlipped = false;
      const typingInput = document.getElementById('typingInput');
      if (typingInput) typingInput.value = '';
      this.updateStudyCard();
    }
  }

  previousCard() {
    if (this.currentCardIndex > 0) {
      this.currentCardIndex--;
      this.isFlipped = false;
      const typingInput = document.getElementById('typingInput');
      if (typingInput) typingInput.value = '';
      this.updateStudyCard();
    }
  }

// ===== FIM DA PARTE 7 - CONTINUE COM A PARTE 8 =====
// ===== APP.JS - PARTE 8 DE 8 (FINAL) =====
// ===== NOTIFICAÇÕES E EXPORTAR =====

  // ===== SETUP DE NOTIFICAÇÕES - CORRIGIDO =====
  async setupNotifications() {
    const notifToggle = document.getElementById('notificationToggle');
    const notifStatus = document.getElementById('notificationStatus');
    const timeInputs = document.querySelectorAll('.notification-time-input');

    if (!notifToggle || !notifStatus) return;

    // Verificar suporte do navegador
    if (!('Notification' in window)) {
      notifStatus.textContent = '❌ Seu navegador não suporta notificações';
      notifToggle.disabled = true;
      return;
    }

    // Carregar estado atual
    notifToggle.checked = this.settings.notificationsEnabled;
    this.updateNotificationStatus();

    // Carregar horários salvos
    timeInputs.forEach((input, index) => {
      if (this.settings.notificationTimes[index]) {
        input.value = this.settings.notificationTimes[index];
      }
    });

    // Toggle de ativação
    notifToggle.addEventListener('change', async () => {
      if (notifToggle.checked) {
        await this.enableNotifications();
      } else {
        this.disableNotifications();
      }
    });

    // Atualizar horários
    timeInputs.forEach((input, index) => {
      input.addEventListener('change', async () => {
        this.settings.notificationTimes[index] = input.value;
        await this.saveSettings();
        
        console.log('✅ Horário atualizado:', input.value);
        
        if (this.settings.notificationsEnabled) {
          // Reiniciar agendamento
          this.scheduleNotifications();
        }
      });
    });

    // Botão de teste
    const testBtn = document.getElementById('testNotification');
    if (testBtn) {
      testBtn.addEventListener('click', () => this.sendTestNotification());
    }

    // Iniciar verificação se já estiver ativado
    if (this.settings.notificationsEnabled && Notification.permission === 'granted') {
      this.scheduleNotifications();
    }
  }

  // ===== ATIVAR NOTIFICAÇÕES =====
  // ===== ATIVAR NOTIFICAÇÕES =====
  async enableNotifications() {
    try {
      // Verificar HTTPS
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        alert('⚠️ Notificações requerem HTTPS.\n\nInstale o app para usar notificações.');
        const notifToggle = document.getElementById('notificationToggle');
        if (notifToggle) notifToggle.checked = false;
        return;
      }

      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        this.settings.notificationsEnabled = true;
        await this.saveSettings();
        this.updateNotificationStatus();
        this.scheduleNotifications();
        
        new Notification('🎉 Notificações Ativadas!', {
          body: 'Você receberá lembretes para estudar',
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: 'notification-enabled',
          requireInteraction: false
        });
        
        console.log('✅ Notificações ativadas');
        alert('✅ Notificações ativadas!\n\n💡 Dica: Instale o app para melhor experiência.');
      } else if (permission === 'denied') {
        alert('❌ Notificações bloqueadas.\n\nPara ativar:\n\n1. Clique no 🔒 ao lado da URL\n2. Ative "Notificações"\n3. Recarregue a página');
        const notifToggle = document.getElementById('notificationToggle');
        if (notifToggle) notifToggle.checked = false;
      } else {
        const notifToggle = document.getElementById('notificationToggle');
        if (notifToggle) notifToggle.checked = false;
        alert('⚠️ Você precisa permitir notificações.');
      }
    } catch (error) {
      console.error('Erro:', error);
      const notifToggle = document.getElementById('notificationToggle');
      if (notifToggle) notifToggle.checked = false;
      alert('⚠️ Erro ao ativar notificações.\n\nTente instalar o aplicativo.');
    }
  }

  // ===== DESATIVAR NOTIFICAÇÕES =====
  disableNotifications() {
    this.settings.notificationsEnabled = false;
    this.saveSettings();
    this.updateNotificationStatus();
    
    if (this.notificationCheckInterval) {
      clearInterval(this.notificationCheckInterval);
      this.notificationCheckInterval = null;
    }
    
    console.log('🔕 Notificações desativadas');
    alert('🔕 Notificações desativadas.');
  }

  // ===== ATUALIZAR STATUS =====
  updateNotificationStatus() {
    const status = document.getElementById('notificationStatus');
    if (!status) return;
    
    if (!('Notification' in window)) {
      status.textContent = '❌ Navegador não suporta notificações';
      status.style.color = 'var(--danger)';
    } else if (Notification.permission === 'denied') {
      status.textContent = '🚫 Notificações bloqueadas. Habilite nas configurações do navegador.';
      status.style.color = 'var(--danger)';
    } else if (this.settings.notificationsEnabled && Notification.permission === 'granted') {
      status.textContent = '✅ Notificações ativas';
      status.style.color = 'var(--success)';
    } else {
      status.textContent = '⏸️ Notificações desativadas';
      status.style.color = 'var(--text-muted)';
    }
  }

  // ===== AGENDAR NOTIFICAÇÕES - CORRIGIDO =====
  scheduleNotifications() {
    // Limpar intervalo anterior
    if (this.notificationCheckInterval) {
      clearInterval(this.notificationCheckInterval);
    }

    console.log('📅 Agendando notificações...');
    console.log('⏰ Horários:', this.settings.notificationTimes);

    // Verificar a cada 30 segundos (melhor precisão)
    this.notificationCheckInterval = setInterval(() => {
      this.checkAndSendNotification();
    }, 30000); // 30 segundos

    // Fazer primeira verificação imediatamente
    this.checkAndSendNotification();
  }

  // ===== VERIFICAR E ENVIAR NOTIFICAÇÃO - CORRIGIDO =====
  checkAndSendNotification() {
    if (!this.settings.notificationsEnabled || Notification.permission !== 'granted') {
      return;
    }

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    console.log('🕐 Hora atual:', currentTime);
    console.log('⏰ Horários configurados:', this.settings.notificationTimes);

    // Verificar se é hora de notificar
    const shouldNotify = this.settings.notificationTimes.some(time => {
      // Comparar apenas hora:minuto
      return time === currentTime;
    });

    if (shouldNotify) {
      const lastNotifKey = `lastNotif_${this.user.uid}_${currentTime}`;
      const lastNotif = localStorage.getItem(lastNotifKey);
      const today = now.toISOString().substring(0, 10); // YYYY-MM-DD
      
      console.log('🔔 Horário de notificação detectado!');
      console.log('📅 Última notificação:', lastNotif);
      console.log('📅 Hoje:', today);

      // Enviar apenas uma vez por dia para cada horário
      if (lastNotif !== today) {
        console.log('📨 Enviando notificação...');
        this.sendStudyReminder();
        localStorage.setItem(lastNotifKey, today);
      } else {
        console.log('⏭️ Notificação já enviada hoje para este horário');
      }
    }
  }

  // ===== ENVIAR LEMBRETE DE ESTUDO =====
  sendStudyReminder() {
    let totalDue = 0;
    this.decks.forEach(deck => {
      if (deck.cards) {
        totalDue += deck.cards.filter(card => this.isCardDue(card)).length;
      }
    });

    console.log('📊 Cartões pendentes:', totalDue);

    if (totalDue === 0) {
      new Notification('🎉 Parabéns!', {
        body: 'Você está em dia com seus estudos!',
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: 'study-reminder',
        requireInteraction: false
      });
    } else {
      new Notification('📚 Hora de Estudar!', {
        body: `Você tem ${totalDue} cartão${totalDue > 1 ? 'ões' : ''} para revisar`,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: 'study-reminder',
        requireInteraction: true
      });
    }

    console.log('✅ Notificação enviada!');
  }

  // ===== ENVIAR NOTIFICAÇÃO DE TESTE =====
  sendTestNotification() {
    if (Notification.permission !== 'granted') {
      alert('⚠️ Você precisa permitir notificações primeiro!');
      return;
    }

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const totalDue = this.decks.reduce((sum, deck) => {
      return sum + (deck.cards ? deck.cards.filter(card => this.isCardDue(card)).length : 0);
    }, 0);

    new Notification('🧪 Notificação de Teste', {
      body: `Funcionando! 🎉\n\n⏰ Hora atual: ${currentTime}\n📊 Cartões pendentes: ${totalDue}\n\n✅ Suas notificações estão configuradas!`,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      requireInteraction: true
    });

    console.log('🧪 Notificação de teste enviada');
    console.log('⏰ Horários configurados:', this.settings.notificationTimes);
    
    alert(`✅ Notificação de teste enviada!\n\n⏰ Hora atual: ${currentTime}\n📊 Cartões pendentes: ${totalDue}`);
  }

  // ===== EXPORTAR DADOS =====
  async exportData() {
    try {
      const data = {
        decks: this.decks,
        folders: this.folders,
        stats: this.stats,
        settings: this.settings,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };

      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `flashcards-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      
      alert('✅ Dados exportados com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert('❌ Erro ao exportar dados.');
    }
  }

  // ===== IMPORTAR DADOS =====
  importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.decks || !data.folders) {
          alert('⚠️ Arquivo inválido.');
          return;
        }

        if (!confirm('⚠️ Importar dados? Isso substituirá seus dados atuais.\n\nTem certeza?')) {
          return;
        }

        this.showLoading(true);

        // Importar decks
        for (const deck of data.decks) {
          const deckData = { ...deck };
          delete deckData.id;
          await addDoc(collection(db, 'users', this.user.uid, 'decks'), deckData);
        }

        // Importar folders
        for (const folder of data.folders) {
          const folderData = { ...folder };
          delete folderData.id;
          await addDoc(collection(db, 'users', this.user.uid, 'folders'), folderData);
        }

        await this.loadUserData();
        this.render();
        this.showLoading(false);

        alert('✅ Dados importados com sucesso!');
      } catch (error) {
        console.error('Erro ao importar:', error);
        this.showLoading(false);
        alert('❌ Erro ao importar dados. Verifique o arquivo.');
      }
    };

    input.click();
  }

  // ===== COMPARTILHAR CARD (PLACEHOLDER) =====
  shareCard(deckId) {
    alert('🔜 Funcionalidade de compartilhamento em desenvolvimento!\n\nEm breve você poderá compartilhar seus decks com outros usuários.');
  }

  // ===== COMPARTILHAR EXTERNO (PLACEHOLDER) =====
  shareExternal(deckId) {
    const deck = this.decks.find(d => d.id === deckId);
    if (!deck) return;

    if (navigator.share) {
      navigator.share({
        title: deck.name,
        text: `Confira meu deck de flashcards: ${deck.name}\n${deck.cards?.length || 0} cartões para estudar!`,
        url: window.location.href
      }).catch(err => console.log('Erro ao compartilhar:', err));
    } else {
      alert('🔜 Compartilhamento externo em desenvolvimento!');
    }
  }
}

// ===== INICIALIZAÇÃO DO APP =====
const app = new FlashcardsApp();
window.app = app;

console.log('✅ Flashcards Pro iniciado com sucesso!');

// ===== FIM DO ARQUIVO APP.JS =====