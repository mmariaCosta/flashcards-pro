// ===== IMPORTS =====
import { appState, isCardDue, saveStats, saveStudyToHistory } from './app-init.js';
import { db } from './firebase-config.js';
import { doc, updateDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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
  audioBtn.innerHTML = '🔊 Ouvir Pronúncia';
  audioBtn.title = 'Ouvir pronúncia';
  audioBtn.style.cssText = `
    background: var(--accent);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    margin-top: 1rem;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  `;
  
  audioBtn.onmouseover = function() {
    this.style.transform = 'scale(1.05)';
    this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
  };
  audioBtn.onmouseout = function() {
    this.style.transform = 'scale(1)';
    this.style.boxShadow = 'none';
  };
  
  audioBtn.onclick = (e) => {
    e.stopPropagation();
    speakText(text);
  };

  hintEl.appendChild(audioBtn);

  // Adiciona info do idioma
  const langInfo = document.createElement('div');
  langInfo.style.cssText = `
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-align: center;
  `;
  const folderName = appState.currentDeck.folder || 'Idioma';
  const langCode = getLanguageCode(folderName);
  langInfo.textContent = `Idioma: ${folderName} (${langCode})`;
  hintEl.appendChild(langInfo);
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

  // Cancela qualquer fala anterior
  appState.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  
  // Detecta idioma
  const folderName = appState.currentDeck.folder || '';
  const langCode = getLanguageCode(folderName);
  utterance.lang = langCode;
  
  // Configurações de qualidade
  utterance.rate = 0.85; // Velocidade (0.1 - 10)
  utterance.pitch = 1.0; // Tom (0 - 2)
  utterance.volume = 1.0; // Volume (0 - 1)

  // Tenta encontrar a melhor voz para o idioma
  const voices = appState.speechSynthesis.getVoices();
  
  // Procura voz nativa do idioma
  let bestVoice = voices.find(voice => voice.lang === langCode);
  
  // Se não encontrar, procura voz do mesmo idioma base (ex: pt-BR ou pt-PT)
  if (!bestVoice) {
    const baseLang = langCode.split('-')[0];
    bestVoice = voices.find(voice => voice.lang.startsWith(baseLang));
  }
  
  // Se encontrou uma voz boa, usa ela
  if (bestVoice) {
    utterance.voice = bestVoice;
    console.log(`🔊 Usando voz: ${bestVoice.name} (${bestVoice.lang})`);
  } else {
    console.log(`⚠️ Nenhuma voz específica encontrada para ${langCode}, usando padrão`);
  }

  // Callbacks para debug
  utterance.onstart = () => {
    console.log(`▶️ Reproduzindo: "${text}" em ${langCode}`);
  };

  utterance.onerror = (event) => {
    console.error('❌ Erro ao reproduzir áudio:', event.error);
    alert('Erro ao reproduzir áudio. Tente novamente.');
  };

  utterance.onend = () => {
    console.log('✅ Áudio concluído');
  };

  // Reproduz
  appState.speechSynthesis.speak(utterance);
}

