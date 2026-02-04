// ===== CONFIGURAÇÃO FIREBASE =====
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';

// ✅ USA O APP JÁ INICIALIZADO (não reinicializa!)
let app;
try {
  app = getApp(); // Tenta pegar o app existente
} catch (error) {
  // Se não existir, importa e inicializa
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
  const firebaseConfig = {
    apiKey: "AIzaSyD1A2k13tEZtKJdmRE3o0MXEvCULFHSUcs",
    authDomain: "flashcards-28a9e.firebaseapp.com",
    projectId: "flashcards-28a9e",
    storageBucket: "flashcards-28a9e.firebasestorage.app",
    messagingSenderId: "93390501016",
    appId: "1:93390501016:web:b4caddacc434ce68074ced"
  };
  app = initializeApp(firebaseConfig);
}

const auth = getAuth(app);
const db = getFirestore(app);

// ===== ESTADO GLOBAL =====
let currentView = 'week';
let currentUser = null;
let userGoal = 20;

// ===== MENU TOGGLE =====
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');

if (menuToggle && sidebar) {
  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
  });

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
  });
}

// ===== LOGOUT =====
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    if (confirm('Deseja realmente sair?')) {
      try {
        await signOut(auth);
        window.location.href = 'login.html';
      } catch (error) {
        console.error('Erro ao sair:', error);
        alert('Erro ao sair. Tente novamente.');
      }
    }
  });
}

// ===== FUNÇÕES AUXILIARES =====
function getDateString(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() + daysAgo);
  return date.toISOString().split('T')[0];
}

function getDayName(dateStr) {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const date = new Date(dateStr + 'T12:00:00');
  return days[date.getDay()];
}

function generateSampleData(days) {
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const dateStr = getDateString(-i);
    const cards = Math.floor(Math.random() * 25) + 5;
    data.push({
      day: days === 7 ? getDayName(dateStr) : new Date(dateStr + 'T12:00:00').getDate().toString().padStart(2, '0'),
      cards: cards,
      goal: userGoal,
      date: dateStr
    });
  }
  return data;
}

// ===== RENDERIZAÇÃO =====
function renderChart(data) {
  const container = document.getElementById('barChart');
  if (!container) return;

  container.innerHTML = '';
  
  // ✅ PEGA APENAS O MAIOR VALOR DOS DADOS (não inclui userGoal no cálculo)
  const maxCards = Math.max(...data.map(d => d.cards), 1);
  
  console.log('📊 GRÁFICO:');
  console.log('  Valor máximo:', maxCards);
  console.log('  Meta:', userGoal);

  data.forEach(item => {
    const barItem = document.createElement('div');
    barItem.className = 'bar-item';

    const bar = document.createElement('div');
    
    // Determinar cor baseada na meta
    const barClass = item.cards > userGoal ? 'above' : 
                     item.cards >= (userGoal * 0.75) ? 'average' : 'below';
    bar.className = `bar ${barClass}`;
<<<<<<< HEAD
    bar.style.height = `${item.cards === 0 ? 0 : Math.max((item.cards / maxCards) * 100, 3)}%`;
=======
    
    // ✅ CÁLCULO CORRETO DA ALTURA
    let heightPercent;
    if (item.cards === 0) {
      heightPercent = 3; // Barra visível mas pequena para 0
    } else {
      // Altura proporcional ao valor máximo, com mínimo de 10%
      heightPercent = Math.max((item.cards / maxCards) * 100, 10);
    }
    
    bar.style.height = `${heightPercent}%`;
>>>>>>> a373267ad719219e38f3a5f5fd1b120be51df5c7
    bar.title = `${item.date}: ${item.cards} cartões`;
    
    console.log(`  ${item.day}: ${item.cards} cards → ${heightPercent.toFixed(1)}%`);

    const barValue = document.createElement('div');
    barValue.className = 'bar-value';
    barValue.textContent = item.cards;
    bar.appendChild(barValue);

    const label = document.createElement('div');
    label.className = 'bar-label';
    label.textContent = item.day;

    barItem.appendChild(bar);
    barItem.appendChild(label);
    container.appendChild(barItem);
  });
}

