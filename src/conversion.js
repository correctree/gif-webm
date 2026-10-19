export function scaleFilter(value){
 const n=Number(value);if(!Number.isFinite(n)||n<0||n>4096)throw new Error('最大解像度が不正です。');
 const even="scale=w='max(2,trunc(iw/2)*2)':h='max(2,trunc(ih/2)*2)'";
 return n?`scale=w='min(${n},iw)':h='min(${n},ih)':force_original_aspect_ratio=decrease:flags=lanczos,${even}`:even;
}
export function webmAttempts(codec='vp8',size=1024){
 if(!['vp8','vp9'].includes(codec))throw new Error('コーデックが不正です。');scaleFilter(size);
 const sizes=Number(size)===0?[0,512,256]:[Number(size),...([1024,512,256].filter(n=>n<Number(size)))];
 return [...(codec==='vp9'?[{codec:'vp9',size:Number(size)}]:[]),...sizes.slice(0,3).map(size=>({codec:'vp8',size}))];
}
export function webmArgs({codec,size},crf=28,fps=20){
 crf=Number(crf);fps=Number(fps);if(!Number.isFinite(crf)||crf<15||crf>45||![15,20,24,30].includes(fps))throw new Error('画質・フレーム数が不正です。');
 return ['-y','-threads','1','-i','input.gif','-vf',`fps=${fps},${scaleFilter(size)},format=yuva420p`,'-an','-c:v',codec==='vp9'?'libvpx-vp9':'libvpx','-pix_fmt','yuva420p','-auto-alt-ref','0','-lag-in-frames','0','-threads','1','-deadline','realtime','-cpu-used','8','-b:v',codec==='vp9'?'0':'2M','-crf',String(crf),'output.webm'];
}
export function wasmFault(error){return /memory|out of bounds|unreachable|aborted|RuntimeError/i.test(String(error?.message||error));}
export async function convertFresh({create,input,codec='vp8',size=1024,crf=28,fps=20,onAttempt=()=>{},log=()=>{}}){
 const attempts=webmAttempts(codec,size);
 for(let i=0;i<attempts.length;i++){
  const attempt=attempts[i];let worker;
  try{
   onAttempt(attempt,i);worker=await create();
   // writeFile may transfer its Uint8Array buffer: give every attempt its own copy.
   await worker.writeFile('input.gif',new Uint8Array(input));const args=webmArgs(attempt,crf,fps);log('ffmpeg '+args.join(' '));
   const code=await worker.exec(args,180000);if(code!==0)throw new Error('FFmpeg exit code '+code+'（入力または変換条件を確認してください）');
   const data=await worker.readFile('output.webm');if(!(data instanceof Uint8Array)||data.length<128||data[0]!==0x1a||data[1]!==0x45||data[2]!==0xdf||data[3]!==0xa3)throw new Error('WebM出力が空または不正です。');
   return {data:new Uint8Array(data),attempt};
  }catch(e){
   if(!wasmFault(e)||i===attempts.length-1)throw e;
   log('WASMエラー。実行環境を破棄し、別の環境で再試行します。');
  }finally{try{worker?.terminate();}catch{log('実行環境の終了時にエラーがありました。次回は新しく起動します。');}}
 }
}
