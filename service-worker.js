// Adapted from the supplied runtime cache. Unity preprocesses a fresh cache ID on export.
const APP_ROOT = new URL("./", self.location.href);
const CACHE_PREFIX = "scanimals-web:" + encodeURIComponent(APP_ROOT.pathname) + ":";
const CACHE_NAME = CACHE_PREFIX + "mvuzf6cq";

// Keep the normal waiting lifecycle so updates do not replace a worker during a running game.
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("range") || request.cache === "no-store") return;
  const url = new URL(request.url);
  if (url.origin !== APP_ROOT.origin || !url.pathname.startsWith(APP_ROOT.pathname)) return;
  const relative = url.pathname.slice(APP_ROOT.pathname.length);
  const navigation = request.mode === "navigate" && (relative === "" || relative === "index.html");
  if (!navigation && !["Build/", "TemplateData/", "StreamingAssets/"].some(path => relative.startsWith(path))) return;

  const cacheKey = navigation ? new URL("index.html", APP_ROOT).href : request;
  // Revalidate HTML and build files alike: a cached shell must not pin an old Unity loader.
  const network = fetch(request, { cache: "no-cache" }).then(response => ({
    response,
    copy: response.status === 200 && response.type === "basic" && !response.redirected && !/\bno-store\b/i.test(response.headers.get("cache-control") || "")
      ? response.clone() : null
  }));
  // Clone before handing the response to the page; keep writes alive independently of its consumption.
  event.waitUntil(network.then(({ copy }) => copy && caches.open(CACHE_NAME).then(cache => cache.put(cacheKey, copy)), () => {})
    .catch(error => console.warn("Could not cache this game resource.", error)));
  event.respondWith(network.then(({ response }) => response).catch(() =>
    caches.open(CACHE_NAME).then(cache => cache.match(cacheKey)).then(hit => hit || new Response("Reconnect to load this game resource.", { status: 503 }))
  ));
});
