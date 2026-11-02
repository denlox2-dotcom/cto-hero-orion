import { describe,it,expect } from 'vitest';
import { getRooms } from '../src/core/rooms';
import { BALANCE } from '../src/core/balance';

describe('stompable enemy routes',()=>{
  for(const difficulty of ['easy','standard','hardcore'] as const) for(const room of getRooms(difficulty)){
    for(const enemy of room.entities.filter(e=>e.kind==='incident'||e.kind==='debt')){
      it(`${difficulty}/${room.id}/${enemy.id} leaves enough headroom for a full jump along its patrol`,()=>{
        const [left,right]=enemy.patrol??[enemy.x,enemy.x];
        const headroom=44+BALANCE.jumpVelocity**2/(2*BALANCE.gravity)+4;
        const lowCeilings=room.platforms.filter(p=>p.y<enemy.y&&enemy.y-p.y-p.height<headroom);
        for(const ceiling of lowCeilings){
          expect(right+20<=ceiling.x||left-20>=ceiling.x+ceiling.width,
            `${enemy.id}: patrol ${left}…${right}, ceiling ${ceiling.x}…${ceiling.x+ceiling.width}`).toBe(true);
        }
        expect(room.platforms.some(p=>p.y===enemy.y&&left-20>=p.x&&right+20<=p.x+p.width)).toBe(true);
      });
    }
  }
});
