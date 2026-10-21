/* 327 背負いロケット グランプリ — ゲーム本体（操作・物理・レース・UI） */
(function(){'use strict';
var G=window.G, T=THREE, TAU=G.TAU, clamp=G.clamp;
var $=function(id){ return document.getElementById(id); };

/* ================= 設定・保存 (tg.327.*) ================= */
var KEY_SET='tg.327.settings', KEY_BEST='tg.327.best', KEY_TUT='tg.327.tutorial';
var DEF={vol:80,mute:false,sens:1.0,quality:'high',shake:true,pad:'std',cpu:'normal'};
function load(key,def){ try{ var v=localStorage.getItem(key); var parsed=v?JSON.parse(v):null; return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:JSON.parse(JSON.stringify(def)); }catch(e){ return JSON.parse(JSON.stringify(def)); } }
function save(key,v){ try{ localStorage.setItem(key,JSON.stringify(v)); }catch(e){} }
var S=load(KEY_SET,DEF); for(var k0 in DEF){ if(!(k0 in S)) S[k0]=DEF[k0]; }
var BEST=load(KEY_BEST,{earth:null,rank:null});

/* ================= iOS 拡大対策 ================= */
(function(){
  var lastEnd=0;
  document.addEventListener('touchend',function(e){ var n=Date.now(); if(n-lastEnd<=300) e.preventDefault(); lastEnd=n; },{passive:false});
  document.addEventListener('dblclick',function(e){ e.preventDefault(); });
  document.addEventListener('contextmenu',function(e){ e.preventDefault(); });
  ['gesturestart','gesturechange','gestureend'].forEach(function(t){ document.addEventListener(t,function(e){ e.preventDefault(); }); });
  document.addEventListener('touchmove',function(e){
    e.preventDefault();
  },{passive:false});
})();

/* ================= 定数 ================= */
var C={
  V0:100, VBOOST:2.05, ACCEL:2.4, YAW_MAX:0.6, PIT_MAX:0.5, LEAN:5,
  LAT_MAX:85, H_MIN:18, H_MAX:165, H0:62,
  BOOST_DRAIN:35, BOOST_REGEN:8, HEAT_UP:40, HEAT_DOWN:25, STALL_T:1.5, STALL_V:0.5,
  GATE_R:14.5, GATE_RL:16, GATE_BOOST:20, GATE_BOOST_LM:40, GATE_HEAT:-15, GATE_KICK:3.2, GATE_MISS:0.93,
  DRAFT_MAX:0.06, DRAFT_LEN:46, DRAFT_W:7, DRAFT_H:9
};
var CPU_MUL={easy:0.95,normal:0.975,hard:1.005}, CPU_AIM={easy:0.85,normal:1.0,hard:1.04};

/* ================= 3D ================= */
var stage=$('stage'), cvHost=$('cv');
var renderer;
try{ renderer=new T.WebGLRenderer({antialias:false,powerPreference:'high-performance'}); }catch(e){ document.body.innerHTML='<p style="padding:30px">このブラウザでは3Dが使えません</p>'; return; }
cvHost.appendChild(renderer.domElement);
// ソフトウェア描画（GPUなし）と分かったら最初から解像度を下げる
try{ var gl0=renderer.getContext(), dbg0=gl0.getExtension('WEBGL_debug_renderer_info'); if(dbg0&&/swiftshader|llvmpipe|software/i.test(String(gl0.getParameter(dbg0.UNMASKED_RENDERER_WEBGL)))) window.__softGL=true; }catch(e){}
var scene=new T.Scene(); scene.background=new T.Color(0x05070f);
var cam=new T.PerspectiveCamera(62,1,0.5,9800); scene.add(cam);
var W=null, exhaust=null, course='earth', earthState=null, earthWorld=null, spaceWorld=null;
var earthLayer=new T.Group(), spaceLayer=new T.Group(); scene.add(earthLayer); scene.add(spaceLayer); spaceLayer.visible=false;
var racers=[], player=null, GATES=[];

/* 速度線（カメラに付ける） */
var NL=42, slPos=new Float32Array(NL*6), slX=new Float32Array(NL), slY=new Float32Array(NL), slZ=new Float32Array(NL);
var slGeo=new T.BufferGeometry(); slGeo.setAttribute('position',new T.BufferAttribute(slPos,3));
var slMat=new T.LineBasicMaterial({color:0xcfe8ff,transparent:true,opacity:0,depthWrite:false,fog:false});
var speedLines=new T.LineSegments(slGeo,slMat); speedLines.frustumCulled=false; speedLines.renderOrder=7; cam.add(speedLines);
(function(){ var r=G.rng(5); for(var i=0;i<NL;i++){ var a=r()*TAU, d=2.2+r()*9; slX[i]=Math.cos(a)*d*1.5; slY[i]=Math.sin(a)*d*0.9; slZ[i]=-(4+r()*56); } })();

/* ================= 状態 ================= */
var st={mode:'title',t:0,countdown:0,resumeFrom:false,orbitK:1,orbitA:0,finishT:0,shake:0,fov:62,toastT:0,lmT:0,lastToast:-9,tagT:0,
        tickN:0,passT:-9,warnT:0,prScale:window.__softGL?0.5:1,goodSec:0,pxScale:2,hudAcc:0,stdAcc:0,camInit:false,rank:1,finRank:0,wallT:0};
var inp={l:false,r:false,u:false,d:false,b:false,ax:0,ay:0}, held={}, kbd={l:false,r:false,u:false,d:false,b:false};
var camPos=new T.Vector3(), camLook=new T.Vector3();
var vP=new T.Vector3(), vUp=new T.Vector3(), vF=new T.Vector3(), vR=new T.Vector3(), vT=new T.Vector3(), vC=new T.Vector3(), vU2=new T.Vector3(), vN=new T.Vector3(), vA=new T.Vector3(), vB=new T.Vector3(), vD=new T.Vector3();
var mB=new T.Matrix4();

/* ================= ユーティリティ ================= */
function fmt(t){ var m=Math.floor(t/60), s=t-m*60; return m+':'+(s<10?'0':'')+s.toFixed(1); }

/* ================= 音 (Web Audio 合成) ================= */
var AC=null, master=null, eng=null, engG=null, engF=null, wnd=null, wndG=null;
function audioInit(){
  if(AC) return;
  try{
    var Ctx=window.AudioContext||window.webkitAudioContext; if(!Ctx) return;
    AC=new Ctx(); master=AC.createGain(); master.connect(AC.destination); applyVol();
    var len=AC.sampleRate*2, buf=AC.createBuffer(1,len,AC.sampleRate), d=buf.getChannelData(0);
    for(var i=0;i<len;i++) d[i]=Math.random()*2-1;
    eng=AC.createBufferSource(); eng.buffer=buf; eng.loop=true;
    engF=AC.createBiquadFilter(); engF.type='bandpass'; engF.frequency.value=500; engF.Q.value=0.9;
    engG=AC.createGain(); engG.gain.value=0; eng.connect(engF); engF.connect(engG); engG.connect(master); eng.start();
    wnd=AC.createBufferSource(); wnd.buffer=buf; wnd.loop=true; var wf=AC.createBiquadFilter(); wf.type='highpass'; wf.frequency.value=1800;
    wndG=AC.createGain(); wndG.gain.value=0; wnd.connect(wf); wf.connect(wndG); wndG.connect(master); wnd.start();
  }catch(e){ AC=null; }
}
function unlock(){ audioInit(); if(AC&&AC.state==='suspended'){ try{AC.resume();}catch(e){} } }
function applyVol(){ if(master) master.gain.value=S.mute?0:S.vol/100*0.8; }
function beep(f0,f1,dur,type,vol,delay){
  if(!AC||S.mute) return;
  var t=AC.currentTime+(delay||0), o=AC.createOscillator(), g=AC.createGain();
  o.type=type||'sine'; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
  g.gain.setValueAtTime(vol||0.25,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t+dur+0.02);
}
function engineSound(){
  if(!AC||!engG) return;
  var run=(st.mode==='race'||st.mode==='ready'||st.mode==='finish')&&player;
  var sp=run?Math.min(1.8,player.v/C.V0):0, b=run&&player.boosting;
  engG.gain.setTargetAtTime(run?(0.16+0.2*sp+(b?0.25:0)):0,AC.currentTime,0.05);
  engF.frequency.setTargetAtTime(350+500*sp+(b?600:0),AC.currentTime,0.05);
  wndG.gain.setTargetAtTime(run?Math.min(0.2,sp*sp*0.07):0,AC.currentTime,0.1);
}
var sfx={
  gate:function(){ beep(660,990,0.18,'sine',0.22); },
  lm:function(){ beep(523,523,0.14,'triangle',0.25); beep(659,659,0.14,'triangle',0.25,0.12); beep(784,1047,0.35,'triangle',0.28,0.24); },
  pass:function(){ beep(500,900,0.12,'square',0.1); },
  passed:function(){ beep(420,260,0.18,'square',0.09); },
  hot:function(){ beep(300,80,0.6,'sawtooth',0.25); },
  wall:function(){ beep(160,90,0.15,'square',0.12); },
  count:function(){ beep(440,440,0.12,'square',0.15); },
  go:function(){ beep(880,880,0.3,'square',0.2); },
  fin:function(){ [523,659,784,1047].forEach(function(f,i){ beep(f,f,0.22,'triangle',0.28,i*0.16); }); },
  start:function(){ beep(300,1200,0.5,'sawtooth',0.14); }
};

/* ================= HUD ================= */
var hRank=$('hRank'), hTime=$('hTime'), hGate=$('hGate'), gBoost=$('gBoost'), gHeat=$('gHeat'), gHeatBox=$('gHeatBox'), hSpd=$('hSpd'), toast=$('toast'),
    stand=$('stand'), strip=$('strip'), lmName=$('lmName'), tag=$('tag'), gArrow=$('gArrow');
function showToast(msg,sec,force){
  if(!force&&st.t-st.lastToast<0.5&&st.mode==='race') { /* 連続メッセージは最新を優先 */ }
  toast.textContent=msg; toast.classList.add('on'); st.toastT=sec||1.2; st.lastToast=st.t;
}
function showLm(name,sub){ lmName.firstElementChild.textContent=name; lmName.lastElementChild.textContent=sub; lmName.classList.add('on'); st.lmT=2.4; }
var stripDots=[], stripTicks=[];
function buildStrip(){
  strip.innerHTML=''; stripDots=[]; stripTicks=[];
  var i, el;
  for(i=0;i<G.LM.length;i++){ el=document.createElement('div'); el.className='tick'; el.style.left=Math.max(0,G.lmS[i])/G.FIN*100+'%'; strip.appendChild(el); stripTicks.push(el); }
  for(i=racers.length-1;i>=0;i--){ el=document.createElement('div'); el.className='dot'+(racers[i].isPlayer?' me':''); el.style.background=racers[i].spec.color; strip.appendChild(el); stripDots[i]=el; }
}
function orderRacers(){
  return racers.slice().sort(function(a,b){
    if(a.fin!=null&&b.fin!=null) return a.fin-b.fin; if(a.fin!=null) return -1; if(b.fin!=null) return 1; return b.s-a.s;
  });
}
function hud(){
  var p=player, ord=orderRacers(), rk=ord.indexOf(p)+1; if(p.fin!=null&&st.finRank) rk=st.finRank; st.rank=rk;
  hRank.innerHTML=rk+'<small>/'+racers.length+'位</small>';
  hTime.textContent=fmt(Math.max(0,st.t)); hGate.textContent='ゲート '+p.gates+'/'+GATES.length;
  gBoost.style.transform='scaleX('+(p.boost/100).toFixed(3)+')';
  gHeat.style.transform='scaleX('+Math.min(1,p.heat/100).toFixed(3)+')'; gHeatBox.classList.toggle('hot',p.heat>75||p.stall>0); gHeatBox.classList.toggle('lock',p.lock);
  hSpd.textContent=Math.round(p.v)+' m/s　高さ '+Math.round(p.h)+'m';
  for(var i=0;i<racers.length;i++){ if(stripDots[i]) stripDots[i].style.left=(clamp(racers[i].s/G.FIN,0,1)*100).toFixed(1)+'%'; }
  for(i=0;i<stripTicks.length;i++) stripTicks[i].classList.toggle('on',!!p.lmHit[i]);
  // 順位表（先頭・前後・自分）
  var pick=[0], pi=ord.indexOf(p); [pi-2,pi-1,pi,pi+1].forEach(function(q){ if(q>=0&&q<ord.length&&pick.indexOf(q)<0) pick.push(q); });
  var h='';
  pick.forEach(function(q){ var r=ord[q]; h+='<div class="'+(r.isPlayer?'me':'')+'"><span>'+(q+1)+'</span><i style="background:'+r.spec.color+'"></i>'+r.spec.name+'</div>'; });
  stand.innerHTML=h;
}
var warn=$('warn');
function flashWarn(sec){ st.warnT=Math.max(st.warnT,sec); warn.style.opacity=0.9; }
function setTag(msg){ tag.textContent=msg; tag.classList.toggle('on',!!msg); }

/* ================= レーサー ================= */
function makeRacer(spec,idx){
  var r={spec:spec,idx:idx,isPlayer:!!spec.player,ai:spec.ai,model:G.buildModel(spec),
    s:0,ps:0,x:0,h:C.H0,vx:0,vy:0,yaw:0,pit:0,yawCmd:0,pitCmd:0,v:0,boost:100,heat:0,stall:0,boosting:false,bOn:false,
    gi:0,gates:0,misses:0,lock:false,fin:null,draft:0,rb:1,aim:new Uint8Array(64),lmHit:[],sinceGate:9,ph:idx*1.7,stalls:0,envHeat:1,wall:0,preBoost:-1,lastAhead:false,tx:0};
  scene.add(r.model.root); return r;
}
var GRID_ORDER=['zero9','garnet','daigoro','kagemaru','mint','volt','hanabi','pen','sora','bat','comet'];
function resetRacers(){
  var rnd=G.rng((Date.now()&0xffff)+7), diff=CPU_AIM[S.cpu]||1, i, r;
  for(i=0;i<racers.length;i++){
    r=racers[i]; var pos=GRID_ORDER.indexOf(r.spec.id), row=Math.floor(pos/3), col=pos%3;
    r.s=-62-row*15; r.ps=r.s; r.x=(col-1)*15+(row%2?5:0); r.h=C.H0+(col===1?4:0); r.yaw=r.pit=r.yawCmd=r.pitCmd=0; r.v=0; r.boost=100; r.heat=0; r.stall=0; r.boosting=false; r.bOn=false;
    r.gi=0; r.gates=0; r.misses=0; r.lock=false; r.fin=null; r.draft=0; r.rb=1; r.lmHit=[]; r.sinceGate=9; r.stalls=0; r.wall=0; r.preBoost=-1; r.lastAhead=false;
    r.envHeat=1; r.vx=r.vy=0;
    for(var g=0;g<GATES.length;g++) r.aim[g]=(rnd()<Math.min(1,r.ai.aim*(r.isPlayer?1:diff)))?1:0;
    r.startPos=pos;
  }
  for(i=0;i<GATES.length;i++){ var gm=GATES[i]; gm.mesh.visible=true; gm.mesh.material=gm.base; }
  st.finRank=0;
}
function stepRacer(r,dt,P){
  if(r.lock&&r.heat<28) r.lock=false;
  var boosting=r.bOn&&r.boost>0&&r.stall<=0&&!r.lock; r.boosting=boosting;
  if(boosting){ r.boost=Math.max(0,r.boost-C.BOOST_DRAIN*dt); r.heat+=C.HEAT_UP*r.ai.heat*r.envHeat*dt; }
  else { r.boost=Math.min(100,r.boost+C.BOOST_REGEN*dt); r.heat=Math.max(0,r.heat-C.HEAT_DOWN*dt); }
  if(r.stall>0){ r.stall-=dt; if(r.stall<=0){ if(r.isPlayer) showToast('復帰  ねつが下がるまで BOOST は使えない',1.4); } }
  else if(r.heat>=100){ r.stall=C.STALL_T; r.heat=100; r.lock=true; r.stalls++; if(r.isPlayer){ showToast('オーバーヒート！',1.2); sfx.hot(); flashWarn(0.6); } else if(r.idx&&dist2Player(r)<260){ /* 目の前でのトラブルは音だけ */ } }
  var mul=r.isPlayer?1:(CPU_MUL[S.cpu]||1);
  var vt=C.V0*r.ai.vMul*mul*(boosting?C.VBOOST:1)*(r.stall>0?C.STALL_V:1)*(1+r.draft)*r.rb;
  r.v+=(vt-r.v)*Math.min(1,C.ACCEL*r.ai.accel*dt);
  var k=Math.min(1,C.LEAN*dt); r.yaw+=(r.yawCmd-r.yaw)*k; r.pit+=(r.pitCmd-r.pit)*k;
  var cp=Math.cos(r.pit);
  r.ps=r.s;r.px=r.x;r.ph0=r.h;
  if(r.isPlayer){
    var factor=S.sens*(course==='space'?(W.controlK||1):1), tx=inp.ax*70*factor, ty=inp.ay*60*factor;
    var rateX=tx===0?22:(tx*r.vx<0?26:18), rateY=ty===0?22:(ty*r.vy<0?26:18);
    r.vx+=(tx-r.vx)*(1-Math.exp(-rateX*dt)); r.vy+=(ty-r.vy)*(1-Math.exp(-rateY*dt));
    r.x+=r.vx*dt; r.h+=r.vy*dt; r.s+=r.v*dt;
  } else { r.s+=r.v*Math.cos(r.yaw)*cp*dt; r.x+=r.v*Math.sin(r.yaw)*cp*dt; r.h+=r.v*Math.sin(r.pit)*dt; }
  r.wall=0;
  if(r.x>C.LAT_MAX){ r.x=C.LAT_MAX; if(!r.isPlayer) r.v*=1-1.2*dt; if(r.yaw>0) r.yaw=0; r.wall=1; } else if(r.x<-C.LAT_MAX){ r.x=-C.LAT_MAX; if(!r.isPlayer) r.v*=1-1.2*dt; if(r.yaw<0) r.yaw=0; r.wall=1; }
  if(r.h>C.H_MAX){ r.h=C.H_MAX; if(!r.isPlayer) r.v*=1-1.2*dt; if(r.pit>0) r.pit=0; r.wall=1; } else if(r.h<C.H_MIN){ r.h=C.H_MIN; if(!r.isPlayer) r.v*=1-1.2*dt; if(r.pit<0) r.pit=0; r.wall=1; }
  r.sinceGate+=dt;
}
function dist2Player(r){ return Math.abs(r.s-player.s); }
function checkGate(r){
  var g=GATES[r.gi];
  while(g&&r.ps<g.s&&r.s>=g.s){
    var f=clamp((g.s-r.ps)/Math.max(.0001,r.s-r.ps),0,1),dx=r.px+(r.x-r.px)*f-g.x, dy=r.ph0+(r.h-r.ph0)*f-g.h, rad=g.lm>=0?C.GATE_RL:C.GATE_R, ok=dx*dx+dy*dy<rad*rad;
    if(ok){
      r.gates++; r.sinceGate=0; r.boost=Math.min(100,r.boost+(g.lm>=0?C.GATE_BOOST_LM:C.GATE_BOOST)); r.heat=Math.max(0,r.heat+C.GATE_HEAT); r.v+=C.GATE_KICK*(g.lm>=0?1.6:1);
      if(g.lm>=0) r.lmHit[g.lm]=true;
      if(r.isPlayer){ g.mesh.visible=false; if(g.lm>=0){ sfx.lm(); showLm(G.LM[g.lm].name,G.LM[g.lm].sub); } else sfx.gate(); }
    } else { r.v*=C.GATE_MISS; r.misses++; if(r.isPlayer){ flashWarn(0.35); } }
    if(!ok&&r.isPlayer){ g.mesh.material=W.ringMats.miss; if(g.lm>=0){ g.mesh.material=W.ringMats.miss; showLm(G.LM[g.lm].name,'通過ならず…'); } }
    r.gi++; g=GATES[r.gi];
    if(r.isPlayer){ if(g) g.mesh.material=W.ringMats.next; }
  }
}
function neighbors(){
  var i, j, a, b;
  for(i=0;i<racers.length;i++){ a=racers[i]; a.draft=0; }
  for(i=0;i<racers.length;i++){
    a=racers[i]; if(a.fin!=null) continue;
    for(j=0;j<racers.length;j++){
      if(i===j) continue; b=racers[j];
      var ds=b.s-a.s; if(ds<5||ds>C.DRAFT_LEN) continue;
      if(Math.abs(b.x-a.x)>C.DRAFT_W||Math.abs(b.h-a.h)>C.DRAFT_H) continue;
      var d=C.DRAFT_MAX*(1-ds/C.DRAFT_LEN); if(d>a.draft) a.draft=d;
    }
  }
}
function rubber(r){
  if(!r.ai.rubber||r.isPlayer){ r.rb=1; return; }
  var gap=player.s-r.s; // プレイヤーが先なら正
  r.rb=gap>0?1+clamp(gap/420,0,1)*0.03:1;
}

/* 高速接触: 前フレームからの相対線分を、人の幅と前後長を持つ楕円体で判定。 */
var contactTimes={};
function racerContacts(){
  for(var i=0;i<racers.length;i++)for(var j=i+1;j<racers.length;j++){
    var a=racers[i],b=racers[j];if(a.fin!=null||b.fin!=null)continue;
    var width=(a.model.scale+b.model.scale)*.25,long=(a.model.scale+b.model.scale)*.95;
    var x=(a.px-b.px)/width,y=(a.ph0-b.ph0)/width,z=(a.ps-b.ps)/long;
    var dx=((a.x-a.px)-(b.x-b.px))/width,dy=((a.h-a.ph0)-(b.h-b.ph0))/width,dz=((a.s-a.ps)-(b.s-b.ps))/long;
    var vv=dx*dx+dy*dy+dz*dz,t=vv?clamp(-(x*dx+y*dy+z*dz)/vv,0,1):0;
    if(Math.pow(x+dx*t,2)+Math.pow(y+dy*t,2)+Math.pow(z+dz*t,2)>1)continue;
    var key=i+':'+j;if(st.t-(contactTimes[key]||-100)<.4)continue;contactTimes[key]=st.t;
    var nx=a.x-b.x,ny=a.h-b.h,len=Math.hypot(nx,ny);if(len<.001){nx=i%2?1:-1;ny=.2;len=Math.hypot(nx,ny);}nx/=len;ny/=len;
    var push=Math.max(.6,width-len)*.55;
    a.x=clamp(a.x+nx*push,-C.LAT_MAX,C.LAT_MAX);b.x=clamp(b.x-nx*push,-C.LAT_MAX,C.LAT_MAX);
    a.h=clamp(a.h+ny*push,C.H_MIN,C.H_MAX);b.h=clamp(b.h-ny*push,C.H_MIN,C.H_MAX);
    if(a.isPlayer){a.vx+=nx*18;a.vy+=ny*18;}if(b.isPlayer){b.vx-=nx*18;b.vy-=ny*18;}
    if(a.ps<b.ps){a.v*=.84;if(a.s>b.s)a.s=b.s-long*.55;}
    else{b.v*=.84;if(b.s>a.s)b.s=a.s-long*.55;}
    if(a.isPlayer||b.isPlayer){showToast('接触！',.55);flashWarn(.22);sfx.wall();}
  }
}
/* ================= シミュレーション ================= */
var STEP=1/60, acc=0;
function playerInput(){
  var dirx=inp.ax, diry=inp.ay;
  player.yawCmd=dirx*C.YAW_MAX*S.sens; player.pitCmd=diry*C.PIT_MAX*S.sens; player.bOn=inp.b;
}
function startGo(){
  st.mode='race'; if(st.resumeFrom){ st.resumeFrom=false; return; } showToast('GO!',0.8,true); sfx.go(); sfx.start();
  racers.forEach(function(r){
    if(r.isPlayer){
      if(st.resumeFrom){ return; }
      if(r.preBoost<0) r.v=C.V0*0.6;
      else if(r.preBoost<=0.75){ r.v=C.V0*0.95; r.boost=Math.min(100,r.boost+10); showToast('ロケットスタート！',1.2,true); }
      else { r.stall=0.9; r.v=C.V0*0.45; showToast('フライング！',1.2,true); }
    } else r.v=C.V0*(0.5+0.4*r.ai.startQ*(0.85+Math.random()*0.15));
  });
  st.resumeFrom=false;
}
function step(dt){
  var i, r;
  if(st.mode==='ready'){
    var prev=Math.ceil(st.countdown); st.countdown-=dt; var cur=Math.ceil(st.countdown);
    if(cur!==prev&&cur>0){ showToast(String(cur),0.9,true); sfx.count(); }
    if(!st.resumeFrom&&player.preBoost<0&&inp.b) player.preBoost=Math.max(0,st.countdown);
    if(st.countdown<=0) startGo();
    st.orbitK=clamp(st.countdown/3.2,0,1)*(st.resumeFrom?0:1); st.orbitA=Math.PI*0.92*st.orbitK*st.orbitK;
    return;
  }
  if(st.mode!=='race'&&st.mode!=='finish') return;
  st.t+=dt;
  for(i=0;i<racers.length;i++){ r=racers[i]; if(r.fin==null){ if(r.isPlayer) playerInput(); else { rubber(r); G.aiSteer(r,GATES,null,C.YAW_MAX,C.PIT_MAX); G.aiBoost(r,st.t,r.s/G.FIN); } } }
  neighbors();
  for(i=0;i<racers.length;i++){
    r=racers[i];
    if(r.fin!=null){ r.yawCmd=0; r.pitCmd=0; r.bOn=false; r.ai=r.ai; }
    stepRacer(r,dt);
    if(r.fin==null){
      checkGate(r);
      if(r.s>=G.FIN){ r.fin=st.t-(r.s-G.FIN)/Math.max(1,(r.s-r.ps)/dt); }
    }
  }
  if(st.mode==='race')racerContacts();
  if(player.fin!=null&&st.mode==='race') onPlayerFinish();
  if(course==='space'&&W.physics&&st.mode==='race') W.physics(racers,dt,st,showToast);
  // 抜いた・抜かれた
  for(i=1;i<racers.length;i++){
    r=racers[i]; var ahead=r.s>player.s;
    if(st.mode==='race'&&ahead!==r.lastAhead&&st.t>3){
      if(!ahead){ if(st.t-st.passT>2.5){ showToast(r.spec.name+'を抜いた！',0.9); st.passT=st.t; } sfx.pass(); } else if(Math.abs(r.s-player.s)<30) { sfx.passed(); }
    }
    r.lastAhead=ahead;
  }
  if(player.wall&&st.t-st.wallT>0.8){ st.wallT=st.t; sfx.wall(); flashWarn(0.3); }
  st.shake=player.boosting?1:Math.max(0,st.shake-dt*4);
  if(st.mode==='finish'){ st.finishT+=dt; if(st.finishT>2.6) showResult(); }
}
function onPlayerFinish(){
  var ord=orderRacers(); st.finRank=ord.indexOf(player)+1;
  st.mode='finish'; st.finishT=0; sfx.fin(); showToast(st.finRank===1?'優勝！！':'ゴール！ '+st.finRank+'位',2.4,true); setTag('');
}

/* ================= 結果 ================= */
function showResult(){
  st.mode='result';
  var ord=orderRacers(), rk=ord.indexOf(player)+1, t=player.fin;
  var timeKey=course==='earth'?'earth':'space', rankKey=course==='earth'?'rank':'spaceRank';
  var isBest=(BEST[timeKey]==null||t<BEST[timeKey]); if(isBest) BEST[timeKey]=t;
  var rankBest=(BEST[rankKey]==null||rk<BEST[rankKey]); if(rankBest) BEST[rankKey]=rk; save(KEY_BEST,BEST);
  $('rTitle').textContent=rk===1?'🏆 優勝！':'ゴール！ '+rk+'位';
  var win=ord[0];
  $('tRes').innerHTML='タイム　<b>'+fmt(t)+'</b>'+(isBest?'　★ベスト更新':'')+'<br>ゲート '+player.gates+' / '+GATES.length+'　オーバーヒート '+player.stalls+'回<br><span style="font-size:13px;opacity:.9">'+win.spec.name+'「'+win.spec.line+'」</span>';
  var sh='', i;
  for(i=0;i<G.LM.length;i++) sh+='<span class="'+(player.lmHit[i]?'on':'')+'">'+(player.lmHit[i]?'✔ ':'')+G.LM[i].name+'</span>';
  $('stamps').innerHTML=sh;
  var lh='';
  ord.forEach(function(r,q){ var tm=r.fin!=null?fmt(r.fin):'—'; lh+='<div class="'+(r.isPlayer?'me':'')+'">'+(q+1)+'. '+r.spec.name+'　'+tm+'</div>'; });
  $('rList').innerHTML=lh;
  show('sRes'); refreshBest();
}

/* ================= 画面遷移 ================= */
var screens=['sTitle','sRoster','sPause','sSet','sRes'];
function show(id){ screens.forEach(function(s){ $(s).classList.toggle('on',s===id); }); }
var setReturn='sTitle';
function setFull(f){ document.body.classList.toggle('full',f); resize(); }
function toTitle(){ st.toastT=0; toast.classList.remove('on'); lmName.classList.remove('on'); setTag(''); st.mode='title'; setFull(true); show('sTitle'); resetRacers(); refreshBest(); st.t=0; lastPlace(); }
function openRoster(){ show('sRoster'); makePortraits(); }
function startRace(){
  if(window.innerHeight>window.innerWidth) return;
  unlock(); contactTimes={};if(fcController)fcController.reset(); for(var id in held)delete held[id];for(var key in kbd)kbd[key]=false;recalc(); resetRacers(); st.t=0; st.shake=0; st.camInit=false; st.resumeFrom=false; st.finRank=0;
  setFull(false); show(null);
  GATES[0].mesh.material=W.ringMats.next;
  st.mode='ready'; st.countdown=3.99; st.orbitK=1; save(KEY_TUT,true);
  setTag('BOOSTを “1” のところで押すと ロケットスタート！');
  setTimeout(function(){ if(st.mode==='race') setTag(''); },100);
  st.tagT=7; hud();
}
function lastPlace(){ /* タイトル時: 全員を待機位置に置いて描画 */ }
function pause(){
  if(fcController)fcController.reset();
  if(st.mode!=='race'&&st.mode!=='ready') return;
  st.pausedFrom=st.mode; st.mode='paused'; show('sPause'); if(AC&&AC.state==='running'){ try{AC.suspend();}catch(e){} }
  for(var k in held) delete held[k]; kbd.l=kbd.r=kbd.u=kbd.d=kbd.b=false; recalc();
}
function resume(){ unlock(); show(null); st.mode='ready'; st.countdown=2.99; st.resumeFrom=st.pausedFrom!=='ready'; }
function refreshBest(){ var t=course==='earth'?BEST.earth:BEST.space, r=course==='earth'?BEST.rank:BEST.spaceRank; $('tBest').textContent=t!=null?'ベスト '+fmt(t)+(r?'　最高 '+r+'位':''):''; }

/* コースの世界とデータを切り替える。機体と操作・物理は共有。 */
function setCourse(id){
  if(!earthState||st.mode!=='title')return;
  if(id==='space'&&!spaceWorld)spaceWorld=G.buildSpace(spaceLayer,renderer,S.quality);
  course=id; var data=id==='earth'?earthState:spaceWorld.data;
  Object.keys(data).forEach(function(k){G[k]=data[k];});
  W=id==='earth'?earthWorld:spaceWorld;GATES=G.gates;if(window.__game)window.__game.gates=GATES;
  earthLayer.visible=id==='earth';spaceLayer.visible=id==='space';scene.fog=id==='earth'?earthLayer.fog:spaceLayer.fog;
  $('cEarth').classList.toggle('chosen',id==='earth');$('cSpace').classList.toggle('chosen',id==='space');
  $('rosterTitle').textContent='出走表 — '+(id==='earth'?'地球一周':'地球 → 冥王星')+' —';
  resetRacers();buildStrip();st.camInit=false;refreshBest();hud();
}

/* ================= 入力 ================= */
var padBtns=[], padRects=null;
function syncBtns(){
  ['l','r','u','d'].forEach(function(k){ $({l:'bL',r:'bR',u:'bU',d:'bD'}[k]).classList.toggle('on',inp[k]); });
  $('bBoost').classList.toggle('on',inp.b);
}
function recalc(){
  var ax=0,ay=0,b=false;
  for(var id in held){ var ks=held[id]; if(ks.b) b=true; if(ks.ax!=null){ ax=ks.ax; ay=ks.ay; } }
  if(kbd.l||kbd.r) ax=(kbd.r?1:0)-(kbd.l?1:0);
  if(kbd.u||kbd.d) ay=(kbd.u?1:0)-(kbd.d?1:0);
  var len=Math.sqrt(ax*ax+ay*ay); if(len>1){ax/=len;ay/=len;}
  inp.ax=ax;inp.ay=ay; inp.l=ax<-.1;inp.r=ax>.1;inp.u=ay>.1;inp.d=ay<-.1;inp.b=b||kbd.b;
  var pad=$('dpad');pad.style.setProperty('--tx',(ax*23)+'px');pad.style.setProperty('--ty',(-ay*23)+'px');syncBtns();
}
function calcRects(){ var b=$('dpad').getBoundingClientRect(); padRects={cx:b.left+b.width/2,cy:b.top+b.height/2,rx:b.width*.38,ry:b.height*.40}; }
function padHit(e){
  if(!padRects) calcRects(); var x=(e.clientX-padRects.cx)/padRects.rx,y=(padRects.cy-e.clientY)/padRects.ry;
  var len=Math.sqrt(x*x+y*y); if(len<.10)return {ax:0,ay:0};
  var k=Math.min(1,(len-.10)/.65)/len;return {ax:x*k,ay:y*k};
}
var fcController=null;
function bindPad(){
  // 共通FC iOS Controllerを転用。327は連続8方向とBOOSTへ割り当てる。
  fcController=window.initFcIosController({
    dpadWrapId:'dpad',dpadId:'dpad',buttons:{bBoost:['Space']},keyboard:false,
    enabled:function(){return st.mode==='race'||st.mode==='ready';},onInteract:unlock,
    onChange:function(keys){held.fc={ax:+keys.AxisX||0,ay:+keys.AxisY||0,b:!!keys.Space};recalc();}
  });
  window.addEventListener('resize',function(){fcController.reset();padRects=null;});
}
window.addEventListener('keydown',function(e){
  unlock(); var c=e.code;
  if(c==='ArrowLeft'||c==='KeyA') kbd.l=true; else if(c==='ArrowRight'||c==='KeyD') kbd.r=true;
  else if(c==='ArrowUp'||c==='KeyW') { kbd.u=true; e.preventDefault(); } else if(c==='ArrowDown'||c==='KeyS') { kbd.d=true; e.preventDefault(); }
  else if(c==='Space'||c==='ShiftLeft'){ kbd.b=true; e.preventDefault(); }
  else if(c==='Escape'){ if(st.mode==='paused') resume(); else pause(); }
  recalc();
});
window.addEventListener('keyup',function(e){
  var c=e.code;
  if(c==='ArrowLeft'||c==='KeyA') kbd.l=false; else if(c==='ArrowRight'||c==='KeyD') kbd.r=false; else if(c==='ArrowUp'||c==='KeyW') kbd.u=false; else if(c==='ArrowDown'||c==='KeyS') kbd.d=false; else if(c==='Space'||c==='ShiftLeft') kbd.b=false;
  recalc();
});
document.addEventListener('visibilitychange',function(){ if(document.hidden) pause(); });
window.addEventListener('blur',function(){for(var id in held)delete held[id];for(var k in kbd)kbd[k]=false;recalc();pause();});
function tap(id,fn){ $(id).addEventListener('pointerup',function(e){ e.preventDefault(); unlock(); fn(); }); }
tap('cEarth',function(){setCourse('earth');}); tap('cSpace',function(){setCourse('space');});
tap('bStart',openRoster); tap('bRBack',function(){ show('sTitle'); });
tap('bGo',startRace); tap('bAgain',startRace);
tap('bSet1',function(){ setReturn='sTitle'; show('sSet'); });
tap('bSet2',function(){ setReturn='sPause'; show('sSet'); });
tap('bSetBack',function(){ save(KEY_SET,S); show(setReturn); });
tap('bResume',resume); tap('bRetry',startRace);
tap('bToTitle',toTitle); tap('bToTitle2',toTitle);
tap('bPause',function(){ if(st.mode==='race'||st.mode==='ready') pause(); });
function toggleMute(){ S.mute=!S.mute; save(KEY_SET,S); applyVol(); muteIcon(); }
tap('bMute',toggleMute); tap('bMute0',toggleMute);
function muteIcon(){ $('bMute').textContent=$('bMute0').textContent=S.mute?'🔇':'🔊'; }
function bindSettings(){
  $('iVol').value=S.vol; $('iSens').value=S.sens; $('iQual').value=S.quality; $('iShake').value=S.shake?'1':'0'; $('iPad').value=S.pad; $('iCpu').value=S.cpu;
  $('iVol').addEventListener('input',function(){ S.vol=+this.value; applyVol(); save(KEY_SET,S); });
  $('iSens').addEventListener('input',function(){ S.sens=+this.value; save(KEY_SET,S); });
  $('iCpu').addEventListener('change',function(){ S.cpu=this.value; save(KEY_SET,S); });
  $('iQual').addEventListener('change',function(){ S.quality=this.value; save(KEY_SET,S); resize(); });
  $('iShake').addEventListener('change',function(){ S.shake=this.value==='1'; save(KEY_SET,S); });
  $('iPad').addEventListener('change',function(){ S.pad=this.value; save(KEY_SET,S); document.body.classList.toggle('inner',S.pad==='inner'); padRects=null; });
  document.body.classList.toggle('inner',S.pad==='inner');
  muteIcon(); refreshBest();
}

/* ================= 出走表 ================= */
var portraitsDone=false,rosterPage=0;
function showRosterPage(n){
  rosterPage=(n+G.ROSTER.length)%G.ROSTER.length;
  var cards=$('rosterBox').children;
  for(var i=0;i<cards.length;i++)cards[i].hidden=i!==rosterPage;
  $('rosterCount').textContent=(rosterPage+1)+' / '+G.ROSTER.length;
}
tap('bRPrev',function(){showRosterPage(rosterPage-1);});
tap('bRNext',function(){showRosterPage(rosterPage+1);});
function stars(n){ var s=''; for(var i=0;i<5;i++) s+=i<n?'★':'☆'; return s; }
function buildRoster(){
  var h='';
  G.ROSTER.forEach(function(sp,i){
    h+='<div class="card'+(sp.player?' me':'')+'"><img id="pt'+i+'" alt="" width="96" height="96"><div class="tx"><b>'+(sp.player?'★ ':'')+sp.name+'</b><span class="ti">'+sp.title+'</span><span class="ln">「'+sp.line+'」</span>'+
       '<span class="st"><span>速さ '+stars(sp.stat.spd)+'</span><span>曲がり '+stars(sp.stat.turn)+'</span><span>かしこさ '+stars(sp.stat.tech)+'</span></span></div></div>';
  });
  $('rosterBox').innerHTML=h;showRosterPage(0);
}
function makePortraits(){
  if(portraitsDone) return; portraitsDone=true;
  setTimeout(function(){
    var rr;
    try{ rr=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true}); }catch(e){ return; }
    rr.setPixelRatio(1); rr.setSize(320,320,false);
    var sc=new T.Scene(); sc.background=new T.Color(0x101a38); sc.add(new T.HemisphereLight(0xdde8ff,0x40507a,1.05));
    var dl=new T.DirectionalLight(0xffffff,0.85); dl.position.set(2,3,-3); sc.add(dl);
    var back=new T.Mesh(new T.CircleGeometry(2.3,32),new T.MeshBasicMaterial({color:0x22346a})); back.position.set(-0.6,-0.2,2.2); back.rotation.y=Math.PI*0.85; sc.add(back);
    var cm=new T.PerspectiveCamera(36,1,0.1,60);
    G.ROSTER.forEach(function(sp,i){
      var source=racers.filter(function(r){return r.spec.id===sp.id;})[0].model,root=source.root;
      var oldParent=root.parent,oldPos=root.position.clone(),oldQ=root.quaternion.clone(),oldS=root.scale.clone();
      root.position.set(0,0,0);root.scale.setScalar(sp.scale);root.rotation.set(.32,0,0);sc.add(root);
      cm.position.set(2.65,1.6,-2.5);cm.lookAt(0,0,.20);rr.render(sc,cm);
      var img=$('pt'+i);if(img)img.src=rr.domElement.toDataURL('image/png');
      oldParent.add(root);root.position.copy(oldPos);root.quaternion.copy(oldQ);root.scale.copy(oldS);
    });
    rr.dispose(); if(rr.forceContextLoss) rr.forceContextLoss();
  },60);
}

