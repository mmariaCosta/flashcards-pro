const CACHE_NAME = 'flashcards-pro-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/cadastro.html',
  '/app.html',
  '/css/app.css',
  '/css/auth.css',
  '/css/onboarding.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/onboarding.js',
  '/js/firebase-config.js',
  '/js/example-decks.js',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// ===== INSTALL =====
self.addEventListener('install', event => {
  console.log('✅ SW: Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Cache aberto');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ SW: Instalado!');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Erro ao instalar SW:', error);
      })
  );
});

// ===== ACTIVATE =====
self.addEventListener('activate', event => {
  console.log('✅ SW: Ativando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('✅ SW: Ativado!');
      return self.clients.claim();
    })
  );
});

// ===== FETCH =====
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Sempre buscar do network para Firebase
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('firestore') || 
      url.hostname.includes('googleapis')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache first para recursos estáticos
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        });
      })
      .catch(() => {
        return caches.match('/index.html');
      })
  );
});

// ===== PUSH NOTIFICATIONS =====
self.addEventListener('push', event => {
  console.log('📬 Push recebido:', event);
  
  const options = {
    body: event.data ? event.data.text() : 'Hora de estudar!',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [200, 100, 200],
    tag: 'flashcard-notification',
    requireInteraction: true,
    actions: [
      { action: 'study', title: '📖 Estudar Agora' },
      { action: 'later', title: '⏰ Mais Tarde' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('📚 Flashcards Pro', options)
  );
});

// ===== NOTIFICATION CLICK =====
self.addEventListener('notificationclick', event => {
  console.log('🔔 Notificação clicada:', event.action);
  
  event.notification.close();
  
  if (event.action === 'study') {
    event.waitUntil(
      clients.openWindow('/app.html#study')
    );
  } else if (event.action === 'later') {
    // Não faz nada
  } else {
    event.waitUntil(
      clients.openWindow('/app.html')
    );
  }
});

console.log('✅ Service Worker carregado');