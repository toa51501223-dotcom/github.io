/* =====================================================================
 * アイテム・組み合わせ・推理手帳のデータ（ロジックから分離）
 * ---------------------------------------------------------------------
 * ITEMS[id]
 *   name, cat('key'|'doc'|'photo'|'special'), icon(小アイコン), c(色)
 *   desc       : 説明（{name} は主人公名）
 *   important  : 重要アイテム（専用の発見演出）
 *   found      : 発見場所（プレイヤーに表示）
 *   origin     : 設計上の配置理由 {who 誰が置いたか, why なぜそこにあるか, hidden なぜ今まで見つからなかったか}
 *   hotspots   : 調査画面の注目点 [{id, side:'front'|'back', x,y,w,h(64格子), need?:'light'|'rot180'|'zoom', text, set?, note?}]
 *   links      : 関連する手帳の項目ID
 * COMBOS: [{a, b, set?, give?, take?, say, note?}]（順不同）
 * NOTES : 推理手帳。unlock / resolve 条件で自動記録
 * ※ 中身は仮の物語（マップ確認用）。シナリオ本編で差し替える前提
 * ===================================================================== */
(function () {
  const ELD = (window.ELD = window.ELD || {});

  ELD.ITEM_CATS = [
    { id: 'key', name: '鍵・道具' },
    { id: 'doc', name: '書類・手紙' },
    { id: 'photo', name: '写真・記録' },
    { id: 'special', name: '特殊アイテム' },
  ];

  ELD.ITEMS = {
    /* ---------- 持ち込み（最初から所持） ---------- */
    sealed_letter: {
      name: '封蝋付きの手紙', cat: 'doc', icon: 'letter', c: '#e8dcc0', important: true,
      desc: '館に招かれた理由のすべて。宛名は「{name} 様」。差出人の名はない。',
      found: '最初から持っている',
      origin: { who: '差出人不明（館の主の名義）', why: '主人公を館へ招くための招待状', hidden: '主人公宛てに郵送された' },
      hotspots: [
        { id: 'addr', side: 'front', x: 14, y: 22, w: 36, h: 10, text: '宛名「{name} 様」。インクは新しい。' },
        { id: 'seal', side: 'back', x: 24, y: 24, w: 16, h: 16, text: '封蝋に星・月・太陽の紋章。館の甲冑にも同じ紋章があった。', note: 'm_pedestal_hint' },
        { id: 'wm', side: 'front', x: 6, y: 40, w: 52, h: 14, need: 'light', text: '光にかざすと透かしが浮かぶ。「時は止まり、館は待つ」。' },
      ],
      links: ['q_who'],
    },
    locket: {
      name: '装飾付きロケット', cat: 'special', icon: 'locket', c: '#d8b25a', important: true,
      desc: '物心ついた時から持っている銀のロケット。留め金が固く、開けたことはない。',
      found: '最初から持っている',
      origin: { who: '主人公の生みの母', why: '幼い主人公の首にかけられていた', hidden: '留め金が錆びて開かなかった' },
      hotspots: [
        { id: 'clasp', side: 'front', x: 28, y: 4, w: 8, h: 8, need: 'zoom', text: '拡大すると、留め金の錆の下に小さな押しボタンがある。押すと——カチリと開いた。', set: 'locket_open' },
        { id: 'notes', side: 'back', x: 12, y: 36, w: 40, h: 16, text: '内側に4つの音符。ミ・レ・ド・レ。', note: 'f_notes' },
        { id: 'photo', side: 'back', x: 18, y: 8, w: 28, h: 24, text: '小さな写真。幼い子を抱いた女性。顔は擦れて分からない。' },
      ],
      links: ['f_notes'],
    },

    /* ---------- 鍵・道具 ---------- */
    guest_key: {
      name: '客室の鍵束', cat: 'key', icon: 'keyring', c: '#d8c070',
      desc: '東館2階・客室1〜5の合鍵。小さな鍵が一本混じっている。',
      found: '玄関ホール・受付カウンターの引き出し',
      origin: { who: '受付係', why: '客室の合鍵を受付で管理していた', hidden: '受付は10年間無人だった' },
      hotspots: [{ id: 'tiny', side: 'front', x: 40, y: 34, w: 12, h: 14, need: 'zoom', text: '小さな鍵の札に「展示ケース」とある。', set: 'know_case_key' }],
    },
    study_key: {
      name: '青い装飾の銀鍵', cat: 'key', icon: 'key', c: '#7fa6d8',
      desc: '持ち手に青いエナメルの装飾がある銀の鍵。どこの鍵かは書かれていない。',
      found: '客室3・衣装箪笥のコートのポケット',
      origin: { who: '館に泊まっていた客', why: '書斎で館の主と会う約束があり、鍵を預かっていた', hidden: '客室3は施錠され、コートは箪笥の奥にあった' },
      hotspots: [{ id: 'eng', side: 'back', x: 6, y: 24, w: 20, h: 16, text: '持ち手の裏に小さく「書斎」と刻まれている。', set: 'know_study_key' }],
    },
    tower_key: {
      name: '真鍮の装飾鍵', cat: 'key', icon: 'gearkey', c: '#c8a050',
      desc: '持ち手が歯車の形をした重い真鍮の鍵。',
      found: '書斎・執務机の引き出し',
      origin: { who: '館の主', why: '時計塔への立ち入りを自分だけに限るため', hidden: '書斎そのものが施錠されていた' },
      hotspots: [
        { id: 'bow', side: 'front', x: 2, y: 18, w: 26, h: 26, text: '歯車の形。玄関ホール北の扉の鍵穴と同じ形だ。' },
        { id: 'year', side: 'back', x: 34, y: 28, w: 24, h: 8, need: 'zoom', text: '軸に「1847」の刻印。館の創建年と同じ数字。' },
      ],
    },
    archive_key: {
      name: '資料保管室の鍵', cat: 'key', icon: 'key', c: '#80b0a0',
      desc: '番号札「Ⅲ」の付いた鍵。', found: '書斎・金庫',
      origin: { who: '館の主', why: '保管室の資料を他人に見せないため', hidden: '番号の分からない金庫の中' },
    },
    cellar_key: {
      name: '地下の鍵', cat: 'key', icon: 'key', c: '#8a7060',
      desc: '錆びた南京錠の鍵。札に「地下 扉・書庫」。', found: '資料保管室・ファイルの間',
      origin: { who: '研究員', why: '地下研究施設の扉と書庫の共通鍵', hidden: '封鎖後、ファイルに挟まれたまま忘れられた' },
      hotspots: [{ id: 'tag', side: 'front', x: 36, y: 30, w: 20, h: 18, text: '札の裏「地下 扉・書庫」。地下の書庫にも合うらしい。' }],
    },
    director_key: {
      name: '館長室の鍵', cat: 'key', icon: 'key', c: '#f0c040',
      desc: '金の象嵌が施された鍵。', found: '地下資料室・キャビネットの封筒',
      origin: { who: '職員', why: '館長不在時のための予備鍵', hidden: '地下が封鎖され、封筒ごと残された' },
      hotspots: [{ id: 'inlay', side: 'front', x: 4, y: 20, w: 24, h: 24, need: 'zoom', text: '象嵌の模様は、三日月を抱く太陽。同じ模様の鍵穴がどこかにあるはずだ。' }],
    },
    staff_card: {
      name: '職員カード', cat: 'key', icon: 'card', c: '#60a0d0',
      desc: '「エルディア館 管理部」のカードキー。', found: '時計内部・作業台',
      origin: { who: '使用人', why: '館の主に見つからないよう塔に隠した', hidden: '時計塔は10年間閉ざされていた' },
      hotspots: [{ id: 'stripe', side: 'back', x: 4, y: 14, w: 56, h: 8, text: '磁気帯の下に手書きで「職員専用扉」。' }],
    },
    gear: {
      name: '真鍮の歯車', cat: 'special', icon: 'gear', c: '#d0a040', important: true,
      desc: '時計塔の機構の一部。表面が古い油でぬめっていて、素手では滑りそうだ。',
      found: '倉庫奥の隠し収納庫・木箱',
      origin: { who: '使用人', why: '館の主の命令で塔から外し、隠した', hidden: '倉庫の棚の裏の隠し部屋にあった' },
      hotspots: [{ id: 'oil', side: 'front', x: 18, y: 18, w: 28, h: 28, text: '指で触れると油でぬるりと滑る。手を守るものが要る。', note: 'm_gear' }],
    },
    gloves: {
      name: '古い手袋', cat: 'key', icon: 'glove', c: '#8a6040',
      desc: '油の染みた時計職人の革手袋。これなら油まみれの物も滑らずに掴める。',
      found: '時計塔入口・木箱',
      origin: { who: '時計職人', why: '塔の機構の手入れに使っていた', hidden: '塔は10年間閉ざされていた' },
      hotspots: [{ id: 'wear', side: 'front', x: 2, y: 6, w: 26, h: 20, need: 'zoom', text: '左手の指先だけが擦り切れている。持ち主は左利きだったらしい。' }],
    },

    /* ---------- 書類・手紙 ---------- */
    research_note: {
      name: '黒革の研究ノート', cat: 'doc', icon: 'book', c: '#3a3038', important: true,
      desc: '地下研究室の書庫に収められていたノート。被験者の記録が並ぶ。',
      found: '研究室・鍵付きの書庫',
      origin: { who: '主任研究員', why: '実験記録を地下に保管していた', hidden: '書庫は施錠され、地下は封鎖されていた' },
      hotspots: [
        { id: 'subj', side: 'back', x: 8, y: 10, w: 48, h: 16, text: '「被験者E——写真添付」。だが写真は剥がされ、跡だけが残る。', note: 'q_photo' },
        { id: 'ink', side: 'back', x: 8, y: 40, w: 48, h: 14, need: 'light', text: '光にかざすと、消された一行が読める。「娘を、永遠に」。' },
      ],
      links: ['q_photo'],
    },
    blueprint: {
      name: '地下施設の設計図', cat: 'doc', icon: 'blueprint', c: '#5a7fc4', important: true,
      desc: '館の改修時の図面。倉庫の東壁に×印がある。',
      found: '資料保管室・建築資料ケース',
      origin: { who: '改修を請け負った建築士', why: '改修記録として保管室に納めた', hidden: '保管室は施錠されていた' },
      hotspots: [
        { id: 'mark', side: 'front', x: 40, y: 8, w: 18, h: 16, text: '倉庫の東壁に×印。「可動棚・左下の留め具を外す」。', note: 'm_shelf_hint' },
        { id: 'tower', side: 'front', x: 4, y: 4, w: 16, h: 18, text: '時計塔と地下が同じ配線でつながっている。' },
        { id: 'stamp', side: 'back', x: 20, y: 40, w: 24, h: 16, text: '裏に「改修図 確認済」の印。' },
      ],
    },
    incident_record: {
      name: '事件当日の記録資料', cat: 'doc', icon: 'record', c: '#d8d0b8',
      desc: '10年前の11月14日の来客名簿と、その夜の出来事の記録。',
      found: '資料保管室・キャビネット',
      origin: { who: '執事', why: '館の出来事を毎日記録していた', hidden: '保管室は施錠され、誰も読み返さなかった' },
      hotspots: [
        { id: 'stop', side: 'front', x: 6, y: 34, w: 52, h: 8, text: '「23:50 館中の時計が一斉に停止」。', note: 'tl_clock' },
        { id: 'flip', side: 'front', x: 6, y: 50, w: 52, h: 8, need: 'rot180', text: '逆さに書かれた走り書き。「鏡を見よ。湯気が答える」。' },
      ],
    },
    music_score: {
      name: '古い楽譜', cat: 'doc', icon: 'score', c: '#e8e0c8',
      desc: '題名「エマのための夜想曲」。', found: '玄関ホール・柱時計の小窓',
      origin: { who: '館の主', why: '時計が動いた時にだけ開く小窓に隠した', hidden: '時計が止まっている間は小窓が開かない' },
      hotspots: [{ id: 'first', side: 'front', x: 6, y: 16, w: 22, h: 12, text: '冒頭の4音に丸印。ミ・レ・ド・レ。' }],
    },

    /* ---------- 写真・記録 ---------- */
    burnt_photo: {
      name: '焼け焦げた写真', cat: 'photo', icon: 'photo', c: '#a08060',
      desc: '暖炉の灰の中で燃え残った写真。男と少女。少女の顔は焼けている。',
      found: '食堂・暖炉の灰受けの奥',
      origin: { who: '館の主', why: '家族の写真を燃やそうとした', hidden: '灰受けの奥に落ち、10年間暖炉は掃除されなかった' },
      hotspots: [
        { id: 'back', side: 'back', x: 6, y: 18, w: 52, h: 20, text: '裏に走り書き。「塔の歯車を外せ。時を止め——」。' },
        { id: 'man', side: 'front', x: 8, y: 14, w: 20, h: 36, text: '男の襟に、館の紋章のピン。' },
      ],
      links: ['q_photo'],
    },
    cracked_watch: {
      name: 'ひび割れた懐中時計', cat: 'photo', icon: 'watch', c: '#c0c0c8',
      desc: 'ガラスにひびの入った懐中時計。11時50分で止まっている。',
      found: '絵画展示室・鍵付きのガラスケース',
      origin: { who: '館の主', why: '止まった時刻の記念として展示した', hidden: '展示品として見えてはいたが、ケースは施錠されていた' },
      hotspots: [
        { id: 'hands', side: 'front', x: 22, y: 22, w: 20, h: 20, text: '針は11時50分。秒針も止まっている。' },
        { id: 'lid', side: 'back', x: 14, y: 18, w: 36, h: 26, need: 'zoom', text: '裏蓋の刻印「鐘とともに眠れ」。鐘の記録と照らせば何か分かるかもしれない。', note: 'q_time' },
      ],
    },
    old_tape: {
      name: '古い録音テープ', cat: 'photo', icon: 'tape', c: '#4a4a52',
      desc: '研究室の録音機に残っていたリールテープ。ラベル「11/14 23時の鐘」。',
      found: '研究室・録音機',
      origin: { who: '研究員', why: '館の時刻記録として鐘を録音していた', hidden: '地下が封鎖され、録音機に入ったまま' },
      hotspots: [{ id: 'label', side: 'front', x: 10, y: 44, w: 44, h: 10, text: 'ラベル「11/14 23時の鐘 — 録音No.12」。' }],
    },
    portrait_shard: {
      name: '欠けた肖像画の破片', cat: 'photo', icon: 'shard', c: '#b08070',
      desc: '油彩の肖像画の一片。少女の目元が描かれている。',
      found: '倉庫奥の隠し収納庫・木箱',
      origin: { who: '使用人', why: '館の主が割った肖像画の欠片を、捨てずに隠した', hidden: '隠し収納庫は棚の裏にあった' },
      hotspots: [{ id: 'label', side: 'back', x: 8, y: 40, w: 48, h: 10, text: '裏の題名札の切れ端「永遠の……」。展示室の肖像画と同じ題だ。' }],
    },

    /* ---------- 特殊アイテム ---------- */
    star_emblem: { name: '星の紋章', cat: 'special', icon: 'star', c: '#c8d8ff', important: true, desc: '銀色に輝く星形の紋章。', found: '秘密の書庫・書見台の禁書', origin: { who: '館の主', why: '最深部の扉を開く三つの鍵の一つ', hidden: '隠し書庫の禁書に挟まれていた' }, hotspots: [{ id: 'b', side: 'back', x: 20, y: 20, w: 24, h: 24, text: '裏に「左」。' }] },
    moon_emblem: { name: '月の紋章', cat: 'special', icon: 'moon', c: '#a8c8ff', important: true, desc: '青白く光る三日月の紋章。', found: '時計塔最上階・大鐘の隠し蓋', origin: { who: '館の主', why: '最深部の扉を開く三つの鍵の一つ', hidden: '鐘が鳴った時にだけ外れる蓋の中' }, hotspots: [{ id: 'b', side: 'back', x: 20, y: 20, w: 24, h: 24, text: '裏に「右」。' }] },
    sun_emblem: { name: '太陽の紋章', cat: 'special', icon: 'sun', c: '#ffc850', important: true, desc: '温かな金色の紋章。', found: '機密資料室・小型金庫', origin: { who: '館の主', why: '最深部の扉を開く三つの鍵の一つ', hidden: '館長室の鍵でしか開かない金庫の中' }, hotspots: [{ id: 'b', side: 'back', x: 20, y: 20, w: 24, h: 24, text: '裏に「下」。' }] },
  };

  /* 組み合わせ（順不同）。正解には事前ヒントを用意している（hotspot・説明・会話） */
  ELD.COMBOS = [
    { a: 'gloves', b: 'gear', set: 'gear_ready', say: ['手袋をはめて、油まみれの歯車をしっかりと掴んだ。', 'これなら運べる。'] },
    { a: 'burnt_photo', b: 'research_note', set: 'photo_identified', say: ['写真をノートの剥がれ跡に重ねる。', '大きさも、角の破れ方もぴたりと合う。', '焼けた少女は「被験者E」——館の主の娘、エマだ。'] },
    { a: 'old_tape', b: 'cracked_watch', set: 'time_matched', say: ['テープを再生しながら、懐中時計の針と照らし合わせる。', '鐘は11回鳴り、最後の余韻が消えた時刻が——11時50分。', '時計は、23時の鐘の直後に止められている。'] },
    { a: 'locket', b: 'music_score', set: 'score_matched', say: ['ロケットの4つの音符と、楽譜の冒頭の丸印が一致する。', 'この曲は、あなたのために書かれたのかもしれない。'] },
  ];
  ELD.COMBO_FAIL = ['組み合わせてみたが、何も起こらない。'];

  /* 推理手帳
   * cat: evidence(自動) | testimony | timeline | mystery(未解決の謎) | question(未解決の疑問) | fact(解決済みの事実)
   * evidence: true なら「各章の証拠」にも章ごとに並ぶ（書き置き・日記など）
   * unlock: {flag|item|examined|start}  resolve: flag（解決で「解決済みの事実」へ移る）
   * ch: 記録された章（仮の物語では区画を章として扱う） */
  ELD.CHAPTERS = { entrance: 1, east: 1, west: 2, tower: 3, basement: 4, admin: 5, deep: 6 };
  ELD.CHAPTER_NAMES = ['', '第1章 玄関と東館', '第2章 西館', '第3章 時計塔', '第4章 地下施設', '第5章 管理区域', '第6章 最深部'];
  ELD.NOTES = [
    // 証言（仮の物語では人物がいないため、残された文書の証言）
    { id: 't_emma_letter', cat: 'testimony', evidence: true, title: '少女の手紙', who: 'エマ', text: '「お父さまへ。わたしはもう、十分しあわせでした。」最深部の机に残されていた。', unlock: { flag: 'read_emma_letter' } },
    { id: 't_ledger', cat: 'testimony', evidence: true, title: '宿帳', who: '受付の記録', text: '最後の記帳は10年前の今日。客は五人。', unlock: { examined: 'counter' } },
    { id: 't_servant_diary', cat: 'testimony', evidence: true, title: '使用人の日記', who: '使用人', text: '「旦那様は塔の歯車を外して隠せと仰った。時を止めるのだと」', unlock: { examined: 'hid_crate' } },
    { id: 't_servant_memo', cat: 'testimony', evidence: true, title: 'ロッカーのメモ', who: '使用人', text: '「職員カードは時計塔の中に置いてきた」', unlock: { examined: 'serv_locker' } },
    { id: 't_lord_diary', cat: 'testimony', evidence: true, title: '館長の日記', who: '館の主', text: '「娘の病は治らない。ならば、時を止めるしかない」', unlock: { examined: 'dir_desk' } },
    { id: 't_staff_letter', cat: 'testimony', evidence: true, title: '職員の手紙', who: '職員', text: '「館長は正気ではない。お嬢様を結晶に……」', unlock: { examined: 'rec_desk' } },
    // 時系列
    { id: 'tl_dinner', cat: 'timeline', time: '10年前 11/14 夜', title: '手付かずの晩餐', text: '食堂に六人分の食器。料理は手付かずのまま。', unlock: { examined: 'din_table' } },
    { id: 'tl_clock', cat: 'timeline', time: '10年前 11/14 23:50', title: '時計の停止', text: '館中の時計が一斉に止まった。', unlock: { examined: 'hall_clock' } },
    { id: 'tl_bell', cat: 'timeline', time: '10年前 11/14 23:00', title: '最後の鐘', text: '23時の鐘が11回鳴り、その直後に時計が止められた。', unlock: { flag: 'time_matched' } },
    { id: 'tl_crystal', cat: 'timeline', time: '10年前 11/14 深夜', title: '被験者Eの結晶化', text: '記録装置の最後のログ「被験者E、結晶化完了」。', unlock: { examined: 'exp_console' } },
    { id: 'tl_now', cat: 'timeline', time: '今夜', title: '招待', text: '「{name} 様」宛ての招待状で館に来た。背後で正面扉が閉ざされた。', unlock: { start: true } },
    // 未解決の謎（仕掛け）
    { id: 'm_front', cat: 'mystery', title: '閉ざされた正面扉', text: '外から鎖で閉ざされている。', unlock: { start: true }, resolve: 'front_open', resolvedText: '時の心臓が砕け、正面扉の鎖が外れた。' },
    { id: 'm_clock', cat: 'mystery', title: '止まった柱時計', text: '11時50分で止まっている。時計塔と連動しているらしい。', unlock: { examined: 'hall_clock' }, resolve: 'tower_running', resolvedText: '時計塔に歯車を戻すと、館の時計が動き出した。' },
    { id: 'm_safe', cat: 'mystery', title: '書斎の金庫', text: '四桁のダイヤル。館に関係のある数字か。', unlock: { examined: 'study_safe' }, resolve: 'got_archive_key', resolvedText: '番号は創建の年「1847」だった。' },
    { id: 'm_shelf', cat: 'mystery', title: '倉庫の棚の裏の風', text: '棚の後ろから風が吹くが、棚は動かない。', unlock: { flag: 'stor_hint' }, resolve: 'found_hidden_storage', resolvedText: '設計図の印どおり留め具を外すと、棚の裏に隠し扉があった。' },
    { id: 'm_shelf_hint', cat: 'mystery', title: '設計図の×印', text: '倉庫の東壁に×印。「可動棚・左下の留め具を外す」。', unlock: { examined: 'item:blueprint:mark' }, resolve: 'found_hidden_storage', resolvedText: '×印の位置に隠し扉があった。' },
    { id: 'm_gear', cat: 'mystery', title: '滑る歯車', text: '歯車が油でぬめり、素手では持てない。', unlock: { flag: 'gear_slip' }, resolve: 'gear_ready', resolvedText: '時計職人の手袋をはめて掴んだ。' },
    { id: 'm_pedestal_hint', cat: 'mystery', title: '三つの紋章', text: '星・月・太陽の紋章。館のあちこちに同じ意匠がある。', unlock: { examined: 'item:sealed_letter:seal' }, resolve: 'great_door_open', resolvedText: '三つの紋章を台座に収めると、最深部の扉が開いた。' },
    // 未解決の疑問（物語）
    { id: 'q_who', cat: 'question', title: '招待状の差出人は誰か', text: '名乗らない差出人。なぜ自分が招かれたのか。', unlock: { start: true }, resolve: 'truth_known', resolvedText: '館の時を止めた者の、終わらせてほしいという願いだった。' },
    { id: 'q_photo', cat: 'question', title: '焼けた写真の少女は誰か', text: '研究ノートの「被験者E」と関係があるのか。', unlock: { item: 'burnt_photo' }, resolve: 'photo_identified', resolvedText: '写真の少女は館の主の娘エマ。研究ノートの被験者Eだった。' },
    { id: 'q_time', cat: 'question', title: '懐中時計はいつ止まったのか', text: '裏蓋に「鐘とともに眠れ」。鐘の記録があれば照らし合わせられる。', unlock: { examined: 'item:cracked_watch:lid' }, resolve: 'time_matched', resolvedText: '23時の鐘の直後に止められていた。' },
    { id: 'q_why', cat: 'question', title: 'なぜ館の時は止まったのか', text: '歯車を外し、時計を止めたのは誰で、何のためか。', unlock: { flag: 'tower_running' }, resolve: 'truth_known', resolvedText: '館の主が、病の娘の「死なない夜」を永遠にするためだった。' },
    // 解決済みの事実（単独）
    { id: 'f_notes', cat: 'fact', title: 'ロケットの4つの音符', text: 'ミ・レ・ド・レ。ロケットの内側に刻まれていた。', unlock: { examined: 'item:locket:notes' } },
    { id: 'f_code', cat: 'fact', title: '「1847」', text: '館の創建年。絵画「黄昏の館」に記されていた。', unlock: { flag: 'know_safe_code' } },
    { id: 'f_portrait', cat: 'fact', title: '「永遠のエマ」', text: '欠片をはめると、肖像画の少女と焼けた写真の少女が同じ顔だと分かった。', unlock: { flag: 'portrait_complete' } },
    { id: 'f_score', cat: 'fact', title: 'ロケットと楽譜', text: 'ロケットの音符と夜想曲の冒頭が同じ。', unlock: { flag: 'score_matched' } },
  ];
})();
