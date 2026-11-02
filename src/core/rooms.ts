import { DIFFICULTIES } from './difficulty';
import type { Difficulty, RoomConfig, Spawn } from './types';
const p = (x:number,y:number,width:number) => ({x,y,width,height:16});
const base = [p(0,508,960),p(200,422,184),p(432,336,160),p(688,422,192)];
const officeHint = (penalty:number) => 'Прыгните на техдолг, толкните сбоку — панцирь закроет инциденты и уйдёт за край. Бэклог — ударом снизу' + (penalty ? `, −${penalty} сек.` : ', без штрафа.');
const resources=(prefix:string):Spawn[]=>[
  {id:prefix+'-coffee',kind:'coffee',x:34,y:500,required:false},
  {id:prefix+'-coin1',kind:'coin',x:238,y:400,required:false},
  {id:prefix+'-coin2',kind:'coin',x:285,y:400,required:false},
  {id:prefix+'-coin3',kind:'coin',x:488,y:314,required:false},
  {id:prefix+'-coin4',kind:'coin',x:536,y:314,required:false},
];
export const ROOMS:RoomConfig[]=[
  {
    id:'server',title:'Серверная',subtitle:'Стабилизируйте инфраструктуру',token:'Инфраструктура',
    time:40,color:'#c8ef7d',hint:'Два прыжка — закрыть инцидент. E — тушить. Бусты — касанием.',
    platforms:base,spawn:{x:74,y:340},
    entities:[
      {id:'s-i1',kind:'incident',x:430,y:508,patrol:[410,472]},
      {id:'s-i2',kind:'incident',x:610,y:508,patrol:[576,646]},
      {id:'s-f1',kind:'fire',x:182,y:508},
      {id:'s-f2',kind:'fire',x:784,y:422},
      {id:'s-gpu',kind:'gpu',x:344,y:414,required:false},
      ...resources('s'),
    ],
  },
  {
    id:'office',title:'Опенспейс',subtitle:'Разберите техдолг и бэклог',token:'Команда',
    time:40,color:'#ffc980',hint:officeHint(2),
    platforms:base,spawn:{x:74,y:340},
    entities:[
      {id:'o-debt',kind:'debt',x:420,y:508,patrol:[408,450]},
      {id:'o-i1',kind:'incident',x:534,y:508,patrol:[502,550]},
      {id:'o-i2',kind:'incident',x:640,y:508,patrol:[612,656]},
      {id:'o-b1',kind:'backlog',x:174,y:400},
      {id:'o-b2',kind:'backlog',x:334,y:314},
      {id:'o-b3',kind:'backlog',x:754,y:314},
      {id:'o-f1',kind:'fire',x:118,y:508},
      {id:'o-f2',kind:'fire',x:522,y:336},
      {id:'o-f3',kind:'fire',x:850,y:508},
      ...resources('o'),
    ],
  },
  {
    id:'perimeter',title:'Периметр',subtitle:'Закройте утечки данных',token:'Безопасность',
    time:35,color:'#83d9f5',hint:'Возьмите ящик с ключом. Держите E рядом с утечкой, чтобы починить её.',
    platforms:base,spawn:{x:74,y:340},
    entities:[
      {id:'p-toolbox',kind:'toolbox',x:138,y:500,required:false},
      {id:'p-l1',kind:'leak',x:357,y:508},
      {id:'p-l2',kind:'leak',x:817,y:422},
      {id:'p-f1',kind:'fire',x:226,y:508},
      {id:'p-f2',kind:'fire',x:556,y:508},
      {id:'p-f3',kind:'fire',x:516,y:336},
      ...resources('p'),
    ],
  },
  {
    id:'production',title:'Прод-контур',subtitle:'Потушите пожар в проде',token:'Контур',
    time:40,color:'#ff937b',hint:'Три ключевых очага → щит упадёт → PRO → 2,5 секунды тушения босса.',
    platforms:[p(0,508,960),p(200,422,184),p(688,422,192),p(64,336,112)],
    spawn:{x:74,y:386},
    entities:[
      {id:'b-f1',kind:'fire',x:188,y:508,key:true},
      {id:'b-f2',kind:'fire',x:784,y:422,key:true},
      {id:'b-f3',kind:'fire',x:706,y:508,key:true},
      {id:'b-boss',kind:'boss',x:480,y:508},
      {id:'b-i1',kind:'incident',x:300,y:422,patrol:[252,350],required:false},
      {id:'b-debt',kind:'debt',x:628,y:508,patrol:[616,648],required:false},
      {id:'b-leak',kind:'leak',x:124,y:336,required:false},
      {id:'b-pro',kind:'pro',x:676,y:500,required:false},
      {id:'b-coffee-near',kind:'coffee',x:748,y:500,required:false},
      ...resources('b').map(item => item.id === 'b-coin3' ? {...item,x:744} : item.id === 'b-coin4' ? {...item,x:800} : item),
    ],
  },
];

const EASY_GOALS = new Set(['s-i1', 's-f1', 'o-debt', 'o-b1', 'o-f1', 'p-l1', 'p-f1', 'b-f1', 'b-boss']);
const HARDCORE_EXTRAS: Record<RoomConfig['id'], Spawn[]> = {
  server: [
    { id: 's-i3', kind: 'incident', x: 300, y: 422, patrol: [252, 350] },
    { id: 's-f3', kind: 'fire', x: 522, y: 336 },
  ],
  office: [
    { id: 'o-i3', kind: 'incident', x: 800, y: 422, patrol: [746, 838] },
    { id: 'o-f4', kind: 'fire', x: 604, y: 508 },
  ],
  perimeter: [
    { id: 'p-l3', kind: 'leak', x: 474, y: 508 },
    { id: 'p-i1', kind: 'incident', x: 300, y: 422, patrol: [252, 350] },
    { id: 'p-f4', kind: 'fire', x: 836, y: 508 },
  ],
  production: [],
};

export function getRooms(difficulty: Difficulty): RoomConfig[] {
  const tuning = DIFFICULTIES[difficulty];
  return ROOMS.map((source, index) => {
    const room = structuredClone(source);
    room.time = tuning.roomTimes[index];
    if (difficulty === 'easy') {
      room.entities = room.entities.filter(e => EASY_GOALS.has(e.id) || ['coffee', 'gpu', 'coin', 'pro', 'toolbox'].includes(e.kind));
    } else if (difficulty === 'hardcore') {
      room.entities.push(...structuredClone(HARDCORE_EXTRAS[room.id]));
      // Keep a landing zone beyond the central boss and a clear right-hand approach.
      if (room.id === 'production') room.entities = room.entities.filter(e => e.id !== 'b-debt');
    }
    if (room.entities.some(e => e.kind === 'leak') && !room.entities.some(e => e.kind === 'toolbox')) {
      room.entities.push({ id: room.id + '-toolbox', kind: 'toolbox', x: 138, y: 500, required: false });
    }
    if (room.id === 'office') {
      const penalty = tuning.balance.backlogPenalty ?? 2;
      room.hint = officeHint(penalty);
    }
    if (room.id === 'production') {
      const keys = room.entities.filter(e => e.key).length;
      room.hint = `${keys === 1 ? 'Один ключевой очаг' : 'Три ключевых очага'} → модуль ПАК и PRO. Тушите босса: полный ПАК поможет при 50% HP.`;
    }
    return room;
  });
}
