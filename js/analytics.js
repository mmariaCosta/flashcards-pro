// ===== CONFIGURAÇÃO FIREBASE =====
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyD1A2k13tEZtKJdmRE3o0MXEvCULFHSUcs",
  authDomain: "flashcards-28a9e.firebaseapp.com",
  projectId: "flashcards-28a9e",
  storageBucket: "flashcards-28a9e.firebasestorage.app",
  messagingSenderId: "93390501016",
  appId: "1:93390501016:web:b4caddacc434ce68074ced"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===== ESTADO GLOBAL =====
let currentView = 'week';
let currentUser = null;
let userGoal = 20;

// ===== FUNÇÕES AUXILIARES =====
function getDateString(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() + daysAgo);
  return date.toISOString().split('T')[0];
}

function getDayName(dateStr) {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const date = new Date(dateStr + 'T00:00:00');
  return days[date.getDay()];
}

function generateSampleData(days) {
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const dateStr = getDateString(-i);
    const cards = Math.floor(Math.random() * 20) + 10;
    data.push({
      day: days === 7 ? getDayName(dateStr) : new Date(dateStr + 'T00:00:00').getDate().toString().padStart(2, '0'),
      cards: cards,
      goal: 20,
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
  const maxCards = Math.max(...data.map(d => d.cards), 20);

  data.forEach(item => {
    const barItem = document.createElement('div');
    barItem.className = 'bar-item';

    const bar = document.createElement('div');
    const barClass = item.cards > 20 ? 'above' : item.cards >= 15 ? 'average' : 'below';
    bar.className = `bar ${barClass}`;
    bar.style.height = `${Math.max((item.cards / maxCards) * 100, 5)}%`;
    bar.title = `${item.date}: ${item.cards} cartões`;

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

function updateStatusCards(stats) {
  document.getElementById('daysAbove').textContent = stats.above;
  document.getElementById('daysAverage').textContent = stats.average;
  document.getElementById('daysBelow').textContent = stats.below;
  document.getElementById('dailyGoal').textContent = stats.goal;

  updateProgressRing('.progress-card:nth-child(1) .ring-progress', stats.completionRate);
  updateProgressRing('.progress-card:nth-child(2) .ring-progress', stats.consistency);
  updateProgressRing('.progress-card:nth-child(3) .ring-progress', stats.accuracy);

  const ringTexts = document.querySelectorAll('.ring-text');
  ringTexts[0].textContent = `${stats.completionRate}%`;
  ringTexts[1].textContent = `${stats.consistency}%`;
  ringTexts[2].textContent = `${stats.accuracy}%`;
}

function updateProgressRing(selector, percentage) {
  const ring = document.querySelector(selector);
  if (!ring) return;
  const circumference = 502.4;
  const offset = circumference - (percentage / 100) * circumference;
  ring.style.strokeDashoffset = offset;
}

function calculateStats(data) {
  let above = 0, average = 0, below = 0, studied = 0;
  
  data.forEach(item => {
    if (item.cards > 0) studied++;
    if (item.cards > 20) above++;
    else if (item.cards >= 15) average++;
    else if (item.cards > 0) below++;
  });

  return {
    above,
    average,
    below,
    goal: 20,
    completionRate: Math.round((studied / data.length) * 100),
    consistency: Math.round((studied / 30) * 100),
    accuracy: 80
  };
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
  const days = view === 'week' ? 7 : 30;
  let data = generateSampleData(days);
  let useRealData = false;

  // Tenta carregar dados reais
  if (currentUser) {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const history = userData.studyHistory;
        
        if (history && Object.keys(history).length >= 3) {
          // Tem dados reais
          data = [];
          for (let i = days - 1; i >= 0; i--) {
            const dateStr = getDateString(-i);
            const dayData = history[dateStr] || { cards: 0 };
            data.push({
              day: days === 7 ? getDayName(dateStr) : new Date(dateStr + 'T00:00:00').getDate().toString().padStart(2, '0'),
              cards: dayData.cards || 0,
              goal: 20,
              date: dateStr
            });
          }
          useRealData = true;
        }
      }
    } catch (error) {
      console.log('Usando dados de exemplo');
    }
  }

  // Renderiza
  renderChart(data);
  const monthData = useRealData ? data : generateSampleData(30);
  updateStatusCards(calculateStats(monthData));
  animateRings();

  // Mostra banner se for dados de exemplo
  if (!useRealData) {
    showSampleBanner();
  } else {
    removeSampleBanner();
  }
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
  
  // Carrega dados iniciais IMEDIATAMENTE
  await loadData('week');
  
  // Verifica autenticação em background
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
      console.log('✅ Usuário:', user.email);
      loadData(currentView); // Recarrega com dados reais
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