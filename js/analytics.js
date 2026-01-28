// ===== FIREBASE IMPORTS =====
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ===== FIREBASE INITIALIZATION =====
const auth = getAuth();
const db = getFirestore();

// ===== GLOBAL STATE =====
let currentView = 'week';
let currentUser = null;
let userGoal = 20;

// ===== HELPER FUNCTIONS =====

/**
 * Gets a date string for N days ago
 * @param {number} daysAgo - Number of days in the past (negative) or future (positive)
 * @returns {string} - Date string in YYYY-MM-DD format
 */
function getDateString(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() + daysAgo);
  return date.toISOString().split('T')[0];
}

/**
 * Gets the day name in Portuguese
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} - Day name (Seg, Ter, etc)
 */
function getDayName(dateStr) {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const date = new Date(dateStr + 'T00:00:00');
  return days[date.getDay()];
}

/**
 * Generates sample data for 30 days
 * @returns {Array} - Array of day objects
 */
function generateSampleMonthData() {
  const data = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const day = date.getDate().toString().padStart(2, '0');
    const cards = Math.floor(Math.random() * 20) + 10; // 10-30 cards
    data.push({
      day: day,
      cards: cards,
      goal: 20,
      date: getDateString(-i)
    });
  }
  return data;
}

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

/**
 * Determines the class for a bar based on cards studied vs goal
 * @param {number} cards - Number of cards studied
 * @param {number} goal - Daily goal
 * @returns {string} - CSS class name
 */
function getBarClass(cards, goal) {
  if (cards > goal) return 'above';
  if (cards >= goal * 0.75) return 'average';
  return 'below';
}

/**
 * Renders the bar chart with the provided data
 * @param {Array} data - Array of day objects with cards and goal
 */
function renderChart(data) {
  const chartContainer = document.getElementById('barChart');
  if (!chartContainer) {
    console.error('Elemento barChart não encontrado');
    return;
  }
  
  chartContainer.innerHTML = '';

  if (!data || data.length === 0) {
    chartContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Nenhum dado disponível</p>';
    return;
  }

  const maxCards = Math.max(...data.map(d => d.cards), userGoal);

  data.forEach(item => {
    // Create bar item container
    const barItem = document.createElement('div');
    barItem.className = 'bar-item';

    // Create bar
    const bar = document.createElement('div');
    bar.className = `bar ${getBarClass(item.cards, item.goal)}`;
    const height = Math.max((item.cards / maxCards) * 100, 5); // Minimum 5% height
    bar.style.height = `${height}%`;

    // Add tooltip with date
    bar.title = `${item.date}: ${item.cards} cartões`;

    // Create bar value label
    const barValue = document.createElement('div');
    barValue.className = 'bar-value';
    barValue.textContent = item.cards;
    bar.appendChild(barValue);

    // Create day label
    const label = document.createElement('div');
    label.className = 'bar-label';
    label.textContent = item.day;

    // Append elements
    barItem.appendChild(bar);
    barItem.appendChild(label);
    chartContainer.appendChild(barItem);
  });
}

/**
 * Changes the chart view between week and month
 * @param {string} view - 'week' or 'month'
 * @param {Event} e - Click event object
 */
