const CACHE='puck-props-v46';
const SHELL=['./','./index.html','./app.js?v=46','./manifest.json','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('puck-props-')&&key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(url.origin!==location.origin||request.method!=='GET'||url.pathname.startsWith('/api/'))return;
 // Serve the installed shell while Render wakes; never cache API responses.
 if(request.mode==='navigate'){
  event.respondWith((async()=>{const cached=await caches.match('./index.html');if(cached)return cached;
   try{return await fetch(request)}catch{return new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Puck Props</title><body style="background:#050a12;color:#fff;font:18px system-ui;text-align:center;padding:15vh 24px"><h1>PUCK PROPS</h1><p>Reconnect to load your hockey dashboard.</p><a href="/" style="color:#369bff">Try again</a></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}})}
  })());return;
 }
 if(!['/app.js','/manifest.json','/icon.svg'].includes(url.pathname))return;
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
});
