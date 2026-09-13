import "./style.css";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

document.querySelector("#app").innerHTML = `
<div class="shell">
  <div class="kicker">XR AUTHORING TOOL / MEDIA PREP 0.4</div>
  <h1>GIF → WebM / Sprite Sheet</h1>
  <p class="sub">GIFを <b>透過VP9 WebM</b> または <b>Sprite Sheet PNG + JSON</b> に変換します。ffmpeg.wasm WorkerをViteでバンドルし、Coreは公式Usageと同じsingle-thread UMD版を読み込みます。</p>

  <div class="grid">
    <section class="card">
      <div class="head">01 / INPUT & PREVIEW</div>
      <div class="drop" id="drop">
        <input id="file" type="file" accept=".gif,image/gif">
        <div><strong>GIFをドロップ</strong><small>またはクリックして選択</small></div>
      </div>
      <div class="previewArea" id="previewArea">
        <div class="previewGrid">
          <div class="preview"><span class="tag">SOURCE GIF</span><img id="srcPreview"></div>
          <div class="preview"><span class="tag" id="outTag">OUTPUT</span><video id="videoPreview" muted autoplay loop playsinline></video><canvas id="spritePreview" style="display:none"></canvas></div>
        </div>
        <div class="meta" id="meta"></div>
      </div>
    </section>

    <aside class="card">
      <div class="head">02 / OUTPUT</div>
      <div class="settings">
        <label>出力形式
          <select id="mode">
            <option value="webm">Transparent WebM</option>
            <option value="sprite">Sprite Sheet PNG + JSON</option>
          </select>
        </label>
        <label id="colsWrap" style="display:none">Sprite Columns
          <select id="cols"><option>2</option><option selected>4</option><option>8</option></select>
        </label>
        <label>最大解像度
          <select id="size"><option value="0">Original</option><option value="2048" selected>2048 px</option><option value="1024">1024 px</option><option value="512">512 px</option></select>
        </label>
        <label>WebM品質 / CRF
          <div class="two"><input id="crf" type="range" min="15" max="45" value="28"><span class="val" id="crfVal">28</span></div>
        </label>
      </div>

      <div class="actions">
        <button id="convert" class="primary" disabled>CONVERT TO WEBM</button>
        <a id="webmDL" class="btn download">DOWNLOAD WEBM</a>
        <a id="pngDL" class="btn download">DOWNLOAD SPRITE PNG</a>
        <a id="jsonDL" class="btn download">DOWNLOAD SPRITE JSON</a>
        <button id="reset" class="secondary">RESET</button>
      </div>

      <div class="status">
        <div class="row"><span id="status">GIFを選択してください</span><span id="pct">0%</span></div>
        <div class="bar"><i id="bar"></i></div>
      </div>
      <pre class="log" id="log">Ready.</pre>
    </aside>
  </div>

  <div class="note"><b>XR Authoring Tool接続前提：</b> WebMまたはSprite PNG + JSONを、次段階でShared Worldの「ADD ARTWORK」へ渡せる構成にします。</div>
</div>`;

const $ = s => document.querySelector(s);
const els = {
  file: $("#file"), drop: $("#drop"), previewArea: $("#previewArea"),
  srcPreview: $("#srcPreview"), videoPreview: $("#videoPreview"), spritePreview: $("#spritePreview"),
  meta: $("#meta"), mode: $("#mode"), colsWrap: $("#colsWrap"), cols: $("#cols"), size: $("#size"),
  crf: $("#crf"), crfVal: $("#crfVal"), convert: $("#convert"),
  webmDL: $("#webmDL"), pngDL: $("#pngDL"), jsonDL: $("#jsonDL"),
  reset: $("#reset"), status: $("#status"), pct: $("#pct"), bar: $("#bar"), log: $("#log"), outTag: $("#outTag")
};

let inputFile = null;
let inputURL = null;
let outputURLs = [];
let ffmpeg = null;
let ffmpegLoaded = false;

function setStatus(t,p=0){ els.status.textContent=t; const n=Math.max(0,Math.min(100,Math.round(p))); els.pct.textContent=n+"%"; els.bar.style.width=n+"%"; }
function log(t){ els.log.textContent=(els.log.textContent+"\n"+t).split("\n").slice(-30).join("\n"); els.log.scrollTop=els.log.scrollHeight; }
function cleanupURLs(){ outputURLs.forEach(URL.revokeObjectURL); outputURLs=[]; }
function hideDownloads(){ [els.webmDL,els.pngDL,els.jsonDL].forEach(x=>x.classList.remove("show")); }
function bytes(n){ return n>1048576?(n/1048576).toFixed(1)+" MB":(n/1024).toFixed(1)+" KB"; }

