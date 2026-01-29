// ===== FIREBASE IMPORTS =====
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ===== FIREBASE CONFIG =====
const firebaseConfig = {
  apiKey: "AIzaSyD1A2k13tEZtKJdmRE3o0MXEvCULFHSUcs",
  authDomain: "flashcards-28a9e.firebaseapp.com",
  projectId: "flashcards-28a9e",
  storageBucket: "flashcards-28a9e.firebasestorage.app",
  messagingSenderId: "93390501016",
  appId: "1:93390501016:web:b4caddacc434ce68074ced",
  measurementId: "G-19DT142R85"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===== SAMPLE DATA (FALLBACK) =====
const sampleWeekData = [
  { day: 'Seg', cards: 25, goal: 20, date: getDateString(-6) },
  { day: 'Ter', cards: 18, goal: 20, date: getDateString(-5) },
  { day: 'Qua', cards: 22, goal: 20, date: getDateString(-4) },
  { day: 'Qui', cards: 12, goal: 20, date: getDateString(-3) },
  { day: 'Sex', cards: 28, goal: 20, date: getDateString(-2) },
  { day: 'Sáb', cards: 15, goal: 20, date: getDateString(-1) },
  { day: 'Dom', cards: 20, goal: 20, date: getDateString(0) }
];

const sampleMonthData = generateSampleMonthData();

// ===== GLOBAL STATE =====
let currentView = 'week';
let currentUser = null;
let userGoal = 20;

// ===== HELPER FUNCTIONS =====

/**
 * Gets a date string for N days ago
 */
function getDateString(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() + daysAgo);
  return date.toISOString().split('T')[0];
}

/**
 * Gets the day name in Portuguese
 */
function getDayName(dateStr) {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const date = new Date(dateStr + 'T00:00:00');
  return days[date.getDay()];
}

/**
 * Generates sample data for 30 days
 */
function generateSampleMonthData() {
  const data = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const day = date.getDate().toString().padStart(2, '0');
    const cards = Math.floor(Math.random() * 20) + 10;
    data.push({
      day: day,
      cards: cards,
      goal: 20,
      date: getDateString(-i)
    });
  }
  return data;
}

/**
 * Determines the class for a bar based on cards studied vs goal
 */
function getBarClass(cards, goal) {
  if (cards > goal) return 'above';
  if (cards >= goal * 0.75) return 'average';
  return 'below';
}

/**
 * Renders the bar chart with the provided data
 */
function renderChart(data) {
  const chartContainer = document.getElementById('barChart');
  if (!chartContainer) {
    console.error('barChart element not found');
    return;
  }

  chartContainer.innerHTML = '';

  if (!data || data.length === 0) {
    chartContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Nenhum dado disponível</p>';
    return;
  }

  const maxCards = Math.max(...data.map(d => d.cards), userGoal);

  data.forEach(item => {
    const barItem = document.createElement('div');
    barItem.className = 'bar-item';

    const bar = document.createElement('div');
    bar.className = `bar ${getBarClass(item.cards, item.goal)}`;
    const height = Math.max((item.cards / maxCards) * 100, 5);
    bar.style.height = `${height}%`;
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
    chartContainer.appendChild(barItem);
  });

  console.log('✅ Chart rendered with', data.length, 'items');
}

/**
 * Changes the chart view between week and month
 */
async function changeView(view) {
  currentView = view;

  document.querySelectorAll('.chart-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');

  const chartHeader = document.querySelector('.chart-header h2');
  if (chartHeader) {
    chartHeader.textContent = view === 'week' ? 'Últimos 7 Dias' : 'Últimos 30 Dias';
  }

  await loadChartData(view);
}

/**
 * Calculates statistics from data
 */
