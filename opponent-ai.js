import {predictBall,incomingShot} from './ball-prediction.js?v=inventory-20261028';
import {botProfile} from './bot-profile.js?v=gold-nexto-20261101';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const angleTo=(f,dx,dz)=>Math.atan2(f.x*dz-f.z*dx,f.x*dx+f.z*dz);
const normalize=(x,z)=>{const n=Math.hypot(x,z)||1;return[x/n,z/n]};
// All tactical coordinates face +Z; our goal is at -51.2.
export function shotTarget(ball,enemies=[],mates=[]){
 const b=ball.position;let best=[0,1.2,52.5],bestScore=-Infinity;
 for(const x of [-5.6,-3,0,3,5.6]){
  const dx=x-b[0],dz=52.5-b[2],length=Math.hypot(dx,dz);let score=1.5-Math.abs(x)*.04-Math.abs(Math.atan2(dx,dz))*.65;
  for(const e of enemies){const p=e.position,t=clamp(((p[0]-b[0])*dx+(p[2]-b[2])*dz)/(length*length),0,1),clearance=Math.hypot(p[0]-b[0]-dx*t,p[2]-b[2]-dz*t);if(t>.02&&t<1)score-=Math.max(0,4.5-clearance)*(1.4+(p[2]>40?.6:0))}
  if(score>bestScore){bestScore=score;best=[x,1.2,52.5]}
 }
 // A wide ball with a covered net can be centered to a teammate arriving behind it.
 const receiver=mates.filter(c=>c.position[2]>b[2]-15&&c.position[2]<b[2]-3&&Math.abs(c.position[0])<14).sort((a,c)=>Math.abs(a.position[0])-Math.abs(c.position[0]))[0];
 if(Math.abs(b[0])>22&&b[2]>20&&receiver&&bestScore<.3)return[receiver.position[0]+receiver.velocity[0]*.35,1.1,Math.min(44,b[2]+5)];
 return best;
}
export class OpponentAI{
 constructor(options={}){this.difficulty=options.difficulty||'competitive';this.tuning=botProfile(this.difficulty,options.skill);this.reset()}
 reset(){this.time=0;this.nextThink=0;this.lastThink=0;this.controls={};this.intent='Read play';this.jumpStart=-100;this.jumpReady=0;this.jumpMode='';this.lastTouch=-100;this.reverseUntil=0;this.stuck=0;this.previousPosition=null;this.previousForward=null;this.previousUp=null;this.airUntil=0;this.airContact=false;this.wasReversing=false;this.commitUntil=0;this.recoverUntil=0}
 update(state,dt){
  this.time+=dt;if(this.time<this.nextThink)return this.controls;
  const tune=this.tuning,hard=this.difficulty==='competitive',step=Math.max(.008,this.time-this.lastThink);this.lastThink=this.time;this.nextThink=this.time+tune.think;
  const car=state.opponent;if(!car||car.isDemoed)return this.controls={};
  const p=car.position,b=state.ball.position,v=car.velocity,f=car.forward,up=car.up,right=car.right,ground=car.onGround&&up.y>.5;
  const speed=Math.hypot(v[0],v[2]),forwardSpeed=v[0]*f.x+v[2]*f.z,d=distance(p,b),enemies=state.opponents||[],mates=state.teammates||[];
  const shot=incomingShot(state.ball,1),danger=!!shot,role=state.role||'attack',canCommit=!state.targetOverride;
  if(car.ballTouchAge>=0&&car.ballTouchAge<step*1.5){this.lastTouch=this.time;if(!ground&&b[1]>1.6){this.airContact=true;if(tune.carry)this.airUntil=Math.max(this.airUntil,this.time+1.8)}}
  let intercept=predictBall(state.ball,.12),arrival=.12,reachable=false;
  // Earliest reachable contact, including steering time and actual acceleration.
  for(let t=.12;t<=tune.prediction;t+=.09){
   const q=predictBall(state.ball,t);if(Math.abs(q[2])>51)break;const dx=q[0]-p[0],dz=q[2]-p[2],angle=Math.abs(angleTo(f,dx,dz)),turnTime=Math.min(1.2,angle*(ground?.29:.12));
   const travel=Math.max(0,t-turnTime),accel=car.boost>8?24:13,reach=Math.min(23*travel,Math.max(0,forwardSpeed)*travel+accel*travel*travel*.5);
   const vertical=q[1]-p[1],airReach=tune.air&&car.boost>10&&vertical>1&&vertical<Math.min(tune.jumpHeight,1+7*t);
   intercept=q;arrival=t;
   if(distance(p,q)<reach+1.15&&(q[1]<2.2||airReach)){reachable=true;break}
  }
  if(d<3.2){arrival=clamp(d/Math.max(5,speed),.025,.25);intercept=predictBall(state.ball,arrival)}
  const goal=shotTarget(state.ball,enemies,mates);let [sx,sz]=normalize(goal[0]-intercept[0],goal[2]-intercept[2]);
  // Counter the ball's lateral momentum, rather than merely pointing at the goal.
  const shotSpeed=clamp(14+distance(intercept,goal)*.3,15,30),bx=state.ball.velocity[0],bz=state.ball.velocity[2];
  let [hx,hz]=normalize(sx*shotSpeed-bx*.42,sz*shotSpeed-bz*.42);
  if(hz<.2&&intercept[2]<35)[hx,hz]=normalize(sx,Math.max(.35,sz));
  const behind=(p[0]-intercept[0])*hx+(p[2]-intercept[2])*hz,side=(p[0]-intercept[0])*hz-(p[2]-intercept[2])*hx;
  const facing=Math.abs(angleTo(f,hx,hz)),aligned=behind<-.2&&Math.abs(side)<Math.max(.9,Math.min(1.3,d*.07));
  const setup=clamp(2.8+facing*2+d*.06,2.8,7);
  let target=[intercept[0]-hx*setup,0,intercept[2]-hz*setup],strike=false,defending=false;this.intent='Line up shot';
  if(aligned)this.commitUntil=this.time+.35;
  if(aligned||this.time<this.commitUntil&&behind<-.2&&Math.abs(side)<1.5){target=[intercept[0]+hx*2,0,intercept[2]+hz*2];strike=true;this.intent='Shoot open lane'}
  // Go around a ball that is between us and our own goal. Never ram it goalward.
  if(behind>-.2&&!danger){
   if(Math.abs(intercept[0])>28)this.rotationSign=-Math.sign(intercept[0]);
   this.rotationSign??=Math.abs(p[0]-intercept[0])>.5?Math.sign(p[0]-intercept[0]):(car.slot%2? -1:1);
   const lane=intercept[0]+this.rotationSign*5;
   target=[lane,0,intercept[2]-4.5];
   strike=false;this.intent='Goal-side rotation';
  }else if(behind<-1)this.rotationSign=null;
  if(!danger&&canCommit&&Math.hypot(bx,bz)>3&&p[2]<intercept[2]+.5&&d<24){target=[intercept[0],0,intercept[2]+.8];strike=true;this.intent='Intercept moving ball'}

  if(danger&&canCommit){
   defending=true;this.intent='Cut off shot';
   // Meet the incoming ball before the goal line, even if an ideal attacking angle is unavailable.
   let best=null,bestCost=Infinity;
   for(let t=.08;t<=Math.min(shot.time,.95);t+=.045){const q=predictBall(state.ball,t),dx=q[0]-p[0],dz=q[2]-p[2],a=Math.abs(angleTo(f,dx,dz)),reachTime=distance(p,q)/Math.max(9,speed+5)+a*.16,cost=Math.abs(reachTime-t)+Math.max(0,reachTime-t)*1.6;if(cost<bestCost){bestCost=cost;best={q,t}}}
   if(best){intercept=best.q;arrival=best.t;target=[intercept[0],0,intercept[2]+.6];strike=true}

   // If already ahead of the ball, make a lateral block instead of a straight own-goal hit.
   if(p[2]>b[2]+1.5&&d<7){target=[b[0]+(p[0]>=b[0]?1:-1)*5,0,p[2]];strike=false;this.intent='Side clear'}
  }else if(b[2]<-32&&aligned){target=[intercept[0]+hx*2,0,intercept[2]+Math.max(.5,hz)*2];strike=true;this.intent='Clear away from net'}
  if(canCommit&&!danger&&b[2]<-28&&p[2]>b[2]+2&&Math.abs(b[0])>12){target=[clamp(b[0]*.2,-5,5),0,-48];strike=false;this.intent='Recover inside goal'}
  if(state.targetOverride){target=[...state.targetOverride];strike=false;this.intent=role==='keeper'?'Cover goal':'Rotate and receive'}
  // Shadow an opponent who has possession instead of charging past the ball.
  const opponentNear=enemies.some(e=>distance(e.position,b)<3.8),contested=enemies.some(e=>distance(e.position,b)<12);
  if(canCommit&&!danger&&p[2]<b[2]+.5&&(contested||d<6)&&b[1]<2.4){target=[intercept[0],0,intercept[2]+1.2];strike=true;this.intent='Beat opponent to ball'}
  if(!danger&&canCommit&&opponentNear&&p[2]<b[2]-5&&d<24&&d>12&&b[2]<-12){target=[clamp(b[0]*.68,-8,8),0,b[2]-6];strike=false;this.intent='Shadow attacker'}
  const kickoff=Math.abs(b[0])<.4&&Math.abs(b[2])<.4&&Math.hypot(...state.ball.velocity)<.6&&canCommit;
  if(kickoff){target=[b[0],0,b[2]+1.5];strike=true;this.intent='Fast kickoff'}
  target=[clamp(target[0],-38,38),0,clamp(target[2],-49.8,51)];
  // Route through boost without vacating the goal or a contested interception.
  if(car.boost<(tune.air?38:20)&&d>14&&!danger&&b[2]>-25&&(!canCommit||d>27)){
   let best=null,bestCost=Infinity;const direct=distance(p,target);
   for(const pad of state.pads||[])if(pad.active){const length=distance(p,pad.position),detour=length+distance(pad.position,target)-direct,cost=detour-(pad.isBig?1:0);if(length<18&&detour<(canCommit?2.2:5)&&cost<bestCost){best=pad;bestCost=cost}}
   if(best){target=best.position;this.intent='Boost route'}
  }
  let dx=target[0]-p[0],dz=target[2]-p[2],len=Math.hypot(dx,dz),angle=angleTo(f,dx,dz),turn=Math.abs(angle);
  // Steering uses the direction of travel too: countersteer instead of sliding across the contact.
  const lateral=v[0]*right.x+v[2]*right.z;
  let steer=clamp(angle*tune.accuracy-lateral*.035,-1,1),desired=tune.topSpeed;
  if(turn>1.6)desired=4;else if(turn>1)desired=7;else if(turn>.55)desired=12;else if(turn>.25)desired=17;
  if(!strike)desired=Math.min(desired,Math.sqrt(Math.max(0,len-.3)*2*10));
  if(state.targetOverride)desired=Math.min(desired,Math.max(0,len*2.2));
  if(strike&&d<5&&facing>.4&&!defending)desired=Math.min(desired,9);
  let throttle=forwardSpeed>desired+1?-1:forwardSpeed>desired?.08:1,handbrake=turn>1.1&&speed>8;
  let reversing=false;
  if(turn>2.2&&len<12&&(speed<5||this.wasReversing&&speed<12)){throttle=-1;steer=clamp(-angleTo({x:-f.x,z:-f.z},dx,dz)*tune.accuracy,-1,1);handbrake=false;reversing=true;this.intent='Reverse block'}
  if(this.previousPosition&&distance(p,this.previousPosition)<.018&&Math.abs(throttle)>.5&&ground&&len>2)this.stuck+=step;else this.stuck=Math.max(0,this.stuck-step*2);
  this.previousPosition=[...p];if(this.stuck>.6){this.reverseUntil=this.time+.55;this.stuck=0}
  if(this.time<this.reverseUntil){throttle=-1;steer=angle>0?-1:1;handbrake=false;reversing=true;this.intent='Recover from wall'}
  if(p[1]>2&&car.onGround&&up.y<.6){target=[p[0]*.6,0,p[2]*.7];steer=clamp(angleTo(f,target[0]-p[0],target[2]-p[2])*3,-1,1);throttle=1;this.intent='Wall recovery'}
  const elevated=canCommit&&tune.air&&(intercept[1]>2.3||b[1]>2.3&&d<10&&predictBall(state.ball,.35)[1]>2.4)&&intercept[1]<tune.jumpHeight&&car.boost>12&&p[2]<intercept[2]+1&&!danger;
  if(this.time>this.jumpReady&&ground&&!reversing){
   const hitTime=d/Math.max(5,forwardSpeed);
   if(danger&&shot.time<1.2&&turn>.75&&d<19&&car.boost>5&&intercept[1]>1.6){this.beginJump('save',1.3);this.dodgeTarget=predictBall(state.ball,Math.max(.1,shot.time-.12))}
   else if(elevated&&turn<.28&&d<18&&reachable&&(speed>7&&arrival<1.05||d<3.5&&speed>5)){this.beginJump('aerial',1.6);this.airUntil=this.time+2.6;this.airContact=false}
   else if(canCommit&&turn<.24&&b[1]>1.45&&b[1]<4.2&&hitTime<.36&&d<6){this.beginJump('block',1.15)}
   else if(hard&&strike&&!defending&&facing<.16&&turn<.16&&d>2.2&&d<3.4&&b[1]<1.5&&speed>10){this.beginJump('shot',1.3)}
   else if(tune.speedFlip&&canCommit&&!danger&&aligned&&turn<.04&&d>22&&speed>14&&car.boost<45){this.beginJump('speed',2)}
  }
  const age=this.time-this.jumpStart,second=this.jumpMode==='save'?age>.11&&age<.19:age>.205&&age<.29;
  let jump=age>=0&&age<(this.jumpMode==='save'?.075:.17)||second&&['aerial','shot','speed','save'].includes(this.jumpMode),pitch=second&&['shot','speed'].includes(this.jumpMode)?-1:0,yaw=0,roll=0;
  if(second&&this.jumpMode==='save'){const [tx,tz]=normalize(this.dodgeTarget[0]-p[0],this.dodgeTarget[2]-p[2]);pitch=-(f.x*tx+f.z*tz);roll=-(right.x*tx+right.z*tz)}
  let boost=ground&&!reversing&&throttle>0&&turn<(defending?.9:tune.boostAngle)&&speed<22.8&&car.boost>0&&len>2.5&&(strike||len>7);
  if(!ground){
   const activeAir=canCommit&&tune.air&&(this.time<this.airUntil||elevated&&d<10)&&b[1]>1.6&&d<22;
   if(activeAir){
    const carry=tune.carry&&this.airContact&&b[1]>1.6&&p[2]<b[2]+.5&&d<4.5;
    const lead=carry?.12:clamp(Math.hypot(b[0]-p[0],b[1]-p[1],b[2]-p[2])/Math.max(9,Math.hypot(...v)+5),.08,.65),q=predictBall(state.ball,lead);
    // Follow a contact point below and behind the ball, matching its velocity for another touch.
    const offset=carry?1.05:.35,contact=[q[0]-sx*offset,q[1]-(carry?.9:.25),q[2]-sz*offset];
    const horizon=carry?.25:clamp(lead,.18,.65),gain=carry?3.1:2.3;
    const old=this.previousForward,rateY=old?(f.y-old.y)/step:0,rateYaw=old?angleTo(old,f.x,f.z)/step:0;
    if(!carry){const targetBall=predictBall(state.ball,.12),ax=targetBall[0]-p[0],ay=targetBall[1]-p[1]-.15,az=targetBall[2]-p[2],n=Math.max(.1,Math.hypot(ax,ay,az));
     pitch=clamp((ay/n-f.y)*4-rateY*.13,-1,1);yaw=clamp(angleTo(f,ax,az)*3-rateYaw*.15,-1,1);roll=clamp(-right.y*2.4,-1,1);boost=car.boost>0&&(f.x*ax+f.y*ay+f.z*az)/n>.77&&ay>-.7;
    }else{
     let ax=(contact[0]-p[0])*5+(state.ball.velocity[0]-v[0])*2,ay=(contact[1]-p[1])*5+(state.ball.velocity[1]-v[1])*2+6.5,az=(contact[2]-p[2])*5+(state.ball.velocity[2]-v[2])*2;
     const n=Math.max(.1,Math.hypot(ax,ay,az));ax/=n;ay/=n;az/=n;
     pitch=clamp((ay-f.y)*4-rateY*.2,-1,1);yaw=clamp(angleTo(f,ax,az)*4-rateYaw*.2,-1,1);roll=clamp(-right.y*3,-1,1);
     const closing=(v[0]-state.ball.velocity[0])*sx+(v[2]-state.ball.velocity[2])*sz;
     boost=car.boost>0&&f.x*ax+f.y*ay+f.z*az>.8&&closing<5&&contact[1]>p[1]-1.2;
    }
    if(second&&this.jumpMode==='aerial'){pitch=yaw=roll=0;boost=false}this.intent=carry?'Air dribble':'Aerial intercept';
   }else if(!car.isFlipping&&!(second&&['shot','speed','save'].includes(this.jumpMode))){
    // Land wheels-down and facing the direction of travel instead of tumbling away.
    const look=Math.hypot(v[0],v[2])>3?normalize(v[0],v[2]):normalize(dx,dz);pitch=clamp(-f.y*3,-1,1);yaw=clamp(angleTo(f,...look)*2,-1,1);roll=clamp(-right.y*3,-1,1);boost=false;
    if(up.y<0){roll=right.y>=0?-1:1;pitch=0}
   }
  }
  if(!ground&&this.jumpMode==='save'&&age<.9&&this.dodgeTarget){const tx=this.dodgeTarget[0]-p[0],tz=this.dodgeTarget[2]-p[2],n=Math.hypot(tx,tz)||1;boost=car.boost>0&&(f.x*tx+f.z*tz)/n>.4&&p[1]<3}
  if(!car.onGround&&up.y<.1&&p[1]<.7&&this.time>this.jumpReady){this.beginJump('recover',1);jump=true}
  if(!hard){boost=boost&&this.time%1.8<1.1;throttle=throttle>0?throttle*.9:throttle}
  this.wasReversing=reversing;this.plan={target,intercept,arrival,turn,behind,side,role};this.previousForward={...f};this.controls={throttle,steer,handbrake,boost,jump,pitch,yaw,roll};return this.controls;
 }
 beginJump(mode,cooldown){this.jumpMode=mode;this.jumpStart=this.time;this.jumpReady=this.time+cooldown}
}
