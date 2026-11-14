# QUVERIS GAMES（GitHub + Cloudflare Pages / GitHub Pages 版）

QUVERIS が趣味で作っているゲームを、スマートフォン・PC のブラウザで無料で遊べるゲームサイトです。
GitHub Pages で無料公開し、ゲームの追加・更新・削除・PV・サイトの更新は、すべて管理ページ（admin.html）から行います。

---

## はじめての公開（1回だけ）

### 1. GitHub のアカウントを作る
https://github.com/signup で無料アカウントを作ります。ユーザー名はサイトの URL になります（例：`quveris` → `https://quveris.github.io`）。

### 2. リポジトリ（サイトの置き場所）を作る
1. https://github.com/new を開く
2. Repository name に **`ユーザー名.github.io`** と入れる（例：`quveris.github.io`）
3. **Public** を選ぶ
4. **「Add a README file」にチェック**を入れて「Create repository」

### 3. GitHub Pages をオンにする
リポジトリの「Settings」→ 左の「Pages」→ Branch で **main** と **/(root)** を選んで「Save」

### 4. トークンを作る（管理ページの鍵）
1. https://github.com/settings/personal-access-tokens/new を開く
2. Token name：`quveris-admin`／Expiration：選べるいちばん長い期間
3. Repository access：「Only select repositories」→ 2 で作ったリポジトリを選ぶ
4. Permissions → Repository permissions で
   - **Contents：Read and write**
   - **Pages：Read-only**
5. 「Generate token」→ 表示された文字列（`github_pat_…`）をコピー

### 5. サイトを入れる
1. このフォルダ（zip を解凍したもの）の **admin.html をダブルクリック**して開く
2. トークンと、リポジトリ（`ユーザー名/ユーザー名.github.io`）を入れてログイン
3. いちばん下の「サイト本体を更新」で、このサイトの zip を選んで「入れる」
4. 1〜2分待って `https://ユーザー名.github.io` を開く

これ以降は `https://ユーザー名.github.io/admin.html` から全部操作できます。

---

## Cloudflare Pages で公開する場合

GitHub のリポジトリを Cloudflare Pages につなぐと、管理ページで変更するたびに Cloudflare が自動で公開します（ビルドコマンドなし、出力ディレクトリは `/`）。
管理ページにはじめてログインするとき、「サイトの URL」に Cloudflare の URL（例：`https://○○.pages.dev`）を入れてください。GitHub Pages の設定（手順 3）は不要です。

## 管理ページでできること

| 操作 | 方法 |
|---|---|
| ゲームを追加 | HTML ファイル1つ、またはフォルダをまとめた zip（中に `index.html`）を選んで「追加してサイトに反映」。zip に `thumb.png` があればサムネイルになります |
| ゲームを更新・編集 | 一覧の「更新・編集」。新しい版の HTML / zip でゲームを差し替え（URL・PV・セーブはそのまま）。紹介文や操作説明、バージョンも書き直せます |
| PV | 「PVを追加／変更」で動画ファイル（mp4、40MB まで）か YouTube / TikTok の URL |
| 公開／開発中 | 「公開中にする」「開発中にする」 |
| ゲームを削除 | 「削除」→ 確認で「削除する」 |
| サイト本体を更新 | デザインや文章を変えたサイトの zip を選ぶ。登録中のゲームとゲーム一覧（games.js）はそのまま残ります |

- どの操作も URL は変わりません。
- 反映には 1〜2 分かかります。GitHub Pages はファイルを 10 分ほどキャッシュするので、見る人の画面に出るまで最大 10 分ほどかかることがあります。
- 操作できるのはトークンを持っている人だけです。トークンは人に教えないでください。漏れたら https://github.com/settings/personal-access-tokens で削除（Revoke）すれば無効になります。

---

## フォルダ構成

```
├─ index.html     トップページ
├─ games.html     ゲーム一覧
├─ game.html      ゲーム詳細（?id=ゲームID）
├─ play.html      プレイページ（?id=ゲームID）
├─ admin.html     管理ページ（共有しない）
├─ 404.html
├─ games.js       ゲームの登録情報（管理ページが自動で書き換えます）
├─ .nojekyll      GitHub Pages 用（消さないでください）
├─ assets/        デザイン・スクリプト・マスコット画像
└─ games/<id>/    ゲーム本体（1ゲーム = 1フォルダ）
```

## ゲームを作るときのルール

- 入口のファイル名は `index.html`
- 画像・音声は相対パス（`img/player.png` など）で読み込み、読み込みに失敗しても止まらないようにする
- スマホ対応のため `<meta name="viewport" …>` と `touch-action: none;` を入れる（`games/_template` 参照）
- 音は最初のタップ／クリックのあとに鳴らす（iPhone の制限）
- `localStorage` は `try { … } catch {}` で囲む
