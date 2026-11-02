// Deliberately simple scripted driver: low tiers do not use a trained model.
import {botRankFromSkill} from './bot-difficulty.js?v=coherent-bots-20261101';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class BasicBot{
 constructor(skill=.06){this.skill=skill;this.reset()}
 reset(){this.time=0;this.nextThink=0;this.controls={};this.intent='Aprendiendo';this.jumpAt=-10}
 update(state,dt){
  this.time+=dt;if(this.time<this.nextThink)return this.controls;
  const rank=botRankFromSkill(this.skill),q=Math.min(1,rank/5),car=state.opponent,ball=state.ball;
  this.nextThink=this.time+(.24*(1-q)+.075*q);if(!car||car.isDemoed)return this.controls={};
  const p=car.position,b=ball.position,f=car.forward,speed=Math.hypot(car.velocity[0],car.velocity[2]),distance=Math.hypot(b[0]-p[0],b[2]-p[2]);
  const lead=rank<1?0:Math.min(.35,q*.4),error=.9*Math.pow(1-q,2)+.08;
  let x=b[0]+ball.velocity[0]*lead+Math.sin(this.time*1.15+car.slot*2.4)*error;
  let z=b[2]+ball.velocity[2]*lead+Math.cos(this.time*.8+car.slot)*error*.5;
  // Silver and above begin getting goal-side instead of always charging straight in.
  if(p[2]>b[2]-.7&&distance<12){x=b[0]+(p[0]>b[0]?1:-1)*(2.2+error);z=b[2]-2.3}
  if(rank>=2&&state.targetOverride&&distance>12){x=state.targetOverride[0];z=state.targetOverride[2]}
  const dx=x-p[0],dz=z-p[2],angle=Math.atan2(f.x*dz-f.z*dx,f.x*dx+f.z*dz),turn=Math.abs(angle);
  const desired=9+q*10;let throttle=speed>desired?0:(.9+q*.1);
  if(turn>1.3)throttle*=.65;
  let steer=clamp(angle*(1.8+q*1.3),-1,1);if(turn>2.2&&distance<7&&speed<3){throttle=-.8;steer=clamp(-Math.atan2(-f.x*dz+f.z*dx,-f.x*dx-f.z*dz)*2,-1,1)}
  let jump=false;if(rank>=1.8&&car.onGround&&distance<2.3&&b[1]>1.25&&b[1]<2.7&&turn<.4&&this.time-this.jumpAt>2){jump=true;this.jumpAt=this.time}
  const boost=rank>=2.7&&car.onGround&&car.boost>15&&distance>9&&turn<.12&&speed<desired-1&&this.time%2.5<q*.55;
  this.intent=rank<1?'Persigue el balón con errores':'Conducción básica';
  return this.controls={throttle,steer,pitch:car.onGround?0:clamp(-car.forward.y*2,-1,1),yaw:steer,roll:0,jump,boost,handbrake:rank>=3&&turn>1.4&&speed>10};
 }
}
