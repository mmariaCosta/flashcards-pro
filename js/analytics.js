// analytics.js - Análise real baseada em dados do Firestore

import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const db = getFirestore();

// Variáveis globais
let currentView = 'week';
let userGoal = 20; // fallback
let studyHistory = {}; // { "YYYY-MM-DD": {cards: N, correct: N, wrong: N} }

// Helpers
function getDateString(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() + daysAgo);
  return date.toISOString().split('T')[0];
}

function getDayName(dateStr) {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const date = new Date(dateStr);
  return days[date.getDay()];
}

function getBarClass(cards, goal) {
  if (cards > goal) return 'above';
  if (cards >= goal * 0.75) return 'average';
  return 'below';
}

// Carregar dados reais do usuário
async function loadUserData() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const data = userSnap.data();
          studyHistory = data.studyHistory || {};
          userGoal = data.settings?.newCardsPerDay || data.metaDiaria || 20;
          document.getElementById('dailyGoal').textContent = userGoal;
          resolve(true);
        } else {
          resolve(false);
        }
      } else {
        resolve(false);
      }
    });
  });
}

// Verificar se tem dados suficientes (pelo menos 1 dia)
function hasEnoughData(history) {
  return Object.keys(history).length > 0;
}

// Gerar dados para o gráfico a partir do histórico real
function generateDataFromHistory(history, days) {
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = getDateString(-i);
    const dayData = history[date] || { cards: 0 };
    data.push({
      day: getDayName(date),
      cards: dayData.cards || 0,
      goal: userGoal,
      date: date
    });
  }
  return data;
}

// Calcular estatísticas para status cards e rings (baseado em 30 dias)
function calculateStats(data) {
  let above = 0, average = 0, below = 0;
  let totalStudied = 0, totalCorrect = 0;
  let daysStudied = 0;

  data.forEach(item => {
    const cards = item.cards;
    totalStudied += cards;
    // Nota: como studyHistory tem correct/wrong por dia, somamos
    const dayData = studyHistory[item.date] || {};
    totalCorrect += dayData.correct || 0;

    if (cards > 0) daysStudied++;

    if (cards > userGoal) above++;
    else if (cards >= userGoal * 0.75) average++;
    else below++;
  });

  const accuracy = totalStudied > 0 ? Math.round((totalCorrect / totalStudied) * 100) : 0;
  const completion = data.length > 0 ? Math.round((above / data.length) * 100) : 0;
  const consistency = data.length > 0 ? Math.round((daysStudied / data.length) * 100) : 0;

  return { above, average, below, accuracy, completion, consistency };
}

// Atualizar status cards
function updateStatusCards(stats) {
  document.getElementById('daysAbove').textContent = stats.above;
  document.getElementById('daysAverage').textContent = stats.average;
  document.getElementById('daysBelow').textContent = stats.above + stats.average + stats.below - stats.above - stats.average; // below = total - above - average
  document.getElementById('dailyGoal').textContent = userGoal;

  // Progress rings
  const completionOffset = 502.4 * (1 - stats.completion / 100);
  document.getElementById('completionRing').style.strokeDashoffset = completionOffset;
  document.getElementById('completionPercent').textContent = stats.completion + '%';
  document.getElementById('completionDesc').textContent = `Você completou ${stats.completion}% dos estudos planejados`;

  const consistencyOffset = 502.4 * (1 - stats.consistency / 100);
  document.getElementById('consistencyRing').style.strokeDashoffset = consistencyOffset;
  document.getElementById('consistencyPercent').textContent = stats.consistency + '%';
  document.getElementById('consistencyDesc').textContent = `Você estudou em ${stats.consistency}% dos dias`;

  const accuracyOffset = 502.4 * (1 - stats.accuracy / 100);
  document.getElementById('accuracyRing').style.strokeDashoffset = accuracyOffset;
  document.getElementById('accuracyPercent').textContent = stats.accuracy + '%';
  document.getElementById('accuracyDesc').textContent = `Taxa de acerto: ${stats.accuracy}%`;
}

// Renderizar gráfico de barras
function renderChart(data) {
  const container = document.getElementById('barChart');
  container.innerHTML = '';

  data.forEach(item => {
    const barWrapper = document.createElement('div');
    barWrapper.className = 'bar-wrapper';

    const bar = document.createElement('div');
    bar.className = `bar ${getBarClass(item.cards, item.goal)}`;
    const heightPercent = Math.min((item.cards / (item.goal * 1.5)) * 100, 100); // max 150% da meta
    bar.style.height = `${heightPercent}%`;

    const label = document.createElement('span');
    label.className = 'bar-label';
    label.textContent = item.day;

    const value = document.createElement('span');
    value.className = 'bar-value';
    value.textContent = item.cards;

    barWrapper.appendChild(bar);
    barWrapper.appendChild(value);
    barWrapper.appendChild(label);
    container.appendChild(barWrapper);
  });
}

// Mudar visualização (7/30 dias)
window.changeView = function(view) {
  currentView = view;
  document.querySelectorAll('.chart-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.chart-btn[onclick="changeView('${view}')"]`).classList.add('active');

  document.querySelector('.chart-header h2').textContent = view === 'week' ? 'Últimos 7 Dias' : 'Últimos 30 Dias';
  loadAndRender();
};

// Carregar e renderizar
async function loadAndRender() {
  document.getElementById('loadingOverlay').style.display = 'flex';

  const hasData = await loadUserData();
  const days = currentView === 'week' ? 7 : 30;
  const data = generateDataFromHistory(studyHistory, days);
  const stats = calculateStats(generateDataFromHistory(studyHistory, 30));

  renderChart(data);
  updateStatusCards(stats);

  document.getElementById('loadingOverlay').style.display = 'none';
}

// Inicialização
async function initAnalytics() {
  await loadAndRender();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAnalytics);
} else {
  initAnalytics();
}