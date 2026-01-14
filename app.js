// ===== CLASSE PRINCIPAL =====
class FlashcardsApp {
  constructor() {
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
      reviewsPerDay: 100
    };
    this.currentDeck = null;
    this.currentCardIndex = 0;
    this.isFlipped = false;
    this.studyMode = 'normal';
    
    this.init();
  }

  // ===== INICIALIZAÇÃO =====
  init() {
    this.loadData();
    this.setupNavigation();
    this.setupFolderSelector();
    this.setupModeSelector();
    this.setupTypingMode();
    this.render();
    this.updateStreak();
    console.log('✅ Flashcards Pro inicializado');
  }

  // ===== GERENCIAMENTO DE DADOS =====
  loadData() {
    try {
      const savedData = localStorage.getItem('flashcards_data');
      if (savedData) {
        const data = JSON.parse(savedData);
        this.decks = data.decks || [];
        this.folders = data.folders || [];
        this.stats = data.stats || this.stats;
        this.settings = data.settings || this.settings;
        
        // Atualizar configurações na interface
        document.getElementById('settingNewCards').value = this.settings.newCardsPerDay;
        document.getElementById('settingReviews').value = this.settings.reviewsPerDay;
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  }

  saveData() {
    try {
      const data = {
        decks: this.decks,
        folders: this.folders,
        stats: this.stats,
        settings: this.settings,
        lastUpdate: new Date().toISOString()
      };
      localStorage.setItem('flashcards_data', JSON.stringify(data));
      console.log('💾 Dados salvos com sucesso');
    } catch (error) {
      console.error('Erro ao salvar dados:', error);
      alert('⚠️ Erro ao salvar dados. Verifique o espaço disponível.');
    }
  }

  // ===== CONFIGURAÇÃO DE EVENTOS =====
  setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        this.showView(view);
        
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  setupFolderSelector() {
    const select = document.getElementById('deckFolder');
    const newFolderGroup = document.getElementById('newFolderGroup');
    
    select.addEventListener('change', (e) => {
      if (e.target.value === '__new__') {
        newFolderGroup.style.display = 'block';
      } else {
        newFolderGroup.style.display = 'none';
      }
    });
  }

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

  setupTypingMode() {
    const input = document.getElementById('typingInput');
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && this.studyMode === 'typing') {
        this.checkTypedAnswer();
      }
    });
  }

  // ===== NAVEGAÇÃO ENTRE VIEWS =====
  showView(viewName) {
    document.querySelectorAll('.view').forEach(view => {
      view.classList.remove('active');
    });

    const view = document.getElementById(viewName === 'study' ? 'studyView' : viewName);
    if (view) {
      view.classList.add('active');
      
      if (viewName === 'dashboard') {
        this.renderDashboard();
      } else if (viewName === 'decks') {
        this.renderDecks();
      } else if (viewName === 'folders') {
        this.renderFolders();
      }
    }
  }

  // ===== RENDERIZAÇÃO =====
  render() {
    this.renderDashboard();
    this.renderDecks();
    this.renderFolders();
    this.updateFolderSelect();
  }

  renderDashboard() {
    // Estatísticas
    document.getElementById('statToday').textContent = this.stats.studiedToday;
    
    const total = this.stats.totalCorrect + this.stats.totalWrong;
    const accuracy = total > 0 ? Math.round((this.stats.totalCorrect / total) * 100) : 0;
    document.getElementById('statAccuracy').textContent = accuracy + '%';
    
    document.getElementById('statStreak').textContent = this.stats.streak;
    
    document.getElementById('statDecks').textContent = this.decks.length;
    
    const totalCards = this.decks.reduce((sum, deck) => sum + deck.cards.length, 0);
    document.getElementById('statCards').textContent = `${totalCards} cartões`;

    // Revisões pendentes
    const reviewContainer = document.getElementById('reviewCards');
    reviewContainer.innerHTML = '';

    const dueDecks = this.decks.filter(deck => {
      return deck.cards.some(card => this.isCardDue(card));
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

  renderDecks() {
    const container = document.getElementById('decksList');
    const empty = document.getElementById('emptyDecks');
    
    if (this.decks.length === 0) {
      container.style.display = 'none';
      empty.style.display = 'block';
      return;
    }

    container.style.display = 'grid';
    empty.style.display = 'none';
    container.innerHTML = '';

    this.decks.forEach(deck => {
      const dueCount = deck.cards.filter(card => this.isCardDue(card)).length;
      const newCount = deck.cards.filter(card => !card.level || card.level === 0).length;
      
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-title">${deck.name}</div>
        <div class="card-subtitle">${deck.description || 'Sem descrição'}</div>
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
            <span>${deck.cards.length} total</span>
          </div>
        </div>
        <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
          <button class="btn btn-primary" style="flex: 1;">
            📖 Estudar
          </button>
          <button class="btn btn-secondary" style="padding: 0.75rem;">
            🗑️
          </button>
        </div>
      `;
      
      card.querySelector('.btn-primary').onclick = (e) => {
        e.stopPropagation();
        this.startStudy(deck.id);
      };
      
      card.querySelector('.btn-secondary').onclick = (e) => {
        e.stopPropagation();
        this.deleteDeck(deck.id);
      };
      
      container.appendChild(card);
    });
  }

  renderFolders() {
    const container = document.getElementById('foldersList');
    
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
      `;
      container.appendChild(card);
    });
  }

  updateFolderSelect() {
    const select = document.getElementById('deckFolder');
    const options = select.querySelectorAll('option:not([value=""]):not([value="__new__"])');
    options.forEach(opt => opt.remove());

    this.folders.forEach(folder => {
      const option = document.createElement('option');
      option.value = folder.name;
      option.textContent = folder.name;
      select.insertBefore(option, select.querySelector('[value="__new__"]'));
    });
  }

  // ===== GERENCIAMENTO DE DECKS =====
  saveDeck() {
    const name = document.getElementById('deckName').value.trim();
    const desc = document.getElementById('deckDesc').value.trim();
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

    // Gerenciar pasta
    let folderName = '';
    if (folderSelect === '__new__' && newFolderName) {
      folderName = newFolderName;
      if (!this.folders.find(f => f.name === folderName)) {
        this.folders.push({
          id: Date.now(),
          name: folderName,
          createdAt: new Date().toISOString()
        });
      }
    } else if (folderSelect) {
      folderName = folderSelect;
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
        createdAt: new Date().toISOString()
      });
    }

    // Criar deck
    this.decks.push({
      id: Date.now(),
      name: name,
      description: desc,
      folder: folderName,
      cards: cards,
      createdAt: new Date().toISOString()
    });

    this.saveData();
    this.clearForm();
    this.showView('decks');
    this.render();

    alert(`✅ Deck "${name}" criado com sucesso!\n\n${cards.length} cartões adicionados.`);
  }

  clearForm() {
    document.getElementById('deckName').value = '';
    document.getElementById('deckDesc').value = '';
    document.getElementById('deckFolder').value = '';
    document.getElementById('newFolderName').value = '';
    document.getElementById('deckCards').value = '';
    document.getElementById('newFolderGroup').style.display = 'none';
  }

  deleteDeck(deckId) {
    const deck = this.decks.find(d => d.id === deckId);
    if (!deck) return;
    
    if (!confirm(`Deseja realmente excluir o deck "${deck.name}"?\n\nEsta ação não pode ser desfeita.`)) return;
    
    this.decks = this.decks.filter(d => d.id !== deckId);
    this.saveData();
    this.render();
    
    alert('✅ Deck excluído com sucesso!');
  }

  // ===== SISTEMA DE ESTUDO =====
  isCardDue(card) {
    if (!card.nextReview) return true;
    return new Date(card.nextReview) <= new Date();
  }

  startStudy(deckId) {
    const deck = this.decks.find(d => d.id === deckId);
    if (!deck) return;

    // Filtrar apenas cartões que precisam revisão
    const dueCards = deck.cards.filter(card => this.isCardDue(card));
    
    if (dueCards.length === 0) {
      alert('🎉 Parabéns!\n\nNenhum cartão precisa de revisão neste deck agora.');
      return;
    }

    // Criar uma cópia do deck para estudo
    this.currentDeck = {
      ...deck,
      cards: [...dueCards]
    };

    this.currentCardIndex = 0;
    this.isFlipped = false;

    document.getElementById('studyDeckName').textContent = deck.name;
    document.getElementById('typingInput').value = '';
    
    this.updateStudyCard();
    this.showView('study');
  }

  updateStudyCard() {
    if (!this.currentDeck || !this.currentDeck.cards.length) return;

    const card = this.currentDeck.cards[this.currentCardIndex];
    const progress = `Cartão ${this.currentCardIndex + 1} de ${this.currentDeck.cards.length}`;
    const percent = ((this.currentCardIndex + 1) / this.currentDeck.cards.length) * 100;

    document.getElementById('studyProgress').textContent = progress;
    document.getElementById('studyProgressBar').style.width = percent + '%';

    const textEl = document.getElementById('flashcardText');
    const hintEl = document.getElementById('flashcardHint');
    const typingInput = document.getElementById('typingInput');
    const ratingButtons = document.getElementById('ratingButtons');

    // Modo digitação
    if (this.studyMode === 'typing' && !this.isFlipped) {
      textEl.textContent = this.studyMode === 'reverse' ? card.back : card.front;
      hintEl.textContent = 'Digite a resposta e pressione Enter';
      typingInput.style.display = 'block';
      typingInput.focus();
      ratingButtons.style.display = 'none';
    }
    // Modo normal/reverso
    else {
      typingInput.style.display = 'none';
      
      if (this.isFlipped) {
        textEl.textContent = this.studyMode === 'reverse' ? card.front : card.back;
        hintEl.textContent = 'Resposta';
        ratingButtons.style.display = 'block';
      } else {
        textEl.textContent = this.studyMode === 'reverse' ? card.back : card.front;
        hintEl.textContent = 'Clique para ver a resposta';
        ratingButtons.style.display = 'none';
      }
    }
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
    const userAnswer = input.value.trim().toLowerCase();
    const card = this.currentDeck.cards[this.currentCardIndex];
    const correctAnswer = (this.studyMode === 'reverse' ? card.front : card.back).toLowerCase();

    // Aqui você pode implementar lógica de comparação mais sofisticada
    const similarity = this.calculateSimilarity(userAnswer, correctAnswer);
    
    this.isFlipped = true;
    this.updateStudyCard();

    // Feedback visual
    const textEl = document.getElementById('flashcardText');
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

  calculateSimilarity(str1, str2) {
    // Algoritmo simples de similaridade
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

  rateCard(rating) {
    const card = this.currentDeck.cards[this.currentCardIndex];
    const now = new Date();

    // Encontrar o cartão original no deck
    const originalDeck = this.decks.find(d => d.id === this.currentDeck.id);
    const originalCard = originalDeck.cards.find(c => c.id === card.id);

    // Adicionar ao histórico
    originalCard.history.push({
      date: now.toISOString(),
      rating: rating
    });

    // Algoritmo de repetição espaçada
    if (rating === 1) { // Errei
      originalCard.level = 0;
      originalCard.nextReview = new Date(now.getTime() + 60000).toISOString(); // 1 min
      this.stats.totalWrong++;
    } else if (rating === 2) { // Difícil
      originalCard.level = Math.max(0, (originalCard.level || 0));
      originalCard.nextReview = new Date(now.getTime() + 600000).toISOString(); // 10 min
      this.stats.totalCorrect++;
    } else if (rating === 3) { // Bom
      originalCard.level = (originalCard.level || 0) + 1;
      const days = Math.pow(2, originalCard.level); // 1, 2, 4, 8, 16...
      originalCard.nextReview = new Date(now.getTime() + days * 86400000).toISOString();
      this.stats.totalCorrect++;
    } else if (rating === 4) { // Fácil
      originalCard.level = (originalCard.level || 0) + 2;
      const days = Math.pow(2, originalCard.level); // Pula um nível
      originalCard.nextReview = new Date(now.getTime() + days * 86400000).toISOString();
      this.stats.totalCorrect++;
    }

    this.stats.studiedToday++;
    this.stats.lastStudyDate = now.toISOString().split('T')[0];
    this.saveData();

    // Próximo cartão ou finalizar
    if (this.currentCardIndex < this.currentDeck.cards.length - 1) {
      this.nextCard();
    } else {
      this.finishStudySession();
    }
  }

  finishStudySession() {
    const cardsStudied = this.currentDeck.cards.length;
    const accuracy = Math.round((this.stats.totalCorrect / (this.stats.totalCorrect + this.stats.totalWrong)) * 100) || 0;
    
    alert(`🎉 Parabéns!\n\nVocê completou a sessão de estudo!\n\n📊 Estatísticas:\n• ${cardsStudied} cartões revisados\n• Taxa de acerto geral: ${accuracy}%\n• Sequência atual: ${this.stats.streak} dias`);
    
    this.showView('dashboard');
    this.render();
  }

  nextCard() {
    if (this.currentCardIndex < this.currentDeck.cards.length - 1) {
      this.currentCardIndex++;
      this.isFlipped = false;
      document.getElementById('typingInput').value = '';
      this.updateStudyCard();
    }
  }

  previousCard() {
    if (this.currentCardIndex > 0) {
      this.currentCardIndex--;
      this.isFlipped = false;
      document.getElementById('typingInput').value = '';
      this.updateStudyCard();
    }
  }

  // ===== SEQUÊNCIA DE DIAS =====
  updateStreak() {
    const today = new Date().toISOString().split('T')[0];
    const lastStudy = this.stats.lastStudyDate;

    if (!lastStudy) {
      this.stats.streak = 0;
      return;
    }

    const lastDate = new Date(lastStudy);
    const todayDate = new Date(today);
    const diffTime = Math.abs(todayDate - lastDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Estudou hoje, mantém streak
    } else if (diffDays === 1) {
      // Estudou ontem, incrementa streak no próximo estudo
    } else {
      // Quebrou a sequência
      this.stats.streak = 0;
      this.saveData();
    }
  }

  // ===== CONFIGURAÇÕES =====
  saveSettings() {
    this.settings.newCardsPerDay = parseInt(document.getElementById('settingNewCards').value) || 20;
    this.settings.reviewsPerDay = parseInt(document.getElementById('settingReviews').value) || 100;
    
    this.saveData();
    alert('✅ Configurações salvas com sucesso!');
  }

  // ===== EXPORTAR/IMPORTAR DADOS =====
  exportData() {
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
  }

  importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          
          if (!data.decks || !Array.isArray(data.decks)) {
            throw new Error('Arquivo inválido');
          }

          if (confirm('⚠️ Importar dados irá substituir todos os dados atuais.\n\nDeseja continuar?')) {
            this.decks = data.decks;
            this.folders = data.folders || [];
            this.stats = data.stats || this.stats;
            this.settings = data.settings || this.settings;
            
            this.saveData();
            this.render();
            
            alert('✅ Dados importados com sucesso!');
          }
        } catch (error) {
          alert('⚠️ Erro ao importar arquivo.\n\nVerifique se o arquivo está correto.');
          console.error('Erro ao importar:', error);
        }
      };
      
      reader.readAsText(file);
    };
    
    input.click();
  }

  resetData() {
    if (!confirm('⚠️ Isso vai apagar TODOS os seus dados.\n\nTem certeza?')) return;
    if (!confirm('⚠️ ÚLTIMA CONFIRMAÇÃO!\n\nEsta ação é IRREVERSÍVEL!\n\nDeseja mesmo continuar?')) return;

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
      reviewsPerDay: 100
    };

    this.saveData();
    this.render();
    alert('✅ Todos os dados foram resetados!\n\nO aplicativo foi reiniciado.');
  }
}

// ===== INICIALIZAÇÃO =====
const app = new FlashcardsApp();
window.app = app;

// Event listener para virar cartão clicando
document.getElementById('flashcardContainer').addEventListener('click', () => {
  if (app.currentDeck) {
    app.flipCard();
  }
});