async function inspect(file){
  return new Promise(resolve=>{
    const i=new Image(),u=URL.createObjectURL(file);
    i.onload=()=>{resolve([i.naturalWidth,i.naturalHeight]);URL.revokeObjectURL(u)};
    i.onerror=()=>resolve(["?","?"]);
    i.src=u;
  });
}

async function choose(file){
  if(!file) return;
  if(!(file.type==="image/gif" || /\.gif$/i.test(file.name))){ setStatus("GIFファイルを選択してください",0); return; }
  inputFile=file; cleanupURLs(); hideDownloads();
  if(inputURL) URL.revokeObjectURL(inputURL);
  inputURL=URL.createObjectURL(file);
  els.srcPreview.src=inputURL;
  const [w,h]=await inspect(file);
  els.meta.innerHTML=`<span>${file.name}</span><span>${w} × ${h}</span><span>${bytes(file.size)}</span>`;
  els.previewArea.classList.add("show");
  els.convert.disabled=false;
  setStatus("変換できます",0);
  els.log.textContent=`Input: ${file.name}\nResolution: ${w}x${h}\nSize: ${bytes(file.size)}`;
}

async function loadFFmpeg(){
  if(ffmpegLoaded) return;
  setStatus("FFmpegを初期化中…",3);
  ffmpeg=new FFmpeg();
  ffmpeg.on("log",({message})=>log(message));
  ffmpeg.on("progress",({progress})=>{
    if(Number.isFinite(progress)) setStatus("変換中…",10+progress*85);
  });

  // @ffmpeg/ffmpeg のWorker自体はViteでローカルbundle。
  // single-thread coreはffmpeg.wasm公式Usageと同じ UMD build を使用する。
  // ESM coreをBlob URL化すると環境によって
  // "Failed to import ffmpeg-core.js" になるため、ここでは使わない。
  const baseURL="https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";
  const coreURL = await toBlobURL(
    `${baseURL}/ffmpeg-core.js`,
    "text/javascript"
  );
  const wasmURL = await toBlobURL(
    `${baseURL}/ffmpeg-core.wasm`,
    "application/wasm"
  );

  log("Core JS downloaded.");
  log("Core WASM downloaded.");

  await ffmpeg.load({
    coreURL,
    wasmURL
  });
  ffmpegLoaded=true;
  log("FFmpeg ready.");
}

async function writeInput(){
  try{ await ffmpeg.deleteFile("input.gif"); }catch{}
  await ffmpeg.writeFile("input.gif",await fetchFile(inputFile));
}

function scaleFilter(){
  const s=Number(els.size.value);
  if(!s) return null;
  return `scale=w='min(${s},iw)':h='min(${s},ih)':force_original_aspect_ratio=decrease:flags=lanczos,scale=trunc(iw/2)*2:trunc(ih/2)*2`;
}

async function makeWebM(){
  await loadFFmpeg(); await writeInput();
  try{await ffmpeg.deleteFile("output.webm")}catch{}
  const args=["-i","input.gif"];
  const vf=scaleFilter(); if(vf) args.push("-vf",vf);
  args.push("-an","-c:v","libvpx-vp9","-pix_fmt","yuva420p","-auto-alt-ref","0","-b:v","0","-crf",els.crf.value,"output.webm");
  log("ffmpeg "+args.join(" "));
  const code=await ffmpeg.exec(args);
  if(code!==0) throw new Error("FFmpeg exit code "+code);
  const data=await ffmpeg.readFile("output.webm");
  const blob=new Blob([data.buffer],{type:"video/webm"});
  const u=URL.createObjectURL(blob); outputURLs.push(u);
  els.videoPreview.src=u; els.videoPreview.style.display="block"; els.spritePreview.style.display="none"; els.outTag.textContent="WEBM";
  els.webmDL.href=u; els.webmDL.download=inputFile.name.replace(/\.gif$/i,"")+".webm"; els.webmDL.classList.add("show");
  setStatus("WebM変換完了",100);
}

