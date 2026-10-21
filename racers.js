/* 327 背負いロケット グランプリ — 主人公・ライバル（造形・設定・走りのクセ）と噴射の粒 */
(function(){'use strict';
var G=window.G=window.G||{}; var T=THREE; var TAU=Math.PI*2;
var clamp=G.clamp;

/* ================= ロースター（出走表） =================
   col: suit 服 / suit2 ズボン / accent 差し色 / skin 肌 / helm ヘルメット / rocket ロケット / boot 靴 / glove 手袋
   head: 頭の形  rocket: ロケットの形  extra: 飾り  scale: 体の大きさ
   ai: 走りのクセ（vMul=巡航速度, turn=曲がり, accel=加速, heat=熱のたまりやすさ, aim=ゲートを狙う確率, wob=蛇行幅(m), wobF=蛇行の細かさ, mode=ブーストの使い方, startQ=スタートの上手さ） */
G.ROSTER=[
 {id:'sora',name:'ソラ',title:'見習いロケッター（あなた）',player:true,color:'#3d8bff',
  line:'ロケットは止まらない。ぼくが、曲がるんだ！',
  col:{suit:0x2f6fe0,suit2:0x28508f,accent:0xff8a2a,skin:0xffd2a8,helm:0xe8402a,rocket:0xf2f2f2,boot:0x3a2a22,glove:0xffffff,scarf:0xffd23a},
  head:'round',rocket:'pack',extra:['scarf'],scale:1.0,flame:[0xff9a2a,0xfff2a0],
  stat:{spd:3,turn:3,tech:3},
  ai:{vMul:1,turn:1,accel:1,heat:1,aim:1,wob:0,wobF:0.02,mode:'smart',startQ:0.7,rubber:false}},
 {id:'volt',name:'ボルト',title:'稲妻のスタートダッシュ屋',color:'#ffd21f',
  line:'スタートで決まるのさ！ 追いつけるかな？',
  col:{suit:0x1d1d26,suit2:0x2a2a36,accent:0xffe21f,skin:0xf0c090,helm:0xffd21f,rocket:0xffd21f,boot:0x222222,glove:0xffe21f},
  head:'bolt',rocket:'single',extra:[],scale:0.95,flame:[0x55e6ff,0xffffff],
  stat:{spd:3,turn:4,tech:2},
  ai:{vMul:0.995,turn:1.05,accel:1.3,heat:1.0,aim:0.8,wob:6,wobF:0.018,mode:'start',startQ:1.0,rubber:true}},
 {id:'garnet',name:'ガーネット嬢',title:'ゲートは全部くぐるのがマナー',color:'#e0314b',
  line:'ゲートは全部くぐるのがマナーですわ。',
  col:{suit:0xc2203d,suit2:0x7a1428,accent:0xffd24a,skin:0xffe0c8,helm:0x8a1a30,rocket:0xe0314b,boot:0x4a1a22,glove:0xffffff,scarf:0xffd24a},
  head:'hat',rocket:'single',extra:['cape','parasol'],scale:1.0,flame:[0xff6a8a,0xffe6a0],
  stat:{spd:3,turn:3,tech:5},
  ai:{vMul:0.99,turn:1.0,accel:1.0,heat:0.9,aim:0.97,wob:0,wobF:0.02,mode:'smart',startQ:0.75,rubber:true}},
 {id:'daigoro',name:'ダイゴロウ',title:'鍛冶屋の怪力。直線なら最速',color:'#e07a1f',
  line:'どけどけぇ！ 曲がるのは苦手だ！',
  col:{suit:0xa5521c,suit2:0x4a3a2e,accent:0xf2f2f2,skin:0xe0a070,helm:0xd2691e,rocket:0x9a9a9a,boot:0x2a2018,glove:0x6a4a2a},
  head:'headband',rocket:'fat',extra:[],scale:1.38,flame:[0xff7a1a,0xfff0a0],
  stat:{spd:5,turn:1,tech:2},
  ai:{vMul:1.05,turn:0.6,accel:0.7,heat:1.2,aim:0.55,wob:4,wobF:0.015,mode:'rare',startQ:0.4,rubber:true}},
 {id:'mint',name:'ミント',title:'ふわふわ身軽な小さな妖精',color:'#5fe0b0',
  line:'ふわっと、いくよ♪ ゲートはぜんぶ私のもの！',
  col:{suit:0x7be8c4,suit2:0xf5fff9,accent:0xff9ec8,skin:0xffe4d0,helm:0xf5fff9,rocket:0xffc0dc,boot:0xff9ec8,glove:0xffffff},
  head:'cat',rocket:'twin',extra:['tail'],scale:0.78,flame:[0xff9ec8,0xffffff],
  stat:{spd:2,turn:5,tech:4},
  ai:{vMul:0.975,turn:1.5,accel:1.4,heat:0.8,aim:0.96,wob:3,wobF:0.03,mode:'smart',startQ:0.8,rubber:true}},
 {id:'bat',name:'ドクター・バット',title:'実験大好き。出力は常に120％',color:'#8a4ad8',
  line:'実験だ！ 出力120％！ ……ちょっと熱いな。',
  col:{suit:0x3a2a5a,suit2:0x241a3a,accent:0x9aff4a,skin:0xd8d0e8,helm:0x6a3ab8,rocket:0x55406e,boot:0x1a1226,glove:0x9aff4a},
  head:'bat',rocket:'jet',extra:['wings'],scale:1.05,flame:[0x9aff4a,0xf0ffd0],
  stat:{spd:4,turn:3,tech:1},
  ai:{vMul:1.0,turn:1.1,accel:1.0,heat:1.3,aim:0.75,wob:14,wobF:0.03,mode:'greedy',startQ:0.6,rubber:true}},
 {id:'kagemaru',name:'カゲマル',title:'気配を消す忍び。寄り道しない',color:'#c0392b',
  line:'……拙者、輪には頓着せぬ。最短を行く。',
  col:{suit:0x15151c,suit2:0x15151c,accent:0xd02a2a,skin:0xe8c8a0,helm:0x15151c,rocket:0x2a2a34,boot:0x15151c,glove:0x2a2a34,scarf:0xd02a2a},
  head:'ninja',rocket:'missile',extra:['scarf'],scale:0.95,flame:[0x8a5aff,0xe0d0ff],
  stat:{spd:4,turn:4,tech:3},
  ai:{vMul:1.02,turn:1.2,accel:1.1,heat:1.0,aim:0.62,wob:0,wobF:0.02,mode:'smart',startQ:0.6,rubber:true}},
 {id:'pen',name:'キャプテン・ペン',title:'氷のペンギン船長。熱に強い',color:'#6ab8e8',
  line:'ペンギンだって飛べるのだ！ ブースト全開！',
  col:{suit:0x24323f,suit2:0x24323f,accent:0xff9a20,skin:0xf2f2f2,helm:0x24323f,rocket:0xcfeaff,boot:0xff9a20,glove:0x24323f},
  head:'penguin',rocket:'ice',extra:[],scale:1.05,flame:[0x6ad0ff,0xffffff],
  stat:{spd:2,turn:2,tech:4},
  ai:{vMul:0.965,turn:0.8,accel:1.0,heat:0.55,aim:0.9,wob:2,wobF:0.02,mode:'cool',startQ:0.5,rubber:true}},
 {id:'zero9',name:'ZERO-9',title:'計算どおりに走る競技ロボ',color:'#9fb4c8',
  line:'計算上、勝率87.3％。誤差は許容範囲。',
  col:{suit:0xaab6c2,suit2:0x6c7886,accent:0x2affd8,skin:0x8a96a4,helm:0xd8dee6,rocket:0x6c7886,boot:0x3a4350,glove:0x3a4350},
  head:'robot',rocket:'jet',extra:[],scale:1.0,flame:[0x2affd8,0xffffff],
  stat:{spd:3,turn:3,tech:5},
  ai:{vMul:1.0,turn:1.0,accel:1.0,heat:1.0,aim:1.0,wob:0,wobF:0.02,mode:'robot',startQ:0.7,rubber:false}},
 {id:'hanabi',name:'ハナビ',title:'花火師の娘。ド派手に咲かせる',color:'#ff6fa8',
  line:'どーんと咲かせるよ！ ゲートの上でね！',
  col:{suit:0xff5a98,suit2:0x9a2a5a,accent:0xffe85a,skin:0xffdcc0,helm:0xffe85a,rocket:0xff6fa8,boot:0xffe85a,glove:0xffffff,scarf:0x5affd0},
  head:'flower',rocket:'firework',extra:['scarf'],scale:0.95,flame:[0xff6fa8,0xffee90],
  stat:{spd:3,turn:4,tech:2},
  ai:{vMul:0.99,turn:1.1,accel:1.0,heat:0.9,aim:0.93,wob:11,wobF:0.012,mode:'burst',startQ:0.65,rubber:true}},
 {id:'comet',name:'ブラック・コメット',title:'最後に笑う影の王者',color:'#7a1fa8',
  line:'最後に笑うのは、俺だ。……ここからが本番だ。',
  col:{suit:0x14101c,suit2:0x14101c,accent:0xff2a4a,skin:0xcab8c8,helm:0x1a1424,rocket:0x1a1424,boot:0x14101c,glove:0xff2a4a},
  head:'horn',rocket:'single',extra:['cape'],scale:1.12,flame:[0xff2a4a,0xffd0d8],
  stat:{spd:5,turn:3,tech:4},
  ai:{vMul:1.035,turn:1.15,accel:1.1,heat:1.0,aim:0.95,wob:0,wobF:0.02,mode:'late',startQ:0.9,rubber:false}}
];

/* ================= 三角板（翼・膜） ================= */
function triGeo(a,b,c){
  var g=new T.BufferGeometry(), p=new Float32Array([a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2],a[0],a[1],a[2],c[0],c[1],c[2],b[0],b[1],b[2]]);
  g.setAttribute('position',new T.BufferAttribute(p,3)); g.computeVertexNormals(); return g;
}

/* ================= ロケットの形 ================= */
function addRocket(M0,sp,noz0){
  var M=new G.Merger(), noz=[], K=sp.col, ty=sp.rocket, A=K.accent, Rk=K.rocket, i;
  M.part('box',0,0.115,0.18,0.2,0.05,0.5,0x2a2a35); // 取り付け板
  if(ty==='pack'){
    // 背中に密着する燃料パックと左右の噴射器。頭・腕・脚と輪郭を分離。
    M.part('sph',0,.32,.02,.19,.115,.30,Rk,0,0,0,14);
    M.part('box',0,.41,.02,.21,.035,.36,0x344455);
    [-1,1].forEach(function(side){
      M.part('cyl',side*.215,.32,.04,.085,.52,.085,Rk,Math.PI/2,0,0,12);
      M.part('sph',side*.215,.32,-.22,.085,.085,.09,A,0,0,0,12);
      M.part('cyl',side*.215,.32,.34,.09,.12,.09,0x26313c,Math.PI/2,0,0,12);
      M.part('cyl',side*.215,.32,.407,.066,.018,.066,0x080d13,Math.PI/2,0,0,12);
      M.part('box',side*.215,.405,.04,.06,.02,.22,A);
      noz.push([side*.215,.32,.42,.06]);
    });
  } else if(ty==='single'){
    M.part('cyl',0,0.22,0.18,0.125,0.95,0.125,Rk,Math.PI/2,0,0,12);
    M.part('cone',0,0.22,-0.4,0.125,0.26,0.125,A,-Math.PI/2,0,0,12);
    M.part('cone',0,0.22,0.72,0.17,0.2,0.17,0x3a3a44,-Math.PI/2,0,0,12);
    M.part('cyl',0,0.22,0.0,0.132,0.05,0.132,A,Math.PI/2,0,0,12); M.part('cyl',0,0.22,0.36,0.132,0.05,0.132,A,Math.PI/2,0,0,12);
    M.part('box',0.19,0.2,0.58,0.22,0.02,0.2,A); M.part('box',-0.19,0.2,0.58,0.22,0.02,0.2,A); M.part('box',0,0.38,0.6,0.02,0.2,0.22,A);
    noz.push([0,0.22,0.82,0.15]);
  } else if(ty==='fat'){
    M.part('cyl',0,0.28,0.18,0.19,0.8,0.19,Rk,Math.PI/2,0,0,12);
    M.part('cone',0,0.28,-0.32,0.19,0.22,0.19,A,-Math.PI/2,0,0,12);
    M.part('cone',0,0.28,0.66,0.22,0.22,0.22,0x3a3a44,-Math.PI/2,0,0,12);
    M.part('cyl',0,0.28,0.05,0.2,0.07,0.2,A,Math.PI/2,0,0,12); M.part('cyl',0,0.28,0.32,0.2,0.07,0.2,A,Math.PI/2,0,0,12);
    M.part('box',0.26,0.26,0.55,0.2,0.02,0.2,A); M.part('box',-0.26,0.26,0.55,0.2,0.02,0.2,A);
    noz.push([0,0.28,0.78,0.2]);
  } else if(ty==='twin'){
    [-1,1].forEach(function(s){
      M.part('cyl',s*0.1,0.2,0.18,0.085,0.9,0.085,Rk,Math.PI/2,0,0,10);
      M.part('cone',s*0.1,0.2,-0.38,0.085,0.2,0.085,A,-Math.PI/2,0,0,10);
      M.part('cone',s*0.1,0.2,0.68,0.11,0.16,0.11,0x3a3a44,-Math.PI/2,0,0,10);
      noz.push([s*0.1,0.2,0.78,0.1]);
    });
    M.part('box',0,0.3,0.55,0.4,0.02,0.16,A);
  } else if(ty==='firework'){
    var off=[[0,0.24],[-0.1,0.2],[0.1,0.2],[-0.05,0.33],[0.05,0.33]], cols=[0xff6fa8,0xffe85a,0x5affd0,0xff6fa8,0xffe85a];
    for(i=0;i<5;i++){ M.part('cyl',off[i][0],off[i][1],0.15,0.055,0.95,0.055,cols[i],Math.PI/2,0,0,8); M.part('cone',off[i][0],off[i][1],-0.4,0.055,0.15,0.055,0xffffff,-Math.PI/2,0,0,8); }
    M.part('box',0,0.26,0.0,0.3,0.2,0.04,0x2a2a35); M.part('box',0,0.26,0.4,0.3,0.2,0.04,0x2a2a35);
    noz.push([0,0.24,0.68,0.13],[-0.1,0.2,0.68,0.07],[0.1,0.2,0.68,0.07]);
  } else if(ty==='missile'){
    M.part('cyl',0,0.2,0.2,0.09,1.25,0.09,Rk,Math.PI/2,0,0,10);
    M.part('cone',0,0.2,-0.58,0.09,0.32,0.09,A,-Math.PI/2,0,0,10);
    M.part('cone',0,0.2,0.88,0.12,0.18,0.12,0x15151c,-Math.PI/2,0,0,10);
    for(i=0;i<4;i++){ var a=i*Math.PI/2+Math.PI/4, cx=Math.cos(a), cy=Math.sin(a); M.bar(cx*0.09,0.2+cy*0.09,0.62,cx*0.36,0.2+cy*0.36,0.86,0.025,A); }
    noz.push([0,0.2,0.98,0.11]);
  } else if(ty==='jet'){
    M.part('box',0,0.22,0.18,0.3,0.18,0.84,Rk); M.part('box',0,0.22,-0.28,0.22,0.12,0.12,0x15151c);
    M.part('box',0.27,0.2,0.4,0.34,0.02,0.2,A); M.part('box',-0.27,0.2,0.4,0.34,0.02,0.2,A); M.part('box',0,0.38,0.5,0.02,0.2,0.2,A);
    [-1,1].forEach(function(s){ M.part('cyl',s*0.08,0.22,0.64,0.07,0.1,0.07,0x15151c,Math.PI/2,0,0,8); noz.push([s*0.08,0.22,0.7,0.075]); });
  } else if(ty==='ice'){
    M.part('cyl',0,0.22,0.18,0.12,0.9,0.12,Rk,Math.PI/2,0,0,6);
    M.part('cone',0,0.22,-0.4,0.12,0.3,0.12,0xffffff,-Math.PI/2,0,0,6);
    M.part('cone',0,0.22,0.7,0.16,0.18,0.16,0x3a5a7a,-Math.PI/2,0,0,8);
    for(i=0;i<5;i++){ var a2=i/5*TAU; M.part('cone',Math.cos(a2)*0.13,0.22+Math.sin(a2)*0.13,0.45,0.035,0.28,0.035,0x9ad8ff,-Math.PI/2,0,0,4); }
    noz.push([0,0.22,0.8,0.14]);
  }
  var RS=ty==='pack'?1:0.74, pv=new T.Vector3(0,0.2,0.2), mt=new T.Matrix4().makeTranslation(pv.x,pv.y,pv.z).multiply(new T.Matrix4().makeScale(RS,RS,RS)).multiply(new T.Matrix4().makeTranslation(-pv.x,-pv.y,-pv.z));
  mt.premultiply(new T.Matrix4().makeTranslation(0,0.0,0.1));
  M0.append(M,mt);
  for(i=0;i<noz.length;i++){ var q=new T.Vector3(noz[i][0],noz[i][1],noz[i][2]).applyMatrix4(mt); noz0.push([q.x,q.y,q.z,noz[i][3]*RS]); }
  M0.part('box',0,.10,.27,.37,.06,.06,0x202b37); // 肩ベルト
}

/* ================= 頭 ================= */
function addHead(M,sp){
  var K=sp.col, hz=-0.58, hy=0.07, h=sp.head, i;
  M.part('sph',0,hy,hz,0.15,0.15,0.15,K.skin,0,0,0,10);
  var hc=K.helm;
  if(h==='robot'){
    M.part('box',0,hy,hz,0.3,0.26,0.28,hc); M.part('box',0,hy+0.01,hz-0.145,0.24,0.08,0.02,K.accent);
    M.bar(0,hy+0.13,hz,0,hy+0.28,hz+0.02,0.025,0x555555); M.part('sph',0,hy+0.3,hz+0.02,0.04,0.04,0.04,0xff3030,0,0,0,6);
    M.part('cyl',-0.17,hy,hz,0.05,0.06,0.05,0x555555,0,0,Math.PI/2,8); M.part('cyl',0.17,hy,hz,0.05,0.06,0.05,0x555555,0,0,Math.PI/2,8);
    return;
  }
  var hcol=(h==='ninja'||h==='penguin')?0x14141c:hc;
  if(h==='penguin') hcol=0x24323f;
  M.part('sph',0,hy+0.01,hz+0.01,0.19,0.18,0.19,hcol,0,0,0,12);
  if(h==='round'||h==='bolt'||h==='cat'||h==='bat'||h==='headband'||h==='hat'||h==='flower'||h==='horn'){
    M.part('sph',0,hy,hz-0.13,0.115,0.085,0.07,(h==='horn')?0xff2a4a:0x18202e,0,0,0,8); // バイザー
    M.part('cyl',0,hy+0.02,hz-0.03,0.2,0.05,0.2,0x3b2a1a,Math.PI/2,0,0,12);              // ゴーグルのバンド
    M.part('sph',-0.07,hy+0.03,hz-0.17,0.04,0.04,0.025,0xffd23a,0,0,0,6); M.part('sph',0.07,hy+0.03,hz-0.17,0.04,0.04,0.025,0xffd23a,0,0,0,6);
  }
  if(h==='round'){ M.part('box',0,hy+0.19,hz,0.045,0.02,0.36,0xffffff); M.part('box',-0.185,hy,hz+0.02,0.03,0.07,0.08,K.accent); M.part('box',0.185,hy,hz+0.02,0.03,0.07,0.08,K.accent); }
  if(h==='bolt'){ M.bar(0,hy+0.19,hz-0.15,0,hy+0.3,hz-0.08,0.04,0xffffff); M.bar(0,hy+0.3,hz-0.08,0,hy+0.24,hz,0.04,0xffffff); M.bar(0,hy+0.24,hz,0,hy+0.34,hz+0.1,0.04,0xffffff); M.part('box',-0.19,hy+0.02,hz,0.03,0.12,0.14,0x1d1d26); M.part('box',0.19,hy+0.02,hz,0.03,0.12,0.14,0x1d1d26); }
  if(h==='cat'||h==='bat'){
    var big=h==='bat', ec=big?0x3a2a5a:hc;
    [-1,1].forEach(function(s){ M.part('cone',s*0.1,hy+(big?0.27:0.21),hz+0.02,big?0.06:0.055,big?0.26:0.14,big?0.06:0.055,ec,0.2,0,-s*0.25,4); if(!big) M.part('cone',s*0.1,hy+0.2,hz-0.005,0.03,0.09,0.03,K.accent,0.2,0,-s*0.25,4); });
  }
  if(h==='headband'){ M.part('cyl',0,hy+0.07,hz,0.2,0.05,0.2,0xf2f2f2,Math.PI/2,0,0,12); M.bar(0.17,hy+0.07,hz+0.04,0.3,hy+0.0,hz+0.3,0.045,0xf2f2f2); M.bar(0.17,hy+0.07,hz+0.04,0.26,hy+0.12,hz+0.36,0.045,0xf2f2f2); }
  if(h==='hat'){ M.part('cyl',0,hy+0.17,hz,0.3,0.025,0.3,hc,0,0,0,16); M.part('cyl',0,hy+0.22,hz,0.13,0.1,0.13,hc,0,0,0,12); M.part('cyl',0,hy+0.2,hz,0.135,0.03,0.135,K.accent,0,0,0,12); M.bar(0.08,hy+0.26,hz,0.22,hy+0.4,hz+0.1,0.03,0xffffff); M.bar(0.22,hy+0.4,hz+0.1,0.18,hy+0.47,hz+0.2,0.03,0xffffff); }
  if(h==='ninja'){
    M.part('box',0,hy,hz-0.165,0.22,0.06,0.03,K.skin); M.part('cyl',0,hy+0.1,hz,0.2,0.05,0.2,K.accent,Math.PI/2,0,0,12);
    M.bar(0,hy+0.04,hz+0.12,0,hy+0.06,hz+0.5,0.07,0x14141c); M.bar(0,hy+0.1,hz+0.17,0,hy+0.1,hz+0.62,0.045,K.accent);
  }
  if(h==='penguin'){
    M.part('sph',0,hy-0.01,hz-0.075,0.13,0.12,0.09,0xf2f2f2,0,0,0,8); M.part('cone',0,hy-0.01,hz-0.2,0.045,0.13,0.045,0xff9a20,-Math.PI/2,0,0,6);
    M.part('sph',-0.05,hy+0.05,hz-0.16,0.03,0.03,0.02,0x111111,0,0,0,5); M.part('sph',0.05,hy+0.05,hz-0.16,0.03,0.03,0.02,0x111111,0,0,0,5);
    M.part('cyl',0,hy+0.2,hz,0.07,0.1,0.07,0xff9a20,0,0,0,6);
  }
  if(h==='flower'){
    for(i=0;i<7;i++){ var a=i/7*TAU; M.part('sph',Math.cos(a)*0.11,hy+0.22,hz+Math.sin(a)*0.11,0.07,0.04,0.07,0xff9ec8,0,0,0,6); }
    M.part('sph',0,hy+0.23,hz,0.06,0.05,0.06,0xffe85a,0,0,0,6);
    [-1,1].forEach(function(s){ M.part('sph',s*0.17,hy+0.02,hz+0.1,0.07,0.07,0.07,hc,0,0,0,6); });
  }
  if(h==='horn'){
    [-1,1].forEach(function(s){ M.bar(s*0.1,hy+0.16,hz-0.04,s*0.2,hy+0.38,hz+0.08,0.05,0xff2a4a); M.bar(s*0.2,hy+0.38,hz+0.08,s*0.18,hy+0.46,hz+0.22,0.04,0xff2a4a); });
  }
}

/* ================= 動く布（スカーフ・マント） ================= */
function makeStrip(ax,ay,az,w0,w1,len,segs,color,amp){
  var n=(segs+1)*2, pos=new Float32Array(n*3), idx=[], i;
  for(i=0;i<segs;i++){ var a=i*2; idx.push(a,a+1,a+2,a+1,a+3,a+2); }
  var g=new T.BufferGeometry(); g.setAttribute('position',new T.BufferAttribute(pos,3)); g.setIndex(idx);
  var mat=new T.MeshLambertMaterial({color:color,side:T.DoubleSide,flatShading:true});
  var m=new T.Mesh(g,mat); m.frustumCulled=false;
  function upd(t,sp){
    var arr=g.attributes.position.array, k;
    for(k=0;k<=segs;k++){
      var f=k/segs, z=az+len*f*(0.85+0.15*sp), w=(w0+(w1-w0)*f)/2, wv=Math.sin(t*9-k*1.1)*amp*f*(0.6+0.8*sp), wx=Math.sin(t*7-k*0.9+1)*amp*0.6*f;
      var y=ay+wv+0.05*f, o=k*6;
      arr[o]=-w+wx; arr[o+1]=y; arr[o+2]=z; arr[o+3]=w+wx; arr[o+4]=y; arr[o+5]=z;
    }
    g.attributes.position.needsUpdate=true; g.computeVertexNormals();
  }
  upd(0,0.5); m.userData.upd=upd; return m;
}

/* ================= 1人分のモデル ================= */
G.buildModel=function(sp){
  var M=new G.Merger(), K=sp.col, noz=[], i;
  // 頭身を揃えた胸郭→腰→骨盤。関節を飾り玉にせず、服の連続面でつなぐ。
  M.part('sph',0,-.015,-.16,.235,.125,.33,K.suit,0,0,0,16);
  M.part('sph',0,-.018,.14,.168,.105,.26,K.suit,0,0,0,14);
  M.part('sph',0,-.018,.34,.19,.115,.18,K.suit2,0,0,0,14);
  M.part('box',0,.087,.27,.36,.035,.065,0x172330);
  M.part('box',0,.11,.27,.06,.02,.06,0xb6c4cc);
  M.part('sph',0,.005,-.49,.079,.075,.12,K.skin,0,0,0,12);
  [-1,1].forEach(function(side){
    M.bar(side*.15,.105,-.38,side*.12,.112,.28,.027,0x19232f);
    M.part('box',side*.14,.13,-.17,.038,.015,.09,0xb4c2ce);
  });
  var HM=new G.Merger(); addHead(HM,sp);
  var hc0=new T.Vector3(0,.07,-.58), hm=new T.Matrix4().makeTranslation(hc0.x,hc0.y,hc0.z).multiply(new T.Matrix4().makeScale(.88,.88,.88)).multiply(new T.Matrix4().makeTranslation(-hc0.x,-hc0.y,-hc0.z));
  hm.premultiply(new T.Matrix4().makeTranslation(0,.018,-.07)); M.append(HM,hm);
  addRocket(M,sp,noz);
  var ex=sp.extra||[];
  if(ex.indexOf('wings')>=0){
    [-1,1].forEach(function(s){
      M.addCustom(triGeo([s*0.1,0.1,0.0],[s*1.05,0.16,0.35],[s*0.1,0.1,0.9]),0,0,0,1,1,1,0x4a2a78);
      M.addCustom(triGeo([s*1.05,0.16,0.35],[s*0.9,0.14,0.85],[s*0.1,0.1,0.9]),0,0,0,1,1,1,0x6a3ab8);
      M.bar(s*0.1,0.1,0.0,s*1.05,0.16,0.35,0.035,0x1a1226); M.bar(s*1.05,0.16,0.35,s*0.9,0.14,0.85,0.03,0x1a1226);
    });
  }
  if(ex.indexOf('tail')>=0){ M.bar(0,0.0,0.52,0.05,0.08,0.82,0.045,K.accent); M.bar(0.05,0.08,0.82,0.14,0.2,1.0,0.04,K.accent); M.part('sph',0.14,0.2,1.02,0.05,0.05,0.05,0xffffff,0,0,0,6); }
  if(ex.indexOf('parasol')>=0){ M.bar(0.0,0.3,0.1,0.0,0.62,0.1,0.02,0xffffff); M.part('cone',0,0.7,0.1,0.34,0.14,0.34,0xff7aa0,0,0,0,10); M.part('sph',0,0.78,0.1,0.025,0.025,0.025,0xffd24a,0,0,0,5); }
  var root=new T.Group(), body=new T.Group(), mesh=new T.SkinnedMesh(M.geometry(),new T.MeshPhongMaterial({vertexColors:true,shininess:12,specular:0x273441,skinning:true}));
  body.add(mesh);
  // 9本の骨と1つの結合メッシュ。四肢別のdraw callを作らない。
  var joints=[],bones=[],skinIds=[],skinWeights=[],bindRoot=new T.Bone();
  bones.push(bindRoot);bindRoot.userData.origin=[0,0,0];
  for(var vi=0;vi<M.p.length/3;vi++){skinIds.push(0,0,0,0);skinWeights.push(1,0,0,0);}
  function bone(parent,x,y,z){var b=new T.Bone();b.position.set(x,y,z);parent.add(b);b.userData.index=bones.length;b.userData.origin=[parent.userData.origin[0]+x,parent.userData.origin[1]+y,parent.userData.origin[2]+z];bones.push(b);return b;}
  function limbPart(parent,x,y,z,sx,sy,sz,color){
    var o=parent===body?[0,0,0]:parent.userData.origin,idx=parent===body?0:parent.userData.index,start=M.p.length/3;
    M.part('sph',x+o[0],y+o[1],z+o[2],sx,sy,sz,color,0,0,0,sp.player?12:6);
    for(var v=start;v<M.p.length/3;v++){skinIds.push(idx,0,0,0);skinWeights.push(1,0,0,0);}
  }
  [-1,1].forEach(function(side){
    var arm=bone(bindRoot,side*.205,-.015,-.34);
    limbPart(arm,side*.045,-.025,-.14,.083,.078,.22,K.suit);
    limbPart(arm,side*.075,-.04,-.32,.071,.068,.09,K.suit);
    var fore=bone(arm,side*.075,-.04,-.32);
    limbPart(fore,-side*.012,.015,-.14,.062,.061,.19,K.suit);
    limbPart(fore,-side*.025,.016,-.31,.066,.06,.09,K.glove);
    limbPart(fore,-side*.075,-.016,-.29,.025,.027,.055,K.glove);
    var leg=bone(bindRoot,side*.10,-.018,.35);
    limbPart(leg,side*.015,-.007,.22,.098,.09,.29,K.suit2);
    limbPart(leg,side*.025,-.005,.44,.076,.075,.10,K.suit2);
    var shin=bone(leg,side*.025,-.005,.44);
    limbPart(shin,0,-.01,.21,.068,.072,.27,K.suit2);
    limbPart(shin,0,-.045,.44,.068,.075,.15,K.boot);
    limbPart(shin,0,-.098,.48,.07,.034,.145,K.boot);
    joints.push({side:side,arm:arm,fore:fore,leg:leg,shin:shin});
  });
  // バイザーに細い反射。大きな板やテクスチャを追加しない。
  limbPart(body,0,.09,-.782,.115,.067,.038,0x16334a);
  limbPart(body,-.035,.116,-.816,.047,.008,.008,0xc2f6ff);
  mesh.geometry.dispose();mesh.geometry=M.geometry();
  mesh.geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIds,4));
  mesh.geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(skinWeights,4));
  G.compactGeometry(mesh.geometry);mesh.add(bindRoot);mesh.bind(new T.Skeleton(bones));
  // 噴射
  var flames=[], flameMats=[new T.MeshBasicMaterial({color:sp.flame[0],transparent:true,opacity:0.55,blending:T.AdditiveBlending,depthWrite:false}),
                             new T.MeshBasicMaterial({color:sp.flame[1],transparent:true,opacity:0.95,blending:T.AdditiveBlending,depthWrite:false})];
  var fg=new T.ConeGeometry(1,1,8,1,false); fg.translate(0,0.5,0); fg.rotateX(Math.PI/2); // 底が原点・先が +z
  for(i=0;i<noz.length;i++){
    var n=noz[i], o=new T.Mesh(fg,flameMats[0]), inn=new T.Mesh(fg,flameMats[1]);
    o.position.set(n[0],n[1],n[2]); inn.position.set(n[0],n[1],n[2]); o.userData.r=n[3]; inn.userData.r=n[3]*0.30; body.add(o); body.add(inn); flames.push([o,inn]);
  }
  var strips=[];
  var scarfCol=K.scarf||K.accent;
  if(ex.indexOf('scarf')>=0){ var s1=makeStrip(0,0.14,-0.5,0.11,0.07,1.5,9,scarfCol,0.1); body.add(s1); strips.push(s1); }
  if(ex.indexOf('cape')>=0){ var c1=makeStrip(0,0.1,-0.3,0.34,0.6,1.25,8,sp.id==='comet'?0x7a1fa8:0xb3243e,0.12); body.add(c1); strips.push(c1); c1.material.color.setHex(sp.id==='comet'?0x4a1068:0xa0203a); }
  root.add(body); var s=4.2*(sp.scale||1); root.scale.set(s,s,s);
  return {root:root,body:body,flames:flames,strips:strips,mesh:mesh,nozzles:noz,scale:s,
    animate:function(t,yaw,pit,boost){
      for(var j=0;j<joints.length;j++){var q=joints[j],w=Math.sin(t*(boost?13:6)+q.side*1.8);
        q.arm.rotation.y=-yaw*.22+q.side*(boost?-.10:.06);q.arm.rotation.x=-.12-pit*.25+w*.018;
        q.fore.rotation.x=-.20+w*.025;q.fore.rotation.y=-q.side*.18;
        q.leg.rotation.y=q.side*(boost?.025:.06)-yaw*.18;q.leg.rotation.x=.05+w*(boost?.02:.055);
        q.shin.rotation.x=-.12-w*.045-pit*.15;
      }
    }};
};
/* 噴射の長さ・揺らぎ */
G.setFlame=function(model,len,t,boost){
  var f=model.flames, i;
  for(i=0;i<f.length;i++){
    var fl=0.82+0.3*Math.sin(t*38+i*1.7)+0.12*Math.sin(t*71+i), L=Math.min(boost?2.8:1.7,Math.max(0.01,len*fl)), r=f[i][0].userData.r;
    f[i][0].scale.set(r*(boost?1.5:1.25),r*(boost?1.5:1.25),L*(boost?1.15:1.0)); f[i][1].scale.set(f[i][1].userData.r,f[i][1].userData.r,L*0.62);
    f[i][0].visible=f[i][1].visible=len>0.02;
  }
};

