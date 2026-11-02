import {cleanInventory,inventoryProfile} from './inventory.js?v=inventory-20261028';
import {ACCOUNT_CONFIG} from './account-config.js?v=inventory-20261028';
import {cleanProgress,emptyProgress} from './progression.js?v=coherent-bots-20261101';
import {cleanProfile} from './catalog.js?v=inventory-20261028';
const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
const normalize=data=>{const garage=cleanProfile(data?.garage||{}),inventory=cleanInventory(data?.inventory,garage.body);return{garage:inventoryProfile(garage,inventory),inventory,progress:cleanProgress(data?.progress||{}),controls:data?.controls||null}};
export function validAccountConfig(config){
 try{const url=new URL(config.url);if(url.protocol!=='https:'||url.username||url.password||!config.publishableKey||config.publishableKey.startsWith('sb_secret_'))return false;
  if(config.publishableKey.split('.').length===3){const jwt=JSON.parse(atob(config.publishableKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(jwt.role==='service_role')return false}return true;
 }catch{return false}
}
export class AccountStore{
 constructor(config=ACCOUNT_CONFIG,onStatus=()=>{}){
  this.config=config;this.configured=validAccountConfig(config);this.onStatus=onStatus;this.user=null;this.session=read('rocket-auth-session');this.revision=0;this.dirty=false;this.status='Guardado en este navegador';
  this.data=normalize(read('rocket-player:guest')?.data||{garage:read('rocket-garage'),progress:emptyProgress(),controls:read('rocket-controls')});
 }
 statusText(text){this.status=text;this.onStatus(text)}
 key(){return'rocket-player:'+(this.user?.id||'guest')}
 saveSession(session){this.session=session?{access_token:session.access_token,refresh_token:session.refresh_token,expires_at:session.expires_at||Math.floor(Date.now()/1000)+(session.expires_in||3600),user:session.user||this.user}:null;write('rocket-auth-session',this.session)}
 async request(route,{method='GET',body,token=null}={}){
  if(!this.configured)throw Error('Las cuentas online aún no están configuradas. Puedes jugar como invitado.');
  const response=await fetch(this.config.url.replace(/\/$/,'')+route,{method,headers:{apikey:this.config.publishableKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(route.startsWith('/rest/')?{Prefer:'resolution=merge-duplicates,return=minimal'}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
  const text=await response.text();let json;try{json=text?JSON.parse(text):null}catch{json=null}
  if(!response.ok){const error=Error(response.status===401?'La sesión caducó. Inicia sesión otra vez.':response.status===429?'Demasiados intentos. Espera un momento.':json?.msg||json?.error_description||json?.message||'No se pudo conectar con la cuenta.');error.status=response.status;throw error}return json;
 }
 async token(){
  if(!this.session)throw Error('Inicia sesión primero.');
  if(this.session.expires_at<Date.now()/1000+60){if(!this.refreshing)this.refreshing=this.request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:this.session.refresh_token}}).then(s=>this.saveSession(s)).finally(()=>this.refreshing=null);await this.refreshing}
  return this.session.access_token;
 }
 async confirmFromURL(){
  if(!this.configured||!globalThis.location?.hash)return false;
  const params=new URLSearchParams(location.hash.slice(1));
  if(!params.has('access_token')&&!params.has('error')&&!params.has('error_description'))return false;
  // Remove credentials from the address before making network requests.
  globalThis.history?.replaceState(null,'',location.pathname+location.search);
  if(params.has('error')||params.has('error_description'))throw Error('El enlace de confirmación caducó o no es válido. Inicia sesión si ya confirmaste tu cuenta.');
  const access_token=params.get('access_token'),refresh_token=params.get('refresh_token');
  if(!access_token||!refresh_token)throw Error('El enlace de confirmación está incompleto.');
  const user=await this.request('/auth/v1/user',{token:access_token});
  if(!user?.id)throw Error('No se pudo verificar la cuenta.');
  if(!this.user)write('rocket-player:guest',{data:this.data,dirty:false,savedAt:Date.now()});
  this.user=user;this.saveSession({access_token,refresh_token,user,expires_in:Number(params.get('expires_in'))||3600});
  await this.load();return true;
 }
 async restore(){
  if(!this.configured)return;
  try{if(await this.confirmFromURL())return}catch(error){this.authError=error.message;this.statusText(error.message);return}
  if(!this.session)return;
  try{const token=await this.token();this.user=await this.request('/auth/v1/user',{token});await this.load()}
  catch(error){if(error.status===401||error.status===400){this.user=null;this.saveSession(null);this.statusText('Vuelve a iniciar sesión')}else if(this.session?.user?.id){this.user=this.session.user;this.data=normalize(read(this.key())?.data);this.statusText('Sin conexión · guardado local pendiente')}}
 }
 async load(){
  const cached=read(this.key());this.data=normalize(cached?.data||{garage:{name:this.user.user_metadata?.username||'Jugador'}});const token=await this.token();const rows=await this.request('/rest/v1/player_profiles?id=eq.'+encodeURIComponent(this.user.id)+'&select=data,updated_at',{token});
  const remote=rows?.[0],newProfile=read('rocket-new-profile:'+this.user.id);this.data=normalize(remote?.data||newProfile||{garage:{name:this.user.user_metadata?.username||'Jugador'}});
  if(cached?.dirty&&(!remote||cached.savedAt>Date.parse(remote.updated_at)))this.data=normalize(cached.data);
  this.dirty=!!cached?.dirty||!remote;write(this.key(),{data:this.data,dirty:this.dirty,savedAt:cached?.savedAt||Date.now()});write('rocket-new-profile:'+this.user.id,null);this.statusText(this.dirty?'Guardado local pendiente':'Sincronizado con tu cuenta');if(this.dirty)await this.flush();
 }
 async login(email,password){
  if(!this.user)write('rocket-player:guest',{data:this.data,dirty:false,savedAt:Date.now()});const guest=this.data;
  const s=await this.request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});this.user=s.user;this.saveSession(s);
  try{await this.load();return this.user}catch(error){this.user=null;this.saveSession(null);this.data=guest;throw error}
 }
 async signup(email,password,username){
  if(!this.user)write('rocket-player:guest',{data:this.data,dirty:false,savedAt:Date.now()});const guest=this.data;
  const s=await this.request('/auth/v1/signup?redirect_to='+encodeURIComponent('https://rocket-arena.com/'),{method:'POST',body:{email,password,data:{username:cleanProfile({name:username}).name}}});
  if(s?.user?.id)write('rocket-new-profile:'+s.user.id,normalize({...guest,garage:{...guest.garage,name:username}}));
  if(s?.access_token){this.user=s.user;this.saveSession(s);try{await this.load();return true}catch(error){this.user=null;this.saveSession(null);this.data=guest;throw error}}return false;
 }
 persist(){
  this.revision++;this.dirty=!!this.user;write(this.key(),{data:this.data,dirty:this.dirty,savedAt:Date.now()});
  this.statusText(this.user?'Guardado local · sincronizando…':'Guardado en este navegador');clearTimeout(this.timer);if(this.user)this.timer=setTimeout(()=>this.flush(),800);
 }
 async flush(){
  clearTimeout(this.timer);if(!this.user||!this.configured||!this.dirty)return;
  if(this.saving){await this.saving;if(this.dirty&&this.status!=='Sin conexión · guardado local pendiente')return this.flush();return}
  const revision=this.revision,data=structuredClone(this.data),id=this.user.id;
  this.saving=(async()=>{try{const token=await this.token();await this.request('/rest/v1/player_profiles?on_conflict=id',{method:'POST',token,body:{id,data}});
   if(this.user?.id===id&&revision===this.revision){this.dirty=false;write(this.key(),{data,dirty:false,savedAt:Date.now()});this.statusText('Sincronizado con tu cuenta')}
  }catch{this.statusText('Sin conexión · guardado local pendiente')}finally{this.saving=null}})();await this.saving;
 }
 async logout(){await this.flush();try{if(this.session)await this.request('/auth/v1/logout',{method:'POST',token:await this.token()})}catch{}this.user=null;this.saveSession(null);clearTimeout(this.timer);this.data=normalize(read('rocket-player:guest')?.data);this.dirty=false;this.statusText('Guardado en este navegador')}
}
