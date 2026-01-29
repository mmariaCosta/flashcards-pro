// ===== IMPORTS =====
import { appState, isCardDue, saveStats, saveStudyToHistory } from './app-init.js';
import { db } from './firebase-config.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ===== START STUDY =====
export function startStudy(deckId) {
  const deck = appState.decks.find(d => d.id === deckId);
  if (!deck || !deck.cards) return;

  const dueCards = deck.cards.filter(card => isCardDue(card));
  
  if (dueCards.length === 0) {
    alert('🎉 Parabéns!\n\nNenhum cartão precisa de revisão neste deck agora.');
    return;
  }

  appState.currentDeck = {
    ...deck,
    cards: [...dueCards]
  };

  appState.currentCardIndex = 0;
  appState.isFlipped = false;

  const studyDeckName = document.getElementById('studyDeckName');
  const typingInput = document.getElementById('typingInput');
  
  if (studyDeckName) studyDeckName.textContent = deck.name;
  if (typingInput) typingInput.value = '';
  
  updateStudyCard();
  
  const event = new CustomEvent('showView', { detail: { view: 'study' } });
  document.dispatchEvent(event);
}

// ===== UPDATE STUDY CARD =====
export function updateStudyCard() {
  if (!appState.currentDeck || !appState.currentDeck.cards.length) return;

  const card = appState.currentDeck.cards[appState.currentCardIndex];
  const progress = `Cartão ${appState.currentCardIndex + 1} de ${appState.currentDeck.cards.length}`;
  const percent = ((appState.currentCardIndex + 1) / appState.currentDeck.cards.length) * 100;

  const studyProgress = document.getElementById('studyProgress');
  const studyProgressBar = document.getElementById('studyProgressBar');
  const textEl = document.getElementById('flashcardText');
  const hintEl = document.getElementById('flashcardHint');
  const typingInput = document.getElementById('typingInput');
  const ratingButtons = document.getElementById('ratingButtons');

  if (studyProgress) studyProgress.textContent = progress;
  if (studyProgressBar) studyProgressBar.style.width = percent + '%';

  if (!textEl || !hintEl || !typingInput || !ratingButtons) return;

  // Modo digitação
  if (appState.studyMode === 'typing' && !appState.isFlipped) {
    textEl.textContent = card.front;
    hintEl.innerHTML = 'Digite a resposta em <strong>' + (appState.currentDeck.folder || 'outro idioma') + '</strong> e pressione Enter';
    typingInput.style.display = 'block';
    typingInput.focus();
    ratingButtons.style.display = 'none';
    removeAudioButton();
  } 
  // Modo normal/reverso
  else {
    typingInput.style.display = 'none';
    hintEl.innerHTML = '';
    
    if (appState.isFlipped) {
      textEl.textContent = card.back;
      ratingButtons.style.display = 'block';
      addAudioButton(card.back);
    } else {
      textEl.textContent = card.front;
      ratingButtons.style.display = 'none';
      removeAudioButton();
    }
  }
}

// ===== AUDIO BUTTON =====
function addAudioButton(text) {
  removeAudioButton();

  const hintEl = document.getElementById('flashcardHint');
  if (!hintEl) return;

  const audioBtn = document.createElement('button');
  audioBtn.id = 'audioBtn';
  audioBtn.className = 'flashcard-audio';
  audioBtn.innerHTML = '🔊';
  audioBtn.title = 'Ouvir pronúncia';
  audioBtn.style.cssText = `
    background: var(--accent);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1.2rem;
    margin-top: 1rem;
    transition: all 0.2s;
  `;
  
  audioBtn.onmouseover = function() {
    this.style.transform = 'scale(1.05)';
  };
  audioBtn.onmouseout = function() {
    this.style.transform = 'scale(1)';
  };
  
  audioBtn.onclick = (e) => {
    e.stopPropagation();
    speakText(text);
  };

  hintEl.appendChild(audioBtn);
}

function removeAudioButton() {
  const audioBtn = document.getElementById('audioBtn');
  if (audioBtn) audioBtn.remove();
}

// ===== TEXT-TO-SPEECH =====
function speakText(text) {
  if (!appState.speechSynthesis) {
    alert('⚠️ Seu navegador não suporta síntese de voz.');
    return;
  }

  appState.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  
  const folderName = appState.currentDeck.folder || '';
  utterance.lang = getLanguageCode(folderName);
  utterance.rate = 0.9;
  utterance.pitch = 1;

  appState.speechSynthesis.speak(utterance);
}

function getLanguageCode(folderName) {
  const languageMap = {
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
    'Português': 'pt-BR'
  };

  return languageMap[folderName] || 'en-US';
}

// ===== FLIP CARD =====
export function flipCard() {
  if (appState.studyMode === 'typing' && !appState.isFlipped) {
    checkTypedAnswer();
  } else {
    appState.isFlipped = !appState.isFlipped;
    updateStudyCard();
  }
}

