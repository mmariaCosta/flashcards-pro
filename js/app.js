// app.js - Flashcards Pro (versão consolidada e corrigida - 2026)
// Maria Eduarda - projeto completo com correções

import { auth, db } from './firebase-config.js';
import { 
  onAuthStateChanged, 
  signOut 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
  doc, getDoc, updateDoc, setDoc,
  collection, getDocs, addDoc, deleteDoc,
  serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { EXAMPLE_DECKS } from './example-decks.js';

class FlashcardsApp {
  constructor() {
    this.user = null;
    this.userData = null;
    this.decks = [];
    this.folders = [];

    this.stats = {
      studiedToday: 0,
      totalCorrect: 0,
      totalWrong: 0,
      streak: 0,
      lastStudyDate: null
    };

    this.settings = {
      newCardsPerDay: 20,
      reviewsPerDay: 100,
      notificationsEnabled: false,
      notificationTimes: ['09:00', '14:00', '19:00']
    };

    this.currentDeck = null;
    this.currentCardIndex = 0;
    this.isFlipped = false;
    this.studyMode = 'normal';

    this.notificationCheckInterval = null;
    this.speechSynthesis = window.speechSynthesis;

    this.init();
  }

async init() {
  console.log('=== DEBUG MODE ATIVADO ===');
  console.log('Iniciando app...');

  this.showLoading(true);

  this.setupPWA();

  onAuthStateChanged(auth, async (user) => {
    console.log('onAuthStateChanged → User:', user ? user.uid : 'NENHUM USUÁRIO LOGADO');

    if (user) {
      this.user = user;
      console.log('Usuário logado! UID:', user.uid);

      console.log('Iniciando loadUserData()...');
      try {
        await this.loadUserData();
        console.log('loadUserData() concluído com sucesso');
      } catch (err) {
        console.error('ERRO GRAVE EM loadUserData():', err);
        alert('Erro ao carregar seus dados: ' + err.message);
      }

      console.log('Configurando interface (setupUI)...');
      try {
        this.setupUI();
        console.log('setupUI concluído');
      } catch (err) {
        console.error('ERRO EM setupUI():', err);
      }

      console.log('Renderizando tudo...');
      this.render();

      // FORÇAR EXIBIÇÃO MESMO SE ALGO TRAVAR
      console.log('Forçando fim do loading em 5 segundos...');
      setTimeout(() => {
        this.showLoading(false);
        console.log('Loading FORÇADO a encerrar');
        this.showView('dashboard'); // força abrir dashboard
      }, 5000);

    } else {
      console.log('Sem usuário → redirecionando para login');
      window.location.href = 'login.html';
    }
  });
}
  // ... continua na Parte 2
    // ============================================================================
  // LOADING e PWA
  // ============================================================================
  showLoading(show) {
    const loader = document.getElementById('loading');
    if (loader) {
      loader.style.display = show ? 'flex' : 'none';
    }
  }

  setupPWA() {
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      const installPrompt = document.getElementById('installPrompt');
      if (installPrompt) installPrompt.style.display = 'block';
      console.log('PWA: Pronto para prompt de instalação');
    });

    const installButton = document.getElementById('installButton');
    if (installButton) {
      installButton.addEventListener('click', async () => {
        if (!deferredPrompt) {
          alert('Para instalar: Menu do navegador → Instalar app (ou Adicionar à tela inicial no mobile)');
          return;
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          console.log('App instalado pelo usuário');
        }
        deferredPrompt = null;
      });
    }

    window.addEventListener('appinstalled', () => {
      console.log('PWA instalado com sucesso');
      const installPrompt = document.getElementById('installPrompt');
      if (installPrompt) installPrompt.style.display = 'none';
    });
  }

  // ============================================================================
  // CARREGAMENTO DE DADOS DO USUÁRIO
  // ============================================================================
  async loadUserData() {
  console.log('=== loadUserData INICIADO ===');
  if (!this.user || !this.user.uid) {
    console.error('ERRO: Nenhum usuário autenticado no loadUserData');
    alert('Você precisa estar logado para carregar os dados.');
    this.showLoading(false);
    return;
  }

  console.log('UID do usuário:', this.user.uid);

  try {
    console.log('Buscando documento do usuário...');
    const userRef = doc(db, 'users', this.user.uid);
    const userSnap = await getDoc(userRef);

    console.log('getDoc concluído. Exists?', userSnap.exists());

    if (userSnap.exists()) {
      console.log('Dados do usuário encontrados!');
      this.userData = userSnap.data();
      this.stats = this.userData.stats || this.stats;
      this.settings = this.userData.settings || this.settings;

      const nameEl = document.getElementById('userName');
      if (nameEl) {
        nameEl.textContent = this.userData.nome || this.user.email.split('@')[0];
        console.log('Nome atualizado:', nameEl.textContent);
      }
    } else {
      console.warn('Documento do usuário NÃO existe → criando perfil básico');
      await setDoc(userRef, {
        nome: this.user.displayName || 'Usuário',
        email: this.user.email,
        criadoEm: serverTimestamp(),
        stats: { ...this.stats },
        settings: { ...this.settings }
      });
      console.log('Perfil básico criado');
      // Recarrega para pegar o novo doc
      const newSnap = await getDoc(userRef);
      this.userData = newSnap.data();
    }

    console.log('Carregando decks...');
    const decksSnap = await getDocs(collection(db, 'users', this.user.uid, 'decks'));
    this.decks = decksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log('Decks carregados:', this.decks.length);

    console.log('Carregando pastas...');
    const foldersSnap = await getDocs(collection(db, 'users', this.user.uid, 'folders'));
    this.folders = foldersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log('Pastas carregadas:', this.folders.length);

    console.log('Verificando stats diárias...');
    await this.checkAndResetDailyStats();

    console.log('=== loadUserData FINALIZADO COM SUCESSO ===');

  } catch (error) {
    console.error('ERRO GRAVE NO loadUserData:', error.code, error.message);
    alert('Erro ao carregar seus dados:\n' + error.message + '\n\nVerifique o console para detalhes.');
  } finally {
    this.showLoading(false);
    console.log('Loading finalizado (com ou sem erro)');
  }
}

  async checkAndResetDailyStats() {
    const today = new Date().toISOString().split('T')[0];
    const lastStudy = this.stats.lastStudyDate;

    if (!lastStudy) {
      this.stats.studiedToday = 0;
      this.stats.streak = 0;
      await this.saveStats();
      return;
    }

    if (lastStudy !== today) {
      const lastDate = new Date(lastStudy);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate - lastDate) / (86400000));

      this.stats.studiedToday = 0;

      if (diffDays === 1) {
        this.stats.streak++;
      } else if (diffDays > 1) {
        this.stats.streak = 0;
      }

      this.stats.lastStudyDate = today;
      await this.saveStats();
    }
  }

  async saveStats() {
    if (!this.user) return;
    try {
      await updateDoc(doc(db, 'users', this.user.uid), {
        stats: this.stats
      });
    } catch (err) {
      console.error('Erro ao salvar estatísticas:', err);
    }
  }

  // ... continua na Parte 3
    // ============================================================================
  // CONFIGURAÇÕES E SALVAR SETTINGS
  // ============================================================================
  async saveSettings() {
    try {
      const newCardsEl = document.getElementById('settingNewCards');
      const reviewsEl = document.getElementById('settingReviews');

      if (newCardsEl) this.settings.newCardsPerDay = parseInt(newCardsEl.value) || 20;
      if (reviewsEl) this.settings.reviewsPerDay = parseInt(reviewsEl.value) || 100;

      await updateDoc(doc(db, 'users', this.user.uid), {
        settings: this.settings
      });

      alert('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      alert('Erro ao salvar configurações.');
    }
  }

  // ============================================================================
  // SETUP DA INTERFACE (UI) - CHAMADO APÓS LOGIN
  // ============================================================================
  setupUI() {
    this.setupNavigation();
    this.setupMenu();
    this.setupFolderSelector();
    this.setupModeSelector();
    this.setupTypingMode();
    this.setupFlashcardClick();
    this.setupNotifications();
    this.setupLogout();

    // Carregar valores atuais nas configurações
    const newCardsEl = document.getElementById('settingNewCards');
    const reviewsEl = document.getElementById('settingReviews');
    if (newCardsEl) newCardsEl.value = this.settings.newCardsPerDay;
    if (reviewsEl) reviewsEl.value = this.settings.reviewsPerDay;
  }

  // ============================================================================
  // NAVEGAÇÃO ENTRE VIEWS
  // ============================================================================
  setupNavigation() {
    document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view) {
          this.showView(view);
          document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
      });
    });
  }

  showView(viewName) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    const targetView = document.getElementById(viewName);
    if (targetView) {
      targetView.classList.add('active');

      // Renderizar conteúdo específico da view
      if (viewName === 'dashboard') this.renderDashboard();
      if (viewName === 'decks') this.renderDecks();
      if (viewName === 'folders') this.renderFolders();
      if (viewName === 'examples') this.renderExampleDecks();
    }

    // Fecha menu mobile após clicar em item
    if (window.innerWidth <= 1024) {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('overlay');
      const toggle = document.getElementById('menuToggle');
      if (sidebar) sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('active');
      if (toggle) toggle.classList.remove('active');
    }
  }

  // ============================================================================
  // MENU LATERAL (SIDEBAR) - MOBILE RESPONSIVO
  // ============================================================================
  setupMenu() {
    const toggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');

    if (!toggle || !sidebar || !overlay) return;

    const toggleSidebar = (forceClose = false) => {
      const isOpen = sidebar.classList.contains('open');
      if (forceClose || isOpen) {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        toggle.classList.remove('active');
      } else {
        sidebar.classList.add('open');
        overlay.classList.add('active');
        toggle.classList.add('active');
      }
    };

    toggle.addEventListener('click', () => toggleSidebar());
    overlay.addEventListener('click', () => toggleSidebar(true));

    // Auto-fechar em telas pequenas ao navegar
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024) {
        toggleSidebar(true); // fecha em desktop
      }
    });
  }

  // ============================================================================
  // LOGOUT
  // ============================================================================
  setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        if (confirm('Deseja realmente sair?')) {
          try {
            await signOut(auth);
            // onAuthStateChanged redireciona automaticamente
          } catch (err) {
            console.error('Erro ao fazer logout:', err);
            alert('Erro ao sair. Tente novamente.');
          }
        }
      });
    }
  }

  // ... continua na Parte 4 (renderDashboard + renderDecks + criar deck + etc.)
    // ============================================================================
  // RENDERIZAÇÃO DO DASHBOARD
  // ============================================================================
