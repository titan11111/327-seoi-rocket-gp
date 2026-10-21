/* 327 宇宙編。250-hoshimeguri-kokai-nisshiの手続き惑星・環・大気を参照。
   512x256の生成地図、共有球、近傍だけ描画。画像・音声の追加転送なし。 */
(function(){'use strict';
var G=window.G,T=THREE,TAU=Math.PI*2,clamp=G.clamp;
var B=[
 ['earth','地球 / ISS',0x3d83b9,140,'earth',1],
 ['moon','月',0xaaa89f,110,'rock',.17],
 ['venus','金星',0xdbb977,185,'cloud',.90],
 ['mercury','水星',0x928a80,125,'rock',.38],
 ['sun','太陽 / スイングバイ',0xffaa30,270,'sun',1],
 ['mars','火星',0xb85d3d,160,'rock',.38],
 ['belt','小惑星帯',0x9f9e9a,0,'belt',1],
 ['jupiter','木星',0xc49d78,350,'band',2.53],
 ['saturn','土星',0xd9c796,270,'band',1.07],
 ['uranus','天王星',0x8bd4da,230,'band',.89],
 ['neptune','海王星',0x3156ba,230,'band',1.14],
 ['voyager','ボイジャー',0xd8be83,0,'probe',1],
 ['comet','ハレー彗星',0x8acde5,65,'comet',1],
 ['pluto','冥王星',0xb6a292,120,'ice',.06]
];
var SPACING=950,FIN=(B.length-1)*SPACING+150;
function noise(x,y){return Math.sin(x*1.7+Math.sin(y*.91))*Math.sin(y*2.3+Math.cos(x*.71))*.5+.5;}
function maps(b){return G.planetMaps(b[4]==='sun'?'star':b[4]==='comet'?'ice':b[4],b[2],b[0]==='jupiter'?1:((b[0].charCodeAt(0)+b[0].length*7)%9),b[0]);}
function glowTexture(){var c=document.createElement('canvas');c.width=c.height=64;var cx=c.getContext('2d'),g=cx.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.18,'rgba(255,255,255,.7)');g.addColorStop(1,'rgba(255,255,255,0)');cx.fillStyle=g;cx.fillRect(0,0,64,64);return new T.CanvasTexture(c);}
function atmo(color){return new T.ShaderMaterial({uniforms:{col:{value:new T.Color(color)}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.BackSide,
 vertexShader:'varying vec3 n,v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
 fragmentShader:'uniform vec3 col;varying vec3 n,v;void main(){float a=pow(1.-abs(dot(normalize(n),normalize(v))),3.0);gl_FragColor=vec4(col,a*.55);}'});}
function rings(radius,color){
 var cv=document.createElement('canvas');cv.width=256;cv.height=4;var cx=cv.getContext('2d'),c=new T.Color(color),r=G.rng(71);
 for(var x=0;x<256;x++){var t=x/256,a=(t<.06||t>.98)?0:(.35+r()*.45);if(t>.61&&t<.67)a*=.025;cx.fillStyle='rgba('+Math.round(c.r*255)+','+Math.round(c.g*255)+','+Math.round(c.b*255)+','+a+')';cx.fillRect(x,0,1,4);}
 var geo=new T.RingGeometry(radius*1.32,radius*2.3,96,1),pa=geo.attributes.position,uv=geo.attributes.uv;
 for(var i=0;i<pa.count;i++){var len=Math.sqrt(pa.getX(i)*pa.getX(i)+pa.getY(i)*pa.getY(i));uv.setXY(i,(len-radius*1.32)/(radius*.98),.5);}
 var m=new T.Mesh(geo,new T.MeshBasicMaterial({map:new T.CanvasTexture(cv),side:T.DoubleSide,transparent:true,depthWrite:false}));m.rotation.x=Math.PI/2;return m;
}
function place(s,x,h,p,u,f,r){p.set(x,h,-s);u.set(0,1,0);f.set(0,0,-1);r.set(1,0,0);}
G.buildSpace=function(layer,renderer,quality){
 var W={},hi=quality!=='low',rand=G.rng(327),i,j;
 var unit=new T.SphereGeometry(1,48,32),planets=[],landmarks=[],lmS=[],gates=[],obstacles=[];
 var glow=glowTexture();
 var ambient=new T.HemisphereLight(0xbcd9ff,0x1c1c3b,.82);layer.add(ambient);
 var sun=new T.DirectionalLight(0xffe3bf,1.7);sun.position.set(-400,600,200);layer.add(sun);
 var fill=new T.DirectionalLight(0x599bff,.65);fill.position.set(300,-100,-200);layer.add(fill);
 layer.fog=new T.Fog(0x040815,1500,4000);
 for(i=0;i<B.length;i++){
   var b=B[i],s=i*SPACING;landmarks.push({name:b[1],sub:i===13?'太陽系の果てへ':'SOLAR GRAND TOUR',id:b[0],col:b[2]});lmS.push(s);
   var group=new T.Group();group.position.set((i%2?1:-1)*(b[3]*1.9+100),-b[3]*.18,-s-300);layer.add(group);
   if(b[3]>0){
     var m=maps(b); var mat=b[4]==='sun'?new T.MeshBasicMaterial({map:m.map}):new T.MeshPhongMaterial({map:m.map,shininess:m.air?18:3,specular:0x19222f});
     if(m.bump&&b[4]!=='sun'){mat.bumpMap=m.bump;mat.bumpScale=m.bumpScale;}
     var planet=new T.Mesh(unit,mat);planet.scale.setScalar(b[3]);group.add(planet);group.rotation.z=b[0]==='uranus'?1.70:(b[0]==='saturn'?.46:.10);
     if((['band','earth','cloud'].indexOf(b[4])>=0||b[0]==='mars')){var air=new T.Mesh(unit,atmo(b[4]==='earth'?0x61bbff:b[2]));air.scale.setScalar(b[3]*1.055);group.add(air);}
     if(b[0]==='saturn'||b[0]==='uranus')group.add(rings(b[3],b[2]));
     if(b[4]==='sun'){var flare=new T.Sprite(new T.SpriteMaterial({map:glow,color:0xff9a2a,transparent:true,blending:T.AdditiveBlending,depthWrite:false}));flare.scale.setScalar(b[3]*5);group.add(flare);}
     if(b[4]==='comet'){var tail=new T.Mesh(new T.ConeGeometry(100,1100,16,1,true),new T.MeshBasicMaterial({color:0x76c9f4,transparent:true,opacity:.13,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending}));tail.position.set(0,450,150);tail.rotation.x=.45;group.add(tail);}
   }else if(b[4]==='probe'||i===0){
     var probe=new G.Merger();probe.part('box',0,0,0,10,8,7,0xc6a871);probe.part('cyl',0,8,0,13,2,13,0xd6dbe1,0,0,0,18);probe.bar(0,0,0,0,30,0,.6,0xb4bcc7);probe.part('box',-24,0,0,32,.6,12,0x1f4985);probe.part('box',24,0,0,32,.6,12,0x1f4985);group.add(new T.Mesh(probe.geometry(),G.matLit));group.position.set(-65,70,-s-75);
   }
   planets.push({root:group,globe:b[3]>0?planet:null,s:s});
   // ゲートは直線航路。左右・高度の両方を使う。
   for(j=0;j<3;j++){
     if(i===13&&j>0)break;
     var gs=s+j*SPACING/3,gx=j===0?0:Math.sin((i*3+j)*1.35)*46,gh=j===0?62:70+Math.sin(i*2+j*2.5)*35;
     gates.push({s:gs,x:gx,h:gh,lm:j===0?i:-1});
   }
 }
 // 星雲を小さな生成画像で描く。250の多層星空を単一の球面へ集約。
 var neb=document.createElement('canvas');neb.width=512;neb.height=256;var nc=neb.getContext('2d');nc.fillStyle='#020611';nc.fillRect(0,0,512,256);
 for(i=0;i<50;i++){var nx=rand()*512,ny=70+rand()*110,rad=30+rand()*70,ng=nc.createRadialGradient(nx,ny,0,nx,ny,rad);ng.addColorStop(0,i%2?'rgba(35,102,154,.10)':'rgba(94,45,145,.10)');ng.addColorStop(1,'rgba(0,0,0,0)');nc.fillStyle=ng;nc.fillRect(nx-rad,ny-rad,rad*2,rad*2);}
 var sky=new T.Mesh(new T.SphereGeometry(7000,24,16),new T.MeshBasicMaterial({map:new T.CanvasTexture(neb),side:T.BackSide,depthWrite:false,fog:false}));sky.renderOrder=-10;sky.frustumCulled=false;layer.add(sky);
 var count=hi?1900:900,pp=new Float32Array(count*3),cc=new Float32Array(count*3);
 for(i=0;i<count;i++){var a=rand()*TAU,y=rand()*2-1,k=Math.sqrt(1-y*y);pp[i*3]=Math.cos(a)*k*6000;pp[i*3+1]=y*6000;pp[i*3+2]=Math.sin(a)*k*6000;var br=.45+rand()*.55;cc[i*3]=br*(.65+rand()*.35);cc[i*3+1]=br*.85;cc[i*3+2]=br;}
 var starGeo=new T.BufferGeometry();starGeo.setAttribute('position',new T.BufferAttribute(pp,3));starGeo.setAttribute('color',new T.BufferAttribute(cc,3));
 var stars=new T.Points(starGeo,new T.PointsMaterial({size:9,vertexColors:true,map:glow,transparent:true,depthWrite:false,blending:T.AdditiveBlending,fog:false}));stars.frustumCulled=false;stars.renderOrder=-8;layer.add(stars);
 var ringMats={a:new T.MeshBasicMaterial({color:0x50d9fb,fog:false}),b:new T.MeshBasicMaterial({color:0x9290ff,fog:false}),next:new T.MeshBasicMaterial({color:0xffe14a,fog:false}),miss:new T.MeshBasicMaterial({color:0xb24651,transparent:true,opacity:.4,fog:false})};W.ringMats=ringMats;
 var ring=new T.TorusGeometry(14, .65,6,48),bigRing=new T.TorusGeometry(16,1.2,6,48);
 gates.forEach(function(g,idx){g.base=g.lm>=0?new T.MeshBasicMaterial({color:B[g.lm][2],fog:false}):(idx%2?ringMats.a:ringMats.b);g.mesh=new T.Mesh(g.lm>=0?bigRing:ring,g.base);g.mesh.position.set(g.x,g.h,-g.s);layer.add(g.mesh);g.pos=g.mesh.position.clone();});
 var rockGeo=new T.IcosahedronGeometry(1,1),rockMat=new T.MeshPhongMaterial({color:0x7b7777,flatShading:true,shininess:4}),nR=hi?100:60;
 var rocks=new T.InstancedMesh(rockGeo,rockMat,nR),matrix=new T.Matrix4(),rot=new T.Quaternion(),scale=new T.Vector3(),p=new T.Vector3();
 for(i=0;i<nR;i++){
   var zone=i<nR*.6?6:12,s=zone*SPACING+(rand()-.5)*750,x=(rand()-.5)*155,h=25+rand()*120,sz=3+rand()*6;
   // 名所ゲートの直前は空け、回避先を塞がない。
   if(Math.abs(s-zone*SPACING)<95)x=(x<0?-1:1)*(55+rand()*25);
   p.set(x,h,-s);scale.set(sz,sz*(.65+rand()*.5),sz*.8);rot.setFromEuler(new T.Euler(rand()*3,rand()*3,rand()*3));matrix.compose(p,rot,scale);rocks.setMatrixAt(i,matrix);obstacles.push({s:s,x:x,h:h,r:sz,hit:[],near:[]});
 }
 rocks.instanceMatrix.needsUpdate=true;rocks.frustumCulled=false;layer.add(rocks);
 W.data={LM:landmarks,lmS:lmS,gates:gates,FIN:FIN,L:FIN+100,place:place,frameAt:function(){}};
 W.controlK=1;W.dayK=0;W.starA=1;
 W.update=function(cam,t,px,dt,player){
   sky.position.copy(cam.position);stars.position.copy(cam.position);
   var ps=player?player.s:0;
   for(var k=0;k<planets.length;k++){var po=planets[k];po.root.visible=Math.abs(po.s-ps)<2300;if(po.root.visible)if(po.globe)po.globe.rotation.y+=dt*.018;}
   gates.forEach(function(g){g.mesh.visible=g.s>ps-40&&g.s<ps+1800;});
   rocks.visible=Math.abs(ps-6*SPACING)<1100||Math.abs(ps-12*SPACING)<1100;
   var zone=clamp(Math.round(ps/SPACING),0,13),grav=B[zone][5];W.controlK=grav>1.5?.85:(grav<.4?1.12:1);
   if(player)player.envHeat=zone>=2&&zone<=4?1.2:(zone>=7?.8:1);
 };
 W.obstacles=obstacles;
 W.physics=function(racers,dt,st,toast){
   for(var k=0;k<racers.length;k++){
     var r=racers[k];if(r.fin!=null)continue;
     for(var n=0;n<obstacles.length;n++){var o=obstacles[n];
       // 線分と隕石の最短距離。高速度でも点を飛び越して接触を見失わない。
       var ax=r.px-o.x,ay=r.ph0-o.h,az=r.ps-o.s,dx=r.x-r.px,dy=r.h-r.ph0,dz=r.s-r.ps;
       var ll=dx*dx+dy*dy+dz*dz,f=ll?clamp(-(ax*dx+ay*dy+az*dz)/ll,0,1):0;
       var cx=ax+dx*f,cy=ay+dy*f,cz=az+dz*f,d=Math.hypot(cx,cy,cz),radius=o.r+r.model.scale*.25;
       if(d<radius){
         if(o.hit[r.idx]!=null&&st.t-o.hit[r.idx]<.6)continue;o.hit[r.idx]=st.t;
         r.v*=.6;r.boost=Math.max(0,r.boost-15);
         var nl=Math.hypot(cx,cy)||1,nx=cx/nl,ny=cy/nl;if(Math.abs(cx)+Math.abs(cy)<.001){nx=r.x<o.x?-1:1;ny=0;}
         r.x=clamp(r.x+nx*(radius-d+1),-85,85);r.h=clamp(r.h+ny*(radius-d+1),18,165);
         if(r.isPlayer){r.vx+=nx*28;r.vy+=ny*28;toast('隕石に接触！',.7);}
       }else if(d<radius+7&&f>0&&f<1&&r.isPlayer&&o.near[r.idx]==null){o.near[r.idx]=st.t;r.boost=Math.min(100,r.boost+6);toast('ニアミス！ +BOOST',.6);}
     }
     if(r.ps<4*SPACING&&r.s>=4*SPACING){r.v+=28;r.boost=100;r.heat=Math.max(0,r.heat-40);if(r.isPlayer)toast('SOLAR SLINGSHOT！',1.2);}
   }
 };
 return W;
};
})();