/* ================= リサイズ ================= */
function resize(){
  var w=stage.clientWidth, h=stage.clientHeight;
  var pr=Math.min(window.devicePixelRatio||1, S.quality==='high'?2:1.25)*st.prScale;
  renderer.setPixelRatio(pr); renderer.setSize(w,h,false);
  cam.aspect=w/Math.max(1,h); cam.updateProjectionMatrix(); st.pxScale=pr; st.vh=h*pr;
  checkOrientation();
}
function checkOrientation(){
  var portrait=window.innerHeight>window.innerWidth;
  $('rot').classList.toggle('on',portrait);
  if(portrait&&(st.mode==='race'||st.mode==='ready')) pause();
}
window.addEventListener('resize',resize);
window.addEventListener('orientationchange',function(){ setTimeout(resize,200); });

/* ================= 描画 ================= */
var BASEQ=new T.Quaternion();
function orient(r,now){
  G.place(r.s,r.x,r.h,vP,vUp,vF,vR);
  var cy=Math.cos(r.yaw), sy=Math.sin(r.yaw), cp=Math.cos(r.pit), sp=Math.sin(r.pit);
  vT.copy(vF).multiplyScalar(cy*cp).addScaledVector(vR,sy*cp).addScaledVector(vUp,sp);
  vC.crossVectors(vT,vUp).normalize(); vN.copy(vT).negate(); vU2.crossVectors(vN,vC).normalize();
  mB.makeBasis(vC,vU2,vN);
  var root=r.model.root; root.position.copy(vP); root.quaternion.setFromRotationMatrix(mB);
  root.userData.fwd=root.userData.fwd||new T.Vector3(); root.userData.fwd.copy(vT);
  r.model.body.rotation.z=-r.yaw*0.9+Math.sin(now*0.002+r.idx)*0.03; r.model.body.position.y=Math.sin(now*0.0031+r.idx*2)*0.04;
}
var nzv=new T.Vector3(), emitAcc=0;
function emitExhaust(r,now,dt){
  var d=camPos.distanceTo(r.model.root.position); if(d>300) return;
  var running=(st.mode==='race'||st.mode==='finish'), idle=(st.mode==='ready'||st.mode==='title'||st.mode==='paused'||st.mode==='result');
  var n=r.model.nozzles, root=r.model.root, fwd=root.userData.fwd, boost=r.boosting&&running;
  var cnt=r.isPlayer?(boost?4:2):1; if(!running&&!idle) return; if(st.mode==='paused') return;
  if(st.mode==='ready'&&Math.random()<0.4) return;
  root.updateMatrixWorld(true);
  for(var i=0;i<Math.min(2,n.length);i++){
    nzv.set(n[i][0],n[i][1],n[i][2]+(boost?.8:.45)); r.model.body.localToWorld(nzv);
    var c=r.spec.flame[0], cr=((c>>16)&255)/255, cg=((c>>8)&255)/255, cb=(c&255)/255, sz=(boost?3.2:1.8)*r.model.scale/5.0;
    for(var q=0;q<cnt;q++) exhaust.emit(nzv.x+(Math.random()-0.5)*0.4,nzv.y+(Math.random()-0.5)*0.4,nzv.z+(Math.random()-0.5)*0.4,
       -fwd.x*(running?28:1)+(Math.random()-0.5)*2,-fwd.y*(running?28:1)+(Math.random()-0.5)*2,-fwd.z*(running?28:1)+(Math.random()-0.5)*2,0,sz*(0.8+Math.random()*0.5),1.1+Math.random()*.7,cr,cg,cb);
  }
  if(r.spec.rocket==='firework'&&Math.random()<0.5){ nzv.set(n[0][0],n[0][1],n[0][2]+0.2); r.model.body.localToWorld(nzv); var hh=Math.random(), cc=hh<0.5?[1,0.45,0.7]:[1,0.92,0.4];
    exhaust.emit(nzv.x,nzv.y,nzv.z,(Math.random()-0.5)*14,(Math.random()-0.5)*14,(Math.random()-0.5)*14,1,0.9,0.7,cc[0],cc[1],cc[2]); }
}
function camSetup(dt,now){
  var p=player;
  G.place(p.s,p.x,p.h,vP,vUp,vF,vR);
  var cy=Math.cos(p.yaw), sy=Math.sin(p.yaw);
  var boosting=p.boosting&&(st.mode==='race');
  var back=boosting?18:15, up=6.5;
  // 追従カメラ
  vA.copy(vP).addScaledVector(vF,-back).addScaledVector(vUp,up).addScaledVector(vR,8.0-sy*2.0);
  if(st.mode==='race'){ vA.addScaledVector(vR,-p.x*.06).addScaledVector(vUp,-(p.h-C.H0)*.04); }
  // 周回カメラ（タイトル・スタート前・ゴール後）
  var k=st.orbitK, ang=st.orbitA;
  if(st.mode==='title'){ ang=1.1+Math.sin(now*.00018)*.18; k=1; }
  if(st.mode==='finish'||st.mode==='result'){ k=clamp(st.finishT/1.2,0,1)*0.95; ang=Math.PI*0.95-st.finishT*0.6; }
  if(k>0.001){
    var rad=(st.mode==='title')?22:15, ca=Math.cos(ang), sa=Math.sin(ang), hs=p.model.scale;
    vB.copy(vP).addScaledVector(vF,-ca*rad).addScaledVector(vR,sa*rad).addScaledVector(vUp,3.4+(st.mode==='title'?1.0*Math.sin(now*0.0007):0));
    vA.lerp(vB,k);
  }
  if(!st.camInit||st.mode==='title'||st.mode==='ready'){ camPos.copy(vA); st.camInit=true; } else camPos.lerp(vA,1-Math.exp(-dt*9));
  cam.position.copy(camPos);
  if(S.shake&&st.shake>0&&st.mode==='race'){ cam.position.addScaledVector(vR,Math.sin(now*0.07)*0.22*st.shake); cam.position.addScaledVector(vUp,Math.sin(now*0.053+1)*0.22*st.shake); }
  cam.up.copy(vUp);
  // 注視点
  var cp=Math.cos(p.pit*0.5), sp=Math.sin(p.pit*0.5);
  vD.copy(vP).addScaledVector(vF,10*cp).addScaledVector(vUp,14*sp+1.2);
  vB.copy(vP).addScaledVector(vUp,0.8);
  camLook.copy(vD).lerp(vB,k);
  cam.lookAt(camLook);
  var tf=(boosting?86:68)+(st.mode==='title'?-8:0); st.fov+=(tf-st.fov)*Math.min(1,dt*5); cam.fov=st.fov; cam.updateProjectionMatrix();
}
function updateArrow(){
  var g=GATES[player.gi];
  if(!g||(st.mode!=='race')){ gArrow.classList.remove('on'); return; }
  vA.copy(g.pos).project(cam);
  var behind=vA.z>1, x=vA.x, y=vA.y;
  if(behind){ x=-x; y=-y; }
  var off=behind||Math.abs(x)>0.92||Math.abs(y)>0.88;
  if(!off){ gArrow.classList.remove('on'); return; }
  var m=Math.max(Math.abs(x),Math.abs(y),0.001); x=x/m*0.9; y=y/m*0.84;
  var w=stage.clientWidth, h=stage.clientHeight;
  gArrow.style.left=((x*0.5+0.5)*w)+'px'; gArrow.style.top=((-y*0.5+0.5)*h)+'px';
  gArrow.style.transform='rotate('+Math.atan2(-y,x)+'rad)'; gArrow.classList.add('on');
}
function render(dt,now){
  var i, r;
  for(i=0;i<racers.length;i++){
    r=racers[i]; var near=r.isPlayer||(st.mode!=='title'&&Math.abs(r.s-player.s)<550);
    r.model.root.visible=near; if(!near)continue; orient(r,now);
    if(r.model.animate)r.model.animate(now*.001,r.yaw,r.pit,r.boosting);
    var len=0.05;
    if(st.mode==='race'||st.mode==='finish') len=(r.boosting?4.6:1.65)*clamp(r.v/C.V0,0.35,1.6)*(r.stall>0?0.35:1);
    else if(st.mode==='ready') len=0.4+0.25*Math.sin(now*0.03+i);
    else len=0.3+0.15*Math.sin(now*0.02+i);
    G.setFlame(r.model,len,now*0.001,r.boosting);
    for(var s=0;s<r.model.strips.length;s++) r.model.strips[s].userData.upd(now*0.001+i,clamp(r.v/C.V0,0,1.4));
    emitExhaust(r,now,dt);
  }
  camSetup(dt,now);
  exhaust.uScale.value=st.vh/(2*Math.tan(cam.fov*Math.PI/360));
  exhaust.update(dt);
  W.update(cam,now*0.001,st.pxScale,dt,player);
  // 速度線
  var sp=(st.mode==='race'||st.mode==='finish')?player.v:0, a=clamp((sp-C.V0*1.12)/(C.V0*0.45),0,1);
  slMat.opacity=a*0.55; speedLines.visible=a>0.01;
  if(a>0.01){
    var ln=0.5+sp*0.06;
    for(i=0;i<NL;i++){ slZ[i]+=sp*dt*0.9; if(slZ[i]>-3) slZ[i]=-60; var o=i*6; slPos[o]=slX[i]; slPos[o+1]=slY[i]; slPos[o+2]=slZ[i]; slPos[o+3]=slX[i]; slPos[o+4]=slY[i]; slPos[o+5]=slZ[i]-ln; }
    slGeo.attributes.position.needsUpdate=true;
  }
  // 次ゲートの点滅
  if(W.ringMats){ var f=0.5+0.5*Math.sin(now*0.012); W.ringMats.next.color.setRGB(1,0.82+0.18*f,0.2+0.7*f); }
  updateArrow();
  renderer.render(scene,cam);
}