/* ================= ライバルの頭脳 ================= */
G.aiBoost=function(r,t,prog){
  var A=r.ai, f=r.boost, h=r.heat, turning=Math.abs(r.yawCmd)>0.38;
  switch(A.mode){
    case 'greedy': r.bOn=f>2&&r.stall<=0; break;
    case 'rare': if(r.bOn){ if(f<40||h>60) r.bOn=false; } else if(f>88&&h<30) r.bOn=true; break;
    case 'cool': if(r.bOn){ if(f<10||h>88) r.bOn=false; } else if(f>22&&h<52) r.bOn=true; break;
    case 'robot': if(r.bOn){ if(f<35) r.bOn=false; } else if(f>58) r.bOn=true; break;
    case 'burst': r.bOn=(r.sinceGate<1.5&&f>30&&r.stall<=0); break;
    case 'late': if(prog<0.66){ if(r.bOn){ if(f<70) r.bOn=false; } else if(f>94&&h<20) r.bOn=true; } else { if(r.bOn){ if(f<4||h>86) r.bOn=false; } else if(f>8&&h<60) r.bOn=true; } break;
    case 'start': if(t<4.2){ r.bOn=f>5&&r.stall<=0; break; } // 以降は smart
    default: if(r.bOn){ if(f<6||h>72) r.bOn=false; } else if(f>30&&h<45&&!turning) r.bOn=true;
  }
};
/* ゲートを狙って (yawCmd, pitCmd) を決める */
G.aiSteer=function(r,gates,rnd,YAWM,PITM){
  var A=r.ai, g=gates[r.gi], tx, ty, ds;
  if(!g){ tx=0; ty=62; ds=200; }
  else {
    ds=Math.max(24,g.s-r.s);
    if(r.aim[r.gi]){ tx=g.x; ty=g.h; } else { tx=r.x*0.7; ty=r.h+(r.h>66?-10:10); }
  }
  tx+=Math.sin(r.s*A.wobF+r.ph)*A.wob; ty+=Math.cos(r.s*A.wobF*1.3+r.ph)*A.wob*0.6;
  var dy=Math.atan2(tx-r.x,ds*0.8), dp=Math.atan2(ty-r.h,ds*0.8);
  r.yawCmd=clamp(dy,-YAWM,YAWM)*A.turn; r.pitCmd=clamp(dp,-PITM,PITM)*A.turn;
};

