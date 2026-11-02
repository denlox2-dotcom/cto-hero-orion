import Phaser from 'phaser';
import { buildArt } from '../assets/atlas';
import { buildPakArt } from '../assets/pakArt';
import { PakAssist } from '../core/pak';
import { PAK_ENTRY_Y, VICTORY_HOLD_SECONDS } from '../core/presentation';
import { preloadProductSigns } from '../assets/productSigns';
import { BALANCE, DEBT_SHELL_SPEED } from '../core/balance';
import { hitsBlockFromBelow, isOutsideHorizontalField, touchesPickup } from '../core/collisions';
import { IncidentCycle, RoomRules } from '../core/rules';
import type { DamageSource, Rect, RoomConfig, RunState, Spawn } from '../core/types';
import { KeyboardInput } from './input';
import { GameAudio } from './audio';

interface Actor {
  spec:Spawn; sprite:Phaser.Physics.Arcade.Sprite; active:boolean; progress:number;
  cooldown:number; cycle?:IncidentCycle; shell:boolean; movingShell:boolean; shellHits:number;
  direction:number; shootClock:number; previousShellBody?:Rect;
}
interface Projectile { x:number;y:number;vx:number;vy:number;life:number }
export interface SceneOptions {
  config:RoomConfig;run:RunState;demo:boolean;input:KeyboardInput;audio:GameAudio;
  onReady:(scene:RoomScene)=>void;onEnd:()=>void;
}
export class RoomScene extends Phaser.Scene {
  rules!:RoomRules; config!:RoomConfig; player!:Phaser.Physics.Arcade.Sprite;
  actors:Actor[]=[]; demo=false; facing=1;
  pak!:PakAssist;
  private pakSprite!:Phaser.GameObjects.Image;
  private pakEffects!:Phaser.GameObjects.Graphics;
  private pakCloud!:Phaser.GameObjects.Graphics;
  private pakCall!:Phaser.GameObjects.Text;
  private resultDelay=0;private impactElapsed=0;
  private opts!:SceneOptions; private ground!:Phaser.Physics.Arcade.StaticGroup;
  private effects!:Phaser.GameObjects.Graphics; private bullets:Projectile[]=[];
  private previousBody:Rect|null=null;
  private wrenchEffect!:Phaser.GameObjects.Sprite;
  private elapsed=0;private coyote=0;private buffer=0;private previousFoot=0;
  private delivered=false;private bossClock=0;private demoJump=0;private fireSerial=0;
  constructor(){super('room');}
  preload(){preloadProductSigns(this);}
  init(options:SceneOptions){
    this.opts=options;this.config=options.config;this.demo=options.demo;
    this.rules=new RoomRules(options.config,options.run);
    this.pak=new PakAssist(options.run);this.resultDelay=0;this.impactElapsed=0;
    this.actors=[];this.bullets=[];this.previousBody=null;this.elapsed=0;this.delivered=false;
    this.coyote=0;this.buffer=0;this.bossClock=0;this.fireSerial=0;this.demoJump=0;this.facing=1;
  }
  create(){
    buildArt(this);buildPakArt(this);this.add.image(0,0,'bg-'+this.config.id).setOrigin(0).setDepth(0);
    this.physics.world.setBounds(16,0,928,540);
    this.ground=this.physics.add.staticGroup();
    for(const p of this.config.platforms){
      const tile=this.add.rectangle(p.x+p.width/2,p.y+p.height/2,p.width,p.height,0x334a52).setDepth(1);
      this.physics.add.existing(tile,true);
      if(!this.demo||p.y>=500)this.ground.add(tile);
      if(p.y<500){
        this.add.rectangle(p.x+p.width/2,p.y+2,p.width,4,0x9aac94).setDepth(2);
        this.add.rectangle(p.x+p.width/2,p.y+9,p.width-8,5,0x1b2c38).setDepth(2);
        for(let x=p.x+10;x<p.x+p.width-4;x+=24)this.add.rectangle(x,p.y+10,4,3,0x607771).setDepth(2);
        const g=this.add.graphics().setDepth(1);g.lineStyle(3,0x4b6364,0.6);
        g.lineBetween(p.x+8,p.y+16,p.x+30,p.y+35);g.lineBetween(p.x+p.width-8,p.y+16,p.x+p.width-30,p.y+35);
      }
    }
    for(const entity of this.config.entities)this.addActor(entity);
    this.player=this.physics.add.sprite(this.demo?612:this.config.spawn.x,this.demo?508:this.config.spawn.y,'cto',0).setOrigin(0.5,1).setDepth(8);
    if(this.demo)this.player.setScale(1.35);
    this.player.setCollideWorldBounds(true);
    const body=this.player.body as Phaser.Physics.Arcade.Body;body.setSize(24,44);body.setOffset(9,6);
    this.physics.add.collider(this.player,this.ground);
    this.previousFoot=this.player.y;
    this.effects=this.add.graphics().setDepth(7);
    this.wrenchEffect=this.add.sprite(0,0,'wrench').setDepth(10).setVisible(false);
    this.pakSprite=this.add.image(0,-20,'pak-ready').setName('pak-assist').setOrigin(0.5,1).setDepth(11).setVisible(false);
    this.pakEffects=this.add.graphics().setDepth(12);
    this.pakCloud=this.add.graphics().setName('pak-cloud').setDepth(10).setVisible(false);
    this.pakCall=this.add.text(0,0,'ПАК-AI, НА ПОМОЩЬ!',{
      fontFamily:'IBM Plex Mono',fontSize:'13px',fontStyle:'bold',color:'#e8fff2',backgroundColor:'#193c35',padding:{x:8,y:6},
    }).setName('pak-call').setOrigin(0.5,1).setDepth(20).setVisible(false);
    this.opts.input.clear();this.opts.input.enabled=!this.demo;
    const world=this.physics.world;
    world.on(Phaser.Physics.Arcade.Events.WORLD_STEP,this.checkBacklogHits,this);
    this.events.once('shutdown',()=>{
      this.opts.input.clear();
      world.off(Phaser.Physics.Arcade.Events.WORLD_STEP,this.checkBacklogHits,this);
    });
    this.opts.onReady(this);
  }
  private addActor(spec:Spawn){
    const actor:Actor={
      spec,sprite:this.physics.add.sprite(spec.x,spec.y,spec.kind).setOrigin(0.5,1).setDepth(4),
      active:true,progress:0,cooldown:0,shell:false,movingShell:false,shellHits:0,
      direction:-1,shootClock:this.rules.tuning.leakShotInterval,
      cycle:spec.kind==='incident'?new IncidentCycle():undefined,
    };
    const body=actor.sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(spec.kind==='incident'||spec.kind==='debt');
    if(spec.kind==='incident'||spec.kind==='debt'){
      body.setSize(actor.sprite.width-4,actor.sprite.height-2).setOffset(2,2);
      this.physics.add.collider(actor.sprite,this.ground);
    }else body.setImmovable(true);
    if(spec.kind==='fire'){
      actor.sprite.setScale(spec.key?1.05:0.85);
      // Only the lower core burns the hero; the artwork and spray target stay full size.
      body.setSize(BALANCE.fireHitboxWidth,BALANCE.fireHitboxHeight);
      body.setOffset((actor.sprite.width-BALANCE.fireHitboxWidth)/2,actor.sprite.height-BALANCE.fireHitboxHeight);
    }
    if(spec.kind==='boss'&&this.opts.run.difficulty==='hardcore'){
      // The metal body hurts; the decorative flame above it leaves a jump route.
      body.setSize(88,88).setOffset(12,40);
    }
    if(spec.kind==='pro'&&this.config.id==='production')actor.sprite.setVisible(false);
    this.actors.push(actor);return actor;
  }
  setPaused(paused:boolean){
    this.rules.paused=paused;this.opts.input.clear();this.previousBody=null;
    if(paused){this.physics.pause();this.anims.pauseAll();this.tweens.pauseAll();}
    else{
      if(this.rules.status!=='ended'&&!this.pakPresenting)this.physics.resume();
      this.anims.resumeAll();this.tweens.resumeAll();
    }
  }
  private get pakPresenting(){return this.pak.phase==='warning'||this.pak.phase==='falling';}
  get shieldOpen(){return this.actors.filter(a=>a.spec.key).every(a=>!a.active);}
  get snapshot(){
    return {room:this.config.id,status:this.rules.status,paused:this.rules.paused,
      x:this.player?.x,y:this.player?.y,facing:this.facing,
      vy:(this.player?.body as Phaser.Physics.Arcade.Body)?.velocity.y,
      grounded:!!((this.player?.body as Phaser.Physics.Arcade.Body)?.blocked.down||(this.player?.body as Phaser.Physics.Arcade.Body)?.touching.down),
      actors:this.actors.map(a=>({id:a.spec.id,kind:a.spec.kind,x:a.sprite.x,y:a.sprite.y,
        active:a.active,progress:a.progress,state:a.cycle?.state,shell:a.shell})),
      remaining:this.rules.remaining,energy:this.rules.energy,sla:this.rules.sla,
      ogn:this.rules.ogn,wrench:this.rules.hasWrench,difficulty:this.rules.run.difficulty,pro:this.rules.proRemaining,gpu:this.rules.gpuRemaining,shieldOpen:this.shieldOpen,
      pak:{phase:this.pak.phase,x:this.pakSprite?.x,y:this.pakSprite?.y,progress:this.pak.fallProgress}};
  }
  update(_time:number,delta:number){
    if(!this.player||this.rules.paused)return;
    const dt=Math.max(0,delta/1000),body=this.player.body as Phaser.Physics.Arcade.Body;
    this.elapsed+=dt;
    if(this.rules.status==='entering'){
      this.previousBody={x:body.x,y:body.y,width:body.width,height:body.height};
      if(body.blocked.down||body.touching.down)this.rules.start();
      else{this.player.setFrame(6);return;}
    }
    if(this.rules.status==='ended'){
      this.player.setVelocity(0,0);this.physics.pause();
      this.updatePak(dt);
      this.resultDelay=Math.max(0,this.resultDelay-dt);
      if(this.resultDelay>0)return;
      if(!this.delivered){this.delivered=true;this.opts.onEnd();}return;
    }
    if(this.pakPresenting){this.updatePak(dt);return;}
    if(!this.demo){
      this.rules.tick(dt,this.actors.filter(a=>a.spec.kind==='fire'&&a.active).length);
      if(this.rules.status!=='playing')return;
    }
    let direction=0,spray=false;
    const grounded=body.blocked.down||body.touching.down;
    this.coyote=grounded?BALANCE.coyoteTime:Math.max(0,this.coyote-dt);
    this.buffer=Math.max(0,this.buffer-dt);
    if(this.demo){
      // Choose direction after turning; the shared facing assignment below
      // must retain the new direction instead of restoring the previous one.
      if(this.player.x>900)this.facing=-1;
      if(this.player.x<60)this.facing=1;
      direction=this.facing;
      this.demoJump-=dt;
      if(grounded&&this.demoJump<=0){this.buffer=BALANCE.jumpBuffer;this.demoJump=2.4;}
      spray=Math.sin(this.elapsed*1.2)>0.1;
    }else{
      if(this.opts.input.isDown('KeyA','ArrowLeft'))direction--;
      if(this.opts.input.isDown('KeyD','ArrowRight'))direction++;
      if(this.opts.input.consume('Space'))this.buffer=BALANCE.jumpBuffer;
      spray=this.opts.input.isDown('KeyE');
    }
    if(direction)this.facing=direction;
    const speed=BALANCE.moveSpeed*(this.rules.gpuRemaining>0?1.2:1);
    this.player.setVelocityX(direction*speed);
    if(this.buffer>0&&this.coyote>0){
      this.player.setVelocityY(this.demo?-220:-BALANCE.jumpVelocity);this.buffer=0;this.coyote=0;
      if(!this.demo)this.opts.audio.play('jump');
    }
    this.player.setFlipX(this.facing<0);
    this.player.setFrame(!grounded?6:spray?7:direction?2+Math.floor(this.elapsed*10)%4:Math.floor(this.elapsed*2)%2);
    this.player.setAlpha(this.rules.invulnerable>0&&Math.floor(this.elapsed*16)%2===0?0.45:1);
    this.effects.clear();this.wrenchEffect.setVisible(false);
    this.updateActors(dt);
    this.updateBullets(dt);
    if(spray)this.useTool(dt);
    this.updatePak(dt);
    this.drawIndicators();
    if(this.config.id==='production'&&!this.demo&&this.rules.status==='playing'&&!this.pakPresenting)this.bossHazards(dt);
    this.previousFoot=body.bottom;
    this.previousBody={x:body.x,y:body.y,width:body.width,height:body.height};
  }
  private collectPickup(actor:Actor){
    const kind=actor.spec.kind;
    if(kind==='pro'&&this.config.id==='production'&&!this.shieldOpen)return;
    const energyBefore=this.rules.energy;
    if(kind==='backlog'){
      if(!this.rules.complete(actor.spec.id))return;
      this.breakBacklog(actor);
      const penalty=this.rules.balance.backlogPenalty;
      this.pop(actor.sprite.x,actor.sprite.y-42,`+100 ₽${penalty?` · −${penalty} СЕК`:''}`,'#ffcd82');
    }else if(kind==='toolbox'){
      if(!this.rules.collect('wrench'))return;
      const drop=this.add.sprite(actor.sprite.x,actor.sprite.y-24,'wrench').setDepth(12);
      this.tweens.add({targets:drop,x:this.player.x,y:this.player.y-52,angle:40,duration:400,onComplete:()=>drop.destroy()});
      this.pop(actor.sprite.x,actor.sprite.y-58,'КЛЮЧ · E РЯДОМ С УТЕЧКОЙ','#b9e4ed');
    }else if(kind==='coffee'||kind==='gpu'||kind==='pro'||kind==='coin'){
      if(!this.rules.collect(kind))return;
      const label={coffee:energyBefore>=BALANCE.maxEnergy?'КОФЕ · ЗАПАС ПОЛОН':`+${Math.round(this.rules.energy-energyBefore)} ЭНЕРГИИ`,gpu:'GPU · 15 СЕК',pro:'PRO · 30 СЕК',coin:'+10 ₽'}[kind];
      const color={coffee:'#fff0ce',gpu:'#b9e4ff',pro:'#91e5ff',coin:'#ffe0a1'}[kind];
      this.pop(actor.sprite.x,actor.sprite.y-42,label,color);
    }else return;
    actor.cooldown=kind==='coffee'?BALANCE.coffeeRespawn:kind==='pro'?5:Infinity;
    this.retire(actor);this.opts.audio.play('collect');
  }
  private breakBacklog(actor:Actor){
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const {x,y}=actor.sprite;
    // Decorative pieces have no physics bodies; head strikes stay unchanged.
    const lid=this.add.image(x,y,'backlog').setOrigin(0.5,1).setDepth(6);
    this.tweens.add({targets:lid,y:y-6,alpha:0,duration:140,onComplete:()=>lid.destroy()});
    for(const [dx,dy] of [[-16,-6],[16,-8],[-10,13],[12,15]]){
      const chip=this.add.rectangle(x+Math.sign(dx)*8,y-15,5,5,dy<0?0xffe5ad:0xb78c5e).setDepth(6);
      this.tweens.add({targets:chip,x:x+dx,y:y-15+dy,alpha:0,angle:dx*3,duration:260,onComplete:()=>chip.destroy()});
    }
  }
  private touchesLoot(actor:Actor){
    const body=this.player.body as Phaser.Physics.Arcade.Body;
    const target=actor.sprite.body as Phaser.Physics.Arcade.Body;
    const current={x:body.x,y:body.y,width:body.width,height:body.height};
    return touchesPickup(this.previousBody??current,current,{x:target.x,y:target.y,width:target.width,height:target.height});
  }
  private retire(actor:Actor){
    actor.active=false;actor.sprite.setVisible(false);actor.sprite.setVelocity(0,0);
    (actor.sprite.body as Phaser.Physics.Arcade.Body).enable=false;
  }
  private overlaps(actor:Actor){
    const b=this.player.body as Phaser.Physics.Arcade.Body;
    const e=actor.sprite.body as Phaser.Physics.Arcade.Body;
    return b.left<e.right&&b.right>e.left&&b.top<e.bottom&&b.bottom>e.top;
  }
  private checkBacklogHits(){
    if(this.demo||this.rules.paused||this.rules.status!=='playing')return;
    const body=this.player.body as Phaser.Physics.Arcade.Body;
    // Arcade updates prev before every fixed step, including the first after pause.
    const previous={x:body.prev.x,y:body.prev.y,width:body.width,height:body.height};
    const current={x:body.x,y:body.y,width:body.width,height:body.height};
    for(const actor of this.actors){
      if(!actor.active||actor.spec.kind!=='backlog')continue;
      const target=actor.sprite.body as Phaser.Physics.Arcade.Body;
      if(!hitsBlockFromBelow(previous,current,{x:target.x,y:target.y,width:target.width,height:target.height}))continue;
      this.collectPickup(actor);
      if(!actor.active)this.player.setVelocityY(0);
    }
  }
  private updateActors(dt:number){
    const playerBody=this.player.body as Phaser.Physics.Arcade.Body;
    for(const actor of this.actors){
      const {spec,sprite}=actor;
      if(!actor.active){
        if(Number.isFinite(actor.cooldown)&&actor.cooldown>0){
          actor.cooldown-=dt;
          if(actor.cooldown<=0){
            actor.active=true;sprite.setVisible(true);(sprite.body as Phaser.Physics.Arcade.Body).enable=true;
          }
        }continue;
      }
      if(spec.kind==='pro'&&this.config.id==='production')sprite.setVisible(this.shieldOpen);
      if(spec.kind==='backlog')continue;
      if(['coffee','gpu','pro','coin','toolbox'].includes(spec.kind)){
        if(!this.demo&&this.touchesLoot(actor))this.collectPickup(actor);
        continue;
      }
      if(spec.kind==='fire')sprite.setFrame(Math.floor(this.elapsed*18)%4);
      if(spec.kind==='boss'){
        sprite.setFrame(Math.floor(this.elapsed*12)%4);
        sprite.setScale(1+this.rules.ogn*0.0012);
      }
      if(spec.kind==='incident'){
        actor.cycle!.tick(dt);
        if(actor.cycle!.state==='ticket'){
          if(sprite.texture.key!=='ticket')this.actorTexture(actor,'ticket');
          sprite.setVelocityX(0);
        }else{
          if(sprite.texture.key==='ticket')this.actorTexture(actor,'incident');
          sprite.setFrame(Math.floor(this.elapsed*4)%2);
          this.patrol(actor,30);
        }
      }
      if(spec.kind==='debt'){
        if(actor.movingShell){
          const shellBody=sprite.body as Phaser.Physics.Arcade.Body;
          const current={x:shellBody.x,y:shellBody.y,width:shellBody.width,height:shellBody.height};
          sprite.setVelocityX(actor.direction*DEBT_SHELL_SPEED);
          for(const other of this.actors){
            if(!other.active||other.spec.kind!=='incident')continue;
            const target=other.sprite.body as Phaser.Physics.Arcade.Body;
            if(!touchesPickup(actor.previousShellBody??current,current,{x:target.x,y:target.y,width:target.width,height:target.height},0))continue;
            const hits=actor.shellHits+1;
            // Include the one-time bonus in completion, even if this hit ends the room.
            if(!this.rules.complete(other.spec.id,'other',hits===2?3:hits>2?2:1))continue;
            actor.shellHits=hits;other.cycle?.close();
            if(hits===2)this.pop(sprite.x,sprite.y-44,'РЕФАКТОРИНГ ×2','#d6f493');
            this.retire(other);this.opts.audio.play('solve');
          }
          actor.previousShellBody=current;
          if(isOutsideHorizontalField(sprite.getBounds(),960))this.retire(actor);
          continue;
        }else if(!actor.shell){this.patrol(actor,22);sprite.setFrame(Math.floor(this.elapsed*3)%2);}
      }
      if(spec.kind==='leak'){
        const exposed=(this.elapsed*this.rules.tuning.enemyTempo+spec.x/100)%4<2.7;
        sprite.setFrame(exposed?0:1);sprite.setAlpha(exposed?1:0.65);
        actor.shootClock-=dt;
        if(exposed&&actor.shootClock<=0&&!this.demo){
          actor.shootClock=this.rules.tuning.leakShotInterval;
          const dx=this.player.x-sprite.x,dy=this.player.y-24-(sprite.y-30),length=Math.hypot(dx,dy)||1;
          this.bullets.push({x:sprite.x,y:sprite.y-30,vx:dx/length*this.rules.tuning.projectileSpeed,vy:dy/length*this.rules.tuning.projectileSpeed,life:7});
        }
      }
      if(this.demo||!['incident','debt','fire','leak','boss'].includes(spec.kind)||!this.overlaps(actor))continue;
      const enemyBody=sprite.body as Phaser.Physics.Arcade.Body;
      const stomp=playerBody.velocity.y>25&&this.previousFoot<=enemyBody.top+12;
      if(stomp&&(spec.kind==='incident'||spec.kind==='debt')){
        // Separate the bodies before bouncing, even if the next render has no physics step.
        playerBody.y=enemyBody.top-playerBody.height;playerBody.updateCenter();
      }
      if(spec.kind==='incident'&&stomp){
        this.player.setVelocityY(-340);
        if(actor.cycle!.stomp()){this.rules.complete(spec.id);this.retire(actor);this.pop(sprite.x,sprite.y-40,'ЗАКРЫТО +100 ₽','#d6f493');}
        else{this.actorTexture(actor,'ticket');sprite.setVelocityX(0);this.pop(sprite.x,sprite.y-36,'ЕЩЁ ОДИН ПРЫЖОК','#ffcd82');}
        this.opts.audio.play('solve');
      }else if(spec.kind==='debt'&&stomp&&!actor.shell){
        actor.shell=true;this.actorTexture(actor,'shell');sprite.setVelocityX(0);
        this.player.setVelocityY(-310);this.pop(sprite.x,sprite.y-40,'ТОЛКНИТЕ СБОКУ','#d6f493');
      }else if(spec.kind==='debt'&&actor.shell&&stomp){
        this.player.setVelocityY(-280);
      }else if(spec.kind==='debt'&&actor.shell&&!actor.movingShell){
        actor.movingShell=true;
        actor.direction=this.player.x<sprite.x?1:-1;this.rules.complete(spec.id);
        sprite.setVelocityX(actor.direction*DEBT_SHELL_SPEED);
        actor.previousShellBody={x:enemyBody.x,y:enemyBody.y,width:enemyBody.width,height:enemyBody.height};
        this.opts.audio.play('solve');
      }else{
        this.damage(spec.kind==='fire'?'fire':spec.kind==='boss'?'boss':'contact');
      }
    }
  }
  private patrol(actor:Actor,speed:number){
    const range=actor.spec.patrol??[actor.spec.x-30,actor.spec.x+30];
    if(actor.sprite.x<=range[0])actor.direction=1;
    if(actor.sprite.x>=range[1])actor.direction=-1;
    actor.sprite.setVelocityX(actor.direction*speed*this.rules.tuning.enemyTempo);actor.sprite.setFlipX(actor.direction<0);
  }
  private actorTexture(actor:Actor,key:string){
    actor.sprite.setTexture(key);
    (actor.sprite.body as Phaser.Physics.Arcade.Body).setSize(actor.sprite.width-4,actor.sprite.height-2,true);
  }
  private damage(source:DamageSource){
    const before=this.rules.sla;
    if(!this.rules.takeDamage(source))return;
    this.opts.audio.play('hit');this.cameras.main.shake(90,0.002);
    this.pop(this.player.x,this.player.y-56,`−${before-this.rules.sla} SLA`,'#ff9a83');
  }
  private useTool(dt:number){
    const x=this.player.x+this.facing*19,y=this.player.y-26;
    const leak=this.rules.hasWrench?this.actors.filter(a=>{
      const dx=(a.sprite.x-x)*this.facing;
      // A nearby leak can sit between the hero and the extended hand.
      const inFront=(a.sprite.x-this.player.x)*this.facing>=-12;
      return a.active&&a.spec.kind==='leak'&&inFront&&dx<=140&&Math.abs(a.sprite.y-20-y)<=40;
    }).sort((a,b)=>Math.abs(a.sprite.x-x)-Math.abs(b.sprite.x-x))[0]:undefined;
    if(!leak){this.extinguish(dt);return;}
    const seconds=this.rules.repair(dt);
    if(seconds<=0)return;
    this.wrenchEffect.setVisible(true).setPosition(x+this.facing*8,y-8).setAngle(this.facing*(Math.sin(this.elapsed*24)*30+25));
    this.effects.lineStyle(2,0xb9e4ed,0.65);
    this.effects.lineBetween(x,y,leak.sprite.x,leak.sprite.y-22);
    for(let i=0;i<5;i++){
      this.effects.fillStyle(i%2?0xffd58c:0xb9e4ed,0.9);
      this.effects.fillRect(leak.sprite.x+Math.sin(this.elapsed*24+i*2)*19,leak.sprite.y-22+Math.cos(this.elapsed*24+i)*13,3,3);
    }
    leak.progress+=seconds;
    if(leak.progress>=BALANCE.leakSeconds){
      this.rules.complete(leak.spec.id);this.retire(leak);this.opts.audio.play('solve');
      this.pop(leak.sprite.x,leak.sprite.y-50,'УТЕЧКА УСТРАНЕНА','#b9e4ed');
    }
  }
  private extinguish(dt:number){
    const seconds=this.demo?dt:this.rules.spray(dt);
    if(seconds<=0)return;
    const pro=this.rules.proRemaining>0,range=pro?210:100;
    const x=this.player.x+this.facing*19,y=this.player.y-26;
    this.effects.fillStyle(pro?0xb2edff:0xe0f4d9,0.15);
    this.effects.fillRect(this.facing>0?x:x-range,y-12,range,28);
    for(let i=0;i<18;i++){
      const distance=((i*17+this.elapsed*360)%range);
      this.effects.fillStyle(i%3===0?0xffffff:pro?0x9bdcf2:0xc1dfc3,0.8-distance/range*0.5);
      this.effects.fillRect(x+this.facing*distance,y+Math.sin(i*7+this.elapsed*24)*distance*0.13,5,3);
    }
    if(this.demo)return;
    for(const actor of this.actors){
      if(!actor.active||!['fire','boss'].includes(actor.spec.kind))continue;
      const targetY=actor.sprite.y-(actor.spec.kind==='boss'?48:20);
      const dx=(actor.sprite.x-x)*this.facing;
      if(dx< -12||dx>range||Math.abs(targetY-y)>(pro?47:35))continue;
      if(actor.spec.kind==='boss'&&(!pro||!this.shieldOpen))continue;
      actor.progress+=seconds*(this.rules.gpuRemaining>0&&actor.spec.kind!=='boss'?1.4:1);
      const required=actor.spec.kind==='boss'?BALANCE.bossSeconds:BALANCE.fireSeconds;
      if(actor.progress>=required){
        this.finishObjective(actor);
      }
    }
  }
  private finishObjective(actor:Actor){
    if(!this.rules.complete(actor.spec.id,actor.spec.kind==='fire'?'fire':'other'))return;
    this.retire(actor);this.opts.audio.play(actor.spec.kind==='boss'?'win':'solve');
    this.pop(actor.sprite.x,actor.sprite.y-50,actor.spec.kind==='boss'?'ПРОД СПАСЁН!':this.rules.combo>1?'КОМБО ×'+this.rules.combo:'ПОТУШЕНО','#d6f493');
    if(actor.spec.kind==='boss'){
      this.resultDelay=VICTORY_HOLD_SECONDS;
      this.player.setVelocity(0,0);this.physics.pause();
      this.effects.clear();this.wrenchEffect.setVisible(false);
      this.bullets=[];for(const other of this.actors)if(other.active)this.retire(other);
      for(let i=0;i<3;i++){
        const expert=this.add.sprite(960+i*45,508,'cto',2+i).setOrigin(0.5,1).setFlipX(true).setDepth(8).setTint(0x9ed9ed);
        this.tweens.add({targets:expert,x:820-i*50,duration:650+i*100,ease:'Power2'});
      }
    }
  }
  private updatePak(dt:number){
    if(this.demo||this.config.id!=='production')return;
    const boss=this.actors.find(actor=>actor.spec.kind==='boss');
    if(!boss)return;
    const battle={playing:this.rules.status==='playing',paused:this.rules.paused,shieldOpen:this.shieldOpen,
      bossHealth:boss.active?Math.max(0,1-boss.progress/BALANCE.bossSeconds):0};
    const justLaunched=this.pak.tryLaunch(battle);
    if(justLaunched){
      this.player.setVelocity(0,0);this.physics.pause();this.opts.input.clear();
      this.effects.clear();this.wrenchEffect.setVisible(false);
      this.pakCall.setPosition(this.player.x,this.player.y-68);
    }
    // The frame that triggered the warning belongs to the player attack, not to the fall.
    this.pakSprite.setX(boss.sprite.x);
    const hit=this.pak.advance(justLaunched?0:dt,battle);
    if(hit){
      boss.progress=BALANCE.bossSeconds;
      this.finishObjective(boss);
      this.pakSprite.setPosition(boss.sprite.x,boss.sprite.y).setVisible(true).setAlpha(1);
      this.impactElapsed=0;
      this.pop(boss.sprite.x-80,310,'ПАК-AI · ПРОД СПАСЁН','#aaf5cf');
    }
    this.pakEffects.clear();
    this.pakCloud.clear().setVisible(false);
    this.pakCall.setVisible(this.pak.phase==='warning');
    const x=boss.sprite.x,y=boss.sprite.y;
    if(this.pak.phase==='warning'||this.pak.phase==='falling'){
      this.pakEffects.fillStyle(0x8eeabd,0.18);this.pakEffects.fillRect(x-59,y-5,118,7);
      this.pakEffects.lineStyle(2,0xaaf5cf,0.9);
      for(const side of [-1,1]){
        this.pakEffects.lineBetween(x+side*62,y-13,x+side*62,y+1);
        this.pakEffects.lineBetween(x+side*62,y+1,x+side*42,y+1);
      }
      if(this.pak.phase==='falling'){
        const p=this.pak.fallProgress;
        this.drawPakCloud(x,p);
        this.pakSprite.setVisible(true).setAlpha(Math.min(1,p/0.2)).setY(PAK_ENTRY_Y+(y-PAK_ENTRY_Y)*p*p);
        this.pakEffects.fillStyle(0xb8eaf8,0.65);
        for(const side of [-1,1])for(let i=0;i<3;i++)this.pakEffects.fillRect(x+side*(53+i*7),this.pakSprite.y-180-i*11,2,26+i*9);
      }
    }else if(this.pak.phase==='impact'){
      this.impactElapsed+=hit?0:dt;
      const p=Math.min(1,this.impactElapsed/0.65);
      if(p<0.25){
        this.pakEffects.fillStyle(0xe8fff2,(1-p/0.25)*0.55);
        this.pakEffects.fillRect(x-62,y-18,124,20);
      }
      for(let i=0;i<22;i++){
        const side=i%2?1:-1,distance=20+p*(22+i*3);
        this.pakEffects.fillStyle(i%3?0xffbd68:0xa6b5b6,1-p);
        this.pakEffects.fillRect(Math.round(x+side*distance),Math.round(y-5-Math.sin(p*Math.PI)*(14+i%6*9)),i%3?4:8,i%3?4:6);
      }
    }else this.pakSprite.setVisible(false);
  }
  private drawPakCloud(x:number,p:number){
    if(p>=0.65)return;
    const opacity=Math.min(1,p/0.04)*(1-Math.max(0,p-0.25)/0.4);
    const spread=0.75+Math.min(1,p/0.2)*0.25,y=PAK_ENTRY_Y-10;
    this.pakCloud.setVisible(true);
    this.pakCloud.fillStyle(0x8eeabd,opacity*0.85);
    for(const [left,top,width,height] of [[-82,-12,164,28],[-64,-30,128,32],[-42,-44,84,30],[-62,10,124,20]]){
      this.pakCloud.fillRect(Math.round(x+left*spread),Math.round(y+top*spread),Math.round(width*spread),Math.round(height*spread));
    }
    this.pakCloud.fillStyle(0xe8fff2,opacity*0.75);
    this.pakCloud.fillRect(x-54,y-15,108,30);this.pakCloud.fillRect(x-32,y-30,64,55);
    this.pakCloud.fillStyle(0xe8fff2,Math.max(0,1-p/0.18));
    for(const side of [-1,1]){
      this.pakCloud.fillRect(x+side*94-3,y-3,6,6);
      this.pakCloud.fillRect(x+side*102-2,y-18,4,4);
      this.pakCloud.fillRect(x+side*68-2,y-48,4,10);
    }
  }
  private updateBullets(dt:number){
    for(const b of this.bullets){
      b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
      this.effects.fillStyle(0x96dbf1,1);this.effects.fillRect(b.x-4,b.y-3,8,6);
      if(Math.abs(b.x-this.player.x)<17&&Math.abs(b.y-(this.player.y-24))<24){
        this.damage('projectile');b.life=0;
      }
    }
    this.bullets=this.bullets.filter(b=>b.life>0&&b.x>0&&b.x<960&&b.y>0&&b.y<540);
  }
  private drawIndicators(){
    const remaining=this.actors.filter(a=>a.active&&a.spec.required!==false&&this.rules.objectives.has(a.spec.id));
    for(const actor of this.actors){
      if(!actor.active)continue;
      const x=actor.sprite.x,y=actor.sprite.y;
      if(remaining.length===1&&remaining[0]===actor){
        this.effects.lineStyle(2,0xd6f493,0.5+Math.sin(this.elapsed*6)*0.2);
        this.effects.strokeRect(x-actor.sprite.displayWidth/2-6,y-actor.sprite.displayHeight-6,actor.sprite.displayWidth+12,actor.sprite.displayHeight+12);
      }
      if(actor.spec.key){
        this.effects.fillStyle(0xffd383,1);this.effects.fillRect(x-3,y-actor.sprite.displayHeight-12,6,6);
      }
      if(actor.spec.kind==='boss'&&!this.shieldOpen){
        this.effects.lineStyle(3,0x8cd7ee,0.5+Math.sin(this.elapsed*4)*0.15);
        this.effects.strokeRect(x-64,y-136,128,136);
      }
      if(actor.progress>0||actor.spec.kind==='boss'){
        const total=actor.spec.kind==='boss'?BALANCE.bossSeconds:actor.spec.kind==='leak'?BALANCE.leakSeconds:BALANCE.fireSeconds;
        this.effects.fillStyle(0x122331,1);this.effects.fillRect(x-22,y-actor.sprite.displayHeight-8,44,4);
        this.effects.fillStyle(actor.spec.kind==='boss'?0xff937b:0xd6f493,1);this.effects.fillRect(x-22,y-actor.sprite.displayHeight-8,44*(actor.spec.kind==='boss'?Math.max(0,1-actor.progress/total):Math.min(1,actor.progress/total)),4);
      }
    }
  }
  private bossHazards(dt:number){
    if(this.rules.tuning.bossFireLimit===0)return;
    if(this.opts.run.difficulty==='hardcore'&&!this.shieldOpen)return;
    this.bossClock+=dt;
    if(this.bossClock<this.rules.tuning.bossFireInterval)return;this.bossClock=0;
    const extras=this.actors.filter(a=>a.active&&a.spec.kind==='fire'&&!a.spec.key);
    if(extras.length>=this.rules.tuning.bossFireLimit)return;
    const spots=[380,620,260,755];const x=spots.find(v=>Math.abs(v-this.player.x)>72&&!extras.some(a=>Math.abs(a.sprite.x-v)<35));
    if(x===undefined)return;
    const id='extra-'+this.fireSerial++;
    this.rules.objectives.set(id,{id,kind:'fire',required:false,done:false});
    this.addActor({id,kind:'fire',x,y:508,required:false});
  }
  private pop(x:number,y:number,label:string,color:string){
    const text=this.add.text(x,y,label,{fontFamily:'IBM Plex Mono',fontSize:'12px',fontStyle:'bold',color,backgroundColor:'#15212cd9',padding:{x:5,y:3}}).setOrigin(0.5).setDepth(20);
    this.tweens.add({targets:text,y:y-30,alpha:0,duration:1100,delay:180,onComplete:()=>text.destroy()});
  }
}
