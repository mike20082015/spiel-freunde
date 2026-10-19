// Spiel-Freunde Startseite: kleine Animationen (Entwurf)
(function(){
  // Sprechblasen am Tisch
  var lines = [
    ['horst','Mensch, streng dich mal mehr an!'],
    ['margarethe','Schätzchen, so spielt man doch nicht in besseren Kreisen.'],
    ['uschi','Ach Gott, schon wieder gewonnen. Tut mir fast leid!'],
    ['horst','Na toll. Und dafür bin ick extra wach geblieben?'],
    ['margarethe','Auf meiner Kreuzfahrt hätte man mir den Grand serviert.'],
    ['uschi','Warum hast du nicht Kreuz gespielt? Egal, ich mag dich trotzdem.'],
    ['horst','Letzte Woche hast du mir den Grand vermasselt. Vergess ick nicht!'],
    ['margarethe','Ein Kontra? Wie aufregend. Alle mal herschauen!'],
    ['uschi','Horst, nicht schmollen. Ich koch nachher Kaffee.']
  ];
  var you = ['Jetzt passt mal auf!','Kontra!','Wer hat gegeben?','Ich hab da so ein Gefühl...','Grand Hand, ihr Lieben!'];
  var i = 0, y = 0;
  function show(){
    document.querySelectorAll('.scene .bubble').forEach(function(b){b.classList.remove('show')});
    document.querySelectorAll('.scene .person').forEach(function(p){p.classList.remove('talking')});
    document.querySelectorAll('.scene .spot').forEach(function(s){s.classList.remove('on')});
    var l = lines[i % lines.length];
    var b = document.getElementById('bub-' + l[0]);
    var sp = document.querySelector('.sp-' + l[0]);
    if(b){
      b.querySelector('span').textContent = l[1];
      setTimeout(function(){ b.classList.add('show'); b.parentElement.classList.add('talking'); if(sp) sp.classList.add('on'); }, 120);
    }
    i++;
  }
  setTimeout(function(){ show(); setInterval(function(){ if(!window.__stop) show(); }, 3400); }, 900);
  var chip = document.getElementById('you-chat');
  setInterval(function(){
    if(!chip) return;
    chip.style.opacity = 0;
    setTimeout(function(){ y++; chip.textContent = you[y % you.length]; chip.style.opacity = 1; }, 300);
  }, 5100);

  // Einblenden beim Scrollen
  var els = document.querySelectorAll('.char, .game, .place, .step, .plan, .who-card, .sec-head, .trial, .faq details');
  els.forEach(function(e){ e.classList.add('reveal'); });
  var chatLines = document.querySelectorAll('.cl');
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){ en.target.classList.add('visible'); io.unobserve(en.target); }
      });
    }, {threshold:.12});
    els.forEach(function(e){ io.observe(e); });
    var chat = document.querySelector('.chat-demo');
    var io2 = new IntersectionObserver(function(entries){
      if(entries[0].isIntersecting){
        chatLines.forEach(function(c, k){ setTimeout(function(){ c.classList.add('in'); }, 300 + k * 900); });
        io2.disconnect();
      }
    }, {threshold:.3});
    if(chat) io2.observe(chat);
  } else {
    els.forEach(function(e){ e.classList.add('visible'); });
    chatLines.forEach(function(c){ c.classList.add('in'); });
  }
  // Fuer Screenshots: ?static=1 zeigt alles sofort
  if(/static=1/.test(location.search)){
    els.forEach(function(e){ e.classList.add('visible'); });
    chatLines.forEach(function(c){ c.classList.add('in'); });
  }
})();