function calculateStats(data) {
  let above = 0, average = 0, below = 0, studied = 0;
  let totalCards = 0;
  
  data.forEach(item => {
    if (item.cards > 0) {
      studied++;
      totalCards += item.cards;
    }
    
    if (item.cards > userGoal) {
      above++;
    } else if (item.cards >= (userGoal * 0.75) && item.cards > 0) {
      average++;
    } else if (item.cards > 0) {
      below++;
    }
  });

  const completionRate = studied > 0 ? Math.round((totalCards / (data.length * userGoal)) * 100) : 0;
  const consistency = Math.round((studied / data.length) * 100);
  const accuracy = 80;

  return {
    above,
    average,
    below,
    goal: userGoal,
    completionRate: Math.min(completionRate, 100),
    consistency,
    accuracy,
    studied,
    totalCards
  };
}

function updateStatusCards(stats) {
  document.getElementById('daysAbove').textContent = stats.above;
  document.getElementById('daysAverage').textContent = stats.average;
  document.getElementById('daysBelow').textContent = stats.below;
  document.getElementById('dailyGoal').textContent = stats.goal;

  updateProgressRing('.progress-card:nth-child(1) .ring-progress', stats.completionRate);
  updateProgressRing('.progress-card:nth-child(2) .ring-progress', stats.consistency);
  updateProgressRing('.progress-card:nth-child(3) .ring-progress', stats.accuracy);

  const ringTexts = document.querySelectorAll('.ring-text');
  if (ringTexts[0]) ringTexts[0].textContent = `${stats.completionRate}%`;
  if (ringTexts[1]) ringTexts[1].textContent = `${stats.consistency}%`;
  if (ringTexts[2]) ringTexts[2].textContent = `${stats.accuracy}%`;
  
  const descriptions = document.querySelectorAll('.progress-card p');
  if (descriptions[0]) {
    descriptions[0].textContent = `Você completou ${stats.completionRate}% dos seus estudos planejados`;
  }
  if (descriptions[1]) {
    descriptions[1].textContent = `Você estudou em ${stats.studied} dos últimos 30 dias`;
  }
}

function updateProgressRing(selector, percentage) {
  const ring = document.querySelector(selector);
  if (!ring) return;
  const circumference = 502.4;
  const offset = circumference - (percentage / 100) * circumference;
  ring.style.strokeDashoffset = offset;
}

function animateRings() {
  document.querySelectorAll('.ring-progress').forEach(ring => {
    const offset = ring.style.strokeDashoffset;
    ring.style.strokeDashoffset = '502.4';
    setTimeout(() => ring.style.strokeDashoffset = offset, 100);
  });
}

