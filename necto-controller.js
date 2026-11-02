// Necto V1 observation and five-head action adapter. CC BY-NC-SA 4.0.
import {botRankFromSkill} from './bot-difficulty.js';
export function nectoTuning(skill){const rank=botRankFromSkill(skill),t=Math.max(0,Math.min(2,rank-2));return{beta:t<1?.25+t*.3:.55+(t-1)*.3,ticks:Math.round(t<1?24-t*8:16-(t-1)*6)}}
export function nectoObservation(state,slot,previousAction,timers,elapsed){
 const own=state.cars.find(c=>c.slot===slot),sign=own.team?-1:1,count=state.cars.length+35,entities=new Float32Array(count*24),query=new Float32Array(32);
 const vec=(r,o,v,k=1)=>{r[o]=v[0]*sign*k;r[o+1]=-v[2]*sign*k;r[o+2]=v[1]*k},axis=(r,o,v)=>vec(r,o,[v.x,v.y,v.z]);
 const ball=entities.subarray(0,24);ball[3]=1;vec(ball,5,state.ball.position,100/2300);vec(ball,8,state.ball.velocity,100/2300);vec(ball,17,state.ball.angularVelocity||[0,0,0],1/5.5);
 state.cars.forEach((c,i)=>{const r=entities.subarray((i+1)*24,(i+2)*24);r[0]=Number(c.slot===slot);r[1]=Number(c.team===own.team);r[2]=Number(c.team!==own.team);vec(r,5,c.position,100/2300);vec(r,8,c.velocity,100/2300);axis(r,11,c.forward);axis(r,14,c.up);vec(r,17,c.angularVelocity||[0,0,0],1/5.5);r[20]=c.boost/100;
 // Preserve the published RLBot observation's demo timer convention.
 timers.demo[i]=(timers.demo[i]||0)<=0?.3:Math.max(0,timers.demo[i]-elapsed/10);r[21]=timers.demo[i];r[22]=Number(c.onGround);r[23]=Number(c.hasFlip);if(c.slot===slot)query.set(r)});
 state.pads.forEach((p,i)=>{const r=entities.subarray((state.cars.length+1+i)*24,(state.cars.length+2+i)*24);r[4]=1;vec(r,5,p.position,100/2300);r[20]=p.isBig?1:.12;let timer=timers.pads[i]||0;if(p.active&&timer===0)timer=p.isBig?1:.4;if(!p.active)timer=0;r[21]=timer;timers.pads[i]=Math.max(0,timer-elapsed/10)});
 query.set(previousAction,24);for(let i=0;i<count;i++)for(let j=5;j<11;j++)entities[i*24+j]-=query[j];return{query,entities,count};
}
export function nectoAction(logits,beta,random=Math.random){let offset=0;const a=[];for(const size of [3,3,2,2,2]){const head=logits.slice(offset,offset+size),top=Math.max(...head);let selected=head.indexOf(top);if(beta<1){const scale=Math.log((1+beta)/(1-beta))/Math.log(3),weights=head.map(v=>Math.exp((v-top)*scale)),total=weights.reduce((x,y)=>x+y,0);let sample=random()*total;for(let j=0;j<size;j++){sample-=weights[j];if(sample<=0){selected=j;break}}}a.push(selected);offset+=size}const throttle=a[0]-1,steer=a[1]-1;return[throttle,steer,throttle,steer*(1-a[4]),steer*a[4],a[2],a[3],a[4]]}
export class NectoController{
 constructor(model,skill=1){this.model=model;this.skill=skill;this.reset()}
 reset(){this.ticks=100;this.previousAction=new Array(8).fill(0);this.controls={};this.timers={demo:[],pads:[]}}
 update(state,slot){const tuning=nectoTuning(this.skill);if(this.ticks++<tuning.ticks)return this.controls;const elapsed=Math.min(this.ticks,60)/120;this.ticks=1;const own=state.cars.find(c=>c.slot===slot);if(own.isDemoed)return this.controls={};const obs=nectoObservation(state,slot,this.previousAction,this.timers,elapsed),a=nectoAction(this.model.infer(obs.query,obs.entities,obs.count),tuning.beta);this.previousAction=a;return this.controls={throttle:a[0],steer:-a[1],pitch:a[2],yaw:-a[3],roll:-a[4],jump:!!a[5],boost:!!a[6],handbrake:!!a[7]}}
}
