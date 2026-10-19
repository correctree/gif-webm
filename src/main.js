import "./style.css";
import {convertFresh,scaleFilter} from "./conversion.js";

document.querySelector("#app").innerHTML = `
<div class="shell">
  <div class="kicker">XR AUTHORING TOOL / MEDIA PREP 0.9.0</div>
  <h1>GIF → WebM / Sprite Sheet</h1>
  <p class="sub">GIFを、XR空間向けの <b>透過WebM</b> または <b>Sprite Sheet PNG + JSON</b> に変換します。</p>

  <div class="grid">
    <section class="card">
      <div class="head">01 / INPUT & PREVIEW</div>

      <div class="drop" id="drop">
        <input id="file" type="file" accept=".gif,image/gif">
        <div>
          <strong>GIFをドロップ</strong>
          <small>またはクリックして選択</small>
        </div>
      </div>

      <div class="previewArea" id="previewArea">
        <div class="previewGrid">
          <div class="preview">
            <span class="tag">SOURCE GIF</span>
            <img id="srcPreview" alt="">
          </div>

          <div class="preview">
            <span class="tag" id="outTag">OUTPUT</span>
            <video id="videoPreview" muted autoplay loop playsinline></video>
            <canvas id="spritePreview" style="display:none"></canvas>
          </div>
        </div>

        <div class="meta" id="meta"></div>
      </div>
    </section>

    <aside class="card">
      <div class="head">02 / OUTPUT TYPE</div>

      <div class="modeTabs">
        <button class="modeBtn active" id="webmModeBtn" type="button">TRANSPARENT WEBM</button>
        <button class="modeBtn" id="spriteModeBtn" type="button">SPRITE SHEET</button>
      </div>

      <div class="settings" id="webmSettings"><label>WebM方式<select id="codec"><option value="vp8">VP8（透過・安定優先）</option><option value="vp9">VP9（高圧縮・WASMエラー時VP8へ切替）</option></select></label><label>フレーム数<select id="fps"><option value="15">15 fps</option><option value="20" selected>20 fps</option><option value="24">24 fps</option><option value="30">30 fps</option></select></label>
        <label>最大解像度
          <select id="size">
            <option value="0">Original</option>
            <option value="2048">2048 px</option>
            <option value="1024" selected>1024 px</option>
            <option value="512">512 px</option>
          </select>
        </label>

        <label>WebM品質 / CRF
          <div class="two">
            <input id="crf" type="range" min="15" max="45" value="28">
            <span class="val" id="crfVal">28</span>
          </div>
        </label>
      </div>

      <div class="settings" id="spriteSettings" style="display:none">
        <label>最大解像度
          <select id="spriteSize">
            <option value="0">Original</option>
            <option value="2048" selected>2048 px</option>
            <option value="1024">1024 px</option>
            <option value="512">512 px</option>
          </select>
        </label>

        <label>Sprite Columns
          <select id="cols">
            <option value="2">2</option>
            <option value="4" selected>4</option>
            <option value="8">8</option>
          </select>
        </label>
      </div>

      <div class="actions">
        <button id="convertWebm" class="primary" disabled>CONVERT TO WEBM</button>
        <button id="convertSprite" class="primary" style="display:none" disabled>CONVERT TO SPRITE</button>

        <a id="webmDL" class="btn download">DOWNLOAD WEBM</a>

        <div id="spriteDownloads" class="downloadGroup" style="display:none">
          <a id="pngDL" class="btn download">DOWNLOAD PNG</a>
          <a id="jsonDL" class="btn download">DOWNLOAD JSON</a>
          <a id="zipDL" class="btn download zipBtn">DOWNLOAD PNG + JSON ZIP</a>
        </div>

        <button id="reset" class="secondary">RESET</button>
      </div>

      <div class="status">
        <div class="row">
          <span id="status">GIFを選択してください</span>
          <span id="pct">0%</span>
        </div>
        <div class="bar"><i id="bar"></i></div>
      </div>

      <pre class="log" id="log">Ready.</pre>
    </aside>
  </div>

  <div class="note">
    <b>XR Authoring Tool接続前提：</b>
    WebMまたはSprite PNG + JSONを、次段階でShared Worldの「ADD ARTWORK」へ渡せる構成です。
  </div>
</div>`;

const $ = (s) => document.querySelector(s);

