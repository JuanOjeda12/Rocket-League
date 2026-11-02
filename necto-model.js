// Original Necto weights/architecture: Rolv-Arild/Necto, CC BY-NC-SA 4.0.
import createModel from './engine/necto/necto.js';
let loading;
export function loadNecto(){return loading??=(async()=>{
 const url=new URL('./engine/necto/weights.bin',import.meta.url),weights=typeof process!=='undefined'&&process.versions?.node?new Uint8Array(await(await import('node:fs/promises')).readFile(url)):new Uint8Array(await fetch(url).then(r=>{if(!r.ok)throw Error('No se pudo cargar Necto');return r.arrayBuffer()}));
 if(weights.byteLength!==173964*4)throw Error('Modelo Necto incompleto');
 const m=await createModel();m.HEAPF32.set(new Float32Array(weights.buffer,weights.byteOffset,weights.byteLength/4),m._nn_weights()/4);m._nn_init();
 return{infer(query,entities,count){if(count<1||count>45)throw Error('Cantidad de entidades inválida');m.HEAPF32.set(query,m._nn_query()/4);m.HEAPF32.set(entities,m._nn_entities()/4);m._nn_infer(count);return Array.from(m.HEAPF32.subarray(m._nn_logits()/4,m._nn_logits()/4+12))}};
 })().catch(e=>{loading=null;throw e})}
