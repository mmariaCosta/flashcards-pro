// ===== IMPORTS =====
import { appState, isCardDue } from './app-init.js';

// ===== SETUP UI =====
export function setupUI() {
  setupNavigation();
  setupMenu();
  setupFolderSelector();
  setupModeSelector();
  setupTypingMode();
  setupFlashcardClick();

  const newCardsEl = document.getElementById('settingNewCards');
  const reviewsEl = document.getElementById('settingReviews');
  
  if (newCardsEl) newCardsEl.value = appState.settings.newCardsPerDay;
  if (reviewsEl) reviewsEl.value = appState.settings.reviewsPerDay;
}

// ===== NAVIGATION =====
export function setupNavigation() {
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      showView(view);
      
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

export function showView(viewName) {
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });

  const view = document.getElementById(viewName);
  if (view) {
    view.classList.add('active');
  }
}

// ===== MENU SIDEBAR =====
export function setupMenu() {
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

// ===== FOLDER SELECTOR =====
export function setupFolderSelector() {
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

export function updateFolderSelect() {
  const select = document.getElementById('deckFolder');
  if (!select) return;
  
  const options = select.querySelectorAll('option:not([value=""]):not([value="__new__"])');
  options.forEach(opt => opt.remove());

  appState.folders.forEach(folder => {
    const option = document.createElement('option');
    option.value = folder.name;
    option.textContent = folder.name;
    select.insertBefore(option, select.querySelector('[value="__new__"]'));
  });
}

// ===== MODE SELECTOR =====
export function setupModeSelector() {
  document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      appState.studyMode = card.getAttribute('data-mode');
    });
  });
}

// ===== TYPING MODE =====
export function setupTypingMode() {
  const input = document.getElementById('typingInput');
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && appState.studyMode === 'typing') {
        // Will be handled by app-study.js
        const event = new CustomEvent('checkTypedAnswer');
        document.dispatchEvent(event);
      }
    });
  }
}

// ===== FLASHCARD CLICK =====
export function setupFlashcardClick() {
  const flashcardContainer = document.getElementById('flashcardContainer');
  if (flashcardContainer) {
    flashcardContainer.addEventListener('click', () => {
      if (appState.currentDeck) {
        const event = new CustomEvent('flipCard');
        document.dispatchEvent(event);
      }
    });
  }
}

