import type { Friend, Ear } from './friends';

type MakeCanvas=(width:number,height:number)=>HTMLCanvasElement;
const SIZE=1024;
const SOURCE_COLORS=[[57,186,215],[254,223,37],[247,247,247],[255,123,51],[30,107,125],[68,164,188]];
const GLYPH_ORDER=Array.from('0123456789+-★?!=');
const browserCanvas:MakeCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
function context(canvas:HTMLCanvasElement){const c=canvas.getContext('2d',{willReadFrequently:true});if(!c)throw new Error('この端末で画像を描けませんでした。');return c;}
function bounds(canvas:HTMLCanvasElement){
 const {width:w,height:h}=canvas,data=context(canvas).getImageData(0,0,w,h).data;
 let x0=w,y0=h,x1=-1,y1=-1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>240){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 if(x1<0)throw new Error('パーツの画像を読み取れませんでした。');
 x0=Math.max(0,x0-1);y0=Math.max(0,y0-1);x1=Math.min(w-1,x1+1);y1=Math.min(h-1,y1+1);
 return {x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
}
function fillInterior(data:ImageData){
 const {width:w,height:h}=data,n=w*h,seen=new Uint8Array(n),queue=new Int32Array(n);let head=0,tail=0;
 const visit=(index:number)=>{if(!seen[index]&&data.data[index*4+3]<128){seen[index]=1;queue[tail++]=index;}};
 for(let x=0;x<w;x++){visit(x);visit((h-1)*w+x);}for(let y=0;y<h;y++){visit(y*w);visit(y*w+w-1);}
 while(head<tail){const i=queue[head++],x=i%w;if(x>0)visit(i-1);if(x<w-1)visit(i+1);if(i>=w)visit(i-w);if(i<n-w)visit(i+w);}
 for(let i=0;i<n;i++)if(!seen[i])data.data[i*4+3]=255;
}
export function createFriendRenderer(source:CanvasImageSource,atlas:CanvasImageSource,makeCanvas:MakeCanvas=browserCanvas,earAtlas?:CanvasImageSource,mouthAtlas?:CanvasImageSource){
 const base=makeCanvas(SIZE,SIZE),baseCtx=context(base);baseCtx.drawImage(source,0,0,SIZE,SIZE);
 const pixels=baseCtx.getImageData(0,0,SIZE,SIZE).data;
 const body=makeCanvas(SIZE,SIZE),eyes=makeCanvas(SIZE,SIZE),digits=makeCanvas(SIZE,SIZE),mouth=makeCanvas(SIZE,SIZE),shadow=makeCanvas(SIZE,SIZE);
 const layers=[body,eyes,digits,mouth,shadow],buffers=layers.map(c=>context(c).createImageData(SIZE,SIZE));
 // Separate the original paint colors, retaining mixed edge pixels as alpha.
 for(let i=0;i<pixels.length;i+=4){
  const rgb=[pixels[i],pixels[i+1],pixels[i+2]];
  let a=0,da=Infinity;
  for(let k=0;k<SOURCE_COLORS.length;k++){
   const color=SOURCE_COLORS[k],d=rgb.reduce((sum,v,j)=>sum+(v-color[j])**2,0);
   if(d<da){a=k;da=d;}
  }
  const weights=Array(6).fill(0);
  if(da<1)weights[a]=1;
  else {
   let best=Infinity,first=0,second=1,amount=0;
   for(let j=0;j<6;j++)for(let k=j+1;k<6;k++){
    const ca=SOURCE_COLORS[j],cb=SOURCE_COLORS[k],delta=cb.map((v,n)=>v-ca[n]);
    const t=Math.max(0,Math.min(1,rgb.reduce((sum,v,n)=>sum+(v-ca[n])*delta[n],0)/delta.reduce((sum,v)=>sum+v*v,0)));
    const error=rgb.reduce((sum,v,n)=>sum+(v-ca[n]-t*delta[n])**2,0);
    if(error<best){best=error;first=j;second=k;amount=t;}
   }
   weights[first]=1-amount;weights[second]=amount;
  }
  const y=Math.floor(i/4/SIZE);
  const amounts=y>810?[0,0,0,0,weights[5]]:[weights[1]+weights[2]+weights[3]+weights[4],weights[2]+weights[3],y>340&&y<530?weights[3]:0,y>530&&y<610?weights[4]:0,0];
  amounts.forEach((v,k)=>{const d=buffers[k].data;d[i]=255;d[i+1]=255;d[i+2]=255;d[i+3]=Math.round(v*255);});
 }
 // Old facial paint is an opaque part of the body/eye substrate, not a hole.
 fillInterior(buffers[0]);fillInterior(buffers[1]);
 layers.forEach((c,i)=>context(c).putImageData(buffers[i],0,0));
 const bodyVariants:Partial<Record<Ear,HTMLCanvasElement>>={classic:body,long:body,round:body,tilt:body};
 const bodyPixels=buffers[0].data;
 for(const kind of ['long','round','tilt'] as const){
  const c=makeCanvas(SIZE,SIZE),ctx=context(c),out=ctx.createImageData(SIZE,SIZE);
  // Resample only the original upper silhouette; the join and face stay intact.
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
   let sx=x,sy=y;
   if(y<310){
    const height=kind==='long'?1.6:kind==='round'?.57:(x<492?.6:1.35);
    sy=310-(310-y)/height;
    const blend=Math.max(0,Math.min(1,(300-sy)/65));
    const center=x<492?397:560;
    const width=kind==='round'?1+blend*.35:kind==='long'?1-blend*.14:1;
    sx=center+(x-center)/width;
   }
   const ix=Math.floor(sx),iy=Math.floor(sy),o=(y*SIZE+x)*4;
   if(ix<0||iy<0||ix>=SIZE-1||iy>=SIZE-1)continue;
   const fx=sx-ix,fy=sy-iy,at=(xx:number,yy:number)=>bodyPixels[(yy*SIZE+xx)*4+3];
   out.data[o]=255;out.data[o+1]=255;out.data[o+2]=255;
   out.data[o+3]=Math.round(at(ix,iy)*(1-fx)*(1-fy)+at(ix+1,iy)*fx*(1-fy)+at(ix,iy+1)*(1-fx)*fy+at(ix+1,iy+1)*fx*fy);
  }
  ctx.putImageData(out,0,0);bodyVariants[kind]=c;
 }
 if(earAtlas){
  const atlasCanvas=makeCanvas(1024,1024),atlasContext=context(atlasCanvas);atlasContext.drawImage(earAtlas,0,0,1024,1024);
  const bare=makeCanvas(SIZE,SIZE),bareContext=context(bare),barePixels=bareContext.createImageData(SIZE,SIZE);barePixels.data.set(bodyPixels);
  // Trim the old upper projections, preserving the original face and lower body.
  for(let y=0;y<360;y++)for(let x=0;x<SIZE;x++){
   const forehead=280+.0012*(x-510)**2;
   barePixels.data[(y*SIZE+x)*4+3]*=Math.max(0,Math.min(1,y+.5-forehead));
  }
  bareContext.putImageData(barePixels,0,0);
  const variants=['bear','rabbit','antenna','monkey'] as const;
  const placements:Record<typeof variants[number],Array<{cx:number;bottom:number;w:number;h:number}>>={
   bear:[{cx:386,bottom:342,w:112,h:112},{cx:567,bottom:333,w:117,h:117}],
   rabbit:[{cx:399,bottom:334,w:91,h:228},{cx:563,bottom:329,w:84,h:232}],
   antenna:[{cx:398,bottom:332,w:90,h:210},{cx:563,bottom:328,w:90,h:210}],
   monkey:[{cx:272,bottom:480,w:134,h:146},{cx:775,bottom:475,w:134,h:146}],
  };
  variants.forEach((kind,index)=>{
   const silhouette=makeCanvas(SIZE,SIZE),ctx=context(silhouette);
   for(let side=0;side<2;side++){
    const cell=makeCanvas(256,512),cellCtx=context(cell);
    cellCtx.drawImage(atlasCanvas,(index%2)*512+side*256,Math.floor(index/2)*512,256,512,0,0,256,512);
    const data=cellCtx.getImageData(0,0,256,512);
    for(let i=0;i<data.data.length;i+=4){const light=(data.data[i]+data.data[i+1]+data.data[i+2])/3,alpha=data.data[i+3];data.data[i]=255;data.data[i+1]=255;data.data[i+2]=255;data.data[i+3]=Math.round(Math.max(0,Math.min(1,(150-light)/120))*alpha);}
    cellCtx.putImageData(data,0,0);const box=bounds(cell),p=placements[kind][side],scale=Math.min(p.w/box.w,p.h/box.h),w=box.w*scale,h=box.h*scale;
    ctx.drawImage(cell,box.x,box.y,box.w,box.h,p.cx-w/2,p.bottom-h,w,h);
   }
   ctx.drawImage(bare,0,0);bodyVariants[kind]=silhouette;
  });
 }
 const atlasCanvas=makeCanvas(1120,1400),atlasCtx=context(atlasCanvas);atlasCtx.drawImage(atlas,0,0,1120,1400);
 const glyphs:Record<string,HTMLCanvasElement>={};
 const mouthParts:Record<string,HTMLCanvasElement>={};
 for(let cell=0;cell<20;cell++){
  const c=makeCanvas(280,280),ctx=context(c);ctx.drawImage(atlasCanvas,(cell%4)*280,Math.floor(cell/4)*280,280,280,0,0,280,280);
  const data=ctx.getImageData(0,0,280,280);
  // The atlas carries a pale checkerboard; only its dark brush marks are ink.
  for(let i=0;i<data.data.length;i+=4){const light=(data.data[i]+data.data[i+1]+data.data[i+2])/3;data.data[i]=255;data.data[i+1]=255;data.data[i+2]=255;data.data[i+3]=Math.round(Math.max(0,Math.min(1,(150-light)/120))*255);}
  ctx.putImageData(data,0,0);const box=bounds(c),trim=makeCanvas(box.w,box.h);context(trim).drawImage(c,box.x,box.y,box.w,box.h,0,0,box.w,box.h);
  if(cell<16)glyphs[GLYPH_ORDER[cell]]=trim;else mouthParts[['smile','oval','wave','beak'][cell-16]]=trim;
 }
 if(mouthAtlas){
  const sheet=makeCanvas(1024,1024);context(sheet).drawImage(mouthAtlas,0,0,1024,1024);
  // Keep the new painted edges and alpha; old codes still use the original atlas.
  ['smile-soft','oval-soft','wave-soft','beak-soft'].forEach((kind,index)=>{
   const cell=makeCanvas(512,512),ctx=context(cell);ctx.drawImage(sheet,(index%2)*512,Math.floor(index/2)*512,512,512,0,0,512,512);
   const data=ctx.getImageData(0,0,512,512);
   for(let i=0;i<data.data.length;i+=4){const light=(data.data[i]+data.data[i+1]+data.data[i+2])/3,alpha=data.data[i+3];data.data[i]=255;data.data[i+1]=255;data.data[i+2]=255;data.data[i+3]=Math.round(Math.max(0,Math.min(1,(150-light)/120))*alpha);}
   ctx.putImageData(data,0,0);const box=bounds(cell),trim=makeCanvas(box.w,box.h);context(trim).drawImage(cell,box.x,box.y,box.w,box.h,0,0,box.w,box.h);mouthParts[kind]=trim;
  });
 }
 const digitCenters:Array<{x:number;y:number}>=[];
 for(const [i,box] of [[0,{x:300,y:340,w:145,h:190}],[1,{x:445,y:340,w:130,h:190}],[2,{x:575,y:340,w:160,h:190}]] as const){
  const c=makeCanvas(box.w,box.h);context(c).drawImage(digits,box.x,box.y,box.w,box.h,0,0,box.w,box.h);
  const b=bounds(c),trim=makeCanvas(b.w,b.h);context(trim).drawImage(c,b.x,b.y,b.w,b.h,0,0,b.w,b.h);
  glyphs[['5','2','4'][i]]=trim;digitCenters[i]={x:box.x+b.x+b.w/2,y:box.y+b.y+b.h/2};
 }
 const tint=makeCanvas(SIZE,SIZE),tintCtx=context(tint),mouthBox=bounds(mouth);
 function paint(ctx:CanvasRenderingContext2D,mask:HTMLCanvasElement,color:string,x=0,y=0,w=mask.width,h=mask.height){
  tintCtx.clearRect(0,0,SIZE,SIZE);tintCtx.globalCompositeOperation='source-over';tintCtx.drawImage(mask,x,y,w,h);tintCtx.globalCompositeOperation='source-in';tintCtx.fillStyle=color;tintCtx.fillRect(0,0,SIZE,SIZE);tintCtx.globalCompositeOperation='source-over';ctx.drawImage(tint,0,0);
 }
 return {render(canvas:HTMLCanvasElement,friend:Friend,background:string|null){
  const ctx=context(canvas);ctx.save();ctx.setTransform(canvas.width/SIZE,0,0,canvas.height/SIZE,0,0);ctx.clearRect(0,0,SIZE,SIZE);
  if(background){ctx.fillStyle=background;ctx.fillRect(0,0,SIZE,SIZE);}
  ctx.translate(-128,-90);ctx.scale(1.25,1.25);
  if(background){ctx.save();ctx.globalAlpha=.1;paint(ctx,shadow,'#243449',0,-70);ctx.restore();}
  const bodyMask=bodyVariants[friend.ear];if(!bodyMask){ctx.restore();throw new Error('耳の絵を読み込めませんでした。ページをもう一度開いてね。');}
  paint(ctx,bodyMask,friend.bodyColor);
  paint(ctx,eyes,friend.eyeColor);
  if(friend.eyes==='524')paint(ctx,digits,friend.inkColor);
  else Array.from(friend.eyes).forEach((char,i)=>{
   const glyph=glyphs[char];if(!glyph)throw new Error('使えない文字が含まれています。');
   const scale=Math.min(86/glyph.width,103/glyph.height),w=glyph.width*scale,h=glyph.height*scale;
   paint(ctx,glyph,friend.inkColor,digitCenters[i].x-w/2,digitCenters[i].y-h/2,w,h);
  });
  if(friend.mouth==='flat')paint(ctx,mouth,friend.mouthColor);
  else {
   const part=mouthParts[friend.mouth];if(!part){ctx.restore();throw new Error('口の絵を読み込めませんでした。ページをもう一度開いてね。');}
   const targetWidth={smile:156,oval:92,wave:205,beak:80,'smile-soft':178,'oval-soft':105,'wave-soft':210,'beak-soft':88}[friend.mouth],scale=Math.min(targetWidth/part.width,76/part.height),w=part.width*scale,h=part.height*scale;
   paint(ctx,part,friend.mouthColor,mouthBox.x+mouthBox.w/2-w/2,mouthBox.y+mouthBox.h/2-h/2,w,h);
  }
  ctx.restore();
 }};
}
export async function loadFriendRenderer(){
 const load=(path:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('お友達の絵を読み込めませんでした。もう一度ページを開いてね。'));image.src=path;});
 const [source,atlas,ears,mouths]=await Promise.all([load('/assets/524-reference.png'),load('/assets/glyph-mouth-atlas.png'),load('/assets/ear-atlas-v2.png'),load('/assets/mouth-atlas-v2.png')]);
 return createFriendRenderer(source,atlas,browserCanvas,ears,mouths);
}
export type FriendRenderer=ReturnType<typeof createFriendRenderer>;
