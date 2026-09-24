/* Hero clip: a muted screen recording that has to move on every phone.
   1. <video autoplay muted playsinline> plays almost everywhere.
   2. When the browser refuses it (iOS Low Power Mode, in-app browsers, data saver),
      the same clip is laid over the video as an animated WebP preview. Images are
      not blocked, and the WebP only downloads when it is needed.
   3. The button (and a tap anywhere on the phone) shows Pause while anything moves
      and stops it; when stopped it shows Play. A tap is a user gesture, so Play
      starts the real video even where autoplay was refused.
   ?anim=1 forces the WebP path for testing. */
(function(){
  var ph=document.querySelector('.hero-phone[data-anim]');
  var v=ph&&ph.querySelector('video'),btn=ph&&ph.querySelector('.clip-btn');
  if(!v||!btn)return;
  var src=ph.getAttribute('data-anim');
  // live: the real video is playing ('playing' seen, no 'pause' since)
  // blocked: a tap could not start the inline video, so taps toggle the preview instead
  // failed: the WebP did not load, so the watchdog stops retrying it
  var img=null,live=false,userPaused=false,blocked=false,failed=false,tapTimer=0,iv=0;
  var forceImage=/[?&]anim=1(&|$)/.test(location.search);

  function label(){
    var moving=live||!!img;
    btn.hidden=false;
    btn.classList.toggle('is-paused',!moving);
    btn.setAttribute('aria-label',moving?'Pause video':'Play video');
  }
  function dropImage(){
    if(!img)return;
    img.onload=img.onerror=null;img.removeAttribute('src');img.remove();img=null;
  }
  function showImage(auto){
    clearInterval(iv);
    if(img||userPaused||(live&&!forceImage)||(auto&&failed))return;
    var el=img=new Image();
    el.className='shot anim';el.alt='';el.decoding='async';el.draggable=false;el.setAttribute('aria-hidden','true');
    el.onload=function(){if(img===el)el.classList.add('on');};
    el.onerror=function(){if(img===el){failed=true;img=null;el.remove();label();}};
    el.src=src;
    ph.insertBefore(el,btn);
    label();
  }
  function stop(){
    userPaused=true;clearTimeout(tapTimer);v.autoplay=false;
    dropImage();
    if(!v.paused)v.pause();
    live=false;label();
  }
  function play(fromTap){
    var p;
    try{p=v.play();}catch(e){clearTimeout(tapTimer);showImage(!fromTap);return;}
    if(p&&p.then)p.then(function(){
      if(!v.paused&&!userPaused&&!live){live=true;dropImage();label();}
    },function(e){
      // AbortError = paused or interrupted (by us or the system), not refused
      if(e&&e.name==='AbortError')return;
      if(fromTap){clearTimeout(tapTimer);blocked=true;}
      showImage(!fromTap);
    });
    if(fromTap){
      clearTimeout(tapTimer);
      tapTimer=setTimeout(function(){
        if(!live&&!img&&!userPaused&&!failed){blocked=true;showImage(false);}
      },2500);
    }
  }
  function toggle(){
    forceImage=false;
    if(live||img){stop();return;}
    userPaused=false;
    if(blocked&&!failed)showImage(false);else play(true);
  }

  v.muted=true;v.defaultMuted=true;v.playsInline=true;
  v.addEventListener('playing',function(){
    if(forceImage||userPaused){v.pause();return;}
    live=true;clearTimeout(tapTimer);
    if(!v.webkitDisplayingFullscreen)blocked=false;
    dropImage();
    label();
  });
  v.addEventListener('pause',function(){live=false;label();});
  // in-app browsers without inline playback open a fullscreen player; bring the preview back after
  v.addEventListener('webkitendfullscreen',function(){
    setTimeout(function(){
      if(v.paused&&!userPaused){blocked=true;live=false;showImage(false);}
    },250);
  });
  ph.addEventListener('click',toggle);
  window.addEventListener('pageshow',function(e){
    if(e.persisted&&!userPaused&&!live&&!img)play(false);
  });
  document.addEventListener('visibilitychange',function(){
    if(document.hidden)return;
    if(!userPaused&&!live&&!img)play(false);
    // iOS drops a paused video's picture while the page is hidden; reloading shows the poster
    else if(userPaused&&v.paused&&!img)v.load();
  });

  if(!v.paused&&v.readyState>=3){live=true;label();}
  if(forceImage){v.removeAttribute('autoplay');v.pause();showImage(false);return;}
  play(false);
  // Some browsers neither play nor reject. If the clip still is not playing once it
  // could play (3 s), after 8 s, or as soon as no source can load, show the preview.
  // Only count while the phone is on screen in a visible tab: WebKit holds autoplay
  // for off-screen video.
  var t=0;
  iv=setInterval(function(){
    if(live||img||userPaused){clearInterval(iv);return;}
    if(document.hidden)return;
    var r=ph.getBoundingClientRect();
    if(r.bottom<=0||r.top>=(window.innerHeight||document.documentElement.clientHeight))return;
    t+=500;
    if((t>=3000&&v.readyState>=3)||t>=8000||v.networkState===3)showImage(true);
  },500);
})();