/* ================= ループ ================= */
var last=0, fpsAcc=0, fpsN=0; window.__fps=0;
function loop(now){
  requestAnimationFrame(loop);
  var realDt=(now-last)/1000||0, dt=Math.min(1/20,realDt); last=now;
  fpsAcc+=realDt; fpsN++;
  if(fpsAcc>=1){
    window.__fps=Math.round(fpsN/fpsAcc); fpsAcc=0; fpsN=0;
    // 重い端末では解像度を自動で下げ、余裕が戻ったら少し戻す（動作が主、画質は従）
    if(W&&!document.hidden&&st.mode!=='paused'){
      if(window.__fps<42&&st.prScale>0.5){ st.prScale=Math.max(0.5,st.prScale*0.8); st.goodSec=0; resize(); }
      else if(window.__fps>=58){ if(++st.goodSec>=4&&st.prScale<1){ st.prScale=Math.min(1,st.prScale*1.1); st.goodSec=0; resize(); } }
      else st.goodSec=0;
    }
  }
  if(st.toastT>0){ st.toastT-=dt; if(st.toastT<=0) toast.classList.remove('on'); }
  if(st.warnT>0){ st.warnT-=dt; if(st.warnT<=0) warn.style.opacity=0; }
  if(st.lmT>0){ st.lmT-=dt; if(st.lmT<=0) lmName.classList.remove('on'); }
  if(st.tagT>0){ st.tagT-=dt; if(st.tagT<=0||st.mode==='race'&&st.t>3) setTag(''); }
  if(!W) return;
  if(st.mode==='race'||st.mode==='ready'||st.mode==='finish'){
    acc+=dt; while(acc>=STEP){ step(STEP); acc-=STEP; }
    st.hudAcc+=dt; if(st.hudAcc>0.1){ st.hudAcc=0; hud(); }
    gBoost.style.transform='scaleX('+(player.boost/100).toFixed(3)+')'; gHeat.style.transform='scaleX('+Math.min(1,player.heat/100).toFixed(3)+')';
    if(player.draft>0.01&&st.mode==='race') { tag.textContent='スリップストリーム！'; tag.classList.add('on'); } else if(st.tagT<=0) tag.classList.remove('on');
    engineSound();
  } else { acc=0; if(AC) engineSound(); }
  render(st.mode==='paused'?0:dt,st.mode==='paused'?(st.pauseNow||now):(st.pauseNow=now,now));
}