// ===== RENDER DASHBOARD =====
export function renderDashboard() {
  // Plano personalizado
  if (appState.userData && appState.userData.planoDeEstudos) {
    const plano = appState.userData.planoDeEstudos;
    const planContent = document.getElementById('planContent');
    
    if (planContent) {
      planContent.innerHTML = `
        <p><strong>Objetivo:</strong> ${appState.userData.objetivo || 'Não definido'}</p>
        <p><strong>Idiomas:</strong> ${plano.idiomas ? plano.idiomas.join(', ') : 'Não definido'}</p>
        <p><strong>Tempo diário:</strong> ${appState.userData.tempoDiario || 0} minutos</p>
        <p><strong>Meta diária:</strong> ${appState.userData.metaDiaria || 0} flashcards</p>
        <h4 style="margin-top: 1rem;">Recomendações:</h4>
        <ul>
          ${plano.recomendacoes ? plano.recomendacoes.map(r => `<li>${r}</li>`).join('') : '<li>Nenhuma recomendação disponível</li>'}
        </ul>
      `;
    }
  }

  // Estatísticas
  const statNewCards = document.getElementById('statNewCards');
  const statNewCardsGoal = document.getElementById('statNewCardsGoal');
  const statReviews = document.getElementById('statReviews');
  const statReviewsGoal = document.getElementById('statReviewsGoal');
  const statAccuracy = document.getElementById('statAccuracy');
  const statStreak = document.getElementById('statStreak');

  // ✅ Mostrar novos cards e revisões separadamente
  if (statNewCards) statNewCards.textContent = appState.stats.newCardsToday || 0;
  if (statNewCardsGoal) statNewCardsGoal.textContent = appState.settings.newCardsPerDay || 20;
  
  if (statReviews) statReviews.textContent = appState.stats.reviewsToday || 0;
  if (statReviewsGoal) statReviewsGoal.textContent = appState.settings.reviewsPerDay || 100;
  
  const total = appState.stats.totalCorrect + appState.stats.totalWrong;
  const accuracy = total > 0 ? Math.round((appState.stats.totalCorrect / total) * 100) : 0;
  if (statAccuracy) statAccuracy.textContent = accuracy + '%';
  
  if (statStreak) statStreak.textContent = appState.stats.streak;

  // Revisões pendentes
  const reviewContainer = document.getElementById('reviewCards');
  if (!reviewContainer) return;
  
  reviewContainer.innerHTML = '';

  const dueDecks = appState.decks.filter(deck => {
    return deck.cards && deck.cards.some(card => isCardDue(card));
  });

  // ✅ Ocultar título da seção se houver decks
  const reviewSection = document.querySelector('.dashboard-section');
  const reviewTitle = reviewSection?.querySelector('h2');
  const reviewSubtitle = reviewSection?.querySelector('p');
  
  if (dueDecks.length === 0) {
    // Mostrar mensagem quando não há revisões
    if (reviewTitle) reviewTitle.style.display = 'block';
    if (reviewSubtitle) reviewSubtitle.style.display = 'block';
    
    reviewContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎉</div>
        <h3>Parabéns!</h3>
        <p style="margin-top: 0.5rem;">Você está em dia com as revisões</p>
      </div>
    `;
  } else {
    // ✅ Ocultar título e subtítulo quando há decks
    if (reviewTitle) reviewTitle.style.display = 'none';
    if (reviewSubtitle) reviewSubtitle.style.display = 'none';
    
    // ✅ Criar grid para cards lado a lado
    const gridContainer = document.createElement('div');
    gridContainer.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;';
    
    dueDecks.forEach(deck => {
      const dueCount = deck.cards.filter(card => isCardDue(card)).length;
      const card = document.createElement('div');
      card.className = 'card';
      card.onclick = () => {
        const event = new CustomEvent('startStudy', { detail: { deckId: deck.id } });
        document.dispatchEvent(event);
      };
      card.innerHTML = `
        <div class="card-title">${deck.name}</div>
        <div class="card-subtitle">${deck.description || 'Sem descrição'}</div>
        <div class="card-stats">
          <div class="card-stat">
            <span>⏰</span>
            <span>${dueCount} para revisar</span>
          </div>
          <div class="card-stat">
            <span>📚</span>
            <span>${deck.cards.length} total</span>
          </div>
        </div>
      `;
      gridContainer.appendChild(card);
    });
    
    reviewContainer.appendChild(gridContainer);
  }
}

// ===== RENDER FOLDERS =====
export function renderFolders() {
  const container = document.getElementById('foldersList');
  if (!container) return;
  
  if (appState.folders.length === 0) {
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
  appState.folders.forEach(folder => {
    const deckCount = appState.decks.filter(d => d.folder === folder.name).length;
    
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-title">📁 ${folder.name}</div>
      <div class="card-subtitle">${deckCount} deck(s) nesta pasta</div>
      <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
        <button class="btn btn-primary" style="flex: 1;">
          👁️ Ver Cartões
        </button>
        <button class="btn btn-secondary" style="padding: 0.75rem 1rem;" title="Editar pasta">✏️</button>
        <button class="btn btn-secondary danger" style="padding: 0.75rem 1rem;" title="Excluir pasta">
          🗑️
        </button>
      </div>
    `;
    
    card.querySelector('.btn-primary').onclick = (e) => {
      e.stopPropagation();
      viewFolderCards(folder.name);
    };


    card.querySelectorAll(".btn-secondary")[0].onclick = (e) => {
      e.stopPropagation();
      const event = new CustomEvent("editFolder", { detail: { folderId: folder.id, folderName: folder.name } });
      document.dispatchEvent(event);
    };
    card.querySelector('.danger').onclick = (e) => {
      e.stopPropagation();
      const event = new CustomEvent('deleteFolder', { detail: { folderId: folder.id, folderName: folder.name } });
      document.dispatchEvent(event);
    };
    
    container.appendChild(card);
  });
}