/* ================= 噴射の粒（全員で共有・1 draw call） ================= */
G.Exhaust=function(scene){
  var N=640, i; this.N=N; this.head=0;
  this.pos=new Float32Array(N*3); this.col=new Float32Array(N*3); this.size=new Float32Array(N); this.alp=new Float32Array(N);
  this.vel=new Float32Array(N*3); this.age=new Float32Array(N); this.max=new Float32Array(N); this.kind=new Uint8Array(N); this.c0=new Float32Array(N*3); this.base=new Float32Array(N);
  for(i=0;i<N;i++){ this.max[i]=0; this.alp[i]=0; this.pos[i*3+1]=1e5; }
  var g=new T.BufferGeometry(); g.setAttribute('position',new T.BufferAttribute(this.pos,3)); g.setAttribute('color',new T.BufferAttribute(this.col,3));
  g.setAttribute('aSize',new T.BufferAttribute(this.size,1)); g.setAttribute('aA',new T.BufferAttribute(this.alp,1));
  this.uScale={value:300};
  this.points=new T.Points(g,new T.ShaderMaterial({uniforms:{uScale:this.uScale},transparent:true,depthWrite:false,vertexColors:true,
    vertexShader:'attribute float aSize; attribute float aA; uniform float uScale; varying vec3 vC; varying float vA; void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); vA=aA*smoothstep(9.0,34.0,-mv.z); gl_PointSize=aSize*uScale/max(1.0,-mv.z); gl_Position=projectionMatrix*mv; }',
    fragmentShader:'varying vec3 vC; varying float vA; void main(){ vec2 p=gl_PointCoord-0.5; float d=length(p)*2.0; float a=smoothstep(1.0,0.15,d)*vA; if(a<0.01) discard; gl_FragColor=vec4(vC,a); }'}));
  this.points.frustumCulled=false; this.points.renderOrder=6; scene.add(this.points);
};
G.Exhaust.prototype.emit=function(x,y,z,vx,vy,vz,kind,size,life,c0r,c0g,c0b){
  var i=this.head; this.head=(i+1)%this.N; var o=i*3;
  this.pos[o]=x; this.pos[o+1]=y; this.pos[o+2]=z; this.vel[o]=vx; this.vel[o+1]=vy; this.vel[o+2]=vz;
  this.age[i]=0; this.max[i]=life; this.kind[i]=kind; this.base[i]=size; this.size[i]=size;
  this.c0[o]=c0r; this.c0[o+1]=c0g; this.c0[o+2]=c0b;
};
G.Exhaust.prototype.update=function(dt){
  var i, o, f, k;
  for(i=0;i<this.N;i++){
    if(this.max[i]<=0) continue;
    this.age[i]+=dt; f=this.age[i]/this.max[i];
    if(f>=1){ this.max[i]=0; this.alp[i]=0; this.pos[i*3+1]=1e5; continue; }
    o=i*3; this.pos[o]+=this.vel[o]*dt; this.pos[o+1]+=this.vel[o+1]*dt; this.pos[o+2]+=this.vel[o+2]*dt;
    k=1-dt*1.6; this.vel[o]*=k; this.vel[o+1]*=k; this.vel[o+2]*=k;
    if(this.kind[i]===0){ // 火花→煙
      var m=Math.min(1,f*1.6); this.col[o]=this.c0[o]*(1-m)+0.62*m; this.col[o+1]=this.c0[o+1]*(1-m)+0.62*m; this.col[o+2]=this.c0[o+2]*(1-m)+0.68*m;
      this.alp[i]=(1-f)*(f<0.15?1:0.55); this.size[i]=this.base[i]*(1+f*3.6);
    } else { // 光の粒（花火など）
      this.col[o]=this.c0[o]; this.col[o+1]=this.c0[o+1]; this.col[o+2]=this.c0[o+2]; this.alp[i]=1-f; this.size[i]=this.base[i]*(1-f*0.6);
    }
  }
  var a=this.points.geometry.attributes; a.position.needsUpdate=true; a.color.needsUpdate=true; a.aSize.needsUpdate=true; a.aA.needsUpdate=true;
};
})();