function calculateStats(data) {
  const goal = userGoal;
  let above = 0;
  let average = 0;
  let below = 0;
  let totalCards = 0;
  let totalCorrect = 0;
  let totalWrong = 0;
  let daysStudied = 0;

  data.forEach(item => {
    if (item.cards > 0) daysStudied++;
    totalCards += item.cards;

    if (item.cards > goal) {
      above++;
    } else if (item.cards >= goal * 0.75) {
      average++;
    } else if (item.cards > 0) {
      below++;
    }

    if (item.correct) totalCorrect += item.correct;
    if (item.wrong) totalWrong += item.wrong;
  });

  const accuracy = totalCorrect + totalWrong > 0 
    ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100) 
    : 80;

  const completionRate = Math.round((daysStudied / data.length) * 100);
  const consistency = Math.round((daysStudied / 30) * 100);

  return { 
    above, 
    average, 
    below, 
    goal,
    accuracy,
    completionRate,
    consistency,
    daysStudied,
    totalCards
  };
}

/**
 * Updates the status cards with calculated statistics
 */
function updateStatusCards(stats) {
  const elements = {
    daysAbove: document.getElementById('daysAbove'),
    daysAverage: document.getElementById('daysAverage'),
    daysBelow: document.getElementById('daysBelow'),
    dailyGoal: document.getElementById('dailyGoal')
  };

  if (elements.daysAbove) elements.daysAbove.textContent = stats.above;
  if (elements.daysAverage) elements.daysAverage.textContent = stats.average;
  if (elements.daysBelow) elements.daysBelow.textContent = stats.below;
  if (elements.dailyGoal) elements.dailyGoal.textContent = stats.goal;

  updateProgressRing('.progress-card:nth-child(1) .ring-progress', stats.completionRate, 'success');
  updateProgressRing('.progress-card:nth-child(2) .ring-progress', stats.consistency, 'warning');
  updateProgressRing('.progress-card:nth-child(3) .ring-progress', stats.accuracy, 'success');

  const ringTexts = document.querySelectorAll('.ring-text');
  if (ringTexts[0]) ringTexts[0].textContent = `${stats.completionRate}%`;
  if (ringTexts[1]) ringTexts[1].textContent = `${stats.consistency}%`;
  if (ringTexts[2]) ringTexts[2].textContent = `${stats.accuracy}%`;

  const progressTexts = document.querySelectorAll('.progress-card p');
  if (progressTexts[0]) {
    progressTexts[0].textContent = `Você completou ${stats.completionRate}% dos seus estudos planejados`;
  }
  if (progressTexts[1]) {
    progressTexts[1].textContent = `Você estudou em ${stats.daysStudied} dos últimos 30 dias`;
  }

  console.log('✅ Stats updated:', stats);
}

/**
 * Updates a progress ring
 */
function updateProgressRing(selector, percentage, colorClass) {
  const ring = document.querySelector(selector);
  if (!ring) return;

  const circumference = 502.4;
  const offset = circumference - (percentage / 100) * circumference;
  
  ring.style.strokeDashoffset = offset;
  ring.className = `ring-progress ${colorClass}`;
}

/**
 * Animates progress rings on page load
 */
function animateProgressRings() {
  document.querySelectorAll('.ring-progress').forEach(ring => {
    const offset = ring.style.strokeDashoffset;
    ring.style.strokeDashoffset = '502.4';
    setTimeout(() => {
      ring.style.strokeDashoffset = offset;
    }, 100);
  });
}

/**
 * Loads user's study history from Firebase
 */
async function loadStudyHistory() {
  if (!currentUser) return null;

  try {
    const userRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      userGoal = userData.settings?.newCardsPerDay || 20;
      return userData.studyHistory || null;
    }
  } catch (error) {
    console.error('Erro ao carregar histórico:', error);
  }

  return null;
}

/**
 * Generates data array from study history
 */
function generateDataFromHistory(history, days) {
  const data = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const dateStr = getDateString(-i);
    const dayData = history[dateStr] || { cards: 0, correct: 0, wrong: 0 };
    
    data.push({
      day: days === 7 ? getDayName(dateStr) : new Date(dateStr + 'T00:00:00').getDate().toString().padStart(2, '0'),
      cards: dayData.cards || 0,
      correct: dayData.correct || 0,
      wrong: dayData.wrong || 0,
      goal: userGoal,
      date: dateStr
    });
  }

  return data;
}

