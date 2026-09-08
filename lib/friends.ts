export const GLYPHS = '0123456789+-★?!=×÷*';
export const EARS = ['classic', 'bear', 'rabbit-plump', 'antenna-soft', 'monkey', 'sprout-round'] as const;
export const LEGACY_EARS = ['long', 'round', 'tilt', 'rabbit', 'antenna', 'rabbit-straight', 'antenna-single', 'sprout'] as const;
export const MOUTHS = ['flat', 'smile-soft', 'oval-soft', 'wave-soft', 'beak-soft'] as const;
export const LEGACY_MOUTHS = ['smile', 'oval', 'wave', 'beak'] as const;
export type Ear = typeof EARS[number] | typeof LEGACY_EARS[number];
export type Mouth = typeof MOUTHS[number] | typeof LEGACY_MOUTHS[number];
export const EAR_LABELS: Record<Ear,string> = {bear:'まるみみ','rabbit-plump':'うさみみ','rabbit-straight':'うさみみ','antenna-soft':'あんてな','antenna-single':'あんてな','sprout-round':'はっぱ',sprout:'はっぱ',rabbit:'うさみみ',antenna:'あんてな',monkey:'おさる',classic:'いつもの',long:'ながめ',round:'まるめ',tilt:'かたっぽ'};
export function isCurrentEar(ear:Ear):ear is typeof EARS[number]{return (EARS as readonly string[]).includes(ear);}
export const MOUTH_LABELS: Record<Mouth,string> = {flat:'すん','smile-soft':'にこ','oval-soft':'ぽかん','wave-soft':'むにゃ','beak-soft':'ちょん',smile:'にこ',oval:'ぽかん',wave:'むにゃ',beak:'ちょん'};
export function isCurrentMouth(mouth:Mouth):mouth is typeof MOUTHS[number]{return (MOUTHS as readonly string[]).includes(mouth);}
export const PALETTES = [
 {id:'lemon',name:'レモンソーダ',body:['#fedf25','#f8bd35','#e9ed79'],eye:['#f7f7f7','#fff5d6','#e0f2ed'],mouth:['#1e6b7d','#365e59','#cc5940'],ink:'#ff7b33',background:'#b5e5ed'},
 {id:'berry',name:'いちごミルク',body:['#f1a6bb','#eb7b9c','#f4c5c8'],eye:['#fff6e7','#f7f7f7','#f9e6b9'],mouth:['#704966','#5a556e','#a64757'],ink:'#a14e63',background:'#f7e6c7'},
 {id:'pool',name:'夜のプール',body:['#68b5e6','#438ccb','#89cadb'],eye:['#f7f7f7','#fff0ae','#ddf3ef'],mouth:['#244674','#3a5d6d','#814d72'],ink:'#dd733d',background:'#dce5fa'},
 {id:'melon',name:'メロンフロート',body:['#a8c886','#77b99e','#c4d887'],eye:['#fff9e8','#f7f7f7','#f9e2c8'],mouth:['#335e5a','#576a39','#9c594c'],ink:'#b96b39',background:'#e8efcf'},
 {id:'grape',name:'ぶどうラムネ',body:['#b6a3dc','#9a8ccc','#c6b0df'],eye:['#fff5ce','#f7f7f7','#efeee5'],mouth:['#51486e','#715177','#405d79'],ink:'#775a92',background:'#e8e0f4'},
 {id:'sunset',name:'夕やけ',body:['#f4a45b','#ed8261','#f5bd76'],eye:['#fff7df','#f7f7f7','#e2eee7'],mouth:['#386f79','#7c4b48','#665678'],ink:'#aa5343',background:'#f8e0d0'},
] as const;
export type Friend = {v:1;eyes:string;ear:Ear;mouth:Mouth;palette:string;bodyColor:string;eyeColor:string;mouthColor:string;inkColor:string};
export const LOCK_KEYS = ['eyes','ear','mouth','palette','bodyColor','eyeColor','mouthColor'] as const;
export type LockKey = typeof LOCK_KEYS[number];
export type Locks = Record<LockKey,boolean>;
export const EMPTY_LOCKS:Locks = {eyes:false,ear:false,mouth:false,palette:false,bodyColor:false,eyeColor:false,mouthColor:false};
export const ORIGINAL:Friend = {v:1,eyes:'524',ear:'classic',mouth:'flat',palette:'lemon',bodyColor:'#fedf25',eyeColor:'#f7f7f7',mouthColor:'#1e6b7d',inkColor:'#ff7b33'};
export const INITIAL:Friend = {v:1,eyes:'3?8',ear:'classic',mouth:'smile-soft',palette:'melon',bodyColor:'#a8c886',eyeColor:'#fff9e8',mouthColor:'#335e5a',inkColor:'#b96b39'};
export function paletteFor(id:string){return PALETTES.find(p=>p.id===id) ?? PALETTES[0];}
export function isOriginal(f:Friend){return Object.keys(ORIGINAL).every(key=>f[key as keyof Friend]===ORIGINAL[key as keyof Friend]);}
export function sameFriend(a:Friend,b:Friend){return Object.keys(ORIGINAL).every(key=>a[key as keyof Friend]===b[key as keyof Friend]);}
export function normalizeEyes(text:string){return text.normalize('NFKC').replaceAll('−','-').replaceAll('⭐','★');}
export function validEyes(text:string){return Array.from(text).length===3 && Array.from(text).every(c=>GLYPHS.includes(c));}
export function randomInt(max:number):number{
 if(!Number.isInteger(max)||max<1||max>0x100000000)throw new Error('抽選の範囲が正しくありません。');
 const data=new Uint32Array(1),limit=Math.floor(0x100000000/max)*max;
 do{globalThis.crypto.getRandomValues(data);}while(data[0]>=limit);
 return data[0]%max;
}
type Rng=(max:number)=>number;
const pick=<T>(a:readonly T[],rng:Rng):T=>a[rng(a.length)];
export function generateFriend(current:Friend,locks:Locks,rng:Rng=randomInt):{friend:Friend;encounter:boolean}{
 if(LOCK_KEYS.every(k=>locks[k]))return {friend:current,encounter:false};
 if(LOCK_KEYS.every(k=>!locks[k]) && rng(4096)===0)return {friend:{...ORIGINAL},encounter:true};
 const keepPalette=locks.palette||locks.bodyColor||locks.eyeColor||locks.mouthColor;
 const p=keepPalette?paletteFor(current.palette):pick(PALETTES,rng);
 const pool=Array.from('0123456789'+GLYPHS);
 const f:Friend={v:1,palette:p.id,eyes:locks.eyes?current.eyes:Array.from({length:3},()=>pick(pool,rng)).join(''),ear:locks.ear?current.ear:pick(EARS,rng),mouth:locks.mouth?current.mouth:pick(MOUTHS,rng),bodyColor:locks.bodyColor?current.bodyColor:pick(p.body,rng),eyeColor:locks.eyeColor?current.eyeColor:pick(p.eye,rng),mouthColor:locks.mouthColor?current.mouthColor:pick(p.mouth,rng),inkColor:p.ink};
 // The original has its own draw; normal combinations cannot add to its odds.
 if(isOriginal(f)){
  if(!locks.eyes)f.eyes='525';
  else if(!locks.ear)f.ear='bear';
  else if(!locks.mouth)f.mouth='smile-soft';
  else if(!locks.bodyColor)f.bodyColor=p.body[1];
  else if(!locks.eyeColor)f.eyeColor=p.eye[1];
  else if(!locks.mouthColor)f.mouthColor=p.mouth[1];
  else return {friend:current,encounter:false};
 }
 return {friend:f,encounter:false};
}
export function changePalette(current:Friend,id:string):Friend{
 const p=PALETTES.find(p=>p.id===id);if(!p)throw new Error('このパレットは見つかりませんでした。');
 return {...current,palette:id,bodyColor:p.body[0],eyeColor:p.eye[0],mouthColor:p.mouth[0],inkColor:p.ink};
}
export function validateFriend(value:unknown):Friend{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('お友達のコードを確認してね。');
 const f=value as Record<string,unknown>;
 if(f.v!==1)throw new Error('このバージョンのコードはまだ読み込めません。');
 const keys=Object.keys(ORIGINAL);
 if(Object.keys(f).some(k=>!keys.includes(k))||keys.some(k=>!(k in f)))throw new Error('コードの項目が足りないか、形式が違うようです。');
 if(typeof f.eyes!=='string'||!validEyes(f.eyes)||![...EARS,...LEGACY_EARS].includes(f.ear as Ear)||![...MOUTHS,...LEGACY_MOUTHS].includes(f.mouth as Mouth))throw new Error('目やかたちの値が正しくありません。');
 const p=PALETTES.find(p=>p.id===f.palette);
 if(!p||!(p.body as readonly unknown[]).includes(f.bodyColor)||!(p.eye as readonly unknown[]).includes(f.eyeColor)||!(p.mouth as readonly unknown[]).includes(f.mouthColor)||p.ink!==f.inkColor)throw new Error('パレットの色が正しくありません。');
 return Object.fromEntries(keys.map(k=>[k,f[k]])) as Friend;
}
// Explicit values and a version retain a character even when random weights change.
export function exportCode(friend:Friend){return '524F1:'+JSON.stringify(validateFriend(friend));}
export function importCode(code:string):Friend{
 if(code.length>4096)throw new Error('コードが長すぎます。コピーした内容を確認してね。');
 const text=code.trim();if(!text.startsWith('524F1:'))throw new Error('「524F1:」から始まるコードを貼り付けてね。');
 let parsed:unknown;try{parsed=JSON.parse(text.slice(6));}catch{throw new Error('コードが途中で切れているようです。もう一度コピーしてね。');}
 return validateFriend(parsed);
}
export type MakerState={friend:Friend;previous:Friend|null};
export function makerReducer(state:MakerState,action:{type:'apply';friend:Friend}|{type:'undo'}):MakerState{
 if(action.type==='undo')return state.previous?{friend:state.previous,previous:null}:state;
 const friend=validateFriend(action.friend);
 return sameFriend(state.friend,friend)?state:{friend,previous:state.friend};
}