async function makeSprite(){
  await loadFFmpeg(); await writeInput();

  // 以前のframe_*を削除
  const dir=await ffmpeg.listDir("/");
  for(const e of dir){
    if(/^frame_\d+\.png$/.test(e.name)){ try{await ffmpeg.deleteFile(e.name)}catch{} }
  }

  const args=["-i","input.gif"];
  const vf=scaleFilter(); if(vf) args.push("-vf",vf);
  args.push("-vsync","0","frame_%05d.png");
  log("ffmpeg "+args.join(" "));
  const code=await ffmpeg.exec(args);
  if(code!==0) throw new Error("FFmpeg exit code "+code);

  const after=await ffmpeg.listDir("/");
  const names=after.map(x=>x.name).filter(n=>/^frame_\d+\.png$/.test(n)).sort();
  if(!names.length) throw new Error("フレームを取得できませんでした");

  setStatus("Sprite Sheetを合成中…",75);
  const bitmaps=[];
  for(const name of names){
    const d=await ffmpeg.readFile(name);
    bitmaps.push(await createImageBitmap(new Blob([d.buffer],{type:"image/png"})));
  }

  const fw=bitmaps[0].width, fh=bitmaps[0].height, cols=Number(els.cols.value), rows=Math.ceil(bitmaps.length/cols);
  const c=document.createElement("canvas"); c.width=fw*cols; c.height=fh*rows;
  const ctx=c.getContext("2d",{alpha:true}); ctx.clearRect(0,0,c.width,c.height);
  bitmaps.forEach((b,i)=>{ctx.drawImage(b,(i%cols)*fw,Math.floor(i/cols)*fh); b.close();});
  const png=await new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error("PNG生成失敗")),"image/png"));
  const base=inputFile.name.replace(/\.gif$/i,"");
  const manifest={
    version:1,type:"sprite-sheet",source:inputFile.name,image:`${base}-sprite.png`,
    frameWidth:fw,frameHeight:fh,columns:cols,rows,frames:names.length,
    loop:true,transparent:true,origin:"top-left"
  };
  const jsonBlob=new Blob([JSON.stringify(manifest,null,2)],{type:"application/json"});

  const pu=URL.createObjectURL(png), ju=URL.createObjectURL(jsonBlob); outputURLs.push(pu,ju);
  els.pngDL.href=pu; els.pngDL.download=`${base}-sprite.png`; els.pngDL.classList.add("show");
  els.jsonDL.href=ju; els.jsonDL.download=`${base}-sprite.json`; els.jsonDL.classList.add("show");

  els.spritePreview.width=c.width; els.spritePreview.height=c.height;
  els.spritePreview.getContext("2d").drawImage(c,0,0);
  els.spritePreview.style.display="block"; els.videoPreview.style.display="none"; els.outTag.textContent="SPRITE SHEET";
  els.meta.innerHTML += `<span>${names.length} frames</span><span>${cols} × ${rows} grid</span>`;
  setStatus("Sprite Sheet変換完了",100);
}

async function convert(){
  if(!inputFile) return;
  els.convert.disabled=true; hideDownloads(); cleanupURLs();
  try{
    if(els.mode.value==="webm") await makeWebM(); else await makeSprite();
  }catch(e){
    console.error(e); log("ERROR: "+(e?.stack||e));
    setStatus("変換に失敗しました",0);
    alert("変換に失敗しました。\n\n画面下のログを確認してください。\nGitHub Pages / Vite dev serverなどHTTP(S)上で実行してください。");
  }finally{ els.convert.disabled=false; }
}

els.file.addEventListener("change",()=>choose(els.file.files?.[0]));
["dragenter","dragover"].forEach(t=>els.drop.addEventListener(t,e=>{e.preventDefault();els.drop.classList.add("drag")}));
["dragleave","drop"].forEach(t=>els.drop.addEventListener(t,e=>{e.preventDefault();els.drop.classList.remove("drag")}));
els.drop.addEventListener("drop",e=>choose(e.dataTransfer?.files?.[0]));
els.crf.addEventListener("input",()=>els.crfVal.textContent=els.crf.value);
els.mode.addEventListener("change",()=>{
  const sprite=els.mode.value==="sprite";
  els.colsWrap.style.display=sprite?"grid":"none";
  els.convert.textContent=sprite?"CONVERT TO SPRITE":"CONVERT TO WEBM";
  hideDownloads();
});
els.convert.addEventListener("click",convert);
els.reset.addEventListener("click",()=>{
  inputFile=null; els.file.value=""; els.previewArea.classList.remove("show"); els.convert.disabled=true;
  hideDownloads(); cleanupURLs(); if(inputURL){URL.revokeObjectURL(inputURL);inputURL=null}
  els.videoPreview.removeAttribute("src"); els.spritePreview.style.display="none"; els.videoPreview.style.display="block";
  els.meta.innerHTML=""; els.log.textContent="Ready."; setStatus("GIFを選択してください",0);
});
