/* 250-hoshimeguri-kokai-nisshiから再利用: 球面ノイズ・惑星材質。327用に512/256pxへ縮小。 */
(function(){'use strict';
const G=window.G,THREE=window.THREE,TAU=Math.PI*2,clamp=G.clamp,lerp=(a,b,t)=>a+(b-a)*t;
function hash2(x,y,s){ const n = Math.sin(x*127.1+y*311.7+s*74.7)*43758.5453123; return n-Math.floor(n); }
function planetNoise(x,y,s){
  const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi;
  const u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf);
  const a=hash2(xi,yi,s), b=hash2(xi+1,yi,s), c=hash2(xi,yi+1,s), d=hash2(xi+1,yi+1,s);
  return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v;
}
function fbm(x,y,s,oct){
  let sum=0, amp=0.5, f=1, norm=0;
  for(let i=0;i<(oct||4);i++){ sum+=amp*planetNoise(x*f,y*f,s+i*13); norm+=amp; f*=2.03; amp*=0.5; }
  return sum/norm;
}

/* ── 球面用の3Dノイズ ────────────────────────────
   惑星テクスチャは UV ではなく球面上の座標で引く。UVで引くと極で模様が
   一点に集まり赤道で横に伸びて、「地図を貼った球」に見えてしまう。 */
function h3(x,y,z){
  let n = Math.imul(x|0, 374761393) ^ Math.imul(y|0, 668265263) ^ Math.imul(z|0, 1442695041);
  n = Math.imul(n ^ (n>>>13), 1274126177);
  n ^= n>>>16;
  return (n>>>0)/4294967296;
}
function vnoise3(x,y,z){
  const xi=Math.floor(x), yi=Math.floor(y), zi=Math.floor(z);
  const xf=x-xi, yf=y-yi, zf=z-zi;
  const u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf), w=zf*zf*(3-2*zf);
  const c000=h3(xi,yi,zi),   c100=h3(xi+1,yi,zi),   c010=h3(xi,yi+1,zi),   c110=h3(xi+1,yi+1,zi);
  const c001=h3(xi,yi,zi+1), c101=h3(xi+1,yi,zi+1), c011=h3(xi,yi+1,zi+1), c111=h3(xi+1,yi+1,zi+1);
  const a0=c000+(c100-c000)*u, a1=c010+(c110-c010)*u, b0=c001+(c101-c001)*u, b1=c011+(c111-c011)*u;
  const y0=a0+(a1-a0)*v, y1=b0+(b1-b0)*v;
  return y0+(y1-y0)*w;
}
/* オクターブごとに座標を回す。回さないと値ノイズの格子が縦横の筋として残り、
   拡大したとき方眼紙の目が見えてしまう。 */
const RCY=0.7648, RSY=0.6442, RCX=0.4536, RSX=0.8912;
function fbm3(x,y,z,oct){
  let sum=0, amp=0.5, f=1, norm=0, px=x, py=y, pz=z;
  for(let i=0;i<oct;i++){
    sum += amp*vnoise3(px*f, py*f, pz*f); norm += amp; f *= 2.03; amp *= 0.5;
    const ax = px*RCY + pz*RSY, az = pz*RCY - px*RSY, ay = py;
    px = ax + 17.3; py = ay*RCX - az*RSX - 11.7; pz = ay*RSX + az*RCX + 23.1;
  }
  return sum/norm;
}
function ridge3(x,y,z,oct){
  let sum=0, amp=0.5, f=1, norm=0, px=x, py=y, pz=z;
  for(let i=0;i<oct;i++){
    const n = 1-Math.abs(vnoise3(px*f, py*f, pz*f)*2-1);
    sum += amp*n*n; norm += amp; f *= 2.07; amp *= 0.5;
    const ax = px*RCY + pz*RSY, az = pz*RCY - px*RSY, ay = py;
    px = ax + 7.1; py = ay*RCX - az*RSX + 3.3; pz = ay*RSX + az*RCX - 9.9;
  }
  return sum/norm;
}
const TEXCACHE = {};
const TEXW = 512;                       // 経度方向の解像度（緯度はこの半分）

