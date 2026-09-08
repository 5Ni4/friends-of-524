import test from 'node:test';
import assert from 'node:assert/strict';
import {INITIAL,ORIGINAL,EMPTY_LOCKS,LOCK_KEYS,PALETTES,generateFriend,isOriginal,exportCode,importCode,makerReducer,normalizeEyes,validEyes,validateFriend} from '../lib/friends.ts';
test('eligible generation has exactly one 1/4096 original draw',()=>{
 let encounters=0;
 for(let roll=0;roll<4096;roll++){
  let rareCalls=0;
  const result=generateFriend(INITIAL,EMPTY_LOCKS,n=>{if(n===4096){rareCalls++;return roll;}return n-1;});
  assert.equal(rareCalls,1);assert.equal(isOriginal(result.friend),result.encounter);if(result.encounter)encounters++;
 }assert.equal(encounters,1);
});
test('127 nonempty lock combinations preserve values and skip rare draw',()=>{
 for(let bits=1;bits<128;bits++){
  const locks=Object.fromEntries(LOCK_KEYS.map((k,i)=>[k,Boolean(bits&(1<<i))]));let calls=0;
  const result=generateFriend(INITIAL,locks,n=>{assert.notEqual(n,4096);calls++;return n-1;});
  for(const key of LOCK_KEYS)if(locks[key])assert.equal(result.friend[key],INITIAL[key],key);
  assert.equal(result.encounter,false);validateFriend(result.friend);
  if(bits===127){assert.equal(calls,0);assert.deepEqual(result.friend,INITIAL);}
 }
});
test('normal draw cannot accidentally reconstruct the original',()=>{
 const values=[1,0,5,2,4,0,0,0,0,0];let at=0;
 const result=generateFriend(INITIAL,EMPTY_LOCKS,n=>{const v=values[at++];assert.ok(v<n);return v;});
 assert.equal(result.encounter,false);assert.equal(isOriginal(result.friend),false);assert.equal(result.friend.eyes,'525');
});
test('normal generation cannot finish original while other parts are locked',()=>{
 const locks={...EMPTY_LOCKS,eyes:true,ear:true,mouth:true,palette:true,bodyColor:true,eyeColor:true};
 const result=generateFriend({...ORIGINAL,mouthColor:'#365e59'},locks,()=>0);
 assert.equal(result.friend.mouthColor,'#365e59');assert.equal(result.encounter,false);
});
test('individual color locks retain harmonious palette',()=>{
 const result=generateFriend(INITIAL,{...EMPTY_LOCKS,eyeColor:true},n=>n-1);
 assert.equal(result.friend.palette,INITIAL.palette);assert.equal(result.friend.eyeColor,INITIAL.eyeColor);
 assert.ok(PALETTES.find(p=>p.id===INITIAL.palette).body.includes(result.friend.bodyColor));
});
test('codes round-trip every palette, symbols, and original',()=>{
 const samples=[INITIAL,ORIGINAL,...PALETTES.map(p=>({...INITIAL,eyes:'★!=',palette:p.id,bodyColor:p.body[2],eyeColor:p.eye[1],mouthColor:p.mouth[2],inkColor:p.ink}))];
 for(const f of samples)assert.deepEqual(importCode('  '+exportCode(f)+'\n'),f);
});
test('bad and future codes are rejected without changing state',()=>{
 for(const code of ['', 'other', '524F1:{', '524F1:'+JSON.stringify({...INITIAL,v:2}), '524F1:'+JSON.stringify({...INITIAL,eyes:'12'}), '524F1:'+JSON.stringify({...INITIAL,bodyColor:'javascript:alert(1)'}), '524F1:'+JSON.stringify({...INITIAL,surprise:1}), '524F1:'+JSON.stringify({...INITIAL,palette:'unknown'}), '524F1:'+JSON.stringify({...INITIAL,ear:'unknown'}), 'a'.repeat(4097)])assert.throws(()=>importCode(code));
 assert.equal(INITIAL.eyes,'3?8');
});
test('three-character rules normalize fullwidth numerals and symbols',()=>{
 assert.equal(normalizeEyes('５２４'),'524');assert.equal(normalizeEyes('−*＋'),'-★+');
 for(const eyes of ['000','524','★?!','+−='].map(normalizeEyes))assert.ok(validEyes(eyes));
 for(const eyes of ['','12','1234','abc','😀12'])assert.equal(validEyes(eyes),false);
});
test('undo restores the whole prior character once',()=>{
 const initial={friend:INITIAL,previous:null},changed=makerReducer(initial,{type:'apply',friend:ORIGINAL});
 assert.deepEqual(changed.previous,INITIAL);
 const undone=makerReducer(changed,{type:'undo'});assert.deepEqual(undone,{friend:INITIAL,previous:null});
 assert.equal(makerReducer(undone,{type:'undo'}),undone);
 assert.equal(makerReducer(initial,{type:'apply',friend:{...INITIAL}}),initial);
});
