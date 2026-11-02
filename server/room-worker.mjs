import {parentPort,workerData} from 'node:worker_threads';
import {Simulation} from '../simulation.js?v=gold-nexto-20261101';
const simulation=await Simulation.create(workerData.options),inputs=new Map();
simulation.assign(workerData.ownerSlot,workerData.profile,true);
parentPort.on('message',m=>{
 try{
  if(m.type==='input')inputs.set(m.slot,{controls:m.controls,time:Date.now()});
  if(m.type==='assign')simulation.assign(m.slot,m.profile,true);
  if(m.type==='release'){inputs.delete(m.slot);simulation.release(m.slot)}
  if(m.type==='start')simulation.start();if(m.type==='restart')simulation.restart();if(m.type==='reset')simulation.resetRound();if(m.type==='skip')simulation.skip();
 }catch(e){parentPort.postMessage({type:'command-error',message:e.message})}
});
parentPort.postMessage({type:'ready',state:simulation.view()});
let previous=performance.now(),acc=0,sequence=0;
setInterval(()=>{
 const now=performance.now();acc+=Math.min(.12,(now-previous)/1000);previous=now;
 const controls={};for(const [slot,input] of inputs)controls[slot]=Date.now()-input.time<500?input.controls:{};
 while(acc>=1/120){simulation.tick(1/120,controls);acc-=1/120}
 parentPort.postMessage({type:'state',state:{...simulation.view(),sequence:sequence++,serverTime:Date.now()}});
},1000/30);

