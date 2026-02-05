# 📚 Flashcards Pro - Sistema Completo de Aprendizado

## 🎯 Visão Geral

Sistema completo de flashcards para aprendizado de idiomas com análise avançada de progresso e personalização total.

### ✨ Principais Funcionalidades

- ✅ **Autenticação Firebase** (Email/Senha + Google)
- ✅ **Armazenamento em Nuvem** (Firestore)
- ✅ **Onboarding Personalizado** (8 etapas)
- ✅ **Plano de Estudos Automático**
- ✅ **Decks de Exemplo** (7 idiomas: Inglês, Espanhol, Francês, Italiano, Japonês, Coreano, Chinês)
- ✅ **Sistema de Notificações** com horários personalizáveis
- ✅ **PWA** (Progressive Web App)
- ✅ **Analytics Avançado** com gráficos e estatísticas
- ✅ **Sistema de Metas Personalizadas** (novos cards vs revisões)
- ✅ **Histórico Detalhado** de estudos por dia
- ✅ **Áudio TTS** para pronúncia em múltiplos idiomas
- ✅ **Modo de Digitação** para prática ativa

---

## 🆕 Atualizações Recentes (Fevereiro 2025)

### 📊 Sistema de Analytics Completo
- **Página dedicada** de estatísticas (`analytics.html`)
- **Gráficos de barras** proporcionais aos valores reais
- **3 anéis de progresso**: Taxa de conclusão, Consistência, Acurácia
- **4 cards de status**: Dias acima/na média/abaixo da meta + Meta diária
- **Visualização**: Últimos 7 dias ou 30 dias
- **Dados reais** do histórico de estudos do usuário
- **Banner informativo** quando não há dados (mostra exemplos)

### 🎯 Sistema de Metas Personalizado
- **Distinção entre novos cards e revisões**
  - Meta separada para cards novos (ex: 10/dia)
  - Meta separada para revisões (ex: 50/dia, automático 5x)
- **Dashboard atualizado** com 4 cards informativos:
  - 🆕 Novos Hoje (X/meta)
  - 🔄 Revisões Hoje (X/meta)
  - ✅ Acertos (%)
  - 🔥 Sequência (dias)
- **Histórico detalhado** salva separadamente:
  ```javascript
  studyHistory[date] = {
    cards: 15,      // Total
    newCards: 10,   // Novos
    reviews: 5,     // Revisões
    correct: 12,
    wrong: 3
  }
  ```

### 🔧 Configurações Avançadas
- **Ajuste de metas** separadamente:
  - Novos cards por dia (1-100)
  - Revisões por dia (1-500)
- **Sincronização automática** entre `metaDiaria` e `settings.newCardsPerDay`
- **Meta do cadastro** é usada em todo o sistema (analytics, dashboard, configurações)

### 📈 Detecção Inteligente de Cards
- Sistema detecta automaticamente se card é **novo** ou **revisão**
- Baseado em `card.lastReviewed` (undefined = novo)
- Contadores incrementados corretamente
- Logs detalhados no console para debug

### 🎨 Melhorias Visuais
- **Gráficos proporcionais** (barras refletem valores reais)
- **Cores dinâmicas** baseadas na meta:
  - 🟢 Verde: Acima da meta
  - 🟡 Amarelo: Na média (75%-100% da meta)
  - 🔴 Vermelho: Abaixo da meta
- **Animações suaves** nos anéis de progresso
- **Layout responsivo** mobile-first

---

## 📁 Estrutura do Projeto

```
flashcards-pro/
│
├── index.html              # Login/Landing page
├── cadastro.html           # Onboarding multi-step
├── app.html                # App principal ⭐ ATUALIZADO
├── analytics.html          # 🆕 Página de estatísticas
├── manifest.json           # PWA manifest
├── service-worker.js       # Service worker PWA
│
├── css/
│   ├── auth.css           # Estilos de login
│   ├── onboarding.css     # Estilos do cadastro
│   ├── app.css            # Estilos do app principal
│   └── analytics.css      # 🆕 Estilos das estatísticas
│
├── js/
│   ├── firebase-config.js  # Configuração Firebase
│   ├── auth.js            # Sistema de autenticação ⭐ ATUALIZADO
│   ├── onboarding.js      # Fluxo de cadastro ⭐ ATUALIZADO
│   ├── app-init.js        # 🆕 Inicialização e estado global
│   ├── app-main.js        # 🆕 Lógica principal
│   ├── app-ui.js          # 🆕 Renderização de UI ⭐ ATUALIZADO
│   ├── app-decks.js       # 🆕 Gerenciamento de decks
│   ├── app-study.js       # 🆕 Lógica de estudo ⭐ ATUALIZADO
│   ├── analytics.js       # 🆕 Página de analytics ⭐ ATUALIZADO
│   └── example-decks.js   # Decks prontos (7 idiomas)
│
└── assets/
    └── icons/             # Ícones PWA
```

