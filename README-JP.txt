GIF → WebM / Sprite Sheet Converter v0.8

変更点:
- 出力形式を明確な2ボタン式に変更
  [TRANSPARENT WEBM]
  [SPRITE SHEET]
- Sprite Sheet側に専用の
  [CONVERT TO SPRITE]
  ボタンを追加
- Sprite変換後に
  [DOWNLOAD PNG]
  [DOWNLOAD JSON]
  [DOWNLOAD PNG + JSON ZIP]
  を表示
- ZIP生成に JSZip を使用
- WebM側の動作はv0.7の成功版を維持

GitHubへ上書き:
1. ZIPを展開
2. リポジトリ直下へ中身をアップロード
3. package.json も必ず上書き
4. Actionsのデプロイ完了を待つ
5. 公開ページで Command + Shift + R

Sprite確認:
1. GIFを選択
2. SPRITE SHEETをクリック
3. CONVERT TO SPRITE
4. PNG / JSON / ZIP が表示されることを確認
