import Phaser from 'phaser';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/cyrillic-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/cyrillic-500.css';
import './style.css';
import './ui/home.css';
import { getRooms } from './core/rooms';
import { BALANCE } from './core/balance';
import { resultCountdown } from './core/presentation';
import { createRun } from './core/rules';
import type { Difficulty, ObjectiveKind } from './core/types';
import { RoomScene } from './game/RoomScene';
import { KeyboardInput } from './game/input';
import { GameAudio } from './game/audio';
import { GameUI } from './ui/GameUI';

const input=new KeyboardInput(),audio=new GameAudio();
let game:Phaser.Game,room:RoomScene|null=null,run=createRun(),index=0;
let roomStart=structuredClone(run);
let rooms=getRooms(run.difficulty);
let runId='';
let screen:'menu'|'playing'|'result'|'final'='menu',paused=false,idle=0,last=0,refresh=0;
let countdown: number | null = null;
const root=document.getElementById('app')!;
const ui=new GameUI(root,{
  start:startRun,
  resume:()=>setPaused(false),
  restart:()=>startRun(run.difficulty),
  retryRoom,
  menu:showMenu,
  leaderboard:()=>{if(screen==='playing'||screen==='result')setPaused(true);ui.openLeaderboard();},
  sound:()=>{audio.enabled=!audio.enabled;if(audio.enabled)audio.unlock();ui.setSound(audio.enabled);},
  fullscreen:()=>{
    if(document.fullscreenElement)void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(()=>{});
  },
});
function mountRoom(demo=false){
  if(!game)return;
  // A retry rolls back only this room's rewards and result, including final-room PAK state.
  if(!demo)roomStart=structuredClone(run);
  // Restarting before a suspended RAF returns must not charge time to the new room.
  last=performance.now();refresh=0;game.loop.resetDelta();
  room?.setPaused(false);room=null;
  game.scene.stop('room');
  game.scene.start('room',{
    config:demo?getRooms('standard')[0]:rooms[index],run:demo?createRun('standard'):run,demo,input,audio,
    onReady:(value:RoomScene)=>{
      room=value;
      if(!demo){ui.update(hud());const canvas=game.canvas;canvas.tabIndex=0;canvas.focus({preventScroll:true});}
    },
    onEnd:()=>{
      if(screen!=='playing'||!room?.rules.result)return;
      screen='result';countdown=resultCountdown(room.rules.result.reason);input.enabled=false;input.clear();
      // The five-second interval starts with the result, after any victory hold.
      last=performance.now();refresh=0;
      ui.update(hud());ui.showRoomResult(room.rules.result,rooms[index],run.tokens);
      audio.play(room.rules.result.reason==='success'?'win':'lose');
    },
  });
}
function showMenu(){
  screen='menu';paused=false;index=0;idle=0;input.enabled=false;input.clear();ui.setPaused(false);ui.showMenu();rooms=getRooms(ui.difficulty);mountRoom(true);
}
function startRun(difficulty:Difficulty){
  if(!game?.isBooted||!ui.canStartRun)return;
  audio.unlock();runId=crypto.randomUUID();run=createRun(difficulty);rooms=getRooms(difficulty);index=0;screen='playing';paused=false;idle=0;
  ui.setPaused(false);ui.showPlaying(rooms[index],index,difficulty);mountRoom();
}
function retryRoom(){
  if(screen!=='result'||paused||!room?.rules.result||room.rules.result.reason==='success')return;
  run=structuredClone(roomStart);screen='playing';countdown=null;idle=0;
  ui.showPlaying(rooms[index],index,run.difficulty);mountRoom();
}
function setPaused(value:boolean){
  if(screen==='menu'||screen==='final')return;
  // A background tab may stop RAF entirely. Paused time belongs to neither clock.
  last=performance.now();refresh=0;
  if(!value)game.loop.resetDelta();
  paused=value;room?.setPaused(value);input.enabled=!value&&screen==='playing';
  ui.setPaused(value);
  if(!value&&screen==='playing')game.canvas.focus({preventScroll:true});
}
function hud(){
  const rules=room!.rules;
  const kinds:ObjectiveKind[]=['incident','debt','backlog','leak','fire','boss'];
  return {
    remaining:rules.remaining,sla:rules.sla,energy:rules.energy,ogn:rules.ogn,
    budget:run.budget,tokens:run.tokens,amulets:run.amulets,pakPhase:room!.pak.phase,
    objectives:kinds.map(kind=>{
      const objectives=[...rules.objectives.values()].filter(o=>o.required&&o.kind===kind);
      return {kind,done:objectives.filter(o=>o.done).length,total:objectives.length};
    }).filter(o=>o.total>0),
    gpu:rules.gpuRemaining,pro:rules.proRemaining,wrench:rules.hasWrench,combo:rules.combo,
    comboRemaining:rules.comboRemaining,entering:rules.status==='entering',
  };
}
window.addEventListener('keydown',e=>{
  idle=0;
  // A refresh temporarily disables the focused dialog button and can move
  // focus to body. Let the modal own keys even in that case (notably Escape).
  if(e.defaultPrevented||document.querySelector('dialog[open]')||(e.target instanceof HTMLElement&&e.target.closest('input, textarea, [contenteditable="true"], dialog')))return;
  if(e.code==='Escape'){
    if(screen==='menu')return;
    e.preventDefault();if(screen==='final'){if(ui.canLeaveFinal())showMenu();}else setPaused(!paused);
  }
  if(e.code==='Enter'&&!(e.target instanceof HTMLElement&&['BUTTON','INPUT','SELECT','A','TEXTAREA'].includes(e.target.tagName))){
    if(screen==='menu'){e.preventDefault();ui.advanceMenu();}
    else if(screen==='final'){e.preventDefault();if(ui.canLeaveFinal())startRun(run.difficulty);}
    else if(paused){e.preventDefault();setPaused(false);}
  }
});
window.addEventListener('pointerdown',()=>{idle=0;});
window.addEventListener('blur',()=>setPaused(true));
document.addEventListener('visibilitychange',()=>{if(document.hidden)setPaused(true);});
// Canvas backgrounds are baked once; load brand fonts before their first render.
await Promise.allSettled(['IBM Plex Sans', 'IBM Plex Mono'].map(font => document.fonts.load(`16px "${font}"`, 'KageCore SamurAI ПАК КОМНАТА 0123456789')));
game=new Phaser.Game({
  type:Phaser.AUTO,parent:'game-canvas',width:960,height:540,
  backgroundColor:'#15212c',pixelArt:true,roundPixels:true,
  // Keep timers tied to elapsed time even when rendering falls below 30 FPS.
  fps:{smoothStep:false},
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
  physics:{default:'arcade',arcade:{gravity:{x:0,y:BALANCE.gravity},fixedStep:true,fps:60,debug:false}},
  audio:{noAudio:true},banner:false,
  callbacks:{postBoot:(booted:Phaser.Game)=>{
    game=booted;game.scene.add('room',new RoomScene(),false);showMenu();
  }},
});
function frame(now:number){
  const dt=last?Math.max((now-last)/1000,0):0;last=now;refresh+=dt;
  if(room&&(screen==='playing'||screen==='result')&&refresh>=0.08){ui.update(hud());refresh=0;}
  if(screen==='result'&&!paused&&countdown!==null){
    countdown-=dt;ui.setCountdown(Math.max(0,countdown));
    if(countdown<=0){
      if(index+1<rooms.length){index++;screen='playing';ui.showPlaying(rooms[index],index,run.difficulty);mountRoom();}
      else{screen='final';idle=0;ui.showFinal(run,runId);}
    }
  }
  // Give stand staff time to issue a paper passport; never discard an active entry.
  if(screen==='final'&&!document.querySelector('dialog[open]')&&!ui.editingPassportNumber){idle+=dt;if(idle>=120)showMenu();}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Read-only diagnostics for development/browser tests; omitted from production.
if(import.meta.env.DEV){
  Object.defineProperty(window,'__uptime',{get:()=>({screen,paused,run:structuredClone(run),room:room?.snapshot})});
}