/* ================= 起動 ================= */
function boot(){
  var t0=performance.now(); resize(); window.__steps=[];
  G.build(earthLayer,renderer,S.quality,function(i){ window.__steps.push(i+':'+Math.round(performance.now()-t0)); },function(world){
    try{
      earthLayer.traverse(function(o){if(o.isMesh&&o.geometry&&!o.geometry.index)G.compactGeometry(o.geometry);});
      W=world; earthWorld=world; scene.fog=earthLayer.fog; earthState={LM:G.LM,lmS:G.lmS,gates:G.gates,FIN:G.FIN,L:G.L,place:G.place,frameAt:G.frameAt}; GATES=G.gates;
      exhaust=new G.Exhaust(scene);
      G.ROSTER.forEach(function(sp,i){ var r=makeRacer(sp,i); racers.push(r); if(r.isPlayer) player=r; });
      racers.sort(function(a,b){ return (b.isPlayer?1:0)-(a.isPlayer?1:0)||a.idx-b.idx; }); racers.forEach(function(r,i){ r.idx=i; });
      resetRacers(); buildStrip(); buildRoster(); bindSettings(); bindPad();
      document.body.classList.add('full'); resize();
      $('load').style.display='none';
      hud();
      window.__st=st; window.__inp=inp; window.__C=C;
      window.__game={racers:racers,player:player,gates:GATES,step:step,hud:hud,startRace:startRace,startGo:startGo,STEP:STEP,
        run:function(n,bot){ for(var i=0;i<n;i++){ if(bot) bot(player,st,GATES,racers); step(STEP); } },
        setCourse:setCourse,renderer:renderer,skipCountdown:function(){ while(st.mode==='ready'){ step(STEP); } },
        pause:pause,resume:resume,showResult:showResult,toTitle:toTitle,scene:scene,cam:cam,orderRacers:orderRacers,contacts:racerContacts,getWorld:function(){return W;}};
      window.__bootMs=Math.round(performance.now()-t0);
    }catch(e){ $('load').textContent='エラー: '+e.message; window.__bootError=e.stack||String(e); }
  });
}
requestAnimationFrame(loop);
setTimeout(function(){ try{ boot(); }catch(e){ $('load').textContent='エラー: '+e.message; window.__bootError=e.stack||String(e); } },40);
})();
