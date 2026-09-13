GIF → WebM / Sprite Sheet Converter v0.4

この版は、前版の「@ffmpeg/ffmpeg をCDNから直接importしてWorkerを作る」方式をやめ、
Viteで @ffmpeg/ffmpeg をアプリ本体へバンドルします。

■ GitHub Pagesで使う
1. このZIPを展開
2. 中身を新しいGitHubリポジトリへアップロード
3. Settings → Pages → Source を「GitHub Actions」にする
4. mainブランチへpushすると自動ビルド・公開

■ Macでローカル確認
Node.js 22以降で:
npm install
npm run dev

表示された localhost URL をChromeで開いてください。
index.htmlをダブルクリック(file://)して使う構成ではありません。

■ 出力
Transparent WebM:
  VP9 + yuva420p + auto-alt-ref 0

Sprite:
  xxx-sprite.png
  xxx-sprite.json

※ 初回変換時、FFmpeg Core/WASMをCDNから読み込みます。

■ v0.4 修正
v0.3 の ESM Core 読み込みを廃止しました。
@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js と ffmpeg-core.wasm を
toBlobURL() で読み込む、ffmpeg.wasm公式Usageと同じsingle-thread構成です。

画面ログで
Core JS downloaded.
Core WASM downloaded.
FFmpeg ready.
まで進めばCore初期化成功です。
