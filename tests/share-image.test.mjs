import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL, exportCode } from '../lib/friends.ts';
import { createFriendPng, canShareImage, sharePreparedImage, canCopyImage, copyPreparedImage } from '../lib/share-image.ts';

const keyFor=(friend,background)=>JSON.stringify([exportCode(friend),background]);
const file=new File(['image bytes'],'524-friend-3x8.png',{type:'image/png'});
const prepared={key:keyFor(INITIAL,null),file,text:'目のなかは「3?8」'};
class TestClipboardItem {
 constructor(data){this.data=data;this.types=Object.keys(data);}
}

test('copy writes one PNG-only item once, without file URL, HTML or post text',async()=>{
 const writes=[];
 const clipboard={write(items){writes.push(items);return Promise.resolve();}};
 const pending=copyPreparedImage(clipboard,TestClipboardItem,prepared,prepared.key);
 assert.equal(writes.length,1,'write must run synchronously in the click');
 assert.equal(writes[0].length,1,'only one clipboard item');
 assert.deepEqual(writes[0][0].types,['image/png'],'no duplicate image representations or text');
 const image=writes[0][0].data['image/png'];
 assert.equal(image instanceof File,false,'write pixels as a Blob, not a file attachment');
 assert.equal(image.type,'image/png');assert.equal(image.size,file.size);
 assert.deepEqual(await image.arrayBuffer(),await file.arrayBuffer());
 assert.equal(await pending,'copied');assert.equal(writes.length,1);
});

test('copy works independently when native sharing is unavailable',async()=>{
 let calls=0;
 const clipboard={write:async()=>{calls++;}};
 assert.equal(canShareImage({},file),false);
 assert.equal(canCopyImage(clipboard,TestClipboardItem),true);
 assert.equal(await copyPreparedImage(clipboard,TestClipboardItem,prepared,prepared.key),'copied');
 assert.equal(calls,1);
});

test('copy rejects stale characters and background settings before writing',async()=>{
 let calls=0;
 const clipboard={write:async()=>{calls++;}};
 for(const key of [keyFor(INITIAL,'#39bad7'),keyFor({...INITIAL,eyes:'×÷*'},null)]){
  assert.equal(await copyPreparedImage(clipboard,TestClipboardItem,prepared,key),'not-ready');
 }
 assert.equal(await copyPreparedImage(clipboard,TestClipboardItem,null,prepared.key),'not-ready');
 assert.equal(calls,0);
});

test('copy feature detection handles missing APIs and unsupported PNG',async()=>{
 const clipboard={write:async()=>{throw new Error('must not write');}};
 class NoPng extends TestClipboardItem { static supports(){return false;} }
 class Blocked extends TestClipboardItem { static supports(){throw new Error('blocked');} }
 for(const [api,Item] of [[undefined,TestClipboardItem],[{},TestClipboardItem],[clipboard,undefined],[clipboard,NoPng],[clipboard,Blocked]]){
  assert.equal(canCopyImage(api,Item),false);
  assert.equal(await copyPreparedImage(api,Item,prepared,prepared.key),'unsupported');
 }
 assert.equal(await copyPreparedImage(clipboard,TestClipboardItem,{...prepared,file:new File(['x'],'x.jpg',{type:'image/jpeg'})},prepared.key),'unsupported');
});

test('clipboard denial remains a failure without retries or fallback clipboard data',async()=>{
 let calls=0;
 const rejection=new DOMException('Not allowed','NotAllowedError');
 const clipboard={write:()=>{calls++;return Promise.reject(rejection);}};
 await assert.rejects(copyPreparedImage(clipboard,TestClipboardItem,prepared,prepared.key),rejection);
 assert.equal(calls,1);
});

test('PNG export retains renderer bytes, 2048 size, snapshot and transparency',async()=>{
 const bytes=new Blob(['exact rendered PNG bytes'],{type:'image/png'});
 for(const background of [null,'#39bad7']){
  let renderCall;
  const canvas={width:0,height:0,toBlob(callback,type){assert.equal(type,'image/png');callback(bytes);}};
  const renderer={render(...args){renderCall=args;}};
  const output=await createFriendPng(renderer,INITIAL,background,()=>canvas);
  assert.deepEqual(renderCall,[canvas,INITIAL,background]);
  assert.equal(canvas.width,2048);assert.equal(canvas.height,2048);
  assert.equal(output.name,'524-friend-3x8.png');assert.equal(output.type,'image/png');
  assert.deepEqual(await output.arrayBuffer(),await bytes.arrayBuffer());
 }
});

test('PNG failure rejects instead of sharing an empty image',async()=>{
 const canvas={toBlob(callback){callback(null);}};
 await assert.rejects(createFriendPng({render(){}},INITIAL,null,()=>canvas),/画像を書き出せませんでした/);
 await assert.rejects(createFriendPng({render(){throw new Error('render failed');}},INITIAL,null,()=>canvas),/render failed/);
});

test('share receives exact PNG and text synchronously during the click',async()=>{
 let received;
 const api={canShare(data){assert.deepEqual(data,{files:[file]});return true;},share(data){received=data;return Promise.resolve();}};
 const pending=sharePreparedImage(api,prepared,prepared.key);
 assert.deepEqual(received,{files:[file],text:prepared.text});
 assert.equal(await pending,'shared');
});

test('previous image is rejected after character or transparency changes',async()=>{
 const api={canShare(){throw new Error('must not check stale file');},share(){throw new Error('must not share stale file');}};
 const keys=[keyFor(INITIAL,'#39bad7'),keyFor({...INITIAL,eyes:'×÷*'},null),keyFor({...INITIAL,ear:'bear'},null)];
 for(const key of keys)assert.equal(await sharePreparedImage(api,prepared,key),'not-ready');
 assert.equal(await sharePreparedImage(api,null,prepared.key),'not-ready');
});

test('absent, false or throwing file support leaves native share unused',async()=>{
 let calls=0;
 for(const api of [{},{canShare:()=>true},{share:async()=>{calls++;}},{share:async()=>{calls++;},canShare:()=>false},{share:async()=>{calls++;},canShare:()=>{throw new Error('blocked');}}]){
  assert.equal(canShareImage(api,file),false);
  assert.equal(await sharePreparedImage(api,prepared,prepared.key),'unsupported');
 }
 assert.equal(calls,0);
});

test('cancelled share is quiet and a later explicit attempt may proceed',async()=>{
 let attempts=0;
 const api={canShare:()=>true,share(){attempts++;return attempts===1?Promise.reject(new DOMException('Cancelled','AbortError')):Promise.resolve();}};
 assert.equal(await sharePreparedImage(api,prepared,prepared.key),'cancelled');
 assert.equal(attempts,1);
 assert.equal(await sharePreparedImage(api,prepared,prepared.key),'shared');
 assert.equal(attempts,2);
});

test('delivery and permission errors remain errors and are not success',async()=>{
 for(const name of ['DataError','NotAllowedError']){
  const error=new DOMException('No delivery',name);
  await assert.rejects(sharePreparedImage({canShare:()=>true,share:()=>Promise.reject(error)},prepared,prepared.key),error);
 }
});
