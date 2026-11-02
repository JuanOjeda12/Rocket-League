import * as T from 'three';
import {FollowCamera} from './follow-camera.js?v=inventory-20261028';
import {addRoundedArena} from './arena-view.js?v=inventory-20261028';
import {turfMaterials} from './surface-materials.js?v=inventory-20261028';
import {createBallVisual} from './ball-view.js?v=inventory-20261028';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {startApp} from './app.js?v=necto-tiers-20261101';
import {ARENA} from './arena-shape.js?v=inventory-20261028';
import {createStadium} from './stadium.js?v=inventory-20261028';
const $=id=>document.getElementById(id), canvas=$('game');
const renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
const scene=new T.Scene();scene.background=new T.Color('#102638');scene.fog=new T.Fog('#102638',80,225);
// A small studio reflection map keeps textured metal readable without a large HDRI.
const roomEnvironment=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer);
const reflectionMap=pmrem.fromScene(roomEnvironment,.04);
scene.environment=reflectionMap.texture;scene.environmentIntensity=.6;
roomEnvironment.dispose();pmrem.dispose();const camera=new T.PerspectiveCamera(65,innerWidth/innerHeight,.1,400);camera.position.set(0,1.3,32.7);
const followCamera=new FollowCamera(camera);
const hemisphere=new T.HemisphereLight(0xbfeeff,0x244533,2.1);scene.add(hemisphere);const sun=new T.DirectionalLight(0xe8f6ff,3);sun.position.set(-30,65,15);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-65,right:65,top:75,bottom:-75,near:1,far:160});sun.shadow.bias=-.0003;scene.add(sun);
const blue=0x53beff,orange=0xffa455,green=0xb6f56c;
function mat(color,roughness=.7,metalness=0){return new T.MeshStandardMaterial({color,roughness,metalness})}
function box(w,h,d,color,x,y,z,group=scene){const m=new T.Mesh(new T.BoxGeometry(w,h,d),typeof color==='number'||typeof color==='string'?mat(color):color);m.position.set(x,y,z);m.receiveShadow=true;group.add(m);return m}
function line(points,color=0xc4e6d3){const l=new T.Line(new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p))),new T.LineBasicMaterial({color,transparent:true,opacity:.7}));scene.add(l);return l}
const {width:W,length:L,height:H,goal:G,goalHeight:GH}=ARENA;
// Alternate turf strips keep the field readable from a moving camera.
const turf=turfMaterials(W*2,L*2/16);
for(let i=0;i<16;i++)box(W*2,.2,L*2/16,turf[i%2],0,-.12,-L+(i+.5)*L*2/16);
addRoundedArena(scene);
line([[-W,.04,0],[W,.04,0]]);for(const radius of [9.15,.5]){const pts=[];for(let i=0;i<=96;i++)pts.push([Math.sin(i/96*Math.PI*2)*radius,.05,Math.cos(i/96*Math.PI*2)*radius]);line(pts)}
const stadium=createStadium(scene,{sun,hemisphere,renderer});
const ball=createBallVisual();scene.add(ball);
const ballShadow=new T.Mesh(new T.CircleGeometry(1.1,32),new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.2,depthWrite:false}));ballShadow.rotation.x=-Math.PI/2;scene.add(ballShadow);
startApp({scene,camera,renderer,canvas,ball,ballShadow,followCamera,stadium});
