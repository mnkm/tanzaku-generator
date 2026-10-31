# 短冊文字入れツール (tanzaku-generator)

七夕の短冊の画像に縦書きの文字を入れ、PNG の画像として保存できる Web アプリです。ブラウザだけで動き、サーバーでの処理はありません。

公開 URL: https://mnkm.page/tanzaku-generator/

## 使い方

1. 上のツールバーの「+」ボタンで、テキストボックスを追加します。
2. 下のシートに文字を入力し、「内容を反映」を押します。
3. テキストボックスをドラッグして位置を、右下のハンドルで大きさを変えます。
4. 設定ボタンで、選んでいるボックスの文字の大きさと行間を変えます。
5. ダウンロードボタンで、背景と文字を合わせた PNG を保存します。

テキストボックスは選んだ状態で削除ボタンを押し、確認のあとで削除できます。ボックスに収まらない文字は入力した内容としては残したまま、ボックスの外の部分を表示しません。

## 構成

HTML・CSS・JavaScript だけで作っており、フレームワークは使いません。

| ライブラリ | 版 | 用途 | ライセンス |
|---|---|---|---|
| jQuery | 3.7.1 | DOM の操作とイベントの処理 | MIT |
| [interact.js](https://interactjs.io/) | 1.10.28 | テキストボックスの移動と大きさの変更 | MIT |
| [@mogamoga1024/vertical-text-canvas](https://www.npmjs.com/package/@mogamoga1024/vertical-text-canvas) | 1.0.11 | Canvas への縦書きの描画 | MIT OR WTFPL |

ライブラリは npm で管理し、版を `package.json` と `package-lock.json` で固定しています。`scripts/copy-vendor.mjs` が配布ファイルを `js/vendor/` にコピーします(`js/vendor/` はリポジトリに含めません)。更新するときは、`package.json` の版を変えて `npm install` を実行します。

フォントは Google Fonts の Zen Kurenaido です。短冊に入れた文字を含むファイルだけを、Canvas に描く前に `document.fonts.load` で読み込みます。

アイコンは [MingCute Icons](https://github.com/mingcute-design/mingcute-icons)(Apache License 2.0)です。対象のファイルとライセンスの全文は `THIRD_PARTY_NOTICES.md` にあります。

```
.
├── _headers        # Cloudflare Pages が返す HTTP ヘッダーの設定
├── index.html      # 画面の構造、ライブラリの読み込み、CSP の設定
├── package.json    # ライブラリの版の管理
├── scripts/
│   └── copy-vendor.mjs  # ライブラリを node_modules から js/vendor/ へコピーする
├── css/style.css   # 画面のスタイル
├── js/
│   ├── script.js   # テキストボックスの管理、縦書きの描画、画像の書き出し
│   └── vendor/     # npm からコピーしたライブラリ(リポジトリには含めない)
└── img/            # アイコンと背景の画像
```

## セキュリティ

- ライブラリは CDN から読み込まず、同じオリジンから配信します。脆弱性は GitHub の Dependabot で検知します。
- `index.html` の Content-Security-Policy で、スクリプトの読み込み元を同じオリジンと Cloudflare Web Analytics に、スタイルの読み込み元を同じオリジンと Google Fonts に、通信先を同じオリジン(アクセス解析の送信先 `/cdn-cgi/rum`)と Cloudflare Web Analytics に限っています。インラインのスクリプトとスタイルは許可していません。
- 他のサイトの中に埋め込まれないよう(クリックジャッキングの対策)、`_headers` で `X-Frame-Options: DENY` と `Content-Security-Policy: frame-ancestors 'none'` を返します。`frame-ancestors` は `<meta>` では指定できないので、HTTP ヘッダーで指定しています。
- 公開サイトのアクセス解析には Cloudflare Web Analytics を使っています。

## ローカルでの動作確認

最初と、ライブラリを更新したときに `npm install` を実行します。そのあと、静的なファイルを配信するサーバーで `index.html` を開きます。

```bash
npm install
npx serve .
```

## デプロイ

Cloudflare Pages で配信しています。ビルドコマンドは `npm ci --ignore-scripts && npm run vendor` です。