// ===== CHECK TYPED ANSWER =====
export function checkTypedAnswer() {
  const input = document.getElementById('typingInput');
  if (!input) return;
  
  const userAnswer = input.value.trim().toLowerCase();
  const card = appState.currentDeck.cards[appState.currentCardIndex];
  const correctAnswer = card.back.toLowerCase();

  const similarity = calculateSimilarity(userAnswer, correctAnswer);
  
  appState.isFlipped = true;
  updateStudyCard();

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

// ===== SIMILARITY CALCULATION =====
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
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

// ===== RATE CARD =====
export async function rateCard(rating) {
  const card = appState.currentDeck.cards[appState.currentCardIndex];
  const now = new Date();

  // Salvar no histórico
  const wasCorrect = rating >= 3;
  await saveStudyToHistory(wasCorrect);

  const originalDeck = appState.decks.find(d => d.id === appState.currentDeck.id);
  const today = now.toISOString().split('T')[0];
  const originalCard = originalDeck.cards.find(c => c.id === card.id);

  originalCard.history.push({
    date: now.toISOString(),
    rating: rating
  });

  // Atualizar nível e próxima revisão
  if (rating === 1) {
    originalCard.level = 0;
    originalCard.nextReview = new Date(now.getTime() + 60000).toISOString();
    appState.stats.totalWrong++;
  } else if (rating === 2) {
    originalCard.level = Math.max(0, (originalCard.level || 0));
    originalCard.nextReview = new Date(now.getTime() + 600000).toISOString();
    appState.stats.totalCorrect++;
  } else if (rating === 3) {
    originalCard.level = (originalCard.level || 0) + 1;
    const days = Math.pow(2, originalCard.level);
    originalCard.nextReview = new Date(now.getTime() + days * 86400000).toISOString();
    appState.stats.totalCorrect++;
  } else if (rating === 4) {
    originalCard.level = (originalCard.level || 0) + 2;
    const days = Math.pow(2, originalCard.level);
    originalCard.nextReview = new Date(now.getTime() + days * 86400000).toISOString();
    appState.stats.totalCorrect++;
  }

  // Atualizar stats
  appState.stats.studiedToday++;
  
  const lastStudy = appState.stats.lastStudyDate;
  
  if (!lastStudy || lastStudy !== today) {
    if (lastStudy) {
      const lastDate = new Date(lastStudy + 'T00:00:00');
      const todayDate = new Date(today + 'T00:00:00');
      const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        appState.stats.streak++;
        console.log('🔥 Sequência incrementada:', appState.stats.streak);
      } else if (diffDays > 1) {
        appState.stats.streak = 1;
        console.log('🆕 Nova sequência iniciada');
      }
    } else {
      appState.stats.streak = 1;
      console.log('🎯 Primeira sequência!');
    }
    
    appState.stats.lastStudyDate = today;
  }

  // Salvar no Firebase
  try {
    const deckDocRef = doc(db, 'users', appState.user.uid, 'decks', appState.currentDeck.id);
    await updateDoc(deckDocRef, {
      cards: originalDeck.cards
    });
    
    await saveStats();
    
    // Atualizar dashboard
    const event = new CustomEvent('renderDashboard');
    document.dispatchEvent(event);
    
  } catch (error) {
    console.error('Erro ao salvar progresso:', error);
  }

  // Próximo card ou finalizar
  if (appState.currentCardIndex < appState.currentDeck.cards.length - 1) {
    nextCard();
  } else {
    finishStudySession();
  }
}

// ===== NAVIGATION =====
export function nextCard() {
  if (appState.currentCardIndex < appState.currentDeck.cards.length - 1) {
    appState.currentCardIndex++;
    appState.isFlipped = false;
    const typingInput = document.getElementById('typingInput');
    if (typingInput) typingInput.value = '';
    updateStudyCard();
  }
}

export function previousCard() {
  if (appState.currentCardIndex > 0) {
    appState.currentCardIndex--;
    appState.isFlipped = false;
    const typingInput = document.getElementById('typingInput');
    if (typingInput) typingInput.value = '';
    updateStudyCard();
  }
}

// ===== FINISH SESSION =====
function finishStudySession() {
  const cardsStudied = appState.currentDeck.cards.length;
  const accuracy = Math.round((appState.stats.totalCorrect / (appState.stats.totalCorrect + appState.stats.totalWrong)) * 100) || 0;
  
  alert(`🎉 Parabéns!\n\nSessão concluída!\n\n📊 Estatísticas:\n• ${cardsStudied} cartões\n• Acerto: ${accuracy}%\n• Sequência: ${appState.stats.streak} dias`);
  
  const event1 = new CustomEvent('showView', { detail: { view: 'dashboard' } });
  document.dispatchEvent(event1);
  
  const event2 = new CustomEvent('renderAll');
  document.dispatchEvent(event2);
}

console.log('✅ app-study.js carregado!');