function getLanguageCode(folderName) {
  const languageMap = {
    // Idiomas Principais
    'Inglês': 'en-US',
    'Espanhol': 'es-ES',
    'Francês': 'fr-FR',
    'Italiano': 'it-IT',
    'Alemão': 'de-DE',
    'Português': 'pt-BR',
    
    // Idiomas Asiáticos
    'Japonês': 'ja-JP',
    'Coreano': 'ko-KR',
    'Chinês': 'zh-CN',
    'Mandarim': 'zh-CN',
    'Cantonês': 'zh-HK',
    'Tailandês': 'th-TH',
    'Vietnamita': 'vi-VN',
    'Indonésio': 'id-ID',
    'Malaio': 'ms-MY',
    'Tagalo': 'tl-PH',
    'Filipino': 'fil-PH',
    'Hindi': 'hi-IN',
    'Bengali': 'bn-IN',
    'Urdu': 'ur-PK',
    
    // Idiomas do Oriente Médio
    'Árabe': 'ar-SA',
    'Hebraico': 'he-IL',
    'Turco': 'tr-TR',
    'Persa': 'fa-IR',
    'Farsi': 'fa-IR',
    
    // Idiomas Europeus (Ocidentais)
    'Holandês': 'nl-NL',
    'Sueco': 'sv-SE',
    'Norueguês': 'nb-NO',
    'Dinamarquês': 'da-DK',
    'Finlandês': 'fi-FI',
    'Islandês': 'is-IS',
    
    // Idiomas Europeus (Orientais)
    'Russo': 'ru-RU',
    'Polonês': 'pl-PL',
    'Ucraniano': 'uk-UA',
    'Tcheco': 'cs-CZ',
    'Húngaro': 'hu-HU',
    'Romeno': 'ro-RO',
    'Búlgaro': 'bg-BG',
    'Croata': 'hr-HR',
    'Sérvio': 'sr-RS',
    'Eslovaco': 'sk-SK',
    'Esloveno': 'sl-SI',
    'Lituano': 'lt-LT',
    'Letão': 'lv-LV',
    'Estoniano': 'et-EE',
    'Macedônio': 'mk-MK',
    'Albanês': 'sq-AL',
    
    // Idiomas do Sul e Sudeste da Europa
    'Grego': 'el-GR',
    'Catalão': 'ca-ES',
    'Basco': 'eu-ES',
    'Galego': 'gl-ES',
    
    // Idiomas Africanos
    'Africâner': 'af-ZA',
    'Swahili': 'sw-KE',
    'Suaíli': 'sw-KE',
    'Zulu': 'zu-ZA',
    'Xhosa': 'xh-ZA',
    'Amárico': 'am-ET',
    
    // Outros
    'Esperanto': 'eo',
    'Latim': 'la'
  };

  const normalizedFolder = folderName.toLowerCase().trim();
  
  // Busca direta
  if (languageMap[folderName]) {
    return languageMap[folderName];
  }
  
  // Busca parcial
  for (const [key, value] of Object.entries(languageMap)) {
    if (key.toLowerCase().includes(normalizedFolder) || normalizedFolder.includes(key.toLowerCase())) {
      return value;
    }
  }

  // Fallback para inglês
  console.log(`⚠️ Idioma "${folderName}" não encontrado, usando inglês como padrão`);
  return 'en-US';
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
  const today = now.toISOString().split('T')[0];

  // 1. ATUALIZAR CONTADOR DE CARDS DO DIA PRIMEIRO
  appState.stats.studiedToday++;

  // 2. SALVAR NO HISTÓRICO IMEDIATAMENTE
  const wasCorrect = rating >= 3;
  await saveStudyToHistory(wasCorrect);

  const originalDeck = appState.decks.find(d => d.id === appState.currentDeck.id);
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

  // 🔥 LÓGICA DO STREAK
  const lastStudy = appState.stats.lastStudyDate;
  
  console.log('🔥 ANTES - Streak:', appState.stats.streak, '| Last Study:', lastStudy, '| Today:', today);
  
  // Se NUNCA estudou antes, inicia sequência
  if (!lastStudy) {
    appState.stats.streak = 1;
    appState.stats.lastStudyDate = today;
    console.log('🎯 Primeira sequência iniciada! Streak = 1');
  }
  // Se o último estudo NÃO foi hoje
  else if (lastStudy !== today) {
    const lastDate = new Date(lastStudy + 'T00:00:00');
    const todayDate = new Date(today + 'T00:00:00');
    const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
    
    console.log('📅 Diferença de dias:', diffDays);
    
    // Se estudou ONTEM (diferença de 1 dia) - INCREMENTA
    if (diffDays === 1) {
      appState.stats.streak++;
      appState.stats.lastStudyDate = today;
      console.log('🔥 Sequência incrementada! Novo streak:', appState.stats.streak);
    }
    // Se passou MAIS de 1 dia - RESETA para 1
    else if (diffDays > 1) {
      appState.stats.streak = 1;
      appState.stats.lastStudyDate = today;
      console.log('🆕 Sequência quebrada! Reiniciando streak = 1');
    }
    // Se diffDays <= 0 (não deveria acontecer, mas por segurança)
    else {
      appState.stats.lastStudyDate = today;
      console.log('⚠️ Data inconsistente, mantendo streak:', appState.stats.streak);
    }
  }
  // Se JÁ estudou hoje - mantém tudo
  else {
    console.log('✅ Já estudou hoje - mantém streak:', appState.stats.streak);
  }
  
  console.log('🔥 DEPOIS - Streak:', appState.stats.streak, '| Last Study:', appState.stats.lastStudyDate);

  // 3. SALVAR TUDO NO FIREBASE
  try {
    // Salvar deck atualizado
    const deckDocRef = doc(db, 'users', appState.user.uid, 'decks', appState.currentDeck.id);
    await updateDoc(deckDocRef, {
      cards: originalDeck.cards
    });
    
    // Salvar stats
    await saveStats();
    
    // Salvar histórico diário CORRIGIDO
    await saveDailyStudy();
    
    console.log('✅ Dados salvos no Firebase com sucesso!');
    
    // Atualizar dashboard
    const event = new CustomEvent('renderDashboard');
    document.dispatchEvent(event);
    
  } catch (error) {
    console.error('❌ Erro ao salvar progresso:', error);
    alert('⚠️ Erro ao salvar progresso. Seus dados podem não ter sido salvos.');
  }

  // Próximo card ou finalizar
  if (appState.currentCardIndex < appState.currentDeck.cards.length - 1) {
    nextCard();
  } else {
    finishStudySession();
  }
}

// ===== SALVAR HISTÓRICO DIÁRIO - VERSÃO CORRIGIDA =====
async function saveDailyStudy() {
  const today = new Date().toISOString().split('T')[0];

  try {
    const userRef = doc(db, 'users', appState.user.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.error('❌ Documento do usuário não existe!');
      return;
    }

    const userData = userDoc.data();
    const studyHistory = userData.studyHistory || {};

    // Inicializar ou atualizar entrada do dia
    if (!studyHistory[today]) {
      studyHistory[today] = {
        cards: 0,
        correct: 0,
        wrong: 0,
        date: today
      };
    }

    // Atualizar contadores
    studyHistory[today].cards = appState.stats.studiedToday;
    studyHistory[today].correct = appState.stats.totalCorrect;
    studyHistory[today].wrong = appState.stats.totalWrong;
    studyHistory[today].lastUpdate = new Date().toISOString();

    // Salvar no Firebase
    await updateDoc(userRef, {
      studyHistory: studyHistory
    });

    console.log('📊 Histórico diário ATUALIZADO:', today, studyHistory[today]);
  } catch (err) {
    console.error('❌ Erro ao salvar histórico diário:', err);
    console.error('Detalhes:', err.message);
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
  
  alert(`🎉 Parabéns!\n\nSessão concluída!\n\n📊 Estatísticas:\n• ${cardsStudied} cartões\n• Acerto: ${accuracy}%\n• 🔥 Sequência: ${appState.stats.streak} dias`);
  
  const event1 = new CustomEvent('showView', { detail: { view: 'dashboard' } });
  document.dispatchEvent(event1);
  
  const event2 = new CustomEvent('renderAll');
  document.dispatchEvent(event2);
}

console.log('✅ app-study.js carregado!');