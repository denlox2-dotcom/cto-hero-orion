export class GameAudio {
  enabled=true;
  private context:AudioContext|null=null;
  unlock(){this.context??=new AudioContext();void this.context.resume();}
  play(kind:'jump'|'hit'|'collect'|'solve'|'win'|'lose'){
    if(!this.enabled||!this.context||this.context.state!=='running')return;
    const ctx=this.context,osc=ctx.createOscillator(),gain=ctx.createGain();
    const freq={jump:270,hit:90,collect:820,solve:540,win:700,lose:160}[kind];
    osc.type=kind==='hit'?'sawtooth':'square';
    osc.frequency.setValueAtTime(freq,ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(kind==='hit'||kind==='lose'?55:freq*1.65,ctx.currentTime+0.12);
    gain.gain.setValueAtTime(0.025,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.18);
    osc.connect(gain).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+0.19);
  }
}
