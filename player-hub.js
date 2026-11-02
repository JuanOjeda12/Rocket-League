import {equipItem,visitInventory,claimMission,claimPass,openDrop,collectDrop,recordInventoryMatch} from './inventory.js?v=inventory-20261028';
import {AccountStore} from './accounts.js?v=gold-nexto-20261101';
import {botSkill,cleanProgress,completeResult,levelInfo,PLAYLISTS,rankBadge,rankInfo} from './progression.js?v=gold-nexto-20261101';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export class PlayerHub{
 constructor(apply){
  this.apply=apply;this.guestAccepted=false;this.context=null;this.award=null;
  this.account=new AccountStore(undefined,text=>{for(const e of document.querySelectorAll('[data-sync-status]'))e.textContent=text});
  this.modal=document.createElement('div');this.modal.className='modal-shade';this.modal.hidden=true;
  this.modal.innerHTML=`<section class="dialog panel account-dialog" role="dialog" aria-modal="true" aria-label="Cuenta de jugador"><span class="eyebrow">TU PERFIL</span><h2 id="account-title">CREAR CUENTA</h2><p class="muted" id="account-info"></p><form id="account-form"><label id="account-name-row">NOMBRE DE USUARIO<input name="username" autocomplete="nickname" maxlength="24" minlength="2"></label><label>EMAIL<input name="email" type="email" autocomplete="email" required maxlength="254"></label><label>CONTRASEÑA<input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><p id="account-error" role="status"></p><button class="primary" id="account-submit" type="submit">CREAR CUENTA</button></form><button id="account-switch">YA TENGO CUENTA</button><button id="account-guest">JUGAR COMO INVITADO</button><button id="account-close">CANCELAR</button></section>`;
  document.body.append(this.modal);const get=id=>this.modal.querySelector('#'+id);this.form=get('account-form');this.mode='signup';
  this.form.onsubmit=async e=>{
   e.preventDefault();get('account-error').textContent='';get('account-submit').disabled=true;
   try{
    const email=this.form.elements.email.value.trim(),password=this.form.elements.password.value;
    const logged=this.mode==='signup'?await this.account.signup(email,password,this.form.elements.username.value.trim()):!!await this.account.login(email,password);
    this.form.elements.password.value='';
    if(!logged){this.mode='confirm';this.renderAuth();return}
    this.adopt();this.closeAuth();this.afterAuth?.();
   }catch(error){get('account-error').textContent=error.message}finally{get('account-submit').disabled=!this.account.configured}
  };
  get('account-switch').onclick=()=>{this.mode=this.mode==='signup'?'login':'signup';get('account-error').textContent='';this.renderAuth()};
  get('account-guest').onclick=()=>{this.guestAccepted=true;this.closeAuth();this.afterAuth?.()};get('account-close').onclick=()=>this.closeAuth();
  addEventListener('keydown',e=>{if(e.code==='Escape'&&!this.modal.hidden){e.preventDefault();e.stopImmediatePropagation();this.closeAuth()}},true);
  addEventListener('online',()=>this.account.flush());
  this.ready=this.account.restore().then(()=>{this.adopt();if(this.account.authError){this.modal.hidden=false;this.mode='login';this.renderAuth();get('account-error').textContent=this.account.authError}});
  addEventListener('storage',async e=>{
   if(e.key!=='rocket-auth-session'||!e.newValue||this.account.user)return;
   try{this.account.session=JSON.parse(e.newValue);await this.account.restore();if(this.account.user){this.adopt();if(!this.modal.hidden){this.closeAuth();this.afterAuth?.()}}}catch{}
  });
 }
 get inventory(){return this.account.data.inventory}
 get progress(){return this.account.data.progress}
 get canPlay(){return!!this.account.user||this.guestAccepted}
 adopt(){
  this.account.data.progress=cleanProgress(this.progress);
  const pending=this.progress.pending;if(pending){const {progress}=completeResult(this.progress,{...pending,forfeit:true,won:false,seconds:0,stats:{}});this.account.data.progress=progress;this.account.persist()}
  this.context=null;this.apply(this.account.data);
 }
 saveGarage(garage){if(garage.color!==this.account.data.garage.color)visitInventory(this.inventory,'paint');this.account.data.garage={...garage};this.account.persist()}
 owns(id){return !!this.inventory.items[id]}
 visit(event){visitInventory(this.inventory,event);this.account.persist()}
 equip(id){this.account.data.garage=equipItem(this.inventory,this.account.data.garage,id);this.account.persist();this.apply(this.account.data);return this.account.data.garage}
 claimMission(group,id){const reward=claimMission(this.inventory,group,id);this.progress.xp+=reward.xp;this.account.persist();return reward}
 claimPass(tier){const reward=claimPass(this.inventory,tier);this.account.persist();return reward}
 openDrop(type){const result=openDrop(this.inventory,type);this.account.persist();this.account.flush();return result}
 collectDrop(){const reward=collectDrop(this.inventory);this.account.persist();return reward}
 saveControls(controls){this.account.data.controls=controls;this.account.persist()}
 openAuth(after){this.afterAuth=after;this.mode='signup';this.modal.querySelector('#account-error').textContent='';this.modal.hidden=false;this.renderAuth();this.form.elements[this.account.configured?'username':'email'].focus()}
 closeAuth(){this.modal.hidden=true;this.form.elements.password.value=''}
 renderAuth(){
  const confirming=this.mode==='confirm';this.form.hidden=confirming;this.modal.querySelector('#account-switch').hidden=confirming;
  if(confirming){this.modal.querySelector('#account-title').textContent='REVISA TU CORREO';this.modal.querySelector('#account-info').textContent='Revisa tu bandeja de entrada y confirma tu email. Si no aparece, mira en spam. El enlace te llevará a Rocket Arena e iniciará tu sesión automáticamente.';return}
  const signup=this.mode==='signup';this.modal.querySelector('#account-title').textContent=signup?'CREAR CUENTA':'INICIAR SESIÓN';this.modal.querySelector('#account-name-row').hidden=!signup;this.form.elements.username.required=signup;this.form.elements.password.autocomplete=signup?'new-password':'current-password';
  this.modal.querySelector('#account-submit').textContent=signup?'CREAR CUENTA':'ENTRAR';this.modal.querySelector('#account-submit').disabled=!this.account.configured;this.modal.querySelector('#account-switch').textContent=signup?'YA TENGO CUENTA':'CREAR UNA CUENTA';
  this.modal.querySelector('#account-info').textContent=this.account.configured?'Guarda tu auto, controles, rango y experiencia entre dispositivos. Como invitado se guardan solo en este navegador.':'Las cuentas online necesitan conectar tu proyecto gratuito de Supabase. Mientras tanto puedes jugar y guardar tu progreso como invitado en este navegador.';
 }
 async logout(){await this.account.logout();this.guestAccepted=false;this.adopt()}
 rating(playlist){return this.progress.ranked[playlist]}
 skill(playlist){return botSkill(this.rating(playlist))}
 rankHTML(playlist){const r=rankInfo(this.rating(playlist));return `${rankBadge(r,45)}<span><b>${esc(r.name)}</b><small>${r.placed?(r.division?'División '+['I','II','III','IV'][r.division-1]:'Rango máximo'):r.placements+'/10 posicionamiento'}</small></span>`}
 levelHTML(){const level=levelInfo(this.progress.xp);return `<div class="player-level"><b>NIVEL ${level.level}</b><span>${level.current.toLocaleString('es')} / ${level.needed.toLocaleString('es')} XP</span><div class="xp-track"><i style="width:${level.current/level.needed*100}%"></i></div></div>`}
 profileHTML(){return `<div class="page-title">PERFIL</div><section class="panel player-profile"><span class="eyebrow">${this.account.user?'CUENTA CONECTADA':'INVITADO'}</span><h2>${esc(this.account.data.garage.name)}</h2><p class="muted" data-sync-status>${esc(this.account.status)}</p>${this.levelHTML()}<div class="rank-cards">${PLAYLISTS.map(p=>`<div><strong>${p}</strong><div class="rank-label">${this.rankHTML(p)}</div><small>${this.rating(p).mmr} MMR · ${this.rating(p).wins} victorias</small></div>`).join('')}</div><p>${this.progress.totals.matches} partidos · ${this.progress.totals.wins} victorias · ${this.progress.totals.goals} goles</p><p class="muted">Casual da experiencia y no cambia tus rangos. Cada modalidad competitiva tiene 10 posicionamientos y su propio MMR. Divisiones I–IV; ascensos por victorias y descensos por derrotas. Abandonar competitivo cuenta como derrota. Los umbrales y bots son propios de este juego.</p><button data-action="${this.account.user?'account-logout':'account-login'}">${this.account.user?'CERRAR SESIÓN':'CREAR CUENTA / ENTRAR'}</button></section><button data-action="home" class="back">‹ VOLVER</button>`}
 start(options,state){
  this.award=null;this.context=null;if(options.training||options.privateLocal)return;
  const playlist=`${options.blue}v${options.blue}`,mode=options.difficulty==='competitive'?'competitive':'casual';
  this.context={id:state.matchId,mode,playlist,opponentMmr:this.rating(playlist).mmr+40};this.progress.pending={...this.context};this.account.persist();
 }
 finish(state,slot){
  if(!this.context||this.context.id!==state.matchId)return;
  const car=state.cars.find(c=>c.slot===slot),stats=state.stats?.find(s=>s.slot===slot)||{},ownTeam=car?.team??0,won=state.score[ownTeam]>state.score[1-ownTeam],best=Math.max(...(state.stats||[]).filter(r=>state.cars.some(c=>c.slot===r.slot&&c.team===ownTeam)).map(r=>r.points));
  const result=completeResult(this.progress,{...this.context,seconds:state.played,won,stats,mvp:won&&stats.points===best});
  this.account.data.progress=result.progress;recordInventoryMatch(this.inventory,{id:state.matchId,seconds:state.played,won,stats,xp:result.award?.xp||0});this.award=result.award;this.context=null;this.account.persist();this.account.flush();
 }
 abandon(){if(!this.context)return;const result=completeResult(this.progress,{...this.context,seconds:0,won:false,forfeit:true,stats:{}});this.account.data.progress=result.progress;this.context=null;this.award=null;this.account.persist()}
 resultRankHTML(playlist='1v1'){
  const a=this.award,r=a?.ranked?a.rankAfter:rankInfo(this.rating(PLAYLISTS.includes(playlist)?playlist:'1v1'));
  const before=a?.rankBefore,changed=a?.ranked&&before?.placed&&r.placed;
  const title=changed?(r.step>before.step?'ASCENSO':r.step<before.step?'DESCENSO':'DIVISIÓN SIN CAMBIOS'):a?.ranked?'POSICIONAMIENTO':'RANGO SIN CAMBIOS';
  return `<section class="final-rank"><span class="eyebrow">${title} · ${esc(PLAYLISTS.includes(playlist)?playlist:'1v1')}</span><div class="rank-label">${rankBadge(r,58)}<span><b>${esc(r.name)}</b><small>${r.placed?(r.division?'División '+['I','II','III','IV'][r.division-1]:'Rango máximo'):r.placements+'/10 posicionamientos'}${a?.ranked?' · '+(a.delta>0?'+':'')+a.delta+' MMR':''}</small></span></div></section>`;
 }
 awardHTML(showRank=true){
  const a=this.award;if(!a)return'';const r=a.rankAfter;let title='PROGRESO GUARDADO';
  if(a.ranked&&r.placed)title=!a.rankBefore.placed?'POSICIONAMIENTO COMPLETADO':r.step>a.rankBefore.step?'ASCENSO':r.step<a.rankBefore.step?'DESCENSO':'COMPETITIVO';
  return `<section class="reward-panel"><span class="eyebrow">${title}</span><h2>+${a.xp} XP${a.levelAfter>a.levelBefore?' · ¡SUBES DE NIVEL!':''}</h2>${a.ranked&&showRank?`<div class="rank-label">${rankBadge(r,52)}<span><b>${esc(r.name)}</b><small>${r.placed?(r.division?'División '+['I','II','III','IV'][r.division-1]:'Rango máximo'):r.placements+'/10 posicionamientos'} · ${a.delta>0?'+':''}${a.delta} MMR</small></span></div>`:''}${a.reason?`<p class="muted">${esc(a.reason)}</p>`:''}${this.levelHTML()}</section>`;
 }
}

