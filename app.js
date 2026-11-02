import {InventoryUI} from './inventory-ui.js?v=inventory-20261028';
import {createDropStage} from './drop-stage.js?v=inventory-20261028';
import {itemById,DEFAULT_COSMETICS} from './item-catalog.js?v=inventory-20261028';
import {rankBotSkill} from './bot-difficulty.js?v=necto-tiers-20261101';
import {softGlow} from './boost-visual.js?v=inventory-20261028';
import {ONLINE_SERVER} from './online-config.js?v=inventory-20261028';
import * as T from './vendor/three.module.js';
import {createVehicle} from './vehicle-view.js?v=inventory-20261028';import {CARS,cleanProfile} from './catalog.js?v=inventory-20261028';import {Simulation} from './simulation.js?v=necto-tiers-20261101';
import {GoalEffects} from './goal-effects.js?v=inventory-20261028';
import {BallTrail} from './ball-trail.js?v=inventory-20261028';
import {RenderBudget} from './render-budget.js?v=inventory-20261028';
import {createControls} from './controls.js?v=inventory-20261028';
import {PlayerHub} from './player-hub.js?v=necto-tiers-20261101';
import {scoreboardHTML} from './scoreboard.js?v=inventory-20261028';
import {PostMatch} from './post-match.js?v=inventory-20261028';
import {GameAudio} from './game-audio.js?v=inventory-20261028';
import {FlipResetIndicator} from './flip-reset-visual.js?v=inventory-20261028';
import {createBoostPads} from './boost-pads.js?v=inventory-20261028';import {createPlaySession} from './play-session.js?v=inventory-20261028';import {NetClient,serverURL} from './net-client.js?v=inventory-20261028';import {constrainArenaCamera} from './arena-shape.js?v=inventory-20261028';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function startApp({scene,camera,renderer,canvas,ball,ballShadow,followCamera,stadium}){
 const matchFov=camera.fov,dropStage=createDropStage(scene);let collection=null,selectedPreview=null,dropSound=false;
 const renderBudget=new RenderBudget(renderer,devicePixelRatio);let statsAt=0;
 const $=id=>document.getElementById(id),front=$('front'),views=new Map(),preview=createVehicle(scene);
 let saved={};try{saved=JSON.parse(localStorage.getItem('rocket-garage')||'{}')}catch{}
 let profile=cleanProfile(saved),screen='home',screenBack='home',running=false,keys={},ballCam=false,simulation=null,simulationReady=null,loading=false;
 let source='offline',network=null,networkOwner=false,slot=0,room=null,netA=null,netB=null,netAt=0,lastInput=0,transport='lan',serverBase=location.origin,serverInfo=null,selectedRoom=null,admissions=[];
 let hub=null,offlineOptions=null,tabHeld=false,scoreAt=0;
 const flipIndicator=new FlipResetIndicator(scene);const post=new PostMatch(),audio=new GameAudio(),podium=new T.Group();scene.add(podium);podium.visible=false;const podiumPoses=new Map();for(let i=0;i<5;i++){const shadow=new T.Mesh(new T.PlaneGeometry(1.7,2.1),new T.MeshBasicMaterial({map:softGlow(),color:0x000000,transparent:true,opacity:.3,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.002;podium.add(shadow)}
 addEventListener('pointerdown',()=>audio.unlock(),{passive:true});addEventListener('keydown',()=>audio.unlock());
 addEventListener('mousedown',e=>{if(screen==='podium'&&!e.target.closest('button,input,select,a')){e.preventDefault();keys['Mouse'+e.button]=true}});
 front.addEventListener('contextmenu',e=>{if(screen==='podium')e.preventDefault()});
 let stateA=null,stateB=null,lastPhase='',label='ENTRENAMIENTO',pads=null,last=performance.now(),elapsed=0,acc=0,replayReady=false,previousCam=false,previousStart=false;
 const velocity=new T.Vector3(),effects=new GoalEffects(scene),ballTrail=new BallTrail(scene);let awardUntil=0,frameDelta=1/60;preview.root.position.set(0,.17,30);preview.root.rotation.y=Math.PI+.35;preview.apply(profile);
 const persist=()=>{try{localStorage.setItem('rocket-garage',JSON.stringify(profile))}catch{}hub?.saveGarage(profile)};
 function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,5000)}
 const session=createPlaySession(canvas,value=>{running=value;keys={};tabHeld=false;$('match-scoreboard').hidden=true;acc=0;if(value){screen='game';front.hidden=true}else if(screen==='game'){screen='pause';renderFront();if(source==='network')network?.send('input',{controls:{}})}});
 const button=(text,action,classes='')=>`<button class="${classes}" data-action="${action}">${text}</button>`;
 const back=()=>button('‹ VOLVER',screenBack,'back');
 const controls=createControls(front,()=>{keys={};renderFront();document.querySelector('.control-help').textContent=controls.hint();hub?.saveControls(controls.snapshot())});document.querySelector('.control-help').textContent=controls.hint();
 hub=new PlayerHub(data=>{profile=cleanProfile(data.garage);try{localStorage.setItem('rocket-garage',JSON.stringify(profile))}catch{}if(data.controls)controls.load(data.controls);document.querySelector('.control-help').textContent=controls.hint();preview.apply(profile);if(['home','profile','competitive','garage','inventory','missions','rocketpass'].includes(screen))renderFront()});
 collection=new InventoryUI(hub,{render:()=>renderFront(),preview:previewItem,open:openReward,close:()=>{show('inventory','garage');previewItem(itemById(collection.selected))},toast});
 function previewItem(item){
  selectedPreview=item;if(item?.drop){dropStage.idle(item.drop);preview.setVisible(false);return}
  dropStage.hide();let look=structuredClone(profile);if(item){if(item.category==='body')look.body=item.id;else look.cosmetics={...look.cosmetics,[item.category]:item.id}}preview.apply(look);
  if(item?.category==='goalExplosion'){effects.explode(-1,look);effects.group.position.set(1.3,.8,30);effects.group.scale.setScalar(.12)}
 }
 function openReward(resume=false){collection.revealed=resume||!!hub.inventory.skipAnimation;dropSound=false;dropStage.start(hub.inventory.opening.drop,collection.revealed);show('drop');if(collection.revealed)previewItem(itemById(hub.inventory.opening.itemId));else{preview.setVisible(false);audio.tone(130,.5,.2,'triangle',500)}}
 function paintCollection(dt){
  const active=['inventory','missions','rocketpass','drop'].includes(screen);if(!active){dropStage.hide();return}
  const opening=screen==='drop',orb=selectedPreview?.drop&&screen==='inventory';
  if(opening){preview.root.position.set(0,.17,30);camera.position.set(2,1.05,33.3);camera.lookAt(0,.5,30);if(!collection.revealed){preview.setVisible(false);dropStage.update(dt,elapsed);if(dropStage.clock>3.2&&!dropSound){audio.tone(720,.45,.2,'sine',1400);audio.noise(.3,.2,2500);dropSound=true}if(dropStage.completed){collection.revealed=true;previewItem(itemById(hub.inventory.opening.itemId));renderFront()}}else{preview.setVisible(true,false);preview.flame.visible=itemById(hub.inventory.opening.itemId)?.category==='boost'}return}
  preview.root.position.set(0,.17,30);camera.position.set(2,1.1,33.8);camera.lookAt(0,.4,30);camera.setViewOffset(innerWidth,innerHeight,-innerWidth*.27,innerHeight*.18,innerWidth,innerHeight);if(orb)dropStage.group.position.x=0;preview.setVisible(!orb,false);preview.flame.visible=selectedPreview?.category==='boost';if(orb)dropStage.update(dt,elapsed);else dropStage.hide();
 }
 function show(next,backTo='home'){if(!['inventory','missions','rocketpass','drop'].includes(next)){selectedPreview=null;preview.apply(profile)}screen=next;screenBack=backTo;front.hidden=false;renderFront()}
 function mainMenu(){return `<div class="home-title"><span>ROCKET</span><strong>ARENA</strong><small>FAN PROJECT / BROWSER EDITION</small></div><nav class="main-nav">${button('JUGAR','play')}${button('GARAJE','garage')}${button('INVENTARIO','inventory')}${button('MISIONES','missions')}${button('CONFIGURACIÓN','settings')}<button disabled>TIENDA <small>COMING SOON</small></button>${button('ROCKET PASS','rocketpass')}${button('PERFIL','profile')}</nav><div class="home-caption"><b>${esc(profile.name)}</b><span>${esc(CARS.find(c=>c.id===profile.body)?.name)} / LISTO PARA SALIR</span>${hub.levelHTML()}</div>`}
 function card(title,sub,action,tone='blue',disabled=false){return `<button class="mode-card ${tone}" ${disabled?'disabled':`data-action="${action}"`}><span class="card-mark">${esc(title==='CASUAL'?'01':title==='COMPETITIVO'?'02':title==='ENTRENAMIENTO'?'∞':title)}</span><strong>${title}</strong><small>${disabled?'COMING SOON':sub}</small></button>`}
 function playMenu(){return `<div class="page-title">JUGAR</div><div class="card-grid">${card('CASUAL','Partidos contra bots','casual')}${card('COMPETITIVO','Bots más rápidos y exigentes','competitive','orange')}${card('TORNEOS','','','green',true)}${card('ENTRENAMIENTO','Free play / Play offline','training','purple')}${card('PARTIDA PRIVADA','Crear o unirse · LAN / ONLINE','private','teal')}${card('EXTRAS','','','red',true)}</div>${back()}`}
 function matchMenu(difficulty){return `<div class="page-title">${difficulty==='casual'?'CASUAL':'COMPETITIVO'}</div><p class="page-sub">${difficulty==='casual'?'Tú y tu equipo contra bots.':'Mismos equipos. Bots con reacción más rápida, mejor anticipación y uso de boost.'}</p><div class="card-grid">${[3,2,1].map(n=>`<div class="playlist-choice">`+card(`${n}v${n}`,n===1?'DUELO':n===2?'DOBLES':'ESTÁNDAR',`offline:${difficulty}:${n}`,difficulty==='casual'?'blue':'orange')+(difficulty==='competitive'?`<div class="playlist-rank rank-label">${hub.rankHTML(`${n}v${n}`)}</div>`:'')+'</div>').join('')}${['HEATSEEKER','DROPSHOT','KNOCKOUT','RUMBLE','HOOPS','SNOW DAY'].map(n=>card(n,'','','purple',true)).join('')}</div>${back()}`}
 function garageMenu(){return `<div class="page-title">GARAJE</div><div class="garage-panel"><label>CONDUCTOR<input id="driver-name" maxlength="24" value="${esc(profile.name)}"></label><label>CARRO</label><div class="car-options">${CARS.map(c=>`<button data-action="car:${c.id}" class="${profile.body===c.id?'selected':''}" ${hub.owns(c.id)?'':'disabled'}>${esc(c.name)}${hub.owns(c.id)?'':' · 🔒'}</button>`).join('')}</div><label>COLOR DE LA CARROCERÍA</label><div class="swatches">${['#248bff','#ff8b32','#ef3340','#ffd35b','#74d6ab','#b57bff','#f2f5f7','#252b35'].map(c=>`<button class="swatch" style="background:${c}" data-color="${c}" aria-label="Color ${c}"></button>`).join('')}<input id="car-color" type="color" value="${profile.color}" aria-label="Elegir color"></div><p id="garage-credit">${esc(CARS.find(c=>c.id===profile.body)?.credit)}</p><p class="muted">Los coches y accesorios se consiguen en drops y en el pase gratuito.</p>${button('ABRIR INVENTARIO','inventory')}</div>${back()}`}
 function privateMenu(){return `<div class="page-title">PARTIDA PRIVADA</div><div class="transport-tabs">${button('LOCAL · SIN SERVIDOR','local-private')}${button('LAN','transport:lan',transport==='lan'?'selected':'')}${button('ONLINE · BETA','transport:online',transport==='online'?'selected':'')}</div><div class="server-line"><label>SERVIDOR<input id="server-address" placeholder="${transport==='lan'?'http://192.168.1.10:8080':'https://tu-servidor.onrender.com'}" value="${esc(serverBase)}"></label>${button('BUSCAR SALAS','refresh')}</div><p class="muted">${transport==='lan'?'Las salas públicas de este servidor y los servidores LAN descubiertos aparecen aquí. También puedes escribir la dirección del anfitrión.':'La conexión online está preparada. Necesitas la dirección de un servidor publicado con HTTPS.'}</p><div class="private-columns"><section class="panel"><h2>UNIRSE A UNA SALA</h2><div id="room-list">Buscando salas…</div></section><section class="panel"><h2>CREAR SALA</h2><form id="create-room"><label>NOMBRE<input name="name" maxlength="40" value="Sala de ${esc(profile.name)}" required></label><div class="field-pair"><label>AZUL<select name="blue">${[1,2,3,4,5].map(n=>`<option ${n===2?'selected':''}>${n}</option>`).join('')}</select></label><label>NARANJA<select name="orange">${[1,2,3,4,5].map(n=>`<option ${n===2?'selected':''}>${n}</option>`).join('')}</select></label></div><label>DIFICULTAD<select name="rank">${['Bronce','Plata','Oro','Platino','Diamante','Campeón','Gran Campeón','Leyenda Supersónica'].map((name,i)=>`<option value="${i}" ${i===2?'selected':''}>${name}</option>`).join('')}</select></label><label>TU EQUIPO<select name="team"><option value="0">Azul</option><option value="1">Naranja</option></select></label><label class="check"><input type="checkbox" name="public" checked> Pública en la lista de salas</label><label>CONTRASEÑA<input type="password" name="password" maxlength="64" required autocomplete="new-password"></label><p class="muted">Desmarca «Pública» para una sala solo para ti y bots. Máximo 5 puestos por equipo.</p><button type="submit" class="primary">CREAR PARTIDA</button></form></section></div>${back()}`}
 function localPrivateMenu(){return `<div class="page-title">PARTIDA LOCAL</div><section class="panel local-match-panel"><p class="muted">Solo tú y bots. Sin servidor. No cambia tu XP ni tu rango competitivo.</p><form id="local-match"><div class="field-pair"><label>EQUIPO AZUL<select name="blue">${[1,2,3,4,5].map(n=>`<option ${n===2?'selected':''}>${n}</option>`).join('')}</select></label><label>EQUIPO NARANJA<select name="orange">${[1,2,3,4,5].map(n=>`<option ${n===2?'selected':''}>${n}</option>`).join('')}</select></label></div><label>TU EQUIPO<select name="team"><option value="0">Azul</option><option value="1">Naranja</option></select></label><label>NIVEL DE LOS BOTS<select name="rank">${['Bronce','Plata','Oro','Platino','Diamante','Campeón','Gran Campeón','Leyenda Supersónica'].map((name,i)=>`<option value="${i}" ${i===2?'selected':''}>${name}</option>`).join('')}</select></label><p class="muted">El número incluye tu puesto. El resto son bots. La dificultad aproxima cada rango dentro de este prototipo.</p><button class="primary" type="submit">COMENZAR PARTIDO</button></form></section>${button('‹ VOLVER','private','back')}`}
 function shareAddress(){if(transport==='lan'&&/localhost|127\.0\.0\.1/.test(serverBase)&&serverInfo?.addresses?.length){const ip=serverInfo.addresses.find(a=>/^(192\.168\.|10\.)/.test(a))||serverInfo.addresses[0];return`http://${ip}:${serverInfo.port}`}return serverBase}
 function lobbyMenu(){return `<div class="page-title">SALA ${esc(room?.id||'')}</div><section class="lobby panel"><h2>${esc(room?.name)}</h2><p class="muted">Comparte esta dirección con los demás: <strong>${esc(shareAddress())}</strong></p><div id="lobby-players"></div><p>${networkOwner?'Tú decides el equipo de cada persona que solicita entrar. Los puestos libres los ocupan bots.':'Ya tienes un puesto asignado. Reemplazas a un bot del equipo.'}</p>${button(networkOwner&&(stateB?.phase==='lobby')?'INICIAR PARTIDO':'ENTRAR AL PARTIDO','enter-room','primary')}${networkOwner?button('REINICIAR PARTIDO','restart-network'):''}${button(networkOwner?'CERRAR SALA Y SALIR':'ABANDONAR SALA','leave-room','danger')}</section>`}
 function pauseMenu(){return `<div class="pause-panel panel"><span class="eyebrow">${esc(label)}</span><h1>EN PAUSA</h1><p>${source==='network'?'Tu carro queda sin controles; los demás siguen jugando.':'La simulación está pausada.'}</p>${button('CONTINUAR','resume','primary')}${source==='offline'&&offlineOptions?.difficulty!=='competitive'||source==='network'&&networkOwner?button('REINICIAR SAQUE','reset'):''}${button(source==='network'?(networkOwner?'CERRAR SALA Y SALIR':'ABANDONAR SALA'):'VOLVER AL MENÚ','leave-room','danger')}</div>`}
 function results(){const score=stateB?.score||[0,0],own=stateB?.cars.find(c=>c.slot===slot);return `<div class="results-panel"><div class="result-summary"><span class="eyebrow">PARTIDO TERMINADO</span><h1>${score[0]>score[1]?'AZUL':'NARANJA'} GANA</h1><p class="result-score">${score[0]} — ${score[1]}</p><p class="personal-achievement">${esc(own?post.achievement(own):'')}</p><p id="post-caption" class="eyebrow">MEJORES JUGADAS</p><div class="result-actions">${source==='offline'||networkOwner?button('REVANCHA','rematch','primary'):''}${button('VOLVER AL MENÚ','leave-room')}</div>${hub.resultRankHTML(`${stateB.cars.filter(c=>c.team===0).length}v${stateB.cars.filter(c=>c.team===1).length}`)}${hub.awardHTML(false)}</div><div class="result-tables">${scoreboardHTML(stateB,slot)}</div></div>`}

 function podiumHTML(){return `<div class="victory-title ${post.winner===1?'orange':''}"><span>EQUIPO GANADOR</span><h1>${post.winner===0?'AZUL':'NARANJA'}</h1><p class="victory-mvp">MVP<br><b>+${post.state.stats.find(s=>s.slot===post.winners[0]?.slot)?.points||0}</b></p></div><div class="victory-labels">${post.winners.map((c,i)=>`<div class="victory-label" data-podium-slot="${c.slot}"><b>${esc(c.profile?.name||'BOT')}</b>${post.accolades(c).map(a=>`<span>${esc(a.title)}</span><small>${esc(a.detail)}</small>`).join('')}</div>`).join('')}</div><p class="victory-help">${post.winners.some(c=>c.slot===slot)?'Gira, salta y usa turbo para celebrar en tu puesto':'Celebración del equipo ganador'} · Los resultados aparecen enseguida</p>`}
 function renderFront(){
  front.hidden=screen==='game';document.body.dataset.screen=screen;
  front.innerHTML=screen==='home'?mainMenu():screen==='play'?playMenu():screen==='casual'||screen==='competitive'?matchMenu(screen):screen==='garage'?garageMenu():screen==='inventory'?collection.inventoryHTML():screen==='missions'?collection.missionsHTML():screen==='rocketpass'?collection.passHTML():screen==='drop'?collection.dropHTML():screen==='profile'?hub.profileHTML():screen==='settings'?controls.html()+`<button data-action="sound-toggle" class="sound-toggle">SONIDO: ${audio.muted?'DESACTIVADO':'ACTIVADO'}</button><button data-action="flip-indicator-toggle" class="flip-setting">INDICADOR FLIP RESET: ${flipIndicator.enabled?'ACTIVADO':'DESACTIVADO'}</button>`:screen==='private'?privateMenu():screen==='local-private'?localPrivateMenu():screen==='lobby'?lobbyMenu():screen==='pause'?pauseMenu():screen==='results'?results():screen==='podium'?podiumHTML():screen==='pending'?`<div class="pause-panel panel"><h1>ESPERANDO EQUIPO</h1><p>El anfitrión debe aprobar tu entrada y elegir tu equipo.</p>${button('CANCELAR','leave-room')}</div>`:`<div class="pause-panel panel"><h1>PREPARANDO…</h1><p>La simulación estará lista en unos segundos.</p></div>`;
  collection?.bind(front);
  if(screen==='local-private')$('local-match').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);offline({blue:+f.get('blue'),orange:+f.get('orange'),team:+f.get('team'),difficulty:'competitive',skill:rankBotSkill(f.get('rank')),privateLocal:true})};
  if(screen==='garage'){
   $('driver-name').onchange=e=>{profile=cleanProfile({...profile,name:e.target.value});persist();preview.apply(profile)};
   $('car-color').oninput=e=>{profile.color=e.target.value;profile.cosmetics.paint='paint-standard';persist();preview.apply(profile)};
  }
  if(screen==='private'){
   const form=$('create-room');form.elements.public.onchange=()=>{form.elements.password.required=form.elements.public.checked;form.elements.password.disabled=!form.elements.public.checked};form.onsubmit=e=>{e.preventDefault();createRoom(form)};
   refreshRooms();
  }
  if(screen==='lobby')updateLobby();
 }
 front.addEventListener('click',e=>{const color=e.target.closest('[data-color]');if(color){profile.color=color.dataset.color;profile.cosmetics.paint='paint-standard';persist();preview.apply(profile);$('car-color').value=profile.color;return}const target=e.target.closest('[data-action]');if(target&&!target.disabled)action(target.dataset.action)});
 async function action(a){
  if(collection?.action(a))return;
  if(['inventory','missions','rocketpass'].includes(a)){await hub.ready;if(a==='inventory'&&hub.inventory.opening){openReward(true);return}show(a,'garage');previewItem(a==='inventory'&&collection.category==='drops'?{drop:collection.selectedDrop}:a==='inventory'?itemById(collection.selected):null);return}
  if(a==='garage'){await hub.ready;hub.visit('garage')}

  if(a==='flip-indicator-toggle'){flipIndicator.toggle();audio.indicatorEnabled=flipIndicator.enabled;renderFront();return}
  if(a==='sound-toggle'){audio.toggle();renderFront();return}
  if(a==='local-private'){show('local-private','private');return}
  if(a==='play'){await hub.ready;if(!hub.canPlay){hub.openAuth(()=>show('play','home'));return}}
  if(a==='profile'){await hub.ready;show('profile','home');return}
  if(a==='account-login'){hub.openAuth(()=>show('profile'));return}
  if(a==='account-logout'){await hub.logout();show('profile');return}
  if(a==='home'||a==='play'||a==='garage'||a==='private'||a==='settings'){show(a,a==='private'?'play':'home');if(a==='home'||a==='garage')preview.apply(profile);return}
  if(a==='casual'||a==='competitive'){show(a,'play');return}
  if(a==='training'){hub.visit('training');await offline({blue:1,orange:0,training:true});return}
  if(a.startsWith('offline:')){const[,difficulty,n]=a.split(':');await offline({blue:+n,orange:+n,difficulty});return}
  if(a.startsWith('car:')){if(!hub.owns(a.split(':')[1])){toast('Consigue este coche en drops o en el pase gratuito.');return}profile.body=a.split(':')[1];persist();preview.apply(profile);renderFront();return}
  if(a.startsWith('transport:')){transport=a.split(':')[1];try{serverBase=localStorage.getItem('rocket-server-'+transport)||(transport==='lan'?location.origin:ONLINE_SERVER)}catch{serverBase=transport==='lan'?location.origin:ONLINE_SERVER}renderFront();return}
  if(a==='refresh'){refreshRooms();return}
  if(a.startsWith('join:')){selectedRoom=roomEntries[+a.split(':')[1]];showJoin();return}
  if(a==='resume'){followCamera.reset();session.start();return}
  if(a==='reset'){if(source==='network'&&networkOwner)network?.send('reset');else if(offlineOptions?.difficulty!=='competitive')simulation?.resetRound();return}
  if(a==='leave-room'){leaveRoom();return}
  if(a==='enter-room'){if(networkOwner&&stateB?.phase==='lobby')network.send('start');followCamera.reset();session.start();return}
  if(a==='restart-network'){network.send('restart');return}
  if(a==='rematch'){if(source==='offline'){await offline(offlineOptions);return}network.send('restart');lastPhase='';session.start();return}
 }
 async function offline(options){
  if(loading)return;loading=true;show('loading');await hub.ready;hub.abandon();options={...options,skill:options.skill??(options.difficulty==='competitive'?hub.skill(`${options.blue}v${options.blue}`):.15)};offlineOptions=options;
  try{simulation=await simulationReady;simulation.configure(options);slot=options.team===1?options.blue:0;simulation.assign(slot,profile,true);simulation.start();effects.reset();awardUntil=0;source='offline';room=null;stateA=stateB=simulation.view();hub.start(options,stateB);lastPhase='';label=options.training?'ENTRENAMIENTO':options.privateLocal?(options.difficulty==='competitive'?'NEXTO · PRIVADA LOCAL':'PARTIDA PRIVADA LOCAL'):`${options.difficulty==='competitive'?'COMPETITIVO':'CASUAL'} ${options.blue}v${options.orange}`;followCamera.reset();acc=0;session.start()}catch(e){toast(e.message);show('play','home')}finally{loading=false}
 }
 function leaveRoom(){hub.abandon();screen='home';session.pause();network?.send('leave');network?.close();network=null;room=null;admissions=[];$('admission').hidden=true;source='offline';stateA=stateB=null;show('home');preview.apply(profile)}
 let roomEntries=[];
 async function refreshRooms(){
  if(screen!=='private')return;const list=$('room-list');try{
   if(!$('server-address').value.trim())throw Error('Escribe la dirección del servidor publicado.');serverBase=serverURL($('server-address').value);try{localStorage.setItem('rocket-server-'+transport,serverBase)}catch{}
   const [info,response,discovery]=await Promise.all([fetch(serverBase+'/api/info',{signal:AbortSignal.timeout(transport==='online'?90000:4000)}).then(r=>r.json()),fetch(serverBase+'/api/rooms',{signal:AbortSignal.timeout(transport==='online'?90000:4000)}).then(r=>r.json()),transport==='lan'?fetch(serverBase+'/api/discovery',{signal:AbortSignal.timeout(transport==='online'?90000:4000)}).then(r=>r.json()).catch(()=>[]):[]]);
   if(screen!=='private')return;serverInfo=info;roomEntries=response.map(r=>({...r,url:serverBase}));for(const peer of discovery)for(const r of peer.rooms||[])if(!roomEntries.some(p=>p.id===r.id))roomEntries.push({...r,url:peer.url});
   list.innerHTML=roomEntries.length?roomEntries.map((r,i)=>`<div class="room-row"><div><strong>${esc(r.name)}</strong><small>${r.blue}v${r.orange} · ${r.players}/${r.max} personas · ${r.difficulty==='competitive'?'Difícil':'Normal'} · ${r.password?'Con contraseña':'Abierta'}</small></div><button data-action="join:${i}" ${!r.ready?'disabled':''}>${r.ready?'UNIRSE':'PREPARANDO'}</button></div>`).join(''):'<p class="muted">No hay salas públicas. Puedes crear una.</p>';
  }catch{if(screen==='private')list.innerHTML='<p class="muted">No se encontró un servidor. Revisa la dirección del anfitrión y que esté encendido.</p>'}
 }
 async function connect(url){network?.close();network=new NetClient(url,networkMessage);await network.connect();return network}
 async function createRoom(form){
  if(!form.reportValidity())return;const f=new FormData(form),options={name:f.get('name'),blue:+f.get('blue'),orange:+f.get('orange'),team:+f.get('team'),difficulty:'competitive',skill:rankBotSkill(f.get('rank')),public:f.get('public')==='on',password:f.get('public')==='on'?f.get('password'):''};
  try{serverBase=serverURL($('server-address').value);await connect(serverBase);source='network';show('loading');network.send('create',{options,profile})}catch(e){toast(e.message);show('private','play')}
 }
 function showJoin(){
  $('join-modal').hidden=false;$('join-title').textContent=selectedRoom.name;$('join-password').value='';$('join-password').focus();
 }
 $('join-cancel').onclick=()=>$('join-modal').hidden=true;
 $('join-form').onsubmit=async e=>{e.preventDefault();try{serverBase=selectedRoom.url;await connect(serverBase);source='network';network.send('join',{id:selectedRoom.id,password:$('join-password').value,profile});$('join-modal').hidden=true;show('loading')}catch(error){toast(error.message)}};
 function updateLobby(){const target=$('lobby-players');if(!target||!stateB)return;target.innerHTML=[0,1].map(team=>`<div class="team-list ${team?'orange':'blue'}"><h3>${team?'NARANJA':'AZUL'}</h3>${stateB.cars.filter(c=>c.team===team).map(c=>`<p>${esc(c.profile?.name||'BOT')} <small>${c.profile?.human?'JUGADOR':'BOT'}${c.slot===slot?' · TÚ':''}</small></p>`).join('')}</div>`).join('')}
 function networkMessage(m){
  if(m.type==='loading'){show('loading');return}
  if(m.type==='joined'){hub.abandon();hub.award=null;effects.reset();effects.seed(m.state?.events);awardUntil=0;room=m.room;slot=m.slot;networkOwner=m.owner;source='network';label=`PRIVADA ${m.options.blue}v${m.options.orange}`;netA=netB=m.state;stateA=stateB=m.state;netAt=performance.now();lastPhase='';show('lobby');return}
  if(m.type==='snapshot'){
   if(!Array.isArray(m.state?.cars)||m.state.cars.length>10)return;netA=netB?.phase===m.state.phase?netB:m.state;netB=m.state;netAt=performance.now();
   if(screen==='lobby'){stateB=netB;updateLobby()}
   return;
  }
  if(m.type==='pending'){room=m.room;show('pending');return}
  if(m.type==='admission'){admissions.push(m);session.pause('admission');showAdmission();return}
  if(m.type==='admitted'||m.type==='request-cancelled'){admissions=admissions.filter(a=>a.pendingId!==m.pendingId);showAdmission();return}
  if(m.type==='error'){toast(m.message);if(screen==='loading')show('private','play');return}
  if(m.type==='closed'||m.type==='rejected'){toast(m.message);network?.close();network=null;room=null;admissions=[];$('admission').hidden=true;screen='home';session.pause();stateA=stateB=null;show('private','play')}
 }
 function showAdmission(){const q=admissions[0];$('admission').hidden=!q;if(q)$('admission-name').textContent=q.name}
 for(const team of [-1,0,1])$('admit-'+team).onclick=()=>{const q=admissions[0];if(q)network?.send('admit',{pendingId:q.pendingId,team})};
 $('skip-replay').onclick=()=>source==='network'?network?.send('skip'):simulation?.skip();
 function readInput(){
  let throttle=Number(controls.down(keys,'forward'))-Number(controls.down(keys,'back')),steer=Number(controls.down(keys,'right'))-Number(controls.down(keys,'left')),pitch=-throttle,yaw=steer,roll=Number(controls.down(keys,'rollRight'))-Number(controls.down(keys,'rollLeft')),jump=controls.down(keys,'jump'),boost=controls.down(keys,'boost'),handbrake=controls.down(keys,'drift');
  const gp=Array.from(navigator.getGamepads?.()||[]).find(g=>g?.connected);if(gp){const x=Math.abs(gp.axes[0])>.12?gp.axes[0]:0,y=Math.abs(gp.axes[1])>.12?gp.axes[1]:0;if(x||y){steer=x;pitch=y;yaw=x}throttle=gp.buttons[7].value-gp.buttons[6].value||throttle;jump=jump||gp.buttons[0].pressed;boost=boost||gp.buttons[1].pressed;handbrake=handbrake||gp.buttons[2].pressed;const cam=gp.buttons[3].pressed;if(cam&&!previousCam)ballCam=!ballCam;previousCam=cam;const start=gp.buttons[9]?.pressed;if(start&&!previousStart)session.pause('controller');previousStart=start}
  if(handbrake){roll+=yaw;yaw=0}return{throttle,steer,pitch,yaw,roll:T.MathUtils.clamp(roll,-1,1),jump,boost,handbrake};
 }
 addEventListener('keydown',e=>{
  if(e.code==='Tab'&&running){e.preventDefault();tabHeld=true;scoreAt=0;return}
  if(!running&&screen==='podium'){if(controls.used(e.code)){e.preventDefault();keys[e.code]=true}return}
  if(!running){if(e.code==='Escape'&&['garage','play','casual','competitive','private','local-private','settings','profile','inventory','missions','rocketpass'].includes(screen))show(screen==='casual'||screen==='competitive'?'play':'home');return}
  if(controls.used(e.code)||e.code==='Escape')e.preventDefault();
  if(!keys[e.code]){if(e.code==='Escape')session.pause('escape');if(controls.matches('camera',e.code))ballCam=!ballCam;if(controls.matches('skip',e.code))source==='network'?network?.send('skip'):simulation?.skip();if(controls.matches('reset',e.code)){if(source==='offline'&&offlineOptions?.difficulty!=='competitive')simulation?.resetRound();else if(source==='network'&&networkOwner)network?.send('reset')}}keys[e.code]=true;
 });addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='Tab'){tabHeld=false;$('match-scoreboard').hidden=true}});canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('mousedown',e=>{if(running||screen==='podium'&&e.target===canvas){e.preventDefault();keys['Mouse'+e.button]=true}});addEventListener('mouseup',e=>keys['Mouse'+e.button]=false);
 function paint(a,b,t){
  effects.sync(b.events,slot,event=>{const epic=event.type==='epic-save';$('save-title').textContent=epic?'¡SALVADA ÉPICA!':'¡SALVADA!';$('save-award').dataset.epic=String(epic);$('save-award').style.animation='none';void $('save-award').offsetWidth;$('save-award').style.animation='';awardUntil=elapsed+2.8},b.cars);
  if(b.phase!=='highlight'&&camera.fov!==matchFov){camera.fov=matchFov;camera.updateProjectionMatrix()}
  if(!pads)pads=createBoostPads(scene,b.pads);pads.update(b.pads,elapsed);preview.setVisible(false);
  for(const [id,v] of views)if(!b.cars.some(c=>c.slot===id))v.setVisible(false);
  for(const c of b.cars){let v=views.get(c.slot);if(!v){v=createVehicle(scene);views.set(c.slot,v)}v.apply(c.profile||{name:'BOT',body:'octane',color:c.team?'#ff8b32':'#248bff'});const p=a.cars.find(x=>x.slot===c.slot)||c;const smooth=p.isDemoed===c.isDemoed&&new T.Vector3().fromArray(p.position).distanceTo(new T.Vector3().fromArray(c.position))<8;
   v.root.position.fromArray(smooth?p.position:c.position).lerp(new T.Vector3().fromArray(c.position),smooth?t:1);v.root.quaternion.fromArray(smooth?p.quaternion:c.quaternion).slerp(new T.Quaternion().fromArray(c.quaternion),smooth?t:1);v.setVisible(!c.isDemoed,c.slot!==slot);v.flame.visible=c.isBoosting&&['live','replay','highlight'].includes(b.phase);v.update(elapsed);
  }
  ball.visible=true;ballShadow.visible=true;ball.position.fromArray(a.ball.position).lerp(new T.Vector3().fromArray(b.ball.position),t);ball.quaternion.fromArray(a.ball.quaternion).slerp(new T.Quaternion().fromArray(b.ball.quaternion),t);ballShadow.position.set(ball.position.x,.015,ball.position.z);ballShadow.material.opacity=Math.max(.04,.22-ball.position.y*.008);
  ballTrail.update(ball.position,b.ball.velocity,source==='offline'&&!running&&screen!=='results'?0:frameDelta,b.phase,b.ball.lastTouchTeam);
  const own=b.cars.find(c=>c.slot===slot)||b.cars[0],view=views.get(own.slot);
  if(b.phase==='highlight'){/* Replay camera has a single owner: paintPost. */
  }else if(b.phase==='goal'){
   const target=new T.Vector3(0,2.5,b.goalEnd*50.6),desired=new T.Vector3(13,6,b.goalEnd*35);camera.position.lerp(desired,.16);camera.up.set(0,1,0);camera.lookAt(target);replayReady=false;
  }else if(b.phase==='replay'){
   const target=ball.position.clone(),desired=constrainArenaCamera(target.clone().add(new T.Vector3(b.goalEnd*9,6.5,-b.goalEnd*12)));if(replayReady)camera.position.lerp(desired,.12);else camera.position.copy(desired);camera.up.set(0,1,0);camera.lookAt(target);replayReady=true;
  }else{replayReady=false;velocity.fromArray(own.velocity);followCamera.update(1/60,{position:view.root.position,quaternion:view.root.quaternion,velocity,ball:ball.position,onGround:own.onGround,isFlipping:own.isFlipping,ballCam})}
  $('blue').textContent=b.score[0];$('orange').textContent=b.score[1];$('match-type').textContent=label;$('match-clock').textContent=b.training?'∞':b.overtime?'OT':`${Math.floor(Math.ceil(b.remaining)/60)}:${String(Math.ceil(b.remaining)%60).padStart(2,'0')}`;
  $('speed').textContent=Math.round(Math.hypot(...own.velocity)*3.6);$('boost').textContent=Math.round(own.boost);$('boostbar').style.width=own.boost+'%';$('boost-track').setAttribute('aria-valuenow',Math.round(own.boost));
  $('boost-track').parentElement.style.setProperty('--boost',`${own.boost}%`);$('boost-track').parentElement.classList.toggle('boosting',own.isBoosting);
  const showGoal=running&&['kickoff','goal'].includes(b.phase);$('goal').hidden=!showGoal;$('goal').textContent=b.phase==='kickoff'?Math.max(1,Math.ceil(b.countdown)):b.goalEnd<0?'¡GOL AZUL!':'¡GOL NARANJA!';
  flipIndicator.update(b.cars,views,frameDelta,b.phase,slot);
  $('replay').hidden=b.phase!=='replay';document.body.classList.toggle('replaying',b.phase==='replay');$('replay-progress').style.width=b.replayProgress*100+'%';
 }
 function paintPost(dt){
  const input=readInput(),p=post.update(dt,input,stateB.postmatch),caption=$('post-caption');if(p.mode==='highlights'&&screen==='podium'){keys={};screen='results';renderFront()}if(caption)caption.textContent=p.title;
  $('replay').hidden=true;$('goal').hidden=true;document.body.classList.remove('replaying');
  if(p.mode==='highlights'&&p.sample){
   podium.visible=false;const {a,b,alpha}=p.sample;paint({...stateB,...a},{...stateB,...b,phase:'highlight',events:[]},alpha);
   const target=ball.position.clone();
   if(p.clip!==paintPost.clip){paintPost.clip=p.clip;paintPost.side=target.x>0?-1:1;paintPost.target=target.clone();ballTrail.clear()}
   paintPost.target.lerp(target,1-Math.exp(-dt*7));
   const desired=constrainArenaCamera(paintPost.target.clone().add(new T.Vector3(paintPost.side*11,7,15)));
   if(camera.fov!==65){camera.fov=65;camera.updateProjectionMatrix()}camera.position.lerp(desired,1-Math.exp(-dt*3));camera.up.set(0,1,0);camera.lookAt(paintPost.target);return;
  }
  if(p.mode==='highlights'){podium.visible=false;paint(stateB,{...stateB,phase:'highlight',events:[]},1);camera.position.lerp(new T.Vector3(18,14,27),1-Math.exp(-dt*3));camera.up.set(0,1,0);camera.lookAt(0,1,0);return}
  ball.visible=false;ballShadow.visible=false;ballTrail.clear();podium.visible=true;for(const v of views.values())v.setVisible(false);
  const members=post.winners;
  const offsets=[0,-2.1,2.1,-4.5,4.5];podium.children.forEach(m=>m.visible=false);
  members.forEach((car,i)=>{const x=offsets[i],z=i===0?3.5:i<3?1:-1;
   const v=views.get(car.slot);if(!v)return;const pose=p.poses?.[car.slot]||{yaw:Math.sin(post.clock*.8+i)*.08,jump:0,flip:0,pitch:0};
   const rotation=new T.Quaternion().setFromEuler(new T.Euler((pose.pitch||0)+pose.flip,Math.PI+(i===0?-.45:i%2?-.6:.6)+pose.yaw,0));
   const target=new T.Vector3(x,v.groundHeight(rotation)-.02+pose.jump,z);
   let smooth=podiumPoses.get(car.slot);if(!smooth){smooth={position:target.clone(),rotation:rotation.clone()};podiumPoses.set(car.slot,smooth)}
   const blend=1-Math.exp(-dt*25);smooth.position.lerp(target,blend);smooth.rotation.slerp(rotation,blend);
   v.setVisible(true,false);v.root.position.copy(smooth.position);v.root.quaternion.copy(smooth.rotation);v.flame.visible=!!pose.boost;v.update(elapsed);
   const shadow=podium.children[i];shadow.visible=true;shadow.position.set(x,.002,z);shadow.material.opacity=.35/(1+pose.jump*2);shadow.scale.setScalar(1+pose.jump*.25);

  });
  if(camera.fov!==48){camera.fov=48;camera.updateProjectionMatrix()}
  const xs=post.winners.map((_,i)=>offsets[i]),center=(Math.min(...xs)+Math.max(...xs))/2,width=Math.max(...xs)-Math.min(...xs)+2.4;
  const distance=Math.max(6.7,width/(2*Math.tan(24*Math.PI/180)*camera.aspect)+1.7);
  const target=new T.Vector3(center,.35,1.4),desired=new T.Vector3(center+.25,1.7,distance+(1-(p.progress??1))*.8);if(!paintPost.podiumReady){camera.position.copy(desired);paintPost.podiumReady=true}camera.position.lerp(desired,1-Math.exp(-dt*4));camera.up.set(0,1,0);camera.lookAt(target);
  for(const car of members){const tag=document.querySelector(`[data-podium-slot="${car.slot}"]`),v=views.get(car.slot);if(tag&&v){const pos=v.root.position.clone().add(new T.Vector3(0,-.15,0)).project(camera);tag.style.left=((pos.x+1)*innerWidth/2)+'px';tag.style.top=((1-pos.y)*innerHeight/2+22)+'px'}}
 }
 function frame(now){
  requestAnimationFrame(frame);const frameMs=now-last,dt=Math.min(.05,frameMs/1000);frameDelta=dt;last=now;elapsed+=dt;renderBudget.update(frameMs,now,!document.hidden);
  if(camera.view?.enabled)camera.clearViewOffset();const inMatch=['game','pause','podium','results','lobby'].includes(screen)&&!!stateB;
  $('hud').hidden=!inMatch;
  $('save-award').hidden=!inMatch||elapsed>awardUntil||awardUntil===0;
  effects.update(inMatch&&source==='offline'&&!running&&screen!=='results'?0:dt,inMatch||['inventory','drop'].includes(screen));
  if(source==='offline'&&simulation&&(running||screen==='podium'||screen==='results')){const controls=readInput();acc+=dt;while(acc>=1/120){simulation.tick(1/120,{[slot]:controls});acc-=1/120}const next=simulation.view();stateA=stateB?.phase===next.phase?stateB:next;stateB=next}
  if(source==='network'&&netB){stateA=netA||netB;stateB=netB;if((running||screen==='podium')&&now-lastInput>1000/30){network.send('input',{controls:readInput()});lastInput=now}}
  if(source==='network'&&['podium','results'].includes(screen)&&stateB?.phase!=='finished'){lastPhase='';session.start()}
  if(inMatch&&stateB){post.observe(stateB,running||source==='network'?dt:0);if(screen!=='results'&&screen!=='podium')paint(stateA||stateB,stateB,source==='network'?Math.min(1,(now-netAt)/(1000/30)):1);if(stateB.phase==='finished'&&lastPhase!=='finished'){hub.finish(stateB,slot);post.finish(stateB,slot);screen='podium';paintPost.clip=null;paintPost.podiumReady=false;podiumPoses.clear();session.pause('finished');renderFront()}lastPhase=stateB.phase}
  else{ballTrail.clear();for(const v of views.values())v.setVisible(false);preview.root.position.set(0,.17,30);preview.setVisible(true,false);preview.flame.visible=false;ball.visible=false;ballShadow.visible=false;$('replay').hidden=true;$('goal').hidden=true;document.body.classList.remove('replaying');if(camera.fov!==36){camera.fov=36;camera.updateProjectionMatrix()}camera.position.set(1.7+Math.sin(elapsed*.12)*.06,.85,32.2);camera.up.set(0,1,0);camera.lookAt(-.45,.38,30)}
  paintCollection(dt);
  $('match-scoreboard').hidden=!(tabHeld&&running&&inMatch);if(tabHeld&&running&&inMatch&&now-scoreAt>150){scoreAt=now;$('match-scoreboard').innerHTML=scoreboardHTML(stateB,slot)}
  if((screen==='results'||screen==='podium')&&post.finished)paintPost(dt);else podium.visible=false;
  audio.indicatorEnabled=flipIndicator.enabled;
  if(!inMatch||screen==='podium')flipIndicator.update([],views,dt,'menu',slot);
  audio.update(stateB,slot,inMatch&&(running||source==='network'||screen==='results'||screen==='podium'),dt);
  stadium.update(inMatch?stateB.remaining:300,inMatch?stateB.training:true,inMatch&&stateB.overtime,elapsed);
  renderer.render(scene,camera);
  if(now-statsAt>1000){statsAt=now;canvas.dataset.renderStats=JSON.stringify({fps:Math.round(1000/renderBudget.average),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,pixelRatio:Number(renderBudget.ratio.toFixed(2)),crowd:stadium.crowdCount,crowdTriangles:stadium.crowdTriangles})}
 }
 show('home');simulationReady=Simulation.create({training:true,blue:1,orange:0}).then(s=>{simulation=s;return s}).catch(e=>{toast('No se pudo preparar la física. Recarga la página.');throw e});
 requestAnimationFrame(frame);addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()});
 window.arenaApp={get state(){return{screen,source,profile,slot,room,phase:stateB?.phase,cars:stateB?.cars?.length,score:stateB?.score}},get ready(){return!!simulation}};
}