/**
 * Checks if user has enough study history
 */
function hasEnoughData(history) {
  if (!history) return false;
  const entries = Object.keys(history).length;
  return entries >= 3;
}

/**
 * Shows info message about sample data
 */
function showSampleDataInfo() {
  const existingBanner = document.querySelector('.info-banner');
  if (existingBanner) return;

  const infoDiv = document.createElement('div');
  infoDiv.className = 'info-banner';
  infoDiv.innerHTML = `
    <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem;">
      <span style="font-size: 1.5rem;">ℹ️</span>
      <div>
        <strong style="color: #856404;">Dados de Exemplo</strong>
        <p style="margin: 0.25rem 0 0 0; color: #856404; font-size: 0.875rem;">
          Você ainda não tem histórico suficiente. Continue estudando para ver seus dados reais aqui!
        </p>
      </div>
    </div>
  `;
  
  const container = document.querySelector('.container');
  const header = document.querySelector('.page-header');
  if (container && header) {
    container.insertBefore(infoDiv, header.nextSibling);
  }
}

/**
 * Removes the sample data info banner
 */
function removeSampleDataInfo() {
  const existingBanner = document.querySelector('.info-banner');
  if (existingBanner) existingBanner.remove();
}

/**
 * Shows loading overlay
 */
function showLoading(show) {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.style.display = show ? 'flex' : 'none';
  }
}

/**
 * Loads and displays chart data
 */
async function loadChartData(view) {
  console.log('Loading chart data for view:', view);
  showLoading(true);
  
  const days = view === 'week' ? 7 : 30;
  const history = await loadStudyHistory();

  let data;
  let stats;

  if (hasEnoughData(history)) {
    console.log('Using real data from Firebase');
    data = generateDataFromHistory(history, days);
    const monthData = generateDataFromHistory(history, 30);
    stats = calculateStats(monthData);
    removeSampleDataInfo();
  } else {
    console.log('Using sample data');
    data = view === 'week' ? sampleWeekData : sampleMonthData;
    stats = calculateStats(sampleMonthData);
    showSampleDataInfo();
  }

  renderChart(data);
  updateStatusCards(stats);
  animateProgressRings();
  
  showLoading(false);
}

/**
 * Initializes the analytics page
 */
async function initAnalytics() {
  console.log('🚀 Initializing Analytics...');
  
  // Timeout de segurança - se demorar mais de 5 segundos, mostra dados de exemplo
  const timeout = setTimeout(() => {
    console.log('⏱️ Timeout atingido, mostrando dados de exemplo');
    renderChart(sampleWeekData);
    const stats = calculateStats(sampleMonthData);
    updateStatusCards(stats);
    showSampleDataInfo();
    animateProgressRings();
    showLoading(false);
  }, 5000);

  try {
    onAuthStateChanged(auth, async (user) => {
      clearTimeout(timeout); // Cancela o timeout
      
      if (user) {
        console.log('✅ User logged in:', user.email);
        currentUser = user;
        await loadChartData('week');
      } else {
        console.log('ℹ️ No user logged in, showing sample data');
        renderChart(sampleWeekData);
        const stats = calculateStats(sampleMonthData);
        updateStatusCards(stats);
        showSampleDataInfo();
        animateProgressRings();
        showLoading(false);
      }
    });
  } catch (error) {
    clearTimeout(timeout);
    console.error('❌ Erro ao inicializar analytics:', error);
    // Mostra dados de exemplo em caso de erro
    renderChart(sampleWeekData);
    const stats = calculateStats(sampleMonthData);
    updateStatusCards(stats);
    showSampleDataInfo();
    animateProgressRings();
    showLoading(false);
  }
}

// ===== MAKE FUNCTIONS GLOBAL FOR HTML =====
window.changeView = changeView;

// ===== INITIALIZATION =====
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAnalytics);
} else {
  initAnalytics();
}

console.log('✅ Analytics.js carregado com sucesso!');