---

## 🔧 Configuração do Firebase

### 1. Criar Projeto no Firebase

1. Acesse: https://console.firebase.google.com/
2. Clique em "Adicionar projeto"
3. Dê um nome ao projeto (ex: "flashcards-pro")
4. Desabilite Google Analytics (opcional)
5. Crie o projeto

### 2. Ativar Autenticação

1. No menu lateral, clique em **Authentication**
2. Clique em "Começar"
3. Em "Sign-in method", ative:
   - ✅ **Email/Password**
   - ✅ **Google**

Para Google, você precisará:
- Adicionar seu email de suporte
- Configurar OAuth (o Firebase guia você)

### 3. Criar Firestore Database

1. No menu lateral, clique em **Firestore Database**
2. Clique em "Criar banco de dados"
3. Escolha localização (southamerica-east1 - São Paulo)
4. Inicie em **modo de produção**
5. Cole as regras de segurança:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Usuários podem ler/escrever apenas seus próprios dados
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Subcoleções do usuário (decks, folders, etc)
      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

### 4. Obter Credenciais

1. Vá em **Configurações do Projeto** (ícone de engrenagem)
2. Role até "Seus apps"
3. Clique em **Web** (`</>`)
4. Registre o app (ex: "Flashcards Web")
5. **COPIE AS CONFIGURAÇÕES** que aparecem
6. Cole em `js/firebase-config.js`:

```javascript
const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto-id",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

---

## 🗄️ Estrutura de Dados no Firestore

### Coleção: `users/{userId}`

```javascript
{
  // Dados do Perfil
  nome: "João Silva",
  email: "joao@email.com",
  idade: 25,
  idiomas: ["Inglês", "Espanhol"],
  objetivo: "Viagem",
  tempoDiario: 20,  // minutos por dia
  metaDiaria: 10,   // novos cards por dia ⭐ SINCRONIZADO
  motivacao: "Quero viajar pelo mundo",
  criadoEm: "2026-02-04T...",
  
  // Plano Personalizado
  planoDeEstudos: {
    titulo: "Plano Personalizado de João",
    idiomas: ["Inglês", "Espanhol"],
    objetivo: "Viagem",
    tempoDiario: 20,
    metaDiaria: 10,
    descricao: "Aprender Inglês, Espanhol para viagem",
    recomendacoes: [
      "Foque em frases práticas do cotidiano",
      "Aprenda números, direções e pedidos",
      ...
    ],
    decksSugeridos: [
      { idioma: "Inglês", deck: "Inglês - 30 Palavras Essenciais", prioridade: "Alta" }
    ]
  },
  
  // 🆕 Configurações Avançadas
  settings: {
    newCardsPerDay: 10,        // Meta de NOVOS cards
    reviewsPerDay: 50,         // Meta de REVISÕES (5x newCards)
    notificationsEnabled: false,
    notificationTimes: ['09:00', '14:00', '19:00']
  },
  
  // 🆕 Estatísticas Detalhadas
  stats: {
    studiedToday: 0,           // Total estudado hoje
    newCardsToday: 0,          // 🆕 Novos cards hoje
    reviewsToday: 0,           // 🆕 Revisões hoje
    totalCorrect: 0,           // Total de acertos
    totalWrong: 0,             // Total de erros
    streak: 5,                 // Sequência de dias
    lastStudyDate: "2025-02-04"
  },
  
  // 🆕 Histórico de Estudos (por data)
  studyHistory: {
    "2025-02-04": {
      cards: 15,               // Total estudado
      newCards: 10,            // 🆕 Novos cards
      reviews: 5,              // 🆕 Revisões
      correct: 12,             // Acertos
      wrong: 3,                // Erros
      date: "2025-02-04",
      lastUpdate: "2025-02-04T20:30:00Z"
    },
    "2025-02-03": {
      cards: 20,
      newCards: 10,
      reviews: 10,
      correct: 18,
      wrong: 2,
      date: "2025-02-03"
    }
  }
}
```

### Subcoleção: `users/{userId}/decks/{deckId}`

```javascript
{
  id: "deck123",
  name: "Inglês Básico",
  description: "Vocabulário essencial",
  folder: "Inglês",
  createdAt: "2025-02-01T...",
  cards: [
    {
      id: "card1",
      front: "Olá",           // Português (pergunta)
      back: "Hello",          // Inglês (resposta)
      level: 2,               // Nível de conhecimento (0-4)
      lastReviewed: "2025-02-04T...",  // 🆕 Última revisão
      nextReview: "2025-02-06T...",    // Próxima revisão agendada
      history: [
        { date: "2025-02-04T...", rating: 3 },
        { date: "2025-02-02T...", rating: 4 }
      ],
      createdAt: "2025-02-01T..."
    }
  ]
}
```

### Subcoleção: `users/{userId}/folders/{folderId}`

```javascript
{
  id: "folder123",
  name: "Inglês",
  createdAt: "2025-02-01T..."
}
```

---

## 🚀 Fluxo Completo do Sistema

### 1️⃣ Cadastro (Onboarding)

```
Usuário preenche 8 etapas:
  1. Email e Senha
  2. Nome
  3. Idade
  4. Idiomas (múltipla escolha)
  5. Objetivo (Viagem/Trabalho/Estudo/Hobby)
  6. Tempo Disponível (5/10/20/30 min/dia)
  7. Meta Diária (5/10/15/20 cards/dia)
  8. Motivação (texto livre)
     ↓
