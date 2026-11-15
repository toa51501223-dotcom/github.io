/* =====================================================================
 * ELDIA 本編データ（統合設計資料・設計資料 第12〜22章に準拠）
 * ---------------------------------------------------------------------
 * 物語第1章「招かれた者たち」：前庭 → 玄関 → 夕食 → 放送 → 封鎖 → 柱時計
 * 第2章以降は制作中。部屋IDは m_ で始まる。
 * 人物は furn の t:'person'（見た目は ELD.LOOKS[who]）と、同じ位置の ins（npc:who）で置く。
 * acts / rules の効果：trust:{id:+n} unity:+n clock:'HH:MM' meet:[id] face:{id:dir} chapterEnd:{...}
 * 選択肢の opts には say / trust / unity / set を書ける（選んだ直後に流れる）。
 * ===================================================================== */
(function () {
  const ELD = (window.ELD = window.ELD || {});
  ELD.STORY = true;

  ELD.AREAS = {
    bus:      { name: '最終バス',   color: '#6a7a9a' },
    yard:     { name: '前庭',       color: '#7a9a6a' },
    entrance: { name: '本館',       color: '#c9a24a' },
    east:     { name: '東館',       color: '#5fa36b' },
    west:     { name: '西館',       color: '#5a7fc4' },
    tower:    { name: '時計塔',     color: '#b98a5a' },
    admin:    { name: '管理区域',   color: '#a46060' },
    basement: { name: '地下',       color: '#6fa6a0' },
  };
  ELD.FLOORS = [{ id: '1F', name: '1F' }];
  ELD.CHAPTERS = {};
  ELD.CHAPTER_NAMES = ['', '第1章 招かれた者たち', '第2章 消えた証言', '第3章 地下へ', '第4章 告白の夜', '第5章 時計の嘘', '第6章 最後の鍵'];

  /* ---------------- 人物 ---------------- */
  ELD.CAST_INFO = [
    { id: 'ren', name: '朝倉 蓮', role: '26歳・元新聞記者。父・圭介は2008年に真帆と会う約束をしていた' },
    { id: 'mizuki', name: '白石 美月', role: '24歳・美術品修復士。祖父が「鐘楼の聖母」を描いた' },
    { id: 'kurose', name: '黒瀬 修司', role: '48歳・元刑事。2008年の火災を捜査した' },
    { id: 'fuyuko', name: '神崎 冬子', role: '63歳。名乗らない年配の女性', memo: (S) => (S.flags.fuyuko_named ? '元家政婦' : '') },
    { id: 'minato', name: '雨宮 湊', role: '23歳・プログラマー。館の録画装置の復元を請け負った' },
    { id: 'reina', name: '桐島 玲奈', role: '29歳・救急医。父は研究所の嘱託医だった' },
    { id: 'soichiro', name: '御影 宗一郎', role: '57歳・会社経営者。亡くなった御影怜司の弟' },
    { id: 'yu', name: '早乙女 悠', role: '27歳・建築士。父が館の地下を改修した' },
    { id: 'kotone', name: '水瀬 琴音', role: '22歳・音楽家。4歳のとき、母の演奏会でこの館に来た' },
    { id: 'haibara', name: '灰原', role: '館の管理人（管理会社の制服、色付きの丸眼鏡、かすれた声）', noTrust: true },
  ];
  ELD.CAST = ['朝倉 蓮', '白石 美月', '黒瀬 修司', '神崎 冬子', '雨宮 湊', '桐島 玲奈', '御影 宗一郎', '早乙女 悠', '水瀬 琴音'];
  const trust0 = {}; ELD.CAST_INFO.forEach((p) => { if (!p.noTrust) trust0[p.id] = 2; });

  // 物語はバスの車内（プロローグ）から。降りた瞬間に第1章が始まる
  ELD.YARD_START = { room: 'm_yard', x: 13.5, y: 19, dir: 'up' };
  ELD.START = { room: 'm_bus', x: 4.5, y: 4, dir: 'right', clock: '16:55', inv: ['invitation', 'pendant'], trust: trust0, unity: 5 };
  ELD.RETRY_ROOM = 'm_hall';
  // 前庭で調べる所（館に入る条件）
  ELD.YARD_SPOTS = ['yard_gate', 'yard_road', 'yard_ice', 'yard_flowers', 'yard_cam', 'yard_box', 'yard_bus', 'yard_win'];
  ELD.COND_FN = Object.assign(ELD.COND_FN || {}, { yardLeft: (S) => ELD.YARD_SPOTS.some((k) => !S.examined[k]) });
  ELD.TITLE_ROOM = { room: 'm_yard', x: 14, y: 9 };

  // プロローグ（バスの車内）：雨の独白のあと、車内を操作して招待状を読む
  ELD.PROLOGUE = { lines: [
    '2026年11月14日、夕方。',
    '霧の山道を、最終バスがゆっくりと登っていく。',
    '窓を叩く雨。乗客は、自分のほかに一人だけ。後ろの席の、カメラを提げた若い男。',
  ] };
  // バスを降りた瞬間の章タイトル
  ELD.CH1_CARD = { no: '第1章', title: '招かれた者たち', sub: '2026年11月14日 17:10　エルディア館 前庭' };
  ELD.INTRO = [
    '2026年11月14日、夕方。',
    '麓の停留所を16時に出た最終バスは、霧の山道を一時間かけて登り、館の前で{name}を降ろして引き返していった。',
    '手には一通の招待状。「あなたの母、如月真帆があの夜最後に何を記録したのか。その資料をお渡しします。」',
    '十八年前の今日、この館の地下で火事があった。一人が死に、母は消えた。',
    '——母は、自分を置いて消えたのか。それを確かめに来た。',
  ];

  const P = { red: [104, 30, 40], green: [44, 74, 52], blue: [38, 56, 92], rose: [110, 58, 68], gray: [62, 62, 72], brown: [74, 58, 44] };
  const paper = (c) => ({ s: 'paper', c });
  const R = [];
  const room = (o) => R.push(o);
  const npc = (who, x, y, dir, vis) => Object.assign({ t: 'person', who, x, y, dir }, vis || {});

  /* ================= 前庭 ================= */
  room({
    id: 'm_bus', name: '最終バスの車内', area: 'bus', level: 'BUS', map: [40, 60, 10, 4], bgm: 'quiet', exitHint: true,
    W: 16, H: 7, ground: 'metal', groundC: [78, 82, 92], wall: { s: 'metal' }, amb: [96, 102, 126],
    exits: [{ id: 'door', side: 'S', at: 13, w: 1, kind: 'metal', to: '@start', lock: { flag: 'bus_arrive', msg: ['まだ走っている。……もうすぐ着くはずだ。'] } }],
    furn: [
      { t: 'buswin', x: 1, y: 0, w: 2 }, { t: 'buswin', x: 4, y: 0, w: 2 }, { t: 'buswin', x: 7, y: 0, w: 2 }, { t: 'buswin', x: 10, y: 0, w: 2, lamp: 1 },
      { t: 'busseat', x: 1, y: 2 }, { t: 'busseat', x: 3, y: 2 }, { t: 'busseat', x: 5, y: 2 }, { t: 'busseat', x: 7, y: 2 }, { t: 'busseat', x: 9, y: 2 },
      { t: 'busseat', x: 1, y: 5 }, { t: 'busseat', x: 3, y: 5 }, { t: 'busseat', x: 5, y: 5 }, { t: 'busseat', x: 7, y: 5 }, { t: 'busseat', x: 9, y: 5 },
      { t: 'busdriver', x: 13, y: 2, w: 2 }, { t: 'person', who: 'ren', x: 1, y: 5, dir: 'right', hideIf: 'met_ren_intro' }, { t: 'busrail', x: 1, y: 3, w: 11 },
    ],
    ins: [
      { id: 'bs_seat', x: 3, y: 5, acts: [
        { if: { noflag: 'bus_read' }, say: ['自分の席。'], set: 'bus_read' },
        { say: ['自分の席。招待状は鞄にしまった。（持ち物からいつでも読める）'] } ] },
      { id: 'bs_win', x: 10, y: 0, w: 2, h: 2, acts: [
        { if: { flag: 'bus_read' }, say: ['霧の切れ間に、灯りがひとつ。', '山の上に、黒い館の影が浮かんでいた。……エルディア館。'] },
        { say: ['雨に濡れた窓。外は霧で何も見えない。', 'ガードレールの向こうは、深い谷だ。'] } ] },
      { id: 'bs_win2', x: 4, y: 0, w: 2, h: 2, acts: [{ say: ['窓に映る自分の顔。', '……母に似ている、と昔よく言われた。'] }] },
      { id: 'bs_driver', x: 13, y: 2, w: 2, acts: [
        { if: { noflag: 'bus_read' }, say: ['運転手：「終点まで、もう少しですよ」', '運転手：「お客さん、あの館に用ですか。……今日は、ほかにも何人か上がっていったな」'] },
        { say: ['運転手：「帰りの便はもうありません。明日の朝まで、気をつけて」'] } ] },
      { id: 'bs_ren', npc: 'ren', x: 1, y: 5, acts: [{ say: ['後ろの席の若い男。首からカメラを提げ、窓の外の館をじっと見ている。', '……膝の上の手帳に、「エルディア館　2008」と走り書きがある。'] }] },
      { id: 'bs_notice', x: 12, y: 3, acts: [{ say: ['車内の掲示。「御影山線　最終　麓 16:00 発 → エルディア館前 17:05 着」。', '下に小さく「冬季は終点付近で携帯電話の電波が入りにくくなります」。'] }] },
    ],
  });
  room({
    id: 'm_yard', name: '前庭', area: 'yard', level: '1F', map: [38, 36, 24, 14],
    W: 28, H: 22, ground: 'grass', wall: { s: 'facade' }, amb: [70, 74, 96],
    paths: [{ x: 12, y: 2, w: 4, h: 19, g: 'gravel' }, { x: 3, y: 9, w: 22, h: 2, g: 'gravel' }, { x: 1, y: 17, w: 26, h: 4, g: 'gravel' }],
    exits: [
      { id: 'door', side: 'N', at: 13, w: 2, kind: 'grand', to: 'm_hall:s', lock: { flag: 'greeted', msg: ['重い両開きの扉。'] } },
      { id: 'icehouse', side: 'E', at: 8, w: 2, to: '@none', lock: { flag: 'never', msg: ['氷室へ続く小道。'] } },
    ],
    furn: [
      { t: 'bigwindow', x: 3, y: 0, w: 2 }, { t: 'bigwindow', x: 7, y: 0, w: 2 }, { t: 'bigwindow', x: 19, y: 0, w: 2 }, { t: 'bigwindow', x: 23, y: 0, w: 2 },
      { t: 'lamppost', x: 11, y: 3 }, { t: 'lamppost', x: 16, y: 3 }, { t: 'lamppost', x: 11, y: 13 }, { t: 'lamppost', x: 16, y: 13 },
      { t: 'flowerbed', x: 2, y: 3, w: 5, h: 3 }, { t: 'flowerbed', x: 21, y: 3, w: 4, h: 2 },
      { t: 'bench', x: 3, y: 12, w: 2 }, { t: 'campole', x: 25, y: 6 },
      { t: 'hedge', x: 1, y: 7, w: 3 }, { t: 'hedge', x: 24, y: 12, w: 3 },
      { t: 'fence', x: 1, y: 15, w: 11 }, { t: 'fence', x: 16, y: 15, w: 11 },
      { t: 'irongate', x: 12, y: 15, w: 4, showIf: 'sealed' },
      { t: 'gatepanel', x: 17, y: 16 }, { t: 'busstop', x: 9, y: 18 },
      // 人物（館に入る前）
      npc('ren', 11, 19, 'right', { hideIf: 'greeted' }),
      npc('minato', 18, 17, 'left', { hideIf: 'greeted' }),
      npc('reina', 5, 12, 'left', { hideIf: 'greeted' }),
      npc('yu', 20, 7, 'up', { hideIf: 'greeted' }),
      npc('kurose', 23, 13, 'left', { hideIf: 'greeted' }),
    ],
    ins: [
      { id: 'yard_door', x: 13, y: 1, w: 2, acts: [
        { if: { flag: 'greeted' }, say: ['玄関の扉は開いている。'] },
        { if: { noflag: 'met_ren_intro' }, say: ['……誰かに呼ばれた気がする。'] },
        // 館に入る前に、前庭の全員と話し、調べる所を全部調べる
        { if: { noflag: 'ren_t1' }, say: ['扉に手をかけて、やめた。……停留所の男（朝倉蓮）と、まだちゃんと話していない。'] },
        { if: { noflag: 'minato_t1' }, say: ['……門の制御盤をいじっていた若い男が気になる。先に話を聞いておこう。'] },
        { if: { noflag: 'reina_t1' }, say: ['……ベンチのそばの女性が、こちらを見ていた。話してからにしよう。'] },
        { if: { noflag: 'yu_t1' }, say: ['……館を見上げて指を折っていた眼鏡の青年。何を数えていたのだろう。'] },
        { if: { noflag: 'kurose_t1' }, say: ['……生け垣のそばで煙草を吸っている男。あの目つきは、ただの客じゃない。'] },
        { if: { anyCond: 'yardLeft' }, say: ['扉の前で振り返った。前庭に、まだ調べていない所がある。', '（門、停留所の標識、花壇、監視カメラ、氷室への小道、外壁の窓と端子箱）'] },
        { say: [
          '扉の前に立つと、内側から鍵の外れる音がした。',
          '現れたのは、管理会社の制服を着た初老の男。色の付いた丸眼鏡。左の頰から首にかけて、古い火傷の痕がある。',
          '灰原：「ようこそ、エルディア館へ。管理人の灰原と申します」',
          '灰原：「……〈{name}〉様、ですね」',
          '名前を口にした瞬間、男の動きがほんの一瞬だけ止まった。眼鏡の奥の目が、首元のペンダントに落ちる。',
          '灰原：「失礼。喉を痛めておりまして、お聞き苦しい声で」',
          '鍵束を扱う手は、左手だった。',
          '灰原：「お部屋は東館にご用意しております。夕食は19時、食堂にて。皆さまもう中に」',
        ], set: 'greeted', meet: ['haibara'], clock: '17:50', sfx: 'door' },
      ] },
      { id: 'yard_gate', x: 12, y: 15, w: 4, acts: [
        { if: { flag: 'sealed' }, say: ['門は鉄の格子で閉ざされている。制御盤の赤い灯が点いたままだ。', '揺すってもびくともしない。……外へは出られない。'] },
        { say: ['開いたままの鉄の門。格子の上の方に、電子錠の箱が付いている。'] } ] },
      { id: 'yard_road', x: 13, y: 21, w: 2, acts: [
        { if: { flag: 'road_closed' }, say: ['雨脚が強い。坂の下で、道が土砂に呑まれているのが見える。', '歩いて麓まで下りれば、夜の山道を4時間以上。……今夜は戻れない。'] },
        { say: ['麓へ下る一本道。バスはもう霧の中へ消えた。', '次の便は明日の朝だ。'] } ] },
      { id: 'yard_ice', x: 27, y: 8, h: 2, acts: [{ say: ['生け垣の切れ目から、館の裏手へ小道が延びている。', '鉄柵に南京錠。札に「氷室　立入禁止」。', '……氷室。古い館には、地下に氷を貯める部屋があったという。'], set: 'saw_icehouse' }] },
      { id: 'yard_flowers', x: 2, y: 3, w: 5, h: 3, acts: [{ say: ['釣鐘の形をした紫の花が、雨を受けて垂れている。', 'ジギタリス。……きれいだけれど、たしか毒のある花だ。'], set: 'saw_foxglove' }] },
      { id: 'yard_cam', x: 25, y: 6, acts: [{ say: ['柱の上に監視カメラ。赤い灯が点いている。', 'レンズの下に小さく「赤外線」。夜でも庭を写すらしい。'] }] },
      { id: 'yard_box', x: 8, y: 1, w: 1, acts: [
        { if: { flag: 'sealed' }, say: ['外壁の電話の端子箱。蓋がこじ開けられ、引込線が刃物で切られている。', '……故障なんかじゃない。誰かがやった。'], set: 'saw_cut_line' },
        { say: ['外壁に灰色の箱。「電話端子」。蓋はきちんと閉じている。'] } ] },
      { id: 'yard_bus', x: 9, y: 18, acts: [{ say: ['錆びた停留所の標識。「エルディア館前」。', '時刻表には、朝と夕方に一本ずつ。'] }] },
      { id: 'yard_win', x: 19, y: 1, w: 2, acts: [{ say: ['窓に灯りがともっている。', '見上げると、館の奥に時計塔の影が霧に溶けていた。'] }] },
      // 人物
      { id: 'yard_ren', npc: 'ren', x: 11, y: 19, acts: [
        { if: { noflag: 'ren_t1' }, say: [
          '蓮：「改めて。朝倉蓮、元新聞記者。……『元』ね、今は無職」',
          '蓮：「親父も記者だった。十八年前の今夜、親父はこの館の近くで、ある人と会う約束をしてた」',
          '蓮：「如月真帆。……あんたのお袋さんだろ」',
          '蓮：「22時半の約束。でも真帆さんは来なかった。親父の手帳にはそれだけ書いてある」',
          '蓮：「俺の招待状には『お父上の写真を返す』ってさ。あんたは？」',
        ], set: 'ren_t1', trust: { ren: 1 } },
        { say: ['蓮：「中、入んないの？ 雨、強くなってきたぜ」'] } ] },
      { id: 'yard_minato', npc: 'minato', x: 18, y: 17, acts: [
        { if: { noflag: 'minato_t1' }, say: [
          '若い男が門の制御盤の蓋を開け、中の基板をのぞき込んでいる。',
          '湊：「……何。勝手にいじってるわけじゃない。見てるだけ」',
          '湊：「雨宮。ここの録画装置の復元を請け負ってた。仕事でね」',
          '湊：「この門、館の中央管理システムに繋がってる。仕様書の日付が新しい。去年入れ替えたばかりだ」',
          '湊：「……停電しても閉じたままになる方式。一度閉じたら、中からは開けられない」',
        ], set: 'minato_t1', trust: { minato: 1 } },
        { say: ['湊：「仕様書、もう少し読んでおく。……嫌な予感がする」'] } ] },
      { id: 'yard_reina', npc: 'reina', x: 5, y: 12, acts: [
        { if: { noflag: 'reina_t1' }, say: [
          '女性：「あなた、その歩き方。靴ずれしてるでしょう」',
          '有無を言わせず、絆創膏を一枚押しつけられた。',
          '玲奈：「桐島。医者よ。救急の。……どういたしまして」',
          '玲奈：「父がね、昔ここの研究所の嘱託医だったの。三年前に亡くなったけど」',
        ], set: 'reina_t1', trust: { reina: 1 } },
        { say: ['玲奈：「傷は濡らさないで。……ここ、空気が重いわね」'] } ] },
      { id: 'yard_yu', npc: 'yu', x: 20, y: 7, acts: [
        { if: { noflag: 'yu_t1' }, say: [
          '眼鏡の青年が、館を見上げて指を折っている。',
          '悠：「あ、すみません。窓を数えていて。……早乙女です。建築士の」',
          '悠：「この館、昔の公式図面だと一階の窓は十二。でも実際は十一しかないんです」',
          '悠：「父がここの改修をしたことがあって。……図面と実物が合わない建物は、何かを隠しているものです」',
        ], set: 'yu_t1', trust: { yu: 1 } },
        { say: ['悠：「十一。やっぱり一つ足りない」'] } ] },
      { id: 'yard_kurose', npc: 'kurose', x: 23, y: 13, acts: [
        { if: { noflag: 'kurose_t1' }, say: [
          '雨の中、煙草をくわえた男がこちらを一瞥した。',
          '黒瀬：「……その目の配り方。探偵か」',
          '黒瀬：「黒瀬だ。昔、警察にいた。それ以上は聞くな」',
          '黒瀬：「邪魔だけはするな」',
        ], set: 'kurose_t1', meet: ['kurose'] },
        { say: ['黒瀬：「……」', '黒瀬は煙を吐いて、館の時計塔を見上げた。'] } ] },
    ],
  });

  /* ================= 本館 玄関ホール ================= */
  room({
    id: 'm_hall', name: '玄関ホール', area: 'entrance', level: '1F', map: [42, 22, 16, 12],
    W: 24, H: 16, ground: 'marble', wall: paper(P.red), amb: [72, 64, 98],
    rugs: [{ x: 11, y: 2, w: 2, h: 13, c: [120, 24, 32] }],
    exits: [
      { id: 's', side: 'S', at: 11, w: 2, kind: 'grand', to: 'm_yard:door' },
      { id: 'w', side: 'W', at: 7, w: 2, to: 'm_wcorr:e', lock: { flag: 'ch1_end', msg: ['西館へ続く扉。鍵が掛かっている。'] } },
      { id: 'e', side: 'E', at: 7, w: 2, to: 'm_east:w' },
      { id: 'tower', side: 'N', at: 11, w: 2, to: 'm_tclock:s', lock: { flag: 'tower_open', msg: ['時計塔へ続く扉。歯車の形の鍵穴がある。', '鍵が掛かっている。'] } },
      { id: 'office', side: 'N', at: 19, to: 'm_office:s' },
    ],
    furn: [
      { t: 'window', x: 15, y: 0, w: 2 },
      { t: 'painting', x: 7, y: 0, w: 2, v: 'lady' },
      { t: 'keybox', x: 3, y: 0 },
      { t: 'wlamp', x: 10, y: 0 }, { t: 'wlamp', x: 13, y: 0 },
      { t: 'gclock', x: 5, y: 2, stop: 23 * 60 + 35 },
      { t: 'plant', x: 1, y: 2 }, { t: 'plant', x: 22, y: 2 },
      { t: 'pillar', x: 5, y: 7 }, { t: 'pillar', x: 18, y: 7 },
      { t: 'counter', x: 15, y: 11, w: 5, h: 2 },
      { t: 'bench', x: 2, y: 13, w: 2 },
      { t: 'chandelier', x: 11, y: 7, w: 2 },
      // 人物（夕食まで）
      npc('soichiro', 6, 3, 'left', { showIf: 'greeted', hideIf: 'dinner_start' }),
      npc('fuyuko', 3, 11, 'right', { showIf: 'greeted', hideIf: 'dinner_start' }),
      npc('mizuki', 8, 3, 'up', { showIf: 'greeted', hideIf: 'dinner_start' }),
      npc('yu', 20, 4, 'left', { showIf: 'greeted', hideIf: 'dinner_start' }),
      npc('haibara', 17, 10, 'down', { showIf: 'greeted', hideIf: 'dinner_start' }),
      npc('haibara', 17, 10, 'down', { showIf: 'sealed', hideIf: 'ch3_end' }), // 第4章からは厨房にいる
    ],
    ins: [
      { id: 'mh_clock', x: 5, y: 2, acts: [
        { if: { flag: 'ch2_end', noflag: 'tower_open' }, say: ['動き出した柱時計の振り子の奥に、小さな扉がある。', '画廊の下絵が示していたのは、ここだ。', '開けると、歯車の形をした鍵が下がっていた。……時計塔の鍵だ。'], give: 'tower_key', set: 'tower_open', sfx: 'secret' },
        { if: { flag: 'clock_moving' }, say: ['柱時計が、重い音で時を刻んでいる。', '十八年止まっていた振り子が、揺れている。'] },
        { say: ['背の高い柱時計。針は「11時35分」で止まっている。', '振り子も動かない。……23時35分。十八年前の、あの夜の時刻だろうか。'], set: 'saw_clock' } ] },
      { id: 'mh_lady', x: 7, y: 1, w: 2, acts: [
        { if: { noflag: 'mizuki_t1' }, say: ['鐘楼に立つ聖母の絵。腕に幼子を抱いている。', '額縁の下の札に「鐘楼の聖母　白石柾」。'] },
        { say: ['「鐘楼の聖母」。美月の祖父の絵だという。', '聖母の顔は、どこか見覚えがある気がした。'] } ] },
      { id: 'mh_keybox', x: 3, y: 1, acts: [
        { if: { has: 'west_key' }, say: ['キーボックスは開いたまま。中の鉤は一つ空いている。'] },
        { if: { flag: 'sealed' }, code: { answer: '2335', title: 'キーボックス', desc: '四桁のダイヤル錠。蓋の裏に色あせた字で「この館の時間」。',
          ok: { say: ['カチリ、と軽い音。', '蓋が開いた。鉤に下がった鍵の札には「西館」。'], give: 'west_key', set: 'got_west_key' },
          ng: ['……開かない。', '「この館の時間」。この館で、時間を示しているものは——'],
          reveal: '（止まった柱時計の針は、23時35分を指していた）' } },
        { say: ['壁のキーボックス。四桁のダイヤル錠が掛かっている。', '灰原：「各館の鍵です。お客様にお開けいただくものではございません」'], set: 'saw_keybox' } ] },
      { id: 'mh_west', x: 0, y: 7, h: 2, vis: { noflag: 'ch1_end' }, acts: [
        { if: { has: 'west_key' }, say: ['西館の鍵を差し込むと、錠は回った。……キーボックスの謎と招待状の透かし、両方が片づいてから行こう。'] },
        { say: ['西館へ続く扉。鍵が掛かっている。'] } ] },
      { id: 'mh_counter', npc: 'haibara', x: 16, y: 10, w: 3, h: 3, hideIf: 'ch3_end', acts: [
        { if: { flag: 'sealed', noflag: 'hb_sealed' }, say: [
          '灰原：「……申し訳ございません。中央管理システムの障害のようでして」',
          '灰原：「外周の錠は、停電しても閉じたままになる方式です。業者が来るのは、道が開いてから。夜明けまでは……」',
          '灰原：「西館の書斎には、旧い別回線の電話がございます。ただ、西館の鍵は前の管理人がキーボックスに入れたまま、番号を残しておりませんで」',
          '灰原：「『この館の時間』とだけ。……私には何のことやら」',
        ], set: 'hb_sealed' },
        { if: { flag: 'sealed' }, say: ['灰原：「キーボックスの番号、私には心当たりがございません。『この館の時間』……」'] },
        { if: { noflag: 'hb_t1' }, say: ['灰原：「お部屋は東館の、廊下の奥から二つ目です。お荷物を置かれましたら、19時に食堂へ」', 'カウンターの上の帳面に、灰原は左手で何かを書きつけた。'], set: 'hb_t1' },
        { say: ['灰原：「何かございましたら、何なりと」'] } ] },
      { id: 'mh_soichiro', npc: 'soichiro', x: 6, y: 3, acts: [
        { if: { noflag: 'so_t1' }, say: [
          '仕立てのいいスーツの男が、止まった柱時計を見上げていた。',
          '宗一郎：「御影宗一郎。この館は、もとは兄の研究所でね。今日は兄の命日だ」',
          '宗一郎：「……君は」',
          'こちらの顔を見た瞬間、男の顔から血の気が引いた。',
          '宗一郎：「如月……真帆さんの、娘さんか」',
          { choice: { id: 'admit_daughter', q: '自分は——', opts: [
            { label: '如月真帆の娘です、と答える', value: 'admit', set: 'admitted_daughter', trust: { soichiro: 1 },
              say: ['宗一郎：「……そうか。大きくなったな」', '宗一郎：「兄と君のお母さんは、同じ研究をしていた。……あの夜のことは、私もよく知らない」'] },
            { label: '「人違いです」とはぐらかす', value: 'deny', unity: -1,
              say: ['宗一郎：「……そうか。失礼した」', '男は目をそらしたが、それきりこちらを見ようとしなかった。'] },
          ] } },
        ], set: 'so_t1', meet: ['soichiro'] },
        { say: ['宗一郎：「この時計は、あの夜から止まったままだ。兄が……兄の口癖は『記録は嘘をつかない』だった」'] } ] },
      { id: 'mh_fuyuko', npc: 'fuyuko', x: 3, y: 11, acts: [
        { if: { noflag: 'fu_t1' }, say: [
          '年配の女性が、ベンチのそばに立っている。',
          '目が合った。……女性は目をそらさない。何かを言いかけて、やめた。',
          '女性：「……雨に濡れたでしょう。髪を拭きなさい。風邪をひくわ」',
          '名前を尋ねると、女性は少し笑った。',
          '女性：「神崎。……ただの年寄りよ」',
        ], set: 'fu_t1', meet: ['fuyuko'] },
        { say: ['冬子：「お夕食、ちゃんと食べるのよ」', '……どうしてこの人は、こんなふうに話すのだろう。'] } ] },
      { id: 'mh_mizuki', npc: 'mizuki', x: 8, y: 3, acts: [
        { if: { noflag: 'mizuki_t1' }, say: [
          '若い女性が「鐘楼の聖母」の前に立ち、額縁の角を指でなぞっている。',
          '美月：「……あ、ごめんなさい。白石です。修復の仕事をしていて」',
          '美月：「この絵、祖父が描いたんです。去年、私が修復して——」',
          '振り向いた美月が、こちらの顔を見て言葉を止めた。',
          '美月：「……この絵の人に、似てる」',
        ], set: 'mizuki_t1', trust: { mizuki: 1 } },
        { say: ['美月：「聖母のモデルが誰なのか、祖父は最後まで言わなかったんです」'] } ] },
      { id: 'mh_yu', npc: 'yu', x: 20, y: 4, acts: [
        { if: { noflag: 'yu_t1' }, say: ['悠：「早乙女です。建築士の。……この天井、外から見た高さと合わないな」'], set: 'yu_t1', trust: { yu: 1 } },
        { say: ['悠：「玄関ホールの奥行き、外から歩いた歩数より短い。壁が厚いのか、それとも……」'] } ] },
    ],
  });

  /* ================= 事務室 ================= */
  room({
    id: 'm_office', name: '事務室', area: 'entrance', level: '1F', map: [53, 15, 6, 7],
    W: 9, H: 8, ground: 'parquet', wall: paper(P.gray), amb: [64, 62, 80],
    exits: [{ id: 's', side: 'S', at: 4, to: 'm_hall:office' }],
    furn: [
      { t: 'desk', x: 2, y: 3, w: 2 }, { t: 'cabinet', x: 6, y: 2, w: 2 }, { t: 'phone', x: 1, y: 2 }, { t: 'lamp', x: 7, y: 5 },
    ],
    ins: [
      { id: 'of_desk', x: 2, y: 3, w: 2, acts: [
        { if: { noflag: 'got_register' }, say: ['机の引き出しに、古い宿泊者名簿が残っていた。', '表紙に「2008年」。最後の頁は11月14日。研究所の演奏会の客の名が並んでいる。'], give: 'register_2008', set: 'got_register' },
        { say: ['机の上に、管理会社の清掃員の勤務表。一週間前の欄に、見慣れない名前が一つ。', '「早瀬」。……誰だろう。'], set: 'saw_roster' } ] },
      { id: 'of_cab', x: 6, y: 2, w: 2, acts: [{ say: ['書類棚。招待状の控えの束が綴じてある。', '宛名はすべて印字。……自分の分の控えには、灰原の字で付箋が貼られていた。', '「この一通は保留。」'], set: 'saw_hold_note' }] },
      { id: 'of_phone', x: 1, y: 2, acts: [
        { if: { flag: 'sealed' }, say: ['受話器を取る。……何の音もしない。'] },
        { say: ['古い電話機。受話器を上げると、発信音が聞こえた。'] } ] },
    ],
  });

  /* ================= 東館 廊下 ================= */
  room({
    id: 'm_east', name: '東館 廊下', area: 'east', level: '1F', map: [58, 26, 16, 5],
    W: 24, H: 7, ground: 'plank', wall: paper(P.green), amb: [56, 60, 78],
    rugs: [{ x: 1, y: 3, w: 22, h: 2, c: [40, 84, 56] }],
    exits: [
      { id: 'w', side: 'W', at: 3, w: 2, to: 'm_hall:e' },
      { id: 'n_din', side: 'N', at: 3, to: 'm_dining:s' },
      { id: 'n_kit', side: 'N', at: 8, to: 'm_kitchen:s', lock: { flag: 'ch3_end', msg: ['厨房。「関係者以外立入禁止」の札。', '灰原が中から鍵を掛けているようだ。'] } },
      { id: 'n_guest', side: 'N', at: 13, to: 'm_guest:s' },
      { id: 'n_g2', side: 'N', at: 18, to: 'm_servant:s', lock: { flag: 'ch3_end', msg: ['冬子の部屋。……今はそっとしておこう。'] } },
      { id: 'staff', side: 'E', at: 3, w: 2, to: 'm_staff:w', lock: { flag: 'staff_open', msg: ['「職員専用」の扉。カードリーダーの灯は消えている。'] } },
    ],
    furn: [
      { t: 'wlamp', x: 6, y: 0 }, { t: 'wlamp', x: 16, y: 0 }, { t: 'plant', x: 22, y: 2 },
      { t: 'painting', x: 10, y: 0, w: 2, v: 'land2' },
      npc('ren', 15, 3, 'left', { showIf: 'greeted', hideIf: 'dinner_start' }),
      npc('kurose', 20, 4, 'up', { showIf: 'greeted', hideIf: 'dinner_start' }),
    ],
    ins: [
      { id: 'me_ren', npc: 'ren', x: 15, y: 3, acts: [
        { if: { noflag: 'ren_t1' }, say: ['蓮：「朝倉蓮、元記者。あんたの隣の部屋だ。……よろしく」'], set: 'ren_t1', trust: { ren: 1 } },
        { if: { noflag: 'ren_t2' }, say: [
          '蓮：「なあ、これ見てくれ」',
          '蓮はスマートフォンの写真を見せた。古い手帳の頁の写真だ。',
          '「11/14　22:30　K.M.と待ち合わせ——来ない」「23:58　館の方角に煙」',
          '蓮：「親父の手帳。K.M.は如月真帆。……親父は何を受け取るはずだったんだろうな」',
        ], set: 'ren_t2' },
        { say: ['蓮：「荷物置いたら、メシ行こうぜ」'] } ] },
      { id: 'me_kurose', npc: 'kurose', x: 20, y: 4, acts: [
        { if: { noflag: 'kurose_t1' }, say: ['黒瀬：「……探偵か。邪魔だけはするな」'], set: 'kurose_t1', meet: ['kurose'] },
        { say: ['黒瀬は自分の部屋の扉の前で、鍵穴を確かめている。', '黒瀬：「客室の鍵は、管理人が合鍵を持ってる。……覚えておけ」'] } ] },
    ],
  });

  /* ================= 客室（主人公） ================= */
  room({
    id: 'm_guest', name: '客室', area: 'east', level: '1F', map: [64, 19, 6, 7],
    W: 10, H: 9, ground: 'parquet', wall: paper(P.blue), amb: [56, 60, 84],
    rugs: [{ x: 3, y: 5, w: 4, h: 2, c: [60, 70, 110] }],
    exits: [{ id: 's', side: 'S', at: 4, to: 'm_east:n_guest' }],
    furn: [
      { t: 'window', x: 4, y: 0, w: 2 }, { t: 'bed', x: 1, y: 2, w: 2, h: 3, c: [90, 110, 160] }, { t: 'nightstand', x: 3, y: 2 },
      { t: 'desk', x: 6, y: 2, w: 2 }, { t: 'wardrobe', x: 8, y: 2 }, { t: 'trunk', x: 7, y: 6 },
    ],
    ins: [
      { id: 'gr_desk', x: 6, y: 2, w: 2, acts: [
        { if: { flag: 'sealed' }, say: ['机の上に招待状を広げた。', '「最後の鍵は、まだ誰の手にも渡っていません」……誰が、何のために。'] },
        { say: ['書き物机。便箋と、館の名の入った封筒が置いてある。', '封筒の宛名欄は、どれも印字用の枠になっていた。'] } ] },
      { id: 'gr_win', x: 4, y: 1, w: 2, acts: [
        { if: { flag: 'road_closed' }, say: ['雨が窓を叩いている。遠くで、何かが崩れる低い音がした。'] },
        { say: ['窓の外は霧。前庭の街灯が滲んで見える。'] } ] },
      { id: 'gr_trunk', x: 7, y: 6, acts: [{ say: ['自分の旅行鞄。着替えと、調査用の手帳。', '母について調べた資料の束は、館の客には見せないほうがいい気がした。'] }] },
    ],
  });

  /* ================= 食堂 ================= */
  // 夕食の席：上の列（下向き）と下の列（上向き）。NO.11 の席は右端で空いたまま
  const seatTop = [['ren', 5], ['mizuki', 7], ['kurose', 9], ['fuyuko', 11]];
  const seatBot = [['reina', 5], ['soichiro', 7], ['yu', 9], ['minato', 11]];
  const dinNpc = [];
  seatTop.forEach(([w, x]) => dinNpc.push(npc(w, x, 4, 'down', { showIf: 'dinner_start' })));
  seatBot.forEach(([w, x]) => dinNpc.push(npc(w, x, 7, 'up', { showIf: 'dinner_start' })));
  dinNpc.push(npc('kotone', 2, 2, 'down', { showIf: 'greeted', hideIf: 'dinner_start' }));
  dinNpc.push(npc('kotone', 13, 4, 'down', { showIf: 'dinner_start' }));
  dinNpc.push(npc('haibara', 15, 4, 'left', { showIf: 'dinner_start', hideIf: 'hb_left' }));
  const talk = (id, who, x, y, acts) => ({ id, npc: who, x, y, acts });
  room({
    id: 'm_dining', name: '食堂', area: 'east', level: '1F', map: [58, 16, 9, 10],
    W: 18, H: 12, ground: 'parquet', groundC: [110, 66, 40], wall: paper(P.rose), amb: [74, 58, 72],
    rugs: [{ x: 3, y: 4, w: 12, h: 5, c: [96, 26, 36] }],
    exits: [{ id: 's', side: 'S', at: 9, to: 'm_east:n_din' }],
    furn: [
      { t: 'window', x: 5, y: 0 }, { t: 'window', x: 12, y: 0 },
      { t: 'fireplace', x: 8, y: 0, w: 2 },
      { t: 'piano', x: 1, y: 3, w: 2 }, { t: 'cupboard', x: 15, y: 2, w: 2 },
      { t: 'longtable', x: 4, y: 5, w: 10, h: 2 },
      { t: 'chair', x: 14, y: 5, d: 'left' }, { t: 'placecard', x: 14, y: 6, nosolid: 1 },
      { t: 'plant', x: 1, y: 10 }, { t: 'plant', x: 16, y: 10 },
      { t: 'chandelier', x: 8, y: 5, w: 2 },
    ].concat(dinNpc),
    ins: [
      { id: 'dn_table', x: 4, y: 5, w: 10, h: 2, acts: [
        { if: { flag: 'invites_shown', noflag: 'watermark_solved' }, say: [
          '十人の招待状をテーブルに並べ、燭台の火にかざす。',
          '便箋の隅に、それぞれ一文字ずつ透かしが浮かんだ。封筒の番号ごとに並べると——',
          'NO.1 宗一郎「最」　NO.2 冬子「後」　NO.3 黒瀬「の」　NO.4 玲奈「鍵」　NO.5 悠「は」',
          'NO.6 美月「十」　NO.7 湊「一」　NO.8 蓮「に」　NO.9 琴音「分」　NO.10 {name}「け」',
          '……NO.11 の分がない。NO.11 は、空いたままの席。',
          { choice: { id: 'p02', q: '席札も含めて、文を読むと——', opts: [
            { label: '「最後の鍵は十一に分け」……続きはまだ分からない', value: 'half', say: ['……一文字足りない。空いた席のどこかに、もう一枚あるはずだ。'] },
            { label: '「最後の鍵は一つに分けた」', value: 'w1', say: ['……違う。「十」の透かしを読み落としている。'] },
            { label: '「最後の鍵は十一に分けた」', value: 'ok', set: 'watermark_solved', unity: 1, if: { flag: 'saw_placecard' },
              say: ['NO.11 の席札の透かしは「た」。', '——最後の鍵は十一に分けた。', '美月|玲奈：「十一……ここにいるのは、管理人さんを入れて十一人」', '蓮：「つまり、俺たち一人一人が、その『かけら』を持たされてるってことか」', '推理手帳に「LAST KEY：11のかけら」の頁ができた。'] },
          ] } },
        ] },
        { if: { flag: 'watermark_solved' }, say: ['「最後の鍵は十一に分けた」。十一人の、十一のかけら。'] },
        { if: { flag: 'dinner_done' }, say: ['冷めたスープと、手つかずの皿。'] },
        { say: ['長いテーブルに、十一人分の食器が並べられている。', '右端の席の前に、席札が一枚。「NO.11」。'] } ] },
      { id: 'dn_card', x: 14, y: 6, acts: [
        { if: { flag: 'invites_shown' }, say: ['NO.11 の席札。燭台にかざすと、隅に透かしの一文字が浮かんだ。', '「た」。'], set: 'saw_placecard' },
        { say: ['席札。「NO.11」とだけ印字されている。', '……招待状の差出人も「管理人　NO.11」だった。'] } ] },
      { id: 'dn_menu', x: 15, y: 2, w: 2, acts: [
        { if: { flag: 'dinner_start', noflag: 'got_menu' }, say: ['食器棚の上に、余ったメニューカードが重ねてある。手書きで、少し右下がりの癖のある字。', 'インクが左から右へこすれている。……左手で書いた字だ。'], give: 'menu_card', set: 'got_menu' },
        { if: { flag: 'got_menu' }, say: ['食器棚。メニューカードの束。'] },
        { say: ['食器棚。銀器が並んでいる。'] } ] },
      { id: 'dn_piano', x: 1, y: 3, w: 2, acts: [
        { if: { flag: 'dinner_start' }, say: ['古いピアノ。蓋の内側に、小さな傷で刻まれた四つの音符。'] },
        { say: ['古いピアノ。'] } ] },
      // 夕食前の琴音
      talk('dn_kotone0', 'kotone', 2, 2, [
        { if: { noflag: 'ko_t1' }, say: [
          '食堂のピアノで、若い女性が夜想曲を弾いている。',
          '曲は途中でふっと途切れた。……その続きを、気づけば口ずさんでいた。',
          '女性が振り返る。',
          '琴音：「……その続き、知ってるの？ この曲、楽譜にはなってないはずなのに」',
          '琴音：「水瀬琴音。……私、小さいころ、この館に来たことがあるの。母の演奏会で」',
          '琴音：「あの夜の鐘の音、まだ覚えてる」',
        ], set: 'ko_t1', trust: { kotone: 2 } },
        { say: ['琴音：「夕食、19時からだって。……少し怖いね、ここ」'] } ]),
      // 管理人（夕食の給仕のあいだ、食器棚のそば）
      { id: 'dn_haibara', npc: 'haibara', x: 15, y: 4, vis: { flag: 'dinner_start', noflag: 'hb_left' }, acts: [
        { if: { flag: 'invites_shown' }, say: ['灰原：「山道のことは、まことに申し訳ございません。お部屋は十分にございます」'] },
        { say: ['灰原：「紅茶をお持ちいたします。どうぞお席へ」'] } ] },
      // 夕食中・夕食後の会話
      talk('dn_ren', 'ren', 5, 4, [
        { if: { flag: 'sealed' }, say: ['蓮：「封鎖、か。……こうなると記者の勘が嫌な方に当たる」'] },
        { say: ['蓮：「NO.11ね。……招待状の差出人も、たしかそうだった」'] } ]),
      talk('dn_mizuki', 'mizuki', 7, 4, [
        { if: { flag: 'sealed' }, say: ['美月：「透かし、もっとよく見たいです。……燭台の火にかざせば読めるかも」'] },
        { say: ['美月：「招待状の紙、いい紙ですね。透かしが入ってる」'] } ]),
      talk('dn_kurose', 'kurose', 9, 4, [
        { if: { flag: 'sealed' }, say: ['黒瀬：「勝手に動き回るな。……と言っても聞かないんだろう、探偵は」'] },
        { say: ['黒瀬：「……」'] } ]),
      talk('dn_fuyuko', 'fuyuko', 11, 4, [
        { if: { flag: 'sealed' }, say: ['冬子：「大丈夫。朝になれば、きっと」', '……そう言う冬子の手が、膝の上で震えていた。'] },
        { say: ['冬子：「……ちゃんと食べなさい」'] } ]),
      talk('dn_reina', 'reina', 5, 7, [
        { if: { flag: 'sealed' }, say: ['玲奈：「……管理人さんの火傷。あれ、家の火事でできた形じゃないわ」', '玲奈：「顔をかばったときの、薬品の火の痕。救急で何度も見た」'], set: 'reina_burn' },
        { say: ['玲奈：「このスープ、冷めても美味しい。……なんて言ってる場合じゃないわね」'] } ]),
      talk('dn_soichiro', 'soichiro', 7, 7, [
        { if: { flag: 'sealed' }, say: ['宗一郎：「西館の書斎に、兄が使っていた別回線の電話がある。……鍵さえあれば」'] },
        { say: ['宗一郎：「兄の命日に、こんな茶番を」'] } ]),
      talk('dn_yu', 'yu', 9, 7, [
        { if: { flag: 'sealed' }, say: ['悠：「門だけじゃない。廊下の奥の防火扉も閉まってます。区画ごとに分けて閉じる仕組みだ」'] },
        { say: ['悠：「この食堂、窓が一つ塞がれてますね。外から見ると十二あるのに」'] } ]),
      talk('dn_minato', 'minato', 11, 7, [
        { if: { flag: 'sealed' }, say: ['湊：「中央管理システムの『障害』。……障害じゃない。誰かが命令を出してる」', '湊：「それに、モニターに流れてた映像。2008年の地下入口の映像だ。……俺が復元したやつだよ」'] },
        { say: ['湊：「電波、ほとんど入らないな」'] } ]),
      talk('dn_kotone', 'kotone', 13, 4, [
        { if: { flag: 'sealed' }, say: ['琴音：「灰原さんの鼻歌、聞いた？」', '琴音：「あの曲の六番目の音、半音低いの。……あの夜、この館で聞いた音と同じ」'], set: 'hum_noted' },
        { say: ['琴音：「さっきの続き、また聴かせてね」'] } ]),
    ],
  });

  /* ================= ルール（場面の進行） ================= */
  ELD.RULES = [
    // 前庭：バス停で蓮に呼ばれる
    // プロローグ：招待状を読むとバスが着く
    { if: { room: 'm_bus', noflag: 'bus_intro' }, set: ['bus_intro', 'bus_read'], say: [
          '膝の上の招待状を、もう一度読み返す。',
          
          '差出人は「エルディア館 管理人　NO.11」。宛名は手書きで、丁寧な右上がりの字。',
          '「十八年前の十一月十四日、エルディア館でひとつの記録が燃えました。けれど、燃えなかった記録もございます。」',
          '「あなたの母、如月真帆があの夜最後に何を記録したのか。その資料をお渡しします。」',
          '十八年前の今夜、あの館の地下で火事があった。一人が死に、母は消えた。',
          '首元のペンダントに触れる。母が残した、ただ一つのもの。',
          '——母は、私を置いて消えたのか。それを確かめに来た。',
          '（招待状とペンダントは「持ち物」からいつでも詳しく調べられる）',
    ] },
    { if: { room: 'm_bus', flag: 'bus_read', noflag: 'bus_arrive' }, set: 'bus_arrive', sfx: 'door', clock: '17:10', say: [
      'ぶしゅう、とブレーキの音。バスが止まった。',
      '運転手：「終点、エルディア館前です。……この先、帰りの便はありませんよ」',
      '前の扉が開いた。冷たい雨の匂い。',
      '（右下の前扉から降りよう。扉の前で下へ進む）',
    ] },
    { if: { room: 'm_yard', noflag: 'met_ren_intro' }, set: 'met_ren_intro', meet: ['ren'], face: { ren: 'right' }, say: [
      '男：「——〈{name}〉さん？」',
      '振り向くと、同じバスに乗っていた若い男が、停留所の標識にもたれていた。',
      '男：「やっぱり。あんた、如月真帆の娘だろ」',
      '……どうして、名前を。',
      '男：「悪い、驚かせた。朝倉蓮。俺も招待状をもらってね」',
      '霧の中、館の窓に灯りがともっている。門の内側には、他にも何人か人影が見えた。',
    ] },
    // 玄関ホールに初めて入る
    { if: { room: 'm_hall', flag: 'greeted', noflag: 'hall_intro' }, set: 'hall_intro', say: [
      '玄関ホールは暖かかった。',
      '奥の柱時計が、止まったまま23時35分を指している。',
      '既に何人かの客が着いていた。誰も、互いに顔見知りではないらしい。',
    ] },
    // 客室に荷物を置く
    { if: { room: 'm_guest', noflag: 'unpacked' }, set: 'unpacked', clock: '18:50', say: [
      '鞄を置き、ベッドに腰を下ろした。',
      '窓の外で雨が降り出している。',
      '……そろそろ19時だ。食堂へ行こう。',
    ] },
    // 夕食（1）
    { if: { room: 'm_dining', flag: 'unpacked', noflag: 'dinner_start' }, set: 'dinner_start', clock: '19:00', meet: ['ren', 'mizuki', 'kurose', 'fuyuko', 'reina', 'soichiro', 'yu', 'minato', 'kotone'], say: [
      '19時。食堂に十人の客がそろった。',
      '長いテーブルの右端、「NO.11」の席札の前だけが空いている。',
      '灰原：「皆さま、本日はお集まりいただきありがとうございます。主は所用で遅れております。どうぞ、お先に」',
      { choice: { id: 'seat', q: 'どの席に座る？', opts: [
        { label: '朝倉蓮の隣', value: 'ren', trust: { ren: 1 }, say: ['蓮：「お、隣どうぞ。……記者の隣は嫌だって顔してないな、よかった」'] },
        { label: '神崎（年配の女性）の隣', value: 'fuyuko', trust: { fuyuko: 1 }, say: ['冬子は何も言わず、こちらの皿にパンを一つ多く載せた。'] },
        { label: '桐島玲奈の隣', value: 'reina', trust: { reina: 1 }, say: ['玲奈：「足、大丈夫？ ……そう。よかった」'] },
      ] } },
    ] },
    // 夕食（2）：紅茶、招待状、道路
    { if: { flag: 'dinner_start', noflag: 'invites_shown' }, set: ['invites_shown', 'road_closed'], clock: '19:40', say: [
      '灰原が紅茶を注いで回る。',
      'カップを置き、スプーンで反時計回りに混ぜる。……変わった混ぜ方だ。',
      '……美月のカップにだけ、灰原は盆の端の小さなポットから注いだ。',
      '美月がカップを持ち上げる。湯気にまじって、ほんのかすかに、苦いアーモンドのような匂い。',
      { choice: { id: 'mizuki_cup', checkpoint: true, q: '美月が紅茶に口をつけようとしている。——', opts: [
        { label: '気のせいだと思う', value: 'ignore', say: ['美月は小さく息を吹きかけて、紅茶を口にした。'] },
        { label: '灰原に「それは何の茶葉ですか」と聞く', value: 'ask', say: ['灰原：「ミントでございます。白石様はお好きだと伺いましたので」', '美月：「……え？ 私、言ったかな」', '美月は首をかしげながら、紅茶を口にした。'] },
        { label: '「待って」と美月の手を止め、カップを取り上げる', value: 'save', set: 'mizuki_saved', trust: { mizuki: 2 }, unity: 1,
          say: ['美月：「え……？」', 'カップを取り上げ、自分の皿の脇に置いた。灰原は表情を変えずに一礼した。', '灰原：「失礼いたしました。淹れ直してまいります」', '……あのポットの中身は、何だったのか。'] },
      ] } },
      '低い鼻歌が聞こえた。さっき琴音が弾いていた曲に似ている。',
      '琴音のスプーンが、かちりと皿に当たった。',
      '冬子は、灰原の手元を見つめたまま動かない。',
      '宗一郎：「……招待状を出したのは誰だ。管理人、君か」',
      '灰原：「私は管理会社から、お客様をお迎えするよう申しつかっただけでございます」',
      '蓮：「なら見せ合おうぜ。どうせ同じ差出人だろ」',
      '十人がそれぞれ招待状を出した。文面はどれも同じ。違うのは、一人ずつに書かれた「渡すもの」の一文だけ。',
      '——最後の鍵は、まだ誰の手にも渡っていません。',
      '灰原：「……失礼。麓の業者から連絡がございました。19時ごろ、山道が土砂で塞がったそうです。今夜は皆さま、こちらでお休みください」',
      '外では雨が強くなっていた。',
    ] },
    // 夕食（3）：放送
    { if: { flag: 'invites_shown', noflag: 'dinner_done' }, set: ['dinner_done', 'hb_left'], clock: '20:40', say: [
      '灰原：「ワインをお持ちいたします」',
      '灰原が食堂を出ていった。……数分後。',
      '天井のスピーカーから、ざらついた雑音。',
      '声：「死んだのは、誰か」',
      '声：「十八年前の今夜、この館の地下で何があったのか。夜明けまでに答えよ。答えなければ、記録はすべて燃える」',
      '声：「——如月真帆の娘よ。お前は、見たはずだ」',
      '隣の美月が、青い顔でつぶやいた。「……この声、どこかで……」',
      '放送が切れた。全員の目が、こちらに向いた。',
      { choice: { id: 'admit_broadcast', q: '皆が見ている。——', opts: [
        { label: '「如月真帆は、私の母です」と認める', value: 'admit', set: 'admitted_daughter', unity: 1,
          say: ['蓮：「……やっぱりな」', '冬子が、小さく息を吐いた。'] },
        { label: '「何のことか分かりません」と言う', value: 'deny', unity: -1,
          say: ['黒瀬：「……嘘が下手だな、探偵」', '空気が冷えた。'] },
      ] } },
      '宗一郎：「冬子さん……あなた、神崎冬子さんだろう。昔ここにいた」',
      '黒瀬：「元の使用人か。……館の中を知ってる人間なら、放送くらい流せる」',
      '冬子は黙ってうつむいた。',
      { choice: { id: 'defend_fuyuko', q: '——', opts: [
        { label: '「放送の間、この人はずっとここにいました」とかばう', value: 'defend', set: 'fuyuko_named', trust: { fuyuko: 1, kurose: -1 },
          say: ['黒瀬：「……ふん」', '冬子が、ほんの少しだけこちらを見た。'] },
        { label: '黙って様子を見る', value: 'silent', set: 'fuyuko_named', trust: { fuyuko: -1 },
          say: ['冬子は何も言い返さなかった。'] },
      ] } },
      '宗一郎：「……皆、持ってきた資料は一か所に集めて、管理人に預けたほうがいい。盗まれでもしたら」',
      { choice: { id: 'gather_docs', q: '資料を一か所に集める案に——', opts: [
        { label: '賛成する', value: 'agree', set: 'docs_gathered', trust: { soichiro: 1 }, say: ['何人かが鞄から資料を出し、宗一郎がそれを箱にまとめた。'] },
        { label: '反対する（それぞれが自分で持つ）', value: 'refuse', trust: { kurose: 1 }, say: ['黒瀬：「同感だ。人に預ける気はない」', '結局、資料はそれぞれが持つことになった。'] },
      ] } },
    ] },
    // 封鎖（美月のカップを止めたとき）
    { if: { flag: ['dinner_done', 'mizuki_saved'], noflag: 'sealed' }, set: 'sealed', clock: '21:30', sfx: 'door', say: [
      '21時30分。',
      'ばちん、と音を立てて照明が半分落ちた。非常灯の緑の光。',
      '遠くで、重い錠の落ちる音が続けざまに響く。',
      '湊：「——門だ。外周の電子錠が閉じた！」',
      '湊：「電波もない。圏外。……電話は？」',
      '蓮：「固定電話、死んでる」',
      '食堂の壁のモニターに、白黒の映像が流れ始めた。どこかの地下の入口。画面の隅の日付は「2008/11/14」。',
      '湊：「……これ、俺が復元してた映像だ。なんでここに」',
      'しばらくして灰原が戻ってきた。ワインは持っていない。',
      '灰原：「中央管理システムの障害のようです。……夜明けまで、館の外へは出られません」',
      '灰原：「私は玄関ホールの管理室におります。何かあればお申しつけください」',
      '暗がりで、美月がこちらの袖をそっとつかんだ。',
      '美月：「……さっきのカップ、ありがとう。なんだか、変な匂いがしてた」',
      '雨が窓を叩いていた。',
    ] },
    // 封鎖（美月の死）：お茶の選択で防げる
    { if: { flag: 'dinner_done', noflag: ['sealed', 'mizuki_saved'] }, set: 'sealed', clock: '21:30', sfx: 'door', fx: 'dark',
      kill: { id: 'mizuki', ch: 1, cause: '毒の紅茶', at: ['m_dining', 7, 3], cue: '玲奈が首に指を当て', fx: 'tea' }, say: [
      '21時30分。',
      'ばちん、と音を立てて照明が半分落ちた。非常灯の緑の光。',
      '遠くで、重い錠の落ちる音が続けざまに響く。',
      '湊：「——門だ。外周の電子錠が閉じた！」',
      '湊：「電波もない。圏外。……電話は？」',
      '蓮：「固定電話、死んでる」',
      '非常灯の緑の中で、がたん、と椅子の倒れる音。',
      '美月が、テーブルに崩れ落ちていた。指先から、空のカップが転がる。',
      '玲奈：「白石さん！ ……白石さん！」',
      '玲奈が首に指を当て、しばらくして、ゆっくりと首を横に振った。',
      '美月の唇のあたりから、苦いアーモンドのような匂いがした。……あのときの紅茶だ。',
      '食堂の壁のモニターに、白黒の映像が流れ始めた。どこかの地下の入口。画面の隅の日付は「2008/11/14」。',
      '湊：「……これ、俺が復元してた映像だ。なんでここに」',
      'しばらくして灰原が戻ってきた。ワインは持っていない。',
      '灰原：「中央管理システムの障害のようです。……夜明けまで、館の外へは出られません」',
      '灰原：「……なんということを。私は玄関ホールの管理室におります。何かあれば」',
      '誰も、何も言わなかった。雨が窓を叩いていた。',
    ] },
    { if: { flag: 'dead_mizuki', noflag: 'mizuki_bag' }, set: ['mizuki_bag', 'frag_mizuki', 'mizuki_notes'], give: ['uv_light', 'frame_docs'], say: [
      '美月の鞄に、修復用の紫外線ライトと、古い紙の束が入っていた。',
      '手帳の最後の頁。「祖父の額縁の裏の資料——真帆さんの手順書と請求書。NO.11に写真を売ってしまった。明日、全部話す」',
      '……明日は、来なかった。',
    ] },
    // 第1章の終わり：西館の鍵と透かしの両方がそろう
    { if: { flag: ['got_west_key', 'watermark_solved'], noflag: 'ch1_end' }, set: ['ch1_end', 'clock_moving'], clock: '22:05', sfx: 'bell', say: [
      '——ごうん。',
      '玄関ホールの方から、重い音が響いた。',
      '駆けつけると、止まっていたはずの柱時計の振り子が、揺れていた。',
      '十八年ぶりに、館の時間が動き出した。',
    ], chapterEnd: { title: '第1章　招かれた者たち', sub: '柱時計が、十八年ぶりに動き出した。', next: '次は第2章「消えた証言」。西館の扉が開いた。（記録はオートセーブされました）' } },
  ];

  /* ================= アイテム ================= */
  ELD.ITEM_CATS = [
    { id: 'key', name: '鍵・道具' },
    { id: 'doc', name: '書類・手紙' },
    { id: 'photo', name: '写真・記録' },
    { id: 'special', name: '大切な物' },
  ];
  ELD.ITEMS = {
    invitation: {
      name: '自分宛ての招待状', cat: 'doc', icon: 'letter', c: '#e8dcc0', important: true,
      desc: '「十八年前の十一月十四日、エルディア館でひとつの記録が燃えました。けれど、燃えなかった記録もございます。」差出人は「エルディア館 管理人　NO.11」。',
      found: '最初から持っている',
      hotspots: [
        { id: 'addr', side: 'front', x: 14, y: 22, w: 36, h: 10, text: '宛名は「{name} 様」。……手書きだ。右上がりの、丁寧な右利きの字。住所は今住んでいる部屋のもの。' },
        { id: 'post', side: 'back', x: 24, y: 24, w: 16, h: 16, text: '消印は館のある町ではなく、ずっと遠くの町の郵便局。日付は、招待の一週間前。' },
        { id: 'wm', side: 'front', x: 6, y: 40, w: 52, h: 14, need: 'light', text: '光にかざすと、便箋の隅に透かしの一文字。「け」。' },
      ],
    },
    pendant: {
      name: '母のペンダント', cat: 'special', icon: 'locket', c: '#c8a0e0', important: true,
      desc: '母が遺した銀のペンダント。裏に四つの音符と「鐘は嘘をつかない」の刻印。',
      found: '最初から持っている（母の形見）',
      hotspots: [
        { id: 'notes', side: 'back', x: 16, y: 18, w: 32, h: 20, text: '四つの音符が刻まれている。……琴音の弾いていた夜想曲の、最初の四音と同じ形だ。' },
        { id: 'words', side: 'front', x: 14, y: 40, w: 36, h: 10, text: '縁に細い字で「鐘は嘘をつかない」。' },
      ],
    },
    menu_card: {
      name: 'メニューカード', cat: 'doc', icon: 'record', c: '#f0e8d4',
      desc: '夕食の献立。手書き。インクが左から右へこすれている——左手で書いた字だ。',
      found: '第1章・食堂の食卓',
      hotspots: [{ id: 'ink', side: 'front', x: 10, y: 16, w: 44, h: 30, need: 'zoom', text: '少し右下がりの癖字。横線の終わりがかすれ、手の側面でこすった跡がある。左利きの人の書き方だ。' }],
    },
    register_2008: {
      name: '2008年の宿泊者名簿', cat: 'photo', icon: 'book', c: '#6a4a3a',
      desc: '2008年11月14日の演奏会の客の名簿。水瀬遥（ピアニスト）と、その娘・琴音（4歳）の名もある。',
      found: '第1章・事務室の机',
      hotspots: [{ id: 'list', side: 'front', x: 8, y: 10, w: 48, h: 40, text: '11月14日。演奏会。「水瀬遥」「水瀬琴音（4）」。研究員の欄に「如月真帆」、所長「御影怜司」。' }],
    },
    west_key: {
      name: '西館の鍵', cat: 'key', icon: 'key', c: '#9ab0d8',
      desc: 'キーボックスにあった西館の鍵。札に「西館」。',
      found: '第1章・玄関ホールのキーボックス（番号2335）',
    },
  };
  ELD.COMBOS = [];
  ELD.COMBO_FAIL = ['組み合わせてみたが、何も分からない。'];

  /* ================= 推理手帳 ================= */
  ELD.NOTES = [
    // 証言
    { id: 't_ren', cat: 'testimony', evidence: true, title: '朝倉圭介の手帳', who: '蓮', text: '「11/14 22:30 K.M.と待ち合わせ——来ない」「23:58 館の方角に煙」。K.M.は如月真帆。', unlock: { flag: 'ren_t2' } },
    { id: 't_minato', cat: 'testimony', evidence: true, title: '門の仕様', who: '湊', text: '門は館の中央管理システムに繋がっている。停電しても閉じたままになる方式で、去年入れ替えたばかり。', unlock: { flag: 'minato_t1' } },
    { id: 't_yu', cat: 'testimony', evidence: true, title: '足りない窓', who: '悠', text: '公式図面では一階の窓は十二。実物は十一。', unlock: { flag: 'yu_t1' } },
    { id: 't_soichiro', cat: 'testimony', evidence: true, title: '兄の命日', who: '宗一郎', text: '館はもとは兄・御影怜司の研究所。今日は兄の命日。兄の口癖は「記録は嘘をつかない」。', unlock: { flag: 'so_t1' } },
    { id: 't_kotone', cat: 'testimony', evidence: true, title: 'あの夜の鐘', who: '琴音', text: '4歳のとき、母の演奏会でこの館に来た。あの夜の鐘の音を覚えている。', unlock: { flag: 'ko_t1' } },
    { id: 't_hum', cat: 'testimony', evidence: true, title: '鼻歌の六番目の音', who: '琴音', text: '灰原の鼻歌は、夜想曲の六番目の音が半音低い。「あの夜、この館で聞いた音と同じ」。', unlock: { flag: 'hum_noted' } },
    { id: 't_burn', cat: 'testimony', evidence: true, title: '火傷の形', who: '玲奈', text: '灰原の火傷は家の火事ではなく、顔をかばったときの薬品火災の痕。', unlock: { flag: 'reina_burn' } },
    { id: 't_broadcast', cat: 'testimony', evidence: true, title: '館内放送', who: '声', text: '「死んだのは誰か。夜明けまでに答えよ。答えなければ記録はすべて燃える」「如月真帆の娘よ。お前は、見たはずだ」。放送の間、灰原だけがいなかった。', unlock: { flag: 'dinner_done' } },
    { id: 't_hold', cat: 'testimony', evidence: true, title: '保留の付箋', who: '事務室', text: '自分の分の招待状の控えに、灰原の字で「この一通は保留。」', unlock: { flag: 'saw_hold_note' } },
    // 時系列
    { id: 'tl_2008', cat: 'timeline', time: '2008/11/14 夜', title: '研究所の火災', text: '館の地下の研究所で火災。所長・御影怜司は死亡と推定、研究員・如月真帆は失踪。', unlock: { start: true } },
    { id: 'tl_clock', cat: 'timeline', time: '館の時計 23:35', title: '止まった柱時計', text: '玄関ホールの柱時計は23時35分で止まっている。', unlock: { flag: 'saw_clock' } },
    { id: 'tl_arrive', cat: 'timeline', time: '今夜 17:10', title: '館に着く', text: '最終バスで館に着いた。招待状は自分を含めて十人に届いていた。', unlock: { start: true } },
    { id: 'tl_road', cat: 'timeline', time: '今夜 19:00ごろ', title: '道路が塞がる', text: '雨で麓への唯一の道が土砂で塞がった（灰原の話）。', unlock: { flag: 'road_closed' } },
    { id: 'tl_seal', cat: 'timeline', time: '今夜 21:30', title: '館の封鎖', text: '外周の電子錠が閉じ、電波と電話が切れた。モニターに2008年の地下入口の映像。', unlock: { flag: 'sealed' } },
    // 未解決の謎
    { id: 'm_seal', cat: 'mystery', title: '閉じた門', text: '停電しても閉じたままの電子錠。中からは開けられない。', unlock: { flag: 'sealed' }, resolve: 'never', resolvedText: '' },
    { id: 'm_keybox', cat: 'mystery', title: 'キーボックスの四桁', text: '蓋の裏に「この館の時間」。西館の鍵が入っている。', unlock: { flag: 'hb_sealed' }, resolve: 'got_west_key', resolvedText: '止まった柱時計の時刻 23:35 →「2335」で開いた。西館の鍵を手に入れた。' },
    { id: 'm_watermark', cat: 'mystery', title: '招待状の透かし', text: '十通の招待状に一文字ずつ透かし。NO.11 の分が見つからない。', unlock: { flag: 'invites_shown' }, resolve: 'watermark_solved', resolvedText: '「最後の鍵は十一に分けた」。十一人が、それぞれかけらを持たされている。' },
    { id: 'm_cutline', cat: 'mystery', title: '切られた電話線', text: '外壁の端子箱の引込線が刃物で切られていた。封鎖は故障ではない。', unlock: { flag: 'saw_cut_line' }, resolve: 'never', resolvedText: '' },
    // 未解決の疑問
    { id: 'q_mother', cat: 'question', title: '母はなぜ消えたのか', text: '如月真帆は十八年前の今夜、この館から消えた。自分を置いて逃げたのか。', unlock: { start: true }, resolve: 'never', resolvedText: '' },
    { id: 'q_no11', cat: 'question', title: 'NO.11 は誰か', text: '招待状の差出人「管理人 NO.11」。夕食の席は空いたまま。', unlock: { flag: 'dinner_start' }, resolve: 'never', resolvedText: '' },
    { id: 'q_hand', cat: 'question', title: '自分の招待状だけ手書き', text: '宛名が手書きで、消印は遠くの町。灰原の控えには「保留」の付箋。誰が出したのか。', unlock: { examined: 'item:invitation:addr' }, resolve: 'never', resolvedText: '' },
    { id: 'q_ren_father', cat: 'question', title: '蓮の父はなぜ死んだのか', text: '朝倉圭介は2010年、当て逃げの事故で死んだ。犯人は見つかっていない。', unlock: { flag: 'ren_t2' }, resolve: 'never', resolvedText: '' },
  ];

  ELD.ROOMS = {};
  R.forEach((r) => (ELD.ROOMS[r.id] = r));
  ELD.ROOM_LIST = R;
})();