renderDashboard() {
  // 1. Plano personalizado (mantém o que já tinha)
  const planContent = document.getElementById('planContent');
  if (planContent && this.userData?.planoDeEstudos) {
    const plano = this.userData.planoDeEstudos;
    planContent.innerHTML = `
      <p><strong>Objetivo:</strong> ${this.userData.objetivo || 'Não definido'}</p>
      <p><strong>Idiomas:</strong> ${plano.idiomas?.join(', ') || 'Nenhum'}</p>
      <p><strong>Tempo diário sugerido:</strong> ${this.userData.tempoDiario || '?'} min</p>
      <p><strong>Meta diária:</strong> ${this.userData.metaDiaria || '?'} cartões</p>
      <h4 style="margin-top:1rem;">Recomendações:</h4>
      <ul>${plano.recomendacoes?.map(r => `<li>${r}</li>`).join('') || '<li>Sem recomendações personalizadas ainda</li>'}</ul>
    `;
  }

  // 2. Estatísticas básicas
  const statToday      = document.getElementById('statToday');
  const statStreak     = document.getElementById('statStreak');
  const statAccuracy   = document.getElementById('statAccuracy');
  const statDecks      = document.getElementById('statDecks');
  const statCards      = document.getElementById('statCards');
  const statReviews    = document.getElementById('statReviews'); // se existir no HTML

  if (statToday)    statToday.textContent    = this.stats.studiedToday;
  if (statStreak)   statStreak.textContent   = this.stats.streak || 0;

  // Precisão geral (totalCorrect / total estudados)
  const totalStudied = this.stats.totalCorrect + this.stats.totalWrong;
  const accuracy = totalStudied > 0 ? Math.round((this.stats.totalCorrect / totalStudied) * 100) : 0;
  if (statAccuracy) statAccuracy.textContent = accuracy + '%';

  if (statDecks)    statDecks.textContent    = this.decks.length;

  const totalCards = this.decks.reduce((sum, d) => sum + (d.cards?.length || 0), 0);
  if (statCards)    statCards.textContent    = totalCards;

  // Cartões pendentes de revisão hoje
  let pendingReviews = 0;
  this.decks.forEach(deck => {
    if (deck.cards) {
      pendingReviews += deck.cards.filter(c => this.isCardDue(c)).length;
    }
  });
  if (statReviews) statReviews.textContent = pendingReviews;

  // 3. Análise textual inteligente baseada nos dados reais
  const analysisEl = document.getElementById('analysisText'); // <-- adicione esse elemento no HTML se não tiver
  if (analysisEl) {
    let analysis = '';

    if (this.stats.studiedToday === 0) {
      analysis = 'Hoje você ainda não estudou. Que tal começar agora? 📚';
    } else if (this.stats.studiedToday < 5) {
      analysis = `Você estudou ${this.stats.studiedToday} cartões hoje. Bom começo! Continue assim.`;
    } else {
      analysis = `Ótimo! ${this.stats.studiedToday} cartões estudados hoje.`;
    }

    if (accuracy > 80) {
      analysis += ' Sua precisão está excelente (' + accuracy + '%). Parabéns!';
    } else if (accuracy > 60) {
      analysis += ' Precisão boa (' + accuracy + '%). Foque nas revisões para melhorar.';
    } else if (totalStudied > 0) {
      analysis += ' Precisão de ' + accuracy + '%. Vamos revisar mais para subir esse número!';
    }

    if (this.stats.streak >= 7) {
      analysis += `\n\n🔥 Sequência de ${this.stats.streak} dias! Não quebre agora!`;
    } else if (this.stats.streak >= 3) {
      analysis += `\nSequência atual: ${this.stats.streak} dias. Mantenha o ritmo!`;
    }

    if (pendingReviews > 0) {
      analysis += `\n\nVocê tem ${pendingReviews} revisão(ões) pendente(s) hoje. Priorize!`;
    } else {
      analysis += '\n\nVocê está em dia com todas as revisões. Excelente!';
    }

    analysisEl.textContent = analysis;
  }

  // 4. Revisões pendentes (cards que precisam ser revistos)
  const reviewContainer = document.getElementById('reviewCards');
  if (reviewContainer) {
    reviewContainer.innerHTML = '';

    const dueDecks = this.decks.filter(d => d.cards?.some(c => this.isCardDue(c)));

    if (dueDecks.length === 0) {
      reviewContainer.innerHTML = `
        <div class="empty-state">
          <h3>Você está em dia! 🎉</h3>
          <p>Todas as revisões foram concluídas.</p>
        </div>
      `;
    } else {
      dueDecks.forEach(deck => {
        const count = deck.cards.filter(c => this.isCardDue(c)).length;
        const item = document.createElement('div');
        item.className = 'card';
        item.innerHTML = `
          <div class="card-title">${deck.name}</div>
          <div>${count} revisão(ões) pendente(s)</div>
        `;
        item.onclick = () => this.startStudy(deck.id);
        reviewContainer.appendChild(item);
      });
    }
  }
}

  isCardDue(card) {
    if (!card.nextReview) return true;
    return new Date(card.nextReview) <= new Date();
  }

  // ============================================================================
  // RENDERIZAÇÃO DE DECKS (Meus Cards)
  // ============================================================================
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
      const dueCount = deck.cards?.filter(c => this.isCardDue(c)).length || 0;
      const newCount = deck.cards?.filter(c => !c.level || c.level === 0).length || 0;

      const cardEl = document.createElement('div');
      cardEl.className = 'card';
      cardEl.innerHTML = `
        <div class="card-title">${deck.name}</div>
        <div class="card-subtitle">${deck.description || 'Sem descrição'}</div>
        ${deck.language ? `<div style="color: var(--text-muted);">📚 ${deck.language}</div>` : ''}
        <div class="card-stats">
          <div><span>⏰</span> ${dueCount} pendentes</div>
          <div><span>✨</span> ${newCount} novos</div>
          <div><span>📝</span> ${deck.cards?.length || 0} total</div>
        </div>
        <div class="card-actions">
          <button onclick="app.startStudy('${deck.id}')">📖 Estudar</button>
          <button onclick="app.deleteDeck('${deck.id}')" class="danger">🗑️ Excluir</button>
        </div>
      `;
      container.appendChild(cardEl);
    });
  }

  // ... continua na Parte 5 (criar deck, salvar deck, delete deck, import example, etc.)
    // ============================================================================
  // CRIAÇÃO E SALVAMENTO DE NOVO DECK
  // ============================================================================
  async saveDeck() {
    const nameEl = document.getElementById('deckName');
    const descEl = document.getElementById('deckDesc');
    const langEl = document.getElementById('deckLanguage');
    const folderSelect = document.getElementById('deckFolder');
    const newFolderEl = document.getElementById('newFolderName');
    const cardsTextEl = document.getElementById('deckCards');

    const name = nameEl?.value.trim();
    const desc = descEl?.value.trim();
    const lang = langEl?.value.trim();
    let folder = folderSelect?.value;
    const newFolderName = newFolderEl?.value.trim();
    const cardsText = cardsTextEl?.value.trim();

    if (!name || !cardsText) {
      alert('Preencha o nome do deck e adicione cartões!');
      return;
    }

    const lines = cardsText.split('\n').filter(l => l.trim());
    if (lines.length < 2 || lines.length % 2 !== 0) {
      alert('Adicione pares de linhas: frente (português) e verso (idioma estrangeiro).');
      return;
    }

    this.showLoading(true);

    try {
      // Criar pasta nova se necessário
      if (folder === '__new__' && newFolderName) {
        const exists = this.folders.some(f => f.name === newFolderName);
        if (!exists) {
          await addDoc(collection(db, 'users', this.user.uid, 'folders'), {
            name: newFolderName,
            createdAt: serverTimestamp()
          });
        }
        folder = newFolderName;
      }

      // Criar cartões
      const cards = [];
      for (let i = 0; i < lines.length; i += 2) {
        cards.push({
          id: Date.now() + i,
          front: lines[i].trim(),
          back: lines[i + 1].trim(),
          level: 0,
          nextReview: new Date().toISOString(),
          history: [],
          createdAt: serverTimestamp()
        });
      }

      const newDeck = {
        name,
        description: desc || '',
        language: lang || folder || 'Geral',
        folder: folder || '',
        cards,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'users', this.user.uid, 'decks'), newDeck);

      await this.loadUserData();
      this.render();
      this.showView('decks');
      alert(`Deck "${name}" criado com ${cards.length} cartões!`);

    } catch (error) {
      console.error('Erro ao salvar deck:', error);
      alert('Erro ao criar deck. Tente novamente.');
    } finally {
      this.showLoading(false);
    }
  }

  // ============================================================================
  // EXCLUIR DECK
  // ============================================================================
  async deleteDeck(deckId) {
    const deck = this.decks.find(d => d.id === deckId);
    if (!deck) return;

    if (!confirm(`Excluir "${deck.name}"?\nEsta ação não pode ser desfeita.`)) return;

    this.showLoading(true);

    try {
      await deleteDoc(doc(db, 'users', this.user.uid, 'decks', deckId));
      await this.loadUserData();
      this.render();
      alert('Deck excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir deck:', error);
      alert('Erro ao excluir deck.');
    } finally {
      this.showLoading(false);
    }
  }

  // ============================================================================
  // DECKS DE EXEMPLO - RENDER E IMPORTAR
  // ============================================================================
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
          <div><span>🌍</span> ${deck.language}</div>
          <div><span>📝</span> ${deck.cards.length} cartões</div>
        </div>
        <button class="btn btn-primary" style="margin-top:1rem; width:100%;">
          ➕ Importar
        </button>
      `;

      card.querySelector('button').addEventListener('click', () => this.importExampleDeck(key));
      container.appendChild(card);
    });
  }

  async importExampleDeck(key) {
    const example = EXAMPLE_DECKS[key];
    if (!example) return;

    this.showLoading(true);

    try {
      const cards = example.cards.map((c, i) => ({
        id: Date.now() + i,
        front: c.front,
        back: c.back,
        level: 0,
        nextReview: new Date().toISOString(),
        history: [],
        createdAt: serverTimestamp()
      }));

      const newDeck = {
        name: example.name,
        description: example.description,
        language: example.language,
        folder: example.language.split(' ')[0] || '',
        cards,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'users', this.user.uid, 'decks'), newDeck);

      // Criar pasta se não existir
      const folderName = example.language.split(' ')[0];
      if (folderName && !this.folders.some(f => f.name === folderName)) {
        await addDoc(collection(db, 'users', this.user.uid, 'folders'), {
          name: folderName,
          createdAt: serverTimestamp()
        });
      }

      await this.loadUserData();
      this.render();
      alert(`Deck de exemplo "${example.name}" importado com sucesso!`);

    } catch (error) {
      console.error('Erro ao importar exemplo:', error);
      alert('Erro ao importar deck de exemplo.');
    } finally {
      this.showLoading(false);
    }
  }

  // ... continua na Parte 6 (sistema de estudo: startStudy, updateStudyCard, flipCard, TTS, etc.)
    // ============================================================================
  // SISTEMA DE ESTUDO - INICIAR, ATUALIZAR CARTÃO, VIRAR, ÁUDIO TTS
  // ============================================================================
  startStudy(deckId) {
    const deck = this.decks.find(d => d.id === deckId);
    if (!deck || !deck.cards?.length) {
      alert('Este deck não tem cartões para estudar.');
      return;
    }

    const dueCards = deck.cards.filter(c => this.isCardDue(c));
    if (dueCards.length === 0) {
      alert('Parabéns! Nenhum cartão precisa de revisão neste deck agora.');
      return;
    }

    this.currentDeck = { ...deck, cards: [...dueCards] };
    this.currentCardIndex = 0;
    this.isFlipped = false;

    const deckNameEl = document.getElementById('studyDeckName');
    const typingInput = document.getElementById('typingInput');

    if (deckNameEl) deckNameEl.textContent = deck.name;
    if (typingInput) typingInput.value = '';

    this.updateStudyCard();
    this.showView('study');
  }

  updateStudyCard() {
    if (!this.currentDeck || !this.currentDeck.cards.length) return;

    const card = this.currentDeck.cards[this.currentCardIndex];
    const progressEl = document.getElementById('studyProgress');
    const progressBar = document.getElementById('studyProgressBar');
    const textEl = document.getElementById('flashcardText');
    const hintEl = document.getElementById('flashcardHint');
    const typingInput = document.getElementById('typingInput');
    const ratingButtons = document.getElementById('ratingButtons');

    const progress = `Cartão ${this.currentCardIndex + 1} de ${this.currentDeck.cards.length}`;
    const percent = ((this.currentCardIndex + 1) / this.currentDeck.cards.length) * 100;

    if (progressEl) progressEl.textContent = progress;
    if (progressBar) progressBar.style.width = `${percent}%`;

    if (!textEl || !hintEl) return;

    if (this.studyMode === 'typing' && !this.isFlipped) {
      textEl.textContent = card.front;
      hintEl.innerHTML = `Digite a tradução em <strong>${this.currentDeck.language || 'idioma'}</strong> e pressione Enter`;
      typingInput.style.display = 'block';
      typingInput.focus();
      if (ratingButtons) ratingButtons.style.display = 'none';
      this.removeAudioButton();
    } else {
      typingInput.style.display = 'none';

      if (this.isFlipped) {
        textEl.textContent = card.back;
        if (ratingButtons) ratingButtons.style.display = 'grid';
        this.addAudioButton(card.back);
      } else {
        textEl.textContent = card.front;
        if (ratingButtons) ratingButtons.style.display = 'none';
        this.removeAudioButton();
      }
    }
  }

  addAudioButton(text) {
    this.removeAudioButton();
    const hintEl = document.getElementById('flashcardHint');
    if (!hintEl) return;

    const btn = document.createElement('button');
    btn.id = 'audioBtn';
    btn.innerHTML = '🔊 Ouvir';
    btn.style.marginLeft = '1rem';
    btn.onclick = (e) => {
      e.stopPropagation();
      this.speakText(text);
    };
    hintEl.appendChild(btn);
  }

  removeAudioButton() {
    document.getElementById('audioBtn')?.remove();
  }

  speakText(text) {
    if (!this.speechSynthesis) {
      alert('Seu navegador não suporta síntese de voz.');
      return;
    }

    this.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const langCode = this.getLanguageCode(this.currentDeck?.language || this.currentDeck?.folder || '');

    utterance.lang = langCode;
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = this.speechSynthesis.getVoices();
    const bestVoice = this.getBestVoiceForLanguage(voices, langCode, this.currentDeck?.language);
    if (bestVoice) utterance.voice = bestVoice;

    this.speechSynthesis.speak(utterance);
  }

  getLanguageCode(name) {
    const map = {
      'Inglês': 'en-US',
      'Espanhol': 'es-ES',
      'Francês': 'fr-FR',
      'Alemão': 'de-DE',
      'Italiano': 'it-IT',
      'Japonês': 'ja-JP',
      'Coreano': 'ko-KR',
      'Chinês': 'zh-CN',
      'Português': 'pt-BR',
      // ... adicione mais se quiser
    };
    return map[name] || 'en-US'; // fallback
  }

  getBestVoiceForLanguage(voices, langCode) {
    if (!voices?.length) return null;
    return voices.find(v => v.lang === langCode) || voices.find(v => v.lang.startsWith(langCode.split('-')[0])) || null;
  }

  flipCard() {
    if (this.studyMode === 'typing' && !this.isFlipped) {
      this.checkTypedAnswer();
    } else {
      this.isFlipped = !this.isFlipped;
      this.updateStudyCard();
    }
  }

  checkTypedAnswer() {
    const input = document.getElementById('typingInput');
    if (!input) return;

    const answer = input.value.trim().toLowerCase();
    const card = this.currentDeck.cards[this.currentCardIndex];
    const correct = card.back.toLowerCase();

    const similarity = this.calculateSimilarity(answer, correct);
    this.isFlipped = true;
    this.updateStudyCard();

    // Feedback visual
    const textEl = document.getElementById('flashcardText');
    if (textEl) {
      textEl.style.color = similarity > 0.85 ? 'var(--success)' : similarity > 0.6 ? 'var(--warning)' : 'var(--danger)';
      setTimeout(() => { textEl.style.color = ''; }, 1500);
    }
  }

  calculateSimilarity(a, b) {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    const matrix = Array(b.length + 1).fill().map(() => Array(a.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,          // deleção
          matrix[j - 1][i] + 1,          // inserção
          matrix[j - 1][i - 1] + indicator // substituição
        );
      }
    }
    const distance = matrix[b.length][a.length];
    return 1 - distance / Math.max(a.length, b.length);
  }

  setupTypingMode() {
    const input = document.getElementById('typingInput');
    if (input) {
      input.addEventListener('keypress', e => {
        if (e.key === 'Enter' && this.studyMode === 'typing') {
          this.checkTypedAnswer();
        }
      });
    }
  }

  setupFlashcardClick() {
    const container = document.getElementById('flashcardContainer');
    if (container) {
      container.addEventListener('click', () => this.flipCard());
    }
  }

  // ... continua na Parte 7 (rateCard, saveStudyToHistory, finish session, next/previous card)
    // ============================================================================
  // AVALIAÇÃO DE CARTÕES E PROGRESSO
  // ============================================================================
  async rateCard(rating) {
    if (!this.currentDeck || this.currentCardIndex >= this.currentDeck.cards.length) return;

    const card = this.currentDeck.cards[this.currentCardIndex];
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Salvar histórico de estudo
    await this.saveStudyToHistory(rating >= 3);

    // Atualizar o cartão original no deck principal
    const originalDeck = this.decks.find(d => d.id === this.currentDeck.id);
    if (!originalDeck) return;

    const originalCard = originalDeck.cards.find(c => c.id === card.id);
    if (!originalCard) return;

    originalCard.history = originalCard.history || [];
    originalCard.history.push({
      date: now.toISOString(),
      rating
    });

    // Atualizar nível e próxima revisão (algoritmo simples de spaced repetition)
    if (rating === 1) {
      originalCard.level = 0;
      originalCard.nextReview = new Date(now.getTime() + 1 * 60000).toISOString(); // +1 min
      this.stats.totalWrong++;
    } else if (rating === 2) {
      originalCard.level = Math.max(0, (originalCard.level || 0) - 1);
      originalCard.nextReview = new Date(now.getTime() + 10 * 60000).toISOString(); // +10 min
      this.stats.totalCorrect++;
    } else if (rating >= 3) {
      originalCard.level = (originalCard.level || 0) + (rating === 4 ? 2 : 1);
      const days = Math.pow(2, originalCard.level);
      originalCard.nextReview = new Date(now.getTime() + days * 86400000).toISOString();
      this.stats.totalCorrect++;
    }

    // Atualizar stats globais
    this.stats.studiedToday++;
    this.stats.lastStudyDate = today;

    // Incrementar streak se necessário
    if (this.stats.lastStudyDate === today && this.stats.studiedToday === 1) {
      this.stats.streak = (this.stats.streak || 0) + 1;
    }

    try {
      // Salvar no deck
      await updateDoc(doc(db, 'users', this.user.uid, 'decks', this.currentDeck.id), {
        cards: originalDeck.cards
      });

      // Salvar stats globais
      await this.saveStats();

      // Atualizar dashboard em tempo real
      this.renderDashboard();

    } catch (error) {
      console.error('Erro ao salvar progresso do cartão:', error);
    }

    // Próximo cartão ou finalizar
    if (this.currentCardIndex < this.currentDeck.cards.length - 1) {
      this.currentCardIndex++;
      this.isFlipped = false;
      const typingInput = document.getElementById('typingInput');
      if (typingInput) typingInput.value = '';
      this.updateStudyCard();
    } else {
      this.finishStudySession();
    }
  }

  async saveStudyToHistory(correct) {
    if (!this.user) return;

    const today = new Date().toISOString().split('T')[0];
    const userRef = doc(db, 'users', this.user.uid);

    try {
      const userSnap = await getDoc(userRef);
      const data = userSnap.data() || {};
      const history = data.studyHistory || {};

      if (!history[today]) {
        history[today] = { cards: 0, correct: 0, wrong: 0, date: today };
      }

      history[today].cards += 1;
      if (correct) {
        history[today].correct += 1;
      } else {
        history[today].wrong += 1;
      }

      await updateDoc(userRef, { studyHistory: history });
    } catch (err) {
      console.error('Erro ao salvar histórico de estudo:', err);
    }
  }

  finishStudySession() {
    const studied = this.currentDeck.cards.length;
    const total = this.stats.totalCorrect + this.stats.totalWrong;
    const accuracy = total > 0 ? Math.round((this.stats.totalCorrect / total) * 100) : 0;

    alert(`Sessão concluída! 🎉\n\n` +
          `Cartões estudados: ${studied}\n` +
          `Precisão: ${accuracy}%\n` +
          `Sequência atual: ${this.stats.streak} dias`);

    this.currentDeck = null;
    this.currentCardIndex = 0;
    this.isFlipped = false;
    this.showView('dashboard');
    this.render();
  }

  // ============================================================================
  // NAVEGAÇÃO ENTRE CARTÕES (PRÓXIMO / ANTERIOR)
  // ============================================================================
  nextCard() {
    if (this.currentDeck && this.currentCardIndex < this.currentDeck.cards.length - 1) {
      this.currentCardIndex++;
      this.isFlipped = false;
      document.getElementById('typingInput')?.value = '';
      this.updateStudyCard();
    }
  }

  previousCard() {
    if (this.currentDeck && this.currentCardIndex > 0) {
      this.currentCardIndex--;
      this.isFlipped = false;
      document.getElementById('typingInput')?.value = '';
      this.updateStudyCard();
    }
  }

  // ... continua na Parte 8 (notificações completas + export/import + share + finalização)
    // ============================================================================
  // NOTIFICAÇÕES - SETUP, ATIVAÇÃO, AGENDAMENTO E TESTE
  // ============================================================================
  setupNotifications() {
    const toggle = document.getElementById('notificationToggle');
    const status = document.getElementById('notificationStatus');
    const timeInputs = document.querySelectorAll('.notification-time-input');
    const testBtn = document.getElementById('testNotification');

    if (!toggle || !status) return;

    // Carregar estado inicial
    toggle.checked = this.settings.notificationsEnabled;
    this.updateNotificationStatus();

    timeInputs.forEach((input, idx) => {
      if (this.settings.notificationTimes[idx]) {
        input.value = this.settings.notificationTimes[idx];
      }
      input.addEventListener('change', async () => {
        this.settings.notificationTimes[idx] = input.value;
        await this.saveSettings();
        if (this.settings.notificationsEnabled) {
          this.scheduleNotifications();
        }
      });
    });

    toggle.addEventListener('change', async () => {
      if (toggle.checked) {
        await this.enableNotifications();
      } else {
        this.disableNotifications();
      }
    });

    if (testBtn) {
      testBtn.addEventListener('click', () => this.sendTestNotification());
    }

    // Iniciar agendamento se já ativado
    if (this.settings.notificationsEnabled && Notification.permission === 'granted') {
      this.scheduleNotifications();
    }
  }

  async enableNotifications() {
    if (!('Notification' in window)) {
      alert('Seu navegador não suporta notificações.');
      return;
    }

    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      alert('Notificações exigem HTTPS (exceto em localhost para testes).');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      this.settings.notificationsEnabled = true;
      await this.saveSettings();
      this.updateNotificationStatus();
      this.scheduleNotifications();

      new Notification('Notificações Ativadas!', {
        body: 'Você receberá lembretes para estudar seus flashcards.',
        icon: '/icon-192x192.png'
      });
    } else {
      alert('Permissão negada. Ative nas configurações do navegador.');
    }
  }

  disableNotifications() {
    this.settings.notificationsEnabled = false;
    this.saveSettings();
    this.updateNotificationStatus();

    if (this.notificationCheckInterval) {
      clearInterval(this.notificationCheckInterval);
      this.notificationCheckInterval = null;
    }
  }

  updateNotificationStatus() {
    const status = document.getElementById('notificationStatus');
    if (!status) return;

    if (!('Notification' in window)) {
      status.textContent = 'Navegador sem suporte a notificações';
      status.style.color = 'var(--danger)';
    } else if (Notification.permission === 'denied') {
      status.textContent = 'Notificações bloqueadas (ative nas configurações)';
      status.style.color = 'var(--danger)';
    } else if (this.settings.notificationsEnabled) {
      status.textContent = 'Ativas ✓';
      status.style.color = 'var(--success)';
    } else {
      status.textContent = 'Desativadas';
      status.style.color = 'var(--text-muted)';
    }
  }

  scheduleNotifications() {
    if (this.notificationCheckInterval) {
      clearInterval(this.notificationCheckInterval);
    }

    this.notificationCheckInterval = setInterval(() => {
      this.checkAndSendNotification();
    }, 30000); // verifica a cada 30 segundos

    // Verificação imediata
    this.checkAndSendNotification();
  }

  checkAndSendNotification() {
    if (!this.settings.notificationsEnabled || Notification.permission !== 'granted') return;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const shouldNotify = this.settings.notificationTimes.includes(currentTime);
    if (!shouldNotify) return;

    // Evitar spam: enviar apenas uma vez por dia por horário
    const key = `lastNotif_${currentTime}`;
    const lastSent = localStorage.getItem(key);
    const today = now.toISOString().split('T')[0];

    if (lastSent === today) return;

    this.sendStudyReminder();
    localStorage.setItem(key, today);
  }

  sendStudyReminder() {
    let totalDue = 0;
    this.decks.forEach(deck => {
      if (deck.cards) {
        totalDue += deck.cards.filter(c => this.isCardDue(c)).length;
      }
    });

    const title = totalDue === 0 ? 'Você está em dia!' : 'Hora de estudar!';
    const body = totalDue === 0
      ? 'Todas as revisões feitas hoje. Parabéns!'
      : `Você tem ${totalDue} cartão${totalDue > 1 ? 'ões' : ''} para revisar.`;

    new Notification(title, {
      body,
      icon: '/icon-192x192.png',
      tag: 'study-reminder',
      requireInteraction: totalDue > 0
    });
  }

  sendTestNotification() {
    if (Notification.permission !== 'granted') {
      alert('Permita notificações primeiro.');
      return;
    }

    const totalDue = this.decks.reduce((sum, d) => sum + (d.cards?.filter(c => this.isCardDue(c)).length || 0), 0);

    new Notification('Teste de Notificação', {
      body: `Tudo funcionando!\nHora: ${new Date().toLocaleTimeString()}\nCartões pendentes: ${totalDue}`,
      icon: '/icon-192x192.png',
      requireInteraction: true
    });

    alert('Notificação de teste enviada!');
  }

  // ... continua na Parte 9 (exportData, importData, share, renderFolders + modal de edição de cards)
    // ============================================================================
  // EXPORTAR E IMPORTAR DADOS
  // ============================================================================
  async exportData() {
    try {
      const data = {
        decks: this.decks,
        folders: this.folders,
        stats: this.stats,
        settings: this.settings,
        userData: this.userData,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };

      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `flashcards-pro-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();

      URL.revokeObjectURL(url);
      alert('Dados exportados com sucesso! Verifique seus downloads.');
    } catch (error) {
      console.error('Erro ao exportar dados:', error);
      alert('Falha ao exportar. Tente novamente.');
    }
  }

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

        if (!data.decks || !Array.isArray(data.decks)) {
          alert('Arquivo inválido: não contém decks.');
          return;
        }

        if (!confirm('Importar vai substituir seus dados atuais?\n\nTem certeza?')) return;

        this.showLoading(true);

        // Limpar dados existentes (opcional - comente se quiser mesclar)
        // await Promise.all(this.decks.map(d => deleteDoc(doc(db, 'users', this.user.uid, 'decks', d.id))));
        // await Promise.all(this.folders.map(f => deleteDoc(doc(db, 'users', this.user.uid, 'folders', f.id))));

        // Importar decks
        for (const deck of data.decks) {
          const deckData = { ...deck };
          delete deckData.id;
          await addDoc(collection(db, 'users', this.user.uid, 'decks'), deckData);
        }

        // Importar pastas
        for (const folder of data.folders || []) {
          const folderData = { ...folder };
          delete folderData.id;
          await addDoc(collection(db, 'users', this.user.uid, 'folders'), folderData);
        }

        // Atualizar stats e settings se existirem
        if (data.stats) {
          await updateDoc(doc(db, 'users', this.user.uid), { stats: data.stats });
        }
        if (data.settings) {
          await updateDoc(doc(db, 'users', this.user.uid), { settings: data.settings });
        }

        await this.loadUserData();
        this.render();
        this.showLoading(false);

        alert('Dados importados com sucesso!');

      } catch (error) {
        console.error('Erro ao importar dados:', error);
        this.showLoading(false);
        alert('Erro ao importar. Verifique se o arquivo está correto.');
      }
    };

    input.click();
  }

  // ============================================================================
  // COMPARTILHAMENTO (SIMPLE PLACEHOLDER + NAVIGATOR.SHARE)
  // ============================================================================
  shareCard(deckId) {
    const deck = this.decks.find(d => d.id === deckId);
    if (!deck) return;

    if (navigator.share) {
      navigator.share({
        title: deck.name,
        text: `Confira meu deck de flashcards: ${deck.name}\n${deck.cards?.length || 0} cartões para aprender ${deck.language || 'idioma'}!`,
        url: window.location.href
      }).catch(err => console.log('Compartilhamento cancelado:', err));
    } else {
      alert('Compartilhamento não suportado neste navegador.\nCopie o link manualmente!');
    }
  }

  shareExternal(deckId) {
    // Placeholder para WhatsApp, email, etc.
    alert('Funcionalidade de compartilhamento externo em desenvolvimento.\nEm breve você poderá enviar por WhatsApp ou email!');
  }

  // ============================================================================
  // PASTAS - RENDER + MODAL DE VISUALIZAÇÃO/EDIÇÃO/EXCLUSÃO DE CARDS
  // ============================================================================
  renderFolders() {
    const container = document.getElementById('foldersList');
    if (!container) return;

    if (this.folders.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📁</div>
          <h3>Nenhuma pasta criada ainda</h3>
          <p>Crie pastas para organizar seus decks por idioma ou tema.</p>
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
        <div class="card-subtitle">${deckCount} deck(s) • ${this.getCardsInFolderCount(folder.name)} cartões</div>
        <div style="display:flex; gap:0.5rem; margin-top:1rem;">
          <button class="btn btn-primary" style="flex:1;">Ver / Editar cartões</button>
          <button class="btn btn-danger" style="padding:0.5rem 1rem;">🗑️ Excluir pasta</button>
        </div>
      `;

      card.querySelector('.btn-primary').onclick = () => this.viewFolderCards(folder.name);
      card.querySelector('.btn-danger').onclick = () => this.deleteFolder(folder.id, folder.name);

      container.appendChild(card);
    });
  }

  getCardsInFolderCount(folderName) {
    return this.decks
      .filter(d => d.folder === folderName)
      .reduce((sum, d) => sum + (d.cards?.length || 0), 0);
  }

  // ... continua na Parte 10 (viewFolderCards completo com modal de edição/exclusão + final do arquivo)
    // ============================================================================
  // MODAL DE PASTAS - VER/EDITAR/EXCLUIR CARTÕES
  // ============================================================================
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
    const titleEl = document.getElementById('modalFolderName');
    const contentEl = document.getElementById('modalCardsContent');

    if (!modal || !titleEl || !contentEl) return;

    titleEl.textContent = `Cartões da Pasta: ${folderName}`;
    contentEl.innerHTML = '';

    allCards.forEach(card => {
      const cardDiv = document.createElement('div');
      cardDiv.id = `card-container-${card.id}`;
      cardDiv.style.cssText = 'background: var(--bg-primary); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 1rem;';

      cardDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <strong style="color: var(--text-secondary); font-size: 0.875rem;">${card.deckName}</strong>
          <div style="display: flex; gap: 0.5rem;">
            <span style="color: var(--text-muted); font-size: 0.875rem;">Nível ${card.level || 0}</span>
            <button class="edit-btn" data-card-id="${card.id}" style="background: var(--accent); color: white; border: none; padding: 0.4rem 0.75rem; border-radius: 6px; cursor: pointer;">✏️ Editar</button>
            <button class="delete-btn" data-card-id="${card.id}" style="background: var(--danger); color: white; border: none; padding: 0.4rem 0.75rem; border-radius: 6px; cursor: pointer;">🗑️ Excluir</button>
          </div>
        </div>

        <div id="view-${card.id}" style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 1.5rem;">
          <div>
            <div style="font-weight: 600; color: var(--text-secondary);">🇧🇷 Português:</div>
            <div style="font-size: 1.1rem;">${this.escapeHtml(card.front)}</div>
          </div>
          <div style="font-size: 1.5rem; color: var(--text-muted);">→</div>
          <div>
            <div style="font-weight: 600; color: var(--text-secondary);">🌍 ${folderName}:</div>
            <div style="font-size: 1.1rem; color: var(--accent);">${this.escapeHtml(card.back)}</div>
          </div>
        </div>

        <div id="edit-${card.id}" style="display: none;">
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-weight: 600; color: var(--text-secondary);">🇧🇷 Português:</label>
            <input type="text" id="front-${card.id}" value="${this.escapeHtml(card.front)}" style="width:100%; padding:0.75rem; border:2px solid var(--border); border-radius:8px;">
          </div>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-weight: 600; color: var(--text-secondary);">🌍 ${folderName}:</label>
            <input type="text" id="back-${card.id}" value="${this.escapeHtml(card.back)}" style="width:100%; padding:0.75rem; border:2px solid var(--border); border-radius:8px;">
          </div>
          <div style="display:flex; gap:0.5rem;">
            <button class="save-btn" data-card-id="${card.id}" style="flex:1; background:var(--success); color:white; padding:0.75rem; border:none; border-radius:8px;">✅ Salvar</button>
            <button class="cancel-btn" data-card-id="${card.id}" style="flex:1; background:var(--text-muted); color:white; padding:0.75rem; border:none; border-radius:8px;">❌ Cancelar</button>
          </div>
        </div>
      `;

      contentEl.appendChild(cardDiv);
    });

    modal.style.display = 'flex';

    // Adicionar listeners dinamicamente
    contentEl.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => this.editCard(btn.dataset.cardId));
    });

    contentEl.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => this.deleteCardFromModal(btn.dataset.cardId, folderName));
    });

    contentEl.querySelectorAll('.save-btn').forEach(btn => {
      btn.addEventListener('click', () => this.saveCardEditFromModal(btn.dataset.cardId, folderName));
    });

    contentEl.querySelectorAll('.cancel-btn').forEach(btn => {
      btn.addEventListener('click', () => this.cancelCardEdit(btn.dataset.cardId));
    });
  }

  editCard(cardId) {
    document.getElementById(`view-${cardId}`).style.display = 'none';
    document.getElementById(`edit-${cardId}`).style.display = 'block';
    document.getElementById(`front-${cardId}`)?.focus();
  }

  cancelCardEdit(cardId) {
    document.getElementById(`view-${cardId}`).style.display = 'grid';
    document.getElementById(`edit-${cardId}`).style.display = 'none';
  }

  async saveCardEditFromModal(cardId, folderName) {
    const front = document.getElementById(`front-${cardId}`)?.value.trim();
    const back = document.getElementById(`back-${cardId}`)?.value.trim();

    if (!front || !back) {
      alert('Preencha ambos os lados do cartão!');
      return;
    }

    this.showLoading(true);

    try {
      // Encontrar o deck e o card
      let targetDeck, targetCard;
      for (const deck of this.decks) {
        const card = deck.cards?.find(c => c.id == cardId);
        if (card) {
          targetDeck = deck;
          targetCard = card;
          break;
        }
      }

      if (!targetCard) throw new Error('Cartão não encontrado');

      targetCard.front = front;
      targetCard.back = back;

      await updateDoc(doc(db, 'users', this.user.uid, 'decks', targetDeck.id), {
        cards: targetDeck.cards
      });

      await this.loadUserData();
      this.closeFolderModal();
      setTimeout(() => this.viewFolderCards(folderName), 100);

      alert('Cartão atualizado com sucesso!');

    } catch (error) {
      console.error('Erro ao salvar edição:', error);
      alert('Erro ao salvar alterações.');
    } finally {
      this.showLoading(false);
    }
  }

  async deleteCardFromModal(cardId, folderName) {
    if (!confirm('Excluir este cartão permanentemente?')) return;

    this.showLoading(true);

    try {
      let targetDeck;
      for (const deck of this.decks) {
        const index = deck.cards?.findIndex(c => c.id == cardId);
        if (index !== -1 && index !== undefined) {
          targetDeck = deck;
          targetDeck.cards.splice(index, 1);
          break;
        }
      }

      if (!targetDeck) throw new Error('Deck não encontrado');

      await updateDoc(doc(db, 'users', this.user.uid, 'decks', targetDeck.id), {
        cards: targetDeck.cards
      });

      await this.loadUserData();
      this.closeFolderModal();
      setTimeout(() => this.viewFolderCards(folderName), 100);

      alert('Cartão excluído com sucesso!');

    } catch (error) {
      console.error('Erro ao excluir cartão:', error);
      alert('Erro ao excluir cartão.');
    } finally {
      this.showLoading(false);
    }
  }

  closeFolderModal() {
    const modal = document.getElementById('folderCardsModal');
    if (modal) modal.style.display = 'none';
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ============================================================================
  // FINALIZAÇÃO DO APP
  // ============================================================================
}

const app = new FlashcardsApp();
window.app = app;

console.log('Flashcards Pro - Versão Completa Iniciada com Sucesso! ✓');