GIF → WebM / Sprite Sheet Converter v0.7

今回の修正:
- v0.6ではVite上なのに @ffmpeg/core の UMD build を使っていたため、
  "failed to import ffmpeg-core.js" が発生していました。
- ffmpeg.wasm公式Usageの注意書きに従い、Viteでは ESM build を使用します。

変更:
https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd
↓
https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm

GitHub Pagesへ上書き後、Actionsのデプロイ完了を待ち、
公開ページを Command + Shift + R で強制再読み込みしてください。

正常時ログ:
Loading @ffmpeg/ffmpeg module...
FFmpeg module loaded.
Core JS downloaded.
Core WASM downloaded.
FFmpeg ready.
