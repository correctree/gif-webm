GIF → WebM / Sprite Sheet Converter v0.5

【今回の修正】
v0.4でWeb公開できなくなる可能性があったGitHub Actions設定を修正しました。

原因:
package-lock.jsonを同梱していないのに setup-node の npm cache を有効にしていたため、
GitHub Actionsが依存関係のインストール前に失敗する構成になっていました。

v0.5:
- setup-node の npm cache 指定を削除
- npm install → npm run build
- GitHub Pagesへ dist を公開
- Vite base は "./" のままなのでリポジトリ名に依存しません

【公開手順】
1. ZIPを展開
2. ZIPの「中身」をGitHubリポジトリ直下へアップロード
   ※ gif-xr-converter-v0.5 フォルダ自体を丸ごと1階層下へ置かないでください
3. Settings → Pages
4. Build and deployment → Source = GitHub Actions
5. Actionsタブで Deploy GIF XR Converter to Pages が緑の✓になるまで待つ
6. Pages URLを開く

まずはWeb画面が立ち上がることを確認してください。
変換機能の確認はその次に行います。