Sistema cria automaticamente:
  ✅ Conta no Firebase Auth
  ✅ Documento em users/{uid}
  ✅ Plano personalizado com recomendações
  ✅ Settings com metas separadas:
     - newCardsPerDay = meta escolhida
     - reviewsPerDay = meta × 5
  ✅ Stats inicializados
  ✅ studyHistory vazio {}
     ↓
Redireciona para app.html
```

### 2️⃣ Estudo de Cards

```javascript
// app-study.js - Fluxo de estudo

1. Usuário seleciona deck
2. Sistema filtra cards "devidos" (nextReview <= hoje)
3. Para cada card:
   
   a) Detecta se é NOVO:
      const isNewCard = !card.lastReviewed;
   
   b) Mostra card (front → back)
   
   c) Usuário avalia (1-4):
      1 = Errei
      2 = Difícil
      3 = Bom
      4 = Fácil
   
   d) Sistema atualiza:
      ✅ card.level (aumenta ou reseta)
      ✅ card.nextReview (calcula próxima data)
      ✅ card.lastReviewed = agora 🆕
      ✅ card.history.push({ date, rating })
   
   e) Incrementa contadores:
      if (isNewCard) {
        stats.newCardsToday++;
      } else {
        stats.reviewsToday++;
      }
      stats.studiedToday++;
   
   f) Salva no histórico:
      studyHistory[today].cards++;
      studyHistory[today].newCards++ OU reviews++;
      studyHistory[today].correct++ OU wrong++;
   
   g) Atualiza streak se necessário

4. Ao final da sessão: Salva tudo no Firestore
```

### 3️⃣ Dashboard

```javascript
// app-ui.js - renderDashboard()

Mostra 4 cards principais:
  
  1. 🆕 Novos Hoje
     - Valor: stats.newCardsToday / settings.newCardsPerDay
     - Ex: "5/10" = estudou 5 de 10 novos
  
  2. 🔄 Revisões Hoje
     - Valor: stats.reviewsToday / settings.reviewsPerDay
     - Ex: "15/50" = fez 15 de 50 revisões
  
  3. ✅ Acertos
     - % = totalCorrect / (totalCorrect + totalWrong)
  
  4. 🔥 Sequência
     - Dias consecutivos estudando

Também mostra:
  - Plano personalizado
  - Cards pendentes de revisão
```

### 4️⃣ Analytics

```javascript
// analytics.js - Página dedicada

1. Busca meta do usuário (prioridade):
   - settings.newCardsPerDay (prioridade 1) 🆕
   - metaDiaria (prioridade 2)
   - meta (fallback, prioridade 3)

