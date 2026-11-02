import type Phaser from 'phaser';
import type { RoomId } from '../core/types';
import { drawProductSign } from './productSigns';

// Original, locally authored pixel art. Texture keys are the replacement boundary:
// load your PNG sprite sheets under these keys without changing collision bodies.
export const ART = { hero:'cto', incident:'incident', ticket:'ticket', debt:'debt',
  shell:'shell', fire:'fire', leak:'leak', boss:'boss', backlog:'backlog',
  coffee:'coffee', gpu:'gpu', pro:'pro', coin:'coin', toolbox:'toolbox', wrench:'wrench' } as const;
type Painter=(c:CanvasRenderingContext2D, frame:number)=>void;
function sheet(scene:Phaser.Scene,key:string,w:number,h:number,frames:number,draw:Painter) {
  const canvas=document.createElement('canvas'); canvas.width=w*frames; canvas.height=h;
  const ctx=canvas.getContext('2d')!; ctx.imageSmoothingEnabled=false;
  for(let f=0;f<frames;f++){ctx.save();ctx.translate(f*w,0);draw(ctx,f);ctx.restore();}
  const texture=scene.textures.addCanvas(key,canvas)!;
  for(let f=0;f<frames;f++)texture.add(f,0,f*w,0,w,h);
}
const rect=(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,color:string)=>{
  c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);
};
function hero(c:CanvasRenderingContext2D,f:number){
  const moving=f>=2&&f<=5,step=moving?[0,3,0,-3][f-2]:0;
  const bob=moving&&f%2===1?-2:0;c.translate(0,bob);
  rect(c,5,21,11,19,'#172631');rect(c,4,23,4,13,'#80ad9c');
  rect(c,10,33,7,12-step,'#687f8a');rect(c,19,33,7,12+step,'#a3b4b4');
  rect(c,7,43-step,11,4,'#131b27');rect(c,19,43+step,12,4,'#131b27');
  rect(c,10,21,18,16,'#d8dfc7');rect(c,13,23,3,14,'#859c86');
  rect(c,10,33,18,4,'#557264');rect(c,15,29,4,4,'#ffd76d');
  rect(c,13,8,14,14,'#d89467');rect(c,12,9,4,10,'#915644');
  rect(c,23,12,6,7,'#f3bc87');rect(c,23,11,3,3,'#121b27');
  rect(c,14,18,10,4,'#e2a473');rect(c,19,18,8,2,'#694643');
  rect(c,11,3,15,8,'#e9eef3');rect(c,13,1,10,5,'#f8fafc');
  rect(c,8,9,23,4,'#c7d1db');rect(c,18,2,3,7,'#ffffff');
  rect(c,25,26,7,9,'#d67c55');rect(c,26,24,5,9,'#e0e7cd');
  rect(c,28,28,7,15,'#df6755');rect(c,29,27,5,3,'#ffc982');
  if(f===7){rect(c,26,22,10,5,'#d8dfc7');rect(c,33,21,8,4,'#8fb1b5');}
}
function flame(c:CanvasRenderingContext2D,f:number){
  const s=f%2*4;
  rect(c,10,40,31,14,'#d44339');rect(c,6,30,36,19,'#f4613f');
  rect(c,12,18+s,25,25,'#f77940');rect(c,21,4+s,8,26,'#ffa751');
  rect(c,6,15-s,7,18,'#ff9b4a');rect(c,35,20+s,7,20,'#ff9b4a');
  rect(c,14,31,22,19,'#ffc45d');rect(c,20,20+s,10,28,'#ffdd85');
  rect(c,20,38,10,14,'#fff0b1');
}
function wrench(c:CanvasRenderingContext2D){
  rect(c,12,11,7,17,'#8aa7b6');rect(c,14,13,3,13,'#e6f0cf');
  rect(c,7,4,6,12,'#b9dae2');rect(c,19,4,6,12,'#b9dae2');
  rect(c,10,12,12,7,'#b9dae2');rect(c,12,26,7,4,'#b9dae2');
}
function coffee(c:CanvasRenderingContext2D){
  // An open handle, dark coffee and separate steam read without a square badge.
  rect(c,3,34,30,2,'#09121b');
  rect(c,4,31,28,3,'#8e99a0');rect(c,6,31,24,2,'#f7f0df');
  rect(c,25,16,8,14,'#09121b');rect(c,26,18,6,10,'#f4eddc');
  rect(c,28,20,5,6,'#09121b');c.clearRect(28,21,3,4);
  rect(c,5,12,22,15,'#09121b');rect(c,7,25,18,5,'#09121b');
  rect(c,9,29,14,2,'#09121b');
  rect(c,7,15,18,11,'#fff5df');rect(c,9,26,14,3,'#e3cfad');
  rect(c,7,16,3,9,'#ffffff');rect(c,22,16,3,10,'#bf9f79');
  rect(c,11,26,10,2,'#f6e8ca');
  rect(c,7,12,18,5,'#fff9e8');rect(c,9,13,14,3,'#60382b');
  rect(c,11,13,9,1,'#a4714c');rect(c,8,16,16,1,'#e5c99e');
  rect(c,11,3,3,4,'#09121b');rect(c,9,7,3,4,'#09121b');
  rect(c,12,2,2,4,'#f5efe2');rect(c,10,6,2,4,'#f5efe2');
  rect(c,20,1,3,4,'#09121b');rect(c,18,5,3,4,'#09121b');
  rect(c,21,0,2,4,'#ffffff');rect(c,19,4,2,4,'#ffffff');
}
function gpu(c:CanvasRenderingContext2D){
  // A horizontal cooler, one large fan and contacts identify a video card.
  rect(c,2,32,31,2,'#09121b');rect(c,0,8,4,25,'#09121b');
  rect(c,1,9,2,22,'#dae8f0');rect(c,1,12,2,4,'#879aa8');
  rect(c,3,10,30,20,'#09121b');rect(c,33,13,3,14,'#09121b');
  rect(c,5,11,27,3,'#f0f5f7');rect(c,4,14,29,13,'#94adbf');
  rect(c,5,14,27,2,'#cce1ef');rect(c,5,25,27,2,'#587387');
  rect(c,6,17,10,7,'#273b50');
  for(let i=0;i<3;i++)rect(c,7,18+i*2,8,1,'#b6d0e1');
  rect(c,7,28,22,4,'#09121b');rect(c,8,29,20,2,'#eabf68');
  for(let x=9;x<28;x+=4)rect(c,x,29,2,2,'#fff0b3');
  rect(c,20,12,9,2,'#09121b');rect(c,18,14,13,10,'#09121b');
  rect(c,20,24,9,2,'#09121b');
  rect(c,21,14,7,1,'#eaf4fa');rect(c,19,15,2,7,'#d0e3ed');
  rect(c,28,15,2,7,'#587387');rect(c,21,23,7,1,'#587387');
  rect(c,23,15,3,3,'#9ed6f4');rect(c,26,18,3,3,'#9ed6f4');
  rect(c,22,21,3,2,'#9ed6f4');rect(c,20,18,3,3,'#9ed6f4');
  rect(c,23,18,3,3,'#eff8ff');rect(c,24,19,1,1,'#46647d');
}
function backlog(c:CanvasRenderingContext2D){
  // A lit lid and darker side distinguish the solid block from office monitors.
  rect(c,3,34,32,2,'#09121b');rect(c,2,8,28,27,'#09121b');
  rect(c,6,4,27,5,'#09121b');rect(c,30,8,6,26,'#09121b');
  rect(c,6,6,26,3,'#ffedb9');rect(c,4,9,25,3,'#e6c58a');
  rect(c,4,12,25,21,'#d3a971');rect(c,6,13,21,18,'#e9c28a');
  rect(c,30,10,4,22,'#916c4b');rect(c,30,10,2,22,'#b68b5b');
  rect(c,5,12,2,19,'#fff0c7');rect(c,7,31,20,2,'#ab794e');
  for(const x of [5,25])for(const y of [12,28]){
    rect(c,x,y,3,3,'#594739');rect(c,x,y,2,1,'#d2dce1');
  }
  rect(c,12,15,10,2,'#51372c');rect(c,19,17,3,4,'#51372c');
  rect(c,15,20,6,3,'#51372c');rect(c,15,23,3,2,'#51372c');
  rect(c,15,27,3,3,'#51372c');rect(c,12,14,10,1,'#fff4d3');
}
export function buildArt(scene:Phaser.Scene){
  if(scene.textures.exists('cto'))return;
  sheet(scene,'cto',42,50,8,hero);
  sheet(scene,'fire',48,56,4,flame);
  sheet(scene,'wrench',32,32,1,wrench);
  sheet(scene,'toolbox',36,36,1,c=>{
    rect(c,10,2,16,5,'#b9dae2');rect(c,1,8,34,27,'#202e39');
    rect(c,3,10,30,23,'#e6a65c');rect(c,3,13,30,4,'#ffd58c');
    rect(c,16,16,5,6,'#354b56');rect(c,5,29,26,3,'#ab7248');
    c.save();c.translate(6,10);c.scale(0.6,0.6);wrench(c);c.restore();
  });
  sheet(scene,'incident',32,30,2,(c,f)=>{
    rect(c,3,10,26,16,'#b84f56');rect(c,6,6,20,18,'#e97c78');
    rect(c,8,4,17,6,'#ffac93');rect(c,5,13,23,8,'#3c3042');
    rect(c,9,14,4,4,'#ffe3b1');rect(c,20,14,4,4,'#ffe3b1');
    rect(c,3+f*2,26,9,4,'#895462');rect(c,21-f*2,26,9,4,'#895462');
    rect(c,14,0,4,5,'#f4be69');
  });
  sheet(scene,'ticket',32,18,1,(c)=>{
    rect(c,2,3,28,14,'#c9dbc7');rect(c,2,3,28,4,'#ee967a');
    rect(c,8,10,16,2,'#516977');rect(c,8,14,9,2,'#7d9796');
  });
  sheet(scene,'debt',36,34,2,(c,f)=>{
    rect(c,6,5,24,24,'#c18e55');rect(c,10,2,16,8,'#eac27a');
    rect(c,4,13,28,13,'#6c795b');
    for(let i=0;i<3;i++)rect(c,8+i*8,12+(i%2)*5,5,6,'#d4d68a');
    rect(c,24,24,10,6,'#bcb997');rect(c,30,23,3,3,'#283a36');
    rect(c,5+f*2,30,9,4,'#b3a281');rect(c,24-f*2,30,9,4,'#b3a281');
  });
  sheet(scene,'shell',36,24,1,(c)=>{
    rect(c,4,8,28,13,'#71865e');rect(c,9,2,18,18,'#b9cc79');
    rect(c,3,19,30,4,'#eff0b5');rect(c,11,5,5,9,'#e2e69f');rect(c,21,8,7,7,'#819754');
  });
  sheet(scene,'leak',38,44,2,(c,f)=>{
    rect(c,2,30,34,14,'#496e81');rect(c,0,29,38,5,'#8cc9d5');
    rect(c,14,16+f*4,10,15,'#648d90');rect(c,6,2+f*4,26,19,'#b686bc');
    rect(c,9,5+f*4,23,12,'#e0b1d3');rect(c,21,11+f*4,15,6,'#342a4b');
    rect(c,10,7+f*4,4,4,'#fff0ba');
  });
  sheet(scene,'boss',112,128,4,(c,f)=>{
    c.save();c.translate(32,0);c.scale(1.2,1.2);flame(c,f);c.restore();
    rect(c,18,48,80,72,'#662c3c');rect(c,23,38,68,80,'#ab4948');
    rect(c,30,47,55,65,'#222d3b');rect(c,35,54,18,14,'#ffb45f');
    rect(c,64,54,17,14,'#ffb45f');rect(c,39,58,11,6,'#fff1ad');
    rect(c,65,58,11,6,'#fff1ad');
    for(let i=0;i<3;i++){rect(c,37,80+i*9,38,4,'#e86b49');rect(c,79,80+i*9,3,3,'#ffc777');}
    rect(c,4,69,21,36,'#e57e4e');rect(c,90,69,19,36,'#e57e4e');
    rect(c,23,118,24,9,'#db694a');rect(c,69,118,26,9,'#db694a');
  });
  sheet(scene,'coffee',36,36,1,coffee);
  sheet(scene,'gpu',36,36,1,gpu);
  sheet(scene,'backlog',36,36,1,backlog);
  sheet(scene,'pro',36,36,1,c=>{
    rect(c,1,3,34,32,'#1a2935');rect(c,3,1,30,32,'#86d8ed');
    rect(c,5,3,26,3,'#f8efcf');rect(c,5,7,26,24,'#344949');
    rect(c,13,13,11,15,'#86d8ed');rect(c,16,7,4,8,'#86d8ed');
    rect(c,19,7,8,3,'#86d8ed');rect(c,16,18,5,4,'#344949');
  });
  sheet(scene,'coin',18,22,1,c=>{
    rect(c,4,1,10,20,'#d99d41');rect(c,1,5,16,12,'#ffc963');rect(c,5,3,7,15,'#ffe4a0');
    rect(c,9,7,3,8,'#bf9048');
  });
  for(const id of ['server','office','perimeter','production'] as const)background(scene,id);
}
function background(scene:Phaser.Scene,id:RoomId){
  const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;
  const c=canvas.getContext('2d')!;c.scale(2,2);c.imageSmoothingEnabled=false;
  const production=id==='production',office=id==='office',perimeter=id==='perimeter';
  const wall=production?'#28222d':office?'#273031':perimeter?'#172936':'#203039';
  rect(c,0,0,480,270,'#15212c');rect(c,0,28,480,230,wall);
  for(let x=8;x<480;x+=64){
    rect(c,x,37,59,178,'#1a2933');rect(c,x+2,39,55,174,wall);
    rect(c,x+5,43,2,6,'#45565a');rect(c,x+51,203,2,6,'#45565a');
  }
  for(let x=0;x<480;x+=96){
    rect(c,x+8,12,75,7,'#344749');rect(c,x+11,14,69,2,production?'#b25a52':'#a6b597');
    c.fillStyle=production?'#db756009':'#b7d7b609';
    c.beginPath();c.moveTo(x+14,21);c.lineTo(x-12,128);c.lineTo(x+114,128);c.lineTo(x+78,21);c.fill();
  }
  rect(c,0,24,480,4,'#3d4b4e');rect(c,0,235,480,19,'#1a2932');
  for(let x=7;x<480;x+=30)rect(c,x,241,22,3,'#2f454b');
  if(office){
    for(let x=35;x<465;x+=120){
      rect(c,x,89,65,45,'#526968');rect(c,x+3,92,59,39,'#9cbaae');
      for(let k=0;k<6;k++)rect(c,x+8+k%3*16,99+Math.floor(k/3)*16,10,10,k%2?'#dcb986':'#d0d5b2');
      rect(c,x-10,214,98,5,'#687667');rect(c,x-5,219,5,33,'#3c5254');rect(c,x+77,219,5,33,'#3c5254');
      rect(c,x+7,185,32,22,'#52676b');rect(c,x+10,188,26,15,'#233d42');
      rect(c,x+12,191,16,2,'#8bbf9f');rect(c,x+12,196,11,2,'#57988e');
      rect(c,x+20,207,6,7,'#687874');rect(c,x+58,205,9,9,'#be9170');
    }
  }else{
    for(let x=30;x<450;x+=84){
      rect(c,x+2,76,63,159,'#111e2a');rect(c,x,72,63,157,'#3b5159');
      rect(c,x+3,76,57,149,'#203039');
      for(let row=0;row<6;row++){
        const yy=82+row*23;rect(c,x+7,yy,49,19,'#314750');rect(c,x+9,yy+2,45,2,'#4a6265');
        for(let k=0;k<3;k++)rect(c,x+12+k*9,yy+8,5,5,'#172a34');
        rect(c,x+45,yy+7,3,3,(row+(x/84|0))%3===0?'#cf8666':'#89b99a');
        rect(c,x+50,yy+7,2,3,'#527b79');rect(c,x+11,yy+15,22,1,'#1b2c35');
      }
      rect(c,x+9,229,6,7,'#101d27');rect(c,x+47,229,6,7,'#101d27');
    }
  }
  if(perimeter){
    for(let x=5;x<480;x+=60){rect(c,x,45,24,4,'#a25c61');rect(c,x,50,3,12,'#704951');}
    c.strokeStyle='#6c4560';c.lineWidth=2;
    for(let i=0;i<4;i++){c.beginPath();c.moveTo(0,61+i*3);c.lineTo(80+i*18,61+i*3);c.lineTo(105+i*18,90+i*5);c.lineTo(480,90+i*5);c.stroke();}
  }
  if(production){
    rect(c,309,42,131,11,'#412d38');rect(c,312,45,125,3,'#b66b5b');
    rect(c,324,56,100,156,'#1c202b');
    for(let y=67;y<208;y+=17){rect(c,331,y,86,12,'#44313c');rect(c,400,y+3,5,4,'#cd7153');}
  }
  // Conduits, grounded cables and bolted floor make a complete room rather than floating tiles.
  drawProductSign(scene,c,id);
  c.strokeStyle='#617269';c.lineWidth=2;c.beginPath();c.moveTo(6,216);c.lineTo(18,216);c.lineTo(18,233);c.lineTo(465,233);c.lineTo(465,142);c.stroke();
  rect(c,0,254,480,16,'#344348');rect(c,0,254,480,2,'#8da292');
  for(let x=0;x<480;x+=24){rect(c,x+2,260,18,8,'#23333d');rect(c,x+4,261,14,1,'#455b5d');}
  scene.textures.addCanvas('bg-'+id,canvas);
}
