/* =====================================================================
 * エルディア館 マップデータ（ゲームロジックから完全に分離）
 * ---------------------------------------------------------------------
 * 座標系: 1タイル=16px。部屋は W×H タイル。
 *   行0-1 = 上壁（正面）, 最下行 = 下壁, 列0 / 列W-1 = 側壁
 *   床は x:1..W-2, y:2..H-2
 * exits:
 *   side 'N'|'S' : at = x（w=幅） / 'W'|'E' : at = y
 *   side 'U'|'D' : 階段。x,y,w,h と到着位置 spawn:[x,y]
 *   to   : '部屋ID:出口ID'（'@outside' はエンディング）
 *   lock : {item} 鍵アイテム（一度開ければ以後開放） / {flag} フラグ条件
 *   hidden: フラグが立つまで壁として扱う（隠し通路）
 * furn : 家具。t=種類, x,y,w,h。wall系は上壁に掛ける。hideIf/showIf でフラグ切替
 * ins  : 調査ポイント。acts は上から順に条件を評価し最初の1つを実行
 *   if:{has,lacks,flag,noflag,using} say:[...] give(配列可) take set event sfx
 *   using = 持ち物から「使う」で選んだアイテム（鍵・証拠を突きつける等）
 * map  : 全体地図上の位置 [x,y,w,h]（階層ごとの座標）
 * ===================================================================== */