2. Carrega studyHistory dos últimos 7 ou 30 dias

3. Renderiza gráfico de barras:
   - Altura PROPORCIONAL ao valor máximo real 🆕
   - Cores baseadas na meta:
     * Verde: > meta
     * Amarelo: 75%-100% da meta
     * Vermelho: < 75% da meta

4. Calcula estatísticas dos últimos 30 dias:
   - Dias acima/na média/abaixo
   - Taxa de conclusão (total vs planejado)
   - Consistência (% de dias estudados)
   - Acurácia (% de acertos)

5. Anima 3 anéis de progresso
```

### 5️⃣ Configurações

```javascript
// Usuário pode ajustar:

1. Meta de novos cards (1-100)
2. Meta de revisões (1-500)
3. Notificações (on/off)
4. Horários de lembretes

Ao salvar:
  ✅ settings.newCardsPerDay = valor escolhido
  ✅ settings.reviewsPerDay = valor escolhido
  ✅ metaDiaria = newCardsPerDay (sincroniza) 🆕
```

---

## 🎨 Recursos Visuais e UX

### 🎯 Gráficos Proporcionais

**Como funciona:**
```javascript
// Valor máximo = maior card estudado no período
const maxCards = Math.max(...data.map(d => d.cards), 1);

// Altura proporcional (sem incluir meta no cálculo)
if (item.cards === 0) {
  height = 0;  // Sem barra
} else {
  height = Math.max((item.cards / maxCards) * 100, 5);
}

// Exemplo:
// Dia 1: 10 cards → 10/69 = 14.5% → mínimo 5%
// Dia 2: 69 cards → 69/69 = 100% (maior barra)
// Dia 3: 0 cards  → 0% (sem barra)
```

### 🔊 Áudio TTS (Text-to-Speech)

- **40+ idiomas suportados**
- Detecta automaticamente o idioma da pasta
- Usa vozes nativas do sistema
- Funciona offline (se voz instalada)
- Controles de velocidade, tom e volume

### ⌨️ Modo de Digitação

- Usuário digita a resposta
- Sistema calcula similaridade (Levenshtein)
- Feedback visual por cores:
  - 🟢 Verde: >80% similar
  - 🟡 Amarelo: 50-80% similar
  - 🔴 Vermelho: <50% similar

### 📱 Responsivo Mobile-First

- Layout em grid adaptável
- Menu sidebar em overlay no mobile
- Touch-friendly (botões grandes)
- Testes em iOS e Android

---

## 🔔 Sistema de Notificações

### Implementação Atual

```javascript
// 1. Usuário ativa nas Configurações
notificationToggle.addEventListener('change', async () => {
  if (checked) {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      settings.notificationsEnabled = true;
      scheduleNotifications();
    }
  }
});

// 2. Sistema verifica a cada 30 segundos
setInterval(() => {
  checkAndSendNotification();
}, 30000);

// 3. Se hora bater com horário configurado:
function checkAndSendNotification() {
  const now = new Date();
  const currentTime = `${now.getHours()}:${now.getMinutes()}`;
  
  if (notificationTimes.includes(currentTime)) {
    // Envia apenas 1x por dia
    if (!sentToday[currentTime]) {
      sendStudyReminder();
      sentToday[currentTime] = true;
    }
  }
}
```

### Mensagens Dinâmicas

```javascript
// Calcula cards pendentes
const totalDue = decks.reduce((sum, deck) => {
  return sum + deck.cards.filter(isCardDue).length;
}, 0);

if (totalDue === 0) {
  new Notification('🎉 Parabéns!', {
    body: 'Você está em dia com seus estudos!'
  });
} else {
  new Notification('📚 Hora de Estudar!', {
    body: `Você tem ${totalDue} cartão${totalDue > 1 ? 'ões' : ''} para revisar`
  });
}
```

---

## 📊 Exemplos de Dados Reais

### Histórico de 7 dias (exemplo real do sistema)

```javascript
studyHistory: {
  "2025-01-29": { cards: 0, newCards: 0, reviews: 0 },
  "2025-01-30": { cards: 1, newCards: 1, reviews: 0, correct: 1, wrong: 0 },
  "2025-01-31": { cards: 36, newCards: 20, reviews: 16, correct: 30, wrong: 6 },
  "2025-02-01": { cards: 2, newCards: 0, reviews: 2, correct: 1, wrong: 1 },
  "2025-02-02": { cards: 0, newCards: 0, reviews: 0 },
  "2025-02-03": { cards: 48, newCards: 15, reviews: 33, correct: 45, wrong: 3 },
  "2025-02-04": { cards: 69, newCards: 30, reviews: 39, correct: 65, wrong: 4 }
}