const els = {
  file: $("#file"),
  drop: $("#drop"),
  previewArea: $("#previewArea"),
  srcPreview: $("#srcPreview"),
  videoPreview: $("#videoPreview"),
  spritePreview: $("#spritePreview"),
  meta: $("#meta"),
  outTag: $("#outTag"),

  webmModeBtn: $("#webmModeBtn"),
  spriteModeBtn: $("#spriteModeBtn"),
  webmSettings: $("#webmSettings"),
  spriteSettings: $("#spriteSettings"),

  codec: $("#codec"),
  fps: $("#fps"),
  size: $("#size"),
  spriteSize: $("#spriteSize"),
  cols: $("#cols"),
  crf: $("#crf"),
  crfVal: $("#crfVal"),

  convertWebm: $("#convertWebm"),
  convertSprite: $("#convertSprite"),

  webmDL: $("#webmDL"),
  pngDL: $("#pngDL"),
  jsonDL: $("#jsonDL"),
  zipDL: $("#zipDL"),
  spriteDownloads: $("#spriteDownloads"),

  reset: $("#reset"),
  status: $("#status"),
  pct: $("#pct"),
  bar: $("#bar"),
  log: $("#log")
};

let inputFile = null;
let inputURL = null;
let outputURLs = [];
let mode = "webm";

let ffmpeg = null;
let busy=false;
let coreURLsPromise=null;
let FFmpegClass = null;
let fetchFileFn = null;
let toBlobURLFn = null;
let JSZipClass = null;

function setStatus(text, progress = 0) {
  els.status.textContent = text;
  const p = Math.max(0, Math.min(100, Math.round(progress)));
  els.pct.textContent = `${p}%`;
  els.bar.style.width = `${p}%`;
}

function log(text) {
  els.log.textContent = (els.log.textContent + "\n" + text)
    .split("\n")
    .slice(-32)
    .join("\n");
  els.log.scrollTop = els.log.scrollHeight;
}