async function changeView(view, e) {
  currentView = view;

  // Update button states
  document.querySelectorAll('.chart-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // BUG FIX: Usar o evento passado como parâmetro ao invés de 'event' global
  if (e && e.target) {
    e.target.classList.add('active');
  }

  // Update chart header title
  const chartHeader = document.querySelector('.chart-header h2');
  if (chartHeader) {
    chartHeader.textContent = view === 'week' ? 'Últimos 7 Dias' : 'Últimos 30 Dias';
  }

  // Load and render appropriate data
  await loadChartData(view);
}

/**
 * Calculates statistics from data
 * @param {Array} data - Array of day objects
 * @returns {Object} - Statistics object
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

    // Add correct/wrong if available
    if (item.correct) totalCorrect += item.correct;
    if (item.wrong) totalWrong += item.wrong;
  });

  const accuracy = totalCorrect + totalWrong > 0 
    ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100) 
    : 0;

  const completionRate = Math.round((daysStudied / data.length) * 100);
  const consistency = Math.round((daysStudied / 30) * 100); // Based on 30 days

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
 * @param {Object} stats - Statistics object
 */
function updateStatusCards(stats) {
  // BUG FIX: Adicionar verificação se elementos existem
  const daysAboveEl = document.getElementById('daysAbove');
  const daysAverageEl = document.getElementById('daysAverage');
  const daysBelowEl = document.getElementById('daysBelow');
  const dailyGoalEl = document.getElementById('dailyGoal');

  if (daysAboveEl) daysAboveEl.textContent = stats.above;
  if (daysAverageEl) daysAverageEl.textContent = stats.average;
  if (daysBelowEl) daysBelowEl.textContent = stats.below;
  if (dailyGoalEl) dailyGoalEl.textContent = stats.goal;

  // Update progress rings - BUG FIX: Usar IDs ao invés de nth-child
  updateProgressRing('#completionRing', stats.completionRate, 'success');
  updateProgressRing('#consistencyRing', stats.consistency, 'warning');
  updateProgressRing('#accuracyRing', stats.accuracy, 'success');

  // Update ring text - BUG FIX: Usar IDs específicos
  const completionText = document.getElementById('completionText');
  const consistencyText = document.getElementById('consistencyText');
  const accuracyText = document.getElementById('accuracyText');

  if (completionText) completionText.textContent = `${stats.completionRate}%`;
  if (consistencyText) consistencyText.textContent = `${stats.consistency}%`;
  if (accuracyText) accuracyText.textContent = `${stats.accuracy}%`;

  // Update descriptions - BUG FIX: Usar IDs específicos
  const completionDesc = document.getElementById('completionDesc');
  const consistencyDesc = document.getElementById('consistencyDesc');

  if (completionDesc) {
    completionDesc.textContent = `Você completou ${stats.completionRate}% dos seus estudos planejados`;
  }
  if (consistencyDesc) {
    consistencyDesc.textContent = `Você estudou em ${stats.daysStudied} dos últimos 30 dias`;
  }
}

/**
 * Updates a progress ring
 * @param {string} selector - CSS selector for the ring
 * @param {number} percentage - Percentage to display
 * @param {string} colorClass - Color class (success, warning, danger)
 */
function updateProgressRing(selector, percentage, colorClass) {
  const ring = document.querySelector(selector);
  if (!ring) {
    console.warn(`Elemento ${selector} não encontrado`);
    return;
  }

  const circumference = 502.4; // 2 * PI * 80
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
 * @returns {Object|null} - Study history object or null
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
 * @param {Object} history - Study history object
 * @param {number} days - Number of days to include
 * @returns {Array} - Array of day objects
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
 * @param {Object} history - Study history object
 * @returns {boolean} - True if has enough data
 */
function hasEnoughData(history) {
  if (!history) return false;
  
  const entries = Object.keys(history).length;
  return entries >= 3; // At least 3 days of data
}

/**
 * Shows info message about sample data
 */
function showSampleDataInfo() {
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
  
  // Remove existing banner if any
  const existingBanner = document.querySelector('.info-banner');
  if (existingBanner) existingBanner.remove();
  
  // BUG FIX: Verificar se container e header existem
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
 * Loads and displays chart data
 * @param {string} view - 'week' or 'month'
 */
async function loadChartData(view) {
  const days = view === 'week' ? 7 : 30;
  const history = await loadStudyHistory();

  let data;
  let stats;

  if (hasEnoughData(history)) {
    // Use real data
    data = generateDataFromHistory(history, days);
    const monthData = generateDataFromHistory(history, 30);
    stats = calculateStats(monthData);
    removeSampleDataInfo();
  } else {
    // Use sample data
    data = view === 'week' ? sampleWeekData : sampleMonthData;
    stats = calculateStats(sampleMonthData);
    showSampleDataInfo();
  }

  renderChart(data);
  updateStatusCards(stats);
  animateProgressRings();
}

/**
 * Initializes the analytics page
 */
async function initAnalytics() {
  // Wait for auth state
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      await loadChartData('week');
    } else {
      // Not logged in - show sample data
      renderChart(sampleWeekData);
      const stats = calculateStats(sampleMonthData);
      updateStatusCards(stats);
      showSampleDataInfo();
      animateProgressRings();
    }
  });
}

// ===== MAKE FUNCTIONS GLOBAL FOR HTML ONCLICK =====
window.changeView = changeView;

// ===== INITIALIZATION =====
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAnalytics);
} else {
  initAnalytics();
}

// ===== EXPORT FOR EXTERNAL USE =====
export {
  renderChart,
  changeView,
  calculateStats,
  updateStatusCards,
  loadStudyHistory,
  initAnalytics
};