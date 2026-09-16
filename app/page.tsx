'use client';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Shuffle, Undo2, Download, LockKeyhole, LockKeyholeOpen, Copy, Code2, ChevronDown, ArrowUpRight, Sparkles, Check, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { INITIAL, EMPTY_LOCKS, LOCK_KEYS, PALETTES, EARS, MOUTHS, EAR_LABELS, MOUTH_LABELS, paletteFor, generateFriend, exportCode, importCode, isOriginal, isCurrentEar, isCurrentMouth, sameFriend, changePalette, normalizeEyes, validEyes, makerReducer } from '@/lib/friends';
import type { Friend, LockKey, Locks } from '@/lib/friends';
import { loadFriendRenderer } from '@/lib/render-friend';
import type { FriendRenderer } from '@/lib/render-friend';
import { version as appVersion } from '@/package.json';
import { createFriendPng, canShareImage, sharePreparedImage, canCopyImage, copyPreparedImage } from '@/lib/share-image';
import type { PreparedImage } from '@/lib/share-image';

type Tool = {name:string;title:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean;untrustedContentHint:boolean};execute:(input:unknown)=>unknown};
type ModelContext = {registerTool:(tool:Tool,options?:{signal?:AbortSignal})=>void|Promise<void>};
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}

export default function Home(){
 const [state,dispatch]=useReducer(makerReducer,{friend:INITIAL,previous:null});
 const friend=state.friend;
 const [locks,setLocks]=useState<Locks>({...EMPTY_LOCKS});
 const [renderer,setRenderer]=useState<FriendRenderer|null>(null);
 const [assetError,setAssetError]=useState('');
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const [eyeDraft,setEyeDraft]=useState(friend.eyes);
 const [eyeError,setEyeError]=useState('');
 const [restoreDraft,setRestoreDraft]=useState('');
 const [restoreError,setRestoreError]=useState('');
 const [transparent,setTransparent]=useState(false);
 const [saving,setSaving]=useState(false);
 const [imageShareAvailable,setImageShareAvailable]=useState<boolean|null>(null);
 const [imageCopyAvailable,setImageCopyAvailable]=useState(false);
 const [preparedImage,setPreparedImage]=useState<PreparedImage|null>(null);
 const [sharing,setSharing]=useState(false);
 const [copyingImage,setCopyingImage]=useState(false);
 const sharingRef=useRef(false);
 const [encounter,setEncounter]=useState(false);
 const [motionKey,setMotionKey]=useState(0);
 const canvasRef=useRef<HTMLCanvasElement>(null);
 const exportRef=useRef<HTMLTextAreaElement>(null);
 const stateRef=useRef(state);stateRef.current=state;
 const locksRef=useRef(locks);locksRef.current=locks;
 const actionRef=useRef<{generate:()=>Friend;restore:(code:string)=>Friend;undo:()=>Friend}|null>(null);
 const palette=paletteFor(friend.palette);
 const original=isOriginal(friend);
 const colorLocked=locks.bodyColor||locks.eyeColor||locks.mouthColor;
 const allLocked=LOCK_KEYS.every(k=>locks[k]);
 const background=transparent?null:original?'#39bad7':palette.background;
 const currentCode=exportCode(friend);
 const shareText=original?'524本人があそびにきた！ #524のお友達メーカー':`524のお友達ができた！ 目のなかは「${friend.eyes}」 #524のお友達メーカー`;
 const imageKey=JSON.stringify([currentCode,background]);
 const imageReady=preparedImage?.key===imageKey;

 useEffect(()=>{let live=true;loadFriendRenderer().then(value=>{if(live)setRenderer(value);}).catch(e=>{if(live)setAssetError(e.message);});return()=>{live=false;};},[]);
 useEffect(()=>{
  if(!renderer||!canvasRef.current)return;
  try{renderer.render(canvasRef.current,friend,background);setAssetError('');}
  catch(e){setAssetError(e instanceof Error?e.message:'画像を描けませんでした。');}
 },[renderer,friend,background,motionKey]);
 useEffect(()=>{setEyeDraft(friend.eyes);setEyeError('');},[friend.eyes]);
 useEffect(()=>{
  const copyingSupported=canCopyImage(navigator.clipboard,typeof ClipboardItem==='undefined'?undefined:ClipboardItem);
  setImageCopyAvailable(copyingSupported);
  const sharingSupported=typeof navigator.share==='function'&&typeof navigator.canShare==='function';
  if(!sharingSupported)setImageShareAvailable(false);
  if(!copyingSupported&&!sharingSupported)return;
  if(!renderer)return;
  let active=true;
  const timer=setTimeout(()=>{
   createFriendPng(renderer,friend,background).then(file=>{
    if(!active)return;
    const supported=canShareImage(navigator,file);
    setImageShareAvailable(supported);
    setPreparedImage({key:imageKey,file,text:shareText});
   }).catch(()=>{if(active){setImageShareAvailable(false);setPreparedImage(null);}});
  },120);
  return()=>{active=false;clearTimeout(timer);};
 },[renderer,friend,background,imageKey,shareText]);

 const apply=useCallback((next:Friend,options:{allowOriginal?:boolean;encounter?:boolean}={})=>{
  if(isOriginal(next)&&!options.allowOriginal&&!sameFriend(next,stateRef.current.friend))throw new Error('524本人には、固定なしの「お友達をつくる」から出会えるよ。');
  dispatch({type:'apply',friend:next});setEyeDraft(next.eyes);setEyeError('');setEncounter(Boolean(options.encounter));setError('');setMessage('');setMotionKey(key=>key+1);
 },[]);
 const generate=useCallback(()=>{
  const result=generateFriend(stateRef.current.friend,locksRef.current);
  apply(result.friend,{allowOriginal:true,encounter:result.encounter});
  if(sameFriend(result.friend,stateRef.current.friend)&&!result.encounter)setMessage('同じ組み合わせになったよ。もう一度つくってみよう。');
  return result.friend;
 },[apply]);
 const restore=useCallback((code:string)=>{
  const next=importCode(code);
  apply(next,{allowOriginal:true});setLocks({...EMPTY_LOCKS});setRestoreError('');setMessage('おかえり！ コードからこの子を呼び出しました。');
  return next;
 },[apply]);
 const undo=useCallback(()=>{
  const next=stateRef.current.previous??stateRef.current.friend;
  dispatch({type:'undo'});setEyeDraft(next.eyes);setEyeError('');setEncounter(false);setError('');setMessage('ひとつ前の子に戻りました。');setMotionKey(key=>key+1);return next;
 },[]);
 actionRef.current={generate,restore,undo};

 useEffect(()=>{
  const ctx=(document as Document&{modelContext?:ModelContext}).modelContext;
  if(!ctx?.registerTool)return;
  const life=new AbortController();
  const emptyInput=(input:unknown)=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('空のオブジェクトを渡してください。');};
  const tools:Tool[]=[
   {name:'read_friend',title:'お友達の設定を読む',description:'現在の見た目、固定状態、復元コードを返します。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){emptyInput(input);return {friend:stateRef.current.friend,locks:locksRef.current,code:exportCode(stateRef.current.friend)};}},
   {name:'generate_friend',title:'お友達をつくる',description:'画面と同じ固定設定を守って、新しいお友達を生成します。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){emptyInput(input);let next:Friend=stateRef.current.friend;flushSync(()=>{next=actionRef.current!.generate();});return {friend:next,code:exportCode(next)};}},
   {name:'restore_friend',title:'コードからお友達を呼び出す',description:'検証したコードから見た目を復元し、固定を解除します。再抽選しません。',inputSchema:{type:'object',properties:{code:{type:'string',maxLength:4096}},required:['code'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==1||typeof (input as {code?:unknown}).code!=='string')throw new Error('code文字列を渡してください。');const code=(input as {code:string}).code;importCode(code);let next:Friend=stateRef.current.friend;flushSync(()=>{next=actionRef.current!.restore(code);});return {friend:next};}},
  ];
  for(const tool of tools)try{void Promise.resolve(ctx.registerTool(tool,{signal:life.signal})).catch(()=>{});}catch{/* Optional browser capability. */}
  return()=>life.abort();
 },[]);

 function tryApply(next:Friend){try{apply(next);}catch(e){setError(e instanceof Error?e.message:'変更できませんでした。');}}
 function toggleLock(key:LockKey,checked:boolean){setLocks(old=>({...old,[key]:checked}));setMessage('');}
 function commitEyes(){const text=normalizeEyes(eyeDraft);if(!validEyes(text)){setEyeError('数字か記号を、ちょうど3文字入れてね。');return;}setEyeError('');tryApply({...friend,eyes:text});}
 function selectPalette(id:string){if(colorLocked||locks.palette)return;tryApply(changePalette(friend,id));}
 async function saveImage(){
  if(!renderer||saving)return;
  setSaving(true);setError('');
  const snapshot=friend;
  try{const file=await createFriendPng(renderer,snapshot,background);download(file,file.name);setMessage('画像を書き出しました。Xに投稿するときは、この画像を添付してね。');}catch(e){setError(e instanceof Error?e.message:'画像を保存できませんでした。');}finally{setSaving(false);}
 }
 async function shareImage(){
  if(sharingRef.current||!imageReady||!renderer||assetError)return;
  sharingRef.current=true;setSharing(true);setError('');setMessage('');
  try{
   const result=await sharePreparedImage(navigator,preparedImage,imageKey);
   if(result==='shared')setMessage('共有先へ画像を渡しました。投稿画面で画像と文章を確認してね。');
   else if(result==='unsupported'){setImageShareAvailable(false);setMessage('この環境では画像を直接共有できません。「画像を保存」から保存して、Xで添付してね。');}
  }catch{setError('画像を共有できませんでした。「画像を保存」から保存して、Xで添付してね。');}
  finally{sharingRef.current=false;setSharing(false);}
 }
 async function copyImage(){
  if(sharingRef.current||!imageReady||!renderer||assetError)return;
  sharingRef.current=true;setCopyingImage(true);setError('');setMessage('');
  try{
   const result=await copyPreparedImage(navigator.clipboard,typeof ClipboardItem==='undefined'?undefined:ClipboardItem,preparedImage,imageKey);
   if(result==='copied')setMessage('画像を1枚コピーしました。「Xにポスト」を開いて、そのまま貼り付けてね。');
   else if(result==='unsupported')setError('この環境では画像をコピーできません。「画像を保存」から保存して、Xで添付してね。');
  }catch{setError('画像をコピーできませんでした。「画像を保存」から保存して、Xで添付してね。');}
  finally{sharingRef.current=false;setCopyingImage(false);}
 }
 async function copyCode(){
  try{await navigator.clipboard.writeText(currentCode);setMessage('この子のコードをコピーしました。');}
  catch{exportRef.current?.focus();exportRef.current?.select();setMessage('コードを選択しました。コピーして、メモに残してね。');}
 }
 function saveCode(){download(new Blob([currentCode+'\n'],{type:'text/plain;charset=utf-8'}),'524-friend-code.txt');setMessage('復元コードを書き出しました。');}
 function lockControl(field:LockKey,label:string){
  return <label className={`lock-control ${locks[field]?'is-locked':''}`}><Checkbox checked={locks[field]} onCheckedChange={checked=>toggleLock(field,checked)} aria-label={`${label}を固定`}/>{locks[field]?<LockKeyhole size={13}/>:<LockKeyholeOpen size={13}/>}<span>固定</span></label>;
 }
 function colorRow(field:'bodyColor'|'eyeColor'|'mouthColor',label:string,colors:readonly string[]){
  return <div className="color-row"><span className="color-label">{label}</span><RadioGroup className="color-options" value={friend[field]} onValueChange={value=>tryApply({...friend,[field]:String(value)})} disabled={locks[field]} aria-label={label}>{colors.map((color,i)=><label className="color-choice" key={color} data-selected={friend[field]===color} title={`${label} ${i+1}`}><RadioGroupItem value={color} aria-label={`${label} ${i+1}`} className="choice-radio"/><span className="color-dot" style={{background:color}}>{friend[field]===color&&<Check size={13} style={{color:field==='mouthColor'?'white':'#27333e'}}/>}</span></label>)}</RadioGroup>{lockControl(field,label)}</div>;
 }

 return <main className="maker-shell">
  <header className="masthead"><a className="wordmark" href="/" aria-label="524のお友達メーカー"><img className="brand-mark" src="/assets/524-logo-v1.png" alt="" width={200} height={132}/><span className="wordmark-title"><span>お友達</span><span>メーカー</span></span></a></header>
  <div className="workspace">
   <section className="play-column" aria-label="お友達をつくる">
    <div className="portrait-card">
    <div className={`stage ${transparent?'checker':''}`} style={background?{background}:undefined}>
     <canvas key={motionKey} ref={canvasRef} width={1024} height={1024} className={`friend-canvas ${motionKey?'arriving':''}`} role="img" aria-label={`ひとみが${friend.eyes}、みみのかたちが${EAR_LABELS[friend.ear]}、くちのかたちが${MOUTH_LABELS[friend.mouth]}のお友達`}/>
     {!renderer&&!assetError&&<p className="asset-state">お友達をよんでいます…</p>}
     {assetError&&<p className="asset-state error" role="alert">{assetError}</p>}
     {encounter&&<div className="rare-notice" role="status"><Sparkles size={18}/>524があそびにきた！</div>}
    </div>
    <div className="generate-row"><Button className="make-button" disabled={!renderer||!!assetError||allLocked} onClick={generate}><Shuffle/>お友達をつくる</Button><Button className="undo-button" variant="outline" disabled={!state.previous} onClick={undo} aria-label="ひとつ前に戻す" title="ひとつ前に戻す"><Undo2/></Button></div>
    <p className="generation-hint">{allLocked?'全部固定中。どこかの固定をはずすと、またつくれるよ。':'気に入ったところを固定して、もうひとり。'}</p>
    </div>
    <div className="take-home">
     {(imageShareAvailable||imageCopyAvailable)&&<DropdownMenu>
      <DropdownMenuTrigger data-slot="button" render={<Button className="wide-button image-share-button" variant="outline"/>} disabled={!imageReady||sharing||copyingImage||!renderer||!!assetError}><Share2/>{copyingImage?'画像をコピーしています…':sharing?'共有画面を開いています…':!imageReady?'画像を準備しています…':'画像つきで共有'}<ChevronDown size={16}/></DropdownMenuTrigger>
      <DropdownMenuContent className="image-share-menu" align="start" sideOffset={8}>
       {imageCopyAvailable&&<DropdownMenuItem onClick={copyImage} disabled={!imageReady||sharing||copyingImage||!!assetError}><Copy/>画像をコピー</DropdownMenuItem>}
       {imageShareAvailable&&<DropdownMenuItem onClick={shareImage} disabled={!imageReady||sharing||copyingImage||!!assetError}><Share2/>ほかのアプリに共有</DropdownMenuItem>}
      </DropdownMenuContent>
     </DropdownMenu>}
     <div className="save-row"><Button className="save-image" variant="outline" onClick={saveImage} disabled={!renderer||!!assetError||saving}><Download/>{saving?'書き出し中…':'画像を保存'}</Button><a className="share-link" href={`https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">Xにポスト<ArrowUpRight size={16}/></a></div>
     <div className="export-options"><label className="background-option"><Checkbox checked={transparent} onCheckedChange={setTransparent}/>背景を透明にする</label><span>PNG · 2048 × 2048</span></div>
     <p className="small-note share-note">{imageCopyAvailable?'Xに貼り付けるときは「画像つきで共有」→「画像をコピー」を選んでね。投稿文は「Xにポスト」から入ります。':imageShareAvailable?'共有先にXがあれば選んでね。コピーして貼り付ける代わりに、画像を保存してXで添付できます。':'画像を保存して、Xの投稿画面で添付してね。対応している端末では「画像つきで共有」も使えます。'}</p>
    </div>
    <div className="feedback" aria-live="polite" aria-atomic="true">{message&&<p className="status-message">{message}</p>}{error&&<p className="error" role="alert">{error}</p>}</div>
   </section>
   <aside className="control-panel" aria-label="お友達の設定">
    <div className="panel-top"><h1>かたち</h1><Button variant="ghost" className="unlock-all" onClick={()=>{setLocks({...EMPTY_LOCKS});setMessage('固定をすべて解除しました。');}} disabled={!LOCK_KEYS.some(k=>locks[k])}>固定をはずす</Button></div>
    <p className="panel-intro">気になるところだけ、選んでもOK。</p>
    <div className="control-section eye-section">
     <div className="section-heading"><h2><span className="step-dot">01</span>ひとみ</h2>{lockControl("eyes","ひとみ")}</div>
     <form className="eye-form" onSubmit={event=>{event.preventDefault();commitEyes();}}><Input className="eye-input" value={eyeDraft} maxLength={3} onChange={e=>{setEyeDraft(normalizeEyes(e.target.value));setEyeError('');}} disabled={locks.eyes} aria-label="ひとみの3文字" aria-describedby="eye-help" aria-invalid={!!eyeError} autoComplete="off" spellCheck={false}/><Button type="submit" className="eye-apply" variant="outline" disabled={locks.eyes||eyeDraft===friend.eyes}>決定</Button></form>
     <p id="eye-help" className="small-note">3文字固定 · 0–9 / + − × ÷ ＊ ★ ? ! =</p>{eyeError&&<p className="error" role="alert">{eyeError}</p>}
    </div>
    <div className="control-section shape-section">
     <div className="section-heading"><h2><span className="step-dot">02</span>みみのかたち</h2>{lockControl("ear","みみのかたち")}</div>
     <RadioGroup value={friend.ear} onValueChange={value=>tryApply({...friend,ear:value as Friend['ear']})} disabled={locks.ear} className="shape-options ear-options" aria-label="みみのかたち">
      {EARS.map(ear=><label key={ear} className="shape-choice" data-selected={friend.ear===ear}><RadioGroupItem className="choice-radio" value={ear}/><span>{EAR_LABELS[ear]}</span></label>)}
     </RadioGroup>
     {!isCurrentEar(friend.ear)&&<p className="small-note" style={{marginTop:9}}>復元した子の耳：{EAR_LABELS[friend.ear]}（以前のかたち）</p>}
    </div>
    <div className="control-section shape-section">
     <div className="section-heading"><h2><span className="step-dot">03</span>くちのかたち</h2>{lockControl("mouth","くちのかたち")}</div>
     <RadioGroup value={friend.mouth} onValueChange={value=>tryApply({...friend,mouth:value as Friend['mouth']})} disabled={locks.mouth} className="shape-options mouth-options" aria-label="くちのかたち">
      {MOUTHS.map(mouth=><label key={mouth} className="shape-choice mouth-choice" data-selected={friend.mouth===mouth}><RadioGroupItem className="choice-radio" value={mouth}/><span>{MOUTH_LABELS[mouth]}</span></label>)}
     </RadioGroup>
     {!isCurrentMouth(friend.mouth)&&<p className="small-note" style={{marginTop:9}}>復元した子の口：{MOUTH_LABELS[friend.mouth]}（以前のかたち）</p>}
    </div>
    <div className="control-section palette-section">
     <div className="section-heading"><h2><span className="step-dot">04</span>カラーパレット</h2>{lockControl("palette","パレット")}</div>
     <RadioGroup className="palette-options" value={friend.palette} onValueChange={value=>selectPalette(String(value))} disabled={locks.palette||colorLocked} aria-label="カラーパレット">
      {PALETTES.map(p=><label className="palette-choice" key={p.id} data-selected={friend.palette===p.id} title={p.name}><RadioGroupItem value={p.id} className="choice-radio" aria-label={p.name}/><span className="palette-disc" style={{background:p.background}}><span style={{background:p.body[0]}}/><i style={{background:p.mouth[0]}}/></span></label>)}
     </RadioGroup>
     <p className="palette-name">{palette.name}</p>
     {colorRow("bodyColor","からだのいろ",palette.body)}{colorRow("eyeColor","めのいろ",palette.eye)}{colorRow("mouthColor","くちのいろ",palette.mouth)}
     {colorLocked&&<p className="small-note color-lock-hint">色を固定している間は、このパレットで遊べます。</p>}
    </div>
    <details className="code-box">
     <summary><Code2 size={18}/><span>遺伝じょうほうをきろくする・ふくげんする</span><ChevronDown className="details-chevron" size={16}/></summary>
     <div className="code-content"><p className="small-note">メモに残すと、あとで同じ子に会えるよ。</p><label className="field-label" htmlFor="current-code">この子のコード</label><Textarea ref={exportRef} id="current-code" className="code-text" readOnly value={currentCode} rows={4}/><div className="code-actions"><Button variant="outline" onClick={copyCode}><Copy/>コピー</Button><Button variant="outline" onClick={saveCode}><Download/>テキスト保存</Button></div><label className="field-label" htmlFor="restore-code">保存したコードから呼び出す</label><Textarea id="restore-code" className="code-text" value={restoreDraft} onChange={e=>{setRestoreDraft(e.target.value);setRestoreError('');}} maxLength={4096} placeholder="524F1: から始まるコードを貼り付け" rows={3} aria-invalid={!!restoreError}/><Button className="restore-button" disabled={!restoreDraft.trim()} onClick={()=>{try{restore(restoreDraft);}catch(e){setRestoreError(e instanceof Error?e.message:'コードを読み込めませんでした。');}}}>この子を呼び出す</Button><p className="small-note">呼び出すと、いまの固定は解除されます。</p>{restoreError&&<p role="alert" className="error">{restoreError}</p>}</div>
    </details>
    <p className="rare-hint"><Sparkles size={15}/><span>ランダムでホンモノの524が登場します（ 1 / 4096 の確率 ）</span></p>
   </aside>
  </div>
  <footer className="page-footer">
   <div className="footer-copy"><p className="footer-rights"><span className="copyright-line">© 2026 5Ni4 / 524</span>524および本サイトのコンテンツの著作権は作者に帰属します。</p></div>
   <div className="footer-links"><a className="author-link" href="https://x.com/R5ni4" target="_blank" rel="noopener noreferrer" aria-label="作者について（Xで開く）">作者について<ArrowUpRight size={14}/></a><span className="footer-version">ver{appVersion.replace(/\.0$/, '')}</span></div>
  </footer>
 </main>;
}
