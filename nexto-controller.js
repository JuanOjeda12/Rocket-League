import {nextoDecisionTicks,neuralRankSkill} from './bot-difficulty.js?v=coherent-bots-20261101';
// Nexto observation/action port, adapted from Rolv-Arild/Necto, CC BY-NC-SA 4.0.
// Network observations retain the original RL units, team inversion and heading rotation.
export function nextoObservation(state,slot,previousAction=new Array(8).fill(0)){
 const own=state.cars.find(c=>c.slot===slot),sign=own.team===1?-1:1,n=state.cars.length,count=n+35,rows=new Float32Array(count*24),query=new Float32Array(32);
 const vector=(r,offset,v,scale=1)=>{r[offset]=v[0]*scale*sign;r[offset+1]=-v[2]*scale*sign;r[offset+2]=v[1]*scale};
 const axis=(r,offset,v)=>vector(r,offset,[v.x,v.y,v.z]);
 for(let i=0;i<n;i++){
  const c=state.cars[i],r=rows.subarray(i*24,i*24+24);r[0]=Number(c.slot===slot);r[1]=Number(c.team===own.team);r[2]=Number(c.team!==own.team);
  vector(r,5,c.position,100/2300);vector(r,8,c.velocity,100/2300);axis(r,11,c.forward);axis(r,14,c.up);vector(r,17,c.angularVelocity||[0,0,0],1/5.5);r[20]=c.boost/100;r[21]=Number(c.isDemoed);r[22]=Number(c.onGround);r[23]=Number(c.hasFlip);
  if(c.slot===slot)query.set(r);
 }
 const ball=rows.subarray(n*24,(n+1)*24);ball[3]=1;vector(ball,5,state.ball.position,100/2300);vector(ball,8,state.ball.velocity,100/2300);vector(ball,17,state.ball.angularVelocity||[0,0,0],1/5.5);
 for(let i=0;i<34;i++){const p=state.pads[i],r=rows.subarray((n+1+i)*24,(n+2+i)*24);r[4]=1;vector(r,5,p.position,100/2300);r[20]=p.isBig?1:.12;r[21]=Number(p.active)}
 const theta=Math.atan2(query[11],query[12]),co=Math.cos(theta),si=Math.sin(theta);
 for(let i=0;i<count;i++){
  const at=i*24;for(let j=0;j<3;j++)rows[at+5+j]-=query[5+j];
  for(const start of [5,8,11,14,17]){const x=rows[at+start],y=rows[at+start+1];rows[at+start]=co*x-si*y;rows[at+start+1]=si*x+co*y}
 }
 query.set(previousAction,24);return{query,entities:rows,count};
}
const control=a=>({throttle:a[0],steer:-a[1],pitch:a[2],yaw:-a[3],roll:-a[4],jump:!!a[5],boost:!!a[6],handbrake:!!a[7]});
export function nextoPolicy(logits,skill){
 const s=Math.max(0,Math.min(1,skill)),beta=.12+.88*Math.pow(s,1.3),top=Math.max(...logits),weights=new Float64Array(logits.length);let total=0;
 if(s>=.999999){weights[logits.indexOf(top)]=1;return{weights,beta:1}}
 // Nexto's published beta/softmax selection, restricted to plausible near-best
 // actions so lower levels do not take arbitrary unrelated inputs.
 const scale=Math.log((1+beta)/(1-beta))/Math.log(3);
 for(let i=0;i<logits.length;i++){weights[i]=top-logits[i]<=5?Math.exp((logits[i]-top)*scale):0;total+=weights[i]}
 for(let i=0;i<weights.length;i++)weights[i]/=total;return{weights,beta};
}
export class NextoController{
 constructor(model,skill=1){this.model=model;this.skill=Math.max(0,Math.min(1,skill));this.reset()}
 reset(){this.ticks=26;this.previousAction=new Array(8).fill(0);this.controls={};this.intent='Nexto';this.kickoffElapsed=0;this.kickoffTaker=null}
 update(state,slot){
  const policySkill=neuralRankSkill(this.skill);if(this.ticks++<nextoDecisionTicks(policySkill))return this.controls;this.ticks=1;
  const own=state.cars.find(c=>c.slot===slot);if(own.isDemoed)return this.controls={};
  const obs=nextoObservation(state,slot,this.previousAction);let index=this.model.infer(obs.query,obs.entities,obs.count);
  if(policySkill<.999999){const {weights,beta}=nextoPolicy(this.model.logits(),policySkill);let sample=Math.random();for(let i=0;i<weights.length;i++){sample-=weights[i];if(sample<=0){index=i;break}}this.beta=beta}
  this.previousAction=[...this.model.actions[index]];this.controls=control(this.previousAction);return this.controls;
 }
}
