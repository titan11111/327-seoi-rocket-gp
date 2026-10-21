/* 327 背負いロケット グランプリ — 世界（地球・空・星・名所・コース）
   画像素材なし。地図・雲・月・天の川はすべて起動時に Canvas で描く。 */
(function(){'use strict';
var G=window.G=window.G||{}; var T=THREE; var TAU=Math.PI*2, D2R=Math.PI/180;
var R=1900; G.R=R; G.TAU=TAU;

/* ================= ユーティリティ ================= */
G.rng=function(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; };
function clamp(x,a,b){ return x<a?a:x>b?b:x; } G.clamp=clamp;
function smooth(a,b,x){ var t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }
function hash(ix,iy){ var n=Math.imul(ix,374761393)+Math.imul(iy,668265263)|0; n=Math.imul(n^(n>>>13),1274126177); return ((n^(n>>>16))>>>0)/4294967296; }
function vnoise(x,y){ var ix=Math.floor(x), iy=Math.floor(y), fx=x-ix, fy=y-iy; fx=fx*fx*(3-2*fx); fy=fy*fy*(3-2*fy);
  var a=hash(ix,iy), b=hash(ix+1,iy), c=hash(ix,iy+1), d=hash(ix+1,iy+1); return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy; }
function ll2v(lon,lat,out){ var lo=lon*D2R, la=lat*D2R, c=Math.cos(la); return out.set(c*Math.cos(lo),Math.sin(la),-c*Math.sin(lo)); }
G.ll2v=ll2v;

/* ================= 低ポリ結合（描画呼び出しを減らす） ================= */
var cache={}, ZV=new T.Vector3(0,0,1);
var _m=new T.Matrix4(), _q=new T.Quaternion(), _e=new T.Euler(), _v=new T.Vector3(), _s=new T.Vector3(), _p=new T.Vector3(), _col=new T.Color();
function ni(g){ return g.index?g.toNonIndexed():g; }
function geoOf(kind,seg){
  var k=kind+(seg||0); if(cache[k]) return cache[k]; var g;
  if(kind==='box') g=new T.BoxGeometry(1,1,1);
  else if(kind==='sph') g=new T.SphereGeometry(1,seg||8,Math.max(4,((seg||8)*0.75)|0));
  else if(kind==='cyl') g=new T.CylinderGeometry(1,1,1,seg||8);
  else g=new T.ConeGeometry(1,1,seg||8);
  return cache[k]=ni(g);
}
function Merger(){ this.p=[]; this.n=[]; this.c=[]; }
Merger.prototype.addGeo=function(geo,m,hex){
  var g=geo.clone(); g.applyMatrix4(m);
  var p=g.attributes.position.array, n=g.attributes.normal.array, i;
  _col.setHex(hex);
  for(i=0;i<p.length;i++){ this.p.push(p[i]); this.n.push(n[i]); }
  for(i=0;i<p.length/3;i++) this.c.push(_col.r,_col.g,_col.b);
  g.dispose();
};
/* kind: box | sph | cyl | cone。cyl/cone は半径 sx(=sz)・高さ sy、軸は y */
Merger.prototype.part=function(kind,x,y,z,sx,sy,sz,hex,rx,ry,rz,seg){
  _e.set(rx||0,ry||0,rz||0); _q.setFromEuler(_e); _v.set(x,y,z); _s.set(sx,sy,sz);
  _m.compose(_v,_q,_s); this.addGeo(geoOf(kind,seg),_m,hex);
};
Merger.prototype.bar=function(ax,ay,az,bx,by,bz,w,hex){
  var dx=bx-ax, dy=by-ay, dz=bz-az, len=Math.sqrt(dx*dx+dy*dy+dz*dz)||1e-6;
  _p.set(dx/len,dy/len,dz/len); _q.setFromUnitVectors(ZV,_p);
  _v.set((ax+bx)/2,(ay+by)/2,(az+bz)/2); _s.set(w,w,len); _m.compose(_v,_q,_s); this.addGeo(geoOf('box'),_m,hex);
};
Merger.prototype.addCustom=function(geo,x,y,z,sx,sy,sz,hex,rx,ry,rz){
  _e.set(rx||0,ry||0,rz||0); _q.setFromEuler(_e); _v.set(x,y,z); _s.set(sx,sy,sz); _m.compose(_v,_q,_s); this.addGeo(ni(geo),_m,hex);
};
Merger.prototype.addMatrix=function(kind,m,hex,seg){ this.addGeo(geoOf(kind,seg),m,hex); };
Merger.prototype.append=function(o,m){
  var v=new T.Vector3(), i, n=new T.Vector3();
  for(i=0;i<o.p.length;i+=3){ v.set(o.p[i],o.p[i+1],o.p[i+2]).applyMatrix4(m); this.p.push(v.x,v.y,v.z); n.set(o.n[i],o.n[i+1],o.n[i+2]).transformDirection(m); this.n.push(n.x,n.y,n.z); }
  for(i=0;i<o.c.length;i++) this.c.push(o.c[i]);
};
Merger.prototype.geometry=function(){
  var g=new T.BufferGeometry();
  g.setAttribute('position',new T.BufferAttribute(new Float32Array(this.p),3));
  g.setAttribute('normal',new T.BufferAttribute(new Float32Array(this.n),3));
  g.setAttribute('color',new T.BufferAttribute(new Float32Array(this.c),3));
  return g;
};
// 同じ位置・法線・色・骨情報の頂点を共有。輪郭や硬い稜線は保持する。
G.compactGeometry=function(g){
  if(g.index||!g.attributes.position)return g;
  var names=Object.keys(g.attributes),src=names.map(function(n){return g.attributes[n];}),maps=src.map(function(a){return new Uint32Array(a.array.buffer,a.array.byteOffset,a.array.byteLength/4);});
  // skinIndexはUint16なので別に扱う。
  maps=src.map(function(a){return a.array.BYTES_PER_ELEMENT===4?new Uint32Array(a.array.buffer,a.array.byteOffset,a.array.length):a.array;});
  var out=names.map(function(){return [];}),idx=[],seen=new Map(),n=g.attributes.position.count;
  for(var i=0;i<n;i++){
    var key='';for(var a=0;a<src.length;a++){var size=src[a].itemSize;for(var k=0;k<size;k++)key+=maps[a][i*size+k]+',';}
    var at=seen.get(key);
    if(at===undefined){at=seen.size;seen.set(key,at);for(a=0;a<src.length;a++){size=src[a].itemSize;for(k=0;k<size;k++)out[a].push(src[a].array[i*size+k]);}}
    idx.push(at);
  }
  for(var a=0;a<names.length;a++){var old=src[a];g.setAttribute(names[a],new T.BufferAttribute(new old.array.constructor(out[a]),old.itemSize,old.normalized));}
  g.setIndex(idx);return g;
};
G.Merger=Merger;
G.matLit=new T.MeshLambertMaterial({vertexColors:true,flatShading:true});
G.matGlow=new T.MeshBasicMaterial({vertexColors:true});

/* ================= 世界地図データ（経度,緯度。おおまかな海岸線） ================= */
var MAP={
na:[-168,66,-162,70,-156,71.3,-141,69.6,-128,70,-115,68,-100,68,-95,72,-85,69,-82,66,-88,64,-94,60,-93,57,-85,55,-82,52,-79,52,-78,58,-77,62,-70,61,-65,60,-62,57,-56,52,-60,48,-66,45,-70,43,-70,41.5,-74,40.2,-76,37,-76,35,-81,31,-80,27,-80.5,25.2,-82,26.5,-83,29.5,-86,30.3,-89,30,-91,29.2,-94,29.5,-97,27,-97.5,22,-96,19,-94.5,18.2,-91,18.8,-90.5,21,-87,21.5,-87.5,18,-88.3,15.8,-84,15.5,-83.5,11,-81.5,8.8,-79,9.3,-77.3,8.6,-78,7.2,-80,7.4,-82.8,8.2,-85.7,10.3,-87.5,13,-91.5,14,-94.5,16,-97,15.8,-101,17.4,-105.5,20,-106,23,-109,26.5,-112.5,29.5,-114.7,31.7,-113,29,-110.5,24.5,-112,24.8,-115,28,-117,32.5,-120.5,34.5,-122.5,37.5,-124,40.5,-124.2,46,-124.7,48.4,-123,49,-126,50.5,-130,54.5,-134,58,-140,59.8,-146,60.8,-152,59,-157,57.5,-162,55.2,-158,58.5,-162,60,-165,62,-166,64.5,-163,64.6],
green:[-73,78,-60,82,-30,83.5,-18,80,-20,72,-22,70,-32,68,-42,60,-48,61,-53,66,-55,70,-62,75],
baffin:[-80,73,-70,70,-62,66.5,-66,62,-74,63,-78,65,-90,70,-85,73],
elles:[-90,76,-70,78.5,-62,82,-82,83,-95,80],
cuba:[-85,22,-80,23.2,-74.2,20.2,-77.5,19.8,-82,22.5],
sa:[-77.3,8.6,-75.5,10.8,-72,12,-71.5,10.5,-68,10.6,-62,10.5,-60,8.5,-57,6,-52,5,-50,1.5,-48,-1,-44,-2.5,-40,-3,-35,-5.5,-35,-9,-39,-13.5,-39,-18,-41,-22,-45,-23.5,-48,-26,-48.7,-28.5,-53,-34,-57,-35,-58.5,-38.5,-62,-39,-65,-41,-64.5,-45,-67.5,-46.5,-66,-48,-69,-51,-68.5,-54,-72,-54,-75,-51,-75.5,-46,-73.7,-43,-73.5,-37,-71.6,-31,-70.5,-23,-70,-18.5,-76,-14,-79,-8,-81.2,-5,-80,-2,-80.5,0,-78.8,2,-77.3,4,-77.5,7],
africa:[-17,21,-16,24,-13,27.5,-9.5,30,-9.8,32.5,-6,35.8,-2,35,3,36.8,10,37.3,11,35,10,33.5,15,32.3,20,32.3,20,30.5,25,31.7,32,31.3,34,29.5,32.8,28,34,26,36,22,37.3,18,39,15.5,42.8,12.8,43.3,11.8,51,12,51,10.5,49,6,45,2,41,-2,39.5,-6,40.5,-10.5,40.5,-15,35,-20,35.5,-24,32.8,-26,32.5,-28.5,30,-31.5,27,-33.7,22,-34.2,18.5,-34.2,17.5,-30,15,-26,12,-18,13.5,-12,12.2,-6,9,-1,9.5,3.5,6,4.3,4,6.3,-1,5.2,-7.5,4.4,-11,7,-13.5,9.5,-15,11.5,-17,14.7,-16.5,19],
mada:[44,-25,47,-25,50,-15,49.5,-12,47,-15,44,-20],
eurasia:[-9.5,43,-9,37,-5.5,36,-2,36.8,0,38.8,3,42,6,43.2,9,44.3,11,42.3,12.5,41.4,15.5,38,16.5,38.2,16.6,40.5,18.4,40.2,16,41.9,13.6,43.6,12.3,45.3,13.8,45.7,15,44.2,19,41.8,20,39.7,23,36.5,24,38.3,22.9,40.3,26,40.8,29,41.2,27,37,30.5,36.5,36,36.5,35.5,34,34.8,31.5,34.4,29.8,35,28,37,24.5,39,21,42.5,16,43.5,12.8,45,12.8,48,14,52,16,55,17.5,57.5,19,59.8,22.5,56.5,24.5,56,26,54,24.2,51.5,24.5,50.5,26,48.5,29.5,48,30,50,30,52,27.5,56.5,27,57.5,25.5,61.5,25.2,66.5,25.4,68.5,23.5,70,20.8,72.8,19,73,15.5,74.8,12.8,76.3,9.5,77.5,8,79.5,10,80,13.5,80.3,15.8,82.3,17,86,19.8,87,21.5,89,21.8,91.5,22.5,92.5,20.5,94.5,17,97,16.5,98,13,98.5,10,100,7,101.3,3.5,103.5,1.4,104.2,3,103,5.5,100.5,6.3,100.8,12.8,102.5,12,105,9,106.5,10.4,109,12,109.2,15,107.5,17,106,20,108,21.5,111,21.5,114,22.3,117,23.5,119.5,25.5,121.8,29.5,121,32,120.8,34,119,35.2,121,37,122.5,37.3,121,38.8,121.6,40.8,124,39.8,125,38,126.5,37,126.5,34.8,129,35.2,129.5,37,128.5,38.5,127.5,39.8,129.8,41,131.5,42.8,135,43.7,138,46.5,140.5,48.5,140.3,53,142,59,150,59.5,157,61.8,163,62.5,170,60.5,179.5,64.5,180,69,170,70,160,69.5,150,71.5,140,72.5,130,71.2,125,73.5,113,73.8,108,76.5,100,77.3,95,76,87,75,81,72.5,72.5,72.5,69,73,67,69.5,60,68.8,56,67.5,44,68.5,41,66.5,34,66.7,33,69.5,28,71,25,71,20,70,15,68.5,12,65.5,8,63.5,5.5,60,5.7,58.5,8,58,10.5,59.3,11.5,59.5,12.5,56.5,14.5,55.5,16.5,56.2,16.7,57.5,18.5,59.5,17.3,60.8,17.5,62.5,19.5,63.7,21.5,65,22.2,65.8,25.4,65.2,24.5,64,22,62.5,21.4,61,22.5,60.2,25,60.2,28,60.5,30,60,28.2,59.4,23.5,59.2,23.5,58,24.3,57.3,21.5,57,21,55.8,19.5,54.5,18.5,54.7,16.5,54.3,14,53.9,12,54.2,10.8,54,10.5,55.5,10.3,57.7,9,57,8.2,55.5,8.7,54,7,53.6,5,53,4.5,52.2,3.5,51.4,1.7,50.9,1.6,49.9,0,49.5,-1.5,49.7,-1.7,48.7,-4.5,48.5,-4.5,47.8,-2.5,47.2,-1.2,46,-1.4,44.4,-1.8,43.4,-4,43.5,-8,43.7],
gb:[-5.5,50,1.5,51,1.7,52.7,0,53.5,-1.5,55.5,-2,57.5,-3.8,57.8,-5,58.6,-6,56.5,-5,55,-3,54.8,-3,53.4,-4.7,52.8,-4.2,51.6],
ire:[-10,52,-6,52.2,-6,54.5,-8,55.2,-10,54],
ice:[-24,65.5,-18,66.3,-14,65,-18,63.5,-22,63.8],
honshu:[130.9,34,132.5,34.3,135,34.6,136.8,34.5,138,34.7,140,35,140.8,36,141,38,142,39.5,141.5,41.4,140,40.8,139.8,39.7,138.8,38,137,37,136.7,36.5,135.5,35.6,133,35.5,131,34.5],
hokkaido:[140,41.5,141.5,42.5,145.5,43.3,143.3,44.5,141.5,45.4,141.8,43.5,140.3,43],
kyushu:[130,31.5,131.5,31.3,131.8,33.5,130,33.6,129.7,32.7],
shikoku:[132.5,33,134.5,33.8,134.5,34.2,133,34.1],
sumatra:[95.3,5.5,98,4,104,-1,106,-3,104.5,-5.9,101,-3,98.5,1.5],
borneo:[109,1.5,111,2,114,4.5,117,7,119,5,118,1,116.5,-3.5,114,-4,111,-3,110,-1],
java:[105.5,-6.5,108,-6.5,111,-6.5,114.5,-7.8,112,-8.5,107,-7.8],
sulawesi:[119.5,-5,120.5,-2,121,1.2,125,1.5,123,-1,122,-4.5],
png:[131,-1,134,-3.5,138,-1.7,141,-2.6,147,-6,150,-10,146.5,-8.8,143,-9,141,-9.1,138,-8.3,137.8,-5.5,134,-4],
luzon:[120.5,18.5,122.3,18.4,121.5,14.2,124,12.7,120.9,13.7,120.2,16],
mindanao:[122,7,125.5,9.5,126.6,7,125,6,122,6.8],
taiwan:[120.2,22.8,121.5,25.2,122,25,121.5,22],
srilanka:[79.8,9.5,81.8,7.5,80.2,6],
aus:[114,-22,113.5,-26,115,-34,118,-35,123,-34,126,-32.2,131,-31.5,135,-34.8,138,-35.5,138,-33,140,-37.7,144,-38.5,147,-38.3,150,-37.3,153,-31,153.5,-27,151.5,-23.5,146,-19,145.4,-14.5,142.5,-10.7,141.5,-13,140,-17.5,136,-15,137,-12,132,-11.2,130,-12.5,128,-15,125,-14.5,122,-17.2,121,-19.5,116,-20.7],
tas:[144.7,-40.7,148.3,-41,147.5,-43.4,145.3,-42.5],
nzn:[172.7,-34.4,175.5,-37,178.5,-37.7,175.3,-41.5,174.7,-39.8,173.8,-39.2],
nzs:[172.7,-40.5,174.3,-41.7,171,-44.6,169,-46.6,166.5,-46,168.5,-44,171,-42],
antarctica:[-180,-90,180,-90,180,-70,160,-71,140,-66.5,120,-66,100,-66,80,-67.5,60,-67,45,-69,20,-70,0,-70.5,-20,-72,-40,-76,-60,-72,-62,-67,-70,-70,-90,-72,-120,-74,-150,-77,-180,-78]
};
var SEAS=[ // 内海（海の色で上書き）
 [28,41.5,41.5,41.2,41.5,43.5,37,45.3,33,44.5,30,46,29,44.5],
 [47,45,53,45,54,40,53,37,49,37.5,49,40.5,47,43],
 [31,30.5,33,31.2,35,31.8,34.8,33,36,35.5,30,36.2]
];
var DESERTS=[[-17,35,14,31,0.85],[35,58,14,31,0.8],[50,68,25,38,0.5],[90,115,38,46,0.6],[68,75,24,29,0.5],[122,142,-30,-20,0.7],[15,24,-27,-19,0.6],[-71,-69,-27,-17,0.7],[-117,-105,30,38,0.55],[-70,-66,-48,-38,0.3]];
var RIDGES=[[78,34,4],[84,29.5,4],[90,28.5,4],[96,29.5,4],[100,32,5],[7,46,2.6],[11,46.8,2.6],[-110,44,5],[-114,50,5],[-108,38,4],[-118,60,6],[-70,-20,3],[-69,-33,3],[-72,-45,3],[-76,-5,3],[-72,5,3],[-4,32,3],[44,42,3],[80,42,4],[60,60,2.5],[-150,62,5]];
var CITIES=[[139.7,35.7,3],[-118.2,34,2.5],[-122.4,37.8,2],[-74,40.7,3],[-87.6,41.9,2],[2.3,48.9,3],[-0.1,51.5,3],[12.5,41.9,2],[31.2,30,2.5],[77.2,28.6,3],[72.9,19,2.5],[116.4,39.9,3],[121.5,31.2,3],[126.9,37.5,2],[37.6,55.7,2.5],[28.9,41,2],[-46.6,-23.5,2.5],[-99.1,19.4,2.5],[151.2,-33.9,2],[103.8,1.3,1.5],[100.5,13.7,2],[106.8,-6.2,2.5],[-43.2,-22.9,2],[3.4,6.5,2],[-58.4,-34.6,2],[30.5,50.4,1.5],[10,53.5,1.5],[13.4,52.5,2]];

/* ================= 惑星テクスチャ ================= */
var MW=2048, MH=1024, landMask=null, LW=1024, LH=512;
function drawPoly(ctx,pts,W,H){
  ctx.beginPath();
  for(var i=0;i<pts.length;i+=2){ var x=(pts[i]+180)/360*W, y=(90-pts[i+1])/180*H; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
  ctx.closePath();
}
function landAt(lon,lat){
  if(!landMask) return false;
  var l=((lon+540)%360), x=Math.min(LW-1,Math.floor(l/360*LW)), y=Math.min(LH-1,Math.max(0,Math.floor((90-lat)/180*LH)));
  return landMask[y*LW+x]===1;
}
G.landAt=landAt;
function boxK(lon,lat,l0,l1,a0,a1){ return smooth(l0-4,l0+3,lon)*(1-smooth(l1-3,l1+4,lon))*smooth(a0-3,a0+2,lat)*(1-smooth(a1-2,a1+3,lat)); }
function landColor(lon,lat,n1,n2,out){
  var al=Math.abs(lat), r=0.30+0.10*n1, g=0.50+0.12*n1, b=0.22+0.04*n2, k, i;
  if(al<14){ r=0.13+0.06*n1; g=0.38+0.10*n1; b=0.15; }
  else if(al>46&&al<62){ r=0.22+0.08*n1; g=0.42+0.10*n1; b=0.22; }
  for(i=0;i<DESERTS.length;i++){ var d=DESERTS[i]; k=boxK(lon,lat,d[0],d[1],d[2],d[3])*d[4]*(0.75+0.5*n1); if(k>0){ k=Math.min(1,k); r+=(0.82+0.06*n2-r)*k; g+=(0.67+0.06*n2-g)*k; b+=(0.40-b)*k; } }
  var mt=0; for(i=0;i<RIDGES.length;i++){ var rg=RIDGES[i], dx=lon-rg[0], dy=lat-rg[1], dd=Math.sqrt(dx*dx+dy*dy)/rg[2]; if(dd<1.6) mt=Math.max(mt,(1.6-dd)/1.6); }
  mt*=0.55+0.9*n2;
  if(mt>0.25){ k=Math.min(1,(mt-0.25)*1.6); r+=(0.50-r)*k; g+=(0.46-g)*k; b+=(0.40-b)*k; }
  if(mt>0.7){ k=Math.min(1,(mt-0.7)*3); r+=(0.95-r)*k; g+=(0.96-g)*k; b+=(0.98-b)*k; }
  if(al>60){ k=smooth(60,76,al); r+=(0.66+0.1*n1-r)*k; g+=(0.68+0.1*n1-g)*k; b+=(0.62+0.1*n1-b)*k; }
  if(al>73){ k=smooth(73,82,al); r+=(0.96-r)*k; g+=(0.97-g)*k; b+=(1-b)*k; }
  out[0]=r; out[1]=g; out[2]=b;
}
function buildPlanetTextures(cb){
  var cv=document.createElement('canvas'); cv.width=MW; cv.height=MH; var ctx=cv.getContext('2d');
  var gr=ctx.createLinearGradient(0,0,0,MH); gr.addColorStop(0,'#0d3a78'); gr.addColorStop(0.5,'#0a4c9a'); gr.addColorStop(1,'#0d3a78');
  ctx.fillStyle=gr; ctx.fillRect(0,0,MW,MH);
  ctx.lineJoin='round'; var k, polys=[];
  for(k in MAP) polys.push(MAP[k]);
  // 浅い海（海岸の外側に段階的に明るく）
  var widths=[22,13,6], cols=['#0e5a9c','#1b7bb4','#37a2c8'];
  for(var w=0;w<3;w++){ ctx.lineWidth=widths[w]; ctx.strokeStyle=cols[w]; for(var i=0;i<polys.length;i++){ if(polys[i]===MAP.antarctica) continue; drawPoly(ctx,polys[i],MW,MH); ctx.stroke(); } }
  ctx.fillStyle='#ff0000';
  for(i=0;i<polys.length;i++){ drawPoly(ctx,polys[i],MW,MH); ctx.fill(); }
  ctx.strokeStyle='#ffff00'; ctx.lineWidth=3;
  for(i=0;i<polys.length;i++){ if(polys[i]===MAP.antarctica) continue; drawPoly(ctx,polys[i],MW,MH); ctx.stroke(); }
  ctx.fillStyle='#1b7bb4'; for(i=0;i<SEAS.length;i++){ drawPoly(ctx,SEAS[i],MW,MH); ctx.fill(); }
  var img=ctx.getImageData(0,0,MW,MH), d=img.data, out=[0,0,0];
  var spec=document.createElement('canvas'); spec.width=LW; spec.height=LH; var sctx=spec.getContext('2d'), simg=sctx.createImageData(LW,LH), sd=simg.data;
  landMask=new Uint8Array(LW*LH);
  var y=0;
  function chunk(){
  var yEnd=Math.min(MH,y+48);
  for(;y<yEnd;y++){
    var lat=90-(y+0.5)/MH*180;
    for(var x=0;x<MW;x++){
      var o=(y*MW+x)*4, r=d[o], g=d[o+1], b=d[o+2], isLand=(r-b)>50;
      var lon=(x+0.5)/MW*360-180;
      if(isLand){
        var n1=vnoise(x*0.045,y*0.045)*0.6+vnoise(x*0.13,y*0.13)*0.4, n2=vnoise(x*0.31+50,y*0.31)*0.6+vnoise(x*0.9,y*0.9+9)*0.4;
        landColor(lon,lat,n1,n2,out);
        var sand=clamp((g-70)/140,0,1)*0.8;
        if(lat<-62){ out[0]=0.93; out[1]=0.95; out[2]=1; }
        else if(sand>0){ out[0]+=(0.86-out[0])*sand; out[1]+=(0.80-out[1])*sand; out[2]+=(0.58-out[2])*sand; }
        var sh=0.9+0.2*n2; d[o]=clamp(out[0]*sh,0,1)*255; d[o+1]=clamp(out[1]*sh,0,1)*255; d[o+2]=clamp(out[2]*sh,0,1)*255;
      } else {
        var nn=vnoise(x*0.08,y*0.08)*0.12-0.06; d[o]=clamp(r/255+nn*0.4,0,1)*255; d[o+1]=clamp(g/255+nn*0.6,0,1)*255; d[o+2]=clamp(b/255+nn,0,1)*255;
        if(Math.abs(lat)>72){ var ic=smooth(72,80,Math.abs(lat))*0.85; d[o]+=(235-d[o])*ic; d[o+1]+=(240-d[o+1])*ic; d[o+2]+=(250-d[o+2])*ic; }
      }
      if(((x|y)&1)===0){
        var q=(y>>1)*LW+(x>>1); landMask[q]=isLand?1:0; sd[q*4]=sd[q*4+1]=sd[q*4+2]=isLand?30:(Math.abs(lat)>72?90:230); sd[q*4+3]=255;
      }
    }
  }
  if(y<MH){ setTimeout(chunk,0); return; }
  ctx.putImageData(img,0,0); sctx.putImageData(simg,0,0);
  // 夜景の灯り
  var lc=document.createElement('canvas'); lc.width=LW; lc.height=LH; var lx=lc.getContext('2d'); lx.fillStyle='#000'; lx.fillRect(0,0,LW,LH);
  var rnd=G.rng(777), i2;
  for(i2=0;i2<16000;i2++){
    var lo=rnd()*360-180, la=(rnd()*2-1)*(rnd()<0.8?55:70);
    if(!landAt(lo,la)||Math.abs(la)>66) continue;
    var pop=vnoise((lo+180)*0.35,(la+90)*0.35); if(pop<0.52&&rnd()<0.85) continue;
    var px=(lo+180)/360*LW, py=(90-la)/180*LH, a=0.25+rnd()*0.6;
    lx.fillStyle='rgba('+(255)+','+(190+rnd()*50|0)+','+(100+rnd()*50|0)+','+a+')'; lx.fillRect(px,py,1+(rnd()<0.2?1:0),1);
  }
  for(i2=0;i2<CITIES.length;i2++){
    var c=CITIES[i2], cx=(c[0]+180)/360*LW, cy=(90-c[1])/180*LH, gl=lx.createRadialGradient(cx,cy,0,cx,cy,5*c[2]);
    gl.addColorStop(0,'rgba(255,225,150,0.95)'); gl.addColorStop(0.3,'rgba(255,180,90,0.45)'); gl.addColorStop(1,'rgba(255,150,60,0)');
    lx.fillStyle=gl; lx.fillRect(cx-6*c[2],cy-6*c[2],12*c[2],12*c[2]);
  }
  // 雲
  var cc=document.createElement('canvas'); cc.width=LW; cc.height=LH; var cx2=cc.getContext('2d'); var cr=G.rng(4242);
  for(i2=0;i2<2600;i2++){
    var band=cr(), la2;
    if(band<0.35) la2=(cr()*2-1)*14; else if(band<0.8) la2=(cr()<0.5?-1:1)*(35+cr()*28); else la2=(cr()*2-1)*80;
    var lo2=cr()*360, X=lo2/360*LW, Y=(90-la2)/180*LH;
    var cl=vnoise(lo2*0.05,la2*0.09+30); if(cl<0.42&&cr()<0.8) continue;
    var rr=5+cr()*17, al2=0.05+cr()*0.16, g2=cx2.createRadialGradient(X,Y,0,X,Y,rr);
    g2.addColorStop(0,'rgba(255,255,255,'+al2+')'); g2.addColorStop(1,'rgba(255,255,255,0)');
    cx2.save(); cx2.translate(X,Y); cx2.scale(1.9,0.8); cx2.translate(-X,-Y); cx2.fillStyle=g2; cx2.fillRect(X-rr,Y-rr,rr*2,rr*2); cx2.restore();
  }
  cb({color:cv, spec:spec, lights:lc, cloud:cc});
  }
  chunk();
}

/* ================= 空・星・天体 ================= */
var SKY_V='varying vec3 vDir; void main(){ vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
var SKY_F=[
'uniform vec3 uSun,uUp; uniform float uLimb,uDay,uTwil; varying vec3 vDir;',
'void main(){',
' vec3 d=normalize(vDir); float e=dot(d,uUp); float h=clamp((e-uLimb)/(1.0-uLimb),0.0,1.0);',
' vec3 zen=mix(vec3(0.0,0.0,0.014),vec3(0.07,0.26,0.70),uDay); vec3 hor=mix(vec3(0.014,0.03,0.07),vec3(0.58,0.78,0.98),uDay);',
' float sd=max(dot(d,uSun),0.0); vec3 tw=vec3(1.0,0.52,0.22)*(0.35+0.9*pow(sd,3.0))+vec3(0.5,0.22,0.5)*0.25;',
' hor=mix(hor,tw,uTwil*(1.0-smoothstep(0.0,0.6,h)));',
' vec3 col=mix(hor,zen,pow(h,0.45));',
' float rim=exp(-pow((e-uLimb)*10.0,2.0));',
' col+=mix(vec3(0.05,0.12,0.30),mix(vec3(0.35,0.62,1.0),vec3(1.0,0.5,0.2),uTwil),max(uDay,uTwil))*rim*0.5;',
' gl_FragColor=vec4(col,1.0); }'].join('\n');
var STAR_V=['attribute float aSize; attribute float aPh; attribute float aTw; uniform float uT,uPx; varying vec3 vC; varying float vS;',
'void main(){ vC=color; float tw=0.72+0.28*sin(uT*aTw+aPh); vS=aSize; gl_PointSize=aSize*uPx*tw; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }'].join('\n');
var STAR_F=['uniform float uA; varying vec3 vC; varying float vS;',
'void main(){ vec2 p=gl_PointCoord-0.5; float d=length(p)*2.0; float core=exp(-d*d*5.0);',
' float cross=0.0; if(vS>3.2){ cross=0.55*(exp(-abs(p.x)*40.0)*exp(-abs(p.y)*4.0)+exp(-abs(p.y)*40.0)*exp(-abs(p.x)*4.0)); }',
' float a=(core+cross)*uA; if(a<0.01) discard; gl_FragColor=vec4(vC*a,a); }'].join('\n');

function radial(size,stops){
  var c=document.createElement('canvas'); c.width=c.height=size; var x=c.getContext('2d'), g=x.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
  for(var i=0;i<stops.length;i++) g.addColorStop(stops[i][0],stops[i][1]); x.fillStyle=g; x.fillRect(0,0,size,size); return c;
}
function milkyTexture(){
  var W=1024,H=512,c=document.createElement('canvas'); c.width=W; c.height=H; var x=c.getContext('2d'), r=G.rng(31337), i;
  x.fillStyle='#000'; x.fillRect(0,0,W,H); x.globalCompositeOperation='lighter';
  for(i=0;i<1700;i++){
    var u=r()*W, off=(r()+r()+r()-1.5)*70, y=H/2+off+Math.sin(u/W*TAU*2)*18, core=1-Math.abs(u/W-0.5)*1.25;
    var rad=10+r()*38, a=(0.015+r()*0.04)*Math.max(0.35,core)*(1-Math.min(1,Math.abs(off)/130));
    var col=r()<0.55?'150,170,255':(r()<0.6?'255,215,170':'200,150,255');
    var g=x.createRadialGradient(u,y,0,u,y,rad); g.addColorStop(0,'rgba('+col+','+a+')'); g.addColorStop(1,'rgba('+col+',0)');
    x.fillStyle=g; x.fillRect(u-rad,y-rad,rad*2,rad*2);
  }
  x.globalCompositeOperation='source-over';
  for(i=0;i<260;i++){ var u2=r()*W, y2=H/2+(r()-0.5)*50+Math.sin(u2/W*TAU*2)*18, rd=6+r()*22, g2=x.createRadialGradient(u2,y2,0,u2,y2,rd); g2.addColorStop(0,'rgba(0,0,0,0.30)'); g2.addColorStop(1,'rgba(0,0,0,0)'); x.fillStyle=g2; x.fillRect(u2-rd,y2-rd,rd*2,rd*2); }
  x.globalCompositeOperation='lighter';
  var neb=[[170,150,'255,90,160'],[820,330,'90,150,255'],[560,120,'170,100,255']];
  for(i=0;i<neb.length;i++){ var n=neb[i], g3=x.createRadialGradient(n[0],n[1],0,n[0],n[1],70); g3.addColorStop(0,'rgba('+n[2]+',0.17)'); g3.addColorStop(1,'rgba('+n[2]+',0)'); x.fillStyle=g3; x.fillRect(n[0]-70,n[1]-70,140,140); }
  return c;
}
function moonTexture(){
  var S=256,c=document.createElement('canvas'); c.width=c.height=S; var x=c.getContext('2d'), r=G.rng(99), i;
  x.fillStyle='#cfcac0'; x.fillRect(0,0,S,S);
  for(i=0;i<9;i++){ var mx=r()*S, my=S*0.2+r()*S*0.6, mr=18+r()*40, g=x.createRadialGradient(mx,my,0,mx,my,mr); g.addColorStop(0,'rgba(95,95,105,0.55)'); g.addColorStop(1,'rgba(95,95,105,0)'); x.fillStyle=g; x.fillRect(mx-mr,my-mr,mr*2,mr*2); }
  for(i=0;i<70;i++){ var cx=r()*S, cy=r()*S, cr=2+r()*9; x.beginPath(); x.arc(cx,cy,cr,0,TAU); x.fillStyle='rgba(80,80,90,0.25)'; x.fill(); x.beginPath(); x.arc(cx-cr*0.2,cy-cr*0.2,cr*0.8,0,TAU); x.fillStyle='rgba(235,232,222,0.35)'; x.fill(); }
  return c;
}

/* ================= コース（東京から東回りに地球一周） ================= */
var LM=[
 {id:'tokyo',name:'東京タワー',sub:'日本',lon:139.7,lat:35.7,kind:'circle',col:0xff5a28,gh:46},
 {id:'sf',name:'ゴールデンゲートブリッジ',sub:'アメリカ',lon:237.6,lat:37.8,kind:'sq',col:0xff4b3a,gh:46},
 {id:'ny',name:'自由の女神',sub:'アメリカ',lon:286,lat:40.7,kind:'circle',col:0xffd24a,gh:46},
 {id:'paris',name:'エッフェル塔',sub:'フランス',lon:362.3,lat:48.9,kind:'arch',col:0xffcf70,gh:46},
 {id:'rome',name:'コロッセオ',sub:'イタリア',lon:372.5,lat:41.9,kind:'arch',col:0xffe0a0,gh:46},
 {id:'giza',name:'ピラミッド',sub:'エジプト',lon:391.1,lat:30.0,kind:'tri',col:0xffd24a,gh:46},
 {id:'agra',name:'タージ・マハル',sub:'インド',lon:438,lat:27.2,kind:'arch',col:0xffffff,gh:46},
 {id:'wall',name:'万里の長城',sub:'中国',lon:476,lat:40.4,kind:'oct',col:0xff5a3a,gh:46}
];
G.LM=LM;
var NT=1536, TS=new Float32Array(NT*3), TTn=new Float32Array(NT*3), TR=new Float32Array(NT*3), DS=1, L=1;
var fS=new T.Vector3(), fT=new T.Vector3(), fR=new T.Vector3(), fUp=new T.Vector3(), fF=new T.Vector3(), fP=new T.Vector3(), tmpA=new T.Vector3(), tmpB=new T.Vector3();
G.fS=fS; G.fT=fT; G.fR=fR;
function buildPath(){
  var K=LM.length, ws=[], sum=0, k;
  for(k=0;k<K;k++){ var nx=(k+1<K)?LM[k+1].lon:LM[0].lon+360; ws.push(Math.sqrt(nx-LM[k].lon)); sum+=ws[k]; }
  var us=[0]; for(k=0;k<K;k++) us.push(us[k]+ws[k]/sum);
  var FN=4800, lon=new Float64Array(FN), lat=new Float64Array(FN), i, dl=new Float64Array(FN);
  for(i=0;i<FN;i++){
    var u=i/FN, seg=0; while(seg<K-1&&u>=us[seg+1]) seg++;
    var t=(u-us[seg])/(us[seg+1]-us[seg]), l0=LM[seg].lon, l1=(seg+1<K)?LM[seg+1].lon:LM[0].lon+360, a0=LM[seg].lat, a1=(seg+1<K)?LM[seg+1].lat:LM[0].lat;
    dl[i]=(l1-l0)/(us[seg+1]-us[seg])/FN; var e=0.5-0.5*Math.cos(Math.PI*t); lat[i]=a0+(a1-a0)*e;
  }
  var sm=new Float64Array(FN), W=120, acc, j; // 経度速度をなだらかに
  for(i=0;i<FN;i++){ acc=0; for(j=-W;j<=W;j++) acc+=dl[(i+j+FN)%FN]; sm[i]=acc/(2*W+1); }
  var tot=0; for(i=0;i<FN;i++) tot+=sm[i]; var sc=360/tot, c=LM[0].lon;
  for(i=0;i<FN;i++){ lon[i]=c; c+=sm[i]*sc; }
  var pts=new Float64Array((FN+1)*3), cum=new Float64Array(FN+1), v=new T.Vector3();
  for(i=0;i<=FN;i++){ var ii=i%FN, ll=i<FN?lon[ii]:LM[0].lon+360; ll2v(ll,lat[ii],v).multiplyScalar(R); pts[i*3]=v.x; pts[i*3+1]=v.y; pts[i*3+2]=v.z; if(i>0){ var dx=pts[i*3]-pts[i*3-3], dy=pts[i*3+1]-pts[i*3-2], dz=pts[i*3+2]-pts[i*3-1]; cum[i]=cum[i-1]+Math.sqrt(dx*dx+dy*dy+dz*dz); } }
  L=cum[FN]; DS=L/NT;
  var idx=0;
  for(i=0;i<NT;i++){
    var target=i*DS; while(idx<FN-1&&cum[idx+1]<target) idx++;
    var f=(target-cum[idx])/Math.max(1e-6,cum[idx+1]-cum[idx]);
    v.set(pts[idx*3]+(pts[idx*3+3]-pts[idx*3])*f,pts[idx*3+1]+(pts[idx*3+4]-pts[idx*3+1])*f,pts[idx*3+2]+(pts[idx*3+5]-pts[idx*3+2])*f).normalize();
    TS[i*3]=v.x; TS[i*3+1]=v.y; TS[i*3+2]=v.z;
  }
  for(i=0;i<NT;i++){
    var a=(i+NT-2)%NT, b=(i+2)%NT;
    tmpA.set(TS[b*3]-TS[a*3],TS[b*3+1]-TS[a*3+1],TS[b*3+2]-TS[a*3+2]);
    v.set(TS[i*3],TS[i*3+1],TS[i*3+2]); tmpA.addScaledVector(v,-tmpA.dot(v)).normalize();
    TTn[i*3]=tmpA.x; TTn[i*3+1]=tmpA.y; TTn[i*3+2]=tmpA.z;
    tmpB.crossVectors(tmpA,v).normalize(); TR[i*3]=tmpB.x; TR[i*3+1]=tmpB.y; TR[i*3+2]=tmpB.z;
  }
  G.L=L; G.DS=DS;
}
/* s(m) の位置でのコースの基準枠を fS,fT,fR に入れる */
G.frameAt=function(s){
  s=((s%L)+L)%L; var f=s/DS, i=Math.floor(f), t=f-i; i%=NT; var j=(i+1)%NT, a=i*3, b=j*3;
  fS.set(TS[a]+(TS[b]-TS[a])*t,TS[a+1]+(TS[b+1]-TS[a+1])*t,TS[a+2]+(TS[b+2]-TS[a+2])*t).normalize();
  fT.set(TTn[a]+(TTn[b]-TTn[a])*t,TTn[a+1]+(TTn[b+1]-TTn[a+1])*t,TTn[a+2]+(TTn[b+2]-TTn[a+2])*t).normalize();
  fR.crossVectors(fT,fS).normalize();
};
/* コース上 (s, 横x, 高さh) の世界座標・上・前・右 */
G.place=function(s,x,h,pos,up,fwd,right){
  G.frameAt(s); fP.copy(fS).multiplyScalar(R).addScaledVector(fR,x); up.copy(fP).normalize();
  pos.copy(up).multiplyScalar(R+h);
  fwd.copy(fT).addScaledVector(up,-fT.dot(up)).normalize(); right.crossVectors(fwd,up).normalize();
};
var lmS=[];
function locateLandmarks(){
  var v=new T.Vector3(), i, k;
  for(k=0;k<LM.length;k++){
    if(k===0){ lmS.push(0); continue; }
    var best=1e9, bi=0, target=((LM[k].lon%360)+360)%360;
    for(i=0;i<NT;i++){ var lo=Math.atan2(-TS[i*3+2],TS[i*3])/D2R; lo=((lo%360)+360)%360; var dd=Math.abs(lo-target); if(dd>180) dd=360-dd; if(dd<best){ best=dd; bi=i; } }
    lmS.push(bi*DS);
  }
}
G.lmS=lmS;

/* ---------- ゲート配置 ---------- */
G.gates=[]; G.GATE_N=40; G.FIN=0;
function buildGates(){
  var n=G.GATE_N, normal=n-LM.length, K=LM.length, legs=[], i, k, tot=0;
  G.FIN=L-30;
  for(k=0;k<K;k++){ var a=lmS[k], b=(k+1<K)?lmS[k+1]:L-150; legs.push(b-a); tot+=b-a; }
  var cnt=[], used=0, rem=[];
  for(k=0;k<K;k++){ var q=legs[k]/tot*normal; cnt.push(Math.floor(q)); used+=cnt[k]; rem.push([q-Math.floor(q),k]); }
  rem.sort(function(a,b){ return b[0]-a[0]; }); for(i=0;used<normal;i++,used++) cnt[rem[i%K][1]]++;
  var list=[], gi=0;
  for(k=0;k<K;k++){
    list.push({s:lmS[k],lm:k,x:0,h:LM[k].gh});
    for(var j=0;j<cnt[k];j++){
      var a2=lmS[k], b2=(k+1<K)?lmS[k+1]:L-150, s=a2+(j+1)/(cnt[k]+1)*(b2-a2), g=list.length;
      var x=34*Math.sin(g*1.9+0.7)*(0.45+0.55*Math.sin(g*0.37+1)), h=60+30*Math.sin(g*1.3+2.1);
      list.push({s:s,lm:-1,x:clamp(x,-34,34),h:clamp(h,32,92)});
    }
  }
  G.gates=list; G.GATE_N=list.length;
}

/* ---------- 名所の形（局所座標: 右+X, 上+Y, 後ろ+Z、地面 y=0、輪の中心 (0,46,0)） ---------- */
var C_STEEL=0xb9c0c8;
function lattice(M,baseW,deckY,deckW,col1,col2,topY,topW){
  var cs=[[-1,-1],[1,-1],[-1,1],[1,1]], i;
  for(i=0;i<4;i++){ var sx=cs[i][0], sz=cs[i][1]; M.bar(sx*baseW,0,sz*baseW,sx*deckW,deckY,sz*deckW,3.2,col1); }
  var levels=[deckY*0.28,deckY*0.55,deckY*0.82];
  for(i=0;i<levels.length;i++){ var y=levels[i], w=baseW+(deckW-baseW)*(y/deckY);
    M.bar(-w,y,-w,w,y,-w,2,col2); M.bar(-w,y,w,w,y,w,2,col2); M.bar(-w,y,-w,-w,y,w,2,col2); M.bar(w,y,-w,w,y,w,2,col2);
    M.bar(-w,y,-w,w,y+deckY*0.27,-w*0.4,1.3,col2); M.bar(w,y,w,-w,y+deckY*0.27,w*0.4,1.3,col2); }
  M.part('box',0,deckY+4,0,deckW*2+8,8,deckW*2+8,col1);
}
var LMB={
tokyo:function(M,Gl){
  lattice(M,46,108,10,0xe8512a,0xf4f1ea);
  M.part('cyl',0,128,0,7,40,7,0xf4f1ea,0,0,0,4); M.part('cyl',0,128,0,7.5,10,7.5,0xe8512a,0,0,0,4);
  M.part('box',0,152,0,15,6,15,0xe8512a); M.part('cone',0,176,0,3,52,3,0xe8512a,0,0,0,4); M.part('cone',0,205,0,0.8,16,0.8,0xf4f1ea,0,0,0,4);
  [30,60,90].forEach(function(y){ for(var i=0;i<4;i++){ var a=i*Math.PI/2+Math.PI/4, r=46-(36*y/108); Gl.part('box',Math.cos(a)*r,y,Math.sin(a)*r,2.2,2.2,2.2,0xffb050); } });
  Gl.part('sph',0,213,0,2.4,2.4,2.4,0xff3030,0,0,0,6);
},
sf:function(M,Gl){
  var red=0xc2392b, i, x;
  [-1,1].forEach(function(sx){
    [-1,1].forEach(function(sz){ M.part('box',sx*40,52,sz*8,7,104,6,red); });
    [30,62,94].forEach(function(y){ M.part('box',sx*40,y,0,5,5,24,red); });
    M.part('box',sx*40,106,0,9,4,26,red);
  });
  M.part('box',0,20,0,520,5,17,red); M.part('box',0,16,0,520,3,15,0x8c2a20);
  for(i=0;i<3;i++){ M.part('box',-150-i*40,0,0,8,24,8,0x8c2a20); M.part('box',150+i*40,0,0,8,24,8,0x8c2a20); }
  [-8,8].forEach(function(z){
    var prev=null;
    for(i=0;i<=28;i++){ x=-40+i*80/28; var yy=24+(104-24)*Math.pow(x/40,2); if(prev) Gl.bar(prev[0],prev[1],z,x,yy,z,0.9,0xe86050);
      if(i%2===0&&i>0&&i<28) M.bar(x,yy,z,x,22,z,0.5,0xb0b8c0); prev=[x,yy]; }
    var ex=[[40,104,240,26],[-40,104,-240,26]]; ex.forEach(function(e){ var p2=null; for(var q=0;q<=14;q++){ var t2=q/14, px=e[0]+(e[2]-e[0])*t2, py=e[1]+(e[3]-e[1])*(1-Math.pow(1-t2,1.6)); if(p2) Gl.bar(p2[0],p2[1],z,px,py,z,0.9,0xe86050); p2=[px,py]; } });
  });
  for(i=-9;i<=9;i++) Gl.part('box',i*26,24,0,1.6,1.6,1.6,0xffc070);
},
ny:function(M,Gl){
  var gx=-66, green=0x62b59b;
  M.part('box',gx,12,0,40,24,40,0xb9b0a0); M.part('box',gx,32,0,26,18,26,0xcbc3b3); M.part('box',gx,44,0,34,4,34,0xb9b0a0);
  M.part('cyl',gx,78,0,13,64,13,green,0,0,0,10); M.part('cone',gx,66,0,18,50,18,green,0,0,0,8);
  M.part('sph',gx,115,0,8,8,8,green); for(var i=0;i<7;i++){ var a=-0.9+i*0.3; M.bar(gx,122,0,gx+Math.sin(a)*14,134+Math.cos(a)*4,-Math.cos(a)*9,1.8,green); }
  M.bar(gx+8,104,0,gx+22,138,0,5,green); M.part('sph',gx+22,142,0,5,5,5,green,0,0,0,6);
  M.bar(gx-8,100,2,gx-6,70,6,5,green);
  M.part('cone',gx+22,152,0,3.4,11,3.4,0xffd24a,0,0,0,6); Gl.part('sph',gx+22,150,0,3,3,3,0xffe080,0,0,0,6);
  M.part('cyl',0,2,40,50,4,50,0x4aa0d8,0,0,0,12);
},
paris:function(M,Gl){
  var br=0x8d6a48, br2=0xb89368, i;
  var cs=[[-1,-1],[1,-1],[-1,1],[1,1]];
  for(i=0;i<4;i++){ var sx=cs[i][0], sz=cs[i][1];
    M.bar(sx*52,0,sz*52,sx*36,34,sz*36,3.6,br); M.bar(sx*36,34,sz*36,sx*22,74,sz*22,3.2,br); M.bar(sx*22,74,sz*22,sx*11,122,sz*11,2.6,br); M.bar(sx*11,122,sz*11,sx*3,172,sz*3,2,br); }
  [74,122].forEach(function(y){ var w=y===74?22:11; M.part('box',0,y,0,w*2+6,5,w*2+6,br2); });
  for(i=0;i<3;i++){ var y2=18+i*18, w2=52-(52-36)*(y2/34>1?1:y2/34); M.bar(-w2,y2,-w2,w2,y2+10,-w2,1.2,br2); M.bar(-w2,y2,w2,w2,y2+10,w2,1.2,br2); }
  M.part('box',0,120,0,22,2,22,br2); M.part('cone',0,180,0,3,36,3,br,0,0,0,4); M.part('cone',0,204,0,0.8,16,0.8,br2,0,0,0,4);
  M.bar(-36,34,-36,36,34,-36,2,br2); M.bar(-36,34,36,36,34,36,2,br2);
  Gl.part('sph',0,213,0,2,2,2,0xffffff,0,0,0,6);
  for(i=0;i<10;i++) Gl.part('box',(i%2?-1:1)*(20-i),100+i*6,(i%3-1)*8,1.8,1.8,1.8,0xffd070);
},
rome:function(M,Gl){
  var a=100, b=70, n=36, cream=0xd6c19a, dark=0x4a3a2e, i, t, x, z;
  for(i=0;i<n;i++){
    t=(i+0.5)/n*TAU; x=Math.sin(t)*a; z=Math.cos(t)*b;
    if(Math.abs(x)<24) continue;
    var dx=Math.cos(t)*a, dz=-Math.sin(t)*b, len=Math.sqrt(dx*dx+dz*dz), ry=Math.atan2(dx,dz), seg=TAU/n*Math.sqrt((a*a+b*b)/2)*1.05;
    M.part('box',x,28,z,seg,56,9,cream,0,ry,0);
    var nx=Math.cos(ry), nz=-Math.sin(ry);
    for(var lv=0;lv<3;lv++){ var wy=10+lv*17; M.part('box',x+(nz*-0)*0,wy,z,seg*0.5,10,9.6,dark,0,ry,0); }
    if(i%3===0) M.part('box',x,60,z,seg*0.9,4,10,0xbfa882,0,ry,0);
  }
  M.part('cyl',0,1,0,70,2,48,0xcdb88f,0,0,0,24);
  [-34,34].forEach(function(px){ M.part('cyl',px,30,b-2,4,60,4,0xe2d2ae,0,0,0,8); M.part('cyl',px,30,-b+2,4,60,4,0xe2d2ae,0,0,0,8); });
  for(i=0;i<8;i++) Gl.part('box',(i<4?-1:1)*(30+(i%4)*14),6,(i%2?1:-1)*(b-4),2,2,2,0xffc070);
},
giza:function(M,Gl){
  var sand=0xd8b35c, sand2=0xc69c45;
  function pyr(x,z,side,h,col){ M.part('cone',x,h/2,z,side*0.7071,h,side*0.7071,col,0,Math.PI/4,0,4); }
  pyr(-104,-20,150,96,sand); pyr(106,10,130,84,sand2); pyr(150,-150,70,44,sand); pyr(-170,130,60,40,sand2);
  M.part('box',-70,10,70,26,20,60,0xc9a45a); M.part('sph',-70,26,36,10,10,10,0xc9a45a,0,0,0,6);
  M.part('cyl',0,1,0,60,2,40,0xe0c27a,0,0,0,10);
  Gl.part('cone',0,100,-104,2,6,2,0xffe9a0,0,0,0,4);
  for(var i=0;i<5;i++) Gl.part('sph',-30+i*15,3,60,1.5,1.5,1.5,0xffd070,0,0,0,5);
},
agra:function(M,Gl){
  var red=0xb2503a, wh=0xf3efe4, i;
  [-1,1].forEach(function(sx){
    M.part('box',sx*60,32,0,76,64,16,red); M.part('box',sx*60,66,0,70,4,17,0xe8dcc0);
    for(i=0;i<3;i++){ M.part('cyl',sx*(36+i*24),70,0,3,10,3,0xe8dcc0,0,0,0,6); M.part('sph',sx*(36+i*24),77,0,5,5,5,wh,0,0,0,8); }
  });
  M.part('box',0,74,0,48,16,16,red); M.part('box',0,86,0,50,4,17,0xe8dcc0);
  M.part('cyl',0,2,0,60,3,60,0xd5cbb0,0,0,0,10);
  var px=-120, pz=90;
  M.part('box',px,16,pz,70,32,70,wh); M.part('sph',px,64,pz,24,28,24,wh); M.part('cone',px,95,pz,2,14,2,0xd9b24a,0,0,0,5);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(c){ M.part('cyl',px+c[0]*52,36,pz+c[1]*52,4,72,4,wh,0,0,0,8); M.part('sph',px+c[0]*52,76,pz+c[1]*52,5,5,5,wh,0,0,0,6); M.part('sph',px+c[0]*22,40,pz+c[1]*22,8,8,8,wh,0,0,0,7); });
  M.part('box',px,1,pz-62,22,2,90,0x6fbfd8);
  Gl.part('sph',px,92,pz,2,2,2,0xffffff,0,0,0,5); Gl.part('box',0,92,0,2,2,2,0xffe0a0);
},
wall:function(M,Gl){
  var br=0x9a8a72, br2=0x7e705c, roof=0x9c3b2e, i, x;
  [-1,1].forEach(function(sx){
    for(i=0;i<10;i++){ x=sx*(24+i*28); var wy=44+Math.sin(i*0.7+sx)*4; M.part('box',x+sx*14,wy/2-20,0,29,wy+40,12,br); M.part('box',x+sx*14,wy+3,-5,29,5,2.4,br2); M.part('box',x+sx*14,wy+3,5,29,5,2.4,br2);
      for(var c=-4;c<=4;c+=2) M.part('box',x+sx*14+c*2.6,wy+7,-5,3,4,2,br2); }
    for(i=0;i<3;i++){ var tx=sx*(80+i*84); M.part('box',tx,34,0,18,68,18,br2); M.part('box',tx,70,0,22,4,22,0x5a4f40); M.part('cone',tx,80,0,16,14,16,roof,0,Math.PI/4,0,4); }
  });
  M.part('box',-26,40,0,16,92,16,br2); M.part('box',26,40,0,16,92,16,br2);
  M.part('box',0,74,0,60,28,18,br2); M.part('box',0,92,0,70,5,26,0x5a4f40); M.part('cone',0,104,0,44,16,44,roof,0,Math.PI/4,0,4);
  M.part('box',0,60,-9.2,28,6,1,0xd0b060);
  Gl.part('sph',-26,96,-9,2,2,2,0xff8030,0,0,0,5); Gl.part('sph',26,96,-9,2,2,2,0xff8030,0,0,0,5);
  for(i=0;i<8;i++) Gl.part('sph',(i<4?-1:1)*(100+(i%4)*60),50,-6,1.6,1.6,1.6,0xffb060,0,0,0,5);
}
};

/* ---------- ゲートの輪（形ごと） ---------- */
function ringGeometry(kind,rad,tube){
  var M=new Merger(), seg, i;
  if(kind==='circle'||kind==='oct'||kind==='tri'||kind==='sq'){
    seg=kind==='circle'?32:kind==='oct'?8:kind==='tri'?3:4;
    var g=new T.TorusGeometry(rad,tube,6,seg); var rz=kind==='sq'?Math.PI/4:(kind==='tri'?Math.PI/2:(kind==='oct'?Math.PI/8:0));
    M.addCustom(g,0,0,0,1,1,1,0xffffff,0,0,rz);
    if(kind==='tri'){ /* 頂点が上になるよう半径補正済み */ }
  } else { // arch: 半円＋左右の柱
    var ar=new T.TorusGeometry(rad,tube,6,20,Math.PI); M.addCustom(ar,0,0,0,1,1,1,0xffffff);
    M.part('cyl',-rad,-rad*0.5,0,tube,rad,tube,0xffffff,0,0,0,6); M.part('cyl',rad,-rad*0.5,0,tube,rad,tube,0xffffff,0,0,0,6);
    M.part('box',0,-rad,0,rad*2,tube*1.4,tube*1.4,0xffffff);
  }
  return M.geometry();
}

/* ================= 世界を組み立てる ================= */
G.build=function(scene,renderer,quality,onStep,done){
  var W={}, hi=quality!=='low';
  buildPath(); locateLandmarks(); buildGates();
  if(onStep) onStep(1);
  buildPlanetTextures(function(tex){
  var maxA=renderer.capabilities.getMaxAnisotropy?renderer.capabilities.getMaxAnisotropy():1;
  function ct(c,rep){ var t=new T.CanvasTexture(c); t.anisotropy=Math.min(8,maxA); t.wrapS=T.RepeatWrapping; return t; }
  var tColor=ct(tex.color), tSpec=ct(tex.spec), tLights=ct(tex.lights), tCloud=ct(tex.cloud);
  if(onStep) onStep(2);

  // 地球
  var earthMat=new T.MeshPhongMaterial({map:tColor,specularMap:tSpec,specular:0x8899aa,shininess:42});
  var earth=new T.Mesh(new T.SphereGeometry(R,hi?256:192,hi?128:96),earthMat); scene.add(earth); W.earth=earth;
  // 近景の海面は微細な波と流れを材質で出す。追加メッシュ・画像転送なし。
  W.waterTime={value:0};
  earthMat.onBeforeCompile=function(sh){
    sh.uniforms.uWaterTime=W.waterTime;
    sh.vertexShader='varying vec3 vSurface;\n'+sh.vertexShader;
    sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSurface=position;');
    sh.fragmentShader='uniform float uWaterTime; varying vec3 vSurface;\n'+sh.fragmentShader;
    sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\nfloat sea=smoothstep(0.01,0.16,diffuseColor.b-diffuseColor.r);float wave=sin(vSurface.x*1.8+vSurface.z*1.2+uWaterTime*2.0)*sin(vSurface.z*2.7-vSurface.y*1.9-uWaterTime);diffuseColor.rgb+=vec3(0.014,0.035,0.04)*wave*sea;');
  };
  // 夜景
  var lightsMat=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    uniforms:{tL:{value:tLights},uSun:{value:new T.Vector3(1,0,0)}},
    vertexShader:'varying vec2 vUv; varying vec3 vN; void main(){ vUv=uv; vN=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:'uniform sampler2D tL; uniform vec3 uSun; varying vec2 vUv; varying vec3 vN; void main(){ float lit=dot(normalize(vN),uSun); float night=smoothstep(0.08,-0.2,lit); vec3 c=texture2D(tL,vUv).rgb*night*1.7; gl_FragColor=vec4(c,1.0); }'});
  var lightsMesh=new T.Mesh(new T.SphereGeometry(R+0.8,96,48),lightsMat); lightsMesh.renderOrder=2; scene.add(lightsMesh); W.lightsMat=lightsMat;
  // 雲の層
  var cloudMat=new T.MeshLambertMaterial({map:tCloud,transparent:true,depthWrite:false,opacity:0.58});
  var cloud=new T.Mesh(new T.SphereGeometry(R+9,96,48),cloudMat); cloud.renderOrder=3; scene.add(cloud); W.cloud=cloud;

  // 空
  var skyU={uSun:{value:new T.Vector3()},uUp:{value:new T.Vector3(0,1,0)},uLimb:{value:-0.2},uDay:{value:0},uTwil:{value:0}};
  var sky=new T.Mesh(new T.SphereGeometry(8500,24,16),new T.ShaderMaterial({uniforms:skyU,vertexShader:SKY_V,fragmentShader:SKY_F,side:T.BackSide,depthWrite:false}));
  sky.renderOrder=-10; sky.frustumCulled=false; scene.add(sky); W.sky=sky; W.skyU=skyU;
  // 天の川
  var milkyMat=new T.MeshBasicMaterial({map:new T.CanvasTexture(milkyTexture()),side:T.BackSide,transparent:true,blending:T.AdditiveBlending,depthWrite:false,opacity:1});
  var milky=new T.Mesh(new T.SphereGeometry(8400,32,20),milkyMat); milky.rotation.set(0.5,0.9,0.35); milky.renderOrder=-9; milky.frustumCulled=false; scene.add(milky); W.milky=milky;
  // 星
  var NS=hi?2600:1300, sp=new Float32Array(NS*3), sc=new Float32Array(NS*3), ssz=new Float32Array(NS), sph=new Float32Array(NS), stw=new Float32Array(NS), r=G.rng(2026), i;
  var gn=new T.Vector3(0.3,0.8,0.5).normalize(), pal=[[0.65,0.78,1],[1,1,1],[1,0.92,0.72],[1,0.72,0.5],[0.8,0.85,1]];
  for(i=0;i<NS;i++){
    var u=r()*2-1, a=r()*TAU, rr=Math.sqrt(1-u*u); tmpA.set(Math.cos(a)*rr,u,Math.sin(a)*rr);
    if(r()<0.55){ tmpA.addScaledVector(gn,-tmpA.dot(gn)*0.88).normalize(); }
    sp[i*3]=tmpA.x*8300; sp[i*3+1]=tmpA.y*8300; sp[i*3+2]=tmpA.z*8300;
    var pc=pal[(r()*pal.length)|0], br=0.55+r()*0.45; sc[i*3]=pc[0]*br; sc[i*3+1]=pc[1]*br; sc[i*3+2]=pc[2]*br;
    ssz[i]=1.1+Math.pow(r(),4)*4.4; sph[i]=r()*TAU; stw[i]=0.8+r()*3.2;
  }
  var sg=new T.BufferGeometry(); sg.setAttribute('position',new T.BufferAttribute(sp,3)); sg.setAttribute('color',new T.BufferAttribute(sc,3));
  sg.setAttribute('aSize',new T.BufferAttribute(ssz,1)); sg.setAttribute('aPh',new T.BufferAttribute(sph,1)); sg.setAttribute('aTw',new T.BufferAttribute(stw,1));
  var starU={uT:{value:0},uPx:{value:2},uA:{value:1}};
  var stars=new T.Points(sg,new T.ShaderMaterial({uniforms:starU,vertexShader:STAR_V,fragmentShader:STAR_F,vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));
  stars.renderOrder=-8; stars.frustumCulled=false; scene.add(stars); W.stars=stars; W.starU=starU;
  // 流れ星
  var shGeo=new T.BufferGeometry(); shGeo.setAttribute('position',new T.BufferAttribute(new Float32Array(3*2*3),3)); shGeo.setAttribute('color',new T.BufferAttribute(new Float32Array(3*2*3),3));
  var shoot=new T.LineSegments(shGeo,new T.LineBasicMaterial({vertexColors:true,transparent:true,blending:T.AdditiveBlending,depthWrite:false}));
  shoot.frustumCulled=false; shoot.renderOrder=-7; scene.add(shoot); W.shoot=shoot; W.shootS=[{t:-1,d:0,x:0,y:0,z:0,vx:0,vy:0,vz:0},{t:-1,d:0},{t:-1,d:0}];
  // 太陽・月
  var sunSpr=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(radial(256,[[0,'rgba(255,255,245,1)'],[0.12,'rgba(255,245,200,0.95)'],[0.3,'rgba(255,200,120,0.35)'],[1,'rgba(255,170,80,0)']])),blending:T.AdditiveBlending,depthWrite:false,transparent:true}));
  sunSpr.scale.set(2200,2200,1); sunSpr.renderOrder=-6; scene.add(sunSpr); W.sunSpr=sunSpr;
  var moon=new T.Mesh(new T.SphereGeometry(300,24,16),new T.MeshLambertMaterial({map:new T.CanvasTexture(moonTexture()),emissive:0x222228}));
  moon.renderOrder=-5; scene.add(moon); W.moon=moon;
  var moonGlow=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(radial(128,[[0,'rgba(200,215,255,0.55)'],[0.4,'rgba(170,190,255,0.18)'],[1,'rgba(150,170,255,0)']])),blending:T.AdditiveBlending,depthWrite:false,transparent:true}));
  moonGlow.scale.set(1500,1500,1); moonGlow.renderOrder=-6; scene.add(moonGlow); W.moonGlow=moonGlow;
  W.sunDir=ll2v(233,8,new T.Vector3()); W.moonDir=ll2v(378,24,new T.Vector3());
  if(onStep) onStep(3);

  // 光
  var hemi=new T.HemisphereLight(0xbcd8ff,0x223344,0.8); scene.add(hemi); W.hemi=hemi;
  var sunL=new T.DirectionalLight(0xfff1d6,1.2); sunL.position.copy(W.sunDir).multiplyScalar(3000); scene.add(sunL); W.sunL=sunL;
  var moonL=new T.DirectionalLight(0x8fa8ff,0.0); moonL.position.copy(W.moonDir).multiplyScalar(3000); scene.add(moonL); W.moonL=moonL;
  scene.fog=new T.Fog(0x9cc8ff,230,1500);

  // 名所モデル・ゲート輪
  var Ms=new Merger(), Gls=new Merger(), k, mm=new T.Matrix4(), bas=new T.Matrix4(), pos=new T.Vector3(), up=new T.Vector3(), fw=new T.Vector3(), rt=new T.Vector3(), nf=new T.Vector3();
  W.lmGroups=[];
  for(k=0;k<LM.length;k++){
    var mA=new Merger(), gA=new Merger(); LMB[LM[k].id](mA,gA);
    G.place(lmS[k],0,0,pos,up,fw,rt); nf.copy(fw).negate(); bas.makeBasis(rt,up,nf); bas.setPosition(pos);
    var gm=mA.geometry(), mesh=new T.Mesh(gm,G.matLit); mesh.applyMatrix4(bas); scene.add(mesh);
    var gg=gA.geometry(), gmesh=new T.Mesh(gg,G.matGlow); gmesh.applyMatrix4(bas); scene.add(gmesh);
    W.lmGroups.push(mesh);
  }
  // スタートの目印（東京タワーの手前）— 市街
  // ゲートの輪
  var ringMats={
    a:new T.MeshBasicMaterial({color:0x55ddff,transparent:true,opacity:0.95,fog:false}),
    b:new T.MeshBasicMaterial({color:0x66ff9a,transparent:true,opacity:0.95,fog:false}),
    next:new T.MeshBasicMaterial({color:0xffe14a,fog:false}),
    done:new T.MeshBasicMaterial({color:0x335577,transparent:true,opacity:0.35,fog:false}),
    miss:new T.MeshBasicMaterial({color:0xaa3344,transparent:true,opacity:0.45,fog:false})
  };
  W.ringMats=ringMats;
  var geoCache={};
  for(i=0;i<G.gates.length;i++){
    var g=G.gates[i], kind=g.lm>=0?LM[g.lm].kind:'circle', big=g.lm>=0, key=kind+(big?'L':'N');
    if(!geoCache[key]) geoCache[key]=ringGeometry(kind,big?16:14,big?1.7:1.1);
    var rmesh=new T.Mesh(geoCache[key],big?new T.MeshBasicMaterial({vertexColors:true,color:LM[g.lm].col,fog:false}):(i%2?ringMats.a:ringMats.b));
    g.base=big?rmesh.material:(i%2?ringMats.a:ringMats.b);
    if(big){ rmesh.material=new T.MeshBasicMaterial({color:LM[g.lm].col,fog:false}); g.base=rmesh.material; }
    G.place(g.s,g.x,g.h,pos,up,fw,rt); nf.copy(fw).negate(); bas.makeBasis(rt,up,nf); bas.setPosition(pos);
    rmesh.applyMatrix4(bas); rmesh.matrixAutoUpdate=false; rmesh.updateMatrix(); rmesh.renderOrder=4; scene.add(rmesh); g.mesh=rmesh; g.hit=false;
    g.pos=pos.clone();
  }
  // 出発・ゴールの目印
  var fin=new Merger();
  for(i=-1;i<=1;i+=2){ fin.part('box',i*34,22,0,3,44,3,0x222222); }
  var sq=0; for(var cx=-34;cx<34;cx+=4){ for(var cy=0;cy<2;cy++){ fin.part('box',cx+2,44-cy*4-2,0,4,4,2,((cx/4+cy)&1)?0x111111:0xffffff); } }
  fin.part('box',0,38,0,72,10,1.2,0x222222);
  G.place(G.FIN,0,0,pos,up,fw,rt); nf.copy(fw).negate(); bas.makeBasis(rt,up,nf); bas.setPosition(pos);
  var finMesh=new T.Mesh(fin.geometry(),new T.MeshLambertMaterial({vertexColors:true})); finMesh.applyMatrix4(bas); scene.add(finMesh);

  // 地形の飾り（海岸線に沿って）
  var dec=new Merger(), rd=G.rng(555), sPos=new T.Vector3(), lon, lat, tries;
  function surf(s,x){ G.place(s,x,0,pos,up,fw,rt); }
  function ground(){ lat=Math.asin(up.y)/D2R; lon=Math.atan2(-up.z,up.x)/D2R; return landAt(lon,lat); }
  function putMatrix(h){ nf.copy(fw).negate(); bas.makeBasis(rt,up,nf); bas.setPosition(pos.clone().addScaledVector(up,-0.5)); return bas; }
  var nCl=hi?260:130, c2;
  for(c2=0;c2<nCl;c2++){
    var kindR=rd(), mh=40+rd()*80, mr=mh*(0.7+rd()*0.35), s0=rd()*L, x0=(rd()<0.5?-1:1)*(58+rd()*150+(kindR>=0.55&&kindR<0.78?mr:0)); surf(s0,x0);
    var isLand=ground(); if(!isLand||Math.abs(lat)>68){ if(!isLand&&rd()<0.07){ // 船
        putMatrix();
        var q=new Merger(); q.part('box',0,1.4,0,3.2,2.8,9,0xeeeeee); q.part('box',0,3.6,-1,2.4,2.2,3,0x2b4a6e); q.part('box',0,2.4,3,2.6,1.2,2.4,0xc03030);
        var qg=q.geometry(), pa=qg.attributes.position, pn=qg.attributes.normal; qg.applyMatrix4(bas);
        for(var z=0;z<pa.count;z++){ dec.p.push(pa.getX(z),pa.getY(z),pa.getZ(z)); dec.n.push(pn.getX(z),pn.getY(z),pn.getZ(z)); dec.c.push(qg.attributes.color.getX(z),qg.attributes.color.getY(z),qg.attributes.color.getZ(z)); }
      } continue; }
    var cluster=new Merger(), cnt, j, cx2, cz2;
    if(kindR<0.55){ // 森
      cnt=7+(rd()*7|0); var big2=Math.abs(lat)>52;
      for(j=0;j<cnt;j++){ cx2=(rd()-0.5)*60; cz2=(rd()-0.5)*60; var th=10+rd()*16, col=big2?0x2d5a44:(Math.abs(lat)<14?0x1f6b2e:(rd()<0.5?0x2f7a3a:0x3e8a40));
        cluster.part('cyl',cx2,2,cz2,0.8,4,0.8,0x5a3e28,0,0,0,5); cluster.part('cone',cx2,th*0.55+3,cz2,th*0.34,th,th*0.34,col,0,0,0,6); }
    } else if(kindR<0.78){ // 山
      cluster.part('cone',0,mh/2-3,0,mr,mh,mr,0x7b7266,0,rd()*3,0,6);
      if(mh>70) cluster.part('cone',0,mh-mh*0.17-3,0,mr*0.34,mh*0.34,mr*0.34,0xf2f4f8,0,0,0,6);
    } else if(kindR<0.9){ // 砂丘・岩
      cnt=3+(rd()*3|0); for(j=0;j<cnt;j++){ cx2=(rd()-0.5)*50; cz2=(rd()-0.5)*50; var rs=8+rd()*14; cluster.part('sph',cx2,0,cz2,rs*1.6,rs*0.5,rs*1.2,Math.abs(lat)<35?0xc8a45e:0x8a8478,0,rd()*3,0,6); }
    } else { // 町
      cnt=8+(rd()*8|0); for(j=0;j<cnt;j++){ cx2=(rd()-0.5)*70; cz2=(rd()-0.5)*70; var bh=8+rd()*34, bw=8+rd()*9; cluster.part('box',cx2,bh/2,cz2,bw,bh,bw,[0x8b95a5,0x9aa3b2,0xb8b4aa,0x7d8697][(rd()*4)|0]); }
    }
    putMatrix(); var cg=cluster.geometry(); cg.applyMatrix4(bas);
    var pa2=cg.attributes.position, pn2=cg.attributes.normal, pc2=cg.attributes.color;
    for(var z2=0;z2<pa2.count;z2++){ dec.p.push(pa2.getX(z2),pa2.getY(z2),pa2.getZ(z2)); dec.n.push(pn2.getX(z2),pn2.getY(z2),pn2.getZ(z2)); dec.c.push(pc2.getX(z2),pc2.getY(z2),pc2.getZ(z2)); }
    cg.dispose();
  }
  // 海の上の島（太平洋・大西洋の長い区間が単調にならないように）
  var nIsl=hi?90:50, il;
  for(il=0;il<nIsl;il++){
    var si=rd()*L, xi=(rd()<0.5?-1:1)*(62+rd()*130); surf(si,xi); if(ground()) continue;
    var cl=new Merger(), isz=14+rd()*26, vol=rd()<0.3;
    cl.part('cyl',0,0.4,0,isz*1.3,2.4,isz*1.3,0x3fa6c8,0,0,0,10); cl.part('cyl',0,1.4,0,isz,2.4,isz,0xe6d6a0,0,0,0,10);
    cl.part('cone',0,isz*0.45,0,isz*0.7,isz*(vol?1.5:0.8),isz*0.7,vol?0x6b5a4a:0x3a8a46,0,rd()*3,0,7);
    if(vol) cl.part('cone',0,isz*1.25,0,isz*0.18,isz*0.3,isz*0.18,0xd8d8d8,0,0,0,6);
    for(var pj=0;pj<2+(rd()*4|0);pj++){ var pa=rd()*TAU, pr=isz*(0.55+rd()*0.35), px=Math.cos(pa)*pr, pz=Math.sin(pa)*pr; cl.part('cyl',px,5,pz,0.7,9,0.7,0x6a4a2a,0,0,0,5); cl.part('cone',px,10.5,pz,3.4,3.2,3.4,0x2f8a3a,Math.PI,0,0,6); }
    putMatrix(); var ig=cl.geometry(); ig.applyMatrix4(bas); var ipa=ig.attributes.position, ipn=ig.attributes.normal, ipc=ig.attributes.color;
    for(var iz=0;iz<ipa.count;iz++){ dec.p.push(ipa.getX(iz),ipa.getY(iz),ipa.getZ(iz)); dec.n.push(ipn.getX(iz),ipn.getY(iz),ipn.getZ(iz)); dec.c.push(ipc.getX(iz),ipc.getY(iz),ipc.getZ(iz)); } ig.dispose();
  }
  var decMesh=new T.Mesh(dec.geometry(),G.matLit); scene.add(decMesh); W.dec=decMesh;
  // 名所まわりの町（暗くなると灯りがつく）
  var city=new Merger(), lights=new Merger();
  for(k=0;k<LM.length;k++){
    for(var cn=0;cn<(hi?64:32);cn++){
      var ang=rd()*TAU, rad=95+rd()*190; var xs=Math.cos(ang)*rad, zs=Math.sin(ang)*rad; if(Math.abs(xs)<70&&Math.abs(zs)<130) continue;
      var xo=xs, so=lmS[k]+zs; surf(so,xo); if(!ground()&&k!==1&&k!==2) continue;
      var bh2=12+Math.pow(rd(),2)*100, bw2=9+rd()*13; var cb=new Merger(); cb.part('box',0,bh2/2,0,bw2,bh2,bw2,[0x8b95a5,0xa6a9b4,0xb8b4aa,0x7d8697][(rd()*4)|0]);
      cb.part('box',0,bh2+.7,0,bw2*1.06,1.4,bw2*1.06,0x29374b);
      var lt=new Merger();
      lt.part('sph',0,bh2+2,0,.6,.8,.6,0xff7141,0,0,0,4);
      putMatrix(); [cb,lt].forEach(function(mg,qi){ var cg2=mg.geometry(); cg2.applyMatrix4(bas); var tgt=qi?lights:city, pa3=cg2.attributes.position, pn3=cg2.attributes.normal, pc3=cg2.attributes.color; for(var z3=0;z3<pa3.count;z3++){ tgt.p.push(pa3.getX(z3),pa3.getY(z3),pa3.getZ(z3)); tgt.n.push(pn3.getX(z3),pn3.getY(z3),pn3.getZ(z3)); tgt.c.push(pc3.getX(z3),pc3.getY(z3),pc3.getZ(z3)); } cg2.dispose(); });
    }
  }
  var cityMat=new T.MeshLambertMaterial({vertexColors:true});
  var cityNight={value:0};
  cityMat.onBeforeCompile=function(sh){
    sh.uniforms.uCityNight=cityNight;
    sh.vertexShader='varying vec3 vCityP,vCityN;\n'+sh.vertexShader;
    sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCityP=position;vCityN=normal;');
    sh.fragmentShader='uniform float uCityNight;varying vec3 vCityP,vCityN;\n'+sh.fragmentShader;
    sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\nvec3 up=normalize(vCityP);float roof=abs(dot(normalize(vCityN),up));float wx=fract(atan(vCityP.z,vCityP.x)*1900.0/4.5);float wy=fract((length(vCityP)-1900.0)/4.8);float win=step(.22,wx)*step(wx,.72)*step(.22,wy)*step(wy,.68)*(1.0-step(.8,roof));diffuseColor.rgb*=1.0-win*.36;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb+=vec3(1.0,.65,.28)*win*uCityNight*.85;');
  };
  scene.add(new T.Mesh(city.geometry(),cityMat));
  W.cityLights=new T.Mesh(lights.geometry(),new T.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:0.0,fog:false})); scene.add(W.cityLights);

  // 霞のある雲。球の集合から1 draw callのポイント群へ置換。
  var cvCloud=document.createElement('canvas');cvCloud.width=cvCloud.height=128;
  var cxCloud=cvCloud.getContext('2d'),cr=G.rng(90);
  for(i=0;i<38;i++){var xx=28+cr()*72,yy=42+cr()*44,rr=12+cr()*20;
    var gr=cxCloud.createRadialGradient(xx,yy,0,xx,yy,rr);gr.addColorStop(0,'rgba(255,255,255,.24)');gr.addColorStop(1,'rgba(255,255,255,0)');cxCloud.fillStyle=gr;cxCloud.fillRect(xx-rr,yy-rr,rr*2,rr*2);}
  var np=hi?160:80,cpp=new Float32Array(np*3),cps=new Float32Array(np);
  for(i=0;i<np;i++){G.place(rd()*L,(rd()<.5?-1:1)*(150+rd()*300),65+rd()*110,pos,up,fw,rt);cpp[i*3]=pos.x;cpp[i*3+1]=pos.y;cpp[i*3+2]=pos.z;cps[i]=35+rd()*75;}
  var cpg=new T.BufferGeometry();cpg.setAttribute('position',new T.BufferAttribute(cpp,3));cpg.setAttribute('sz',new T.BufferAttribute(cps,1));
  var cloudU={tex:{value:new T.CanvasTexture(cvCloud)},scale:{value:300},tint:{value:new T.Color(0xffffff)},fogCol:{value:new T.Color(0x9cc8ff)}};
  var puffMesh=new T.Points(cpg,new T.ShaderMaterial({uniforms:cloudU,transparent:true,depthWrite:false,
    vertexShader:'attribute float sz;uniform float scale;varying float dep;void main(){vec4 p=modelViewMatrix*vec4(position,1.);dep=-p.z;gl_PointSize=clamp(sz*scale/max(1.,-p.z),1.,512.);gl_Position=projectionMatrix*p;}',
    fragmentShader:'uniform sampler2D tex;uniform vec3 tint,fogCol;varying float dep;void main(){vec4 c=texture2D(tex,gl_PointCoord);float fade=smoothstep(15.,65.,dep)*(1.-smoothstep(1000.,1800.,dep));gl_FragColor=vec4(mix(tint,fogCol,smoothstep(250.,1400.,dep)),c.a*.82*fade);}'
  }));puffMesh.frustumCulled=false;scene.add(puffMesh);W.puffs=puffMesh;
  // 流れる近景の航路灯。丸い光と細い支柱で地面との距離を読ませる。
  var beacons=new Merger();
  for(i=0;i<120;i++){var bs=i/120*L;G.place(bs,(i%2?1:-1)*73,0,pos,up,fw,rt);nf.copy(fw).negate();bas.makeBasis(rt,up,nf);bas.setPosition(pos);var bm=new Merger();bm.part('cyl',0,8,0,.4,16,.4,0x253b52,0,0,0,4);bm.part('sph',0,17,0,1.7,1.1,1.7,i%2?0xffa967:0x5ae0fa,0,0,0,6);beacons.append(bm,bas);}
  scene.add(new T.Mesh(beacons.geometry(),G.matGlow));
  if(onStep) onStep(4);

  /* ----- 毎フレーム: 空・光・霧の更新 ----- */
  var camUp=new T.Vector3(), col1=new T.Color(), colN=new T.Color(0x04070f), colD=new T.Color(0x9cc8ff), colT=new T.Color(0xff9a58);
  W.dayK=1; W.starA=0;
  W.update=function(cam,t,pxScale,dt,player){
    W.waterTime.value=t;cloudU.scale.value=renderer.domElement.height/(2*Math.tan(cam.fov*Math.PI/360));
    camUp.copy(cam.position).normalize();
    var alt=camUp.dot(W.sunDir), day=smooth(-0.14,0.22,alt), twil=smooth(0.3,0.0,Math.abs(alt+0.02));
    W.dayK=day; W.starA=clamp(1-(alt+0.12)/0.3,0,1);
    var h=cam.position.length(); var limb=-Math.sqrt(Math.max(0,1-Math.pow(R/h,2)));
    skyU.uSun.value.copy(W.sunDir); skyU.uUp.value.copy(camUp); skyU.uLimb.value=limb; skyU.uDay.value=day; skyU.uTwil.value=twil;
    sky.position.copy(cam.position); milky.position.copy(cam.position); stars.position.copy(cam.position);
    milkyMat.opacity=0.95*W.starA; starU.uA.value=W.starA; starU.uT.value=t; starU.uPx.value=pxScale; stars.visible=W.starA>0.01; milky.visible=W.starA>0.01;
    sunSpr.position.copy(cam.position).addScaledVector(W.sunDir,6500); sunSpr.scale.setScalar(2200*(1+0.35*twil));
    moon.position.copy(cam.position).addScaledVector(W.moonDir,6000); moonGlow.position.copy(moon.position);
    moonGlow.material.opacity=0.4+0.6*W.starA;
    hemi.intensity=0.62+0.4*day; sunL.intensity=1.25*smooth(-0.06,0.2,alt); moonL.intensity=0.7*(1-day);
    sunL.color.setHex(0xfff1d6).lerp(colT,twil*0.7);
    // 霧の色 = 地平線の空色
    col1.copy(colN).lerp(colD,day).lerp(colT,twil*0.55); scene.fog.color.copy(col1);cloudU.fogCol.value.copy(col1);cloudU.tint.value.setRGB(.46+.54*day,.55+.45*day,.72+.28*day);
    W.cityLights.material.opacity=clamp(1-day*1.4,0,1);cityNight.value=clamp(1-day*1.4,0,1);
    cloud.rotation.y+=dt*0.003; lightsMat.uniforms.uSun.value.copy(W.sunDir);
    cloudMat.color.setRGB(0.35+0.65*day,0.38+0.62*day,0.5+0.5*day);
    // 流れ星
    var pos2=shoot.geometry.attributes.position.array, col2=shoot.geometry.attributes.color.array;
    for(var si=0;si<3;si++){
      var o=W.shootS[si];
      if(o.t<0){ if(W.starA>0.6&&Math.random()<dt*0.12){ o.t=0; o.d=0.9+Math.random()*0.5; var a=Math.random()*TAU, e=0.25+Math.random()*0.6; o.x=Math.cos(a)*5200; o.z=Math.sin(a)*5200; o.y=e*5200; o.vx=(Math.random()-0.5)*3600; o.vy=-1200-Math.random()*1400; o.vz=(Math.random()-0.5)*3600; } }
      else { o.t+=dt; if(o.t>o.d) o.t=-1; }
      var b=si*6;
      if(o.t>=0){ var k2=o.t, f=1-o.t/o.d; pos2[b]=cam.position.x+o.x+o.vx*k2; pos2[b+1]=cam.position.y+o.y+o.vy*k2; pos2[b+2]=cam.position.z+o.z+o.vz*k2;
        pos2[b+3]=pos2[b]-o.vx*0.14; pos2[b+4]=pos2[b+1]-o.vy*0.14; pos2[b+5]=pos2[b+2]-o.vz*0.14;
        col2[b]=col2[b+1]=col2[b+2]=f; col2[b+3]=col2[b+4]=col2[b+5]=0; }
      else { for(var q=0;q<6;q++){ pos2[b+q]=0; col2[b+q]=0; } }
    }
    shoot.geometry.attributes.position.needsUpdate=true; shoot.geometry.attributes.color.needsUpdate=true;
  };
  done(W);
  });
};
})();
