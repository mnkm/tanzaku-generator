# 短冊文字入れツール (tanzaku-generator)

七夕の短冊画像に、ブラウザ上でドラッグ＆リサイズできるテキストボックスを使って縦書きメッセージを入れ、画像として合成・ダウンロードできる静的Webアプリです。サーバーサイドの処理を持たず、静的ホスティングで公開できます。

## デモ

https://mnkm.page/tanzaku-generator/

## 主な機能

- 短冊の背景画像上に、自由に配置できるテキストボックスを追加・削除
- ドラッグによる移動、ハンドルによるリサイズ（[interact.js](https://interactjs.io/)）
- 縦書きでの自動折り返し描画（[vertical-text-canvas](https://www.npmjs.com/package/@mogamoga1024/vertical-text-canvas)）。ボックスからはみ出す文字も入力内容としては保持したまま、見た目だけをボックス内にクリップ表示
- 画面下部から開く「ボトムシート」で、テキスト・フォントサイズ・行間を設定
- 完成した画像をPNGとしてダウンロード

## 使い方

1. 上部ツールバーの追加ボタン（＋）でテキストボックスを追加
2. 下部シートに文字を入力し「内容を反映」をタップ
3. テキストボックスをドラッグして位置を調整し、右下のハンドルでサイズを調整
4. 設定ボタンから、選択中のボックスのフォントサイズ・行間を再調整
5. ダウンロードボタンで、背景画像とテキストを合成したPNGを保存

不要になったテキストボックスは、選択した状態で削除ボタンから確認の上で削除できます。

## 技術スタック

- 素のHTML / CSS / JavaScript（フレームワーク不使用。ビルドはライブラリのコピーのみ）
- jQuery 3.7.1 — DOM操作・イベントハンドリング
- interact.js 1.10.28 — テキストボックスのドラッグ移動・リサイズ
- @mogamoga1024/vertical-text-canvas 1.0.11 — 縦書きテキストのCanvas描画
- Google Fonts（Zen Kurenaido） — 縦書きに合う和風フォント

## セキュリティ

- JavaScriptライブラリはCDNから読み込まず、npmで管理しています。版は `package.json` と `package-lock.json` で固定し、公開時に `js/vendor/` へコピーして同一オリジンから配信します。
- ライブラリの脆弱性は、GitHubのDependabotで検知します。
- `index.html` の `<meta>` タグでContent-Security-Policyを設定し、スクリプトの実行元を同一オリジンとCloudflare Web Analyticsのビーコンに、スタイルの読み込み元を同一オリジンとGoogle Fontsに限定しています。インラインのスクリプトとスタイルは許可していません。
- 他サイトへの埋め込み（クリックジャッキング）を防ぐため、Cloudflare Pagesの `_headers` で `X-Frame-Options: DENY` と `Content-Security-Policy: frame-ancestors 'none'` をHTTPヘッダーとして返しています。`frame-ancestors` は `<meta>` では効かないため、ヘッダー側で指定しています。
- 公開サイトではアクセス解析にCloudflare Web Analyticsを使用しています。

### ライブラリ

npmのパッケージに含まれる配布ファイルを、`scripts/copy-vendor.mjs` がそのまま `js/vendor/` へコピーします。`js/vendor/` はリポジトリに含めません。更新するときは `package.json` の版を変えて `npm install` を実行します。

| npmのパッケージ | バージョン | コピーされるファイル |
|---|---|---|
| `jquery` | 3.7.1 | `jquery.min.js` |
| `interactjs` | 1.10.28 | `interact.min.js` |
| `@mogamoga1024/vertical-text-canvas` | 1.0.11 | `vertical_text_canvas.js` |

ライセンスは、jQueryとinteract.jsがMIT、vertical-text-canvasがMIT OR WTFPLです。

### アイコン

faviconとボタンのアイコンは [MingCute Icons](https://github.com/mingcute-design/mingcute-icons)（Apache License 2.0）です。対象のファイルとライセンス全文は `THIRD_PARTY_NOTICES.md` にあります。

## ディレクトリ構成

```
.
├── _headers        # Cloudflare Pagesが返すHTTPレスポンスヘッダーの設定
├── index.html      # 画面構造、ライブラリの読み込み、CSP設定
├── package.json    # ライブラリの版の管理（package-lock.json とあわせて固定）
├── scripts/
│   └── copy-vendor.mjs  # ライブラリを node_modules から js/vendor/ へコピーする
├── css/
│   └── style.css   # レイアウト、ボトムシート、テキストボックスの見た目
├── js/
│   ├── script.js   # テキストボックスの状態管理、縦書き描画、画像出力処理
│   └── vendor/     # npmからコピーされるライブラリ（リポジトリには含めない）
└── img/            # アイコン・背景画像などの静的アセット
```

## ローカルでの動作確認

初回と、ライブラリを更新したときに `npm install` を実行します（`js/vendor/` へのコピーまで行われます）。そのあと、任意の静的Webサーバーで配信して `index.html` を開いてください。

```bash
npm install
npx serve .
```

## デプロイ

Cloudflare Pagesで配信しています。ビルドコマンドは `npm ci --ignore-scripts && npm run vendor` です。