// ===== CARREGAMENTO DE DADOS =====
async function loadData(view) {
  console.log('📊 Carregando dados do analytics...');
  
  const days = view === 'week' ? 7 : 30;
  let data = generateSampleData(days);
  let useRealData = false;

  if (currentUser) {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const history = userData.studyHistory || {};
        
        console.log('📚 Dados do usuário carregados');
        console.log('  Histórico:', Object.keys(history).length, 'dias');
        
        // Buscar meta de múltiplas fontes
        if (userData.metaDiaria) {
          userGoal = parseInt(userData.metaDiaria) || 20;
          console.log('  Meta (metaDiaria):', userGoal);
        } else if (userData.meta) {
          userGoal = parseInt(userData.meta) || 20;
          console.log('  Meta (meta):', userGoal);
        } else if (userData.settings && userData.settings.newCardsPerDay) {
          userGoal = parseInt(userData.settings.newCardsPerDay) || 20;
          console.log('  Meta (settings):', userGoal);
        }
        
        // Mostrar dados reais se tiver QUALQUER histórico
        const historyKeys = Object.keys(history);
        if (historyKeys.length >= 1) {
          console.log('✅ Usando dados reais!');
          data = [];
          
          for (let i = days - 1; i >= 0; i--) {
            const dateStr = getDateString(-i);
            const dayData = history[dateStr] || { cards: 0 };
            
            data.push({
              day: days === 7 ? getDayName(dateStr) : new Date(dateStr + 'T12:00:00').getDate().toString().padStart(2, '0'),
              cards: dayData.cards || 0,
              goal: userGoal,
              date: dateStr
            });
          }
          
          useRealData = true;
          
          // Log detalhado dos dados
          console.log('📊 Dados carregados:');
          data.forEach(d => {
            if (d.cards > 0) {
              console.log(`  ${d.date}: ${d.cards} cards`);
            }
          });
        } else {
          console.log('⚠️ Nenhum histórico encontrado - usando dados de exemplo');
        }
        
        // Atualizar nome
        const userNameEl = document.getElementById('userName');
        if (userNameEl && userData.nome) {
          userNameEl.textContent = userData.nome;
        }
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
    }
  } else {
    console.log('⚠️ Usuário não autenticado - usando dados de exemplo');
  }

  // Renderizar
  renderChart(data);
  
  // Calcular stats dos últimos 30 dias
  const monthData = useRealData && days === 30 ? data : (useRealData ? await loadMonthDataForStats() : generateSampleData(30));
  updateStatusCards(calculateStats(monthData));
  animateRings();

  // Banner
  if (!useRealData) {
    showSampleBanner();
  } else {
    removeSampleBanner();
  }
  
  console.log('✅ Analytics carregado!');
}

async function loadMonthDataForStats() {
  const data = [];
  if (currentUser) {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const history = userDoc.data().studyHistory || {};
        
        for (let i = 29; i >= 0; i--) {
          const dateStr = getDateString(-i);
          const dayData = history[dateStr] || { cards: 0 };
          data.push({
            day: new Date(dateStr + 'T12:00:00').getDate().toString().padStart(2, '0'),
            cards: dayData.cards || 0,
            goal: userGoal,
            date: dateStr
          });
        }
        return data;
      }
    } catch (error) {
      console.error('Erro ao carregar dados do mês:', error);
    }
  }
  
  return generateSampleData(30);
}

function showSampleBanner() {
  if (document.querySelector('.info-banner')) return;
  
  const banner = document.createElement('div');
  banner.className = 'info-banner';
  banner.innerHTML = `
    <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem;">
      <span style="font-size: 1.5rem;">ℹ️</span>
      <div>
        <strong style="color: #856404;">Dados de Exemplo</strong>
        <p style="margin: 0.25rem 0 0 0; color: #856404; font-size: 0.875rem;">
          Continue estudando para ver seus dados reais aqui!
        </p>
      </div>
    </div>
  `;
  
  const container = document.querySelector('.container');
  const header = document.querySelector('.page-header');
  if (container && header) {
    container.insertBefore(banner, header.nextSibling);
  }
}

function removeSampleBanner() {
  const banner = document.querySelector('.info-banner');
  if (banner) banner.remove();
}

// ===== TROCA DE VISUALIZAÇÃO =====
window.changeView = async function(view) {
  currentView = view;
  
  document.querySelectorAll('.chart-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  document.querySelector('.chart-header h2').textContent = 
    view === 'week' ? 'Últimos 7 Dias' : 'Últimos 30 Dias';
  
  await loadData(view);
};

// ===== INICIALIZAÇÃO =====
async function init() {
  console.log('📊 Analytics iniciando...');
  
  // Carrega dados de exemplo IMEDIATAMENTE
  await loadData('week');
  
  // Verifica autenticação em background
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      console.log('✅ Usuário:', user.email);
      await loadData(currentView); // Recarrega com dados reais
    } else {
      console.log('ℹ️ Sem login - mostrando dados de exemplo');
    }
  });
  
  console.log('✅ Analytics pronto!');
}

// Inicia quando DOM carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

console.log('✅ Analytics.js carregado!');
