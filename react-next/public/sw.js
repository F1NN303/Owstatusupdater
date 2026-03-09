const VERSION = "2026-03-09-1";
const APP_SHELL_CACHE = `owstatus-app-shell-${VERSION}`;
const STATIC_CACHE = `owstatus-static-${VERSION}`;
const DATA_CACHE = `owstatus-data-${VERSION}`;

function currentBasePath() {
  const scopePath = new URL(self.registration.scope).pathname || "/";
  return scopePath.endsWith("/") ? scopePath.slice(0, -1) : scopePath;
}

function currentBaseUrl(path) {
  const basePath = currentBasePath();
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${suffix}`;
}

function isDataRequest(url) {
  return (
    url.origin === self.location.origin &&
    (/\/data\/.+\.json$/i.test(url.pathname) ||
      /\/history\.json$/i.test(url.pathname) ||
      /\/subscription\.json$/i.test(url.pathname))
  );
}

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith(`${currentBasePath()}/assets/`) ||
      /\.(?:css|js|png|jpg|jpeg|svg|ico|webp|woff2?)$/i.test(url.pathname))
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) =>
      cache.addAll([
        currentBaseUrl("/"),
        currentBaseUrl("/index.html"),
        currentBaseUrl("/favicon.ico"),
        currentBaseUrl("/apple-touch-icon.png"),
      ]).catch(() => undefined)
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (
            key === APP_SHELL_CACHE ||
            key === STATIC_CACHE ||
            key === DATA_CACHE
          ) {
            return Promise.resolve();
          }
          if (key.startsWith("owstatus-")) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(APP_SHELL_CACHE).then((cache) => cache.put(currentBaseUrl("/index.html"), copy));
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(APP_SHELL_CACHE);
          return (
            (await cache.match(currentBaseUrl("/index.html"))) ||
            (await cache.match(currentBaseUrl("/"))) ||
            Response.error()
          );
        })
    );
    return;
  }

  if (isDataRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(DATA_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(DATA_CACHE);
          return (await cache.match(request)) || Response.error();
        })
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) {
              void cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => undefined);

        if (cached) {
          void networkFetch;
          return cached;
        }

        return (await networkFetch) || Response.error();
      })
    );
  }
});