// Analytics calculados:
// Taxa de conclusão: 69/(7×20) = 49%
// Consistência: 4/7 dias = 57%
// Dias acima da meta: 2 (Sáb: 36, Qua: 69)
// Dias na média: 1 (Ter: 48 entre 15-20)
// Dias abaixo: 1 (Sex: 1)
```

---

## 🐛 Troubleshooting

### Gráfico não mostra barras proporcionais
**Solução:** Verifique se está usando a versão corrigida do `analytics.js`:
```javascript
// ✅ CORRETO (não inclui userGoal):
const maxCards = Math.max(...data.map(d => d.cards), 1);

// ❌ ERRADO:
const maxCards = Math.max(...data.map(d => d.cards), userGoal, 1);
```

### Dashboard mostra "0/20" mesmo estudando
**Solução:** Verifique se `app-study.js` está incrementando:
```javascript
if (isNewCard) {
  appState.stats.newCardsToday++;
} else {
  appState.stats.reviewsToday++;
}
```

### Analytics não usa meta do cadastro
**Solução:** Verifique ordem de busca em `analytics.js`:
```javascript
if (userData.settings?.newCardsPerDay) {
  userGoal = userData.settings.newCardsPerDay;  // Prioridade 1
} else if (userData.metaDiaria) {
  userGoal = userData.metaDiaria;               // Prioridade 2
}
```

### Todos cards contam como "novos"
**Solução:** Certifique-se que está marcando `lastReviewed`:
```javascript
// Em rateCard():
originalCard.lastReviewed = now.toISOString();
```

### Firebase Permission Denied
**Solução:** Verifique regras do Firestore:
```javascript
match /users/{userId} {
  allow read, write: if request.auth.uid == userId;
}
```

---

## 📝 Checklist de Implementação

### ✅ Fase 1: Setup (COMPLETO)
- [x] Criar projeto no Firebase
- [x] Ativar Authentication (Email + Google)
- [x] Criar Firestore Database
- [x] Configurar regras de segurança
- [x] Copiar credenciais para firebase-config.js

### ✅ Fase 2: Autenticação (COMPLETO)
- [x] Login com email/senha
- [x] Login com Google
- [x] Cadastro onboarding 8 etapas
- [x] Dados salvos corretamente no Firestore
- [x] Settings inicializados com metas separadas 🆕

### ✅ Fase 3: App Principal (COMPLETO)
- [x] app.html com sidebar
- [x] CRUD de decks completo
- [x] CRUD de pastas
- [x] Logout funcionando
- [x] Dashboard com 4 cards informativos 🆕
- [x] Modo de estudo (normal + digitação)

### ✅ Fase 4: Decks de Exemplo (COMPLETO)
- [x] 7 idiomas disponíveis
- [x] Importação de decks
- [x] Cards na ordem correta (PT → idioma)

### ✅ Fase 5: Sistema de Estudos (COMPLETO)
- [x] Algoritmo de repetição espaçada
- [x] Sistema de streak
- [x] Histórico por data
- [x] Detecção de novos cards vs revisões 🆕
- [x] Contadores separados 🆕
- [x] Áudio TTS multi-idioma

### ✅ Fase 6: Analytics (COMPLETO) 🆕
- [x] Página dedicada analytics.html
- [x] Gráfico de barras proporcional
- [x] 4 status cards (acima/média/abaixo/meta)
- [x] 3 anéis de progresso
- [x] Visualização 7 ou 30 dias
- [x] Banner de dados de exemplo
- [x] Integração com studyHistory

### ✅ Fase 7: Metas Personalizadas (COMPLETO) 🆕
- [x] Settings com newCardsPerDay e reviewsPerDay
- [x] Sincronização com metaDiaria
- [x] Dashboard mostra progresso separado
- [x] Analytics usa meta correta
- [x] Configurações editáveis

### ✅ Fase 8: Notificações (COMPLETO)
- [x] Request permission via botão
- [x] Horários personalizáveis
- [x] Verificação em background
- [x] Mensagens dinâmicas

### 🔄 Fase 9: Melhorias Futuras
- [ ] Modo escuro
- [ ] Exportar/Importar JSON
- [ ] Compartilhamento de decks
- [ ] Gráficos de linha (evolução temporal)
- [ ] Conquistas/badges
- [ ] Integração com API de tradução
- [ ] Suporte a imagens nos cards
- [ ] Modo offline completo (PWA)

---

## 🚀 Deploy

### Firebase Hosting (Recomendado)

```bash
# 1. Instalar Firebase CLI
npm install -g firebase-tools

