GIF → WebM / Sprite Sheet Converter 0.9.0 — VP8標準・WASM再初期化

【アップロード先】
https://github.com/correctree/gif-webm

【適用手順】
1 ZIPを展開。
2 GitHubのgif-webmリポジトリ先頭、mainで Add file → Upload files。
3 中の src フォルダー、tests フォルダー、package.json をまとめてアップロード。外側のフォルダー自体は入れません。
4 mainへコミット。既存のGitHub Actionsのビルド・デプロイ成功を確認。
5 https://correctree.github.io/gif-webm/?v=090 を開き、画面上部 MEDIA PREP 0.9.0 と、WebM方式「VP8（透過・安定優先）」を確認。
Renderの作業はありません。

【まず試す設定】
WebM方式：VP8（透過・安定優先）
最大解像度：1024px
フレーム数：20fps
CRF：28
この設定で今回失敗したGIFを変換してください。
同梱の tests/fixtures/transparent-600-18s.gif は600×600・18.1秒の透過テストGIFです。

【変更した内容】
・VP9固定からVP8標準へ変更。VP8でもWebM形式で透過を保持します。VP9は任意選択。
・1スレッド、先読みなし、リアルタイム設定でエンコード負荷を低減。
・入力の変化するフレーム間隔を20fps等へサンプリングし、GIFの表示時間を保持する方針。タイミングは指定fpsのフレーム間隔に丸められます。
・WASMのmemory access out of bounds等が起きた場合はWorkerを終了し、別のFFmpegインスタンスで入力を再度書き込んで再試行。壊れた実行環境を縮小設定だけ変更して再利用しません。
・VP9でWASMメモリエラーが起きた場合は同じサイズのVP8へ切り替え。VP8でも失敗する場合は解像度を段階的に下げます。実際に使った方式を完了表示とログに表示。
・通常の入力エラーや不正な出力を成功として扱いません。終了コードとWebMヘッダー・データ長を確認。
・成功・失敗ともWorkerを終了し、WebM/Spriteの同時実行や変換中の入力変更を防止。
・Coreのダウンロード用Blob URLはページ内で再利用し、試行のたびに同じCoreをダウンロードし直す処理は避けます。Coreバージョンは既存の0.12.10を維持。
・SpriteのPNGは読込後に仮想FSから削除。ImageBitmapを終了処理で解放し、巨大な合成シートにはエラーを表示。Sprite書き出しの形式は維持。
・前回の動画・シートのプレビューを次回処理前に解放。

【検証】
Node自動テスト4件成功：引数生成、フォールバック順序、WASM障害後に新しいWorkerを作って再試行、入力バッファの保護、不正出力の拒否等。
ネイティブFFmpegで600×600・18.1秒の透過GIFを、この版が生成する変換引数で実際に変換。
結果：VP8、600×600、20fps、18.100000秒、alpha_mode=1。libvpxで再デコードしてアルファ値0と255を確認。
その出力を tests/fixtures/reference-vp8.webm に同梱。
確認用コマンド：npm test
任意の実変換確認：python3 tests/verify-native.py （Node.js、FFmpeg、ffprobeが必要）

【未確認の範囲】
今回失敗した元GIFは未添付のため、そのGIFでの再現確認はできていません。
この環境ではnpmパッケージ取得がHTTP403で拒否されたため、Viteの実ビルドとブラウザー内WASMでの実変換は未実施です。ネイティブFFmpegでの成功はブラウザーWASMでの成功を保証するものではありません。GitHub Actionsと公開ページで確認してください。
ブラウザーによって透過WebMのプレビュー対応は異なります。VP8に変更するため、最終利用先でも透過と再生を確認してください。

【調査参考】
ffmpeg.wasmのVP9で同様のWASM障害が報告されているIssue：
https://github.com/ffmpegwasm/ffmpeg.wasm/issues/679
FFmpeg Workerのterminate/load仕様：
https://ffmpegwasm.netlify.app/docs/api/ffmpeg/classes/ffmpeg/
