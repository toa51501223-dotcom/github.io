/* =====================================================================
 * ELDIA 本編データ（第2章〜第6章・エンディング判定）
 * story.js（第1章）の後、endings.js の後に読み込む。
 * 章の進み：ch1_end → ch2_end → ch3_end → ch4_end → ch5_end → final_done → エンディング
 * 犠牲者：湊・冬子・黒瀬・宗一郎（dead_◯◯）。救出は rescue の調査、失敗は行動回数切れ。
 * ===================================================================== */
(function () {
  const ELD = window.ELD;
  const R = ELD.ROOM_LIST;
  const room = (o) => { R.push(o); ELD.ROOMS[o.id] = o; };
  const P = { red: [104, 30, 40], green: [44, 74, 52], blue: [38, 56, 92], rose: [110, 58, 68], gray: [62, 62, 72], brown: [74, 58, 44], navy: [34, 40, 70] };
  const paper = (c) => ({ s: 'paper', c });
  const npc = (who, x, y, dir, vis) => ({ t: 'person', who, x, y, dir, vis });
  const alive = (id) => 'dead_' + id;

  /* ---------- 人物の居場所（食堂が拠点。出来事の間だけ別の場所へ） ---------- */
  // 食堂の席（第1章の dinNpc を置き換える）
  const away = {
    mizuki: ['ch1_end', 'ch2_end'], reina: ['ch1_end', 'ch2_end'], kotone: ['ch1_end', 'ch2_end'], yu: ['ch1_end', 'ch3_end'],
    minato: ['ch3_end', 'p12'],
  };
  const dinVis = (who) => ({ flag: 'dinner_start', noflag: alive(who), anyCond: 'din_' + who });
  // 「away_◯◯」は ELD.awayFlags() で毎回計算する（下のルールで付け外し）
  const D = ELD.ROOMS.m_dining;
  D.furn = D.furn.filter((f) => !(f.t === 'person' && f.who !== 'haibara' && !(f.who === 'kotone' && f.y === 2)));
  [['ren', 5, 4, 'down'], ['mizuki', 7, 4, 'down'], ['kurose', 9, 4, 'down'], ['fuyuko', 11, 4, 'down'], ['kotone', 13, 4, 'down'],
   ['reina', 5, 7, 'up'], ['soichiro', 7, 7, 'up'], ['yu', 9, 7, 'up'], ['minato', 11, 7, 'up']].forEach(([w, x, y, d]) => D.furn.push(npc(w, x, y, d, dinVis(w))));
  // 第1章の食堂の会話に、出来事中・死亡時の非表示を付ける
  D.ins.forEach((i) => { if (i.npc && i.npc !== 'haibara' && i.id !== 'dn_kotone0') i.vis = dinVis(i.npc); });

  // 章ごとの会話（食堂）。先頭ほど優先
  const talkAdd = (id, acts) => { const i = D.ins.find((x) => x.id === id); i.acts = acts.concat(i.acts); };

  /* ================= 西館 ================= */
  room({
    id: 'm_wcorr', name: '西館 廊下', area: 'west', level: '1F', map: [22, 26, 18, 5],
    W: 26, H: 7, ground: 'plank', wall: paper(P.navy), amb: [52, 56, 84],
    rugs: [{ x: 1, y: 3, w: 24, h: 2, c: [40, 50, 100] }],
    exits: [
      { id: 'e', side: 'E', at: 3, w: 2, to: 'm_hall:w' },
      { id: 'n_lib', side: 'N', at: 3, to: 'm_library:s' }, { id: 'n_study', side: 'N', at: 8, to: 'm_study:s' },
      { id: 'n_arch', side: 'N', at: 13, to: 'm_archive:s' }, { id: 'n_gal', side: 'N', at: 18, to: 'm_gallery:s' },
      { id: 'n_mus', side: 'N', at: 22, to: 'm_music:s' }, { id: 's_child', side: 'S', at: 6, to: 'm_child:n' },
    ],
    furn: [{ t: 'wlamp', x: 6, y: 0 }, { t: 'wlamp', x: 16, y: 0 }, { t: 'armor', x: 11, y: 2 }, { t: 'plant', x: 1, y: 2 }],
    ins: [{ id: 'wc_armor', x: 11, y: 2, acts: [{ say: ['古い鎧。台座に「御影研究所 創立記念」。'] }] }],
  });
  room({
    id: 'm_library', name: '図書室', area: 'west', level: '1F', map: [22, 19, 6, 7],
    W: 12, H: 9, ground: 'parquet', wall: paper(P.green), amb: [56, 52, 70],
    exits: [{ id: 's', side: 'S', at: 5, to: 'm_wcorr:n_lib' }],
    furn: [{ t: 'bookshelf', x: 1, y: 2, w: 3 }, { t: 'bookshelf', x: 8, y: 2, w: 3 }, { t: 'readtable', x: 4, y: 4, w: 3, h: 2 }, { t: 'globe', x: 10, y: 6 }, { t: 'lamp', x: 1, y: 6 }],
    ins: [
      { id: 'lib_diary', x: 4, y: 4, w: 3, h: 2, acts: [
        { if: { flag: 'mizuki_conf', noflag: 'p15' }, say: [
          '偽の日記と、真帆の研究ノートを並べる。美月のルーペを借りて紙を透かす。',
          { choice: { id: 'p15', q: '偽の日記が「真帆の字ではない」と言える点は？', opts: [
            { label: '娘の名前が書かれている／左手の擦れ／2015年の紙', set: 'p15', unity: 1, if: { has: 'research_note' }, failSay: ['……比べる相手がない。真帆のノートが要る。'],
              say: ['真帆は娘の名を一度も文字にしていない。ノートも手紙も、すべて「あの子」。', '日記の字には左手で書いた擦れ。真帆は右利き。', '美月：「紙の透かし、2015年発売の紙です。2008年には存在しない」', '——「真帆が怜司を殺した」という答えは、作られたものだ。'] },
            { label: '筆圧が強い', say: ['……それだけでは、誰の字とも決められない。'] },
            { label: '日付が飛んでいる', say: ['……日記の日付が飛ぶのは珍しくない。'] },
          ] } }] },
        { if: { flag: 'p15' }, say: ['偽の日記。2015年の紙に、左手で書かれた「真帆の告白」。'] },
        { if: { noflag: 'diary_read' }, say: [
          '閲覧机に、革表紙の日記が置かれていた。表紙に「M.K.」。',
          '「11月14日。怜司さんを止めなければ。もう、こうするしかない。」',
          '「〈{name}〉、ごめんなさい。お母さんは遠くへ行きます。」',
          '……母の、日記？',
          { choice: { id: 'diary_belief', q: 'この日記を——', opts: [
            { label: '信じる（母が怜司を殺して逃げた？）', value: 'believe', unity: -1, say: ['胸の奥が冷たくなる。……母は、本当に。'] },
            { label: '保留する（誰かが置いた可能性）', value: 'doubt', trust: { kurose: 1 }, say: ['黒瀬：「見つかりやすい所に、見つかりやすい告白。……出来すぎだな」'] },
          ] } },
        ], set: 'diary_read', give: 'fake_diary' },
        { say: ['偽の日記の置かれていた閲覧机。'] } ] },
    ],
  });
  room({
    id: 'm_study', name: '書斎', area: 'west', level: '1F', map: [28, 18, 6, 8],
    W: 12, H: 10, ground: 'parquet', wall: paper(P.brown), amb: [60, 52, 64],
    rugs: [{ x: 3, y: 5, w: 6, h: 3, c: [90, 40, 40] }],
    exits: [
      { id: 's', side: 'S', at: 5, to: 'm_wcorr:n_study' },
      { id: 'stairs', side: 'N', at: 9, to: 'm_bstairs:up', hidden: 'stairs_found', lock: { flag: 'stairs_found' } },
    ],
    furn: [
      { t: 'bookshelf', x: 1, y: 2, w: 3 }, { t: 'bookshelf', x: 5, y: 2, w: 3 }, { t: 'bookshelf', x: 9, y: 2, w: 2, hideIf: 'stairs_found' },
      { t: 'desk', x: 5, y: 5, w: 2 }, { t: 'armchair', x: 5, y: 7 }, { t: 'phone', x: 10, y: 6 },
      npc('yu', 3, 8, 'up', { flag: 'ch1_end', noflag: ['ch3_end', 'dead_yu'] }),
    ],
    ins: [
      { id: 'st_desk', x: 5, y: 5, w: 2, acts: [
        { if: { noflag: 'p03' }, say: [
          '机の上に、2008年の供述調書の写しが広げてある。',
          '御影宗一郎：「23時37分、書斎の窓から研究所の方に火が見えた」',
          '蓮の父・圭介の手帳：「23:52 通報」「23:58 煙」。',
          { choice: { id: 'p03', q: '三つの時刻の食い違い。嘘をついているのは？', opts: [
            { label: '宗一郎', value: 'so', trust: { soichiro: -1 }, say: ['宗一郎：「私を疑うのか」', '……決めつけるには早い。もう一度考えよう。'] },
            { label: '朝倉圭介', value: 'kei', trust: { ren: -1 }, say: ['蓮：「親父の手帳は秒単位でつけてあった。それはない」'] },
            { label: '誰も嘘をついていない。館の時計が15分遅れていた', value: 'ok', set: 'p03', unity: 1, if: { flag: 'saw_fire_record' }, failSay: ['……消防の記録を見ないと、どれが正しい時刻か分からない。資料保管室を探そう。'],
              say: ['消防の記録の覚知は「23:52」。圭介の手帳と一致する。', '宗一郎が見たのは館の時計で「23時37分」。実際は23時52分。', '——宗一郎は嘘をついていない。館の時計が、15分遅れていた。', '宗一郎：「……私は十八年、自分の見た時刻を疑ったことがなかった」'] },
          ] } }] },
        { say: ['供述調書の写し。館の時計は、あの夜15分遅れていた。'] } ] },
      { id: 'st_shelf', x: 9, y: 2, w: 2, vis: { noflag: 'stairs_found' }, acts: [
        { if: { flag: 'ch2_end' }, say: [
          '悠が巻尺を伸ばす。',
          '悠：「図面の書斎は奥行き6.2m。実測は5.0m。……どこかに1.2mの空間がある」',
          { choice: { id: 'p07', q: '1.2m の空間があるのは、どの壁の裏？', opts: [
            { label: '北の壁（この本棚の裏）', set: ['p07', 'stairs_found'], trust: { yu: 1 },
              say: ['本棚の側板に、指が入るほどの隙間。引くと、本棚ごと手前に回った。', '冷たい空気。下へ続く石の階段。', '……資料保管室の写真で、11月3日だけ少し開いていたのは、この本棚だ。'] },
            { label: '東の壁', say: ['悠：「東は廊下に面してます。厚みは図面どおり」'] },
            { label: '西の壁', say: ['悠：「西は外壁。窓の位置と合っています」'] },
          ] } }] },
        { say: ['北の壁一面の本棚。奥の段だけ、本の並びが不自然に浅い。'] } ] },
      { id: 'st_phone', x: 10, y: 6, acts: [{ say: ['西館の別回線の電話。受話器を上げても無音。', '壁の差込口から、線が抜かれていた。……先回りされている。'] }] },
      { id: 'st_yu', npc: 'yu', x: 3, y: 8, vis: { flag: 'ch1_end', noflag: ['ch3_end', 'dead_yu'] }, acts: [
        { if: { flag: 'ch2_end' }, say: ['悠：「北の本棚、測らせてください。図面と1メートル以上合わない」'] },
        { say: ['悠：「書斎の奥行きが外から見た寸法と合わないんです。……あとで測らせてください」'] } ] },
    ],
  });
  room({
    id: 'm_archive', name: '資料保管室', area: 'west', level: '1F', map: [34, 19, 6, 7],
    W: 12, H: 9, ground: 'tile', wall: paper(P.gray), amb: [56, 58, 72],
    exits: [{ id: 's', side: 'S', at: 5, to: 'm_wcorr:n_arch' }],
    furn: [{ t: 'cabinet', x: 1, y: 2, w: 2 }, { t: 'cabinet', x: 4, y: 2, w: 2 }, { t: 'shelf', x: 8, y: 2, w: 3 }, { t: 'table', x: 4, y: 5, w: 3 },
      npc('reina', 9, 6, 'left', { flag: 'ch1_end', noflag: ['ch2_end', 'dead_reina'] })],
    ins: [
      { id: 'ar_cab', x: 1, y: 2, w: 2, acts: [{ say: ['消防の出動記録の写し。「覚知 23:52　現着 0:31　鎮火 4:10」。', '……館の時計とは関係のない、外の正確な時刻だ。'], set: 'saw_fire_record' }] },
      { id: 'ar_bundle', x: 4, y: 2, w: 2, acts: [{ say: ['2008年の関係者の証言の束。', '研究員、客、使用人……一人分だけ抜けている。「神崎冬子」の調書がない。'], set: 'saw_bundle' }] },
      { id: 'ar_photos', x: 8, y: 2, w: 3, acts: [
        { if: { noflag: 'p04' }, say: [
          '2008年11月の職員写真が数枚。書斎で撮ったものらしい。',
          { choice: { id: 'p04', q: '写真の中で、一枚だけ違う所は？', opts: [
            { label: '11月3日の写真だけ、北の本棚が少し開いている', set: 'p04',
              say: ['11月3日。研究員たちの背後で、北の本棚がほんの少しだけ手前にずれている。', '……あの本棚は、動くのかもしれない。'] },
            { label: '11月10日の写真だけ、窓が開いている', say: ['……窓は換気で開けることもある。決め手ではない。'] },
            { label: '11月14日の写真だけ、人数が少ない', say: ['……当日は演奏会の準備で人が少なかった、と裏に書いてある。'] },
          ] } }] },
        { say: ['11月3日の写真。北の本棚が少し開いている。'] } ] },
      { id: 'ar_report', x: 4, y: 5, w: 3, acts: [
        { if: { noflag: 'p06', trustMin: { reina: 2 }, flag: 'ch1_end' }, say: [
          '机の上の公式報告書。玲奈が、自分の鞄から古い封筒を出した。',
          '玲奈：「……父の遺品。最初に書かれた鑑定書の控えよ。誰にも見せたことがない」',
          { choice: { id: 'p06', q: '鑑定書と公式報告書、食い違う所は？', opts: [
            { label: '血に保存液の成分／固まっていない／火災より前に置かれた', set: ['p06', 'frag_reina'], give: 'appraisal', trust: { reina: 1 },
              say: ['鑑定書：「血痕に保存液（抗凝固剤）の成分を認める。凝固なし。火災の熱を受ける前に床に置かれたもの」', '公式報告書：「出血多量のうえ火災で死亡したと推定」。', '玲奈：「この血、ここで流れたんじゃない。誰かが、注いだのよ」', '研究室の現場写真にも、血の飛沫が一つもない。'] },
            { label: '血液型が違う', say: ['玲奈：「血液型は怜司さんと一致してる。問題はそこじゃない」'] },
          ] } }] },
        { if: { noflag: 'p06' }, say: ['公式報告書。「御影怜司は出血多量のうえ火災で死亡したと推定」。', '研究室の床の血の写真。……周りに、飛び散った跡がない。'], set: 'saw_report' },
        { say: ['父の鑑定書と公式報告書。研究室の血は、注がれた血だった。'] } ] },
      { id: 'ar_reina', npc: 'reina', x: 9, y: 6, vis: { flag: 'ch1_end', noflag: ['ch2_end', 'dead_reina'] }, acts: [
        { if: { trustMax: { reina: 1 } }, say: ['玲奈：「……私は資料を見てるだけ。あなたに話すことは、今はない」'] },
        { say: ['玲奈：「公式の報告書、医者の目で見るとおかしいの。机のところで見て」'] } ] },
    ],
  });
  room({
    id: 'm_gallery', name: '画廊', area: 'west', level: '1F', map: [40, 19, 7, 6],
    W: 14, H: 8, ground: 'marble', wall: paper(P.red), amb: [70, 56, 70],
    exits: [{ id: 's', side: 'S', at: 6, to: 'm_wcorr:n_gal' }],
    furn: [{ t: 'painting', x: 2, y: 0, w: 2, v: 'land2' }, { t: 'painting', x: 6, y: 0, w: 2, v: 'lord' }, { t: 'painting', x: 10, y: 0, w: 2 }, { t: 'statue', x: 12, y: 5 }, { t: 'bench', x: 5, y: 5, w: 3 },
      npc('mizuki', 3, 5, 'up', { flag: 'ch1_end', noflag: ['ch2_end', 'dead_mizuki'] })],
    ins: [
      { id: 'ga_mizuki', npc: 'mizuki', x: 3, y: 5, vis: { flag: 'ch1_end', noflag: ['ch2_end', 'dead_mizuki'] }, acts: [
        { if: { lacks: 'uv_light' }, say: ['美月：「この館の絵、下書きに何か描かれてる気がするんです」', '美月：「修復用の紫外線ライト、貸します。……絵の下が見えるかも」'], give: 'uv_light', trust: { mizuki: 1 } },
        { say: ['美月：「館の絵（左の風景画）が一番怪しいです。紫外線を当ててみて」'] } ] },
      { id: 'ga_manor', x: 2, y: 1, w: 2, acts: [
        { if: { has: 'uv_light', noflag: 'p05' }, say: [
          '紫外線を当てると、館の風景の下から、別の線が浮かび上がった。',
          '時計塔の断面図。鐘の真下に、小さな扉が描き込まれている。添え書き：「記録は地下に。扉は譜面の中に」。',
          { choice: { id: 'p05', q: '鐘の真下の扉。それは館のどこ？', opts: [
            { label: '玄関ホールの柱時計（時計塔の真下にある）', set: 'p05', give: 'uv_photo', say: ['柱時計は時計塔の真下。振り子の奥に、扉があるのかもしれない。', '……ただ、今は振り子が揺れていて手を入れられない。'] },
            { label: '書斎の暖炉', say: ['……書斎は時計塔から離れている。'] },
            { label: '食堂の戸棚', say: ['……食堂は東館。時計塔の真下ではない。'] },
          ] } }] },
        { if: { flag: 'p05' }, say: ['下絵の扉は、鐘の真下。「記録は地下に。扉は譜面の中に」。'] },
        { say: ['館を描いた風景画。絵の具の下に、うっすら別の線がある気がする。'] } ] },
      { id: 'ga_lord', x: 6, y: 1, w: 2, acts: [{ say: ['白衣の男の肖像。「所長　御影怜司」。', '穏やかな目元。……誰かに似ている気がした。'] }] },
    ],
  });
  room({
    id: 'm_music', name: '音楽室', area: 'west', level: '1F', map: [47, 19, 6, 7],
    W: 11, H: 9, ground: 'parquet', wall: paper(P.rose), amb: [66, 54, 72],
    exits: [{ id: 's', side: 'S', at: 5, to: 'm_wcorr:n_mus' }],
    furn: [{ t: 'piano', x: 1, y: 2, w: 2 }, { t: 'harp', x: 8, y: 2 }, { t: 'gramophone', x: 5, y: 2 }, { t: 'stand', x: 4, y: 5 },
      npc('kotone', 2, 5, 'up', { flag: 'ch1_end', noflag: ['ch2_end', 'dead_kotone'] })],
    ins: [
      { id: 'mu_stand', x: 4, y: 5, acts: [
        { if: { noflag: 'score_got' }, say: ['譜面台に手書きの楽譜。あの夜想曲だ。', '最初の四つの音符に、鉛筆で丸がつけてある。'], give: 'score', set: 'score_got' },
        { say: ['夜想曲の譜面台。'] } ] },
      { id: 'mu_kotone', npc: 'kotone', x: 2, y: 5, vis: { flag: 'ch1_end', noflag: ['ch2_end', 'dead_kotone'] }, acts: [
        { if: { noflag: 'ko_locket' }, say: [
          '琴音：「この楽譜、私の母が弾いた曲……でも最初の四音だけ丸がついてる」',
          { choice: { id: 'show_locket', q: '母のペンダントの音符を——', opts: [
            { label: '琴音に見せる', value: 'show', trust: { kotone: 1 }, say: ['琴音：「……同じ。ミ、レ、ド、レ。あなたのお母さんは、この四音を何かの鍵にしてたんだ」'] },
            { label: '見せない', value: 'hide', say: ['琴音：「……そっか」'] },
          ] } }], set: 'ko_locket' },
        { say: ['琴音：「この館の鐘、あの夜……一回だけ、変な時に鳴った気がする」'] } ] },
    ],
  });
  room({
    id: 'm_child', name: '子供部屋', area: 'west', level: '1F', map: [26, 31, 5, 6],
    W: 9, H: 8, ground: 'carpet', groundC: [120, 90, 110], wall: paper([120, 92, 110]), amb: [70, 60, 80],
    exits: [{ id: 'n', side: 'N', at: 4, to: 'm_wcorr:s_child' }],
    furn: [{ t: 'bed', x: 1, y: 2, w: 2, h: 2, c: [200, 160, 180] }, { t: 'dollhouse', x: 6, y: 2, w: 2 }, { t: 'plush', x: 6, y: 5 }],
    ins: [{ id: 'ch_doll', x: 6, y: 2, w: 2, acts: [
      { if: { noflag: 'mem5' }, say: ['人形の家の中に、古い写真が挟まっていた。', '幼い女の子が二人、並んで笑っている。片方は琴音。もう片方は——自分だ。', '……子供部屋で、小さな女の子と遊んだ。思い出した。（記憶のかけら⑤）'], set: 'mem5', give: 'child_photo', trust: { kotone: 1 } },
      { say: ['人形の家。'] } ] }],
  });

  /* ================= 時計塔 ================= */
  room({
    id: 'm_tclock', name: '親時計室', area: 'tower', level: '1F', map: [44, 10, 6, 7],
    W: 12, H: 10, ground: 'plank', wall: { s: 'wood' }, amb: [58, 48, 40],
    exits: [{ id: 's', side: 'S', at: 5, to: 'm_hall:tower' }, { id: 'up', side: 'N', at: 9, to: 'm_belfry:s' }],
    furn: [{ t: 'gear', x: 2, y: 3, w: 2, h: 2 }, { t: 'pendulum', x: 6, y: 3 }, { t: 'weights', x: 8, y: 3 }, { t: 'cabinet', x: 1, y: 7 }, { t: 'oilcan', x: 10, y: 7 }],
    ins: [
      { id: 'tc_breaker', x: 1, y: 7, acts: [
        { if: { noflag: 'power_b' }, say: [
          '配電盤。ブレーカーが三つ（A・B・C）。ラベルは焼けて読めない。',
          '扉の裏に、配電の系統図が貼ってある。（湊なら読めるかもしれない）',
          { choice: { id: 'p08', q: 'どれを入れる？', opts: [
            { label: 'A', say: ['入れた途端、館じゅうの照明が一瞬ちらついた。主電源だ。……すでに入っている系統だった。戻す。'] },
            { label: 'B', set: 'power_b', give: 'power_map', say: ['ごとん。親時計の振り子が力を得たように揺れ、床下から換気扇の低い唸り。', '地下の照明と、「職員専用」の扉の系統だ。', '系統図を剥がして持っていく。'] },
            { label: 'C', set: 'c_breaker', say: ['塔の外で何かが灯った。窓から見ると、時計塔の外灯が煌々と光っている。', '……これでは館じゅうに、ここに誰かいると知らせたようなものだ。慌てて切った。'] },
          ] } }] },
        { say: ['配電盤。Bの系統が入っている。'] } ] },
      { id: 'tc_pend', x: 6, y: 3, acts: [{ say: ['親時計の振り子。館じゅうの子時計はこの時計に合わせて動く。', '……十八年前、この時計が15分止まったら、館の時計はすべて15分遅れる。'] }] },
    ],
  });
  room({
    id: 'm_belfry', name: '鐘楼', area: 'tower', level: '1F', map: [45, 3, 5, 6],
    W: 10, H: 9, ground: 'plank', wall: { s: 'sky' }, amb: [50, 54, 76],
    exits: [{ id: 's', side: 'S', at: 4, to: 'm_tclock:up' }],
    furn: [{ t: 'bell', x: 4, y: 3, w: 2, h: 2 }, { t: 'railing', x: 1, y: 2, w: 8 }, { t: 'crate', x: 8, y: 6 },
      npc('kurose', 3, 6, 'right', { flag: 'kd_start', noflag: ['kd_saved', 'kd_fail'] })],
    ins: [
      { id: 'bel_floor', rescue: true, x: 4, y: 5, w: 2, acts: [
        { say: ['鐘の下の床板。支えのボルトが新しい。'], set: 'saw_toolmarks' } ] },
      { id: 'bel_crate', x: 8, y: 6, acts: [{ say: ['木箱。黒瀬が何かを隠していたらしい跡がある。'] }] },
    ],
  });

  /* ================= 地下 ================= */
  room({
    id: 'm_bstairs', name: '隠し階段', area: 'basement', level: '1F', map: [28, 40, 4, 6],
    W: 8, H: 10, ground: 'stone', wall: { s: 'stone' }, amb: [34, 36, 48], dark: true,
    exits: [{ id: 'up', side: 'N', at: 3, to: 'm_study:stairs' }, { id: 'iron', side: 'S', at: 3, w: 2, kind: 'metal', to: 'm_vault:n', lock: { flag: 'iron_open', msg: ['真鍮の鍵盤がついた鉄の扉。'] } }],
    furn: [{ t: 'torch', x: 1, y: 0 }, { t: 'torch', x: 6, y: 0 }],
    ins: [
      { id: 'bs_door', x: 3, y: 9, w: 2, acts: [
        { if: { flag: 'iron_open' }, say: ['鉄の扉は開いている。'] },
        { if: { noflag: 'power_b' }, say: ['鉄の扉。真っ暗で、鍵盤の文字が読めない。', '……地下の照明の系統を戻さないと。時計塔の配電盤だ。'] },
        { say: ['鉄の扉に、真鍮の鍵盤が七つ。ド・レ・ミ・ファ・ソ・ラ・シ。',
          { choice: { id: 'p09', q: '四つの音を弾く。', opts: [
            { label: 'ド・レ・ミ・ファ', say: ['……何も起きない。'] },
            { label: 'ミ・レ・ド・レ', set: 'iron_open', sfx: 'secret', say: ['最後の音を弾くと、扉の奥で重い閂が外れた。', '……ペンダントの音符。楽譜の丸。母が残した四つの音。'] },
            { label: 'ソ・ミ・ド・ミ', say: ['……何も起きない。'] },
          ] } }] } ] },
    ],
  });
  room({
    id: 'm_vault', name: '記録保管庫', area: 'basement', level: '1F', map: [26, 46, 8, 6],
    W: 16, H: 11, ground: 'stone', wall: { s: 'stone' }, amb: [36, 40, 54], dark: true,
    exits: [
      { id: 'n', side: 'N', at: 7, w: 2, kind: 'metal', to: 'm_bstairs:iron' },
      { id: 'fake', side: 'E', at: 5, to: 'm_recroom:w', hidden: 'fakewall_open', lock: { flag: 'fakewall_open' } },
      { id: 'cold', side: 'W', at: 5, w: 2, kind: 'metal', to: 'm_cold:e', lock: { flag: 'cold_open', msg: ['気密扉。電子錠の表示「管理者権限が必要です」。'] } },
      { id: 'floor', side: 'S', at: 7, w: 2, kind: 'metal', to: 'm_passage:n', lock: { flag: 'ch5_end', msg: ['床の扉。下から冷たい風が吹き上げてくる。'] } },
    ],
    furn: [{ t: 'shelfv', x: 1, y: 2, w: 3 }, { t: 'shelfv', x: 11, y: 2, w: 3 }, { t: 'safe', x: 6, y: 2 }, { t: 'table', x: 6, y: 6, w: 3 }, { t: 'lamp', x: 13, y: 8 }],
    ins: [
      { id: 'va_safe', x: 6, y: 2, acts: [
        { if: { lacks: 'research_note' }, say: ['金庫の扉は、こじ開けられたまま半開きだった。', '中に、擦り切れたノート。表紙に「K.M.」。母の、研究ノート。'], give: 'research_note', set: 'got_note' },
        { say: ['空の金庫。'] } ] },
      { id: 'va_table', x: 6, y: 6, w: 3, acts: [
        { if: { has: 'research_note', noflag: 'p10' }, say: [
          'ノートを開く。研究の悪用を告発する計画。娘を実験に使わせなかったこと。',
          '最後の頁：「私が残せるのは4つ」。その下に、四つの絵だけが並ぶ。鍋、額縁、新聞、音符。',
          { choice: { id: 'p10', q: '四つの絵が指す人は？', opts: [
            { label: '冬子（鍋）・美月の祖父の絵（額縁）・朝倉（新聞）・娘（音符）', set: 'p10', unity: 1,
              say: ['家事の冬子、絵の白石、記者の朝倉、そしてペンダントを持つ娘。', '母は、この四人に何かを託していた。'] },
            { label: '宗一郎・黒瀬・玲奈・悠', say: ['……鍋や額縁と、結びつかない。'] },
          ] } },
          { choice: { id: 'read_note', q: 'このノートを——', opts: [
            { label: '一人で読む', value: 'alone', set: 'mem2', unity: -1, say: ['最後の頁の裏に、鉛筆の薄い字。「大きくなったあなたへ」。', '……母の字だ。（記憶のかけら②）'] },
            { label: '皆と読む', value: 'all', unity: 1, trust: { soichiro: 1 }, say: ['宗一郎が、黙ってノートを見つめていた。「……兄は、こんなことを」'] },
          ] } },
        ] },
        { say: ['閲覧用の机。'] } ] },
      { id: 'va_floor', x: 7, y: 9, w: 2, acts: [
        { if: { noflag: 'saw_scratch' }, say: [
          '床に鉄の扉。錆びているのに、取っ手の周りだけ新しい傷。脇に新品のLEDライトが落ちている。',
          '……誰かが、今もこの扉を使っている。',
          { choice: { id: 'chase', q: '——', opts: [
            { label: '今すぐ下を確かめる', value: 'chase', unity: -1, set: 'got_loadctl', say: ['扉はびくともしない。下から鍵が掛かっている。', '傷の脇で、管理会社のロゴ入りの小さな部品を拾った。……負荷制御器？'] },
            { label: '戻って皆に伝える', value: 'tell', unity: 1, say: ['黒瀬：「下に人がいる、か。……全員でまとまっていた方がいいな」'] },
          ] } }], set: 'saw_scratch' },
        { if: { flag: 'ch5_end' }, say: ['床の扉。下へ降りられる。'] },
        { say: ['床の鉄の扉。下から鍵が掛かっている。'] } ] },
      { id: 'va_wall', x: 15, y: 5, acts: [
        { if: { noflag: 'fakewall_open' }, say: ['東の壁だけ、叩くと音が軽い。', '漆喰の板を外すと、奥に焼け焦げた部屋が現れた。'], set: 'fakewall_open' },
        { say: ['偽装の壁の跡。'] } ] },
      { id: 'va_cold', x: 0, y: 5, h: 2, acts: [
        { if: { flag: 'cold_open' }, say: ['気密扉は開いている。'] },
        { if: { flag: 'p13' }, say: ['紫外線の跡は、この気密扉の前で途切れている。', '電子錠：「管理者権限が必要です」。'] },
        { say: ['気密扉。「低温書庫」。電子錠が掛かっている。'] } ] },
    ],
  });
  room({
    id: 'm_recroom', name: '記録室', area: 'basement', level: '1F', map: [34, 46, 6, 5],
    W: 12, H: 9, ground: 'brick', wall: { s: 'brick' }, amb: [40, 32, 30], dark: true,
    exits: [{ id: 'w', side: 'W', at: 5, to: 'm_vault:fake' }, { id: 'e', side: 'E', at: 4, w: 2, to: 'm_lab:w' }],
    furn: [{ t: 'rubble', x: 2, y: 3, w: 2 }, { t: 'shelf', x: 6, y: 2, w: 3 }, { t: 'rubble', x: 8, y: 6 }],
    ins: [
      { id: 'rc_shelf', x: 6, y: 2, w: 3, acts: [
        { if: { flag: 'reina_conf', has: 'uv_light', noflag: 'p13' }, say: [
          '書架の取っ手。玲奈の父の削除された一行——「別人（女性）の血液反応」。',
          '紫外線を当てる。取っ手と、焦げを免れた床の目地に、拭き取られた跡が青白く浮かぶ。',
          '跡は偽装の壁を越え、記録保管庫を横切り、西の気密扉の前で途切れていた。',
          '入退室ロールの「如月：退室なし」。……母は、ここから出ていない。',
        ], set: 'p13', unity: 1 },
        { say: ['半分焼けた記録室の書架。金属の取っ手だけが残っている。'] } ] },
    ],
  });
  room({
    id: 'm_lab', name: '研究室', area: 'basement', level: '1F', map: [40, 46, 7, 6],
    W: 13, H: 10, ground: 'tile', wall: { s: 'tile' }, amb: [40, 44, 50], dark: true,
    exits: [{ id: 'w', side: 'W', at: 4, w: 2, to: 'm_recroom:e' }, { id: 's', side: 'S', at: 3, to: 'm_infirm:n' }, { id: 'e', side: 'E', at: 5, w: 2, to: 'm_oldlab:w', lock: { flag: 'ch4_end', msg: ['旧実験室。扉に鎖が巻かれている。'] } }],
    furn: [{ t: 'labtable', x: 2, y: 2, w: 3 }, { t: 'tank', x: 9, y: 2 }, { t: 'rubble', x: 6, y: 6, w: 2 }],
    ins: [
      { id: 'lb_ash', x: 6, y: 6, w: 2, acts: [
        { if: { noflag: 'got_tag' }, say: [
          '床に白い線で人の形——2008年に血と遺留品が見つかった位置だ。',
          '灰の中から、焼けたタイマーの基板。設定は「23:25」。……火事は、時限式だった。',
          'その脇に、焼け残ったビニールの切れ端。印字が読める。',
          '「CPDA-1　採血日 10/17　400mL　御影怜司」。……血液バッグのタグ？',
        ], give: ['timer_board', 'blood_tag'], set: 'got_tag' },
        { say: ['白い線の跡と、灰。'] } ] },
      { id: 'lb_tank', x: 9, y: 2, acts: [{ say: ['空の水槽。研究の跡だけが残っている。'] }] },
    ],
  });
  room({
    id: 'm_infirm', name: '医務室', area: 'basement', level: '1F', map: [40, 52, 5, 5],
    W: 9, H: 8, ground: 'tile', wall: { s: 'tile' }, amb: [44, 48, 56], dark: true,
    exits: [{ id: 'n', side: 'N', at: 3, to: 'm_lab:s' }],
    furn: [{ t: 'optable', x: 3, y: 4, w: 2 }, { t: 'cabinet', x: 6, y: 2, w: 2 }],
    ins: [
      { id: 'in_cab', x: 6, y: 2, w: 2, acts: [
        { if: { noflag: 'got_record' }, say: ['診療記録の控え。「御影怜司　自己血貯血　400mL×4回（10/17・10/24・10/31・11/7）採血者 桐島」。', '綴じられた紹介状：「腰椎手術予定」。……手術日の記載は、どこにもない。'], give: 'med_record', set: 'got_record' },
        { say: ['診療記録の棚。'] } ] },
      { id: 'in_table', x: 3, y: 4, w: 2, acts: [
        { if: { has: ['blood_tag', 'med_record'], noflag: 'p11' }, say: [
          '血液バッグのタグと、診療記録の控えを並べる。',
          { choice: { id: 'p11', q: '研究室の床の血の正体は？', opts: [
            { label: '怜司が前もって抜いて保存していた、怜司自身の血（約1.6L）', set: 'p11', unity: 1,
              say: ['400mLを4回、合わせて1.6L。血液保存液 CPDA-1 なら冷蔵で35日もつ。最後の採血は11月7日。', '手術の予定は嘘。怜司は、自分の血で自分の死を作った。', '——怜司の死は、偽装かもしれない。'] },
            { label: '真帆の血', say: ['……タグの名前は「御影怜司」だ。'] },
            { label: '輸血用に買った他人の血', say: ['……採血者は桐島医師。本人から抜いた記録だ。'] },
          ] } }] },
        { if: { flag: 'p11' }, say: ['診察台。怜司はここで、自分の血を抜いた。'] },
        { say: ['古い診察台。'] } ] },
    ],
  });
  room({
    id: 'm_oldlab', name: '旧実験室', area: 'basement', level: '1F', map: [47, 46, 6, 6],
    W: 12, H: 9, ground: 'metal', wall: { s: 'metal' }, amb: [44, 40, 44], dark: true,
    exits: [{ id: 'w', side: 'W', at: 5, w: 2, to: 'm_lab:e' }],
    furn: [{ t: 'machine', x: 2, y: 2, w: 2, h: 2 }, { t: 'console', x: 6, y: 2, w: 2 }, { t: 'pipes', x: 9, y: 0, w: 2 }, { t: 'optable', x: 4, y: 6, w: 2 },
      npc('soichiro', 7, 6, 'left', { flag: 'sd_start', noflag: ['sd_saved', 'sd_fail'] })],
    ins: [
      { id: 'ol_valve', rescue: true, x: 9, y: 1, w: 2, acts: [
        { if: { flag: 'sd_start', noflag: ['sd_saved', 'sd_fail'], has: 'blueprint_full' }, say: [
          '改修図面にあった消火配管のバルブ。力いっぱい回す。',
          '天井から水が降り注ぎ、炎が白い煙に変わる。排煙窓を開けると、煙が吸い出されていく。',
          '鎖を切り、うずくまっていた宗一郎を引きずり出した。',
          '宗一郎：「……兄の字だった。兄が呼んでいると思った。……馬鹿だな、私は」',
        ], set: 'sd_saved', endDanger: true, trust: { soichiro: 2 }, unity: 1 },
        { if: { flag: 'sd_start', noflag: ['sd_saved', 'sd_fail'] }, say: ['配管とバルブ。どれが消火の配管なのか分からない。……図面があれば。',
          { choice: { id: 'ol_gamble', checkpoint: true, q: '煙が濃くなっていく。——', opts: [
            { label: '一度引き返して、図面を探す', value: 'back', say: ['……当てずっぽうは危ない。悠の改修図面を探そう。'] },
            { label: '手当たり次第にバルブを回す', value: 'gamble', heroDeath: { id: 'fire', title: 'DEAD END', cause: '図面なしでバルブを回した。開いたのは消火の配管ではなく、燃料の配管だった。' },
              say: ['一番太いバルブに飛びつき、力いっぱい回す。', '……水の音がしない。かわりに、しゅう、と油の匂い。', '炎が天井まで噴き上がった。熱い。息が、できない——'] },
          ] } }] },
        { say: ['天井の配管。消火用のバルブがある。'] } ] },
      { id: 'ol_machine', x: 2, y: 2, w: 2, acts: [{ say: ['「記憶の再構成」と書かれた装置。……真帆が娘を近づけまいとした研究。'] }] },
    ],
  });
  room({
    id: 'm_cold', name: '低温書庫', area: 'basement', level: '1F', map: [20, 46, 5, 6],
    W: 9, H: 8, ground: 'metal', wall: { s: 'metal' }, amb: [40, 52, 66], dark: true,
    exits: [{ id: 'e', side: 'E', at: 5, w: 2, kind: 'metal', to: 'm_vault:cold' }],
    furn: [{ t: 'shelfv', x: 1, y: 2, w: 2 }, { t: 'shelfv', x: 6, y: 2, w: 2 }, { t: 'optable', x: 3, y: 4, w: 2 }, { t: 'chest', x: 1, y: 6 }],
    ins: [
      { id: 'co_body', x: 3, y: 4, w: 2, acts: [
        { if: { noflag: 'found_maho' }, say: [] },
        { say: ['布に覆われた母。……もう少しだけ、待っていて。'] } ] },
      { id: 'co_chest', x: 1, y: 6, acts: [
        { if: { noflag: 'found_accusation' }, say: ['棚の奥の金属の箱。中に、封をされた書類の束。', '表題：「告発文　御影研究所における記憶研究の悪用について　如月真帆」。', '末尾に十一人の名前。……母は、関わった全員の名を記していた。誰か一人が消されても、記録が残るように。'], set: 'found_accusation', give: 'accusation' },
        { say: ['空になった金属の箱。'] } ] },
    ],
  });
  room({
    id: 'm_passage', name: '地下通路', area: 'basement', level: '1F', map: [26, 54, 18, 4],
    W: 24, H: 7, ground: 'cave', wall: { s: 'stone' }, amb: [30, 34, 42], dark: true,
    exits: [{ id: 'n', side: 'N', at: 3, w: 2, kind: 'metal', to: 'm_vault:floor' }, { id: 'e', side: 'E', at: 3, w: 2, to: 'm_testimony:w' }],
    furn: [{ t: 'torch', x: 8, y: 0 }, { t: 'torch', x: 16, y: 0 }, { t: 'pipes', x: 11, y: 0, w: 2 }],
    ins: [
      { id: 'pa_drain', x: 12, y: 5, acts: [
        { if: { noflag: 'got_weight' }, say: ['排水口の格子に、何かが引っかかっている。', '鐘の形をした真鍮の文鎮。底に、黒く乾いた汚れ。', '底の形は丸く、縁に一段の段差。……母の頭の傷と、同じ形だ。'], give: 'bell_weight', set: ['got_weight', 'p21'] },
        { say: ['排水口。'] } ] },
    ],
  });
  room({
    id: 'm_testimony', name: '証言の間', area: 'basement', level: '1F', map: [44, 54, 8, 5],
    W: 16, H: 10, ground: 'obsidian', wall: { s: 'stone' }, amb: [36, 30, 44], dark: true,
    exits: [{ id: 'w', side: 'W', at: 3, w: 2, to: 'm_passage:e' }, { id: 'e', side: 'E', at: 6, w: 2, to: 'm_rarchive:w' }],
    furn: Array.from({ length: 11 }, (_, i) => ({ t: 'locker', x: 1 + i, y: 2 })).concat([{ t: 'candle', x: 7, y: 7 }]),
    ins: [{ id: 'te_booth', x: 1, y: 2, w: 11, acts: [{ say: ['十一の小部屋。それぞれに名札とマイク。', '自分の名札もある。〈{name}〉。……ここで「偽の答え」を読み上げさせるつもりだったのだ。'] }] }],
  });
  room({
    id: 'm_rarchive', name: '怜司のアーカイブ', area: 'basement', level: '1F', map: [52, 52, 8, 7],
    W: 16, H: 11, ground: 'obsidian', wall: { s: 'stone' }, amb: [44, 34, 40], dark: true,
    exits: [{ id: 'w', side: 'W', at: 6, w: 2, to: 'm_testimony:e' }, { id: 'ice', side: 'E', at: 5, w: 2, to: '@none', lock: { flag: 'never', msg: ['氷室へ続く通路。'] } }],
    furn: [{ t: 'shelfv', x: 1, y: 2, w: 4 }, { t: 'shelfv', x: 10, y: 2, w: 4 }, { t: 'brazier', x: 7, y: 2 }, { t: 'musicbox', x: 2, y: 7 }, { t: 'console', x: 12, y: 7, w: 2 },
      npc('haibara', 7, 5, 'down', { flag: 'ch5_end', noflag: 'reiji_fled' })],
    ins: [
      { id: 'ra_box', x: 2, y: 7, acts: [
        { if: { noflag: 'mem7' }, say: ['オルゴール。蓋を開けると、夜想曲の子守歌が流れた。', '……母がこれを歌っていた。眠る前に、いつも。（記憶のかけら⑦）'], set: 'mem7' },
        { say: ['オルゴール。'] } ] },
      { id: 'ra_shelf', x: 1, y: 2, w: 4, acts: [
        { if: { noflag: 'got_draft' }, say: ['記録の棚。ファイルの間から、二つの紙が出てきた。', '一つは2012年のカードの下書き。怜司の左手の字で「弟へ」。', 'もう一つは、日記から切り取られた一頁。真帆の字。「あの子の声を、ここに残す」。'], give: ['card_draft', 'diary_page'], set: ['got_draft', 'secret_reiji'] },
        { say: ['怜司が集めた記録の棚。'] } ] },
      { id: 'ra_console', x: 12, y: 7, w: 2, acts: [
        { if: { has: ['diary_page', 'pendant'], noflag: 'maho_voice' }, say: ['端末に、母のボイスレコーダーの中身の複製が残っていた。鍵の掛かったファイルが一つ。', 'ペンダントを開くと、薄い導光板。かざすと、ファイルが開いた。', '……まだ再生はしない。全部が終わってから聴こう。'], set: 'maho_voice' },
        { say: ['焼却炉の制御盤。夜明けの鐘と連動している。'] } ] },
    ],
  });

  /* ================= 管理区域・厨房・使用人の部屋 ================= */
  room({
    id: 'm_staff', name: '管理区域 廊下', area: 'admin', level: '1F', map: [74, 26, 9, 5],
    W: 14, H: 7, ground: 'tile', wall: { s: 'metal' }, amb: [50, 54, 64],
    exits: [{ id: 'w', side: 'W', at: 3, w: 2, to: 'm_east:staff' }, { id: 'n_mon', side: 'N', at: 3, to: 'm_monitor:s' }, { id: 'n_dir', side: 'N', at: 9, to: 'm_director:s' }],
    furn: [{ t: 'cabinet', x: 12, y: 2 }, { t: 'pipes', x: 6, y: 0, w: 2 }],
    ins: [
      { id: 'sf_panel', rescue: true, x: 12, y: 2, acts: [
        { if: { flag: 'md_start', noflag: ['md_saved', 'md_fail'], has: 'power_map' }, say: ['配電の系統図と見比べる。「監視室・消火設備」の回路。', '回路を切る。……監視室の方で、警報が途切れた。', '扉を蹴破ると、湊が床に座り込んで咳き込んでいた。', '湊：「……放出、止まった。あんたが？」'], set: 'md_saved', endDanger: true, trust: { minato: 2 }, unity: 1 },
        { if: { flag: 'md_start', noflag: ['md_saved', 'md_fail'] }, say: ['配電盤。どれがどの回路か分からない。……系統図があれば。'] },
        { say: ['管理区域の配電盤。'] } ] },
      { id: 'sf_vent', rescue: true, x: 6, y: 1, w: 2, acts: [
        { if: { flag: 'md_start', noflag: ['md_saved', 'md_fail'], trustMin: { yu: 3 } }, say: ['悠：「通風路だ。監視室の天井に繋がってる！」', '悠が通風路へ潜り込み、内側から扉の錠を外した。白い煙の中から湊を引きずり出す。'], set: 'md_saved', endDanger: true, trust: { minato: 2, yu: 1 }, unity: 1 },
        { say: ['天井近くの通風口。人が一人やっと通れる大きさ。'] } ] },
    ],
  });
  room({
    id: 'm_monitor', name: '監視室', area: 'admin', level: '1F', map: [74, 19, 6, 7],
    W: 12, H: 9, ground: 'tile', wall: { s: 'metal' }, amb: [46, 56, 66],
    exits: [{ id: 's', side: 'S', at: 3, to: 'm_staff:n_mon' }],
    furn: [{ t: 'monitors', x: 2, y: 0, w: 4 }, { t: 'console', x: 2, y: 2, w: 4 }, { t: 'machine', x: 9, y: 2, w: 2 },
      npc('minato', 4, 4, 'up', { flag: 'ch3_end', noflag: ['p12', 'dead_minato'] })],
    ins: [
      { id: 'mo_loop', x: 2, y: 2, w: 4, acts: [
        { if: { flag: 'ch3_end', noflag: 'p12' }, say: [
          '湊が復元した、2008年11月14日の地下入口の映像。',
          '湊：「停電のあいだも、入口カメラは主電源で動いてたはずなんだ」',
          { choice: { id: 'p12', q: 'コマ送りで見つけた、おかしな所は？', opts: [
            { label: '21:25〜21:40 の15分が2回続く（蛾が同じ軌跡で飛ぶ）', set: ['p12', 'frag_minato'], give: 'ir_footage', trust: { minato: 1 },
              say: ['同じ蛾が、同じ軌跡で二度飛ぶ。後半の15分は、前の15分の差し替えだ。', '湊：「本物には何が映ってたんだ……」', '……暗い研究所の扉の前で、母を呼ぶ小さな子供。記憶のかけら①と同じ景色だ。', '湊：「それと、これ。誰にも渡してなかった庭の赤外線映像。館の時計で23:30、氷室のそばに人影がある」'] },
            { label: '画質が途中で落ちる', say: ['湊：「それは圧縮のせい」'] },
            { label: '時刻表示が消える', say: ['湊：「表示はずっと出てる。……よく見て」'] },
          ] } }] },
        { say: ['監視モニターの列。'] } ] },
      { id: 'mo_admin', x: 9, y: 2, w: 2, acts: [
        { if: { flag: 'admin_rights' }, say: ['中央管理盤。権限は移した。電子錠「低温書庫：解錠」。'] },
        { if: { flag: 'accused_scene' }, say: ['中央管理盤の本体。……画面の前（コンソール）で権限を移そう。'] },
        { say: ['中央管理盤の本体。灰原の管理者権限で動いている。'] } ] },
      { id: 'mo_minato', npc: 'minato', x: 4, y: 4, vis: { flag: 'ch3_end', noflag: ['p12', 'dead_minato'] }, acts: [
        { say: ['湊：「地下入口の映像、ここで見られる。コンソールの前に来て」'] } ] },
    ],
  });
  room({
    id: 'm_director', name: '館長室', area: 'admin', level: '1F', map: [80, 19, 6, 7],
    W: 11, H: 8, ground: 'carpet', groundC: [70, 40, 40], wall: paper(P.brown), amb: [60, 50, 56],
    exits: [{ id: 's', side: 'S', at: 5, to: 'm_staff:n_dir' }],
    furn: [{ t: 'desk', x: 4, y: 3, w: 3 }, { t: 'bookshelf', x: 1, y: 2, w: 2 }, { t: 'safe', x: 9, y: 2 }],
    ins: [
      { id: 'di_desk', x: 4, y: 3, w: 3, acts: [
        { if: { noflag: 'got_contract' }, say: ['管理会社との契約書。「2024年4月より管理人 灰原」。', '添付の発注書：「地下 増築工事　小部屋十一　記録庫　焼却炉」。……館の地下に、今も何かを造っている。'], set: 'got_contract' },
        { say: ['契約書と発注書。'] } ] },
      { id: 'di_safe', x: 9, y: 2, acts: [
        { if: { flag: 'ch4_end', noflag: 'got_broadcast' }, say: ['金庫の上に、館内放送の記録。今夜の4回の放送の時刻。', '19:00の夕食、20:40の放送、21:30の封鎖、0:00の鐘。……放送のたび、灰原だけがその場にいなかった。'], give: 'broadcast_log', set: 'got_broadcast' },
        { say: ['古い金庫。'] } ] },
    ],
  });
  room({
    id: 'm_kitchen', name: '厨房', area: 'east', level: '1F', map: [64, 13, 6, 6],
    W: 12, H: 9, ground: 'tile', wall: { s: 'tile' }, amb: [64, 60, 56],
    exits: [{ id: 's', side: 'S', at: 8, to: 'm_east:n_kit' }],
    furn: [{ t: 'stove', x: 1, y: 2, w: 2 }, { t: 'sink', x: 4, y: 2 }, { t: 'cupboard', x: 9, y: 2, w: 2 }, { t: 'worktable', x: 4, y: 5, w: 3 },
      npc('haibara', 2, 4, 'right', { flag: 'ch3_end', noflag: 'accused_ok' })],
    ins: [
      { id: 'kt_haibara', npc: 'haibara', x: 2, y: 4, vis: { flag: 'ch3_end', noflag: 'accused_ok' }, acts: [
        { if: { noflag: 'masaka' }, say: [
          '灰原が紅茶を淹れている。スプーンを反時計回りに。低い鼻歌。……六番目の音が、半音低い。',
          '背後で、陶器の割れる音。冬子が、立ち尽くしていた。',
          '冬子：「……まさか」',
          '冬子は青ざめたまま、厨房を出ていった。',
          { choice: { id: 'hb_confront', checkpoint: true, q: '厨房に、灰原と二人きりになった。——', opts: [
            { label: '冬子を追いかける', value: 'follow', say: ['……今は、冬子を一人にしてはいけない。厨房を出た。'] },
            { label: '灰原を一人で問い詰める', value: 'confront', heroDeath: { id: 'kitchen', title: 'DEAD END', cause: '厨房で、灰原と二人きりで正体を問い詰めた。……誰も、その声を聞いていなかった。' },
              say: ['「さっきの鼻歌。……あなたは、誰ですか」', '灰原は答えず、ゆっくりと背を向けた。紅茶の湯気が揺れる。', '灰原：「……真帆さんに、よく似ている。その目が」', '振り向いた左手に、肉切り包丁。背後の扉は、いつのまにか閉じていた。'] },
          ] } },
        ], set: 'masaka' },
        { say: ['灰原：「温かいものでもいかがです」'] } ] },
      { id: 'kt_lift', x: 9, y: 2, w: 2, acts: [{ say: ['戸棚の横に、古い配膳用リフト。地下まで続く縦穴だ。'] }] },
      { id: 'kt_watch', x: 4, y: 5, w: 3, acts: [
        { if: { flag: 'hb_attacked', noflag: 'got_watch' }, say: ['作業台の下に、懐中時計が落ちていた。', 'ちょうど15分遅れている。裏蓋に「R.M.」の刻印。……御影怜司の頭文字。'], give: 'pocket_watch', set: 'got_watch' },
        { say: ['作業台。'] } ] },
    ],
  });
  room({
    id: 'm_servant', name: '使用人の部屋', area: 'east', level: '1F', map: [70, 21, 5, 5],
    W: 9, H: 8, ground: 'plank', wall: paper([90, 80, 70]), amb: [60, 54, 50],
    exits: [{ id: 's', side: 'S', at: 4, to: 'm_east:n_g2' }],
    furn: [{ t: 'bed', x: 1, y: 2, w: 2, h: 2, c: [150, 130, 120] }, { t: 'teatable', x: 5, y: 4 }, { t: 'lamp', x: 7, y: 2 },
      npc('fuyuko', 4, 4, 'right', { flag: 'fd_start', noflag: ['fd_saved', 'fd_fail'] })],
    ins: [
      { id: 'sv_lamp', x: 7, y: 2, acts: [
        { if: { noflag: 'bug_removed' }, say: ['照明の笠の裏に、小さな黒い箱が貼りつけてあった。……盗聴器だ。', '剥がして、靴の底で踏み潰した。'], set: 'bug_removed' },
        { say: ['照明。'] } ] },
      { id: 'sv_tea', rescue: true, x: 5, y: 4, acts: [
        { if: { flag: 'fd_start', noflag: ['fd_saved', 'fd_fail'] }, say: ['冬子がカップを口に運ぶ——その手首をつかんだ。', '紅茶の表面に、細かく刻んだ葉が浮いている。庭のジギタリス。', '冬子：「……灰原さんが、温かいものをって」', '冬子の手が、震えていた。'], set: 'fd_saved', endDanger: true, trust: { fuyuko: 2 }, unity: 1 },
        { say: ['小さな丸テーブル。'] } ] },
    ],
  });

  /* ================= 食堂の会話（章ごと） ================= */
  const conf = (who, body) => ({ if: { flag: 'ch3_end', noflag: ['conf_' + who, 'ch4_end'] }, say: body.say, set: ['conf_' + who].concat(body.set || []), give: body.give, trust: body.trust, unity: body.unity });
  talkAdd('dn_ren', [
    conf('ren', { say: ['蓮：「……白状する。俺があんたに声をかけたのは、記事のためだ」', '蓮：「親父の手帳と、もう一つ。2009年に親父が空港で撮った写真。……写ってる男、怜司に似てる」', { choice: { id: 'c_ren', q: '蓮を——', opts: [{ label: '許す', trust: { ren: 2 }, say: ['蓮：「……ありがとな」'] }, { label: '許さない', trust: { ren: -1 }, say: ['蓮：「当然だな」'] }] } }], set: 'frag_ren', give: 'airport_photo' }),
    { if: { flag: 'ch4_end' }, say: ['蓮：「親父の写真の男……灰原の横顔と重なるんだ」'] },
    { if: { flag: 'ch1_end' }, say: ['蓮：「親父の手帳の23:52と23:58。外の時刻は、親父の手帳が一番正確なはずだ」'] },
  ]);
  talkAdd('dn_mizuki', [
    conf('mizuki', { say: ['美月：「……私、祖父の絵の額縁の裏から見つけた資料の写真を、NO.11に売ったんです。お金が欲しくて」', '美月：「でも原本は持ってます。真帆さんの手順書と請求書の写し。……それと、あの偽の日記の紙、透かしを見せてください。紙なら分かります」', { choice: { id: 'c_mizuki', q: '美月を——', opts: [{ label: '責めない', trust: { mizuki: 2 }, say: ['美月は小さく頭を下げた。'] }, { label: '責める', trust: { mizuki: -1 }, say: ['美月：「……ごめんなさい」'] }] } }], set: ['frag_mizuki', 'mizuki_conf'], give: 'frame_docs' }),
    { if: { flag: 'ch1_end' }, say: ['美月：「館の絵、下書きに何かある気がして」'] },
  ]);
  talkAdd('dn_kurose', [
    conf('kurose', { say: ['黒瀬：「……港南町の事件。俺は自白を誘導して、無実の男を有罪にした。御影の名簿に、その証拠を握られてた」', '黒瀬：「だから2008年、上から言われるまま、この事件を『事故』で閉じた。入退室の記録の原本も、俺が持ち出した」', { choice: { id: 'c_kurose', q: '黒瀬の話を——', opts: [
      { label: '最後まで聞く', value: 'listen', trust: { kurose: 2 }, say: ['黒瀬：「……ロールは鐘楼に隠してある。真帆は地下から出ていない。怜司は二度入って、一度も出ていない」', '黒瀬：「この件が片づいたら、公の場で全部話す。約束する」'], set: ['kurose_promise'] },
      { label: 'その場で責める', value: 'blame', trust: { kurose: -1 }, say: ['黒瀬：「……言われなくても分かってる」'] },
      { label: '皆の前で糾弾する', value: 'denounce', unity: -2, set: 'kurose_denounced', say: ['食堂じゅうの視線が黒瀬に突き刺さる。黒瀬は何も言わず、席を立った。'] },
    ] } },
    { choice: { id: 'with_kurose', q: '黒瀬が「鐘楼からロールを取ってくる」と言う。', opts: [
      { label: '一緒に行く', set: 'with_kurose', trust: { kurose: 1 }, say: ['黒瀬：「……好きにしろ」'] },
      { label: '任せる', say: ['黒瀬は一人で時計塔へ向かった。'] },
    ] } }], set: ['frag_kurose_pending'] }),
    { if: { flag: 'ch1_end' }, say: ['黒瀬：「……」'] },
  ]);
  talkAdd('dn_fuyuko', [
    { if: { flag: ['ch3_end', 'masaka'], noflag: ['conf_fuyuko', 'ch4_end'], trustMin: { fuyuko: 4 } }, say: [
      '冬子：「……全部話すわ。あの夜、私はあなたを連れて逃げた。真帆さんに頼まれていたの」',
      '冬子：「火事の少し前、氷室のそばで、地面から男が出てくるのを見た。……あの鼻歌、紅茶の混ぜ方。灰原さんは、怜司さんよ」',
      '冬子：「あなたが泣き出しそうになって、私はあなたの口を押さえて隠れた」',
      '……冬子さんに、口を押さえられた。覚えている。（記憶のかけら⑥）',
      '冬子は鞄の二重底から、古い封筒を出した。「真帆さんの手紙。大人になったら渡してと頼まれていたの」',
      { choice: { id: 'fu_tell', q: '冬子の話を——', opts: [
        { label: '皆に伝える（灰原のいる場で）', set: 'fuyuko_told_all', say: ['食堂で話した。……扉の向こうで、誰かの足音が遠ざかった。'] },
        { label: '二人だけの秘密にする', trust: { fuyuko: 1 }, say: ['冬子：「ありがとう。……朝になったら、全部話しましょう」'], set: 'fuyuko_promise' },
        { label: '灰原を問い詰めに行く', unity: -1, say: ['灰原：「何のことでしょう」……証拠がない。灰原はしらを切った。'] },
      ] } },
    ], set: ['conf_fuyuko', 'frag_fuyuko', 'mem6'], give: 'maho_letter' },
    { if: { flag: ['ch3_end', 'masaka'], noflag: ['conf_fuyuko', 'ch4_end'] }, say: [
      '冬子：「……厨房で、昔の人を思い出しただけ。氷室のそばで、あの夜、男を見たの。それだけ」',
      { choice: { id: 'fu_tell', q: '冬子の話を——', opts: [
        { label: '皆に伝える（灰原のいる場で）', set: 'fuyuko_told_all', say: ['……扉の向こうで、誰かの足音が遠ざかった。'] },
        { label: '二人だけの秘密にする', trust: { fuyuko: 1 }, set: 'fuyuko_promise', say: ['冬子：「……ありがとう」'] },
      ] } },
    ], set: 'conf_fuyuko' },
    { if: { flag: 'ch3_end', noflag: ['masaka', 'ch4_end'] }, say: ['冬子：「……少し一人にしてちょうだい」', '（灰原は厨房にいるはずだ）'] },
    { if: { flag: 'ch1_end' }, say: ['冬子：「あなたは、よく似てるわ。……お母さんに」'] },
  ]);
  talkAdd('dn_minato', [
    conf('minato', { say: ['湊：「俺の母さん、この研究所の被験者だった。……記憶をいじられて、俺のことも時々忘れる」', '湊：「だから依頼主に全部は渡さなかった。庭の赤外線映像は、俺だけが持ってる」'], set: 'frag_minato', give: 'ir_footage' }),
    { if: { flag: 'ch3_end', noflag: 'p12' }, say: ['湊：「監視室で待ってる。……管理区域、入れるようになったから」'] },
    { if: { flag: 'ch1_end' }, say: ['湊：「中央管理システム、ログが妙に新しい。……誰かが今も触ってる」'] },
  ]);
  talkAdd('dn_reina', [
    conf('reina', { say: ['玲奈：「父の鑑定書の修正履歴。消された一行があるの」', '玲奈：「『記録室の書架の取っ手：別人（女性）の血液反応→削除』。指示したのは、当時の警察」', '玲奈：「……三年間、父の名誉のために黙ってた。医者なのに」',
      { choice: { id: 'c_reina', q: '玲奈の告白を——', opts: [
        { label: '受け止める', set: 'reina_bond', trust: { reina: 1 }, say: ['玲奈：「……ありがとう。紫外線ライト、まだ持ってる？ 記録室の取っ手を見て」'] },
        { label: '責める', trust: { reina: -1 }, say: ['玲奈：「……そうね。言い訳はしない。記録室の取っ手を、紫外線で見て」'] },
      ] } }], set: ['reina_conf', 'frag_reina'], give: ['edit_history', 'appraisal'] }),
    { if: { flag: 'ch1_end' }, say: ['玲奈：「公式の報告書は、医者として読むとおかしいわ」'] },
  ]);
  talkAdd('dn_soichiro', [
    conf('soichiro', { say: ['宗一郎：「……兄の研究の権利を、私は海外の会社に売った。顧客名簿も、家の名のために隠した」', '宗一郎：「2012年、兄の字のカードが届いた。『記録は嘘をつかない』。……生きていると思いながら、目をそらした」', '宗一郎：「焼け跡の腕時計と指輪を兄のものだと言ったのは、私だ」'], set: 'frag_soichiro', give: 'client_list' }),
    { if: { flag: 'ch4_end', noflag: 'ch5_end' }, say: ['宗一郎：「……灰原が兄なら、私が話をつける」'] },
    { if: { flag: 'ch1_end' }, say: ['宗一郎：「この館で兄を見ている気がする。……馬鹿な話だ」'] },
  ]);
  talkAdd('dn_yu', [
    conf('yu', { say: ['悠：「事件のあと、父の口座に匿名で300万円が入っていました。……僕の事務所の開業資金です」', '悠：「父の改修図面の完全版です。記録保管庫から氷室まで、約300メートルの通路。旧実験室の消火配管と排煙窓も」'], set: 'frag_yu', give: 'blueprint_full', trust: { yu: 1 } }),
    { if: { flag: 'ch1_end' }, say: ['悠：「図面と実物が合わない所は、まだあるはずです」'] },
  ]);
  talkAdd('dn_kotone', [
    conf('kotone', { say: ['琴音：「……私、NO.11に頼まれて、館で流す夜想曲を録音してた。知らなかったの」', '琴音：「それと、母があの夜録音した演奏会のテープ。鐘の音が入ってる」'], set: 'frag_kotone', give: 'tape' }),
    { if: { flag: 'ch1_end' }, say: ['琴音：「鐘、あの夜……一回だけ変な時に鳴った」'] },
  ]);
  // P19：死亡偽装の細工（食堂のテーブル。足りない証拠があれば一度離れて取りに行ける）
  const TR = [
    ['tr1', '①研究室の約1.6Lの血 —— 崩す証拠は？', '鑑定書・診療記録・血液バッグのタグ', { has: ['appraisal', 'med_record', 'blood_tag'] }, '偽の日記'],
    ['tr2', '②崩落と浸水で捜索が打ち切られた —— 崩す証拠は？', '改修図面の「補強未施工」の区画', { has: 'blueprint_full' }, '消防の記録'],
    ['tr3', '③焼け跡の腕時計と指輪 —— 崩す証拠は？', '火元から離れた棚の上で見つかった（焼け方が軽い）', null, '指輪の刻印'],
    ['tr4', '④弟による遺留品の確認 —— 崩す証拠は？', '2012年の兄の筆跡のカード', { anyHas: ['client_list', 'card_draft'] }, '空港の写真'],
  ];
  D.ins.find((i) => i.id === 'dn_table').acts.unshift(
    { if: { flag: 'p18', noflag: 'trick_broken', anyCond: 'soDone' }, say: ['怜司の「死」を支えた細工を、一つずつ崩す。'].concat(TR.map(([id, q, ok, need, ng]) => ({ choice: { id, q, opts: [
      Object.assign({ label: ok, set: id }, need ? { if: need, failSay: ['……その証拠が手元にない。食堂を離れて取りに行こう。'] } : {}),
      { label: ng, say: ['……それでは崩れない。'] },
    ] } }))) });
  // 自分の告白（食堂のテーブル）
  D.ins.find((i) => i.id === 'dn_table').acts.unshift(
    { if: { flag: 'ch3_end', noflag: ['conf_self', 'ch4_end'] }, say: [
      '皆が告白した。……自分の番だ。',
      '〈{name}〉：「私は、あの夜ここにいた。三歳だった。暗い階段で母を待っていた」',
      '〈{name}〉：「それから……庭で、地面が開いて、男が出てくるのを見た」',
      '……地面が開いて男が出てきた。（記憶のかけら③）',
    ], set: ['conf_self', 'mem3'] });

  /* ================= ルール（第2章〜第6章） ================= */
  const CONF = ['ren', 'mizuki', 'kurose', 'fuyuko', 'minato', 'reina', 'soichiro', 'yu', 'kotone'];
  const RULES2 = [
    // ---------- 第2章 ----------
    { if: { flag: 'ch1_end', noflag: 'ch2_intro' }, set: 'ch2_intro', chapter: 2, clock: '00:00', sfx: 'bell', say: [
      '——第2章　消えた証言——',
      '0時。時計塔の鐘が十二回鳴った。',
      'スマートフォンの時計は「0:15」。……鐘は、15分遅れて鳴っている。',
      '宗一郎：「西館の書斎に別回線の電話がある。行ってみよう」',
      '西館の鍵で扉を開けた。皆、手分けして西館を調べることになった。',
      { choice: { id: 'team', q: '誰と一緒に回る？', opts: [
        { label: '早乙女悠', trust: { yu: 1 } }, { label: '桐島玲奈', trust: { reina: 1 } }, { label: '白石美月', trust: { mizuki: 1 } },
      ] } },
    ] },
    { if: { flag: ['p03', 'p04', 'p05', 'diary_read', 'score_got'], noflag: 'ch2_end' }, set: 'ch2_end', clock: '01:00', say: [
      '書斎の時刻、写真の本棚、画廊の下絵、偽の日記、夜想曲の楽譜。',
      '下絵が示す扉は、鐘の真下——玄関ホールの柱時計だ。',
    ], chapterEnd: { title: '第2章　消えた証言', sub: '館の時計は、あの夜から15分遅れていた。', next: '次は第3章「地下へ」。玄関ホールの柱時計を調べよう。' } },
    // ---------- 第3章 ----------
    { if: { flag: 'ch2_end', noflag: 'ch3_intro' }, set: 'ch3_intro', chapter: 3, say: ['——第3章　地下へ——', '悠：「書斎の北の本棚、測らせてください」', '柱時計の振り子の奥、時計塔、書斎の本棚。……地下へ降りる道を探そう。'] },
    { if: { room: 'm_bstairs', noflag: 'mem1' }, set: 'mem1', say: [
      '冷たい石の階段。……知っている。',
      '暗い階段で、母を待っていた。小さな手で壁をさわりながら。（記憶のかけら①）',
      { choice: { id: 'companions', q: '地下へは二人まで連れて行ける。', opts: [
        { label: '悠と玲奈', trust: { yu: 1, reina: 1 } }, { label: '湊と琴音', trust: { minato: 1, kotone: 1 } }, { label: '黒瀬と玲奈', trust: { kurose: 1, reina: 1 } },
      ] } },
    ] },
    { if: { flag: ['p07', 'power_b', 'iron_open', 'p10', 'p11', 'saw_scratch'], noflag: 'ch3_end' }, set: 'ch3_end', clock: '02:00', say: [
      '母の研究ノート。床の扉の新しい傷。そして、怜司の自己血の記録。',
      '十八年前、怜司は死んでいなかったのかもしれない。',
    ], chapterEnd: { title: '第3章　地下へ', sub: '研究室の血は、怜司が自分で抜いた血だった。', next: '次は第4章「告白の夜」。食堂に皆が集まっている。' } },
    // ---------- 第4章 ----------
    { if: { flag: 'ch3_end', noflag: 'ch4_intro' }, set: ['ch4_intro', 'staff_open'], chapter: 4, clock: '02:10', say: [
      '——第4章　告白の夜——',
      '黒瀬：「俺の部屋が荒らされた。……何も盗られちゃいない」',
      '湊：「配電のB系統が戻ったから、管理区域の職員専用扉が生き返ってる。宗一郎さん、所有者のカードを」',
      '宗一郎のカードで、東館の奥の「職員専用」の扉が開いた。',
      '黒瀬：「この中の誰も、まだ本当のことを話していない。……一人ずつ、全部吐き出してもらう」',
      { choice: { id: 'split', q: '管理区域の調べ方は？', opts: [
        { label: '手分けして調べる（湊は監視室へ）', set: 'split', say: ['湊：「監視室は俺一人で十分」'] },
        { label: '全員でまとまって動く', unity: 1, say: ['時間はかかるが、誰も一人にならない。'] },
      ] } },
    ] },
    // 湊の危険（監視室を離れた後）
    { if: { flag: ['p12', 'split'], noflag: ['md_start', 'dead_minato'], anyCond: 'minatoRisk', room: ['m_staff', 'm_east', 'm_dining', 'm_hall', 'm_director'] }, set: 'md_start', fx: 'quake',
      danger: { id: 'minato', moves: 8, fail: 'md_fail', label: '監視室に湊が閉じ込められた' }, say: [
        '——けたたましい警報。管理区域の方からだ。',
        '湊（無線）：「扉が外から……！ 消火ガスが出てる、息が——」',
        '監視室の扉は外から施錠され、隙間から白いガスが漏れ出している。',
        '（配電盤で回路を切るか、通風路から入れれば——）',
      ] },
    { if: { flag: 'md_fail', noflag: 'dead_minato' }, kill: { id: 'minato', ch: 4, cause: '監視室の消火ガス', at: ['m_monitor', 4, 5], cue: '扉の小窓の向こう' }, fx: 'gas', set: ['frag_minato', 'p12'], give: 'ir_footage', say: [
      '警報が、ふいに止んだ。',
      '静寂。モニターのファンの音だけが回っている。',
      '扉の小窓の向こう、白く曇った部屋の床で、湊は膝を抱えるように倒れていた。キーボードに手を伸ばしたまま。',
      '玲奈が脈を取り、首を横に振った。',
      '湊の手の下のキーボードに、打ちかけの一行。「庭の赤外線　バックアップ　USB」。',
      '机の下のUSBに、庭の赤外線映像が残っていた。',
      '悠：「……僕が、もっと早く」',
    ] },
    // 灰原が「襲われた」
    { if: { flag: 'masaka', noflag: 'hb_attacked' }, set: 'hb_attacked', say: [
      '直後、厨房から物音。駆けつけると、灰原が床に倒れていた。腕に浅い切り傷。',
      '灰原：「何者かに、後ろから……」',
      { choice: { id: 'wound', q: '——', opts: [
        { label: '玲奈に傷を見てもらう', set: 'wound_check', say: ['玲奈が傷を見て、眉をひそめた。'] },
        { label: 'そっとしておく', say: ['灰原は自分で包帯を巻いた。……左手で。'] },
      ] } },
    ] },
    { if: { flag: 'wound_check', noflag: 'wound_ok' }, set: 'wound_ok', say: [] },
    // 全員の告白の後：黒瀬・冬子の危険
    { if: { flag: 'conf_self', noflag: 'conf_all_done', anyCond: 'allConfessed' }, set: 'conf_all_done', say: ['——全員が、隠していたことを話し終えた。', '食堂に、長い沈黙が落ちた。'] },
    { if: { flag: 'conf_all_done', noflag: ['kd_start', 'kd_checked'] }, set: 'kd_checked', say: [] },
    { if: { flag: 'kd_checked', noflag: ['kd_start', 'kd_safe'], anyCond: 'kuroseRisk' }, set: 'kd_start', fx: 'bell',
      danger: { id: 'kurose', moves: 12, fail: 'kd_fail', label: '黒瀬が鐘楼に' }, say: [
        '鐘が、一度だけ鳴った。時刻でもないのに。',
        '黒瀬は一人で鐘楼へ向かったきり、戻っていない。',
        '（鐘の下の床板。……第2章で見た、あの新しいボルト）',
      ] },
    { if: { flag: 'kd_checked', noflag: ['kd_start', 'kd_safe'] }, set: 'kd_safe', say: [] },
    { if: { flag: ['kd_start', 'with_kurose'], noflag: ['kd_saved', 'kd_fail'] }, set: 'kd_saved', endDanger: true, trust: { kurose: 2 }, unity: 1, say: [
      '鐘楼。黒瀬が木箱からロールを取り出した瞬間、足元の床板がきしんだ。',
      'とっさに腕をつかんで引き戻す。床板は鐘の下へ抜け落ち、闇の底で鈍い音がした。',
      '黒瀬：「……借りができたな」',
    ] },
    { if: { flag: 'kd_fail', noflag: 'dead_kurose' }, kill: { id: 'kurose', ch: 4, cause: '鐘楼からの転落', at: ['m_tclock', 6, 6], cue: '塔の下で' }, fx: 'bell', set: 'frag_kurose', give: 'entry_roll', say: [
      '鐘が、大きく一度揺れた。',
      'ごうん——。余韻が長く、長く続き、そして消えた。',
      '鐘楼の床に、ぽっかりと穴が開いていた。支えのボルトが外されている。',
      '塔の下で、黒瀬は動かなかった。手には、入退室ロールの束を握ったまま。',
      '玲奈：「……即死よ」',
      'ロールを、黒瀬の手から受け取った。',
    ] },
    { if: { flag: 'kd_safe', noflag: ['frag_kurose', 'dead_kurose'] }, set: 'frag_kurose', give: 'entry_roll', say: ['黒瀬が鐘楼から戻ってきた。「入退室ロールの原本だ」', '「21:28 如月 入室」「如月　退室なし」「21:40」が二行。「22:50 御影 入室」、怜司の退室の記録はない。'] },
    { if: { flag: 'kd_saved', noflag: 'frag_kurose' }, set: 'frag_kurose', give: 'entry_roll', say: ['黒瀬から入退室ロールの原本を受け取った。「21:28 如月 入室」「如月　退室なし」「21:40」が二行。'] },
    // 冬子の危険（告白の後）
    { if: { flag: 'kd_checked', noflag: ['fd_start', 'fd_checked'], anyCond: 'kuroseResolved' }, set: 'fd_checked', say: [] },
    { if: { flag: 'fd_checked', noflag: ['fd_start', 'fd_safe'], anyCond: 'fuyukoRisk' }, set: 'fd_start', danger: { id: 'fuyuko', moves: 8, fail: 'fd_fail', label: '冬子が部屋に戻った' }, say: [
      '冬子：「少し、部屋で休むわ」',
      '灰原：「温かいものをお持ちしましょう」',
      '……嫌な予感がした。',
    ] },
    { if: { flag: 'fd_checked', noflag: ['fd_start', 'fd_safe'] }, set: 'fd_safe', say: [] },
    { if: { flag: ['fd_start', 'reina_bond'], noflag: ['fd_saved', 'fd_fail'], trustMin: { reina: 3 } }, set: 'fd_saved', endDanger: true, trust: { fuyuko: 2, reina: 1 }, unity: 1, say: [
      '玲奈：「待って。冬子さん、顔色が……」',
      '玲奈は冬子の脈を取り、紅茶のカップを取り上げた。「ジギタリス。吐いて、今すぐ」',
      '冬子は助かった。',
    ] },
    { if: { flag: 'fd_fail', noflag: 'dead_fuyuko' }, kill: { id: 'fuyuko', ch: 4, cause: '毒の紅茶', at: ['m_servant', 4, 4], cue: '使用人の部屋' }, fx: 'tea', set: ['frag_fuyuko'], give: 'maho_letter', say: [
      'かちゃん、と受け皿にカップが落ちる音。',
      '使用人の部屋。冬子は椅子に座ったまま、膝の上に手を重ねていた。',
      '時計の音だけが聞こえる。',
      '冬子の手の中に、古い封筒。「真帆さんの手紙。大人になったら、あの子に」と書いた付箋。',
      '……最後まで、渡そうとしてくれていた。',
    ] },
    { if: { flag: ['conf_all_done', 'p12', 'p13', 'p15'], anyCond: 'ch4Done', noflag: 'ch4_end' }, set: 'ch4_end', clock: '03:30', say: [
      '告白が終わり、夜が深くなった。',
      '真帆は記録室から出ていない。十八年前、誰かが地下から氷室へ抜けた。',
    ], chapterEnd: { title: '第4章　告白の夜', sub: '十一人は、それぞれ秘密を抱えていた。', next: '次は第5章「時計の嘘」。食堂で時系列を組み直す。' } },
    // P14：通路と人影
    { if: { flag: ['frag_yu', 'frag_minato'], noflag: 'p14', room: 'm_dining' }, say: [
      '改修図面の通路（約300m）と、庭の赤外線映像（館の時計で23:30の人影）を並べる。',
      { choice: { id: 'p14', q: 'ここから言えることは？', opts: [
        { label: '発火の少し前に、地下を出て氷室へ抜けた人物がいる', set: 'p14', say: ['地下に最後に入ったのは怜司。その人物は、怜司と考えるのが自然だ。'] },
        { label: '誰かが外から地下へ入った', say: ['……人影は地面から「出てきた」。入ったのではない。'] },
      ] } }] },
    // ---------- 第5章 ----------
    { if: { flag: 'ch4_end', noflag: 'ch5_intro' }, set: 'ch5_intro', chapter: 5, clock: '03:40', say: [
      '——第5章　時計の嘘——',
      '生き残った全員が食堂に集まった。大きな紙に、十八年前の出来事を並べていく。',
      '琴音が母の録音を流す。拍手、鐘九回、長い沈黙、車のドア、ラジオの「10時15分」、鐘十回。',
      '……鐘が、一回だけ鳴った。（記憶のかけら④）',
    ] },
    { if: { flag: 'ch5_intro', noflag: 'p16' }, set: 'mem4', say: [
      { choice: { id: 'p16', q: '九回目から十回目の鐘まで、1時間14分57秒。時計は何分止まっていた？', opts: [
        { label: '15分（実時刻 21:40〜21:55）', set: 'p16', say: ['入退室ロールの「21:40 電源断」「21:40 復旧」の二行。停電は実時刻21:40〜21:55。', '以後、館の時計で書かれた時刻はすべて+15分。'] },
        { label: '5分', say: ['……計算が合わない。'] },
        { label: '1時間', say: ['……それなら鐘が一回飛ぶ。'] },
      ] } },
    ] },
    { if: { flag: 'p16', noflag: ['p17', 'p17_try'] }, say: [
      '時系列ボード。館の時計で書かれたカードを、実時刻に直して並べる。',
      { choice: { id: 'tl1', q: '宗一郎の「23:37 火が見えた」は実時刻で？', opts: [{ label: '23:52', set: 'tl1' }, { label: '23:37', set: 'tl_err1' }, { label: '23:22', set: 'tl_err1' }] } },
      { choice: { id: 'tl2', q: '庭の人影「23:30」は実時刻で？', opts: [{ label: '23:45', set: 'tl2' }, { label: '23:30', set: 'tl_err2' }, { label: '23:15', set: 'tl_err2' }] } },
      { choice: { id: 'tl3', q: 'タイマー「23:25」は実時刻で？', opts: [{ label: '23:40', set: 'tl3' }, { label: '23:25', set: 'tl_err3' }] } },
      { choice: { id: 'tl4', q: '研究室の血と遺留品のカードの見出しは？', opts: [
        { label: '「22:50 怜司が自分の血を床に注いだ」', set: 'tl4' },
        { label: '「死んだのは怜司」', set: 'timeline_fake', unity: -1 },
      ] } },
    ], set: 'p17_try' },
    { if: { flag: 'p17_try', noflag: 'p17' }, set: 'p17', say: [] },
    { if: { flag: ['p17', 'tl1', 'tl2', 'tl3', 'tl4'], noflag: 'timeline_ok' }, set: 'timeline_ok', say: ['すべてのカードが、消防と朝倉圭介の手帳の時刻と一致した。'] },
    { if: { flag: 'p17', noflag: 'p18' }, say: [
      { choice: { id: 'p18', q: '22:50に地下に入った怜司が、入口から出ずに消えられたのは？', opts: [
        { label: '記録保管庫から氷室への通路を使った', set: 'p18', if: { flag: 'p14' }, failSay: ['……図面と赤外線映像を並べて考えないと。（悠と湊の告白）'], say: ['入退室ロール、改修図面、庭の映像。地下の密室は、通路で破られていた。'] },
        { label: '入口のカメラを壊した', say: ['……カメラは差し替えられていただけで、壊れていない。'] },
      ] } }] },
    // 宗一郎
    { if: { flag: 'p18', noflag: 'so_choice' }, set: 'so_choice', say: [
      '宗一郎：「……灰原が兄なら、私が話をつける。兄の筆跡で、旧実験室に来いとメモがあった」',
      { choice: { id: 'so_promise', q: '——', opts: [
        { label: '一緒に行く', set: 'so_promise', trust: { soichiro: 2 }, say: ['宗一郎：「……頼む」'] },
        { label: '信じない（行かせない）', trust: { minato: 1 }, say: ['宗一郎は黙ってうなずいた。'] },
      ] } },
    ] },
    { if: { flag: 'so_choice', noflag: ['sd_start', 'sd_safe'], anyCond: 'soichiroRisk' }, set: 'sd_start', fx: 'fire', danger: { id: 'soichiro', moves: 22, fail: 'sd_fail', label: '旧実験室で火の手' }, say: [
      '気がつくと、宗一郎の姿がない。',
      '地下から、焦げた匂い。旧実験室の扉に鎖が巻かれ、隙間から煙が漏れている。',
      '（改修図面の消火配管——旧実験室の天井のバルブ）',
    ] },
    { if: { flag: ['so_choice', 'so_promise'], noflag: ['sd_start', 'sd_safe'] }, set: ['sd_safe', 'sd_with'], fx: 'fire', trust: { soichiro: 1 }, say: [
      '二人で旧実験室へ。扉を開けた瞬間、床に撒かれた灯油に火が走った。',
      '宗一郎を突き飛ばし、図面の消火配管を回す。降り注ぐ水。……間に合った。',
      '宗一郎：「兄は、私まで……」',
    ] },
    { if: { flag: 'so_choice', noflag: ['sd_start', 'sd_safe'] }, set: 'sd_safe', say: [] },
    { if: { flag: 'sd_fail', noflag: 'dead_soichiro' }, kill: { id: 'soichiro', ch: 5, cause: '旧実験室の火災', at: ['m_oldlab', 7, 6], cue: '鎖を外したとき' }, fx: 'fire', set: ['frag_soichiro', 'dna_sample'], say: [
      '扉の小窓の向こうで、赤い光が揺れていた。',
      '炎の音が、ふいに止んだ。煙の中の静けさ。',
      '鎖を外したとき、宗一郎は扉のすぐ内側で、兄の字のメモを握りしめていた。',
      '玲奈：「煙を吸って……もう」',
      '遺品の櫛に残った毛髪を、玲奈が袋に入れた。「DNAの照合は、これで」',
    ] },
    { if: { flag: ['sd_safe'], noflag: 'dna_sample', trustMin: { soichiro: 4 } }, set: 'dna_sample', say: ['宗一郎：「兄の生存を、私が証言する。DNAの照合にも協力する」', '灰原が使ったカップと、宗一郎の頬の粘膜。照合の試料がそろった。'] },
    { if: { flag: ['sd_saved'], noflag: 'dna_sample' }, set: 'dna_sample', say: ['宗一郎：「兄の生存を、私が証言する。照合の試料を取ってくれ」'] },
    { if: { flag: ['tr1', 'tr2', 'tr3', 'tr4'], noflag: 'trick_broken' }, set: ['trick_broken', 'p19'], unity: 1, say: ['四つの細工がすべて崩れた。……捜査記録の握りつぶしと鑑定書の書き換えが、それを支えていた。', '〈{name}〉：「母は逃げたんじゃない。この館から、一度も出ていない」'] },
    // P20：NO.11の告発
    { if: { flag: 'trick_broken', noflag: 'accused_ok' }, say: [
      '最後の問い。——怜司は、今どこにいるのか。',
      { choice: { id: 'p20', q: 'NO.11は、この中の誰？', opts: [
        { label: '灰原', set: 'accused_ok' },
        { label: '御影宗一郎', set: 'accuse_wrong', unity: -2, say: ['宗一郎：「私は兄の弟だ。……放送のとき、私はずっと食堂にいた」', '灰原の姿が、一瞬、消えた。……証拠の一つが、焼かれていた。'] },
        { label: '黒瀬修司', set: 'accuse_wrong', unity: -2, say: ['黒瀬：「放送の間、俺はお前らと一緒にいた」', '灰原の姿が、一瞬、消えた。……証拠の一つが、焼かれていた。'] },
      ] } },
    ] },
    { if: { flag: 'accuse_wrong', noflag: 'burn1' }, set: 'burn1', burn: 'fake_diary', say: ['偽の日記が、灰になっていた。'] },
    { if: { flag: ['accuse_wrong', 'burn1'], noflag: ['accused_ok', 'accuse_wrong2_check'] }, set: 'accuse_wrong2_check', say: [] },
    { if: { flag: 'accused_ok', noflag: 'accused_scene' }, set: 'accused_scene', say: [
      { choice: { id: 'ev1', q: '決め手の一つめは？', opts: [{ label: 'メニューカードと2012年のカードの筆跡（左手）', set: 'ev_ok1', if: { has: 'menu_card' } }, { label: '懐中時計（15分遅れ、R.M.）', set: 'ev_ok1', if: { has: 'pocket_watch' } }, { label: '琴音の聴いた鼻歌の癖', set: 'ev_ok1', if: { flag: 'hum_noted' } }, { label: '放送の記録（灰原だけ不在）', set: 'ev_ok1', if: { has: 'broadcast_log' } }, { label: '冬子の証言', set: 'ev_ok1', if: { anyHas: ['maho_letter'] } }] } },
      '灰原は、色付きの眼鏡を外さずに笑った。',
      '灰原：「……正解だ。だが、証拠がなければ記録は変わらない。最深部で待つ。夜明けの鐘で、地下の記録はすべて燃える」',
      '灰原は厨房の配膳用リフトの縦穴へ飛び込み、姿を消した。',
      '湊|悠：「中央管理盤の権限を奪えば、地下の電子錠を開けられる。監視室へ」',
    ] },
    { if: { flag: 'accused_scene', noflag: 'accuse_first_ok', anyCond: 'firstTry' }, set: 'accuse_first_ok', say: [] },
    // 管理者権限 → 低温書庫
    { if: { flag: 'accused_scene', noflag: ['admin_rights', 'dead_minato'], room: 'm_monitor' }, set: ['admin_rights', 'cold_open'], say: [
      '中央管理盤。灰原の管理者権限で動いている。',
      '湊：「2008年のログに、怜司のコマンドの打ち方が残ってる。合言葉の作り方は同じだ。……よし、権限を移した」',
      '電子錠の一覧に「低温書庫：解錠」。記録保管庫の西の気密扉だ。',
    ] },
    { if: { flag: ['accused_scene', 'dead_minato'], noflag: 'admin_rights', room: 'm_monitor' }, set: ['admin_rights', 'cold_open'], say: [
      '中央管理盤。灰原の管理者権限で動いている。',
      '湊が遺したUSBの操作ログを、悠と二人で読み解く。……時間はかかったが、権限が移った。',
      '電子錠の一覧に「低温書庫：解錠」。記録保管庫の西の気密扉だ。',
    ] },
    { if: { room: 'm_cold', noflag: 'found_maho' }, set: ['found_maho'], say: [
      '低温書庫。冷気が肌を刺す。',
      '音が、すべて吸い込まれたように消えた。',
      '中央の台に、布で覆われた人の形。そばに名札「如月真帆」と、2008年11月14日の日付の手帳。ボイスレコーダーの、空のケース。',
      '……お母さん。',
      '玲奈が布の端をそっと持ち上げ、目を伏せた。「後頭部に、丸い陥没骨折。縁に一段の段差がある」',
      '十八年間、母はここにいた。自分を置いて消えたんじゃない。',
    ] },
    { if: { flag: ['found_maho', 'accused_scene'], noflag: 'ch5_end' }, set: 'ch5_end', clock: '05:00', say: [
      '夜明けまで、あと一時間。',
      { choice: { id: 'fix_clock', q: '——', opts: [
        { label: '親時計を正しい時刻に直してから行く', set: 'clock_fixed', say: ['親時計を15分進めた。……灰原の「夜明けの鐘」の計算が狂う。'] },
        { label: 'すぐ最深部へ向かう' },
      ] } },
      '記録保管庫の床の扉が、下から開いていた。',
    ], chapterEnd: { title: '第5章　時計の嘘', sub: '母は、十八年間この館の地下にいた。', next: '次は第6章「最後の鍵」。記録保管庫の床の扉から最深部へ。' } },
    // ---------- 第6章 ----------
    { if: { flag: 'ch5_end', noflag: 'ch6_intro' }, set: 'ch6_intro', chapter: 6, say: ['——第6章　最後の鍵——', '記録保管庫の床の扉の下へ。……地下通路の先に、灯りが見える。'] },
    { if: { room: 'm_rarchive', noflag: 'confront' }, set: 'confront', say: [
      '十一の小部屋の奥。記録の棚に囲まれた部屋で、灰原が待っていた。',
      '灰原：「よく来た。……さあ、十一人の名で読み上げてもらおう。『死んだのは御影怜司、如月真帆は失踪した』と」',
      '灰原は色付きの眼鏡を外した。作り声が消え、低い声が響く。',
      '怜司：「私が御影怜司だ。この火傷は本物だよ。十八年前、自分で放った火でね」',
      '怜司：「真実とは、皆が合意した記録のことだ。……崩せるものなら、崩してみなさい」',
    ] },
    // P22：7つの主張
  ];
  const CLAIMS = [
    ['私はあの火事で死んだ。あの血が証拠だ', '鑑定書・診療記録・バッグのタグ', { has: ['appraisal', 'med_record', 'blood_tag'] }],
    ['私は地下から出ていない', '入退室ロール・改修図面・庭の赤外線映像', { has: ['entry_roll', 'blueprint_full', 'ir_footage'] }],
    ['火災は事故だ', '研究室のタイマーの基板・母の録音', { has: ['timer_board', 'tape'] }],
    ['真帆は自分で出て行った', '偽の日記の矛盾・ロールの「退室なし」・低温書庫の母', { flag: ['p15', 'found_maho'] }],
    ['真帆を殺した証拠はない', '鐘形の文鎮と陥没骨折の一致・差し替えられた映像', { has: 'bell_weight', flag: 'p12' }],
    ['私が生きていた証拠はない', '2012年のカードとメニューカードの筆跡・懐中時計・空港の写真', { anyHas: ['card_draft', 'client_list'], has: 'menu_card' }],
    ['私には動機がない', '母の研究ノート・額縁の裏の資料・顧客名簿・圭介の手帳', { has: ['research_note'], flag: 'frag_ren' }],
  ];
  // 怜司と話すたびに、次の主張が出る。足りない証拠は部屋を出て取りに行ける（詰み防止）
  const reijiActs = CLAIMS.map(([claim, ev, need], k) => {
    const prev = k === 0 ? 'confront' : 'cl' + k, me = 'cl' + (k + 1);
    return { if: { flag: prev, noflag: me }, say: [
      '怜司：「主張' + (k + 1) + '。' + claim + '」',
      { choice: { id: me, q: '突きつける証拠は？', opts: [
        { label: ev, set: me, if: need, failSay: ['……その証拠が手元にない。（取りに行ってから、もう一度話そう）', '怜司：「それでは記録にならない」'] },
        { label: '今は何も出さない', say: ['怜司：「いつでも来なさい。夜明けの鐘までは待とう」'] },
      ] } },
    ] };
  });
  reijiActs.push({ if: { flag: 'claims_all', noflag: ['refused_proposal', 'accepted_proposal'] }, say: [
    '怜司：「声明に署名すれば、全員を帰す。記録は私が焼く。これ以上、誰も死なない」',
    { choice: { id: 'proposal', q: 'その提案を——', def: 0, opts: [
      { label: '拒む（真実を持ち帰る）', set: 'refused_proposal', value: 'refuse' },
      { label: '受け入れる（声明に署名する）', set: 'accepted_proposal', value: 'accept', confirm: { q: '本当に署名しますか。記録は燃やされ、真実は二度と語られません。', yes: 'はい（署名する）', no: 'いいえ（選び直す）' } },
    ] } },
  ] });
  reijiActs.push({ say: ['怜司：「……」'] });
  ELD.ROOMS.m_rarchive.ins.push({ id: 'ra_reiji', npc: 'haibara', x: 7, y: 5, vis: { flag: 'ch5_end', noflag: 'reiji_fled' }, acts: reijiActs });
  // 証拠が足りず詰まないための救済：主張の選択肢を出し直す前に、足りない物の在りかを示す
  RULES2.push(
    { if: { flag: 'cl7', noflag: 'claims_all' }, set: 'claims_all', retryPoint: true, say: ['七つの主張が、すべて崩れた。', '怜司：「……見事だ。では、取引をしよう」', '（怜司ともう一度話す）'] },
    { if: { room: 'm_passage', noflag: 'passage_hint' }, set: 'passage_hint', say: ['通路の途中、排水口の格子が光った気がした。'] },
    { if: { flag: 'accepted_proposal', noflag: 'final_done' }, set: 'final_done', ending: true, say: ['ペンを取った。……名前を書く手が、震えていた。'] },
    { if: { flag: 'refused_proposal', noflag: 'chase_done' }, set: 'chase_done', say: [
      '〈{name}〉：「お断りします。母の記録は、私たちが持って帰る」',
      '怜司はレコーダーをつかみ、氷室へ続く通路へ駆け出した。焼却炉に火が入る。',
      { choice: { id: 'chase2', checkpoint: true, q: '——', opts: [
        { label: '怜司を追う', set: 'chased', say: ['通路を走る。氷室の出口で、怜司の背中が見えた。'] },
        { label: 'アーカイブを守る', set: 'saved_archive', say: ['焼却炉の火を消した。棚の記録は守られた。'] },
      ] } },
    ] },
    // 黒瀬がいないと、氷室の出口で一人きりになる
    { if: { flag: ['chased', 'dead_kurose'], noflag: ['got_recorder', 'chase_trap'] }, set: 'chase_trap', heroDeath: { id: 'icehouse', title: 'DEAD END', cause: '一人で怜司を追い、氷室に閉じ込められた。……黒瀬がいれば、出口の錠を押さえてくれたはずだった。' }, say: [
      '氷室の出口。……誰もいない。',
      '背後で、重い扉が閉まる音。電子錠の落ちる音。',
      '怜司（扉の向こう）：「追ってくると思っていたよ。真帆もそうだった」',
      '冷気が、足元から這い上がってくる。吐く息が白い。……指が、もう動かない。',
    ] },
    { if: { flag: 'chase_done', noflag: 'got_recorder' }, set: ['got_recorder', 'reiji_fled'], say: [
      '氷室の出口。',
    ] },
    { if: { flag: 'got_recorder', noflag: 'captured_msg' }, set: 'captured_msg', sfx: 'bell', say: [
      '夜明けの鐘が鳴った。',
      '氷室の外で、怜司が膝をついていた。手から落ちたボイスレコーダーを拾う。',
    ] },
    { if: { flag: 'captured_msg', noflag: 'fuyuko_invite', trustMin: { fuyuko: 4 }, examined: 'item:invitation:addr' }, set: 'fuyuko_invite', say: [
      '冬子：「……あの招待状。あなたの宛名を書いたのは、私よ」',
      '冬子：「管理会社の清掃の仕事で館に入って、出されずに残っていた一通を見つけたの。真帆さんとの約束を守りたかった。それに、十八年隠れているのは、もう終わりにしたかった」',
    ] },
    { if: { flag: 'captured_msg', noflag: 'final_done' }, set: 'final_done', ending: true, say: ['館の外が、白み始めていた。'] },
  );
  // ルールの追加（最後の鍵の問いは提案を拒んだ後、エンディングの前に）
  const lastkey = [
    { if: { flag: ['refused_proposal', 'lastkey_asked', 'captured_msg'], noflag: ['lastkey_understood', 'final_done'] },
      say: ['……違う。母が託したのは、そういうものではなかった気がする。', { choice: { id: 'lastkey', q: '最後の鍵とは、何だったのか。', opts: [{ label: '館の最深部を開ける本物の鍵' }, { label: '11人の証拠と証言そのもの', set: 'lastkey_understood' }, { label: '母が遺したペンダント' }] } }] },
    { if: { flag: ['refused_proposal', 'captured_msg'], noflag: ['lastkey_asked', 'final_done'] }, set: 'lastkey_asked',
      say: ['——最後に、もう一つだけ確かめたい。', { choice: { id: 'lastkey', q: '最後の鍵とは、何だったのか。', opts: [{ label: '館の最深部を開ける本物の鍵' }, { label: '11人の証拠と証言そのもの', set: 'lastkey_understood' }, { label: '母が遺したペンダント' }] } }] },
  ];
  const fin = RULES2.findIndex((r) => r.if && r.if.flag === 'captured_msg' && r.ending);
  RULES2.splice(fin, 0, ...lastkey);
  ELD.RULES = ELD.RULES.concat(RULES2);

  /* ---------- 複合条件（ルールの anyCond） ---------- */
  const tr = (S, k) => (S.trust[k] || 0);
  ELD.COND_FN = Object.assign(ELD.COND_FN || {}, {
    minatoRisk: (S) => !!S.flags.c_breaker || (S.unity == null ? 5 : S.unity) <= 4,
    minatoDone: (S) => !S.danger || S.danger.id !== 'minato',
    kuroseRisk: (S) => !S.flags.dead_kurose && (!!S.flags.kurose_denounced || (tr(S, 'kurose') <= 1 && (S.unity == null ? 5 : S.unity) <= 4)),
    fuyukoRisk: (S) => !S.flags.dead_fuyuko && (!!S.flags.fuyuko_told_all || tr(S, 'fuyuko') <= 1 || (!!S.flags.fuyuko_promise && !S.flags.bug_removed)),
    soichiroRisk: (S) => !S.flags.dead_soichiro && !S.flags.so_promise && tr(S, 'soichiro') < 3,
    soDone: (S) => !!(S.flags.sd_safe || S.flags.sd_saved || S.flags.dead_soichiro),
    ch4Done: (S) => !S.danger && !!S.flags.kd_checked && !!S.flags.fd_checked && !!(S.flags.kd_safe || S.flags.kd_saved || S.flags.dead_kurose) && !!(S.flags.fd_safe || S.flags.fd_saved || S.flags.dead_fuyuko) && !!S.flags.p14,
    firstTry: (S) => !S.flags.accuse_wrong,
    allConfessed: (S) => (!S.danger || S.danger.id !== 'minato') && CONF.every((w) => S.flags['conf_' + w] || S.flags['dead_' + w]),
    kuroseResolved: (S) => !!(S.flags.kd_safe || S.flags.kd_saved || S.flags.dead_kurose),
  });
  // 食堂にいない時間帯（出来事で別の部屋にいる間）
  const F = (S, f) => !!S.flags[f];
  const between = (S, a, b) => F(S, a) && !F(S, b);
  const busy = { mizuki: (S) => between(S, 'ch1_end', 'ch2_end'), reina: (S) => between(S, 'ch1_end', 'ch2_end'), kotone: (S) => between(S, 'ch1_end', 'ch2_end'),
    yu: (S) => between(S, 'ch1_end', 'ch3_end'), minato: (S) => between(S, 'ch3_end', 'p12'),
    kurose: (S) => F(S, 'kd_start') && !F(S, 'kd_saved') && !F(S, 'kd_fail'), fuyuko: (S) => F(S, 'fd_start') && !F(S, 'fd_saved') && !F(S, 'fd_fail'),
    soichiro: (S) => F(S, 'sd_start') && !F(S, 'sd_saved') && !F(S, 'sd_fail'), ren: () => false };
  Object.keys(busy).forEach((w) => (ELD.COND_FN['din_' + w] = (S) => !busy[w](S)));

  /* ---------- 黒瀬の救出（鐘楼の床） ---------- */
  ELD.ROOMS.m_belfry.ins[0].acts = [
    { if: { flag: 'kd_start', noflag: ['kd_saved', 'kd_fail'], anyflag: ['saw_toolmarks'] }, say: ['床板に駆け寄る。ボルトが外されている——黒瀬の足が、その真上に。', '〈{name}〉：「動かないで！」', '黒瀬の腕をつかんで引き戻した瞬間、床板が闇の底へ抜け落ちた。', '黒瀬：「……借りができたな」'], set: 'kd_saved', endDanger: true, trust: { kurose: 2 }, unity: 1 },
    { if: { flag: 'kd_start', noflag: ['kd_saved', 'kd_fail', 'dead_minato'], trustMin: { minato: 3 } }, say: ['湊（無線）：「鐘楼のカメラ、床板の支えが外れてる！ 黒瀬さんを下がらせて！」', '黒瀬を引き戻した直後、床板が抜け落ちた。', '黒瀬：「……借りができたな」'], set: 'kd_saved', endDanger: true, trust: { kurose: 2 }, unity: 1 },
    { if: { flag: 'kd_start', noflag: ['kd_saved', 'kd_fail'] }, say: ['黒瀬：「何しに来た。……ロールならこの箱だ」', '……何かがおかしい。でも、何が危ないのか分からない。'] },
    { say: ['鐘の下の床板。支えのボルトが新しい。'], set: 'saw_toolmarks' },
  ];
  // 黒瀬が鐘楼にいるときの会話
  ELD.ROOMS.m_belfry.ins.push({ id: 'bel_kurose', npc: 'kurose', x: 3, y: 6, vis: { flag: 'kd_start', noflag: ['kd_saved', 'kd_fail'] }, acts: [{ say: ['黒瀬：「……何しに来た」'] }] });

  /* ================= アイテム ================= */
  const it = (id, name, cat, icon, c, desc, found) => (ELD.ITEMS[id] = { name, cat, icon, c, desc, found, important: true });
  it('fake_diary', '偽の日記', 'doc', 'book', '#6a3a2a', '「M.K.」の日記。「怜司さんを止めなければ」「〈{name}〉、ごめんなさい」。', '第2章・図書室');
  it('uv_light', '紫外線ライト', 'key', 'shard', '#9a8ae0', '美月から借りた修復用のライト。', '第2章・画廊（美月）');
  it('uv_photo', '下絵の写し', 'photo', 'photo', '#8090c0', '時計塔の断面図。鐘の真下の扉。「記録は地下に。扉は譜面の中に」。', '第2章・画廊');
  it('score', '夜想曲の楽譜', 'doc', 'score', '#e0d8c0', '最初の四つの音符に丸。ミ・レ・ド・レ。', '第2章・音楽室');
  it('child_photo', '子供部屋の写真', 'photo', 'photo', '#e0b0c0', '幼い自分と琴音。', '第2章・子供部屋');
  it('appraisal', '最初の鑑定書', 'doc', 'record', '#e0e0d0', '玲奈の父の鑑定書の控え。保存液の成分、凝固なし、火災より前。', '第2章・資料保管室（玲奈）');
  it('tower_key', '時計塔の鍵', 'key', 'gearkey', '#c8a050', '歯車の形の鍵。', '第3章・柱時計の振り子の奥');
  it('power_map', '配電系統図', 'doc', 'record', '#c0d0e0', 'A=主電源、B=地下照明・職員扉、C=時計塔の外灯。「監視室・消火設備」の回路もある。', '第3章・親時計室');
  it('research_note', '真帆の研究ノート', 'doc', 'book', '#4a5a7a', '研究の悪用の告発計画。「私が残せるのは4つ」。', '第3章・記録保管庫');
  it('timer_board', '焼けたタイマーの基板', 'photo', 'gear', '#70605a', '設定「23:25」（館の時計）。火事は時限式。', '第3章・研究室');
  it('blood_tag', '血液バッグのタグ', 'photo', 'card', '#d06060', '「CPDA-1　採血日 10/17　400mL　御影怜司」。', '第3章・研究室');
  it('med_record', '診療記録の控え', 'doc', 'record', '#e0e0f0', '自己血 400mL×4回。腰椎手術の紹介状。手術日の記載なし。', '第3章・医務室');
  it('ir_footage', '庭の赤外線映像', 'photo', 'tape', '#80a0a0', '館の時計で23:30、氷室のそばの人影。', '第4章・湊');
  it('airport_photo', '空港の写真', 'photo', 'photo', '#a0a080', '2009年、圭介が撮った怜司に似た男。', '第4章・蓮');
  it('frame_docs', '額縁の裏の資料', 'doc', 'record', '#c0b080', '証言誘導の手順書と、研究の請求書の写し。', '第4章・美月');
  it('edit_history', '鑑定書の修正履歴', 'doc', 'record', '#d0c0c0', '「記録室の書架の取っ手：別人（女性）の血液反応→削除」。', '第4章・玲奈');
  it('client_list', '顧客名簿と2012年のカード', 'doc', 'book', '#3a3a4a', '研究の顧客名簿。怜司の左手の字のカード「記録は嘘をつかない」。', '第4章・宗一郎');
  it('blueprint_full', '改修図面の完全版', 'doc', 'blueprint', '#6080a0', '保管庫→氷室の通路（約300m）、旧実験室の消火配管と排煙窓、「補強未施工」の区画。', '第4章・悠');
  it('tape', '演奏会の録音', 'photo', 'tape', '#a080a0', '鐘九回から十回まで1時間14分57秒。ラジオ「10時15分」。', '第4章・琴音');
  it('entry_roll', '入退室ロールの原本', 'doc', 'record', '#c0a080', '「21:28 如月 入室」「如月 退室なし」「21:40」が二行。', '第4章・黒瀬');
  it('maho_letter', '真帆の手紙', 'doc', 'letter', '#f0e0d0', '「大人になったら、あの子に」。', '第4章・冬子');
  it('pocket_watch', '灰原の懐中時計', 'photo', 'watch', '#c0a060', 'ちょうど15分遅れ。裏蓋に「R.M.」。', '第4章・厨房');
  it('broadcast_log', '放送の記録', 'doc', 'record', '#a0a0c0', '今夜の4回の放送。そのたび、灰原だけが不在。', '第4〜5章・館長室');
  it('accusation', '真帆の告発文', 'doc', 'record', '#f0f0e0', '研究の悪用の告発。末尾に十一人の名。', '第5章・低温書庫');
  it('bell_weight', '鐘形の文鎮', 'photo', 'key', '#b08040', '底の形が、真帆の頭の傷と一致する。', '第6章・地下通路');
  it('card_draft', '2012年のカードの下書き', 'doc', 'card', '#d0d0c0', '怜司の左手の字で「弟へ」。', '第6章・アーカイブ');
  it('diary_page', '日記の切り取られた頁', 'doc', 'letter', '#f0e8e0', '「あの子の声を、ここに残す」。', '第6章・アーカイブ');

  /* ================= 推理手帳（第2章以降） ================= */
  const N = (o) => ELD.NOTES.push(o);
  N({ id: 'tl_bell', cat: 'timeline', time: '今夜 0:00', title: '15分遅れの鐘', text: '鐘が十二回。スマートフォンは0:15。', unlock: { flag: 'ch2_intro' } });
  N({ id: 'tl_fire', cat: 'timeline', time: '2008 23:52', title: '消防の覚知', text: '外の正確な時刻。圭介の手帳と一致。', unlock: { flag: 'saw_fire_record' } });
  N({ id: 'm_time', cat: 'mystery', title: '三つの時刻', text: '宗一郎23:37、圭介23:52、消防23:52。', unlock: { flag: 'ch2_intro' }, resolve: 'p03', resolvedText: '館の時計が15分遅れていた。誰も嘘をついていない。' });
  N({ id: 'm_blood', cat: 'mystery', title: '研究室の血', text: '公式「出血多量のうえ火災で死亡」。だが飛沫がない。', unlock: { flag: 'saw_report' }, resolve: 'p11', resolvedText: '怜司が前もって抜いた自分の血（400mL×4回）。死は偽装の可能性。' });
  N({ id: 'm_diary', cat: 'mystery', title: '偽の日記', text: '「真帆が怜司を殺して逃げた」と語る日記。', unlock: { flag: 'diary_read' }, resolve: 'p15', resolvedText: '娘の名・左手の擦れ・2015年の紙。作られた答えだった。' });
  N({ id: 'm_room', cat: 'mystery', title: '地下の密室', text: '怜司は22:50に地下へ入り、出ていない。', unlock: { flag: 'ch3_end' }, resolve: 'p18', resolvedText: '記録保管庫から氷室への通路を使った。' });
  N({ id: 'm_mother', cat: 'mystery', title: '母はどこへ', text: '入退室ロール「如月：退室なし」。', unlock: { flag: 'p13' }, resolve: 'found_maho', resolvedText: '母は低温書庫にいた。十八年間、この館の地下に。' });
  N({ id: 'q_lastkey', cat: 'question', title: '最後の鍵', text: '「最後の鍵は十一に分けた」。', unlock: { flag: 'watermark_solved' }, resolve: 'lastkey_understood', resolvedText: '最後の鍵とは、十一人の証拠と証言そのもの。' });
  ELD.NOTES.find((n) => n.id === 'q_no11').resolve = 'accused_ok';
  ELD.NOTES.find((n) => n.id === 'q_no11').resolvedText = '管理人の灰原が、死んだはずの御影怜司だった。';
  ELD.NOTES.find((n) => n.id === 'q_mother').resolve = 'found_maho';
  ELD.NOTES.find((n) => n.id === 'q_mother').resolvedText = '母は逃げていなかった。あの夜、この館で殺されていた。';
  ELD.NOTES.find((n) => n.id === 'm_seal').resolve = 'final_done';
  ELD.NOTES.find((n) => n.id === 'm_seal').resolvedText = '夜明けとともに封鎖は解けた。';
  ELD.NOTES.find((n) => n.id === 'm_cutline').resolve = 'accused_ok';
  ELD.NOTES.find((n) => n.id === 'm_cutline').resolvedText = '電話線を切ったのは怜司（灰原）。';
  ELD.NOTES.find((n) => n.id === 'q_hand').resolve = 'fuyuko_invite';
  ELD.NOTES.find((n) => n.id === 'q_hand').resolvedText = '冬子が、残っていた一通に宛名を書いて投函した。';

  /* ================= エンディング判定（本編） ================= */
  const FRAG = ['frag_ren', 'frag_mizuki', 'frag_kurose', 'frag_fuyuko', 'frag_minato', 'frag_reina', 'frag_soichiro', 'frag_yu', 'frag_kotone', 'got_recorder'];
  const TRUE_REQ = [
    { id: 'evidence', label: '重要証拠をすべて集める', design: '11のかけらがそろっている', cond: { flag: FRAG } },
    { id: 'identity', res: '怜司の正体', label: '怜司の正体を証明する', design: 'NO.11を1回で告発し、DNA照合の試料をそろえる', cond: { flag: ['accuse_first_ok', 'dna_sample'] } },
    { id: 'maho', res: '真帆の殺害', label: '如月真帆の殺害を証明する', design: '低温書庫で真帆を見つけ、凶器の文鎮とボイスレコーダーを回収する', cond: { flag: ['found_maho', 'got_recorder', 'got_weight'] } },
    { id: 'trick', res: '火災の経緯', label: '18年前の火災の経緯を証明する', design: '死亡偽装の細工をすべて崩す', cond: { flag: 'trick_broken' } },
    { id: 'timeline', res: '5つの柱と時系列', label: '動機・方法・機会・時系列をつなぐ', design: '時系列を正しく組む（偽の答えを残さない）', cond: { flag: 'timeline_ok', noflag: 'timeline_fake' } },
    { id: 'victims', label: '犠牲者を一人も出さない', design: '美月・湊・冬子・黒瀬・宗一郎の5人全員を救出', cond: { victimsMax: 0 } },
    { id: 'claims', res: '怜司の7つの主張', label: '最終謎解きを成功させる', design: '7つの主張をすべて崩す', cond: { flag: 'claims_all' } },
    { id: 'coop', label: '11人の協力関係を保つ', design: '全員が告白し、黒瀬が公の証言を約束し、冬子の信頼度4以上', cond: { flag: ['conf_all_done', 'kurose_promise'], trustMin: { fuyuko: 4 } } },
  ];
  ELD.TRUE_REQ = TRUE_REQ;
  ELD.KEY_EVIDENCE = [];
  ELD.KEY_FLAGS = FRAG;
  ELD.ENDING_RULES = {
    bad: { any: [{ id: 'accept', label: '怜司の提案を受け入れる', design: '最終選択で「受け入れる」を選び、確認でも「はい」', cond: { flag: 'accepted_proposal' } }] },
    secret: { all: [
      { id: 'cleared', label: 'TRUE ENDを一度達成している', design: '周回の記録', cond: { trueCleared: true } },
    ].concat(TRUE_REQ, [
      { id: 'deep', label: '隠された記録を発見している', design: '低温書庫の奥で、真帆の告発文を見つける', cond: { flag: 'found_accusation' } },
      { id: 'records', label: '11人それぞれの秘密に関係する情報', design: '全員の告白＋怜司のカードの下書き', cond: { flag: ['conf_all_done', 'secret_reiji'] } },
      { id: 'invitation', label: '冬子が招待状を送った理由を解明', design: '宛名の筆跡を確かめ、冬子に聞く', cond: { flag: 'fuyuko_invite' } },
      { id: 'diary', label: '真帆が残した追加記録', design: '日記の切り取られた頁と、ペンダントで開くファイル', cond: { flag: 'maho_voice' } },
      { id: 'lastkey', label: 'LAST KEYの本当の意味を理解', design: '「最後の鍵とは何か」に正しく答える', cond: { flag: 'lastkey_understood' } },
    ]) },
    true: { all: TRUE_REQ },
    normal: { all: [] },
  };
})();