function bytes(n) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024).toFixed(1)} KB`;
}

function cleanupURLs() {
  els.videoPreview.pause();els.videoPreview.removeAttribute("src");els.videoPreview.load();
  els.spritePreview.width=els.spritePreview.height=1;
  outputURLs.forEach((u) => URL.revokeObjectURL(u));
  outputURLs = [];
}

function hideDownloads() {
  els.webmDL.classList.remove("show");
  els.spriteDownloads.style.display = "none";
  [els.pngDL, els.jsonDL, els.zipDL].forEach((el) => el.classList.remove("show"));
}

function setMode(next) {
  if(busy)return;
  mode = next;

  const isWebm = mode === "webm";
  els.webmModeBtn.classList.toggle("active", isWebm);
  els.spriteModeBtn.classList.toggle("active", !isWebm);

  els.webmSettings.style.display = isWebm ? "grid" : "none";
  els.spriteSettings.style.display = isWebm ? "none" : "grid";

  els.convertWebm.style.display = isWebm ? "flex" : "none";
  els.convertSprite.style.display = isWebm ? "none" : "flex";

  els.videoPreview.style.display = isWebm ? "block" : "none";
  els.spritePreview.style.display = isWebm ? "none" : "block";
  els.outTag.textContent = isWebm ? "WEBM OUTPUT" : "SPRITE OUTPUT";

  hideDownloads();
  setStatus(inputFile ? "変換できます" : "GIFを選択してください", 0);
}

async function inspect(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const u = URL.createObjectURL(file);

    img.onload = () => {
      resolve([img.naturalWidth, img.naturalHeight]);
      URL.revokeObjectURL(u);
    };

    img.onerror = () => {
      resolve(["?", "?"]);
      URL.revokeObjectURL(u);
    };

    img.src = u;
  });
}

async function choose(file) {
  if(busy)return;
  if (!file) return;

  if (!(file.type === "image/gif" || /\.gif$/i.test(file.name))) {
    setStatus("GIFファイルを選択してください", 0);
    return;
  }

  inputFile = file;
  cleanupURLs();
  hideDownloads();

  if (inputURL) URL.revokeObjectURL(inputURL);
  inputURL = URL.createObjectURL(file);

  els.srcPreview.src = inputURL;

  const [w, h] = await inspect(file);

  els.meta.innerHTML = `
    <span>${file.name}</span>
    <span>${w} × ${h}</span>
    <span>${bytes(file.size)}</span>
  `;

  els.previewArea.classList.add("show");
  els.convertWebm.disabled = false;
  els.convertSprite.disabled = false;

  setStatus("変換できます", 0);

  els.log.textContent =
`Input: ${file.name}
Resolution: ${w}x${h}
Size: ${bytes(file.size)}`;
}

function disposeFFmpeg(){if(ffmpeg){try{ffmpeg.terminate();}finally{ffmpeg=null;}}}
async function loadFFmpeg(){
 disposeFFmpeg();
 if(!FFmpegClass){setStatus('FFmpegモジュールを読み込み中…',2);const [mod,util]=await Promise.all([import('@ffmpeg/ffmpeg'),import('@ffmpeg/util')]);FFmpegClass=mod.FFmpeg;fetchFileFn=util.fetchFile;toBlobURLFn=util.toBlobURL;}
 if(!coreURLsPromise)coreURLsPromise=(async()=>{const urls=[];try{const base='https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';urls.push(await toBlobURLFn(base+'/ffmpeg-core.js','text/javascript'));urls.push(await toBlobURLFn(base+'/ffmpeg-core.wasm','application/wasm'));return {coreURL:urls[0],wasmURL:urls[1]};}catch(e){urls.forEach(u=>URL.revokeObjectURL(u));coreURLsPromise=null;throw e;}})();
 setStatus('FFmpeg Coreを読み込み中…',4);const urls=await coreURLsPromise,worker=new FFmpegClass();ffmpeg=worker;
 worker.on('log',({message})=>log(message));worker.on('progress',({progress})=>{if(Number.isFinite(progress))setStatus('変換中…',10+Math.min(1,Math.max(0,progress))*80);});
 try{await worker.load(urls);log('FFmpeg ready（新しい実行環境）');return worker;}catch(e){disposeFFmpeg();throw e;}
}

async function loadJSZip() {
  if (JSZipClass) return;
  const mod = await import("jszip");
  JSZipClass = mod.default;
}

async function writeInput() {
  try { await ffmpeg.deleteFile("input.gif"); } catch {}
  await ffmpeg.writeFile("input.gif", await fetchFileFn(inputFile));
}


async function makeWebM() {
  hideDownloads();
  cleanupURLs();

  const result=await convertFresh({create:async()=>{const worker=await loadFFmpeg();ffmpeg=null;return worker;},input:new Uint8Array(await inputFile.arrayBuffer()),codec:els.codec.value,size:Number(els.size.value),crf:Number(els.crf.value),fps:Number(els.fps.value),log,onAttempt:(a,i)=>{if(i)log('再試行：'+a.codec.toUpperCase()+' / 最大'+(a.size||'元サイズ')+'px');setStatus(i?'新しい環境で再試行中…':'変換準備中…',2);}});
  ffmpeg=null;
  const blob = new Blob([result.data], { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  outputURLs.push(url);

  els.videoPreview.src = url;
  els.videoPreview.style.display = "block";
  els.spritePreview.style.display = "none";

  els.webmDL.href = url;
  els.webmDL.download = inputFile.name.replace(/\.gif$/i, "") + ".webm";
  els.webmDL.classList.add("show");

  setStatus("WebM変換完了 / "+result.attempt.codec.toUpperCase(), 100);
  log("使用方式："+result.attempt.codec.toUpperCase()+" / "+els.fps.value+"fps / "+bytes(blob.size));
}

async function makeSprite() {
  hideDownloads();
  cleanupURLs();

  await loadFFmpeg();
  await writeInput();

  // 既存フレームを削除
  const before = await ffmpeg.listDir("/");
  for (const e of before) {
    if (/^frame_\d+\.png$/.test(e.name)) {
      try { await ffmpeg.deleteFile(e.name); } catch {}
    }
  }

  const args = ["-i", "input.gif"];

  const vf = scaleFilter(els.spriteSize.value);
  if (vf) args.push("-vf", vf);

  // GIFの各フレームをPNGへ展開
  args.push("-vsync", "0", "frame_%05d.png");

  log("ffmpeg " + args.join(" "));

  const code = await ffmpeg.exec(args);
  if (code !== 0) throw new Error(`FFmpeg exit code ${code}`);

  const after = await ffmpeg.listDir("/");
  const names = after
    .map((x) => x.name)
    .filter((n) => /^frame_\d+\.png$/.test(n))
    .sort();

  if (!names.length) {
    throw new Error("GIFからPNGフレームを取得できませんでした");
  }

  setStatus("Sprite Sheetを合成中…", 78);

  const bitmaps = [];
  try {
  for (const name of names) {
    const data = await ffmpeg.readFile(name);
    const blob = new Blob([data], { type: "image/png" });
    bitmaps.push(await createImageBitmap(blob));
    await ffmpeg.deleteFile(name);
  }

  const fw = bitmaps[0].width;
  const fh = bitmaps[0].height;
  const cols = Number(els.cols.value);
  const rows = Math.ceil(bitmaps.length / cols);

  const canvas = document.createElement("canvas");
  if(fw*cols>16384||fh*rows>16384||fw*cols*fh*rows>32*1024*1024)throw new Error("Sprite Sheetが大きすぎます。最大解像度を小さくしてください。");
  canvas.width = fw * cols;
  canvas.height = fh * rows;

  const ctx = canvas.getContext("2d", { alpha: true });
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  bitmaps.forEach((bmp, i) => {
    const x = (i % cols) * fw;
    const y = Math.floor(i / cols) * fh;

    ctx.drawImage(bmp, x, y);
    bmp.close?.();
  });

  const pngBlob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("PNG生成に失敗しました")),
      "image/png"
    );
  });

  const base = inputFile.name.replace(/\.gif$/i, "") || "artwork";

  const manifest = {
    version: 1,
    type: "sprite-sheet",
    source: inputFile.name,
    image: `${base}-sprite.png`,
    frameWidth: fw,
    frameHeight: fh,
    columns: cols,
    rows,
    frames: names.length,
    loop: true,
    transparent: true,
    origin: "top-left"
  };

  const jsonText = JSON.stringify(manifest, null, 2);
  const jsonBlob = new Blob([jsonText], { type: "application/json" });

  const pngURL = URL.createObjectURL(pngBlob);
  const jsonURL = URL.createObjectURL(jsonBlob);

  outputURLs.push(pngURL, jsonURL);

  els.pngDL.href = pngURL;
  els.pngDL.download = `${base}-sprite.png`;
  els.pngDL.classList.add("show");

  els.jsonDL.href = jsonURL;
  els.jsonDL.download = `${base}-sprite.json`;
  els.jsonDL.classList.add("show");

  // ZIP
  setStatus("ZIPを作成中…", 92);
  await loadJSZip();

  const zip = new JSZipClass();
  zip.file(`${base}-sprite.png`, pngBlob);
  zip.file(`${base}-sprite.json`, jsonText);

  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE"
  });

  const zipURL = URL.createObjectURL(zipBlob);
  outputURLs.push(zipURL);

  els.zipDL.href = zipURL;
  els.zipDL.download = `${base}-sprite-package.zip`;
  els.zipDL.classList.add("show");

  els.spriteDownloads.style.display = "grid";

  // Preview
  els.spritePreview.width = canvas.width;
  els.spritePreview.height = canvas.height;

  const pctx = els.spritePreview.getContext("2d");
  pctx.clearRect(0, 0, canvas.width, canvas.height);
  pctx.drawImage(canvas, 0, 0);

  els.spritePreview.style.display = "block";
  els.videoPreview.style.display = "none";
  els.outTag.textContent = "SPRITE SHEET";

  els.meta.innerHTML += `
    <span>${names.length} frames</span>
    <span>${cols} × ${rows} grid</span>
    <span>${bytes(pngBlob.size)}</span>
  `;

  setStatus("Sprite Sheet変換完了", 100);
  log(`Sprite done: ${names.length} frames / ${cols}x${rows}`);
  } finally {bitmaps.forEach(bmp=>bmp.close?.());}
}

async function runConversion(make,label){
 if(!inputFile||busy)return;busy=true;
 const controls=[...document.querySelectorAll('input,select,button')],previous=controls.map(el=>el.disabled);controls.forEach(el=>el.disabled=true);
 try{await make();}catch(err){log(label+' ERROR: '+(err?.stack||err));setStatus(label+'変換に失敗しました。Spriteへの切替もお試しください。',0);}
 finally{disposeFFmpeg();busy=false;controls.forEach((el,i)=>el.disabled=previous[i]);els.convertWebm.disabled=els.convertSprite.disabled=!inputFile;}
}
const runWebM=()=>runConversion(makeWebM,'WebM');
const runSprite=()=>runConversion(makeSprite,'Sprite');

els.file.addEventListener("change", () => choose(els.file.files?.[0]));

["dragenter", "dragover"].forEach((type) => {
  els.drop.addEventListener(type, (e) => {
    e.preventDefault();
    els.drop.classList.add("drag");
  });
});

["dragleave", "drop"].forEach((type) => {
  els.drop.addEventListener(type, (e) => {
    e.preventDefault();
    els.drop.classList.remove("drag");
  });
});

els.drop.addEventListener("drop", (e) => {
  choose(e.dataTransfer?.files?.[0]);
});

els.crf.addEventListener("input", () => {
  els.crfVal.textContent = els.crf.value;
});

els.webmModeBtn.addEventListener("click", () => setMode("webm"));
els.spriteModeBtn.addEventListener("click", () => setMode("sprite"));

els.convertWebm.addEventListener("click", runWebM);
els.convertSprite.addEventListener("click", runSprite);

els.reset.addEventListener("click", () => {
  if(busy)return;disposeFFmpeg();
  inputFile = null;
  els.file.value = "";

  els.previewArea.classList.remove("show");
  els.convertWebm.disabled = true;
  els.convertSprite.disabled = true;

  hideDownloads();
  cleanupURLs();

  if (inputURL) {
    URL.revokeObjectURL(inputURL);
    inputURL = null;
  }

  els.videoPreview.removeAttribute("src");
  els.spritePreview.style.display = "none";
  els.videoPreview.style.display = "block";

  els.meta.innerHTML = "";
  els.log.textContent = "Ready.";

  setStatus("GIFを選択してください", 0);
  setMode("webm");
});

setMode("webm");
