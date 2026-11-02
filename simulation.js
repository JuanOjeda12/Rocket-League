import {rankedScriptedProfile} from './bot-profile.js?v=coherent-bots-20261101';
import {BasicBot} from './basic-bot.js?v=coherent-bots-20261101';
import {rankedDriver} from './bot-difficulty.js?v=coherent-bots-20261101';
import {advanceCelebration,PODIUM_SECONDS} from './celebration.js?v=inventory-20261028';
import {createMatchEngine} from './engine/adapter.js?v=stadium-finale-20261027';
import {OpponentAI} from './opponent-ai.js?v=coherent-bots-20261101';
import {MatchFlow} from './match-flow.js?v=inventory-20261028';
import {carById,cleanProfile} from './catalog.js?v=inventory-20261028';
import {MatchEvents} from './match-events.js?v=inventory-20261028';
import {MatchStats} from './match-stats.js?v=inventory-20261028';
import {incomingShot} from './ball-prediction.js?v=inventory-20261028';
import {BALL_RADIUS} from './proportions.js?v=inventory-20261028';
import {loadNexto} from './nexto-model.js?v=inventory-20261028';
import {NextoController} from './nexto-controller.js?v=coherent-bots-20261101';
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const newMatchId=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);
const rotate=(v,sign)=>[v[0]*sign,v[1],v[2]*sign];
const axis=(v,sign)=>({x:v.x*sign,y:v.y,z:v.z*sign});
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function qlerp(a,b,t){const s=a.reduce((n,v,i)=>n+v*b[i],0)<0?-1:1,q=a.map((v,i)=>v+(b[i]*s-v)*t),n=Math.hypot(...q)||1;return q.map(v=>v/n)}
function blendState(a,b,t){return{...b,cars:b.cars.map((c,i)=>{const p=a.cars[i]||c;return{...c,position:lerp(p.position,c.position,t),quaternion:qlerp(p.quaternion,c.quaternion,t)}}),ball:{...b.ball,position:lerp(a.ball.position,b.ball.position,t),quaternion:qlerp(a.ball.quaternion,b.ball.quaternion,t)}}}
export class Simulation{
 static async create(options={}){const s=new Simulation();[s.engine,s.neural]=await Promise.all([createMatchEngine(),loadNexto()]);s.configure(options);return s}
 configure(options={}){
  this.options={blue:1,orange:1,difficulty:'casual',training:false,...options};
  this.options.blue=Math.max(1,Math.min(5,Number(this.options.blue)||1));this.options.orange=this.options.training?0:Math.max(1,Math.min(5,Number(this.options.orange)||1));
  this.live=this.engine.configure(this.options.blue,this.options.orange);this.profiles=this.live.cars.map(c=>({name:`${this.options.difficulty==='competitive'&&this.options.useNexto!==false&&rankedDriver(this.options.botSkills?.[c.slot]??this.options.skill??.65)==='nexto'?'NEXTO':'BOT'} ${c.slot+1}`,body:'octane',color:c.team?'#ff8b32':'#248bff',human:false}));
  this.bots=this.live.cars.map(c=>new OpponentAI({difficulty:this.options.difficulty,skill:this.options.botSkills?.[c.slot]??this.options.skill}));this.neuralBots=this.live.cars.map(c=>new NextoController(this.neural,this.options.botSkills?.[c.slot]??this.options.skill??.65));this.basicBots=this.live.cars.map(c=>new BasicBot(this.options.botSkills?.[c.slot]??this.options.skill??.65));this.roles=[null,null];this.roleClock=0;this.events=new MatchEvents();this.stats=new MatchStats(this.live.cars.length);this.matchId=newMatchId();this.played=0;this.postmatch={time:0,poses:{}};this.flow=new MatchFlow(()=>this.nextRound());this.remaining=300;this.overtime=false;this.endAfterReplay=false;this.started=false;this.resetRound();
 }
 assign(slot,profile,human=true){if(!this.profiles[slot])throw Error('Puesto inválido');this.profiles[slot]={...cleanProfile(profile),human};this.engine.setBody(slot,carById(profile.body).kind);this.live=this.engine.state();this.refreshBotSkills()}
 refreshBotSkills(){
  for(const c of this.live.cars){const base=this.options.botSkills?.[c.slot]??this.options.skill??.65,withHuman=this.live.cars.some(m=>m.team===c.team&&this.profiles[m.slot]?.human),skill=withHuman?base*.85:base;if(this.neuralBots[c.slot])this.neuralBots[c.slot].skill=Math.max(0,Math.min(1,skill));if(this.basicBots[c.slot])this.basicBots[c.slot].skill=Math.max(0,Math.min(1,skill))}
 }
 release(slot){const c=this.live.cars[slot];if(c)this.assign(slot,{name:`BOT ${slot+1}`,body:'octane',color:c.team?'#ff8b32':'#248bff'},false)}
 resetRound(){this.live=this.engine.reset();this.lastTouchTeam=null;this.bots?.forEach(b=>b.reset());this.neuralBots?.forEach(b=>b.reset());this.basicBots?.forEach(b=>b.reset());this.roles=[null,null];this.roleClock=0;this.events?.resetRound();this.stats?.roundReset();this.flow?.beginRound(!this.options.training)}
 nextRound(){if(this.endAfterReplay){this.flow.phase='finished';return}this.resetRound()}
 start(){this.started=true;this.resetRound()}
 restart(){this.postmatch={time:0,poses:{}};this.remaining=300;this.played=0;this.matchId=newMatchId();this.stats=new MatchStats(this.live.cars.length);this.overtime=false;this.endAfterReplay=false;this.flow.score=[0,0];this.start()}
 botInput(slot,dt){
  const ranked=this.options.difficulty==='competitive'&&this.options.useNexto!==false,skill=this.neuralBots[slot].skill,driver=ranked?rankedDriver(this.options.botSkills?.[slot]??this.options.skill??skill):'fallback';
  if(driver==='nexto'){this.bots[slot].intent='Nexto';return this.neuralBots[slot].update(this.live,slot)}
  const ai=driver==='basic'?this.basicBots[slot]:this.bots[slot];
  if(driver==='scripted'){ai.difficulty='casual';ai.tuning=rankedScriptedProfile(skill)}
  if(ai.time+dt<ai.nextThink){ai.time+=dt;return ai.controls}
  const self=this.live.cars[slot],sign=self.team?1:-1,convert=c=>({...c,position:rotate(c.position,sign),velocity:rotate(c.velocity,sign),forward:axis(c.forward,sign),right:axis(c.right,sign),up:axis(c.up,sign)});
  const team=this.live.cars.filter(c=>c.team===self.team&&!c.isDemoed).sort((a,b)=>distance(a.position,this.live.ball.position)-distance(b.position,this.live.ball.position));
  const chaser=this.roles[self.team]??team[0]?.slot,others=team.filter(c=>c.slot!==chaser).sort((a,b)=>a.position[2]*sign-b.position[2]*sign),rank=slot===chaser?0:others.findIndex(c=>c.slot===slot)+1;
  const ball={...this.live.ball,position:rotate(this.live.ball.position,sign),velocity:rotate(this.live.ball.velocity,sign)},enemy=this.live.cars.find(c=>c.team!==self.team)||self;
  const state={opponent:convert(self),car:convert(enemy),ball,teammates:team.filter(c=>c.slot!==slot).map(convert),opponents:this.live.cars.filter(c=>c.team!==self.team&&!c.isDemoed).map(convert),pads:this.live.pads.map(p=>({...p,position:rotate(p.position,sign)})),role:rank===0?'attack':rank===1?'keeper':'support'};
  const [x,,z]=ball.position,threat=incomingShot(ball,1);
  if(rank>0){
   if(rank===1){state.targetOverride=[Math.max(-6.2,Math.min(6.2,threat?threat.impact[0]:x*.25)),0,z<-20?-48:Math.max(-43,Math.min(-9,z-29))]}
   else{const lane=(rank%2?1:-1)*Math.min(16,7+rank*2);state.targetOverride=[Math.max(-27,Math.min(27,x*.3+lane)),0,Math.max(-38,Math.min(35,z-10-(rank-2)*4))]}
  }
  // The goal-side defender may leave the line to cut a shot, never to chase a harmless ball.
  if(threat&&rank===1&&state.opponent.position[2]<ball.position[2]+1&&distance(state.opponent.position,ball.position)<21)state.targetOverride=null;
  return ai.update(state,dt);
 }
 tick(dt,inputs={}){
  if(!this.started)return;
  if(this.flow.phase==='finished'){
   if(this.postmatch.time<PODIUM_SECONDS){for(const car of this.live.cars)if(this.profiles[car.slot]?.human)this.postmatch.poses[car.slot]=advanceCelebration(this.postmatch.poses[car.slot],inputs[car.slot]||{},dt)}
   this.postmatch.time+=dt;return;
  }
  this.flow.update(dt);if(this.flow.phase!=='live')return;
  this.roleClock-=dt;
  if(this.roleClock<=0){this.roleClock=.12;for(const team of [0,1]){
   const sign=team?1:-1,ball=this.live.ball.position;
   const eligible=this.live.cars.filter(c=>c.team===team&&!c.isDemoed);
   const cost=c=>{const dx=ball[0]-c.position[0],dz=ball[2]-c.position[2],angle=Math.abs(Math.atan2(c.forward.x*dz-c.forward.z*dx,c.forward.x*dx+c.forward.z*dz));return distance(c.position,ball)/20+angle*.27+(c.position[2]*sign>ball[2]*sign+1?1.1:0)+(c.onGround?0:.18)-(this.roles[team]===c.slot?.22:0)};
   eligible.sort((a,b)=>cost(a)-cost(b));this.roles[team]=eligible[0]?.slot??null;
  }}
  const before=this.live,controls=this.live.cars.map(c=>this.profiles[c.slot].human?(inputs[c.slot]||{}):this.botInput(c.slot,dt));this.live=this.engine.step(controls);
  this.events.update(before,this.live,dt);
  this.played+=dt;this.stats.update(before,this.live,dt,this.events.list);
  const touch=this.live.cars.filter(c=>c.ballTouchAge>=0&&c.ballTouchAge<=dt*1.5).sort((a,b)=>a.ballTouchAge-b.ballTouchAge)[0];if(touch)this.lastTouchTeam=touch.team;this.live.ball.lastTouchTeam=this.lastTouchTeam;
  this.live.cars=this.live.cars.map(c=>({...c,profile:this.profiles[c.slot],flipResetCount:this.events.resetCounts[c.slot]||0}));this.flow.record(this.live,dt);
  if(this.live.goal){const scorer=this.stats.goal(this.live.goal);this.events.goal(this.live.goal,this.live.ball.position,scorer);this.flow.goal(this.live.goal,this.live)}
  if(!this.options.training){
   const wasOvertime=this.overtime;this.remaining=Math.max(0,this.remaining-dt);
   if(this.flow.phase==='goal'){
    if(wasOvertime||this.remaining===0&&this.flow.score[0]!==this.flow.score[1])this.endAfterReplay=true;
    // An equalizer at 0:00 gets its replay and a fresh overtime kickoff.
    else if(this.remaining===0)this.overtime=true;
   }else if(this.remaining===0&&!this.overtime&&this.live.ball.position[1]<=BALL_RADIUS+.035){
    if(this.flow.score[0]===this.flow.score[1]){this.overtime=true;this.resetRound()}
    else this.flow.phase='finished';
   }
  }
 }
 view(){
  let state=this.live;const replay=this.flow.sample();if(replay)state=blendState(replay.a,replay.b,replay.alpha);
  return{postmatch:this.postmatch,matchId:this.matchId,played:this.played,stats:this.stats.snapshot(),cars:state.cars.map(c=>({...c,profile:c.profile||this.profiles[c.slot]})),ball:state.ball,pads:state.pads,events:this.events.list,phase:!this.started?'lobby':this.flow.phase,score:[...this.flow.score],countdown:this.flow.clock,goalEnd:this.flow.end||1,replayProgress:this.flow.clip?Math.min(1,this.flow.playback/Math.max(.01,this.flow.clip.duration)):0,remaining:this.remaining,overtime:this.overtime,training:this.options.training,difficulty:this.options.difficulty};
 }
 skip(){this.flow.skip()}
}

