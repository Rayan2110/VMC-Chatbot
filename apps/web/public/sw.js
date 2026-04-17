// Service Worker minimal — nécessaire pour que le navigateur Android
// propose "Ajouter à l'écran d'accueil" (PWA installable).
// Pour l'instant on ne cache rien (l'app nécessite le réseau).
// En phase 2, on pourra ajouter du cache offline ici.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => self.clients.claim());