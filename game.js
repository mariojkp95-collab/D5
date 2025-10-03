/* ===== Drakoria — BUILD HUD-5 (split) ===== */
(function(){
  var BUILD='HUD-5';
  var SAVE_KEY='save_xrq1_inv';
  var QUEST_KEY='quests_xrq1_inv';

  var cv=document.getElementById('game'); var ctx=cv.getContext('2d');

  // --- HUD in-canvas: rettangoli cliccabili
  var HUD = { atk:null, pot:null, loot:null };

  function layoutHud(){
    HUD.atk  = { x: cv.width - 86,  y: cv.height - 86, w: 72, h: 72 }; // 🗡️
    HUD.pot  = { x: cv.width - 166, y: cv.height - 86, w: 72, h: 72 }; // 🍵
    HUD.loot = { x: 14,             y: cv.height - 86, w: 72, h: 72 }; // 👜
  }
  window.addEventListener('resize', layoutHud, false);
  layoutHud();

  var statusEl=document.getElementById('status');
  var btnAttack=document.getElementById('btnAttack'), btnUsePotion=document.getElementById('btnUsePotion');
  var btnSave=document.getElementById('btnSave'), btnLoad=document.getElementById('btnLoad'), btnReset=document.getElementById('btnReset');
  var btnQuest=document.getElementById('btnQuest'), btnQuestClose=document.getElementById('btnQuestClose');
  var questPanel=document.getElementById('questPanel'), questBody=document.getElementById('questBody');
  var btnMini=document.getElementById('btnMini'), miniWrap=document.getElementById('miniWrap'), mini=document.getElementById('mini'), miniCtx=mini.getContext('2d');
  var btnInventory=document.getElementById('btnInventory'), invWin=document.getElementById('invWin'), invClose=document.getElementById('invClose');
  var invTabs=document.getElementById('invTabs'), invGrid=document.getElementById('invGrid');
  var eqWeaponName=document.getElementById('eqWeaponName'), eqArmorName=document.getElementById('eqArmorName');
  var btnUnequipWeapon=document.getElementById('btnUnequipWeapon'), btnUnequipArmor=document.getElementById('btnUnequipArmor');
  var slot1=document.getElementById('slot1'), potCntEl=document.getElementById('cntPot');
  var slotPicker=document.getElementById('slotPicker');
  var errBox=document.getElementById('errBox');
  var atkCdCanvas = document.getElementById('atkCdCanvas');
  var atkCdCtx    = (atkCdCanvas && atkCdCanvas.getContext) ? atkCdCanvas.getContext('2d') : null;
  var lootWin=document.getElementById('lootWin'), lootBody=document.getElementById('lootBody'), lootClose=document.getElementById('lootClose'), lootTakeAll=document.getElementById('lootTakeAll');
  var btnLoot = document.getElementById('btnLoot');
  var btnLog=document.getElementById('btnLog'), logPanel=document.getElementById('logPanel'), logBody=document.getElementById('logBody'), btnLogClose=document.getElementById('btnLogClose');

  // === GAME OVER OVERLAY (agganci sicuri anche se l'HTML sta a fine <body>) ===
  var deathOverlay=null, deathLoad=null, deathReset=null;
  function wireDeathOverlay(){
    deathOverlay = document.getElementById('deathOverlay');
    deathLoad    = document.getElementById('deathLoad');
    deathReset   = document.getElementById('deathReset');

    if (deathLoad && !deathLoad.__wired){
      deathLoad.addEventListener('click', function(){ btnLoad.click(); }, false);
      deathLoad.__wired = true;
    }
    if (deathReset && !deathReset.__wired){
      deathReset.addEventListener('click', function(){ btnReset.click(); }, false);
      deathReset.__wired = true;
    }
  }
  wireDeathOverlay();
  document.addEventListener('DOMContentLoaded', wireDeathOverlay, false);

  // Abilità UI
  var btnAbilities=document.getElementById('btnAbilities'), abilWin=document.getElementById('abilWin'), abilGrid=document.getElementById('abilGrid'), abilClose=document.getElementById('abilClose');

  // Target Frame
  var tframe=document.getElementById('tframe'), tfName=document.getElementById('tfName'), tfKind=document.getElementById('tfKind');
  var tfHpBar=document.getElementById('tfHpBar'), tfHpTxt=document.getElementById('tfHpTxt'), tfDist=document.getElementById('tfDist');

  // DPS
  var dpsText=document.getElementById('dpsText');
  var dpsEvents=[], dpsPeak=0;

  // Cast UI
  var castWrap=document.getElementById('castWrap'), castName=document.getElementById('castName'), castTime=document.getElementById('castTime'), castBar=document.getElementById('castBar');

  // Hotbar caps
  var capEls=[null,
    document.getElementById('slotCap1'),
    document.getElementById('slotCap2'),
    document.getElementById('slotCap3'),
    document.getElementById('slotCap4'),
    document.getElementById('slotCap5')
  ];

  function panic(where, e){
    errBox.style.display='block';
    errBox.textContent='ERRORE '+where+': '+(e && (e.message||e));
    if(window.console&&console.error) console.error('[PANIC]', where, e);
  }

  try{

/* === PATCH-SMOOTH: core tween & render === */
var MOVE_MS = 110;
function startTween(o, fx, fy, tx, ty, now){
  o.vFromX = fx; o.vFromY = fy; o.vToX = tx; o.vToY = ty;
  o.vStart = now; o.vEnd = now + MOVE_MS;
  if (o.vx == null) o.vx = fx;
  if (o.vy == null) o.vy = fy;
}
function tweenUpdate(o, now){
  if(!o) return;
  var has = (o.vStart && o.vEnd && o.vEnd > o.vStart);
  if(has && now < o.vEnd){
    var t = (now - o.vStart) / (o.vEnd - o.vStart);
    t = t*t*(3 - 2*t);
    o.vx = o.vFromX + (o.vToX - o.vFromX) * t;
    o.vy = o.vFromY + (o.vToY - o.vFromY) * t;
  } else {
    if (o.x != null) o.vx = o.x;
    if (o.y != null) o.vy = o.y;
    o.vStart = 0; o.vEnd = 0;
  }
}
function updateTweens(){
  var now = performance.now();
  tweenUpdate(player, now);
  for (var i=0;i<enemies.length;i++) tweenUpdate(enemies[i], now);
  for (var j=0;j<projectiles.length;j++) tweenUpdate(projectiles[j], now);
}

    // ===== Dati runtime =====
    var lootBags=[]; var nextItemId=1;
    var dead = false;
    var lootSuppress = { id:null, until:0 };
    function bagKey(b){ return b.x+','+b.y; }
    var teleportGuardUntil = 0;

    // Inventario & equip
function refreshEquipUi(){
  eqWeaponName.textContent = equipped.weapon ? equipped.weapon.name : '—';
  btnUnequipWeapon.disabled = !equipped.weapon;
  eqArmorName.textContent  = equipped.armor  ? equipped.armor.name  : '—';
  btnUnequipArmor.disabled = !equipped.armor;
}
function unequip(which){
  if(which==='weapon'){ equipped.weapon=null; }
  else if(which==='armor'){ equipped.armor=null; }
  recomputeStats(false);
  refreshEquipUi();
}
function equip(it){
  if(it.type==='weapon'){ equipped.weapon = it; }
  if(it.type==='armor'){  equipped.armor  = it; }
  recomputeStats(false);
  refreshEquipUi();
  toast('Equipaggiato: '+it.icon+' '+it.name);
}
function renderTabs(){
  invTabs.innerHTML='';
  INV_TABS.forEach(function(t){
    var b=document.createElement('button');
    b.className='tab'+(t===currentTab?' active':'');
    b.textContent=t;
    b.onclick=function(){ currentTab=t; renderTabs(); renderInventory(); };
    invTabs.appendChild(b);
  });
}
function renderInventory(){
  invGrid.innerHTML='';
  function matchTab(it){
    if(currentTab==='Tutto') return true;
    if(currentTab==='Armi') return it.type==='weapon';
    if(currentTab==='Armature') return it.type==='armor';
    if(currentTab==='Consumabili') return it.type==='potion'||it.type==='consumable';
    if(currentTab==='Materiali') return it.type==='material';
    return true;
  }
  inventory.filter(matchTab).forEach(function(it){
    var d=document.createElement('div');
    d.className='invItem '+(it.rarity?('r-'+it.rarity):'');
    d.innerHTML = '<div class="cap">'+it.icon+' '+it.name+'</div>'+
                  (it.qty?('<div class="badge">x'+it.qty+'</div>'):'')+
                  '<div class="row"></div>';
    var row=d.querySelector('.row');

    if(it.type==='weapon' || it.type==='armor'){
      var beq=document.createElement('button'); beq.className='act'; beq.textContent='Equip';
      beq.onclick=function(){ equip(it); };
      row.appendChild(beq);
    }
    if(it.type==='potion' || it.type==='consumable'){
      var busa=document.createElement('button'); busa.className='act'; busa.textContent='Usa';
      busa.onclick=function(){ useHotbarItem({kind:'item', icon:it.icon, itemId:it.id}); };
      row.appendChild(busa);
    }
    var bbar=document.createElement('button'); bbar.className='act'; bbar.textContent='→ Barra';
    bbar.onclick=function(){ openSlotPickerForItem(it); };
    row.appendChild(bbar);

    invGrid.appendChild(d);
  });
  refreshEquipUi();
}
function renderInventoryIfOpen(){
  if(!invWin.classList.contains('hidden')){ renderTabs(); renderInventory(); }
}
function openSlotPickerForItem(it){
  slotPicker.classList.remove('hidden');
  slotPicker.querySelectorAll('.pickBtn').forEach(function(btn){
    btn.onclick=function(){
      var s = +btn.getAttribute('data-slot');
      hotbar[s] = { kind:'item', icon:it.icon, itemId:it.id };
      capEls[s].textContent = it.icon || '—';
      slotPicker.classList.add('hidden');
      toast('Assegnato allo slot '+s);
    };
  });
}
function applyItem(it){
  if(it.type==='coin'){
    var n = it.qty||1; player.coins += n; questAdd('coin', n);
    logLoot('Monete +' + n); return;
  }
  if(it.type==='potion'){
    var m = it.qty||1; player.pots += m; updateHotbarCounts();
    logLoot('Pozioni +' + m); return;
  }
  inventory.push(it);
  logLoot('Ottenuto: '+it.icon+' '+it.name);
  renderInventoryIfOpen();
}
    var inventory=[];
    var equipped={weapon:null, armor:null};
    var INV_TABS=['Tutto','Armi','Armature','Consumabili','Materiali'];
    var currentTab='Tutto';
    var hotbar=[null, {kind:'potion', icon:'🍵'}, null, null, null, null];

    // Abilità (collezionabili)
    var abilities = [
      { id:'arc_wave', name:'Ondata Arcana', icon:'✨', desc:'Colpisce ad area le 8 caselle adiacenti. Cast 1.5s, CD 6s.', castMs:1500, cdMs:6000,
        use: function(){ castAbility(this, aoeArcWave); } }
    ];
    var lastCast = {}; // id -> ts
    var isCasting=false, castStart=0, currentCasting=null;

    // --- MAPPA
    var COLS=21, ROWS=12, TILE=64;
    var map=[];
    cv.width  = COLS * TILE;
    cv.height = ROWS * TILE;

    // --- PLAYER / ENEMY
    var _eid=1; function giveId(e){ e.id=_eid++; return e; }
    var player={
      x:12,y:4,
      baseMaxHp:100, baseAtkMin:6, baseAtkMax:12,
      maxHp:100, hp:100, atkMin:6, atkMax:12,
      coins:0,pots:1,lastAtk:0,atkCd:450,lvl:1,exp:0,
      critChance:0.10, critMult:1.5
    };
    recomputeStats(true);
    player.vx = player.x; player.vy = player.y;
    var lastPlayerX = player.x, lastPlayerY = player.y;

    function makeSlime(x,y){
      var e = {
        kind:'slime', type:'melee', x:x, y:y, spawnX:x, spawnY:y,
        hp:60,maxHp:60, atkMin:5,atkMax:9,
        hitCd:800,lastHit:0,
        aggro:false, aggroRange:5, leashRange:15, loseAggroMs:6000, lastSeenTs:0,
        moveTick:0, moveEvery:6, path:[], mode:'idle'
      };
      e.vx = x; e.vy = y;
      return giveId(e);
    }
    function makeArcher(x,y){
      var e = {
        kind:'archer', type:'ranged', x:x, y:y, spawnX:x, spawnY:y,
        hp:40,maxHp:40, atkCd:1200,lastShot:0, rangeMin:3, rangeMax:7,
        pokeCd:700,lastPoke:0,
        aggro:false, aggroRange:7, leashRange:15, loseAggroMs:6000, lastSeenTs:0,
        moveTick:0, moveEvery:6, path:[], mode:'idle'
      };
      e.vx = x; e.vy = y;
      return giveId(e);
    }

    var enemies=[ makeSlime(COLS-2,ROWS-2), makeArcher(COLS-4,2) ];

    // === WORLD / MAP MANAGER ===
    var WORLD = { current: 'spawn', portals: makePortals() };
    function makePortals(){
      var mid = Math.floor(ROWS/2);
      return {
        main:  [ { x: 1,        y: mid, to: 'spawn', tx: COLS-2, ty: mid } ],
        spawn: [ { x: COLS-2,   y: mid, to: 'main',  tx: 1,      ty: mid } ]
      };
    }
    function isPortalTile(worldName, x, y){
      var list = (WORLD.portals && WORLD.portals[worldName]) || [];
      for (var i=0;i<list.length;i++){ var p=list[i]; if(p.x===x && p.y===y) return true; }
      return false;
    }
    function findSafeExit(worldName, px, py){
      var candidates = [
        [ 1, 0],[-1, 0],[ 0, 1],[ 0,-1],
        [ 1, 1],[-1, 1],[ 1,-1],[-1,-1],
        [ 2, 0],[-2, 0],[ 0, 2],[ 0,-2]
      ];
      for (var i=0;i<candidates.length;i++){
        var nx = px + candidates[i][0], ny = py + candidates[i][1];
        if(!inside(nx,ny)) continue;
        if(!walkable(nx,ny)) continue;
        if(isPortalTile(worldName, nx, ny)) continue;
        if(!tileFree(nx,ny)) continue;
        return {x:nx, y:ny};
      }
      return {x:px, y:py};
    }
    var THEMES = {
      main:  { '--tileA':'#0e2a1e', '--tileB':'#123022' },
      spawn: { '--tileA':'#1e1f3a', '--tileB':'#23264a' }
    };
    function applyTheme(vars){
      var root = document.documentElement.style;
      for (var k in vars) root.setProperty(k, vars[k]);
    }
    function buildMap(name){
      var cols = COLS, rows = ROWS;
      var m = [];
      for (var y=0; y<rows; y++){
        var row = [];
        for (var x=0; x<cols; x++) row.push(0);
        m.push(row);
      }
      if (name === 'main'){
        for (var i=0; i<16; i++){
          var bx=(Math.random()*cols|0), by=(Math.random()*rows|0);
          if (isPortalTile('main', bx, by)) continue;
          if ((bx===1 && by===4) || (bx===cols-2 && by===rows-2)) continue;
          m[by][bx] = 1;
        }
      }
      var themeVars = (name==='main') ? THEMES.main : THEMES.spawn;
      return { map: m, themeVars: themeVars };
    }
    function drawPortals(ctx, tileSize){
      var list = WORLD.portals[WORLD.current] || [];
      ctx.save();
      for(var i=0;i<list.length;i++){
        var p=list[i];
        ctx.fillStyle = '#7c3aed';
        ctx.globalAlpha = 0.95;
        ctx.fillRect(p.x*tileSize+6, p.y*tileSize+6, tileSize-12, tileSize-12);
        ctx.globalAlpha = 0.35;
        ctx.fillRect(p.x*tileSize+3, p.y*tileSize+3, tileSize-6, tileSize-6);
      }
      ctx.restore();
    }

    function checkPortalAndTeleport(justEntered){
      if(!justEntered) return;
      var now = performance.now();
      if (now < teleportGuardUntil) return;

      var px = player.x, py = player.y;
      var list = WORLD.portals[WORLD.current] || [];
      var hit = null;
      for(var i=0;i<list.length;i++){
        var p=list[i];
        if(p.x===px && p.y===py){ hit=p; break; }
      }
      if(!hit) return;

      var res = buildMap(hit.to);
      map = res.map;
      applyTheme(res.themeVars);
      WORLD.current = hit.to;

      var exit = findSafeExit(hit.to, hit.tx, hit.ty);
      player.x = exit.x; player.y = exit.y;
      player.vx = player.x; player.vy = player.y;

      if (WORLD.current === 'spawn'){
        coins.length = 0;
        potions.length = 0;
        projectiles.length = 0;
        enemies.length = 0;
      } else if (WORLD.current === 'main' && enemies.length === 0){
        enemies.push(makeSlime(COLS-2, ROWS-2));
        enemies.push(makeArcher(COLS-4, 2));
      }

      if (Array.isArray(pathQueue)) pathQueue.length = 0;
      teleportGuardUntil = performance.now() + 450;

      logSys('Teletrasporto: ' + (WORLD.current==='spawn'?'Spawn':'Main'));
      draw(); drawMini();
    }

    // OGGETTI + PROIETTILI
    var coins=[], potions=[], projectiles=[];

    // inizializza la mappa iniziale (lasciamo spawn vuoto, come nel tuo design)
    var initRes = buildMap('spawn');
    map = initRes.map;
    applyTheme(initRes.themeVars);
    WORLD.current = 'spawn';
    enemies.length = 0;
    if (WORLD.current === 'main') {
      for (var i1=0;i1<4;i1++) coins.push(randEmpty());
      for (var i2=0;i2<1;i2++) potions.push(randEmpty());
    }

    // TARGET LOCK + AUTO-CHASE
    var target=null, autoChase=false, lastEnemyTapTs=0, lastEnemyTapId=-1;

    // HUD: danni fluttuanti
    var dmgTexts=[];

    // XP / LEVEL
    var MAX_LVL=99;
    function xpNeeded(l){ return Math.floor(50*Math.pow(l,1.5)); }
    function gainXP(n){
      if(player.lvl>=MAX_LVL) return;
      player.exp+=n;
      while(player.lvl<MAX_LVL && player.exp>=xpNeeded(player.lvl)){
        player.exp-=xpNeeded(player.lvl);
        levelUp();
      }
    }
    function levelUp(){
      player.lvl = Math.min(MAX_LVL, player.lvl+1);
      player.baseMaxHp += 10;
      player.baseAtkMin += 1; player.baseAtkMax += 1;
      recomputeStats(true);
      flashScreen('#22c55e');
      logSys('Level up! Ora sei LV '+player.lvl);
    }
    function recomputeStats(heal){
      var atkB=0, hpB=0;
      if(equipped.weapon && equipped.weapon.atkBonus) atkB += equipped.weapon.atkBonus;
      if(equipped.armor  && equipped.armor.hpBonus)   hpB += equipped.armor.hpBonus;
      player.maxHp = player.baseMaxHp + hpB;
      player.atkMin = player.baseAtkMin + atkB;
      player.atkMax = player.baseAtkMax + atkB;
      if(heal) player.hp = player.maxHp;
      if(player.hp>player.maxHp) player.hp = player.maxHp;
    }

    // QUEST
    var quests=[{id:'q1',title:'Raccogli 10 monete',desc:'Trova e raccogli 10 monete.',type:'collect',needed:10,progress:0,status:'active',reward:{xp:50,pots:1}}];
    var currentQuest=0;
    function renderQuest(){
      var q=quests[currentQuest]; if(!q){ questBody.innerHTML='<div class="q-title">Nessuna quest</div>'; return; }
      var ratio=q.needed?Math.floor(100*(q.progress/q.needed)):100, rw=q.reward||{}, dis=(q.status!=='completed');
      questBody.innerHTML=
        '<div class="q-title">'+q.title+'</div>'+
        '<div class="q-desc">'+q.desc+'</div>'+
        '<div class="q-row"><div class="progress"><div style="width:'+ratio+'%"></div></div><div style="margin-left:8px">'+q.progress+'/'+q.needed+'</div></div>'+
        '<div class="q-reward">Ricompensa: '+(rw.xp?('+'+rw.xp+' XP '):'')+(rw.pots?('· +'+rw.pots+' pozione'): '')+'</div>'+
        '<button id="btnClaim" class="q-claim" '+(dis?'disabled':'')+'>Riscatta</button>';
      var btn=document.getElementById('btnClaim'); if(btn) btn.onclick=claimQuest;
    }
    function questAdd(kind,amt){
      var q=quests[currentQuest]; if(!q||q.status!=='active') return;
      if(q.type==='collect' && kind==='coin'){ q.progress = Math.min(q.needed, q.progress + (amt||1)); }
      if(q.progress>=q.needed){ q.status='completed'; toast('Quest completata! Riscatta.'); logSys('Quest completata: '+q.title); }
      renderQuest();
    }
    function claimQuest(){ var q=quests[currentQuest]; if(!q||q.status!=='completed') return; var rw=q.reward||{}; if(rw.xp) gainXP(rw.xp); if(rw.pots) player.pots += rw.pots; q.status='claimed'; toast('Ricompensa ottenuta.'); logLoot('Ricompensa: +'+(rw.xp||0)+' XP'+(rw.pots?(', +'+rw.pots+' poz.'):'')); renderQuest(); updateHotbarCounts(); }

    document.getElementById('btnQuest').addEventListener('click', function(){ questPanel.classList.toggle('hidden'); }, false);
    btnQuestClose.addEventListener('click', function(){ questPanel.classList.add('hidden'); }, false);
    renderQuest();

    // UTILS
    function inside(x,y){ return x>=0&&y>=0&&x<COLS&&y<ROWS; }

    // FIX: manhattan corretto
    function manhattan(a,b){ return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

    function randEmpty(){
      for (var tries=0; tries<200; tries++){
        var x = rndInt(0, COLS-1), y = rndInt(0, ROWS-1);
        if (walkable(x,y) && tileFree(x,y)) return {x:x,y:y};
      }
      return {x:1, y:1};
    }
    function walkable(x,y){
      if (!inside(x,y)) return false;
      if (map[y][x]!==0) return false;
      return true; // i portali sono camminabili
    }
    function chebyshev(a,b){ var dx=Math.abs(a.x-b.x), dy=Math.abs(a.y-b.y); return dx>dy?dx:dy; }
    function rndInt(a,b){ return a+((Math.random()*(b-a+1))|0); }

    // FIX: getVar con fallback locali (se CSS non carica)
    function getVar(n){
      var cs = window.getComputedStyle(document.documentElement);
      var v = cs.getPropertyValue(n).trim();
      if (v) return v;
      var F = {
        '--tileA':'#0e2a1e','--tileB':'#123022','--block':'#15223b',
        '--player':'#3b82f6','--enemy':'#ef4444','--coin':'#facc15',
        '--shadow':'#0006','--hpBack':'#1f2937'
      };
      return F[n] || '#000';
    }

    function rollCrit(chance){ return Math.random() < (chance||0); }
    function tileFree(x,y){
      if(map[y][x]!==0) return false;
      if(x===player.x && y===player.y) return false;
      for(var i=0;i<enemies.length;i++){ if(enemies[i].x===x && enemies[i].y===y) return false; }
      return true;
    }

    // PATHFIND
    function bfs(sx,sy,tx,ty){
      if(!walkable(tx,ty)) return null;
      var q=[{x:sx,y:sy}], head=0, prev={}, seen={}; seen[sx+','+sy]=1;
      var dirs=[[1,0],[-1,0],[0,1],[0,-1]];
      while(head<q.length){
        var c=q[head++]; if(c.x===tx && c.y===ty){
          var path=[], key=tx+','+ty; while(prev[key]){ var s=key.split(','); path.push({x:+s[0],y:+s[1]}); key=prev[key].x+','+prev[key].y; } path.reverse(); return path;
        }
        for(var d=0; d<4; d++){
          var nx=c.x+dirs[d][0], ny=c.y+dirs[d][1], kk=nx+','+ny;
          if(!walkable(nx,ny) || seen[kk]) continue; seen[kk]=1; prev[kk]={x:c.x,y:c.y}; q.push({x:nx,y:ny});
        }
      } return null;
    }
    function bfsToAdjacencySmart(sx,sy,tx,ty,enemyType){
      var opts=[[tx+1,ty],[tx-1,ty],[tx,ty+1],[tx,ty-1]], bestPath=null, bestScore=1e9;
      for(var i=0;i<opts.length;i++){
        var ax=opts[i][0], ay=opts[i][1]; if(!walkable(ax,ay)) continue;
        var occupied=false, j; for(j=0;j<enemies.length;j++){ var e=enemies[j]; if(e.x===ax && e.y===ay){ occupied=true; break; } }
        if(occupied) continue; var p=bfs(sx,sy,ax,ay); if(!p) continue; var score=p.length; if(enemyType==='ranged' && (ax===tx||ay===ty)) score+=2;
        if(score<bestScore){ bestScore=score; bestPath=p; }
      } return bestPath;
    }

    // INPUT
    var pathQueue=[], lastTapTs=0;
    function canvasToTile(ev){
      var r=cv.getBoundingClientRect(), t=ev.touches&&ev.touches[0]; var cx=t?t.clientX:ev.clientX, cy=t?t.clientY:ev.clientY;
      var sx=(cx-r.left)*(cv.width/r.width), sy=(cy-r.top)*(cv.height/r.height);
      var tx=Math.max(0,Math.min(COLS-1,(sx/TILE)|0)), ty=Math.max(0,Math.min(ROWS-1,(sy/TILE)|0));
      return {sx:sx, sy:sy, tx:tx, ty:ty};
    }
    function enemyRect(e){ var x=e.x*TILE+TILE/2-16, y=e.y*TILE+TILE/2-22; return {x:x,y:y,w:32,h:36}; }
    function inRect(px,py,r){ return px>=r.x&&px<=r.x+r.w&&py>=r.y&&py<=r.y+r.h; }

    function onCanvasTap(ev){
      try{
        if (dead) return;
        ev.preventDefault();
        if(isCasting) cancelCast('Mossa durante il cast');
        const m = canvasToTile(ev);

        // HUD in canvas
        if (inRect(m.sx, m.sy, HUD.atk))  { tryAttackAdjacent(); return; }
        if (inRect(m.sx, m.sy, HUD.pot))  { usePotion(); return; }
        if (inRect(m.sx, m.sy, HUD.loot)) { openLootIfOnBag(); return; }

        const now = performance.now();
        statusEl.textContent = `[${BUILD}] tap su ${m.tx},${m.ty}`;

        // Targeting
        let clickedEnemy=null;
        for(let i=0;i<enemies.length;i++){
          const ee=enemies[i];
          if(inRect(m.sx,m.sy,enemyRect(ee))){ clickedEnemy=ee; break; }
        }
        if(clickedEnemy){
          if(lastEnemyTapId===clickedEnemy.id && (now-lastEnemyTapTs)<=350){
            target = clickedEnemy; autoChase = true; pathQueue = [];
          } else {
            target = clickedEnemy; autoChase = false;
          }
          lastEnemyTapId = clickedEnemy.id; lastEnemyTapTs = now;
          updateTargetFrame(); draw(); return;
        }

        // Movimento
        autoChase = false;
        const p = bfs(player.x,player.y,m.tx,m.ty);
        if(p && p.length){
          pathQueue = p;
        } else {
          const dx = Math.sign(m.tx - player.x);
          const dy = Math.sign(m.ty - player.y);
          const tryFirst = (Math.abs(m.tx - player.x) >= Math.abs(m.ty - player.y))
                           ? [{x:player.x+dx, y:player.y},{x:player.x, y:player.y+dy}]
                           : [{x:player.x, y:player.y+dy},{x:player.x+dx, y:player.y}];
          let stepped=false;
          for(const nxt of tryFirst){
            if(inside(nxt.x,nxt.y) && walkable(nxt.x,nxt.y)){
              pathQueue = [nxt];
              stepped=true;
              break;
            }
          }
          if(!stepped){
            statusEl.textContent = `[${BUILD}] nessun percorso (blocco/portale davanti)`;
          }
        }

        // Attacco rapido se adiacente
        if(target && chebyshev(player,target)===1 && (now-player.lastAtk)>=player.atkCd){
          attackEnemy(target); return;
        }

        updateDmgTexts();
        draw();
        drawAtkCooldown();
        drawMini();
        updateTargetFrame();
        updateDpsPanel();

      }catch(e){ panic('input', e); }
    }
    cv.addEventListener('pointerup', onCanvasTap, {passive:false});
    cv.addEventListener('click', onCanvasTap, false);

    function tryAttackAdjacent(){
      var now=performance.now(); if(now-player.lastAtk<player.atkCd || isCasting) return false;
      if(target && chebyshev(player,target)===1){ attackEnemy(target); return true; }
      for(var i=0;i<enemies.length;i++){ var en=enemies[i]; if(chebyshev(player,en)===1){ attackEnemy(en); return true; } }
      return false;
    }
    btnAttack.addEventListener('click', tryAttackAdjacent, false);
    btnAttack.addEventListener('touchend', function(e){ e.preventDefault(); tryAttackAdjacent(); }, false);
    window.addEventListener('keydown', function(e){ if(e.code==='Space'||e.key===' ') tryAttackAdjacent(); if(e.key==='e'||e.key==='E') usePotion(); }, false);

    // Hotbar actions
    function activateSlot(n){
      var b=hotbar[n]; if(!b) return;
      if(b.kind==='potion'){ usePotion(); return; }
      if(b.kind==='item'){ useHotbarItem(b); return; }
    }
    document.getElementById('slot1').addEventListener('click', function(){ activateSlot(1); }, false);
    document.getElementById('slot2').addEventListener('click', function(){ activateSlot(2); }, false);
    document.getElementById('slot3').addEventListener('click', function(){ activateSlot(3); }, false);
    document.getElementById('slot4').addEventListener('click', function(){ activateSlot(4); }, false);
    document.getElementById('slot5').addEventListener('click', function(){ activateSlot(5); }, false);

    btnUsePotion.addEventListener('click', usePotion, false);
    btnUsePotion.addEventListener('touchend', function(e){ e.preventDefault(); usePotion(); }, false);

    // Mini
    btnMini.addEventListener('click', function(){
      if(miniWrap.classList.contains('hidden')) miniWrap.classList.remove('hidden'); else miniWrap.classList.add('hidden');
      drawMini();
    }, false);

    // Inventario
    btnInventory.onclick = function(){ invWin.classList.toggle('hidden'); renderTabs(); renderInventory(); };
    invClose.onclick = function(){ invWin.classList.add('hidden'); };
    btnUnequipWeapon.addEventListener('click', function(){ unequip('weapon'); }, false);
    btnUnequipArmor .addEventListener('click', function(){ unequip('armor');  }, false);

    // Abilità
    btnAbilities.onclick = function(){ abilWin.classList.toggle('hidden'); renderAbilities(); };
    abilClose.onclick = function(){ abilWin.classList.add('hidden'); };

    // Log
    btnLog.addEventListener('click', function(){ logPanel.classList.toggle('hidden'); }, false);
    btnLogClose.addEventListener('click', function(){ logPanel.classList.add('hidden'); }, false);

    // COMBAT
    function addDmgText(tx,ty,txt,color){ var px=tx*TILE+TILE/2, py=ty*TILE+TILE/2-28; dmgTexts.push({x:px,y:py,txt:txt,color:color,ttl:700,vy:-0.04}); }
    function updateDmgTexts(){ var dt=120; for(var i=dmgTexts.length-1;i>=0;i--){ var d=dmgTexts[i]; d.ttl-=dt; d.y+=d.vy*dt; if(d.ttl<=0) dmgTexts.splice(i,1); } }
    function drawDmgTexts(){ for(var i=0;i<dmgTexts.length;i++){ var d=dmgTexts[i]; var a=Math.max(0,Math.min(1,d.ttl/700)); ctx.save(); ctx.globalAlpha=a; ctx.fillStyle=d.color; ctx.font='bold 16px system-ui'; ctx.textAlign='center'; ctx.fillText(d.txt,d.x,d.y); ctx.restore(); } }

    function recordDPS(amount){
      var now=performance.now();
      dpsEvents.push({t:now, a:amount|0});
      var cutoff=now-10000;
      while(dpsEvents.length && dpsEvents[0].t<cutoff) dpsEvents.shift();
      var sum=0; for(var i=0;i<dpsEvents.length;i++) sum+=dpsEvents[i].a;
      var dps = Math.round(sum/10);
      if(dps>dpsPeak) dpsPeak=dps;
      dpsText.textContent = dps + ' (picco ' + dpsPeak + ')';
    }

    function attackEnemy(t){
      var now=performance.now(); if(isCasting) return; player.lastAtk=now;
      var base=rndInt(player.atkMin,player.atkMax);
      var isCrit = rollCrit(player.critChance);
      var dmg = Math.floor(base * (isCrit ? player.critMult : 1));
      t.hp=Math.max(0,t.hp-dmg);

      addDmgText(t.x,t.y,(isCrit?'CRIT ':'-')+dmg, isCrit ? '#facc15' : '#ffd166');
      flashCircle(t.x,t.y, isCrit ? '#ffd166' : '#ff0000', isCrit?0.35:0.25, isCrit?30:26);

      t.aggro=true; t.lastSeenTs=now;

      recordDPS(dmg);
      logDmg('Colpisci '+nameOf(t)+' per '+dmg+(isCrit?' (critico)':'')+'.');

      updateTargetFrame();

      if(t.hp===0){
        if(target===t){ target=null; autoChase=false; hideTargetFrame(); }
        trySpawnLootBag(t.x,t.y, t.kind||t.type);
        gainXP(t.type==='ranged'?25:20);
        logSys(nameOf(t)+' è stato sconfitto.');
        enemies.splice(enemies.indexOf(t),1);
        var s=randEmpty(); enemies.push(t.type==='ranged' ? makeArcher(s.x,s.y) : makeSlime(s.x,s.y));
      }
      draw(); drawMini();
    }

    function takePlayerDamage(amount, label){
      player.hp = Math.max(0, player.hp - amount);
      addDmgText(player.x, player.y, label + amount, '#ff6b6b');
      flashCircle(player.x, player.y, '#ff0000', 0.25, 26);
      logDmg('Subisci ' + amount + ' danni.');
      if (isCasting) cancelCast('Interrotto dal danno');
      if (player.hp === 0) gameOver();

      function gameOver(){
        dead = true;
        autoChase = false;
        pathQueue = [];
        target = null;
        if (typeof hideTargetFrame === 'function') hideTargetFrame();
        toast('Sei morto!');
        cv.style.filter = 'grayscale(1)';
        cv.style.opacity = '0.6';
        if (typeof wireDeathOverlay === 'function') wireDeathOverlay();
        if (deathOverlay) deathOverlay.classList.remove('hidden');
      }
    }

    function usePotion(){
      if(player.pots<=0||player.hp>=player.maxHp) return;
      player.pots--; var heal=35; player.hp=Math.min(player.maxHp,player.hp+heal);
      flashScreen('#8b5cf6'); updateHotbarCounts(); draw();
      logHeal('Pozione: +' + heal + ' HP.');
    }
    function useHotbarItem(binding){
      for(var i=0;i<inventory.length;i++){
        var it=inventory[i];
        if(it.id===binding.itemId){
          if(it.type==='potion' || it.type==='consumable'){
            var healed = 0;
            if(it.heal){ var before=player.hp; player.hp=Math.min(player.maxHp, player.hp+it.heal); healed = player.hp-before; if(healed>0){ logHeal('Consumabile: +'+healed+' HP.'); flashScreen('#8b5cf6'); } }
            if(typeof it.qty==='number'){ it.qty--; if(it.qty<=0){ inventory.splice(i,1); clearHotbarIfMissing(binding.itemId); } }
            draw(); renderInventoryIfOpen(); return;
          }
        }
      }
      toast('Oggetto non più in inventario'); clearHotbarIfMissing(binding.itemId);
    }
    function clearHotbarIfMissing(itemId){
      for(var s=1;s<=5;s++){ var b=hotbar[s]; if(b && b.kind==='item' && b.itemId===itemId){ hotbar[s]=null; capEls[s].textContent='—'; } }
    }

    function hasLoS(ax,ay,bx,by){
      if(ax===bx){ var step=(ay<by)?1:-1; for(var y=ay+step; y!==by; y+=step){ if(map[y][ax]===1) return false; } return true; }
      if(ay===by){ var st=(ax<bx)?1:-1; for(var x=ax+st; x!==bx; x+=st){ if(map[ay][x]===1) return false; } return true; }
      return false;
    }

    // ===== LOOT & ITEMS =====
    var BAG_TTL_MS = 90000, BAG_WARN_MS = 10000;
    function trySpawnLootBag(x,y,kind){
      var items=[];
      if(Math.random()<0.85) items.push(makeItem('Monete','🪙','common','coin', rndInt(1,3)));
      if(Math.random()<0.35) items.push(makeItem('Pozione','🍵','common','potion',1,{heal:35}));

      if(kind==='slime' || kind==='melee'){
        if(Math.random()<0.28) items.push(makeItem('Gelatina','🟢','uncommon','material',1));
        if(Math.random()<0.18) items.push(makeWeapon('Pugnale Rozzo','🗡️','uncommon',2));
        if(Math.random()<0.10) items.push(makeArmor ('Fascia di Stoffa','🛡️','uncommon',8));
        if(Math.random()<0.05) items.push(makeWeapon('Lama Viscosa','💚','rare',4));
      } else {
        if(Math.random()<0.22) items.push(makeWeapon('Arco Leggero','🏹','uncommon',3));
        if(Math.random()<0.14) items.push(makeArmor ('Cappuccio di Cuoio','🧢','uncommon',12));
        if(Math.random()<0.08) items.push(makeWeapon('Arco del Falco','🦅','rare',5));
        if(Math.random()<0.04) items.push(makeArmor ('Mantello del Cacciatore','🧥','rare',20));
      }
      if(Math.random()<0.01) items.push(makeWeapon('Lama Leggendaria','⚡','legend',9));
      if(items.length===0) return;
      lootBags.push({ x, y, items, createdAt:performance.now(), ttlMs:BAG_TTL_MS });
    }
    function makeItem(name,icon,rarity,type,qty,extra){
      var o={ id:nextItemId++, name, icon, rarity, type, qty:qty||1 };
      if(extra&&typeof extra==='object'){ for(var k in extra) o[k]=extra[k]; }
      return o;
    }
    function makeWeapon(name,icon,rarity,atkBonus){ return { id:nextItemId++, name, icon, rarity, type:'weapon', slot:'weapon', atkBonus:atkBonus||0 }; }
    function makeArmor (name,icon,rarity,hpBonus){  return { id:nextItemId++, name, icon, rarity, type:'armor',  slot:'armor',  hpBonus: hpBonus||0 }; }
    function getBagAt(x,y){ for(var i=0;i<lootBags.length;i++){ var b=lootBags[i]; if(b.x===x&&b.y===y) return b; } return null; }
    function rarityClass(r){ if(r==='legend')return'r-legend'; if(r==='rare')return'r-rare'; if(r==='uncommon')return'r-uncommon'; return'r-com'; }
    function renderLoot(bag){
      lootBody.innerHTML='';
      var items=bag.items;
      for(var i=0;i<items.length;i++){
        (function(it){
          var d=document.createElement('div');
          d.className='itm '+rarityClass(it.rarity);
          d.innerHTML='<span class="lbl">'+(it.qty?('x'+it.qty):'')+'</span><div class="ico">'+it.icon+
                      '</div><div class="nm">'+it.name+'</div>';
          d.addEventListener('click', function(){ takeItem(bag,it.id); }, false);
          lootBody.appendChild(d);
        })(items[i]);
      }
      lootTakeAll.disabled = items.length===0;
      if(items.length===0) lootBody.innerHTML='<div style="grid-column:1/-1;text-align:center;color:#9aa3b2">Vuoto</div>';
    }
    function takeItem(bag,itemId){
      for(var i=0;i<bag.items.length;i++){
        if(bag.items[i].id===itemId){ var it=bag.items[i]; applyItem(it); bag.items.splice(i,1); break; }
      }
      if(bag.items.length===0){
        lootBags.splice(lootBags.indexOf(bag),1);
        lootWin.classList.add('hidden');
        btnLoot.style.display='none';
      }else{
        renderLoot(bag);
      }
      draw(); drawMini(); updateHotbarCounts();
    }
    function openLootIfOnBag(){
      var bag = getBagAt(player.x, player.y);
      if(!bag){ btnLoot.style.display='none'; return; }

      var key = bagKey(bag);
      if(lootSuppress.id===key && performance.now()<lootSuppress.until){
        btnLoot.style.display='block';
        return;
      }

      var commonOnly = true;
      for (var i=0;i<bag.items.length;i++){
        var t = bag.items[i].type;
        if(t!=='coin' && t!=='potion'){ commonOnly=false; break; }
      }
      if(commonOnly){
        var beforeCoins=player.coins, beforePots=player.pots;
        var emptied=autoPickupCommons(bag);
        var coinsGained=player.coins-beforeCoins, potsGained=player.pots-beforePots;

        if(emptied){ lootBags.splice(lootBags.indexOf(bag),1); btnLoot.style.display='none'; }
        else{ renderLoot(bag); lootWin.classList.remove('hidden'); }

        updateHotbarCounts(); draw(); drawMini();
        if(coinsGained||potsGained){
          toast('Raccolto: '+(coinsGained?('🪙 x'+coinsGained+' '):'')+(potsGained?('🍵 x'+potsGained):''));
          if(coinsGained) logLoot('Monete +'+coinsGained);
          if(potsGained)  logLoot('Pozioni +'+potsGained);
        }
        return;
      }

      renderLoot(bag);
      lootWin.classList.remove('hidden');
    }
    btnLoot.addEventListener('click', openLootIfOnBag, false);
    lootClose.addEventListener('click', function(){
      var bag=getBagAt(player.x,player.y);
      if(bag){ lootSuppress={ id:bagKey(bag), until:performance.now()+2000 }; }
      lootWin.classList.add('hidden');
    }, false);
    lootTakeAll.addEventListener('click', function(){
      var bag=getBagAt(player.x,player.y);
      if(!bag) return;
      while(bag.items.length) applyItem(bag.items.shift());
      lootBags.splice(lootBags.indexOf(bag),1);
      lootWin.classList.add('hidden');
      btnLoot.style.display='none';
      updateHotbarCounts(); draw(); drawMini();
    }, false);
    function autoPickupCommons(bag){
      var keep=[], coinsGained=0, potsGained=0;
      for(var i=0;i<bag.items.length;i++){
        var it=bag.items[i];
        if(it.type==='coin'){ coinsGained+=it.qty; continue; }
        if(it.type==='potion'){ potsGained+=it.qty; continue; }
        keep.push(it);
      }
      if(coinsGained>0){ player.coins+=coinsGained; questAdd('coin',coinsGained); }
      if(potsGained>0){ player.pots+=potsGained; updateHotbarCounts(); }
      bag.items=keep;
      return bag.items.length===0;
    }

    // ===== ABILITÀ =====
    function renderAbilities(){
      abilGrid.innerHTML='';
      for(var i=0;i<abilities.length;i++){
        (function(ab){
          var wrap=document.createElement('div'); wrap.className='abilItem';
          var cdLeft = getAbilityCooldownLeft(ab);
          wrap.innerHTML =
            '<div class="cap">'+ab.icon+' '+ab.name+'</div>'+
            '<div class="desc">'+ab.desc+'</div>'+
            '<div class="row"><span>'+ (cdLeft>0?('CD: '+(cdLeft/1000).toFixed(1)+'s'):'Pronta') +'</span>'+
            '<button class="btn">Lancia</button></div>';
          var btn=wrap.querySelector('.btn');
          btn.disabled = cdLeft>0 || isCasting;
          btn.onclick=function(){ ab.use(); renderAbilities(); };
          abilGrid.appendChild(wrap);
        })(abilities[i]);
      }
    }
    function getAbilityCooldownLeft(ab){
      var last=lastCast[ab.id]||-1e12, now=performance.now();
      var left = (last+ab.cdMs) - now; return left>0?left:0;
    }
    function castAbility(ab, onFinish){
      if(isCasting) return;
      var left=getAbilityCooldownLeft(ab); if(left>0){ toast('Abilità in ricarica'); logSys('Abilità '+ab.name+' in ricarica.'); return; }
      isCasting=true; castStart=performance.now(); currentCasting={ab:ab, onFinish:onFinish};
      castWrap.style.display='block'; castName.textContent=ab.name; castTime.textContent=(ab.castMs/1000).toFixed(1)+'s'; castBar.style.width='0%';
      toast('Lanci '+ab.name+'...'); logSys('Casting: '+ab.name);
      autoChase=false; pathQueue=[];
    }
    function cancelCast(reason){
      if(!isCasting) return;
      isCasting=false; castWrap.style.display='none'; currentCasting=null;
      toast('Cast interrotto'); logSys('Cast interrotto: '+reason);
    }
    function finishCast(){
      if(!isCasting || !currentCasting) return;
      isCasting=false; castWrap.style.display='none';
      lastCast[currentCasting.ab.id]=performance.now();
      currentCasting.onFinish();
      currentCasting=null;
      renderAbilities();
    }
    function aoeArcWave(){
      var total=0, hits=0;
      for(var i=enemies.length-1;i>=0;i--){
        var e=enemies[i]; var dx=Math.abs(e.x-player.x), dy=Math.abs(e.y-player.y);
        if((dx+dy===1) || (dx===1 && dy===1)){
          var dmg=rndInt(10,16)+Math.floor(player.atkMin/2);
          e.hp=Math.max(0,e.hp-dmg);
          addDmgText(e.x,e.y,'AOE '+dmg,'#60a5fa');
          flashCircle(e.x,e.y,'#60a5fa',0.28,30);
          total+=dmg; hits++;
          e.aggro=true; e.lastSeenTs=performance.now();
          if(e.hp===0){
            if(target===e){ target=null; autoChase=false; hideTargetFrame(); }
            trySpawnLootBag(e.x,e.y, e.kind||e.type);
            gainXP(e.type==='ranged'?25:20);
            enemies.splice(i,1);
          }
        }
      }
      if(total>0){ recordDPS(total); logDmg('Ondata Arcana colpisce '+hits+' nemici per '+total+' danni totali.'); }
      draw(); drawMini(); updateTargetFrame();
    }

    // SAVE/LOAD/RESET
    btnSave.addEventListener('click', function(){
      try{
        var now=performance.now();
        var bags=lootBags.map(function(b){
          var remain=Math.max(0, b.ttlMs - (now - b.createdAt));
          return {x:b.x,y:b.y,items:b.items, ttlRemain:remain};
        });
        localStorage.setItem(SAVE_KEY, JSON.stringify({
          map:map, player:player, enemies:enemies, coins:coins, potions:potions, projectiles:projectiles,
          lootBags:bags, nextItemId:nextItemId, inventory:inventory, equipped:equipped,
          lastCast:lastCast, hotbar:hotbar,
          world: WORLD.current
        }));
        localStorage.setItem(QUEST_KEY, JSON.stringify({currentQuest:currentQuest,quests:quests}));
        toast('Salvato.');
      }catch(e){ panic('save',e); }
    }, false);

    btnLoad.addEventListener('click', function(){ try{
      var raw=localStorage.getItem(SAVE_KEY); if(!raw) return alert('Nessun salvataggio.');
      var d=JSON.parse(raw), i,y,x;

      if(d && d.map && d.map.length===ROWS){ for(y=0;y<ROWS;y++){ for(x=0;x<COLS;x++){ map[y][x]=d.map[y][x]|0; } } }
      if(d && d.player){ for(var k in d.player){ if(d.player.hasOwnProperty(k)) player[k]=d.player[k]; } }

      enemies.length=0; if(d && d.enemies){ for(i=0;i<d.enemies.length;i++) enemies.push(d.enemies[i]); }
      coins.length=0;   if(d && d.coins){   for(i=0;i<d.coins.length;i++)   coins.push(d.coins[i]); }
      potions.length=0; if(d && d.potions){ for(i=0;i<d.potions.length;i++) potions.push(d.potions[i]); }
      projectiles.length=0; if(d && d.projectiles){ for(i=0;i<d.projectiles.length;i++) projectiles.push(d.projectiles[i]); }

      lootBags.length=0;
      if(d && Array.isArray(d.lootBags)){
        for(i=0;i<d.lootBags.length;i++){
          var src=d.lootBags[i];
          lootBags.push({ x:src.x, y:src.y, items:src.items||[], createdAt:performance.now(), ttlMs:Math.max(0, src.ttlRemain||0) });
        }
      }

      nextItemId = d && d.nextItemId ? (d.nextItemId|0) : nextItemId;
      inventory  = Array.isArray(d.inventory) ? d.inventory : [];
      equipped   = d && d.equipped ? d.equipped : {weapon:null, armor:null};
      lastCast   = d && d.lastCast ? d.lastCast : {};

      if(d && d.hotbar){
        hotbar = d.hotbar;
        for(var s=1;s<=5;s++){ capEls[s].textContent = hotbar[s] ? (hotbar[s].icon||'—') : '—'; }
      }

      if (d && d.world) {
        WORLD.current = d.world;
        applyTheme(WORLD.current==='main' ? THEMES.main : THEMES.spawn);
      }

      recomputeStats(false);

      var qd = localStorage.getItem(QUEST_KEY);
      if(qd){
        var qj=JSON.parse(qd);
        if(qj){
          currentQuest=qj.currentQuest||0;
          if(qj.quests&&qj.quests.length){
            quests[0].progress=qj.quests[0].progress||0;
            quests[0].status=qj.quests[0].status||'active';
          }
        }
      }

      renderQuest();
      updateHotbarCounts();
      draw();
      drawMini();
      if (typeof renderInventoryIfOpen === 'function') renderInventoryIfOpen();
      updateTargetFrame();
      updateDpsPanel();
      renderAbilities();

      dead = false;
      cv.style.filter = '';
      cv.style.opacity = '';
      cv.style.pointerEvents = 'auto';
      if (deathOverlay && deathOverlay.classList) { deathOverlay.classList.add('hidden'); }

      toast('Caricato.');
    }catch(e){ panic('load',e); } }, false);

    btnReset.addEventListener('click', function(){ location.reload(); }, false);

    // LOOP
    function isAdjacent(ax,ay,bx,by){ return Math.abs(ax-bx)<=1 && Math.abs(ay-by)<=1; }

    function step(){
      try{
        // Cast bar
        if(isCasting && currentCasting){
          var now=performance.now();
          var elapsed=now-castStart, need=currentCasting.ab.castMs;
          var ratio=Math.max(0,Math.min(1,elapsed/need));
          castBar.style.width=(ratio*100)+'%';
          castTime.textContent=((need-elapsed)/1000).toFixed(1)+'s';
          if(elapsed>=need) finishCast();
        }

        // Auto-chase + auto-attack
        if(autoChase && target && !isCasting){
          var stillThere=enemies.indexOf(target)!==-1;
          if(!stillThere){ autoChase=false; target=null; hideTargetFrame(); }
          if(target && chebyshev(player,target)!==1 && pathQueue.length===0){
            var pAdj=bfsToAdjacencySmart(player.x,player.y,target.x,target.y,target.type);
            if(pAdj && pAdj.length) pathQueue=pAdj;
          }
          if(target && chebyshev(player,target)===1){
            var nowA=performance.now(); if(nowA-player.lastAtk>=player.atkCd) attackEnemy(target);
          }
        }

        // Player step + tween
        if(pathQueue.length && !isCasting){
          var next = pathQueue.shift();
          var blocked=false, i;
          if(!walkable(next.x,next.y)) blocked=true;
          for(i=0;i<enemies.length;i++){ if(enemies[i].x===next.x&&enemies[i].y===next.y){ blocked=true; break; } }
          if(!blocked){
            var fx = player.x, fy = player.y;
            player.x = next.x; player.y = next.y;
            startTween(player, fx, fy, player.x, player.y, performance.now());
          } else {
            pathQueue=[];
          }
        }

        var justEntered = (player.x !== lastPlayerX || player.y !== lastPlayerY);
        checkPortalAndTeleport(justEntered);
        lastPlayerX = player.x;
        lastPlayerY = player.y;

        // Enemy AI
        var now=performance.now();
        for(var j=0;j<enemies.length;j++){
          var e=enemies[j];
          var distC=chebyshev(e, player);
          if(!e.aggro && distC<=e.aggroRange){ e.aggro=true; e.lastSeenTs=now; }

          var tooFar = chebyshev({x:e.spawnX,y:e.spawnY}, player) > e.leashRange || distC > e.leashRange;
          if(e.aggro){
            if(hasLoS(e.x,e.y,player.x,player.y) || distC<=1) e.lastSeenTs=now;
            if(tooFar || (now - e.lastSeenTs) > e.loseAggroMs){
              e.aggro=false; e.path = bfs(e.x,e.y,e.spawnX,e.spawnY)||[]; e.mode='return';
            }
          }

          e.moveTick=(e.moveTick+1)%e.moveEvery;
          var canMove = (e.moveTick===0);

          if(e.aggro){
            if(e.type==='melee'){
              if(canMove){
                if(chebyshev(e,player)>1 || !hasLoS(e.x,e.y,player.x,player.y)){
                  e.path = bfsToAdjacencySmart(e.x,e.y,player.x,player.y,'melee') || e.path || [];
                }
                tryStepAlongPath(e);
              }
              var near = (Math.abs(e.x-player.x)+Math.abs(e.y-player.y))<=1;
              if(near && (now-e.lastHit)>=e.hitCd && !isCasting){
                e.lastHit=now;
                var base=rndInt(e.atkMin,e.atkMax);
                var isCrit = rollCrit(0.05);
                var dmg=Math.floor(base*(isCrit?1.5:1));
                takePlayerDamage(dmg, isCrit?'CRIT -':'-');
              }
            } else { // ranged
              var distM=Math.abs(e.x-player.x)+Math.abs(e.y-player.y);
              var inRange = (distM>=e.rangeMin && distM<=e.rangeMax && hasLoS(e.x,e.y,player.x,player.y));
              if(inRange){
                if(now-e.lastShot>=e.atkCd){
                  e.lastShot=now;
                  var dx2=0,dy2=0;
                  if(e.x===player.x) dy2=player.y>e.y?1:-1; else if(e.y===player.y) dx2=player.x>e.x?1:-1;
                  if(dx2||dy2) projectiles.push({x:e.x,y:e.y,dx:dx2,dy:dy2,spdTick:0,dmg:rndInt(6,10), vx:e.x, vy:e.y, vStart:0, vEnd:0});
                }
                if(distM<e.rangeMin && canMove){
                  var backX=e.x + (player.x<e.x?1:(player.x>e.x?-1:0));
                  var backY=e.y + (player.y<e.y?1:(player.y>e.y?-1:0));
                  if(walkable(backX,backY) && !(backX===player.x&&backY===player.y)){
                    var fx=e.x, fy=e.y;
                    e.x=backX; e.y=backY;
                    startTween(e, fx, fy, e.x, e.y, performance.now());
                  }
                }
                var adj = (Math.max(Math.abs(e.x-player.x),Math.abs(e.y-player.y))===1);
                if(adj && (now-e.lastPoke)>=e.pokeCd && !isCasting){
                  e.lastPoke=now;
                  var base2=rndInt(4,7);
                  var isCrit2 = rollCrit(0.05);
                  var dmg2=Math.floor(base2*(isCrit2?1.5:1));
                  takePlayerDamage(dmg2, isCrit2?'CRIT -':'-');
                }
              }
            }
          } else {
            if((e.x!==e.spawnX || e.y!==e.spawnY)){
              if(canMove){
                if(!e.path || !e.path.length) e.path = bfs(e.x,e.y,e.spawnX,e.spawnY) || [];
                tryStepAlongPath(e);
              }
            } else {
              e.mode='idle'; e.path=[];
            }
          }
        }

        // Proiettili
        for(var pi=projectiles.length-1; pi>=0; pi--){
          var pr=projectiles[pi];
          pr.spdTick=(pr.spdTick+1)%2; if(pr.spdTick!==0) continue;
          var nx=pr.x+pr.dx, ny=pr.y+pr.dy;
          if(!inside(nx,ny) || map[ny][nx]===1){ projectiles.splice(pi,1); continue; }
          if(nx===player.x && ny===player.y){
            var isCrit = rollCrit(0.05);
            var dmgp = Math.floor(pr.dmg * (isCrit?1.5:1));
            takePlayerDamage(dmgp, isCrit?'CRIT -':'-');
            projectiles.splice(pi,1);
            continue;
          }
          startTween(pr, pr.x, pr.y, nx, ny, performance.now());
          pr.x=nx; pr.y=ny;
        }

        // Pickup magnet
        for(var c=coins.length-1;c>=0;c--){
          if(isAdjacent(coins[c].x,coins[c].y,player.x,player.y)){
            coins.splice(c,1); player.coins++; questAdd('coin',1); gainXP(2); logLoot('Moneta +1');
          }
        }
        for(var p=potions.length-1;p>=0;p--){
          if(isAdjacent(potions[p].x,potions[p].y,player.x,player.y)){
            potions.splice(p,1); player.pots++; updateHotbarCounts(); logLoot('Pozione +1');
          }
        }

      }catch(e){ panic('step', e); }
    }

    function tryStepAlongPath(e){
      if(!e.path || !e.path.length) return;
      var nxt=e.path.shift();
      if(!walkable(nxt.x,nxt.y)) { e.path=[]; return; }
      for(var k=0;k<enemies.length;k++){ var other=enemies[k]; if(other!==e && other.x===nxt.x && other.y===nxt.y) { e.path=[]; return; } }
      if(nxt.x===player.x && nxt.y===player.y){ e.path=[]; return; }
      var fx=e.x, fy=e.y;
      e.x=nxt.x; e.y=nxt.y;
      startTween(e, fx, fy, e.x, e.y, performance.now());
    }

    layoutHud();
    setInterval(step,120);
    draw(); drawAtkCooldown(); drawMini(); updateHotbarCounts(); updateTargetFrame(); updateDpsPanel(); renderAbilities();

    // Render loop 60fps tween
    (function animLoop(){
      updateTweens();
      draw();
      drawAtkCooldown();
      requestAnimationFrame(animLoop);
    })();

    // DRAW
    function draw(){
      ctx.clearRect(0,0,cv.width,cv.height);
      var x,y;
      for(y=0;y<ROWS;y++) for(x=0;x<COLS;x++){
        ctx.fillStyle = (map[y][x]===1)?getVar('--block'):(((x+y)%2===0)?getVar('--tileA'):getVar('--tileB'));
        ctx.fillRect(x*TILE,y*TILE,TILE,TILE);
      }
      drawPortals(ctx, TILE);

      ctx.fillStyle=getVar('--coin');
      for(var i=0;i<coins.length;i++){ var c=coins[i]; var cx=c.x*TILE+TILE/2, cy=c.y*TILE+TILE/2; ctx.beginPath(); ctx.arc(cx,cy,10,0,Math.PI*2); ctx.fill(); }

      for(var k=0;k<potions.length;k++){ var po=potions[k]; var px=po.x*TILE, py=po.y*TILE;
        ctx.fillStyle='#8b5cf6'; ctx.fillRect(px+TILE/2-8,py+TILE/2-14,16,20);
        ctx.fillStyle='#a78bfa'; ctx.fillRect(px+TILE/2-5,py+TILE/2-20,10,6);
        ctx.fillStyle='#6d28d9'; ctx.fillRect(px+TILE/2-6,py+TILE/2-24,12,4);
        ctx.fillStyle='#0006'; ctx.beginPath(); ctx.ellipse(px+TILE/2,py+TILE-12,12,4,0,0,Math.PI*2); ctx.fill();
      }

      var now=performance.now();
      for(var lb=0; lb<lootBags.length; lb++){
        var b=lootBags[lb], bx=b.x*TILE, by=b.y*TILE;
        var remain=b.ttlMs-(now-b.createdAt), warn=remain<=BAG_WARN_MS;
        ctx.save(); if(warn){ var pulse=(Math.sin(now/120)+1)/2; ctx.globalAlpha=0.55+0.4*pulse; }
        ctx.fillStyle=getVar('--shadow'); ctx.beginPath(); ctx.ellipse(bx+TILE/2,by+TILE-10,16,6,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#b45309'; ctx.beginPath(); ctx.moveTo(bx+TILE/2-12,by+TILE/2+6);
        ctx.lineTo(bx+TILE/2+12,by+TILE/2+6); ctx.lineTo(bx+TILE/2+8,by+TILE/2-8);
        ctx.lineTo(bx+TILE/2-8,by+TILE/2-8); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#78350f'; ctx.fillRect(bx+TILE/2-8,by+TILE/2-8,16,3);
        ctx.fillStyle='#facc15'; ctx.font='bold 14px system-ui'; ctx.textAlign='center';
        ctx.fillText('🪙', bx+TILE/2, by+TILE/2-12);
        ctx.restore();
      }

      for(var eI=0;eI<enemies.length;eI++){
        var en=enemies[eI];
        var col = (en.type==='ranged') ? '#a855f7' : getVar('--enemy');
        var ex = (en.vx!=null?en.vx:en.x), ey=(en.vy!=null?en.vy:en.y);
        drawActor(ex,ey,col);
        drawHpBar(ex,ey,en.hp,en.maxHp,true, (target===en));
        if(target===en){ drawTargetRing(ex,ey); }
      }

      var pxv = (player.vx!=null?player.vx:player.x), pyv=(player.vy!=null?player.vy:player.y);
      drawActor(pxv,pyv,getVar('--player'));
      drawHpBar(pxv,pyv,player.hp,player.maxHp,false,false);

      for(var pp=0; pp<projectiles.length; pp++){
        var pr=projectiles[pp];
        var ptx = (pr.vx!=null?pr.vx:pr.x), pty=(pr.vy!=null?pr.vy:pr.y);
        var px2=ptx*TILE+TILE/2, py2=pty*TILE+TILE/2; ctx.fillStyle='#f87171'; ctx.beginPath(); ctx.arc(px2,py2,6,0,Math.PI*2); ctx.fill();
      }

      drawDmgTexts();
      drawXpBar();
      statusEl.textContent = 'build: '+BUILD+' | LV '+player.lvl+' | HP '+player.hp+'/'+player.maxHp+' | ATK '+player.atkMin+'–'+player.atkMax+' | coins '+player.coins+' | pots '+player.pots+' | crit '+Math.round(player.critChance*100)+'%';
      ctx.fillStyle='#ffffffcc'; ctx.font='bold 14px system-ui'; ctx.fillText('BUILD '+BUILD, 8, 24);

      drawHud();
      function drawHud(){
        drawHudBtn(HUD.atk,  '🗡️', (performance.now()-player.lastAtk)>=player.atkCd);
        drawHudBtn(HUD.pot,  '🍵', player.pots>0);
        drawHudBtn(HUD.loot, '👜', !!getBagAt(player.x, player.y));
      }
      function drawHudBtn(r, glyph, enabled){
        ctx.save();
        ctx.globalAlpha = enabled ? 1 : 0.55;
        ctx.fillStyle='rgba(15,23,42,.85)';
        ctx.strokeStyle='#1f2a44'; ctx.lineWidth=2;
        roundRect(ctx, r.x, r.y, r.w, r.h, 12); ctx.fill(); ctx.stroke();
        ctx.font='28px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillStyle='#e5e7eb'; ctx.fillText(glyph, r.x + r.w/2, r.y + r.h/2);
        ctx.restore();
      }
      function roundRect(ctx, x, y, w, h, r){
        ctx.beginPath();
        ctx.moveTo(x+r, y);
        ctx.arcTo(x+w, y, x+w, y+h, r);
        ctx.arcTo(x+w, y+h, x, y+h, r);
        ctx.arcTo(x, y+h, x, y, r);
        ctx.arcTo(x, y, x+w, y, r);
        ctx.closePath();
      }
    }

    function drawActor(tx,ty,color){
      var x=tx*TILE, y=ty*TILE;
      ctx.fillStyle=getVar('--shadow'); ctx.beginPath(); ctx.ellipse(x+TILE/2,y+TILE-12,18,6,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=color; ctx.fillRect(x+TILE/2-16,y+TILE/2-22,32,36);
    }
    function drawHpBar(tx,ty,hp,maxHp,isEnemy,isTarget){
      var x=tx*TILE, y=ty*TILE, w=40, h=6, px=x+TILE/2-w/2, py=y+TILE/2-32;
      var r=Math.max(0,Math.min(1,hp/maxHp));
      var col='#10b981'; if(isEnemy){ if(r<0.66) col='#f59e0b'; if(r<0.33) col='#ef4444'; }
      ctx.fillStyle=getVar('--hpBack'); ctx.fillRect(px,py,w,h);
      ctx.fillStyle=col; ctx.fillRect(px,py,w*r,h);
      ctx.strokeStyle=isTarget ? '#f87171' : '#0008';
      ctx.lineWidth=isTarget ? 2 : 1;
      ctx.strokeRect(px,py,w,h);
      ctx.lineWidth=1;
    }
    function drawTargetRing(tx,ty){
      var x=tx*TILE+TILE/2, y=ty*TILE+TILE/2;
      ctx.save(); ctx.strokeStyle='#ef4444'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(x,y,28,0,Math.PI*2); ctx.stroke(); ctx.restore();
    }
    function drawXpBar(){
      var pad=6, h=10, x=pad, y=pad, w=cv.width-pad*2, need=(player.lvl<MAX_LVL?xpNeeded(player.lvl):1), ratio=(player.lvl<MAX_LVL?Math.max(0,Math.min(1,player.exp/need)):1);
      ctx.fillStyle='rgba(11,18,36,.66)'; ctx.fillRect(x,y,w,h);
      ctx.fillStyle='#7c3aed'; ctx.fillRect(x,y,w*ratio,h);
      ctx.strokeStyle='#1f2a44'; ctx.strokeRect(x,y,w,h);
      ctx.fillStyle='#e5e7eb'; ctx.font='12px system-ui'; ctx.textAlign='left'; ctx.textBaseline='top';
      ctx.fillText('LV '+player.lvl+(player.lvl<MAX_LVL?(' — '+Math.floor(ratio*100)+'%'):' — MAX'), x, y+h+2);
    }
    function flashScreen(color){ ctx.save(); ctx.globalAlpha=.20; ctx.fillStyle=color; ctx.fillRect(0,0,cv.width,cv.height); ctx.restore(); }
    function flashCircle(tx,ty,color,alpha,r){ var x=tx*TILE+TILE/2,y=ty*TILE+TILE/2; ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle=color; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); ctx.restore(); }
    function drawAtkCooldown(){
      if (!atkCdCtx) return;
      var now=performance.now(), remain=Math.max(0,player.atkCd-(now-player.lastAtk)), ratio=1-(remain/player.atkCd);
      var c=atkCdCtx, cx=28, cy=28, r=25;
      c.clearRect(0,0,56,56);
      c.globalAlpha=0.15; c.fillStyle='#000'; c.beginPath(); c.arc(cx,cy,r,0,Math.PI*2); c.fill();
      c.globalAlpha=0.85; c.strokeStyle= remain>0 ? '#94a3b8' : '#22c55e'; c.lineWidth=4; c.beginPath();
      c.arc(cx,cy,r-2,-Math.PI/2, -Math.PI/2 + ratio*2*Math.PI); c.stroke();
    }
    function drawMini(){
      if (miniWrap.classList.contains('hidden') || !miniCtx) return;
      miniCtx.clearRect(0,0,mini.width,mini.height);
      var x,y;
      for(y=0;y<ROWS;y++) for(x=0;x<COLS;x++){
        miniCtx.fillStyle = (map[y][x]===1)?'#2b3b66':'#164e24';
        miniCtx.fillRect(x*(mini.width/COLS), y*(mini.height/ROWS), (mini.width/COLS), (mini.height/ROWS));
      }
      miniCtx.fillStyle='#f59e0b';
      for(var lb=0; lb<lootBags.length; lb++){ var b=lootBags[lb];
        miniCtx.fillRect(b.x*(mini.width/COLS)+1, b.y*(mini.height/ROWS)+1, 3,3);
      }
      miniCtx.fillStyle='#facc15'; for(var i=0;i<coins.length;i++){ var c=coins[i]; miniCtx.fillRect(c.x*(mini.width/COLS)+1, c.y*(mini.height/ROWS)+1, 2,2); }
      miniCtx.fillStyle='#a78bfa'; for(var p=0;p<potions.length;p++){ var po=potions[p]; miniCtx.fillRect(po.x*(mini.width/COLS)+1, po.y*(mini.height/ROWS)+1, 2,2); }
      for(var eI=0;eI<enemies.length;eI++){ var en=enemies[eI]; miniCtx.fillStyle=(en.type==='ranged')?'#a855f7':'#ef4444';
        miniCtx.fillRect(en.x*(mini.width/COLS)+1, en.y*(mini.height/ROWS)+1, 3,3); }
      miniCtx.fillStyle='#3b82f6'; miniCtx.fillRect(player.x*(mini.width/COLS)+1, player.y*(mini.height/ROWS)+1, 3,3);
      miniCtx.strokeStyle='#1f2a44'; miniCtx.strokeRect(0.5,0.5, mini.width-1, mini.height-1);
    }

    function updateHotbarCounts(){ potCntEl.textContent = String(player.pots||0); }
    function toast(msg){ statusEl.textContent='['+BUILD+'] '+msg; }

    // Target Frame & DPS UI
    function capFirst(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : ''; }
    function nameOf(t){ return t && (t.kind ? capFirst(t.kind) : (t.type==='ranged'?'Arciere':'Mostro')); }
    function updateTargetFrame(){
      if(!target || enemies.indexOf(target)===-1){ hideTargetFrame(); return; }
      tframe.style.display='block';
      tfName.textContent = nameOf(target) || 'Nemico';
      tfKind.textContent = (target.type==='ranged'?'Ranged':'Melee');
      var dist = Math.max(Math.abs(player.x-target.x), Math.abs(player.y-target.y));
      tfDist.textContent = dist+' tiles';
      var ratio = Math.max(0, Math.min(1, target.hp/target.maxHp));
      tfHpBar.style.width = (ratio*100)+'%';
      tfHpBar.style.background = ratio<0.33 ? '#ef4444' : (ratio<0.66 ? '#f59e0b' : '#10b981');
      tfHpTxt.textContent = 'HP '+target.hp+' / '+target.maxHp+' ('+Math.round(ratio*100)+'%)';
    }
    function hideTargetFrame(){ tframe.style.display='none'; }
    function updateDpsPanel(){
      var now=performance.now(), cutoff=now-10000, sum=0;
      for(var i=0;i<dpsEvents.length;i++) if(dpsEvents[i].t>=cutoff) sum+=dpsEvents[i].a;
      var dps=Math.round(sum/10); if(dps>dpsPeak) dpsPeak=dps;
      dpsText.textContent = dps + ' (picco ' + dpsPeak + ')';
    }

    // Combat Log
    var logLines=[];
    function pushLog(html, cls){
      var t=new Date(), hh=String(t.getHours()).padStart(2,'0'), mm=String(t.getMinutes()).padStart(2,'0'), ss=String(t.getSeconds()).padStart(2,'0');
      logLines.push('<div class="line '+(cls||'')+'">['+hh+':'+mm+':'+ss+'] '+html+'</div>');
      if(logLines.length>80) logLines.shift();
      logBody.innerHTML=logLines.join('');
      logBody.scrollTop=logBody.scrollHeight;
    }
    function logDmg(msg){ pushLog(escapeHtml(msg), 'dmg'); }
    function logHeal(msg){ pushLog(escapeHtml(msg), 'heal'); }
    function logLoot(msg){ pushLog(escapeHtml(msg), 'loot'); }
    function logSys(msg){ pushLog(escapeHtml(msg), 'sys'); }
    function escapeHtml(s){
      return String(s).replace(/[&<>"']/g, function(m){
        return ({'&':'&amp;','<':'&lt;','&gt;':'&gt;','"':'&quot;',"'":'&#39;'}[m]);
      });
    }

  }catch(e){ panic('boot', e); }

})();
