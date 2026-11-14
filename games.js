/* =====================================================================
 * QUVERIS GAME REGISTRY
 * ---------------------------------------------------------------------
 * ゲームを追加するときは、このファイルの QUVERIS_GAMES 配列に
 * 1件追加するだけです。トップ・一覧・詳細・プレイページに自動反映されます。
 *
 * 項目の説明
 *   id            英数字とハイフンのみ。URL (?id=...) とフォルダ名に使う
 *   title         ゲーム名
 *   genre         ジャンル（一覧の絞り込みに使用）
 *   summary       一覧カード用の短い紹介文（40〜60字目安）
 *   description   詳細ページ用の紹介文（改行は \n）
 *   status        "released"（公開中） / "development"（開発中）
 *                 ※ "released" にできるのは entry が存在し、完成したゲームだけ
 *   entry         ゲーム本体の相対パス（games/<id>/index.html）
 *                 開発中で本体が無い場合は null
 *   thumbnail     サムネイル画像の相対パス（読み込めない場合は自動で代替表示）
 *   accent        カードの差し色 "mint" / "purple"
 *   orientation   推奨の向き "any" / "portrait" / "landscape"
 *   controls      { pc: "...", mobile: "..." } 操作説明
 *   tags          自由タグ（検索対象）
 *   version       表示用バージョン
 *   updated       最終更新日 "YYYY-MM-DD"
 *   links         外部公開先 [{ label: "itch.io", url: "https://..." }]
 *                 url が空のものは表示されません
 * ===================================================================== */

window.QUVERIS_SITE = {
  name: "QUVERIS",
  tagline: "AI × GAME × ENTERTAINMENT",
  // SNS のURLを入れるとフッターとブランドページに表示されます（空なら非表示）
  social: [
    { label: "TikTok", url: "" },
    { label: "X", url: "" },
    { label: "YouTube", url: "" }
  ]
};

window.QUVERIS_GAMES = [
  {
    id: "yoiakarimachi",
    title: "宵灯町",
    genre: "アドベンチャー",
    summary: "夕暮れが終わらない町を歩き、人と話し、記憶のかけらを集める、ドット絵の探索アドベンチャー。",
    description:
      "目を開けると、橋の上に立っていた。\n" +
      "灯籠の明かりがともる、夕暮れの終わらない町「宵灯町」。\n" +
      "町の人と話し、落とし物や記憶の断片を拾い集めて、推理ノートにつなげていくうちに、この町が夜を迎えない理由が少しずつ見えてくる。\n" +
      "半分に割られたお菓子、名前の書かれていない札。小さな手がかりをたどって、町の秘密に近づこう。\n" +
      "セーブ機能つきなので、少しずつ進められます。",
    status: "released",
    entry: "games/yoiakarimachi/index.html",
    thumbnail: "games/yoiakarimachi/thumb.png",
    accent: "purple",
    orientation: "any",
    controls: {
      pc: "矢印キー／WASDで移動、Z・Enter・Spaceで話す・調べる、X・Shiftでダッシュ、I・Tabで持ち物、Mで地図、Nで推理ノート、Escで戻る",
      mobile: "左下のスティックで移動、Aボタンで話す・調べる、Bボタンでダッシュ、かばんのボタンで持ち物を開く"
    },
    tags: ["探索", "推理", "ドット絵", "セーブ対応"],
    version: "1.3.0",
    updated: "2026-11-13",
    links: []
  },
  {
    id: "mint-drift",
    title: "MINT DRIFT",
    genre: "アクション",
    summary: "降り注ぐ紫の破片をかわし、ミントの光を集め続けるスコアアタック。",
    description:
      "QUVERISの信号空間を漂う小さな機体を操り、降り注ぐ紫の破片をかわしながらミントの光を集めるスコアアタック。\n" +
      "光を連続で取るとコンボ倍率が上がり、時間とともに破片の密度とスピードが上がっていきます。1プレイ1〜3分、何度でも挑戦できます。",
    status: "released",
    entry: "games/mint-drift/index.html",
    thumbnail: "games/mint-drift/thumb.png",
    accent: "mint",
    orientation: "any",
    controls: {
      pc: "マウス移動 / ← → ↑ ↓ / WASD で移動、P または Esc で一時停止",
      mobile: "画面をドラッグして移動（指の少し上に機体が来ます）"
    },
    tags: ["スコアアタック", "回避", "1分で遊べる"],
    version: "1.0.0",
    updated: "2026-11-12",
    links: [
      // { label: "itch.io", url: "https://quveris.itch.io/mint-drift" }
    ]
  },
  {
    id: "lumen-grid",
    title: "LUMEN GRID",
    genre: "パズル",
    summary: "タイルを押すと十字に光が反転。すべてのタイルを消灯させる思考型パズル。",
    description:
      "タイルを押すと、そのタイルと上下左右の光が反転します。すべての光を消せばステージクリア。\n" +
      "ステージは必ず解ける形で自動生成され、進むほど盤面が広く、手数が多くなります。1手戻す・リセット・ヒント機能つき。",
    status: "released",
    entry: "games/lumen-grid/index.html",
    thumbnail: "games/lumen-grid/thumb.png",
    accent: "purple",
    orientation: "any",
    controls: {
      pc: "クリックでタイル反転 / 矢印キーで選択 + Space・Enter で反転 / Z で1手戻す / R でリセット",
      mobile: "タイルをタップして反転"
    },
    tags: ["ロジック", "ステージ制", "じっくり"],
    version: "1.0.0",
    updated: "2026-11-12",
    links: []
  },
  {
    id: "signal-zero",
    title: "SIGNAL ZERO",
    genre: "アドベンチャー",
    summary: "QUVERISのマスコットが主人公のピクセルアドベンチャー。現在開発中。",
    description:
      "途切れた信号の先に残された世界を、QUVERISのマスコットが旅するピクセルアドベンチャー。\n" +
      "現在開発中です。公開時期はSNSでお知らせします。",
    status: "development",
    entry: null,
    thumbnail: "games/signal-zero/thumb.png",
    accent: "purple",
    orientation: "landscape",
    controls: { pc: "未定", mobile: "未定" },
    tags: ["ストーリー", "ピクセルアート"],
    version: "-",
    updated: "2026-11-12",
    links: []
  }
];
