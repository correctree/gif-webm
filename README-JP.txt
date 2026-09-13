GIF → WebM / Sprite Sheet Converter v0.6

今回の修正:
- FFmpegモジュールをページ起動時に読み込まない構成へ変更。
- まずUIを必ず表示し、CONVERTを押した時だけFFmpegをdynamic importします。
- FFmpeg初期化に失敗しても白画面にならず、ログに原因が表示されます。

GitHub Pages:
1. ZIPを展開
2. 中身をリポジトリ直下へ上書きアップロード
3. .github/workflows/deploy-pages.yml を維持
4. Actionsが緑の✓になるまで待つ
5. 公開URLを再読み込み（必要ならCommand+Shift+R）

まず「画面が表示されること」を確認してください。
次にGIFを選び、CONVERTを押してFFmpegログを確認します。
