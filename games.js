/* =====================================================================
 * QUVERIS GAME REGISTRY
 * ---------------------------------------------------------------------
 * このファイルは管理ページ（admin.html）からも自動で書き換えられます。
 *
 * status: "released"（公開中） / "development"（開発中）
 * entry : ゲーム本体の相対パス（games/<id>/index.html）
 * video : PV（games/<id>/pv.mp4 または YouTube / TikTok の URL）
 * links : 外部公開先 [{ label: "itch.io", url: "https://..." }]
 * 最終更新: 2026-11-14T06:08:27.415Z
 * ===================================================================== */

window.QUVERIS_SITE = {
  "name": "QUVERIS",
  "tagline": "AI × GAME × ENTERTAINMENT",
  "social": [
    {
      "label": "TikTok",
      "url": ""
    },
    {
      "label": "X",
      "url": ""
    },
    {
      "label": "YouTube",
      "url": ""
    }
  ]
};

window.QUVERIS_GAMES = [
  {
    "id": "yoiakarimachi",
    "title": "宵灯町",
    "genre": "アドベンチャー",
    "summary": "夕暮れが終わらない町を歩き、人と話し、記憶のかけらを集める、ドット絵の探索アドベンチャー。",
    "description": "目を開けると、橋の上に立っていた。\n灯籠の明かりがともる、夕暮れの終わらない町「宵灯町」。\n町の人と話し、落とし物や記憶の断片を拾い集めて、推理ノートにつなげていくうちに、この町が夜を迎えない理由が少しずつ見えてくる。\n半分に割られたお菓子、名前の書かれていない札。小さな手がかりをたどって、町の秘密に近づこう。\nセーブ機能つきなので、少しずつ進められます。",
    "status": "released",
    "entry": "games/yoiakarimachi/index.html",
    "thumbnail": "games/yoiakarimachi/thumb.png",
    "accent": "purple",
    "orientation": "any",
    "controls": {
      "pc": "矢印キー／WASDで移動、Z・Enter・Spaceで話す・調べる、X・Shiftでダッシュ、I・Tabで持ち物、Mで地図、Nで推理ノート、Escで戻る",
      "mobile": "左下のスティックで移動、Aボタンで話す・調べる、Bボタンでダッシュ、かばんのボタンで持ち物を開く"
    },
    "tags": [
      "探索",
      "推理",
      "ドット絵",
      "セーブ対応"
    ],
    "version": "1.3.0",
    "updated": "2026-11-13",
    "links": []
  },
  {
    "id": "mint-drift",
    "title": "MINT DRIFT",
    "genre": "アクション",
    "summary": "降り注ぐ紫の破片をかわし、ミントの光を集め続けるスコアアタック。",
    "description": "QUVERISの信号空間を漂う小さな機体を操り、降り注ぐ紫の破片をかわしながらミントの光を集めるスコアアタック。\n光を連続で取るとコンボ倍率が上がり、時間とともに破片の密度とスピードが上がっていきます。1プレイ1〜3分、何度でも挑戦できます。",
    "status": "released",
    "entry": "games/mint-drift/index.html",
    "thumbnail": "games/mint-drift/thumb.png",
    "accent": "mint",
    "orientation": "any",
    "controls": {
      "pc": "マウス移動 / ← → ↑ ↓ / WASD で移動、P または Esc で一時停止",
      "mobile": "画面をドラッグして移動（指の少し上に機体が来ます）"
    },
    "tags": [
      "スコアアタック",
      "回避",
      "1分で遊べる"
    ],
    "version": "1.0.0",
    "updated": "2026-11-12",
    "links": []
  }
];
