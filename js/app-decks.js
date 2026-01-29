// ===== IMPORTS =====
import { appState, showLoading, isCardDue, loadUserData } from './app-init.js';
import { updateFolderSelect } from './app-ui.js';
import { db } from './firebase-config.js';
import { 
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { EXAMPLE_DECKS } from './example-decks.js';

// ===== RENDER DECKS =====
export function renderDecks() {
  const container = document.getElementById('decksList');
  const empty = document.getElementById('emptyDecks');
  
  if (!container || !empty) return;
  
  if (appState.decks.length === 0) {
    container.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  container.style.display = 'grid';
  empty.style.display = 'none';
  container.innerHTML = '';

  appState.decks.forEach(deck => {
    const dueCount = deck.cards?.filter(card => isCardDue(card)).length || 0;
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
          <span>📚</span>
          <span>${deck.cards?.length || 0} total</span>
        </div>
      </div>
      
      <div class="card-actions">
        <button class="card-action-btn">
          📖 Estudar
        </button>
      </div>

      <div class="share-buttons">
        <button class="share-btn card-action-btn danger" title="Excluir card">
          🗑️
        </button>
      </div>
    `;
    
    card.querySelector('.card-action-btn:not(.danger)').onclick = () => {
      const event = new CustomEvent('startStudy', { detail: { deckId: deck.id } });
      document.dispatchEvent(event);
    };

    card.querySelector('.danger').onclick = () => deleteDeck(deck.id);
    
    container.appendChild(card);
  });
}

// ===== SAVE DECK =====
export async function saveDeck() {
  const name = document.getElementById('deckName').value.trim();
  const desc = document.getElementById('deckDesc').value.trim();
  const language = document.getElementById('deckLanguage').value.trim();
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

  showLoading(true);

  try {
    let folderName = '';
    if (folderSelect === '__new__' && newFolderName) {
      folderName = newFolderName;
      const folderExists = appState.folders.some(f => f.name === folderName);
      if (!folderExists) {
        await addDoc(collection(db, 'users', appState.user.uid, 'folders'), {
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
        front: lines[i].trim(),
        back: lines[i + 1].trim(),
        level: 0,
        nextReview: new Date().toISOString(),
        history: [],
        createdAt: new Date().toISOString()
      });
    }

    const newDeck = {
      name: name,
      description: desc,
      language: language,
      folder: folderName,
      cards: cards,
      createdAt: new Date().toISOString()
    };

    await addDoc(collection(db, 'users', appState.user.uid, 'decks'), newDeck);
    
    await loadUserData();
    clearForm();
    
    const event = new CustomEvent('renderAll');
    document.dispatchEvent(event);
    
    const viewEvent = new CustomEvent('showView', { detail: { view: 'decks' } });
    document.dispatchEvent(viewEvent);
    
    showLoading(false);

    alert(`✅ Deck "${name}" criado!\n\n${cards.length} cartões adicionados.`);
    
  } catch (error) {
    console.error('Erro ao criar deck:', error);
    showLoading(false);
    alert('Erro ao criar deck. Tente novamente.');
  }
}

// ===== CLEAR FORM =====
export function clearForm() {
  const deckName = document.getElementById('deckName');
  const deckDesc = document.getElementById('deckDesc');
  const deckLanguage = document.getElementById('deckLanguage');
  const deckFolder = document.getElementById('deckFolder');
  const newFolderName = document.getElementById('newFolderName');
  const deckCards = document.getElementById('deckCards');
  const newFolderGroup = document.getElementById('newFolderGroup');
  
  if (deckName) deckName.value = '';
  if (deckDesc) deckDesc.value = '';
  if (deckLanguage) deckLanguage.value = '';
  if (deckFolder) deckFolder.value = '';
  if (newFolderName) newFolderName.value = '';
  if (deckCards) deckCards.value = '';
  if (newFolderGroup) newFolderGroup.style.display = 'none';
}

// ===== DELETE DECK =====
export async function deleteDeck(deckId) {
  const deck = appState.decks.find(d => d.id === deckId);
  if (!deck) return;
  
  if (!confirm(`Deseja realmente excluir "${deck.name}"?\n\nEsta ação não pode ser desfeita.`)) return;
  
  showLoading(true);
  
  try {
    await deleteDoc(doc(db, 'users', appState.user.uid, 'decks', deckId));
    await loadUserData();
    
    const event = new CustomEvent('renderAll');
    document.dispatchEvent(event);
    
    showLoading(false);
    alert('✅ Deck excluído!');
  } catch (error) {
    console.error('Erro ao excluir deck:', error);
    showLoading(false);
    alert('Erro ao excluir deck.');
  }
}

// ===== DELETE FOLDER =====
export async function deleteFolder(folderId, folderName) {
  const decksInFolder = appState.decks.filter(d => d.folder === folderName);
  
  let message = `Deseja realmente excluir a pasta "${folderName}"?`;
  
  if (decksInFolder.length > 0) {
    message = `A pasta "${folderName}" contém ${decksInFolder.length} deck(s).\n\n` +
              `O que deseja fazer?\n\n` +
              `✅ OK = Excluir apenas a pasta (os cards ficarão sem pasta)\n` +
              `❌ Cancelar = Não fazer nada`;
  }
  
  if (!confirm(message)) return;
  
  showLoading(true);
  
  try {
    // Remove a pasta de todos os decks
    if (decksInFolder.length > 0) {
      for (const deck of decksInFolder) {
        await updateDoc(doc(db, 'users', appState.user.uid, 'decks', deck.id), {
          folder: ''
        });
      }
    }
    
    // Deleta a pasta
    await deleteDoc(doc(db, 'users', appState.user.uid, 'folders', folderId));
    await loadUserData();
    
    const event = new CustomEvent('renderAll');
    document.dispatchEvent(event);
    
    showLoading(false);
    
    if (decksInFolder.length > 0) {
      alert(`✅ Pasta excluída!\n\n${decksInFolder.length} deck(s) movido(s) para "Sem pasta".`);
    } else {
      alert('✅ Pasta excluída!');
    }
  } catch (error) {
    console.error('Erro ao excluir pasta:', error);
    showLoading(false);
    alert('Erro ao excluir pasta.');
  }
}

// ===== EDIT FOLDER =====
export async function editFolder(folderId, oldFolderName) {
  const newFolderName = prompt('Digite o novo nome da pasta:', oldFolderName);
  
  if (!newFolderName || newFolderName.trim() === '') {
    return; // Cancelou ou deixou vazio
  }
  
  const trimmedName = newFolderName.trim();
  
  // Verifica se o nome já existe
  if (trimmedName !== oldFolderName) {
    const folderExists = appState.folders.some(f => f.name === trimmedName && f.id !== folderId);
    if (folderExists) {
      alert(`⚠️ Já existe uma pasta com o nome "${trimmedName}".\n\nEscolha outro nome.`);
      return;
    }
  }
  
  if (trimmedName === oldFolderName) {
    alert('ℹ️ O nome não foi alterado.');
    return;
  }
  
  showLoading(true);
  
  try {
    // Atualiza o nome da pasta
    await updateDoc(doc(db, 'users', appState.user.uid, 'folders', folderId), {
      name: trimmedName
    });
    
    // Atualiza todos os decks que usam essa pasta
    const decksInFolder = appState.decks.filter(d => d.folder === oldFolderName);
    for (const deck of decksInFolder) {
      await updateDoc(doc(db, 'users', appState.user.uid, 'decks', deck.id), {
        folder: trimmedName
      });
    }
    
    await loadUserData();
    
    const event = new CustomEvent('renderAll');
    document.dispatchEvent(event);
    
    showLoading(false);
    alert(`✅ Pasta renomeada!\n\n"${oldFolderName}" → "${trimmedName}"`);
  } catch (error) {
    console.error('Erro ao editar pasta:', error);
    showLoading(false);
    alert('Erro ao editar pasta.');
  }
}

// ===== EDIT CARD =====
export async function editCard(deckId, cardId) {
  const deck = appState.decks.find(d => d.id === deckId);
  if (!deck) return;
  
  const card = deck.cards.find(c => c.id === cardId);
  if (!card) return;
  
  const newFront = prompt('Editar PORTUGUÊS (frente):', card.front);
  if (newFront === null) return; // Cancelou
  
  const newBack = prompt('Editar IDIOMA (verso):', card.back);
  if (newBack === null) return; // Cancelou
  
  if (!newFront.trim() || !newBack.trim()) {
    alert('⚠️ Os dois lados do cartão precisam ter conteúdo!');
    return;
  }
  
  showLoading(true);
  
  try {
    card.front = newFront.trim();
    card.back = newBack.trim();
    
    await updateDoc(doc(db, 'users', appState.user.uid, 'decks', deckId), {
      cards: deck.cards
    });
    
    await loadUserData();
    
    const event = new CustomEvent('renderAll');
    document.dispatchEvent(event);
    
    // Atualiza o modal se estiver aberto
    const modal = document.getElementById('folderCardsModal');
    if (modal && modal.style.display === 'flex') {
      const folderName = deck.folder;
      if (folderName) {
        const { viewFolderCards } = await import('./app-ui.js');
        viewFolderCards(folderName);
      }
    }
    
    showLoading(false);
    alert('✅ Cartão editado com sucesso!');
  } catch (error) {
    console.error('Erro ao editar cartão:', error);
    showLoading(false);
    alert('Erro ao editar cartão.');
  }
}

// ===== DELETE CARD =====
export async function deleteCard(deckId, cardId) {
  const deck = appState.decks.find(d => d.id === deckId);
  if (!deck) return;
  
  const card = deck.cards.find(c => c.id === cardId);
  if (!card) return;
  
  if (!confirm(`Deseja excluir este cartão?\n\n🇧🇷 ${card.front}\n🌍 ${card.back}`)) return;
  
  showLoading(true);
  
  try {
    deck.cards = deck.cards.filter(c => c.id !== cardId);
    
    if (deck.cards.length === 0) {
      // Se não sobrou nenhum cartão, exclui o deck inteiro
      await deleteDoc(doc(db, 'users', appState.user.uid, 'decks', deckId));
      alert('⚠️ Último cartão excluído. O deck foi removido.');
    } else {
      await updateDoc(doc(db, 'users', appState.user.uid, 'decks', deckId), {
        cards: deck.cards
      });
    }
    
    await loadUserData();
    
    const event = new CustomEvent('renderAll');
    document.dispatchEvent(event);
    
    // Atualiza o modal se estiver aberto
    const modal = document.getElementById('folderCardsModal');
    if (modal && modal.style.display === 'flex') {
      const folderName = deck.folder;
      if (folderName && deck.cards.length > 0) {
        const { viewFolderCards } = await import('./app-ui.js');
        viewFolderCards(folderName);
      } else {
        modal.style.display = 'none';
      }
    }
    
    showLoading(false);
    alert('✅ Cartão excluído!');
  } catch (error) {
    console.error('Erro ao excluir cartão:', error);
    showLoading(false);
    alert('Erro ao excluir cartão.');
  }
}

// ===== RENDER EXAMPLE DECKS =====
export function renderExampleDecks() {
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
          <span>📚</span>
          <span>${deck.cards.length} cartões</span>
        </div>
      </div>
      <button class="btn btn-primary" style="margin-top: 1rem; width: 100%;">
        ➕ Importar Deck
      </button>
    `;
    
    card.querySelector('.btn-primary').onclick = (e) => {
      e.stopPropagation();
      importExampleDeck(key);
    };
    
    container.appendChild(card);
  });
}

// ===== IMPORT EXAMPLE DECK =====
export async function importExampleDeck(deckKey) {
  showLoading(true);
  
  try {
    const exampleDeck = EXAMPLE_DECKS[deckKey];
    
    const cards = exampleDeck.cards.map((card, i) => ({
      id: Date.now() + i,
      front: card.back,
      back: card.front,
      level: 0,
      nextReview: new Date().toISOString(),
      history: [],
      createdAt: new Date().toISOString()
    }));

    const newDeck = {
      name: exampleDeck.name,
      description: exampleDeck.description,
      language: exampleDeck.language,
      folder: exampleDeck.language,
      cards: cards,
      createdAt: new Date().toISOString()
    };

    await addDoc(collection(db, 'users', appState.user.uid, 'decks'), newDeck);
    
    const folderExists = appState.folders.some(f => f.name === exampleDeck.language);
    if (!folderExists) {
      await addDoc(collection(db, 'users', appState.user.uid, 'folders'), {
        name: exampleDeck.language,
        createdAt: new Date().toISOString()
      });
    }
    
    await loadUserData();
    
    const event = new CustomEvent('renderAll');
    document.dispatchEvent(event);
    
    showLoading(false);
    
    alert(`✅ Deck "${exampleDeck.name}" importado com sucesso!\n\n${cards.length} cartões adicionados.`);
    
  } catch (error) {
    console.error('Erro ao importar deck:', error);
    showLoading(false);
    alert('Erro ao importar deck. Tente novamente.');
  }
}

// ===== EXPORT/IMPORT DATA =====
export async function exportData() {
  try {
    const data = {
      decks: appState.decks,
      folders: appState.folders,
      stats: appState.stats,
      settings: appState.settings,
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

export function importData() {
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

      showLoading(true);

      for (const deck of data.decks) {
        const deckData = { ...deck };
        delete deckData.id;
        await addDoc(collection(db, 'users', appState.user.uid, 'decks'), deckData);
      }

      for (const folder of data.folders) {
        const folderData = { ...folder };
        delete folderData.id;
        await addDoc(collection(db, 'users', appState.user.uid, 'folders'), folderData);
      }

      await loadUserData();
      
      const event = new CustomEvent('renderAll');
      document.dispatchEvent(event);
      
      showLoading(false);

      alert('✅ Dados importados com sucesso!');
    } catch (error) {
      console.error('Erro ao importar:', error);
      showLoading(false);
      alert('❌ Erro ao importar dados. Verifique o arquivo.');
    }
  };

  input.click();
}

console.log('✅ app-decks.js carregado!');