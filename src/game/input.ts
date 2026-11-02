export class KeyboardInput {
  held=new Set<string>(); pressed=new Set<string>(); enabled=false;
  private down=(e:KeyboardEvent)=>{
    if(!this.enabled)return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code))e.preventDefault();
    if(!e.repeat)this.pressed.add(e.code); this.held.add(e.code);
  };
  private up=(e:KeyboardEvent)=>{this.held.delete(e.code);};
  private blur=()=>this.clear();
  constructor(){window.addEventListener('keydown',this.down);window.addEventListener('keyup',this.up);window.addEventListener('blur',this.blur);}
  isDown(...codes:string[]){return codes.some(c=>this.held.has(c));}
  consume(code:string){const hit=this.pressed.has(code);this.pressed.delete(code);return hit;}
  clear(){this.held.clear();this.pressed.clear();}
  dispose(){window.removeEventListener('keydown',this.down);window.removeEventListener('keyup',this.up);window.removeEventListener('blur',this.blur);}
}