// ===== VIEW FOLDER CARDS - VERSÃO SEPARADA POR DECK =====
export function viewFolderCards(folderName) {
  const decksInFolder = appState.decks.filter(d => d.folder === folderName);
  
  if (decksInFolder.length === 0) {
    alert('Esta pasta não contém decks ainda.');
    return;
  }

  const modal = document.getElementById('folderCardsModal');
  const modalTitle = document.getElementById('modalFolderName');
  const modalContent = document.getElementById('modalCardsContent');
  
  if (!modal || !modalTitle || !modalContent) return;
  
  modalTitle.textContent = `📁 ${folderName} - ${decksInFolder.length} deck(s)`;
  
  // Agrupa cards por deck
  let htmlContent = '<div style="display: grid; gap: 2rem;">';
  
  decksInFolder.forEach(deck => {
    const dueCount = deck.cards?.filter(card => isCardDue(card)).length || 0;
    const totalCards = deck.cards?.length || 0;
    
    htmlContent += `
      <div style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 12px; border: 2px solid var(--border);">
        <!-- Cabeçalho do Deck -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid var(--border);">
          <div>
            <h3 style="margin: 0; font-size: 1.25rem; color: var(--text-primary);">
              📚 ${deck.name}
            </h3>
            <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary); font-size: 0.875rem;">
              ${deck.description || 'Sem descrição'}
            </p>
          </div>
          <div style="display: flex; gap: 1rem; align-items: center;">
            <div style="text-align: center;">
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent);">${totalCards}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">total</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--warning);">${dueCount}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">pendentes</div>
            </div>
            <button class="btn btn-primary" onclick="app.startStudy('${deck.id}')" style="padding: 0.75rem 1.5rem;">
              📖 Estudar
            </button>
          </div>
        </div>
        
        <!-- Cards do Deck -->
        <div style="display: grid; gap: 1rem;">
    `;
    
    if (!deck.cards || deck.cards.length === 0) {
      htmlContent += `
        <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">📭</div>
          <p>Nenhum cartão neste deck ainda</p>
        </div>
      `;
    } else {
      deck.cards.forEach(card => {
        const isDue = isCardDue(card);
        const statusColor = isDue ? 'var(--warning)' : 'var(--success)';
        const statusText = isDue ? '⏰ Revisar' : '✅ Em dia';
        
        htmlContent += `
          <div style="background: var(--bg-primary); padding: 1.25rem; border-radius: 8px; border: 1px solid var(--border); transition: all 0.2s;" 
               onmouseover="this.style.borderColor='var(--accent)'" 
               onmouseout="this.style.borderColor='var(--border)'">
            <div style="display: flex; justify-content: space-between; margin-bottom: 1rem; align-items: center;">
              <div style="display: flex; gap: 1rem; align-items: center;">
                <span style="color: ${statusColor}; font-size: 0.75rem; font-weight: 600;">${statusText}</span>
                <span style="color: var(--text-muted); font-size: 0.75rem;">Nível ${card.level || 0}</span>
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-secondary" onclick="app.editCard('${deck.id}', ${card.id})" style="padding: 0.5rem 1rem; font-size: 0.875rem;">
                  ✏️ Editar
                </button>
                <button class="btn btn-secondary danger" onclick="app.deleteCard('${deck.id}', ${card.id})" style="padding: 0.5rem 1rem; font-size: 0.875rem;">
                  🗑️
                </button>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 1.5rem; align-items: center;">
              <div>
                <div style="font-weight: 600; margin-bottom: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">🇧🇷 Português:</div>
                <div style="font-size: 1.05rem;">${card.front}</div>
              </div>
              <div style="font-size: 1.5rem; color: var(--text-muted);">→</div>
              <div>
                <div style="font-weight: 600; margin-bottom: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">🌍 ${deck.language || folderName}:</div>
                <div style="font-size: 1.05rem; color: var(--accent); font-weight: 500;">${card.back}</div>
              </div>
            </div>
          </div>
        `;
      });
    }
    
    htmlContent += `
        </div>
      </div>
    `;
  });
  
  htmlContent += '</div>';
  
  modalContent.innerHTML = htmlContent;
  modal.style.display = 'flex';
}


export function closeFolderModal() {
  const modal = document.getElementById('folderCardsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

console.log('✅ app-ui.js carregado!');