function mkCv(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }
function cvTexture(cv, isColor){
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = 4; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  // 色を載せる絵だけ sRGB と伝える。既定の Linear のままだと全部が白っぽく浮く
  if(isColor && THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
  return t;
}
/* 明度で振った色を先に並べておく（1画素ごとにHSL変換すると重い） */
function shadeLut(hex, lo, hi, sat, n){
  const base = new THREE.Color(hex), hsl = {}; base.getHSL(hsl);
  const N = n||64, d = new Uint8Array(N*3), c = new THREE.Color();
  for(let i=0;i<N;i++){
    const l = lo + (hi-lo)*(i/(N-1));
    c.setHSL(hsl.h, clamp(hsl.s*(sat===undefined?1:sat),0,1), clamp(hsl.l*l,0.015,0.985));
    d[i*3]=c.r*255; d[i*3+1]=c.g*255; d[i*3+2]=c.b*255;
  }
  return { d:d, N:N, lo:lo, span:(hi-lo)||1 };
}
/* 基準色そのものの明度。淡い色の星（土星・金星）は倍率で持ち上げると白く飛ぶ */
function baseLight(hex){ const c=new THREE.Color(hex), h={}; c.getHSL(h); return h.l||0.5; }
function lutAt(L,l){
  let i = Math.round((l-L.lo)/L.span*(L.N-1));
  if(i<0) i=0; else if(i>=L.N) i=L.N-1;
  return i*3;
}
/* 経度方向にラップする楕円スタンプ（大赤斑・大暗斑・白斑） */
function stampOval(D,W,H,o,s0){
  const reach = 1.3;
  const y0 = Math.max(0, Math.floor((0.5-(o.la+o.rt*reach)/Math.PI)*H));
  const y1 = Math.min(H-1, Math.ceil((0.5-(o.la-o.rt*reach)/Math.PI)*H));
  for(let y=y0;y<=y1;y++){
    const lat = (0.5-(y+0.5)/H)*Math.PI, cl = Math.max(0.12, Math.cos(lat));
    const dyn = (lat-o.la)/o.rt;
    const xc = (o.lo/TAU)*W, xw = Math.min(W>>1, Math.ceil(o.rl*reach/cl/TAU*W));
    for(let dx=-xw;dx<=xw;dx++){
      let xi = Math.round(xc+dx); xi = ((xi%W)+W)%W;
      let dl = ((xi+0.5)/W)*TAU - o.lo;
      while(dl> Math.PI) dl -= TAU;
      while(dl<-Math.PI) dl += TAU;
      const dxn = dl*cl/o.rl, rr = Math.sqrt(dxn*dxn+dyn*dyn);
      if(rr>reach) continue;
      const ang = Math.atan2(dyn,dxn) + (1.25-rr)*1.6;           // 内側ほど強く巻く
      const sr = rr + (fbm3(Math.cos(ang)*rr*3.2+s0, Math.sin(ang)*rr*3.2, rr*4.1, 3)-0.5)*0.34;
      if(sr>1.02) continue;
      const t = clamp((1.02-sr)/0.42, 0, 1) * (o.a===undefined?1:o.a);
      const core = o.core ? clamp(1-sr/0.5,0,1) : 0;
      const p = (y*W+xi)*4;
      for(let k=0;k<3;k++){
        const tgt = o.core ? lerp(o.c[k], o.core[k], core) : o.c[k];
        D[p+k] = lerp(D[p+k], tgt, t);
      }
    }
  }
}
/* 黒点：暗部＋放射状のフィラメントを持つ半暗部 */
function stampSunspot(D,W,H,la,lo,rad,s0){
  const reach = 1.55;
  const y0 = Math.max(0, Math.floor((0.5-(la+rad*reach)/Math.PI)*H));
  const y1 = Math.min(H-1, Math.ceil((0.5-(la-rad*reach)/Math.PI)*H));
  for(let y=y0;y<=y1;y++){
    const lat = (0.5-(y+0.5)/H)*Math.PI, cl = Math.max(0.12, Math.cos(lat));
    const dyn = (lat-la)/rad;
    const xc = (lo/TAU)*W, xw = Math.min(W>>1, Math.ceil(rad*reach/cl/TAU*W));
    for(let dx=-xw;dx<=xw;dx++){
      let xi = Math.round(xc+dx); xi = ((xi%W)+W)%W;
      let dl = ((xi+0.5)/W)*TAU - lo;
      while(dl> Math.PI) dl -= TAU;
      while(dl<-Math.PI) dl += TAU;
      const dxn = dl*cl/rad, rr = Math.sqrt(dxn*dxn+dyn*dyn);
      if(rr>reach) continue;
      const ang = Math.atan2(dyn,dxn);
      const fil = 0.5 + 0.5*Math.cos(ang*19 + rr*7 + s0);        // 半暗部の筋
      const edge = rr + (fbm3(Math.cos(ang)*2.6+s0, Math.sin(ang)*2.6, 7.7, 3)-0.5)*0.4;
      const p = (y*W+xi)*4;
      if(edge < 0.52){                                            // 暗部
        const t = clamp((0.52-edge)/0.2, 0, 1)*0.94;
        D[p]=lerp(D[p],52,t); D[p+1]=lerp(D[p+1],18,t); D[p+2]=lerp(D[p+2],8,t);
      } else if(edge < 1.0){                                      // 半暗部
        const t = clamp((1.0-edge)/0.5,0,1)*(0.34+fil*0.34);
        D[p]=lerp(D[p],150,t); D[p+1]=lerp(D[p+1],74,t); D[p+2]=lerp(D[p+2],20,t);
      } else {                                                    // 白斑（明るい網目）
        const t = clamp((1.45-edge)/0.45,0,1)*0.22*fil;
        D[p]=lerp(D[p],255,t); D[p+1]=lerp(D[p+1],250,t); D[p+2]=lerp(D[p+2],226,t);
      }
    }
  }
}

function planetMaps(kind, hex, seed, id){
  const ck = kind+'|'+hex+'|'+seed+'|'+(id||'');
  if(TEXCACHE[ck]) return TEXCACHE[ck];
  const W = (kind==='band'||kind==='earth')?TEXW:256, H = W>>1, NP = W*H;
  const cv = mkCv(W,H), ctx = cv.getContext('2d');
  const img = ctx.createImageData(W,H), D = img.data;
  const s0 = 13.7 + seed*5.3;
  const out = { map:null, bump:null, air:false, bumpScale:0.5 };

  if(kind==='rock' || kind==='ice'){
    /* 岩と氷：高度場を作り、クレーターを掘り、そこから色と凹凸を焼く */
    const isIce = (kind==='ice');
    const hA = new Float32Array(NP), dA = new Float32Array(NP),   // hA=大地形（色） dA=細部（凹凸）
          aA = new Float32Array(NP), xA = new Float32Array(NP);
    const kA = new Uint8Array(NP);                 // 0=地面 1=氷 2=リネア
    const bigF = isIce ? 2.6 : 1.9;
    for(let y=0,i=0;y<H;y++){
      const lat=(0.5-(y+0.5)/H)*Math.PI, cl=Math.cos(lat), sy=Math.sin(lat);
      for(let x=0;x<W;x++,i++){
        const lon=((x+0.5)/W)*TAU, cx=cl*Math.cos(lon), cz=cl*Math.sin(lon);
        let h = (fbm3(cx*bigF+s0, sy*bigF, cz*bigF, 4)-0.5)*1.3;
        let d = (ridge3(cx*6.4+s0, sy*6.4, cz*6.4, 3)-0.5)*0.30
              + (fbm3(cx*22+s0, sy*22, cz*22, 2)-0.5)*0.13;
        let a = 1;
        if(id==='moon'){                            // 海（マリア）＝暗く平らな溶岩平原
          const m = fbm3(cx*1.35+61, sy*1.35, cz*1.35, 2) + d*0.3;   // 細部で縁を崩す（真円に見せない）
          if(m>0.53){ const t=clamp((m-0.53)/0.08,0,1); h = h*(1-t*0.85)-0.34*t; d *= 1-t*0.7; a *= 1-0.30*t; }
        } else if(id==='mars'){                     // アルベド模様と極冠
          a *= 0.74 + fbm3(cx*1.7+29, sy*1.7, cz*1.7, 3)*0.62;   // シルチス的な暗い領域
          const cap = Math.abs(sy)-0.978 + (vnoise3(cx*9+5, sy*9, cz*9)-0.5)*0.030;
          if(cap>0){ kA[i]=1; xA[i]=clamp(cap/0.012,0,1); }
        } else if(id==='mercury'){
          a *= 0.90 + fbm3(cx*2.4+17, sy*2.4, cz*2.4, 2)*0.22;
        }
        if(isIce){                                  // リネア＝氷殻の裂け目。細く長い線にする
          // なめらかなノイズの等高線を拾う。閾値で切ると線が千切れて斑になるが、
          // 等高線なら全球を横切る長い曲線になる（リネアの見え方に近い）
          const f1 = fbm3(cx*1.15+s0, sy*1.15, cz*1.15, 2)*2.6;
          const f2 = fbm3(cx*2.3+s0+40, sy*2.3, cz*2.3, 2)*4.0;
          const v1 = clamp(1-Math.abs(f1-Math.round(f1))/0.055, 0, 1);
          const v2 = clamp(1-Math.abs(f2-Math.round(f2))/0.035, 0, 1)*0.55;
          const r = Math.max(v1, v2);
          if(r>0){ kA[i]=2; xA[i]=Math.pow(r,0.85); d -= 0.06*xA[i]; }
        }
        hA[i]=h; dA[i]=d; aA[i]=a;
      }
    }
    const nCr = isIce?16 : (id==='mercury'?88 : id==='mars'?26 : id==='phobos'?44 : 62);
    let rs = (seed*7919+3571)|0;
    const rnd = ()=>{ rs = (Math.imul(rs,1103515245)+12345)&0x7fffffff; return rs/0x7fffffff; };
    for(let c=0;c<nCr;c++){
      const clat = Math.asin(rnd()*2-1), clon = rnd()*TAU;
      const big = rnd()<0.18;                                            // 大物を何個か混ぜる
      const rr0 = (0.018 + Math.pow(rnd(), big?1.1:2.6)*0.15) * (isIce?0.75:1);   // 角半径[rad]
      const dep = rr0*(0.42+rnd()*0.5), reach = rr0*1.9;
      const y0 = Math.max(0, Math.floor((0.5-(clat+reach)/Math.PI)*H));
      const y1 = Math.min(H-1, Math.ceil((0.5-(clat-reach)/Math.PI)*H));
      const scl = Math.sin(clat), ccl = Math.cos(clat);
      for(let y=y0;y<=y1;y++){
        const lat=(0.5-(y+0.5)/H)*Math.PI, cl=Math.cos(lat), sy=Math.sin(lat);
        const xc = (clon/TAU)*W, xw = Math.min(W>>1, Math.ceil(reach/Math.max(0.12,cl)/TAU*W));
        for(let dx=-xw;dx<=xw;dx++){
          let xi = Math.round(xc+dx); xi = ((xi%W)+W)%W;
          const lon = ((xi+0.5)/W)*TAU;
          const d = Math.acos(clamp(scl*sy + ccl*cl*Math.cos(lon-clon), -1, 1));
          if(d>reach) continue;
          const i = y*W+xi, t = d/rr0;
          if(t<1){
            dA[i] -= dep*(1-t*t*1.08);                            // 椀
            if(t<0.2) dA[i] += dep*0.55*(1-t/0.2);                // 中央丘
            aA[i] *= 0.96;
          }
          if(t>0.78 && t<1.22){ dA[i] += dep*0.5*Math.sin((t-0.78)/0.44*Math.PI); aA[i] *= 1.045; }
          if(t>=1){ const u=clamp((1.9-t)/0.9,0,1); aA[i] *= 1+0.09*u*u; dA[i] += dep*0.05*u; }
        }
      }
    }
    let mn=1e9, mx=-1e9;
    for(let i=0;i<NP;i++){ const v=hA[i]+dA[i]*0.4; if(v<mn)mn=v; if(v>mx)mx=v; }
    const inv = 1/Math.max(1e-6, mx-mn);
    const LUT = shadeLut(hex, 0.42, isIce?1.12:1.18, isIce?0.42:0.98, 72);
    /* 裂け目の色。エウロパ・ガニメデの塩に汚れたリネアは赤茶だが、エンケラドスの
       タイガーストライプは下の海が透けた水色（2026-09-23 タイタン指示）。 */
    const LINEA = (id==='enceladus') ? [96,206,238] : [134,80,58];
    const bCv = mkCv(W,H), bCtx = bCv.getContext('2d'), bImg = bCtx.createImageData(W,H), BD = bImg.data;
    for(let i=0,p=0;i<NP;i++,p+=4){
      const hn = (hA[i]+dA[i]*0.4-mn)*inv;
      const q = lutAt(LUT, (isIce? 0.98+hn*0.12 : 0.94+hn*0.18) * aA[i]);
      let r=LUT.d[q], g2=LUT.d[q+1], b2=LUT.d[q+2];
      if(kA[i]===1){ const t=xA[i]; r=lerp(r,244,t); g2=lerp(g2,248,t); b2=lerp(b2,252,t); }
      else if(kA[i]===2){ const t=xA[i]*0.86;                 // リネア（氷殻の裂け目）
        r=lerp(r,LINEA[0],t); g2=lerp(g2,LINEA[1],t); b2=lerp(b2,LINEA[2],t); }
      D[p]=r; D[p+1]=g2; D[p+2]=b2; D[p+3]=255;
      // 凹凸は細部だけを使う。大地形まで入れるとクレーターが階調に埋もれる
      const bv = clamp(0.5 + (dA[i]*2.2 + hA[i]*0.35), 0, 1)*255;
      BD[p]=BD[p+1]=BD[p+2]=bv; BD[p+3]=255;
    }
    bCtx.putImageData(bImg,0,0);
    out.bump = cvTexture(bCv); out.bumpScale = isIce?0.42:0.85;

  } else if(kind==='earth'){
    /* 地球：大陸をひねったfbmで作り、緯度と標高で植生・砂漠・雪を分ける。
       海は粗さを下げて太陽を照り返す。雲だけ別の球に貼って独立に流す。 */
    const DEEP=[9,32,72], SHAL=[28,96,136], SAND=[196,174,118], GRAS=[64,106,58],
          FRST=[36,72,44], DRY=[160,126,74], TUND=[124,120,100], SNOW=[238,243,248];
    for(let y=0,p=0;y<H;y++){
      const lat=(0.5-(y+0.5)/H)*Math.PI, cl=Math.cos(lat), sy=Math.sin(lat), la=Math.abs(lat);
      for(let x=0;x<W;x++,p+=4){
        const lon=((x+0.5)/W)*TAU, cx=cl*Math.cos(lon), cz=cl*Math.sin(lon);
        const wp = (fbm3(cx*1.35+s0, sy*1.35, cz*1.35, 2)-0.5)*1.35;
        let cont = fbm3(cx*1.5+wp+s0, sy*1.5+wp*0.7, cz*1.5-wp, 5);
        cont += (ridge3(cx*4.4+s0, sy*4.4, cz*4.4, 2)-0.5)*0.09;
        cont = 0.5 + (cont-0.5)*1.5;                                // 海と陸をはっきり分ける
        let r,g2,b2;
        if(cont < 0.615){                                           // 海が約7割（地球は29%が陸）
          const dp = clamp((0.615-cont)/0.20, 0, 1);
          r=lerp(SHAL[0],DEEP[0],dp); g2=lerp(SHAL[1],DEEP[1],dp); b2=lerp(SHAL[2],DEEP[2],dp);

        } else {
          const e = clamp((cont-0.615)/0.20, 0, 1);
          const dry = fbm3(cx*3.6+41, sy*3.6, cz*3.6, 3);
          const desert = clamp(1-Math.abs(la-0.42)/0.26, 0, 1) * clamp(dry*2.1-0.58, 0, 1);
          const cold = clamp((la-0.95)/0.32, 0, 1);
          const t = clamp(dry*1.3, 0, 1);
          r=lerp(GRAS[0],FRST[0],t); g2=lerp(GRAS[1],FRST[1],t); b2=lerp(GRAS[2],FRST[2],t);
          r=lerp(r,DRY[0],desert);  g2=lerp(g2,DRY[1],desert);  b2=lerp(b2,DRY[2],desert);
          r=lerp(r,TUND[0],cold);   g2=lerp(g2,TUND[1],cold);   b2=lerp(b2,TUND[2],cold);
          const sh = clamp(1-(cont-0.615)/0.016, 0, 1)*0.6;                        // 海岸の砂
          r=lerp(r,SAND[0],sh); g2=lerp(g2,SAND[1],sh); b2=lerp(b2,SAND[2],sh);
          // 雪は高い山と高緯度だけ。低緯度の内陸まで白くすると星が病気に見える
          const av = clamp(clamp((e-0.88)/0.12,0,1)*0.75 + clamp((e-0.45)/0.4,0,1)*cold, 0, 1);
          r=lerp(r,SNOW[0],av); g2=lerp(g2,SNOW[1],av); b2=lerp(b2,SNOW[2],av);

        }
        const ice = Math.abs(sy)-0.945 + (vnoise3(cx*7+9, sy*7, cz*7)-0.5)*0.085; // 極冠
        if(ice>0){ const t=clamp(ice/0.030,0,1);
          r=lerp(r,SNOW[0],t); g2=lerp(g2,SNOW[1],t); b2=lerp(b2,SNOW[2],t);
        }
        // 雲。別の球に貼ると惑星の面積ぶん描画が1枚増えるので本体へ焼き込む。
        // 赤道と中緯度に多く、亜熱帯高圧帯は晴れる。経度方向に引き伸ばして流れを出す
        const zf = 0.5+0.5*Math.cos(la*5.2);
        let cn = fbm3(cx*2.9+71, sy*2.9*1.8, cz*2.9, 4);
        cn += (fbm3(cx*9+71, sy*9*1.8, cz*9, 2)-0.5)*0.22;
        const ca = clamp((cn-0.53+zf*0.13)*4.2, 0, 1)*0.92;
        if(ca>0){
          r=lerp(r,250,ca); g2=lerp(g2,252,ca); b2=lerp(b2,255,ca);
        }
        D[p]=r; D[p+1]=g2; D[p+2]=b2; D[p+3]=255;
      }
    }
    // 凹凸マップも鏡面マップも付けない。惑星規模では山の起伏は見えず、
    // 海の照り返しはマップにすると1画素あたりが重い（実測 49→31 RAF/秒）。
    // 海の光沢は材質側の一律 specular で出す
    out.air = true;
  } else if(kind==='band'){
    /* ガス惑星：緯度の帯をノイズで歪める（ゾーナルな流れ）。渦は後から押す */
    const P = ({
      jupiter:{n:4.6, warp:0.95, con:0.30, sat:1.10, pole:0.30, fine:0.15, uneven:0.8},
      saturn: {n:3.8, warp:0.65, con:0.17, sat:0.90, pole:0.26, fine:0.09, uneven:0.6},
      uranus: {n:2.2, warp:0.30, con:0.05, sat:0.70, pole:0.10, fine:0.03, uneven:0.3},
      neptune:{n:3.2, warp:0.55, con:0.15, sat:1.00, pole:0.18, fine:0.07, uneven:0.5}
    })[id] || {n:4.0, warp:0.7, con:0.22, sat:1, pole:0.2, fine:0.11, uneven:0.6};
    // 暗い帯（ベルト）は濃く、明るい帯（ゾーン）は白っぽく。明度だけ振ると平板になる。
    // ゾーンの明るさは絶対値で頭打ちにする（土星のような淡い基準色だと白飛びする）
    const bl = baseLight(hex), capZ = Math.min(1.24, 0.80/bl);
    const LUTd = shadeLut(hex, 0.32, Math.min(1.02, 0.56/bl), P.sat*1.3, 64);
    const LUTl = shadeLut(hex, Math.min(0.92, capZ*0.78), capZ, P.sat*0.72, 64);
    const st = 4.6;                                              // 経度方向へ引き伸ばす
    for(let y=0,p=0;y<H;y++){
      const lat=(0.5-(y+0.5)/H)*Math.PI, cl=Math.cos(lat), sy=Math.sin(lat);
      const poleK = 1-Math.pow(Math.abs(sy),6)*P.pole;
      for(let x=0;x<W;x++,p+=4){
        const lon=((x+0.5)/W)*TAU, cx=cl*Math.cos(lon), cz=cl*Math.sin(lon);
        const w1 = fbm3(cx*1.5+s0, sy*1.5*st, cz*1.5, 4)-0.5;
        const w2 = fbm3(cx*5.0+s0, sy*5.0*st, cz*5.0, 3)-0.5;
        // 帯の幅を不揃いにする（等間隔だとバーコードに見える）
        const bc = sy*P.n + Math.sin(sy*2.3+1.1)*P.uneven + w1*P.warp + w2*P.warp*0.45;
        let v = Math.sin(bc*Math.PI);
        v = (v<0?-1:1)*Math.pow(Math.abs(v),0.55);
        const l = (1 + v*P.con + w2*P.fine)*poleK;
        const qd = lutAt(LUTd,l), ql = lutAt(LUTl,l), mixw = clamp((l-0.94)/0.32, 0, 1);
        D[p]  =lerp(LUTd.d[qd],  LUTl.d[ql],  mixw);
        D[p+1]=lerp(LUTd.d[qd+1],LUTl.d[ql+1],mixw);
        D[p+2]=lerp(LUTd.d[qd+2],LUTl.d[ql+2],mixw);
        D[p+3]=255;
      }
    }
    const ovals = ({
      jupiter:[ {la:-0.36,lo:2.40,rl:0.52,rt:0.17,c:[188,94,62],core:[142,52,36]},
                {la: 0.30,lo:5.10,rl:0.17,rt:0.07,c:[238,228,208],a:0.8},
                {la:-0.64,lo:0.90,rl:0.12,rt:0.06,c:[234,222,200],a:0.7} ],
      saturn: [ {la: 0.34,lo:3.50,rl:0.22,rt:0.06,c:[242,230,198],a:0.6} ],
      /* 海王星の大暗斑（2026-09-23 拡大）。従来は rl 0.30 / rt 0.10 / 色(22,38,100) で、
         青い帯の中に埋もれて画面上ほぼ判別できなかった。Voyager 2 の写真どおり
         「地球がそのまま入る」大きさと濃さにし、縁へ寄り添う明るいメタンの巻雲を足す。 */
      /* 2026-09-23 再拡大。緯度 −0.38(−22°) は視野の下端に寄って周縁減光と混ざり、
         到着時に「暗い縁」としか見えなかった。−0.20(−11°) へ上げて円盤の中央に置く。 */
      /* 2026-09-23 実寸へ。大暗斑は約 13,000×6,600 km、海王星の半径は 24,622 km なので
         角半径は 6,500/24,622 = 0.264 rad ／ 3,300/24,622 = 0.134 rad。
         見かけの大きさ＝惑星の直径の約26%。濃さと緯度（円盤中央に来る −0.20）は
         「暗い縁にしか見えない」対策としてそのまま残す。 */
      neptune:[ {la:-0.20,lo:1.70,rl:0.264,rt:0.134,c:[11,22,70],core:[4,8,38]},
                {la:-0.31,lo:1.64,rl:0.12,rt:0.037,c:[238,246,253],a:0.88},   // 渦の南縁の巻雲
                {la:-0.11,lo:1.84,rl:0.075,rt:0.030,c:[230,240,251],a:0.72},  // 北縁の筋
                {la:-0.10,lo:2.45,rl:0.13,rt:0.055,c:[232,242,252],a:0.80},   // スクーター
                {la:-0.98,lo:4.30,rl:0.080,rt:0.050,c:[24,42,102],core:[13,25,74]} ],  // 小暗斑 D2
      uranus: []
    })[id] || [];
    for(const o of ovals) stampOval(D,W,H,o,s0);

  } else if(kind==='cloud'){
    /* 金星・タイタン：地表を見せない霞。強く経度方向へ流す */
    const LUT = shadeLut(hex, 0.60, Math.min(1.36, 0.84/baseLight(hex)), 0.95, 64);
    const st = 7.0, yk = (id==='venus')?1:0.3;
    for(let y=0,p=0;y<H;y++){
      const lat=(0.5-(y+0.5)/H)*Math.PI, cl=Math.cos(lat), sy=Math.sin(lat);
      const poleK = 1-Math.pow(Math.abs(sy),3.2)*0.22;
      for(let x=0;x<W;x++,p+=4){
        const lon=((x+0.5)/W)*TAU, cx=cl*Math.cos(lon), cz=cl*Math.sin(lon);
        const n1 = fbm3(cx*1.9+s0, sy*1.9*st, cz*1.9, 4)-0.5;
        const n2 = fbm3(cx*6.2+s0, sy*6.2*st, cz*6.2, 3)-0.5;
        const ych = Math.sin(lon - Math.abs(sy)*3.4 + n1*2.2);    // 金星のダークY
        const q = lutAt(LUT, (1 + n1*0.30 + n2*0.14 - Math.max(0,ych-0.55)*0.42*yk)*poleK);
        D[p]=LUT.d[q]; D[p+1]=LUT.d[q+1]; D[p+2]=LUT.d[q+2]; D[p+3]=255;
      }
    }

  } else if(kind==='star'){
    /* 太陽：粒状斑（対流の粒と暗いレーン）＋超粒状斑＋黒点。周縁減光は shader 側 */
    const K = [[0.00,58,10,2],[0.32,168,52,8],[0.58,238,128,30],
               [0.80,255,198,98],[1.00,255,238,198],[1.30,255,255,248]];
    for(let y=0,p=0;y<H;y++){
      const lat=(0.5-(y+0.5)/H)*Math.PI, cl=Math.cos(lat), sy=Math.sin(lat);
      for(let x=0;x<W;x++,p+=4){
        const lon=((x+0.5)/W)*TAU, cx=cl*Math.cos(lon), cz=cl*Math.sin(lon);
        const su   = fbm3(cx*2.6+s0, sy*2.6, cz*2.6, 3);                 // 超粒状斑
        const cell = fbm3(cx*24+s0, sy*24, cz*24, 2);                    // 粒
        const lane = ridge3(cx*24+s0, sy*24, cz*24, 1);                  // 粒の境界
        const fine = fbm3(cx*62+s0, sy*62, cz*62, 1);
        let t = 0.60 + su*0.26 + cell*0.28 + (fine-0.5)*0.10 - Math.pow(lane,2.2)*0.26;
        t += Math.max(0, fbm3(cx*7+31, sy*7, cz*7, 2)-0.62)*0.6;         // 明るい網目
        t = clamp(t, 0, 1.3);
        let k=0; while(k<K.length-2 && t>K[k+1][0]) k++;
        const u = clamp((t-K[k][0])/(K[k+1][0]-K[k][0]), 0, 1);
        D[p]  =lerp(K[k][1],K[k+1][1],u);
        D[p+1]=lerp(K[k][2],K[k+1][2],u);
        D[p+2]=lerp(K[k][3],K[k+1][3],u);
        D[p+3]=255;
      }
    }
    let rs = 9176;
    const rnd = ()=>{ rs = (Math.imul(rs,1103515245)+12345)&0x7fffffff; return rs/0x7fffffff; };
    for(let i=0;i<5;i++){                                                // 黒点は活動帯に群で並ぶ
      const la = (rnd()<0.5?1:-1)*(0.16+rnd()*0.30), lo = rnd()*TAU;
      const rad = 0.10+rnd()*0.09;
      stampSunspot(D, W, H, la, lo, rad, s0+i*3.1);
      const n = 1+((rnd()*3)|0);
      for(let k=0;k<n;k++)
        stampSunspot(D, W, H, la+(rnd()-0.5)*rad*2.6, lo+(rnd()-0.5)*rad*5.0,
                     rad*(0.3+rnd()*0.35), s0+i*3.1+k*1.7);
    }

  } else {
    /* 未知の種別：灰色の岩に落とす */
    const LUT = shadeLut(hex, 0.6, 1.4, 0.9, 48);
    for(let y=0,p=0;y<H;y++){
      const lat=(0.5-(y+0.5)/H)*Math.PI, cl=Math.cos(lat), sy=Math.sin(lat);
      for(let x=0;x<W;x++,p+=4){
        const lon=((x+0.5)/W)*TAU;
        const q = lutAt(LUT, 0.75+fbm3(cl*Math.cos(lon)*3+s0, sy*3, cl*Math.sin(lon)*3, 4)*0.6);
        D[p]=LUT.d[q]; D[p+1]=LUT.d[q+1]; D[p+2]=LUT.d[q+2]; D[p+3]=255;
      }
    }
  }
  ctx.putImageData(img,0,0);
  out.map = cvTexture(cv, true);
  TEXCACHE[ck] = out; return out;
}

G.planetMaps=planetMaps;
})();