# 2. Login
firebase login

# 3. Inicializar
firebase init hosting

# 4. Configurar
# Public directory: . (raiz do projeto)
# Single-page app: No
# Set up automatic builds: No

# 5. Deploy
firebase deploy
```

### Vercel

1. Conecte repositório GitHub
2. Deploy automático em cada commit
3. Preview deployments em PRs

### Netlify

1. Arraste pasta do projeto
2. Deploy instantâneo
3. Domínio .netlify.app gratuito

---

## 📚 Documentação Adicional

### Arquivos de Referência

- **MUDANCAS_IMPLEMENTADAS.md** - Log de mudanças da v2.0
- **GUIA_COMPLETO.md** - Tutorial passo a passo do sistema de metas
- Console do navegador - Logs detalhados em tempo real

### Estrutura de Logs

O sistema registra tudo no console:

```
📊 Analytics iniciando...
📚 Dados do usuário carregados
  Histórico: 7 dias
  Meta de NOVOS cards (settings): 20
  Meta de REVISÕES: 100
✅ Usando dados reais!
📊 Dados carregados:
  2025-02-04: 69 cards
  2025-02-03: 48 cards
  Sex: 1 cards → altura 1.4% (max: 69)
  Sáb: 36 cards → altura 52.2% (max: 69)
  ...
✅ Analytics carregado!
```

---

## 🎓 Aprendizados e Boas Práticas

### 1. Firestore Optimization
```javascript
// ❌ Evite ler tudo sempre:
const allDecks = await getDocs(collection(db, 'users', uid, 'decks'));

// ✅ Use queries quando possível:
const query = query(decksRef, where('folder', '==', folderName));
```

### 2. Estado Local vs Firebase
```javascript
// ✅ Mantenha estado local sincronizado:
appState.stats.newCardsToday++;  // Local (imediato)
await saveStudyToHistory(...);   // Firebase (persistente)
```

### 3. Detecção de Cards Novos
```javascript
// ✅ Simples e confiável:
const isNewCard = !card.lastReviewed;

// ❌ Não use:
const isNewCard = card.level === 0;  // Pode resetar
```

### 4. Cálculo de Metas
```javascript
// ✅ Meta de revisões proporcional:
reviewsPerDay = newCardsPerDay * 5;

// Raciocínio: Você aprende 10 cards/dia
// Em 5 dias = 50 cards acumulados
// Logo, ~50 revisões/dia é razoável
```

---

## 📞 Suporte e Contato

### Problemas Comuns

1. **Gráfico vazio**: Verifique se há dados em `studyHistory`
2. **Metas não sincronizam**: Veja `saveSettings()` em `app-init.js`
3. **Cards não salvam**: Verifique permissões do Firestore
4. **Notificações não aparecem**: Precisa HTTPS (ou localhost)

### Debug Tips

```javascript
// Ver estado completo:
console.log('Estado:', appState);

// Ver usuário:
console.log('Usuário:', auth.currentUser);

// Ver histórico:
const userDoc = await getDoc(doc(db, 'users', uid));
console.log('Histórico:', userDoc.data().studyHistory);
```

---

## 🏆 Créditos e Agradecimentos

- **Firebase** - Backend as a Service
- **Web Speech API** - TTS multi-idioma
- **Levenshtein Distance** - Algoritmo de similaridade
- **PWA** - Tecnologia de apps progressivos

---

## 📄 Licença

Este projeto é de código aberto para fins educacionais.

**Versão:** 2.0  
**Última Atualização:** 04/02/2025  
**Status:** ✅ Produção

---

**Bons estudos! 📚✨**
