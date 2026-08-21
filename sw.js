/* Oh Hell — offline shell.

   The scorepad is one HTML file with no network calls of its own, so
   "offline" only means: hold on to the shell and the fonts.  The game
   itself lives in localStorage, not here.

   Bump CACHE whenever a precached file changes.  Old caches are dropped on
   activate, so a stale shell cannot outlive a deploy. */

var CACHE = "ohhell-v2";   /* bumped: new icon art */

var SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

/* Google Fonts cannot be precached by name: the stylesheet names font files
   whose URLs change with every font release, so a hardcoded list would rot.
   They are cached on first use instead — the visit that installs the app is
   online by definition, so the fonts are here before they are needed. */
function isFont(url){
  return url.origin === "https://fonts.googleapis.com" ||
         url.origin === "https://fonts.gstatic.com";
}

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){ return c.addAll(SHELL); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;
  var url = new URL(req.url);

  /* Fonts: cache first.  A given Google Fonts URL is immutable, so a hit is
     always good, and missing them offline is survivable — the page falls
     back to Didot/Times. */
  if(isFont(url)){
    e.respondWith(
      caches.match(req).then(function(hit){
        return hit || fetch(req).then(function(res){
          /* The stylesheet <link> carries no crossorigin attribute, so its
             response is opaque and res.ok is false.  Cache it anyway. */
          if(res.ok || res.type === "opaque"){
            var copy = res.clone();
            caches.open(CACHE).then(function(c){ c.put(req, copy); });
          }
          return res;
        }).catch(function(){ return Response.error(); });
      })
    );
    return;
  }

  if(url.origin !== location.origin) return;

  /* The page: network first, so a deploy lands on the next launch with a
     signal instead of being shadowed by the cache forever.  Every online
     launch refreshes the copy the offline path will serve. */
  if(req.mode === "navigate"){
    e.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put("./index.html", copy); });
        return res;
      }).catch(function(){
        return caches.match("./index.html").then(function(hit){
          return hit || caches.match("./");
        });
      })
    );
    return;
  }

  /* Icons and manifest: cache first, they are versioned by CACHE. */
  e.respondWith(
    caches.match(req).then(function(hit){
      return hit || fetch(req).then(function(res){
        if(res.ok){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