(function () {
  const ELD = (window.ELD = window.ELD || {});

  ELD.AREAS = {
    entrance: { name: '玄関ホール', color: '#c9a24a' },
    east:     { name: '東館',       color: '#5fa36b' },
    west:     { name: '西館',       color: '#5a7fc4' },
    tower:    { name: '時計塔',     color: '#b98a5a' },
    basement: { name: '地下施設',   color: '#6fa6a0' },
    admin:    { name: '管理区域',   color: '#a46060' },
    deep:     { name: '最深部',     color: '#9a6fd0' },
  };

  ELD.FLOORS = [
    { id: 'T',  name: '時計塔' },
    { id: '2F', name: '2F' },
    { id: '1F', name: '1F' },
    { id: 'B1', name: 'B1' },
    { id: 'B2', name: 'B2' },
  ];

  // アイテム定義は js/data/items.js に移動

  /* 共通パレット */
  const P = {
    red: [104, 30, 40], green: [44, 74, 52], blue: [38, 56, 92], purple: [74, 44, 84],
    gold: [112, 88, 40], teal: [30, 74, 74], rose: [110, 58, 68], gray: [62, 62, 72],
    brown: [74, 58, 44], navy: [30, 36, 64], olive: [70, 70, 40],
  };
  const paper = (c) => ({ s: 'paper', c });

  const R = [];
  const room = (o) => R.push(o);

  /* ================= ① 玄関ホール ================= */
  room({
    id: 'hall', name: '玄関ホール', area: 'entrance', level: '1F', map: [42, 22, 16, 12],
    W: 26, H: 18, ground: 'marble', wall: paper(P.red), amb: [72, 64, 98],
    rugs: [{ x: 11, y: 2, w: 4, h: 15, c: [120, 24, 32] }],
    exits: [
      { id: 'front', side: 'S', at: 12, w: 2, kind: 'grand', to: '@outside',
        lock: { flag: 'front_open', msg: ['巨大な両開きの正面扉。', '外から鎖で閉ざされているらしい。……びくともしない。'] } },
      { id: 'w', side: 'W', at: 9, w: 2, to: 'west_corridor:e' },
      { id: 'e', side: 'E', at: 9, w: 2, to: 'east_corridor:w' },
      { id: 'tower', side: 'N', at: 12, w: 2, to: 'tower_entrance:s',
        lock: { item: 'tower_key', msg: ['時計塔へ続く扉。歯車の形の鍵穴がある。'] } },
      { id: 'up_l', side: 'U', x: 1, y: 2, w: 3, h: 2, spawn: [2, 4], to: 'hall_2f:dn_l' },
      { id: 'up_r', side: 'U', x: 22, y: 2, w: 3, h: 2, spawn: [23, 4], to: 'hall_2f:dn_r' },
    ],
    furn: [
      { t: 'window', x: 5, y: 0, w: 2 }, { t: 'window', x: 19, y: 0, w: 2 },
      { t: 'painting', x: 8, y: 0, w: 2, v: 'land' }, { t: 'painting', x: 16, y: 0, w: 2, v: 'lord' },
      { t: 'wlamp', x: 11, y: 0 }, { t: 'wlamp', x: 14, y: 0 },
      { t: 'gclock', x: 10, y: 2 }, { t: 'plant', x: 15, y: 2 },
      { t: 'pillar', x: 6, y: 6 }, { t: 'pillar', x: 19, y: 6 }, { t: 'pillar', x: 6, y: 13 }, { t: 'pillar', x: 19, y: 13 },
      { t: 'armor', x: 1, y: 6 }, { t: 'armor', x: 24, y: 6 },
      { t: 'counter', x: 17, y: 12, w: 5, h: 2 },
      { t: 'bench', x: 2, y: 14, w: 2 }, { t: 'plant', x: 1, y: 16 }, { t: 'plant', x: 24, y: 16 },
      { t: 'statue', x: 9, y: 15 }, { t: 'statue', x: 16, y: 15 },
      { t: 'chandelier', x: 12, y: 8, w: 2 },
    ],
    ins: [
      { id: 'hall_clock', x: 10, y: 2, acts: [
        { if: { flag: 'tower_running', noflag: 'got_score' }, say: ['柱時計が重々しく時を刻んでいる。', '……文字盤の下の小窓が、わずかに開いている。', '中から古い楽譜が出てきた。'], give: 'music_score', set: 'got_score' },
        { if: { flag: 'tower_running' }, say: ['柱時計は正しく時を刻んでいる。', 'チク、タク……館が息を吹き返したようだ。'] },
        { say: ['古い柱時計。針は「11時50分」で止まっている。', '振り子も動かない。……時計塔と連動しているらしい。'] } ] },
      { id: 'counter', x: 17, y: 12, w: 5, h: 2, acts: [
        { if: { noflag: 'got_guest_key' }, say: ['受付カウンター。呼び鈴を鳴らしても誰も来ない。', '引き出しに鍵束が残されていた。'], give: 'guest_key', set: 'got_guest_key' },
        { say: ['宿帳が開いたままになっている。', '最後の記帳は十年前の今日——客は五人。'] } ] },
      { id: 'hall_lord', x: 16, y: 1, w: 2, acts: [
        { if: { flag: 'truth_known' }, say: ['エルディア卿の肖像。', 'その目は、もう悲しんではいないように見えた。'] },
        { say: ['館の主、ヴィクトル・エルディア卿の肖像画。', '鋭い眼差しが、玄関ホールを見下ろしている。'] } ] },
      { id: 'hall_land', x: 8, y: 1, w: 2, acts: [{ say: ['霧に包まれた館の風景画。', '描かれた時計塔の針も、11時50分を指している。'] }] },
      { id: 'hall_win', x: 5, y: 1, w: 2, acts: [
        { if: { flag: 'truth_known' }, say: ['霧が晴れ、東の空が白み始めている。'] },
        { say: ['窓の外は深い霧。月だけがやけに明るい。'] } ] },
      { id: 'hall_armor', x: 1, y: 6, acts: [{ say: ['磨き上げられた甲冑。胸に館の紋章——星・月・太陽。'] }] },
    ],
  });

  room({
    id: 'hall_2f', name: '2F 回廊', area: 'entrance', level: '2F', map: [42, 24, 16, 7],
    W: 26, H: 11, ground: 'parquet', wall: paper(P.red), amb: [62, 56, 92],
    rugs: [{ x: 1, y: 3, w: 24, h: 3, c: [120, 24, 32] }],
    voids: [{ x: 7, y: 7, w: 12, h: 3 }],
    exits: [
      { id: 'dn_l', side: 'D', x: 2, y: 7, w: 3, h: 2, spawn: [3, 6], to: 'hall:up_l' },
      { id: 'dn_r', side: 'D', x: 21, y: 7, w: 3, h: 2, spawn: [22, 6], to: 'hall:up_r' },
      { id: 'w', side: 'W', at: 4, w: 2, to: 'west_corridor_2f:e' },
      { id: 'e', side: 'E', at: 4, w: 2, to: 'east_corridor_2f:w' },
    ],
    furn: [
      { t: 'painting', x: 3, y: 0, w: 2, v: 'lady' }, { t: 'painting', x: 8, y: 0, w: 2, v: 'land2' },
      { t: 'painting', x: 12, y: 0, w: 2, v: 'family' }, { t: 'painting', x: 16, y: 0, w: 2, v: 'sea' },
      { t: 'painting', x: 21, y: 0, w: 2, v: 'lord' },
      { t: 'wlamp', x: 6, y: 0 }, { t: 'wlamp', x: 19, y: 0 },
      { t: 'plant', x: 1, y: 2 }, { t: 'plant', x: 24, y: 2 },
      { t: 'railing', x: 7, y: 6, w: 12 },
      { t: 'chandelier', x: 12, y: 8, w: 2, top: 1 },
    ],
    ins: [
      { id: 'h2_family', x: 12, y: 1, w: 2, acts: [
        { if: { flag: 'truth_known' }, say: ['エルディア卿と娘エマの肖像。', '絵の中の少女が、少しだけ笑ったように見えた。'] },
        { say: ['エルディア卿と、幼い少女の肖像画。', '額縁のプレートに「愛する娘 エマ」とある。'] } ] },
      { id: 'h2_rail', x: 7, y: 6, w: 12, acts: [{ say: ['手すりの向こうに、玄関ホールの大シャンデリアが揺れている。'] }] },
      { id: 'h2_lady', x: 3, y: 1, w: 2, acts: [{ say: ['ドレスの婦人の肖像。エルディア夫人だろうか。', 'プレートには「1847—1879」。'] }] },
    ],
  });

  /* ================= ② 東館 ================= */
  room({
    id: 'east_corridor', name: '東館 1F廊下', area: 'east', level: '1F', map: [58, 26, 30, 5],
    W: 30, H: 8, ground: 'plank', wall: paper(P.green), amb: [56, 60, 78],
    rugs: [{ x: 1, y: 4, w: 28, h: 2, c: [40, 84, 56] }],
    exits: [
      { id: 'w', side: 'W', at: 4, w: 2, to: 'hall:e' },
      { id: 'n_din', side: 'N', at: 3, to: 'dining:s' },
      { id: 'n_kit', side: 'N', at: 9, to: 'kitchen:s' },
      { id: 'n_bath', side: 'N', at: 15, to: 'bath:s' },
      { id: 'n_stor', side: 'N', at: 21, to: 'storage:s' },
      { id: 'up', side: 'U', x: 25, y: 2, w: 3, h: 2, spawn: [26, 4], to: 'east_corridor_2f:dn' },
      { id: 's_serv', side: 'S', at: 6, to: 'servants:n' },
      { id: 's_staff', side: 'S', at: 18, kind: 'metal', to: 'staff_passage:n',
        lock: { item: 'staff_card', msg: ['「職員専用」と刻まれた鉄扉。', 'カードリーダーが赤く点滅している。'] } },
    ],
    furn: [
      { t: 'window', x: 5, y: 0 }, { t: 'wlamp', x: 7, y: 0 }, { t: 'window', x: 11, y: 0 },
      { t: 'wlamp', x: 13, y: 0 }, { t: 'window', x: 17, y: 0 }, { t: 'wlamp', x: 19, y: 0 },
      { t: 'painting', x: 23, y: 0, v: 'still' },
      { t: 'vase', x: 1, y: 2 }, { t: 'plant', x: 12, y: 6 }, { t: 'plant', x: 24, y: 6 }, { t: 'armor', x: 28, y: 6 },
    ],
    ins: [
      { id: 'ec_staff_sign', x: 17, y: 6, acts: [{ say: ['床に貼られた案内：「この先 管理区域 / 職員以外立入禁止」'] }] },
      { id: 'ec_armor', x: 28, y: 6, acts: [{ say: ['甲冑の兜の中から、カチ、カチ……と音がする。', '中には止まった懐中時計が入っていた。11時50分。'] }] },
    ],
  });

  room({
    id: 'dining', name: '食堂', area: 'east', level: '1F', map: [58, 16, 9, 10],
    W: 18, H: 12, ground: 'parquet', groundC: [110, 66, 40], wall: paper(P.rose), amb: [74, 58, 72],
    rugs: [{ x: 3, y: 4, w: 12, h: 5, c: [96, 26, 36] }],
    exits: [
      { id: 's', side: 'S', at: 9, to: 'east_corridor:n_din' },
      { id: 'e', side: 'E', at: 6, to: 'kitchen:w' },
    ],
    furn: [
      { t: 'window', x: 3, y: 0 }, { t: 'window', x: 14, y: 0 },
      { t: 'painting', x: 5, y: 0, v: 'still' }, { t: 'painting', x: 12, y: 0, v: 'land' },
      { t: 'fireplace', x: 8, y: 0, w: 2 },
      { t: 'cupboard', x: 1, y: 2, w: 2 }, { t: 'cupboard', x: 15, y: 2, w: 2 },
      { t: 'longtable', x: 4, y: 5, w: 10, h: 2 },
      { t: 'chair', x: 5, y: 4, d: 'down' }, { t: 'chair', x: 7, y: 4, d: 'down' }, { t: 'chair', x: 10, y: 4, d: 'down' }, { t: 'chair', x: 12, y: 4, d: 'down' },
      { t: 'chair', x: 5, y: 7, d: 'up' }, { t: 'chair', x: 7, y: 7, d: 'up' }, { t: 'chair', x: 10, y: 7, d: 'up' }, { t: 'chair', x: 12, y: 7, d: 'up' },
      { t: 'chair', x: 3, y: 5, d: 'right' }, { t: 'chair', x: 14, y: 5, d: 'left' },
      { t: 'plant', x: 1, y: 10 }, { t: 'plant', x: 16, y: 10 },
      { t: 'chandelier', x: 8, y: 5, w: 2 },
    ],
    ins: [
      { id: 'din_table', x: 4, y: 5, w: 10, h: 2, acts: [{ say: ['食卓には六人分の食器。料理は手付かずのまま、湯気を立てている。', '……十年前の晩餐のはずなのに。'] }] },
      { id: 'din_fire', x: 8, y: 1, w: 2, acts: [
        { if: { noflag: 'got_burnt_photo' }, say: ['火の気のない暖炉。灰受けを引き出すと、奥に何か引っかかっている。', '燃え残った写真だ。'], give: 'burnt_photo', set: 'got_burnt_photo', sfx: 'drawer' },
        { say: ['灰受けはもう空だ。'] } ] },
      { id: 'din_cup', x: 1, y: 2, w: 2, acts: [{ say: ['銀食器が整然と並ぶ。一本だけ、ナイフが欠けている。'] }] },
    ],
  });

  room({
    id: 'kitchen', name: 'キッチン', area: 'east', level: '1F', map: [67, 17, 8, 9],
    W: 16, H: 12, ground: 'checker', wall: { s: 'tile', c: [196, 204, 196] }, amb: [78, 74, 76],
    exits: [
      { id: 'w', side: 'W', at: 6, to: 'dining:e' },
      { id: 's', side: 'S', at: 6, to: 'east_corridor:n_kit' },
      { id: 'down', side: 'D', x: 12, y: 8, w: 2, h: 2, spawn: [12, 7], to: 'b1_storage:up',
        lock: { item: 'cellar_key', msg: ['床下へ続く階段。鉄格子に南京錠がかかっている。'] } },
    ],
    furn: [
      { t: 'stove', x: 2, y: 2, w: 2 }, { t: 'sink', x: 5, y: 2 }, { t: 'shelf', x: 7, y: 2, w: 2 },
      { t: 'pots', x: 10, y: 0, w: 3 }, { t: 'window', x: 13, y: 0 },
      { t: 'worktable', x: 5, y: 6, w: 4, h: 2 },
      { t: 'barrel', x: 14, y: 2 }, { t: 'barrel', x: 13, y: 2 }, { t: 'sack', x: 1, y: 9 }, { t: 'sack', x: 1, y: 10 },
      { t: 'crate', x: 14, y: 10 },
    ],
    ins: [
      { id: 'kit_stove', x: 2, y: 2, w: 2, acts: [{ say: ['かまどの鍋。スープがまだ温かい。', '……誰が火を入れたのだろう。'] }] },
      { id: 'kit_table', x: 5, y: 6, w: 4, h: 2, acts: [{ say: ['まな板の上に切りかけの野菜。少しも萎れていない。', 'この館では、物が古びないらしい。'] }] },
      { id: 'kit_shelf', x: 7, y: 2, w: 2, acts: [{ say: ['香辛料の瓶。ラベルの日付は全て十年前。'] }] },
    ],
  });

  room({
    id: 'bath', name: '浴室', area: 'east', level: '1F', map: [75, 19, 6, 7],
    W: 12, H: 10, ground: 'tile', wall: { s: 'tile', c: [176, 198, 206] }, amb: [72, 84, 100],
    rugs: [{ x: 5, y: 7, w: 2, h: 1, c: [60, 100, 120] }],
    exits: [{ id: 's', side: 'S', at: 6, to: 'east_corridor:n_bath' }],
    furn: [
      { t: 'tub', x: 2, y: 3, w: 3, h: 2 }, { t: 'mirror', x: 8, y: 0 }, { t: 'basin', x: 8, y: 2 },
      { t: 'window', x: 4, y: 0 }, { t: 'shelf', x: 10, y: 2 }, { t: 'plant', x: 1, y: 8 }, { t: 'candle', x: 10, y: 7 },
    ],
    ins: [
      { id: 'bath_mirror', x: 8, y: 1, h: 2, acts: [
        { if: { flag: 'tower_running' }, say: ['湯気で曇った鏡に、指で書かれた文字が浮かぶ。', '『本は七つ目。時は譜に宿る』'] },
        { say: ['曇った鏡。……一瞬、少女の姿が映った気がした。'] } ] },
      { id: 'bath_tub', x: 2, y: 3, w: 3, h: 2, acts: [{ say: ['湯船にはお湯が張られ、湯気が立っている。'] }] },
    ],
  });

  room({
    id: 'storage', name: '倉庫', area: 'east', level: '1F', map: [81, 19, 7, 7],
    W: 14, H: 10, ground: 'plank', groundC: [96, 74, 52], wall: { s: 'wood' }, amb: [48, 44, 52],
    exits: [
      { id: 's', side: 'S', at: 4, to: 'east_corridor:n_stor' },
      { id: 'e_hid', side: 'E', at: 5, hidden: 'found_hidden_storage', to: 'hidden_storage:w' },
    ],
    furn: [
      { t: 'crate', x: 1, y: 2 }, { t: 'crate', x: 2, y: 2 }, { t: 'crate', x: 1, y: 3 },
      { t: 'barrel', x: 6, y: 2 }, { t: 'barrel', x: 7, y: 2 },
      { t: 'shelf', x: 8, y: 2, w: 3 }, { t: 'shelf', x: 5, y: 6, w: 3 },
      { t: 'sack', x: 1, y: 7 }, { t: 'sack', x: 2, y: 8 }, { t: 'wlamp', x: 4, y: 0 },
      { t: 'shelfv', x: 12, y: 4, h: 3, hideIf: 'found_hidden_storage' },
      { t: 'shelfv', x: 12, y: 2, h: 1, showIf: 'found_hidden_storage' },
      { t: 'crate', x: 12, y: 8, showIf: 'found_hidden_storage' },
    ],
    ins: [
      { id: 'stor_shelf', x: 12, y: 4, h: 3, hideIf: 'found_hidden_storage', acts: [
        { if: { using: 'blueprint' }, say: ['設計図の×印を確かめる。「可動棚・左下の留め具を外す」。', '棚の左下に錆びた留め具があった。外して押すと、棚が横へ滑った。', '——隠された扉だ！'], set: 'found_hidden_storage', sfx: 'secret' },
        { say: ['古い棚。……棚の後ろから冷たい風が吹いている。', '押しても引いてもびくともしない。どこかに留め具があるはずだ。', '館の図面があれば分かるかもしれない。'], set: 'stor_hint' } ] },
      { id: 'stor_crate', x: 1, y: 2, w: 2, acts: [{ say: ['木箱には「1837」と焼き印。中身は古い燭台だ。'] }] },
    ],
  });

  room({
    id: 'hidden_storage', name: '隠し収納庫', area: 'east', level: '1F', map: [88, 20, 5, 5], secret: true,
    W: 8, H: 8, ground: 'stone', wall: { s: 'stone' }, amb: [30, 28, 36],
    exits: [{ id: 'w', side: 'W', at: 5, to: 'storage:e_hid' }],
    furn: [
      { t: 'chest', x: 3, y: 3, openIf: 'got_gear' }, { t: 'candle', x: 6, y: 2 },
      { t: 'crate', x: 1, y: 2 }, { t: 'crate', x: 6, y: 5 }, { t: 'cobweb', x: 1, y: 0, w: 2 },
    ],
    ins: [
      { id: 'hid_chest', x: 3, y: 3, acts: [
        { if: { noflag: 'got_gear' }, say: ['埃をかぶった木箱。蓋を開ける。', '真鍮の大きな歯車と、布にくるまれた絵の破片が収められていた。'], give: ['gear', 'portrait_shard'], set: 'got_gear', sfx: 'drawer' },
        { say: ['からっぽだ。'] } ] },
      { id: 'hid_crate', x: 6, y: 5, acts: [{ say: ['使用人の日記が挟まっている。', '「旦那様は塔の歯車を外して隠せと仰った。時を止めるのだと……」'] }] },
    ],
  });

  room({
    id: 'servants', name: '使用人の部屋', area: 'east', level: '1F', map: [60, 32, 8, 7],
    W: 14, H: 10, ground: 'plank', wall: paper([74, 68, 56]), amb: [56, 52, 62],
    exits: [{ id: 'n', side: 'N', at: 7, to: 'east_corridor:s_serv' }],
    furn: [
      { t: 'bunk', x: 1, y: 2 }, { t: 'bunk', x: 3, y: 2 },
      { t: 'locker', x: 9, y: 2 }, { t: 'locker', x: 10, y: 2 }, { t: 'locker', x: 11, y: 2 },
      { t: 'table', x: 5, y: 6, w: 3 }, { t: 'stool', x: 5, y: 7 }, { t: 'stool', x: 7, y: 7 }, { t: 'candle', x: 12, y: 7 },
      { t: 'window', x: 5, y: 0 }, { t: 'basin', x: 12, y: 5 },
    ],
    ins: [
      { id: 'serv_locker', x: 9, y: 2, w: 3, acts: [{ say: ['ロッカーに走り書きのメモ。', '「職員カードは時計塔の中に置いてきた。旦那様に見つからぬように」'] }] },
      { id: 'serv_bunk', x: 1, y: 2, w: 3, h: 2, acts: [{ say: ['シーツが乱れている。慌てて飛び出したようだ。'] }] },
      { id: 'serv_table', x: 5, y: 6, w: 3, acts: [{ say: ['トランプが配られたまま。勝負は永遠につかない。'] }] },
    ],
  });

  /* 客室（2F東）を生成 */
  const guest = (n, col, rugC, door, extra) => {
    const name = '客室' + n;
    const dN = door === 'N';
    const o = {
      id: 'guest' + n, name, area: 'east', level: '2F', W: 12, H: 10, ground: 'parquet',
      wall: paper(col), amb: [56, 56, 82], rugs: [{ x: 3, y: 5, w: 6, h: 3, c: rugC }],
      exits: [{ id: dN ? 'n' : 's', side: dN ? 'N' : 'S', at: 6, to: 'east_corridor_2f:' + (dN ? 's_g' : 'n_g') + n }],
      furn: [
        { t: 'bed', x: 2, y: 2, w: 2, h: 3, c: rugC }, { t: 'nightstand', x: 4, y: 2 },
        { t: 'wardrobe', x: 8, y: 2, w: 2 }, { t: 'window', x: dN ? 3 : 5, y: 0, w: 1 },
        { t: 'desk', x: 8, y: 6, w: 2 }, { t: 'chair', x: 9, y: 7, d: 'up' }, { t: 'plant', x: 1, y: 8 },
        { t: 'painting', x: 10, y: 0, v: ['land', 'sea', 'lady', 'still', 'land2'][n - 1] },
      ],
      ins: [{ id: 'g' + n + '_bed', x: 2, y: 2, w: 2, h: 3, acts: [{ say: ['きちんと整えられたベッド。誰かが眠った形跡はない。'] }] }],
    };
    extra(o);
    room(o);
  };
  guest(1, P.blue, [50, 70, 120], 'S', (o) => {
    o.map = [58, 16, 7, 8];
    o.ins.push({ id: 'g1_desk', x: 8, y: 6, w: 2, acts: [{ say: ['机の上の招待状。', '「時を越えた晩餐へ、あなたを招待する——V.エルディア」', '……宛名は「{name} 様」。自分の名前だった。'] }] });
  });
  guest(2, P.green, [60, 100, 70], 'S', (o) => {
    o.map = [65, 16, 7, 8];
    o.furn.push({ t: 'trunk', x: 5, y: 2 });
    o.ins.push({ id: 'g2_trunk', x: 5, y: 2, acts: [{ say: ['旅行鞄に古い新聞。', '「エルディア館の客、全員失踪。館は一夜にして沈黙」'] }] });
  });
  guest(3, P.rose, [130, 60, 70], 'S', (o) => {
    o.map = [72, 16, 7, 8];
    o.ins.push({ id: 'g3_ward', x: 8, y: 2, w: 2, acts: [
      { if: { noflag: 'got_study_key' }, say: ['衣装箪笥の奥、コートのポケットに鍵が入っていた。'], give: 'study_key', set: 'got_study_key' },
      { say: ['上等なコートが掛かっている。持ち主は戻らない。'] } ] });
  });
  guest(4, P.purple, [90, 60, 110], 'S', (o) => {
    o.map = [79, 16, 7, 8];
    o.furn.push({ t: 'mirror', x: 6, y: 0, broken: 1 });
    o.ins.push({ id: 'g4_mirror', x: 6, y: 1, acts: [{ say: ['割れた鏡。破片に映る自分の顔が、少しずつ違って見える。'] }] });
  });
  guest(5, P.teal, [50, 110, 110], 'N', (o) => {
    o.map = [66, 31, 7, 8];
    o.furn.push({ t: 'dollhouse', x: 5, y: 8 });
    o.ins.push({ id: 'g5_desk', x: 8, y: 6, w: 2, acts: [
      { if: { flag: 'truth_known' }, say: ['日記の最後のページに、新しい一行が増えていた。', '「おはよう」'] },
      { say: ['子どもの字の日記。', '「お父さまは、わたしの時間を止めるっていった。こわい。」'] } ] });
    o.ins.push({ id: 'g5_doll', x: 5, y: 8, acts: [{ say: ['精巧なドールハウス。この館の模型だ。', '地下の、さらに下にも部屋が作られている。'] }] });
  });

  room({
    id: 'east_corridor_2f', name: '東館 2F廊下', area: 'east', level: '2F', map: [58, 24, 30, 5],
    W: 30, H: 8, ground: 'parquet', wall: paper([40, 64, 48]), amb: [56, 58, 84],
    rugs: [{ x: 1, y: 4, w: 28, h: 2, c: [44, 90, 60] }],
    exits: [
      { id: 'w', side: 'W', at: 4, w: 2, to: 'hall_2f:e' },
      { id: 'n_g1', side: 'N', at: 4, to: 'guest1:s', lock: { item: 'guest_key', msg: ['「客室1」。鍵がかかっている。'] } },
      { id: 'n_g2', side: 'N', at: 10, to: 'guest2:s', lock: { item: 'guest_key', msg: ['「客室2」。鍵がかかっている。'] } },
      { id: 'n_g3', side: 'N', at: 16, to: 'guest3:s', lock: { item: 'guest_key', msg: ['「客室3」。鍵がかかっている。'] } },
      { id: 'n_g4', side: 'N', at: 22, to: 'guest4:s', lock: { item: 'guest_key', msg: ['「客室4」。鍵がかかっている。'] } },
      { id: 's_g5', side: 'S', at: 12, to: 'guest5:n', lock: { item: 'guest_key', msg: ['「客室5」。小さな花の飾りがかかっている。鍵がかかっている。'] } },
      { id: 'dn', side: 'D', x: 26, y: 2, w: 3, h: 2, spawn: [27, 4], to: 'east_corridor:up' },
    ],
    furn: [
      { t: 'wlamp', x: 2, y: 0 }, { t: 'window', x: 7, y: 0 }, { t: 'painting', x: 13, y: 0, v: 'sea' },
      { t: 'window', x: 19, y: 0 }, { t: 'wlamp', x: 24, y: 0 },
      { t: 'plant', x: 1, y: 6 }, { t: 'vase', x: 15, y: 6 }, { t: 'bench', x: 20, y: 6, w: 2 },
    ],
    ins: [{ id: 'ec2_vase', x: 15, y: 6, acts: [{ say: ['花瓶の薔薇は、摘みたてのように瑞々しい。'] }] }],
  });

  /* ================= ③ 西館 ================= */
  room({
    id: 'west_corridor', name: '西館 1F廊下', area: 'west', level: '1F', map: [12, 26, 30, 5],
    W: 30, H: 8, ground: 'parquet', groundC: [120, 84, 52], wall: paper(P.blue), amb: [56, 58, 86],
    rugs: [{ x: 1, y: 4, w: 28, h: 2, c: [40, 60, 120] }],
    exits: [
      { id: 'e', side: 'E', at: 4, w: 2, to: 'hall:w' },
      { id: 'n_lib', side: 'N', at: 5, w: 2, to: 'library:s' },
      { id: 'n_study', side: 'N', at: 13, to: 'study:s', lock: { item: 'study_key', msg: ['「書斎」。重い樫の扉に鍵がかかっている。'] } },
      { id: 'n_arch', side: 'N', at: 21, to: 'archive:s', lock: { item: 'archive_key', msg: ['「資料保管室 Ⅲ」。施錠されている。'] } },
      { id: 's_parlor', side: 'S', at: 9, to: 'parlor:n' },
    ],
    furn: [
      { t: 'wlamp', x: 3, y: 0 }, { t: 'window', x: 8, y: 0, w: 2 }, { t: 'wlamp', x: 11, y: 0 },
      { t: 'painting', x: 16, y: 0, w: 2, v: 'land2' }, { t: 'wlamp', x: 19, y: 0 },
      { t: 'window', x: 24, y: 0, w: 2 }, { t: 'wlamp', x: 27, y: 0 },
      { t: 'statue', x: 1, y: 2 }, { t: 'plant', x: 28, y: 2 }, { t: 'bench', x: 14, y: 6, w: 2 }, { t: 'gclock', x: 1, y: 6 },
    ],
    ins: [{ id: 'wc_clock', x: 1, y: 6, acts: [
      { if: { flag: 'tower_running' }, say: ['小さな柱時計も動き出している。'] },
      { say: ['小さな柱時計。これも11時50分で止まっている。'] } ] }],
  });

  room({
    id: 'library', name: '大図書館', area: 'west', level: '1F', map: [14, 12, 13, 14],
    W: 24, H: 16, ground: 'parquet', groundC: [92, 60, 38], wall: paper([58, 42, 30]), amb: [58, 50, 62],
    rugs: [{ x: 8, y: 5, w: 8, h: 6, c: [44, 58, 110] }],
    exits: [
      { id: 's', side: 'S', at: 11, w: 2, to: 'west_corridor:n_lib' },
      { id: 'up', side: 'U', x: 20, y: 2, w: 3, h: 2, spawn: [21, 4], to: 'west_corridor_2f:dn' },
      { id: 'n_secret', side: 'N', at: 4, hidden: 'found_stacks', to: 'secret_stacks:s' },
      { id: 'e_study', side: 'E', at: 9, hidden: 'found_study_passage', to: 'study:w' },
    ],
    furn: [
      { t: 'wallshelf', x: 1, y: 0, w: 3 }, { t: 'wallshelf', x: 4, y: 0, w: 1, hideIf: 'found_stacks', odd: 1 },
      { t: 'wallshelf', x: 5, y: 0, w: 14 }, { t: 'wlamp', x: 19, y: 0 },
      { t: 'bookshelf', x: 2, y: 6, w: 6 }, { t: 'bookshelf', x: 2, y: 10, w: 6 },
      { t: 'bookshelf', x: 15, y: 6, w: 6 }, { t: 'bookshelf', x: 15, y: 10, w: 6 },
      { t: 'readtable', x: 10, y: 7, w: 4, h: 2 }, { t: 'chair', x: 9, y: 7, d: 'right' }, { t: 'chair', x: 14, y: 8, d: 'left' },
      { t: 'globe', x: 8, y: 13 }, { t: 'armchair', x: 15, y: 13 }, { t: 'lamp', x: 16, y: 13 },
      { t: 'plant', x: 1, y: 14 }, { t: 'ladder', x: 22, y: 6 }, { t: 'candle', x: 22, y: 13 },
      { t: 'chandelier', x: 11, y: 7, w: 2 },
    ],
    ins: [
      { id: 'lib_hidden', x: 4, y: 1, hideIf: 'found_stacks', acts: [
        { if: { flag: 'read_study_note' }, say: ['『エルディア年代記』……第七巻だけ、背表紙の色が違う。', '本を引くと、カチリと音がした。', '本棚が横へ滑り、隠し書庫への入口が現れた！'], set: 'found_stacks', sfx: 'secret' },
        { say: ['『エルディア年代記』全十二巻。', '……第七巻だけ、背表紙の色が違う気がする。'] } ] },
      { id: 'lib_table', x: 10, y: 7, w: 4, h: 2, acts: [{ say: ['開かれた本：『時間結晶と生体保存について』', '余白に館長の筆跡。「あと少しで、あの子を救える」'] }] },
      { id: 'lib_shelf1', x: 2, y: 6, w: 6, acts: [{ say: ['天文学の棚。星図に三つの印——星、月、太陽。'] }] },
      { id: 'lib_shelf2', x: 15, y: 10, w: 6, acts: [{ say: ['医学書がずらりと並ぶ。どれも「不治の病」の項に栞が挟まっている。'] }] },
      { id: 'lib_globe', x: 8, y: 13, acts: [{ say: ['古い地球儀。館のある場所に、小さな針が刺してある。'] }] },
    ],
  });

  room({
    id: 'study', name: '書斎', area: 'west', level: '1F', map: [28, 16, 8, 10],
    W: 14, H: 10, ground: 'carpet', groundC: [92, 30, 34], wall: { s: 'wood' }, amb: [64, 52, 56],
    exits: [
      { id: 's', side: 'S', at: 7, to: 'west_corridor:n_study' },
      { id: 'w', side: 'W', at: 5, hidden: 'found_study_passage', to: 'library:e_study' },
    ],
    furn: [
      { t: 'wallshelf', x: 1, y: 0, w: 3 }, { t: 'window', x: 5, y: 0, w: 2 }, { t: 'fireplace', x: 9, y: 0, w: 2, cold: 1 },
      { t: 'desk', x: 5, y: 4, w: 3, lamp: 1 }, { t: 'chair', x: 6, y: 3, d: 'down' },
      { t: 'safe', x: 12, y: 2 }, { t: 'armchair', x: 10, y: 6 }, { t: 'armchair', x: 12, y: 6 },
      { t: 'globe', x: 1, y: 7 }, { t: 'plant', x: 12, y: 8 },
    ],
    ins: [
      { id: 'study_desk', x: 5, y: 4, w: 3, acts: [
        { if: { noflag: 'got_tower_key' }, say: ['重厚な執務机。引き出しに鍵と書き付けが入っていた。', '書き付け：「年代記の第七巻——わが研究の入口」'], give: 'tower_key', set: ['got_tower_key', 'read_study_note'] },
        { say: ['机の上の写真立て。少女が微笑んでいる。', '裏に「エマ 12歳」。'] } ] },
      { id: 'study_safe', x: 12, y: 2, acts: [
        { if: { flag: 'know_safe_code', noflag: 'got_archive_key' }, say: ['ダイヤルを「1・8・4・7」に合わせる……', 'カチリ。開いた！ 中に資料保管室の鍵。'], give: 'archive_key', set: 'got_archive_key', sfx: 'secret' },
        { if: { noflag: 'got_archive_key' }, say: ['四桁のダイヤル式金庫。番号がわからない。', '館に関係のある数字だろうか。'] },
        { say: ['空の金庫。'] } ] },
      { id: 'study_fire', x: 9, y: 1, w: 2, acts: [
        { if: { noflag: 'found_study_passage' }, say: ['火の消えた暖炉。奥の煉瓦が一つだけ浮いている。', '押し込むと……西の壁が音を立てて開いた！', '図書館へ通じる抜け道のようだ。'], set: 'found_study_passage', sfx: 'secret' },
        { say: ['暖炉の奥のレバーで、図書館への抜け道が開いている。'] } ] },
    ],
  });

  room({
    id: 'archive', name: '資料保管室', area: 'west', level: '1F', map: [36, 18, 6, 8],
    W: 14, H: 10, ground: 'plank', groundC: [84, 70, 58], wall: paper(P.gray), amb: [48, 48, 58],
    exits: [{ id: 's', side: 'S', at: 7, to: 'west_corridor:n_arch' }],
    furn: [
      { t: 'cabinet', x: 2, y: 3, w: 4 }, { t: 'cabinet', x: 8, y: 3, w: 4 },
      { t: 'cabinet', x: 2, y: 6, w: 4 }, { t: 'cabinet', x: 8, y: 6, w: 4 },
      { t: 'wlamp', x: 4, y: 0 }, { t: 'wlamp', x: 10, y: 0 }, { t: 'crate', x: 12, y: 8 }, { t: 'crate', x: 1, y: 8 },
    ],
    ins: [
      { id: 'arch_cab', x: 8, y: 6, w: 4, acts: [
        { if: { noflag: 'got_cellar_key' }, say: ['「地下研究施設」と書かれたファイル。', '間に古びた鍵が挟まっていた。'], give: 'cellar_key', set: 'got_cellar_key' },
        { say: ['研究費の帳簿。莫大な金額が「地下」へ流れている。'] } ] },
      { id: 'arch_cab2', x: 2, y: 3, w: 4, acts: [
        { if: { noflag: 'got_record' }, say: ['「11月14日」と背に書かれた綴りがある。', '10年前のその夜の記録だ。'], give: 'incident_record', set: 'got_record', sfx: 'paper' },
        { say: ['招待客の名簿。五人の名前。六人目の欄は空白だ。'] } ] },
      { id: 'arch_case', x: 2, y: 6, w: 4, acts: [
        { if: { noflag: 'got_blueprint' }, say: ['「建築資料」と札の付いた引き出し。', '丸められた図面が入っている。館の改修図だ。'], give: 'blueprint', set: 'got_blueprint', sfx: 'paper' },
        { say: ['改修時の見積書が残っている。'] } ] },
    ],
  });

  room({
    id: 'parlor', name: '応接室', area: 'west', level: '1F', map: [18, 32, 9, 7],
    W: 16, H: 11, ground: 'parquet', wall: paper(P.teal), amb: [60, 64, 84],
    rugs: [{ x: 3, y: 4, w: 9, h: 5, c: [70, 40, 90] }],
    exits: [{ id: 'n', side: 'N', at: 8, to: 'west_corridor:s_parlor' }],
    furn: [
      { t: 'fireplace', x: 3, y: 0, w: 2 }, { t: 'window', x: 11, y: 0, w: 2 }, { t: 'painting', x: 13, y: 0, w: 2, v: 'lady' },
      { t: 'sofa', x: 5, y: 7, w: 4, d: 'up' }, { t: 'armchair', x: 4, y: 5, d: 'right' }, { t: 'armchair', x: 10, y: 5, d: 'left' },
      { t: 'teatable', x: 6, y: 5, w: 3 }, { t: 'plant', x: 1, y: 2 }, { t: 'plant', x: 14, y: 2 },
      { t: 'lamp', x: 14, y: 8 }, { t: 'cupboard', x: 12, y: 2, w: 2 }, { t: 'gramophone', x: 1, y: 8 },
    ],
    ins: [
      { id: 'par_table', x: 6, y: 5, w: 3, acts: [{ say: ['ティーセット。紅茶はまだ湯気を立てている。', 'カップは六つ。一つだけ、子ども用の小さなもの。'] }] },
      { id: 'par_gramo', x: 1, y: 8, acts: [{ say: ['蓄音機。針を落とすと、ワルツが流れ……', '同じ小節を何度も何度も繰り返す。'] }] },
      { id: 'par_cup', x: 12, y: 2, w: 2, acts: [{ say: ['飾り棚に、星・月・太陽の紋章を象ったメダル。', '「三つ揃いし時、扉は開く」と刻まれている。'] }] },
    ],
  });

  room({
    id: 'secret_stacks', name: '秘密の書庫', area: 'west', level: '1F', map: [6, 14, 7, 8], secret: true,
    W: 12, H: 10, ground: 'stone', wall: { s: 'stone' }, amb: [40, 28, 50],
    exits: [
      { id: 's', side: 'S', at: 4, to: 'library:n_secret' },
      { id: 'up', side: 'U', x: 9, y: 2, w: 2, h: 2, spawn: [9, 4], to: 'music:dn_secret' },
    ],
    furn: [
      { t: 'wallshelf', x: 1, y: 0, w: 3 }, { t: 'wallshelf', x: 5, y: 0, w: 3 },
      { t: 'lectern', x: 5, y: 5 }, { t: 'candle', x: 3, y: 4 }, { t: 'candle', x: 7, y: 4 },
      { t: 'bookshelf', x: 1, y: 7, w: 2 }, { t: 'chest', x: 9, y: 7 }, { t: 'cobweb', x: 8, y: 0 },
    ],
    ins: [
      { id: 'ss_lectern', x: 5, y: 5, acts: [
        { if: { noflag: 'got_star' }, say: ['禁書が開かれている。『時の心臓——永遠を造る機械』', 'ページの間に、星形の紋章が挟まっていた。'], give: 'star_emblem', set: 'got_star', sfx: 'chime' },
        { say: ['「人の時を止めることは、魂を檻に閉じ込めることに等しい」'] } ] },
      { id: 'ss_chest', x: 9, y: 7, acts: [{ say: ['鍵の壊れた箱。中には子どもの描いた絵。', '館の地下で、光る石が眠っている絵だ。'] }] },
    ],
  });

  room({
    id: 'west_corridor_2f', name: '西館 2F廊下', area: 'west', level: '2F', map: [14, 24, 28, 5],
    W: 26, H: 8, ground: 'parquet', wall: paper([34, 48, 82]), amb: [54, 56, 88],
    rugs: [{ x: 1, y: 4, w: 24, h: 2, c: [40, 60, 120] }],
    exits: [
      { id: 'e', side: 'E', at: 4, w: 2, to: 'hall_2f:w' },
      { id: 'n_gal', side: 'N', at: 6, w: 2, to: 'gallery:s' },
      { id: 'n_music', side: 'N', at: 16, to: 'music:s' },
      { id: 'dn', side: 'D', x: 1, y: 2, w: 3, h: 2, spawn: [2, 4], to: 'library:up' },
    ],
    furn: [
      { t: 'wlamp', x: 9, y: 0 }, { t: 'window', x: 11, y: 0, w: 2 }, { t: 'painting', x: 19, y: 0, w: 2, v: 'family' },
      { t: 'wlamp', x: 22, y: 0 }, { t: 'statue', x: 24, y: 2 }, { t: 'plant', x: 24, y: 6 }, { t: 'bench', x: 10, y: 6, w: 2 },
    ],
    ins: [{ id: 'wc2_paint', x: 19, y: 1, w: 2, acts: [{ say: ['家族の肖像画。少女の顔の部分だけ、絵の具が新しい。'] }] }],
  });

  room({
    id: 'gallery', name: '絵画展示室', area: 'west', level: '2F', map: [16, 12, 13, 12],
    W: 22, H: 12, ground: 'marble', marbleA: [226, 220, 206], marbleB: [150, 140, 128], wall: paper(P.gold), amb: [66, 64, 82],
    exits: [{ id: 's', side: 'S', at: 10, w: 2, to: 'west_corridor_2f:n_gal' }],
    lights: [{ x: 3, y: 2.2, r: 40, c: [255, 220, 160] }, { x: 9, y: 2.2, r: 40, c: [255, 220, 160] }, { x: 13, y: 2.2, r: 40, c: [255, 220, 160] }, { x: 19, y: 2.2, r: 40, c: [255, 220, 160] }],
    furn: [
      { t: 'painting', x: 2, y: 0, w: 2, v: 'lady' }, { t: 'painting', x: 5, y: 0, w: 2, v: 'sea' },
      { t: 'painting', x: 8, y: 0, w: 2, v: 'family' }, { t: 'painting', x: 12, y: 0, w: 2, v: 'manor' },
      { t: 'painting', x: 15, y: 0, w: 2, v: 'land2' }, { t: 'painting', x: 18, y: 0, w: 2, v: 'girl' },
      { t: 'statue', x: 3, y: 5 }, { t: 'statue', x: 18, y: 5 },
      { t: 'display', x: 8, y: 5, w: 2 }, { t: 'display', x: 12, y: 5, w: 2 },
      { t: 'bench', x: 6, y: 8, w: 3 }, { t: 'bench', x: 13, y: 8, w: 3 },
      { t: 'rope', x: 1, y: 3, w: 20 },
    ],
    ins: [
      { id: 'gal_manor', x: 12, y: 1, w: 2, acts: [
        { if: { flag: 'truth_known' }, say: ['「黄昏の館」——絵の中の窓に、灯がともっている。'] },
        { say: ['「黄昏の館」。この館を描いた油彩画。', '右下に小さく「1847」と書かれている。……創建の年だろうか。'], set: 'know_safe_code' } ] },
      { id: 'gal_girl', x: 18, y: 1, w: 2, acts: [
        { if: { using: 'portrait_shard', noflag: 'portrait_complete' }, say: ['欠けた部分に破片を当てる。ぴたりとはまった。', '少女の目元が戻る。……焼けた写真の少女と、同じ顔だ。'], set: 'portrait_complete', take: 'portrait_shard', sfx: 'success' },
        { if: { flag: 'truth_known' }, say: ['少女の肖像。目元が、どこか安らいで見える。'] },
        { say: ['少女の肖像画。題は「永遠のエマ」。', '……描かれた瞳が、こちらを追ってくる気がする。'] } ] },
      { id: 'gal_disp1', x: 8, y: 5, w: 2, acts: [
        { if: { noflag: 'got_watch', has: 'guest_key' }, say: ['鍵束の小さな鍵が、ケースの鍵穴に合った。', 'ひびの入った懐中時計を取り出した。'], give: 'cracked_watch', set: 'got_watch', sfx: 'unlock' },
        { if: { noflag: 'got_watch' }, say: ['ガラスケースの中に懐中時計。11時50分で止まっている。', 'ケースには小さな鍵穴がある。'] },
        { say: ['空のガラスケース。'] } ] },
      { id: 'gal_disp2', x: 12, y: 5, w: 2, acts: [{ say: ['ケースの中に、小さな靴が片方だけ飾られている。'] }] },
      { id: 'gal_sea', x: 5, y: 1, w: 2, acts: [{ say: ['嵐の海の絵。船の名は「エマ号」。'] }] },
    ],
  });

  room({
    id: 'music', name: '音楽室', area: 'west', level: '2F', map: [30, 14, 9, 10],
    W: 16, H: 12, ground: 'parquet', groundC: [140, 100, 64], wall: paper(P.purple), amb: [62, 52, 88],
    rugs: [{ x: 2, y: 3, w: 6, h: 6, c: [100, 40, 60] }],
    exits: [
      { id: 's', side: 'S', at: 8, to: 'west_corridor_2f:n_music' },
      { id: 'dn_secret', side: 'D', x: 13, y: 2, w: 2, h: 2, spawn: [13, 4], hidden: 'found_music_stairs', to: 'secret_stacks:up' },
    ],
    furn: [
      { t: 'window', x: 6, y: 0, w: 2 }, { t: 'painting', x: 10, y: 0, v: 'girl' }, { t: 'wlamp', x: 2, y: 0 },
      { t: 'piano', x: 3, y: 4, w: 4, h: 3 }, { t: 'bench', x: 4, y: 7, w: 2 },
      { t: 'harp', x: 9, y: 3 }, { t: 'stand', x: 9, y: 6 }, { t: 'stand', x: 11, y: 6 },
      { t: 'chair', x: 9, y: 7, d: 'up' }, { t: 'chair', x: 11, y: 7, d: 'up' },
      { t: 'cupboard', x: 13, y: 2, w: 2, hideIf: 'found_music_stairs' },
      { t: 'cello', x: 12, y: 9 }, { t: 'plant', x: 1, y: 10 },
    ],
    ins: [
      { id: 'mus_piano', x: 3, y: 4, w: 4, h: 3, acts: [
        { if: { has: 'music_score', noflag: 'found_music_stairs' }, event: 'piano', say: ['楽譜を譜面台に置き、鍵盤に指を落とす……', '♪ ——旋律が響くと、部屋の隅の飾り棚が床へ沈み込んだ。', '隠し階段だ！'], set: 'found_music_stairs', sfx: 'secret' },
        { if: { flag: 'found_music_stairs' }, event: 'piano', say: ['あの夜想曲をもう一度奏でた。どこか懐かしい。'] },
        { event: 'plink', say: ['グランドピアノ。調律は完璧だ。', '……何か、弾くべき曲がある気がする。'] } ] },
      { id: 'mus_harp', x: 9, y: 3, acts: [{ say: ['小ぶりのハープ。枠に「エマ」と彫られている。'] }] },
      { id: 'mus_cup', x: 13, y: 2, w: 2, hideIf: 'found_music_stairs', acts: [{ say: ['楽譜棚。一冊分だけ、ぽっかりと隙間が空いている。'] }] },
    ],
  });

  /* ================= ④ 時計塔 ================= */
  room({
    id: 'tower_entrance', name: '時計塔入口', area: 'tower', level: '1F', map: [45, 12, 9, 9],
    W: 12, H: 12, ground: 'stone', wall: { s: 'stone' }, amb: [52, 52, 68],
    exits: [
      { id: 's', side: 'S', at: 5, w: 2, to: 'hall:tower' },
      { id: 'up', side: 'U', x: 8, y: 2, w: 3, h: 2, spawn: [9, 4], to: 'gear_room:dn' },
    ],
    furn: [
      { t: 'plaque', x: 3, y: 0, w: 2 }, { t: 'torch', x: 1, y: 0 }, { t: 'torch', x: 6, y: 0 },
      { t: 'crate', x: 1, y: 8 }, { t: 'barrel', x: 1, y: 9 }, { t: 'weights', x: 9, y: 7 }, { t: 'crate', x: 10, y: 9 },
    ],
    ins: [
      { id: 'te_plaque', x: 3, y: 1, w: 2, acts: [{ say: ['銘板：「時計塔——この館の心臓」', '「1847年 V.エルディア建立」'] }] },
      { id: 'te_crate', x: 1, y: 8, acts: [
        { if: { noflag: 'got_gloves' }, say: ['時計職人の道具箱。', '油の染みた革手袋が入っていた。'], give: 'gloves', set: 'got_gloves', sfx: 'drawer' },
        { say: ['油差しと布切れが残っている。'] } ] },
      { id: 'te_weights', x: 9, y: 7, acts: [{ say: ['天井から下がる巨大な分銅。止まったまま動かない。'] }] },
    ],
  });

  room({
    id: 'gear_room', name: '歯車機構室', area: 'tower', level: 'T', map: [42, 30, 14, 10],
    W: 14, H: 12, ground: 'grate', wall: { s: 'brick' }, amb: [58, 52, 56],
    exits: [
      { id: 'dn', side: 'D', x: 1, y: 2, w: 2, h: 2, spawn: [2, 4], to: 'tower_entrance:up' },
      { id: 'up', side: 'U', x: 11, y: 2, w: 2, h: 2, spawn: [11, 4], to: 'clock_inside:dn',
        lock: { flag: 'tower_running', msg: ['上への階段が、止まった巨大な歯車に塞がれている。', '機構を動かせば通れそうだ。'] } },
    ],
    furn: [
      { t: 'gear', x: 2, y: 6, w: 3, h: 3, spin: 1 }, { t: 'gear', x: 8, y: 6, w: 3, h: 3, spin: -1 },
      { t: 'gear', x: 6, y: 2, w: 2, h: 2, spin: -1.5 }, { t: 'axle', x: 6, y: 7 },
      { t: 'wlamp', x: 4, y: 0 }, { t: 'wlamp', x: 9, y: 0 }, { t: 'pipes', x: 1, y: 0, w: 2 },
      { t: 'crate', x: 12, y: 9 }, { t: 'oilcan', x: 1, y: 10 },
    ],
    ins: [
      { id: 'gear_axle', x: 6, y: 7, acts: [
        { if: { has: 'gear', noflag: ['tower_running', 'gear_ready'] }, say: ['歯車を持ち上げようとしたが、油でぬるりと滑る。', '素手では無理だ。手を守るものがあれば……'], set: 'gear_slip' },
        { if: { has: 'gear', flag: 'gear_ready', noflag: 'tower_running' }, say: ['手袋をはめた手で、空いた軸に真鍮の歯車をはめ込む……', 'ゴウン——！ 塔全体が震え、歯車が回り始めた！', '止まっていた時が、動き出す。'], take: 'gear', set: 'tower_running', sfx: 'rumble' },
        { if: { flag: 'tower_running' }, say: ['歯車が規則正しく回っている。'] },
        { say: ['歯車が一つ抜き取られた軸。', 'ここに何かをはめれば、機構が動きそうだ。'] } ] },
    ],
  });

  room({
    id: 'clock_inside', name: '時計内部', area: 'tower', level: 'T', map: [41, 18, 16, 10],
    W: 14, H: 12, ground: 'plank', groundC: [90, 70, 50], wall: { s: 'brick' }, amb: [62, 62, 88],
    exits: [
      { id: 'dn', side: 'D', x: 1, y: 2, w: 2, h: 2, spawn: [2, 4], to: 'gear_room:up' },
      { id: 'up', side: 'U', x: 11, y: 8, w: 2, h: 2, spawn: [11, 7], to: 'tower_top:dn' },
    ],
    furn: [
      { t: 'clockface', x: 4, y: 0, w: 6 }, { t: 'pendulum', x: 6, y: 4, w: 2, h: 2 },
      { t: 'gear', x: 2, y: 7, w: 2, h: 2, spin: 1.2 }, { t: 'workbench', x: 5, y: 9, w: 3 },
      { t: 'crate', x: 9, y: 9 }, { t: 'wlamp', x: 11, y: 0 },
    ],
    ins: [
      { id: 'ci_bench', x: 5, y: 9, w: 3, acts: [
        { if: { noflag: 'got_card' }, say: ['工具が散らばった作業台。', '油紙に包まれた「職員カード」を見つけた。'], give: 'staff_card', set: 'got_card' },
        { say: ['時計職人の工具。手入れが行き届いている。'] } ] },
      { id: 'ci_face', x: 4, y: 1, w: 6, acts: [{ say: ['巨大な文字盤の裏側。ガラス越しに霧の夜が見える。', '長針がゆっくりと、真夜中を越えていく。'] }] },
      { id: 'ci_pend', x: 6, y: 4, w: 2, h: 2, acts: [{ say: ['巨大な振り子が、大きな音を立てて揺れている。'] }] },
    ],
  });

  room({
    id: 'tower_top', name: '時計塔 最上階', area: 'tower', level: 'T', map: [43, 6, 12, 10],
    W: 12, H: 12, ground: 'stone', wall: { s: 'sky' }, amb: [92, 104, 150],
    exits: [{ id: 'dn', side: 'D', x: 1, y: 9, w: 2, h: 2, spawn: [3, 9], to: 'clock_inside:up' }],
    furn: [{ t: 'bell', x: 5, y: 4, w: 2, h: 2 }, { t: 'telescope', x: 9, y: 3 }, { t: 'crate', x: 10, y: 9 }],
    lights: [{ x: 6, y: 3, r: 70, c: [150, 170, 230] }],
    ins: [
      { id: 'tt_bell', x: 5, y: 4, w: 2, h: 2, acts: [
        { if: { noflag: 'got_moon' }, say: ['大鐘が、時を告げるように低く鳴った——', 'その振動で、鐘の内側の隠し蓋が外れた。', '中から月の紋章が落ちてきた！'], give: 'moon_emblem', set: 'got_moon', sfx: 'bell' },
        { say: ['大鐘が静かに揺れている。'] } ] },
      { id: 'tt_scope', x: 9, y: 3, acts: [{ say: ['望遠鏡を覗く。霧の向こうには……何もない。', '館の外の世界が、存在しないかのようだ。'] }] },
    ],
  });

  /* ================= ⑤ 地下施設 ================= */
  room({
    id: 'b1_storage', name: '地下倉庫', area: 'basement', level: 'B1', map: [18, 20, 10, 9],
    W: 16, H: 12, ground: 'brick', wall: { s: 'stone' }, amb: [44, 38, 40],
    exits: [
      { id: 'up', side: 'U', x: 2, y: 2, w: 2, h: 2, spawn: [2, 4], to: 'kitchen:down' },
      { id: 'e', side: 'E', at: 6, to: 'b1_corridor:w' },
    ],
    furn: [
      { t: 'winerack', x: 5, y: 2, w: 4 }, { t: 'winerack', x: 10, y: 2, w: 4 }, { t: 'wlamp', x: 9, y: 0 },
      { t: 'barrel', x: 2, y: 8 }, { t: 'barrel', x: 3, y: 8 }, { t: 'barrel', x: 2, y: 9 },
      { t: 'crate', x: 12, y: 9 }, { t: 'crate', x: 13, y: 9 }, { t: 'crate', x: 13, y: 8 }, { t: 'sack', x: 7, y: 9 },
    ],
    ins: [
      { id: 'b1s_wine', x: 5, y: 2, w: 4, acts: [{ say: ['ワインの棚。ラベルは全て同じ年、同じ日付。'] }] },
      { id: 'b1s_barrel', x: 2, y: 8, w: 2, acts: [{ say: ['樽の陰に、地下の見取り図の切れ端。', '「研究室／実験室／資料室／管理室——封鎖通路は管理区域へ」'] }] },
    ],
  });

  room({
    id: 'b1_corridor', name: '地下通路', area: 'basement', level: 'B1', map: [28, 22, 28, 5],
    W: 28, H: 8, ground: 'stone', wall: { s: 'stone' }, amb: [38, 40, 46],
    exits: [
      { id: 'w', side: 'W', at: 4, to: 'b1_storage:e' },
      { id: 'n_lab', side: 'N', at: 5, kind: 'metal', to: 'lab:s' },
      { id: 'n_rec', side: 'N', at: 13, kind: 'metal', to: 'b1_records:s' },
      { id: 'n_ctrl', side: 'N', at: 21, kind: 'metal', to: 'control:s' },
      { id: 's_exp', side: 'S', at: 9, kind: 'metal', to: 'experiment:n' },
      { id: 'e', side: 'E', at: 4, kind: 'bars', to: 'sealed_passage:w',
        lock: { flag: 'passage_open', msg: ['鉄格子で封鎖された通路。', '奥から湿った風が吹いてくる。どこかで開閉できるはずだ。'] } },
    ],
    furn: [
      { t: 'pipes', x: 1, y: 0, w: 3 }, { t: 'wlamp', x: 8, y: 0 }, { t: 'pipes', x: 15, y: 0, w: 4 },
      { t: 'wlamp', x: 18, y: 0 }, { t: 'wlamp', x: 24, y: 0 }, { t: 'crate', x: 26, y: 2 }, { t: 'barrel', x: 16, y: 6 },
    ],
    ins: [{ id: 'b1c_sign', x: 26, y: 2, acts: [{ say: ['木箱に貼られた警告：「第二封鎖通路——管理室にて開閉」'] }] }],
  });

  room({
    id: 'lab', name: '研究室', area: 'basement', level: 'B1', map: [30, 12, 9, 10],
    W: 16, H: 12, ground: 'metal', wall: { s: 'metal' }, amb: [48, 58, 64],
    exits: [{ id: 's', side: 'S', at: 7, kind: 'metal', to: 'b1_corridor:n_lab' }],
    furn: [
      { t: 'chalkboard', x: 4, y: 0, w: 4 }, { t: 'shelf', x: 1, y: 2, w: 2, jars: 1 }, { t: 'wlamp', x: 10, y: 0 },
      { t: 'labtable', x: 2, y: 5, w: 4 }, { t: 'labtable', x: 10, y: 5, w: 4 }, { t: 'labtable', x: 2, y: 8, w: 3 },
      { t: 'bookshelf', x: 11, y: 9, w: 3 }, { t: 'tank', x: 14, y: 2 }, { t: 'stool', x: 4, y: 6 }, { t: 'stool', x: 11, y: 6 },
    ],
    ins: [
      { id: 'lab_board', x: 4, y: 1, w: 4, acts: [{ say: ['黒板いっぱいの数式。', '中央に大きく「時間結晶 ＝ 止まった時間の器」'] }] },
      { id: 'lab_t1', x: 2, y: 5, w: 4, acts: [{ say: ['実験ノート。「結晶は時間を吸う。生きものの時間ほどよく吸う」'] }] },
      { id: 'lab_t2', x: 10, y: 5, w: 4, acts: [{ say: ['フラスコの中で、青い光が脈打っている。'] }] },
      { id: 'lab_rec', x: 2, y: 8, w: 3, acts: [
        { if: { noflag: 'got_tape' }, say: ['実験台の上の録音機。リールが掛かったままだ。', 'テープを外して持っていくことにした。'], give: 'old_tape', set: 'got_tape', sfx: 'drawer' },
        { say: ['空の録音機。'] } ] },
      { id: 'lab_shelf', x: 11, y: 9, w: 3, acts: [
        { if: { noflag: 'got_note', has: 'cellar_key' }, say: ['ガラス扉の書庫に南京錠。地下の鍵で開いた。', '黒い革表紙のノートが一冊だけ収められている。'], give: 'research_note', set: 'got_note', sfx: 'unlock' },
        { if: { noflag: 'got_note' }, say: ['施錠された書庫。地下の鍵が合いそうだ。'] },
        { say: ['化学書が並ぶ書庫。'] } ] },
    ],
  });

  room({
    id: 'experiment', name: '実験室', area: 'basement', level: 'B1', map: [34, 27, 9, 9],
    W: 16, H: 12, ground: 'metal', wall: { s: 'metal' }, amb: [32, 48, 42],
    exits: [{ id: 'n', side: 'N', at: 7, kind: 'metal', to: 'b1_corridor:s_exp' }],
    furn: [
      { t: 'pipes', x: 1, y: 0, w: 4 }, { t: 'pipes', x: 10, y: 0, w: 5 },
      { t: 'tank', x: 2, y: 3 }, { t: 'tank', x: 4, y: 3 }, { t: 'tank', x: 11, y: 3 }, { t: 'tank', x: 13, y: 3 },
      { t: 'optable', x: 6, y: 6, w: 3 }, { t: 'console', x: 2, y: 9, w: 3 }, { t: 'machine', x: 11, y: 8, w: 3, h: 2 },
    ],
    ins: [
      { id: 'exp_tank', x: 2, y: 3, w: 3, acts: [{ say: ['ガラス槽の中で、光る結晶がゆっくりと回っている。'] }] },
      { id: 'exp_table', x: 6, y: 6, w: 3, acts: [{ say: ['ベルトの付いた寝台。……小さな靴が片方、落ちている。', '展示室にあった靴と、対になっている。'] }] },
      { id: 'exp_console', x: 2, y: 9, w: 3, acts: [{ say: ['記録装置の最後のログ：「被験者E、結晶化完了。時間停止を確認」'] }] },
    ],
  });

  room({
    id: 'b1_records', name: '地下資料室', area: 'basement', level: 'B1', map: [42, 14, 7, 8],
    W: 12, H: 10, ground: 'plank', groundC: [70, 62, 56], wall: paper(P.gray), amb: [44, 44, 50],
    exits: [{ id: 's', side: 'S', at: 6, kind: 'metal', to: 'b1_corridor:n_rec' }],
    furn: [
      { t: 'cabinet', x: 1, y: 3, w: 4 }, { t: 'cabinet', x: 7, y: 3, w: 4 }, { t: 'desk', x: 2, y: 7, w: 2, lamp: 1 },
      { t: 'crate', x: 9, y: 7 }, { t: 'wlamp', x: 6, y: 0 },
    ],
    ins: [
      { id: 'rec_cab', x: 7, y: 3, w: 4, acts: [
        { if: { noflag: 'got_director_key' }, say: ['「館長室 予備鍵」と書かれた封筒を見つけた。'], give: 'director_key', set: 'got_director_key' },
        { say: ['実験記録の束。被験者名の欄は、全て黒く塗り潰されている。'] } ] },
      { id: 'rec_desk', x: 2, y: 7, w: 2, acts: [{ say: ['職員の手紙。「館長は正気ではない。お嬢様を結晶に……」'] }] },
    ],
  });

  room({
    id: 'control', name: '管理室', area: 'basement', level: 'B1', map: [50, 13, 8, 9],
    W: 14, H: 10, ground: 'metal', wall: { s: 'metal' }, amb: [38, 48, 60],
    exits: [{ id: 's', side: 'S', at: 7, kind: 'metal', to: 'b1_corridor:n_ctrl' }],
    furn: [
      { t: 'monitors', x: 2, y: 0, w: 4 }, { t: 'console', x: 2, y: 2, w: 4 }, { t: 'lever', x: 10, y: 3, onIf: 'passage_open' },
      { t: 'machine', x: 10, y: 6, w: 3, h: 2 }, { t: 'pipes', x: 8, y: 0, w: 4 }, { t: 'stool', x: 3, y: 3 },
    ],
    ins: [
      { id: 'ctrl_lever', x: 10, y: 3, acts: [
        { if: { noflag: 'passage_open' }, say: ['「封鎖通路 ゲート」と書かれたレバー。', '力いっぱい倒すと、遠くで鉄格子の上がる音がした。'], set: 'passage_open', sfx: 'rumble' },
        { say: ['レバーは「開」の位置にある。'] } ] },
      { id: 'ctrl_console', x: 2, y: 2, w: 4, acts: [{ say: ['配電盤の表示。「最下層：結晶炉 稼働中——10年 0日 0時間」'] }] },
    ],
  });

  room({
    id: 'sealed_passage', name: '封鎖された地下通路', area: 'basement', level: 'B1', map: [56, 22, 20, 4],
    W: 24, H: 7, ground: 'cave', wall: { s: 'stone' }, amb: [24, 26, 36],
    exits: [
      { id: 'w', side: 'W', at: 3, kind: 'bars', to: 'b1_corridor:e',
        lock: { flag: 'passage_open', msg: ['鉄格子が下りている。', '反対側の管理室で開けられるはずだ。'] } },
      { id: 'up', side: 'U', x: 20, y: 2, w: 2, h: 2, spawn: [19, 3], to: 'staff_passage:dn' },
    ],
    furn: [
      { t: 'pipes', x: 3, y: 0, w: 5 }, { t: 'pipes', x: 12, y: 0, w: 4 }, { t: 'crate', x: 8, y: 5 },
      { t: 'barrel', x: 14, y: 2 }, { t: 'rubble', x: 5, y: 2 }, { t: 'rubble', x: 16, y: 5 }, { t: 'torch', x: 18, y: 0 },
    ],
    ins: [{ id: 'sp_rubble', x: 5, y: 2, acts: [{ say: ['崩れた瓦礫。壁に爪で刻まれた文字。', '「逃げられない。朝が来ない」'] }] }],
  });

  /* ================= ⑥ 管理区域 ================= */
  room({
    id: 'staff_passage', name: '職員専用通路', area: 'admin', level: '1F', map: [70, 33, 18, 4],
    W: 26, H: 7, ground: 'plank', groundC: [80, 76, 72], wall: paper([58, 62, 68]), amb: [56, 56, 62],
    exits: [
      { id: 'n', side: 'N', at: 4, kind: 'metal', to: 'east_corridor:s_staff' },
      { id: 'dn', side: 'D', x: 23, y: 2, w: 2, h: 2, spawn: [22, 3], to: 'sealed_passage:up' },
      { id: 's_mon', side: 'S', at: 8, kind: 'metal', to: 'monitor:n' },
      { id: 's_dir', side: 'S', at: 14, to: 'director:n', lock: { item: 'director_key', msg: ['「館長室」。金の装飾の扉。施錠されている。'] } },
      { id: 's_cls', side: 'S', at: 20, kind: 'metal', to: 'classified:n',
        lock: { flag: 'know_passcode', msg: ['電子錠付きの扉。「機密資料室」', '四桁の暗証番号が必要だ。'] } },
    ],
    furn: [
      { t: 'locker', x: 1, y: 2 }, { t: 'locker', x: 2, y: 2 }, { t: 'board', x: 10, y: 0, w: 2 },
      { t: 'wlamp', x: 7, y: 0 }, { t: 'wlamp', x: 16, y: 0 }, { t: 'bench', x: 11, y: 5, w: 2 },
    ],
    ins: [{ id: 'sp_board', x: 10, y: 1, w: 2, acts: [{ say: ['勤務表。最後の日付は十年前。', '全員の欄に「退避」の文字——ただ一人、館長を除いて。'] }] }],
  });

  room({
    id: 'monitor', name: '監視室', area: 'admin', level: '1F', map: [70, 38, 7, 6],
    W: 14, H: 10, ground: 'metal', wall: { s: 'metal' }, amb: [30, 40, 56],
    exits: [{ id: 'n', side: 'N', at: 7, kind: 'metal', to: 'staff_passage:s_mon' }],
    furn: [
      { t: 'monitors', x: 1, y: 0, w: 5 }, { t: 'monitors', x: 9, y: 0, w: 4 },
      { t: 'console', x: 2, y: 3, w: 4 }, { t: 'console', x: 9, y: 3, w: 3 }, { t: 'stool', x: 3, y: 4 }, { t: 'stool', x: 10, y: 4 },
      { t: 'cabinet', x: 12, y: 7 }, { t: 'crate', x: 1, y: 8 },
    ],
    ins: [
      { id: 'mon_console', x: 2, y: 3, w: 4, acts: [
        { if: { noflag: 'mapReveal' }, say: ['監視モニターが館内各所を映している。', '館の全体図を入手した！（地図に全エリアが表示される）', '画面の隅にメモ：「機密室 暗証 0921」'], set: ['mapReveal', 'know_passcode'], sfx: 'chime' },
        { say: ['モニターの一つに、自分の後ろ姿が映っている。', '……振り返っても、誰もいない。'] } ] },
      { id: 'mon_console2', x: 9, y: 3, w: 3, acts: [{ say: ['最下層のカメラ。紫色の光が、心臓のように明滅している。'] }] },
    ],
  });

  room({
    id: 'director', name: '館長室', area: 'admin', level: '1F', map: [78, 38, 8, 7],
    W: 16, H: 12, ground: 'carpet', groundC: [70, 24, 30], wall: paper([80, 64, 34]), amb: [62, 52, 52],
    exits: [
      { id: 'n', side: 'N', at: 8, to: 'staff_passage:s_dir' },
      { id: 'hidden_st', side: 'D', x: 1, y: 2, w: 2, h: 2, spawn: [1, 4], hidden: 'found_hidden_stairs', to: 'deep_corridor:up' },
    ],
    furn: [
      { t: 'window', x: 4, y: 0, w: 2 }, { t: 'painting', x: 6, y: 0, w: 2, v: 'girl' }, { t: 'wlamp', x: 10, y: 0 },
      { t: 'bookshelf', x: 1, y: 2, w: 2, hideIf: 'found_hidden_stairs' }, { t: 'bookshelf', x: 11, y: 2, w: 3 },
      { t: 'desk', x: 6, y: 5, w: 4, lamp: 1, big: 1 }, { t: 'chair', x: 7, y: 4, d: 'down' },
      { t: 'globe', x: 13, y: 8 }, { t: 'sofa', x: 2, y: 9, w: 3, d: 'up' }, { t: 'plant', x: 14, y: 2 }, { t: 'gclock', x: 14, y: 9 },
    ],
    ins: [
      { id: 'dir_shelf', x: 1, y: 2, w: 2, hideIf: 'found_hidden_stairs', acts: [
        { if: { flag: 'read_classified' }, say: ['計画書の通り、書架の三段目を押す……', 'ゴゴゴ……書架が沈み、地下深くへ続く階段が現れた。'], set: 'found_hidden_stairs', sfx: 'secret' },
        { say: ['館長の蔵書。時計学、錬金術、医学……', '三段目だけ、本が一冊も入っていない。'] } ] },
      { id: 'dir_desk', x: 6, y: 5, w: 4, acts: [{ say: ['館長の日記。', '「エマの病は治らない。ならば、時を止めるしかない。あの子が死なない夜を、永遠に」'] }] },
      { id: 'dir_girl', x: 6, y: 1, w: 2, acts: [{ say: ['少女の肖像。額の裏に「わたしの時計を、いつか動かして」'] }] },
    ],
  });

  room({
    id: 'classified', name: '機密資料室', area: 'admin', level: '1F', map: [86, 38, 7, 6],
    W: 12, H: 10, ground: 'metal', wall: { s: 'metal' }, amb: [36, 40, 52],
    exits: [{ id: 'n', side: 'N', at: 6, kind: 'metal', to: 'staff_passage:s_cls' }],
    furn: [
      { t: 'safe', x: 2, y: 2 }, { t: 'safe', x: 3, y: 2 }, { t: 'cabinet', x: 8, y: 2, w: 3 },
      { t: 'table', x: 4, y: 6, w: 4 }, { t: 'lamp', x: 9, y: 7 }, { t: 'wlamp', x: 5, y: 0 },
    ],
    ins: [
      { id: 'cls_table', x: 4, y: 6, w: 4, acts: [
        { if: { noflag: 'read_classified' }, say: ['「計画書：時の心臓」', '——館全体を時間結晶で包み、ある一夜を永遠に繰り返す。', '——入口：館長室の書架、三段目。'], set: 'read_classified' },
        { say: ['計画書の最後のページ：「娘よ、許せ」'] } ] },
      { id: 'cls_safe', x: 2, y: 2, w: 2, acts: [
        { if: { noflag: 'got_sun', using: 'director_key' }, say: ['館長室の鍵を差し込む。象嵌の模様が鍵穴の縁とぴたりと重なった。', '金庫の中に、太陽の紋章。'], give: 'sun_emblem', set: 'got_sun', sfx: 'unlock' },
        { if: { noflag: 'got_sun' }, say: ['小型金庫。鍵穴の縁に、三日月を抱く太陽の象嵌。', 'どこかで同じ模様を見た気がする。'] },
        { say: ['空だ。'] } ] },
    ],
  });

  /* ================= ⑦ 最深部 ================= */
  room({
    id: 'deep_corridor', name: '最深部 回廊', area: 'deep', level: 'B2', map: [14, 24, 24, 5],
    W: 28, H: 8, ground: 'obsidian', wall: { s: 'crystal' }, amb: [28, 26, 48],
    exits: [
      { id: 'up', side: 'U', x: 1, y: 2, w: 2, h: 2, spawn: [2, 4], to: 'director:hidden_st' },
      { id: 'e', side: 'E', at: 4, w: 2, to: 'final_puzzle:w' },
    ],
    furn: [
      { t: 'crystal', x: 6, y: 2 }, { t: 'crystal', x: 12, y: 6 }, { t: 'crystal', x: 18, y: 2 }, { t: 'crystal', x: 23, y: 6 },
      { t: 'pillar', x: 9, y: 2, dark: 1 }, { t: 'pillar', x: 15, y: 2, dark: 1 }, { t: 'pillar', x: 21, y: 2, dark: 1 },
    ],
    ins: [{ id: 'dc_crystal', x: 12, y: 6, acts: [{ say: ['壁から生えた結晶。触れると、遠い笑い声が聞こえた。'] }] }],
  });

  room({
    id: 'final_puzzle', name: '最終謎解きの間', area: 'deep', level: 'B2', map: [38, 18, 14, 14],
    W: 20, H: 16, ground: 'ritual', wall: { s: 'crystal' }, amb: [34, 28, 56],
    exits: [
      { id: 'w', side: 'W', at: 7, w: 2, to: 'deep_corridor:e' },
      { id: 'great', side: 'N', at: 8, w: 4, kind: 'great', to: 'truth_room:s',
        lock: { flag: 'great_door_open', msg: ['見上げるほど巨大な扉。', '三つの窪みがある——星・月・太陽。'] } },
    ],
    furn: [
      { t: 'pedestal', x: 5, y: 7, v: 'star', onIf: 'placed_star' }, { t: 'pedestal', x: 14, y: 7, v: 'moon', onIf: 'placed_moon' },
      { t: 'pedestal', x: 9, y: 11, v: 'sun', onIf: 'placed_sun' },
      { t: 'statue', x: 2, y: 3, dark: 1 }, { t: 'statue', x: 17, y: 3, dark: 1 },
      { t: 'brazier', x: 6, y: 2 }, { t: 'brazier', x: 13, y: 2 }, { t: 'crystal', x: 2, y: 13 }, { t: 'crystal', x: 17, y: 13 },
    ],
    ins: [
      { id: 'fp_star', x: 5, y: 7, acts: [
        { if: { flag: 'placed_star' }, say: ['星の紋章が淡く輝いている。'] },
        { if: { has: 'star_emblem' }, say: ['星の紋章を台座にはめ込んだ。'], take: 'star_emblem', set: 'placed_star', sfx: 'chime' },
        { say: ['星の形の窪みがある台座。'] } ] },
      { id: 'fp_moon', x: 14, y: 7, acts: [
        { if: { flag: 'placed_moon' }, say: ['月の紋章が青く輝いている。'] },
        { if: { has: 'moon_emblem' }, say: ['月の紋章を台座にはめ込んだ。'], take: 'moon_emblem', set: 'placed_moon', sfx: 'chime' },
        { say: ['三日月の形の窪みがある台座。'] } ] },
      { id: 'fp_sun', x: 9, y: 11, acts: [
        { if: { flag: 'placed_sun' }, say: ['太陽の紋章が金色に輝いている。'] },
        { if: { has: 'sun_emblem' }, say: ['太陽の紋章を台座にはめ込んだ。'], take: 'sun_emblem', set: 'placed_sun', sfx: 'chime' },
        { say: ['太陽の形の窪みがある台座。'] } ] },
    ],
  });

  room({
    id: 'truth_room', name: '真相の部屋', area: 'deep', level: 'B2', map: [40, 8, 10, 10],
    W: 14, H: 12, ground: 'parquet', groundC: [150, 110, 90], wall: paper([150, 110, 130]), amb: [82, 66, 84],
    rugs: [{ x: 4, y: 5, w: 6, h: 4, c: [190, 120, 150] }],
    exits: [
      { id: 's', side: 'S', at: 6, w: 2, to: 'final_puzzle:great' },
      { id: 'n', side: 'N', at: 6, w: 2, to: 'final_hall:s',
        lock: { flag: 'read_emma_letter', msg: ['扉は固く閉ざされている。', '……この部屋に、読むべきものがある気がする。'] } },
    ],
    furn: [
      { t: 'bed', x: 1, y: 2, w: 2, h: 3, c: [200, 140, 170] }, { t: 'window', x: 10, y: 0, w: 2, fake: 1 },
      { t: 'desk', x: 10, y: 4, w: 2, lamp: 1 }, { t: 'dollhouse', x: 11, y: 8 }, { t: 'musicbox', x: 4, y: 2 },
      { t: 'plant', x: 12, y: 2 }, { t: 'plush', x: 2, y: 8 },
    ],
    ins: [
      { id: 'tr_desk', x: 10, y: 4, w: 2, acts: [
        { if: { noflag: 'read_emma_letter' }, say: ['机の上に、少女の手紙。', '「お父さまへ。わたしはもう、十分しあわせでした。」', '「だから、時計をうごかして。朝にして。」', '——奥の扉の鍵が、カチリと外れる音がした。'], set: 'read_emma_letter', sfx: 'secret' },
        { say: ['エマの手紙。インクが涙で滲んでいる。'] } ] },
      { id: 'tr_box', x: 4, y: 2, event: 'piano', acts: [{ event: 'piano', say: ['オルゴールの蓋を開けると、あの夜想曲が流れた。'] }] },
      { id: 'tr_bed', x: 1, y: 2, w: 2, h: 3, acts: [{ say: ['地上の客室5とそっくりな部屋。', 'ここだけ、十年前のまま時が止まっている。'] }] },
      { id: 'tr_plush', x: 2, y: 8, acts: [{ say: ['くたびれたうさぎのぬいぐるみ。'] }] },
    ],
  });

  room({
    id: 'final_hall', name: '時の心臓', area: 'deep', level: 'B2', map: [38, -4, 14, 12],
    W: 20, H: 16, ground: 'ritual', wall: { s: 'crystal' }, amb: [40, 28, 66],
    exits: [{ id: 's', side: 'S', at: 9, w: 2, to: 'truth_room:n' }],
    furn: [
      { t: 'core', x: 9, y: 5, w: 2, h: 2, brokenIf: 'truth_known' },
      { t: 'crystal', x: 4, y: 4, big: 1 }, { t: 'crystal', x: 15, y: 4, big: 1 }, { t: 'crystal', x: 4, y: 11, big: 1 }, { t: 'crystal', x: 15, y: 11, big: 1 },
      { t: 'brazier', x: 7, y: 9 }, { t: 'brazier', x: 12, y: 9 },
    ],
    ins: [
      { id: 'fh_core', x: 9, y: 5, w: 2, h: 2, acts: [
        { if: { noflag: 'truth_known' }, event: 'finale', say: [
          '巨大な結晶の中心で、時計の針が逆向きに回っている。',
          '——声が聞こえる。',
          '「お父さまを、ゆるしてあげて」',
          'エマの声だった。十年前の今夜、病に倒れた少女。',
          'エルディア卿は娘の死を拒み、館ごと時を止めたのだ。',
          'その夜に招かれた客も、使用人も、そして自分も——',
          'みな、この一夜に閉じ込められていた。',
          // ※仮の分岐（本編では第6章の「怜司の提案」に差し替える）
          '——背後から、もう一つの声が囁いた。',
          '「ここで見たものをすべて忘れ、黙って去るなら、記録は私が焼こう。誰もこれ以上傷つかずに済む」',
          // 決定C：初期位置は「拒む」。「受け入れる」は一度だけ確認を出す
          { choice: { id: 'proposal', q: 'その提案を——', def: 0, opts: [
            { label: '拒む（真実を持ち帰る）', set: 'refused_proposal', value: 'refuse' },
            { label: '受け入れる（声明に署名する）', set: 'accepted_proposal', value: 'accept',
              confirm: { q: '本当に署名しますか。記録は燃やされ、真実は二度と語られません。', yes: 'はい（署名する）', no: 'いいえ（選び直す）' } },
          ] } },
          '結晶に手を触れる。冷たく、そして温かい。',
          '「ありがとう。もう、朝にしていいよ」',
          '——パキン。',
          '結晶が砕け、止まっていた時が一斉に流れ出す。',
          '遠くで、正面玄関の鎖が外れる音がした。',
        ], set: ['truth_known', 'front_open'] },
        { say: ['砕けた結晶から、光の粒が静かに舞い上がっている。', '正面玄関へ向かおう。夜が明ける。'] } ] },
    ],
  });

  /* 全体ルール：フラグの組合せで自動発火 */
  ELD.RULES = [
    // 最終の問い（SECRETの条件「LAST KEYの本当の意味を理解」）。提案を拒んだときだけ
    // 誤答はやり直し（正解するまで同じ問いに戻る）
    { if: { flag: ['refused_proposal', 'lastkey_asked'], noflag: 'lastkey_understood' },
      say: ['……違う。母が託したのは、そういうものではなかった気がする。', { choice: { id: 'lastkey', q: '最後の鍵とは、何だったのか。', opts: [
        { label: '館の最深部を開ける本物の鍵', value: 'key' },
        { label: '11人の証拠と証言そのもの', set: 'lastkey_understood', value: 'people' },
        { label: '母が遺したペンダント', value: 'pendant' },
      ] } }] },
    { if: { flag: 'refused_proposal', noflag: 'lastkey_asked' }, set: 'lastkey_asked',
      say: ['——最後に、もう一つだけ確かめたい。', { choice: { id: 'lastkey', q: '最後の鍵とは、何だったのか。', opts: [
        { label: '館の最深部を開ける本物の鍵', value: 'key' },
        { label: '11人の証拠と証言そのもの', set: 'lastkey_understood', value: 'people' },
        { label: '母が遺したペンダント', value: 'pendant' },
      ] } }] },
    { if: { flag: ['placed_star', 'placed_moon', 'placed_sun'], noflag: 'great_door_open' },
      say: ['三つの紋章が共鳴し、低い鐘の音が響く——', '巨大な扉が、ゆっくりと開いていく。'], set: 'great_door_open', sfx: 'rumble' },
  ];

  ELD.START = { room: 'hall', x: 12.5, y: 15, dir: 'up' };
  ELD.INTRO = [
    '一通の招待状に導かれ、霧の夜、エルディア館を訪れた。',
    '宛名には「{name} 様」とあった。差出人の名はない。',
    '扉をくぐった瞬間、背後で重い鎖の音がした。',
    '館に人の気配はない。柱時計は11時50分で止まっている。',
    '——館の秘密を解き明かし、ここから出なければ。',
  ];

  ELD.ROOMS = {};
  R.forEach((r) => (ELD.ROOMS[r.id] = r));
  ELD.ROOM_LIST = R;
})();
