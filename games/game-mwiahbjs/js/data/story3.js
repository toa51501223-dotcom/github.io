/* =====================================================================
 * ELDIA 本編：画面の案内（目的の表示）と部屋ごとのBGM
 * ===================================================================== */
(function () {
  const ELD = window.ELD;
  const F = (S, f) => !!S.flags[f];

  /* ---------- 部屋ごとのBGM（前庭は環境音のまま） ---------- */
  const BGM = {
    m_hall: 'manor', m_office: 'office', m_east: 'quiet', m_guest: 'quiet', m_dining: 'dinner', m_kitchen: 'kitchen', m_servant: 'quiet',
    m_wcorr: 'study', m_library: 'study', m_study: 'study', m_archive: 'study', m_gallery: 'gallery', m_music: 'nocturne', m_child: 'musicbox',
    m_tclock: 'clock', m_belfry: 'belfry',
    m_bstairs: 'under', m_vault: 'under', m_recroom: 'under', m_oldlab: 'under', m_passage: 'under',
    m_lab: 'clinic', m_infirm: 'clinic', m_cold: 'cold', m_testimony: 'reiji', m_rarchive: 'reiji',
    m_staff: 'tech', m_monitor: 'tech', m_director: 'office',
  };
  for (const id in BGM) if (ELD.ROOMS[id]) ELD.ROOMS[id].bgm = BGM[id];

  /* ---------- 前庭：館に入る条件を、残りの名前つきで伝える ---------- */
  const SPOT_NAME = { yard_gate: '鉄の門', yard_road: '麓への道（停留所の下）', yard_ice: '氷室への小道（右端）', yard_flowers: '左上の花壇', yard_cam: '監視カメラ（右上の柱）', yard_box: '外壁の灰色の箱', yard_bus: '停留所の標識', yard_win: '館の右側の窓' };
  const PEOPLE = [['ren_t1', '朝倉蓮（停留所）'], ['minato_t1', '門の制御盤の青年'], ['reina_t1', 'ベンチのそばの女性'], ['yu_t1', '眼鏡の青年'], ['kurose_t1', '生け垣のそばの男']];
  const yardPeopleLeft = (S) => PEOPLE.filter(([f]) => !F(S, f)).map(([, n]) => n);
  const yardSpotsLeft = (S) => ELD.YARD_SPOTS.filter((k) => !S.examined[k]).map((k) => SPOT_NAME[k]);
  const door = ELD.ROOMS.m_yard.ins.find((i) => i.id === 'yard_door');
  door.acts = door.acts.filter((a) => !(a.if && (a.if.anyCond === 'yardLeft' || /_t1$/.test(String(a.if.noflag || '')))));
  door.acts.splice(1, 0, { if: { anyCond: 'yardNotReady' }, sayFn: (S) => {
    const p = yardPeopleLeft(S), q = yardSpotsLeft(S), out = ['扉に手をかけて、やめた。……まだ館に入る気になれない。'];
    if (p.length) out.push('話していない人：' + p.join('、'));
    if (q.length) out.push('調べていない所：' + q.join('、'));
    return out;
  } });
  ELD.COND_FN.yardNotReady = (S) => yardPeopleLeft(S).length > 0 || yardSpotsLeft(S).length > 0;

  /* ---------- 目的の表示（上から順に、最初に当てはまるもの） ---------- */
  const CONF = [['ren', '蓮'], ['mizuki', '美月'], ['kurose', '黒瀬'], ['fuyuko', '冬子'], ['minato', '湊'], ['reina', '玲奈'], ['soichiro', '宗一郎'], ['yu', '悠'], ['kotone', '琴音']];
  const DANGER_HINT = { minato: '管理区域の廊下へ。配電盤で回路を切るか、通風路から入る', kurose: '時計塔の上、鐘楼へ急ぐ', fuyuko: '東館の冬子の部屋（使用人の部屋）へ急ぐ', soichiro: '地下の旧実験室（研究室の東）へ急ぐ。図面の消火配管' };
  const fn = (name, f) => (ELD.COND_FN[name] = f, { anyCond: name });
  ELD.OBJECTIVES = [
    // 危険イベントは最優先
    { if: fn('obj_danger', (S) => !!S.danger), text: (S) => '急げ！ ' + S.danger.label + '（残り ' + S.danger.left + ' 手）——' + (DANGER_HINT[S.danger.id] || '') },
    // ---- プロローグ（バス） ----
    { if: { room: 'm_bus' }, text: '右下の前扉からバスを降りる（扉の前で下へ進む）' },
    // ---- 第1章 ----
    { if: { room: 'm_yard', noflag: 'greeted', anyCond: 'yardNotReady' }, text: (S) => {
      const p = yardPeopleLeft(S), q = yardSpotsLeft(S);
      return p.length ? '前庭の人と話す（残り ' + p.length + ' 人）：' + p[0] : '前庭の気になる所を調べる（残り ' + q.length + ' か所）：' + q[0];
    } },
    { if: { noflag: 'greeted' }, text: '館の正面の扉を調べる' },
    { if: { noflag: 'hb_t1' }, text: '玄関ホールのカウンターにいる管理人（灰原）と話す' },
    { if: { noflag: 'unpacked' }, text: '東館の客室（廊下の右から二つ目の扉）に荷物を置く' },
    { if: { noflag: 'dinner_start' }, text: '19時。東館の食堂へ行く' },
    { if: { flag: 'sealed', noflag: ['watermark_solved', 'saw_placecard'] }, text: '食堂の右端の席札「NO.11」を調べる' },
    { if: { flag: 'sealed', noflag: 'watermark_solved' }, text: '食堂のテーブルで招待状の透かしを並べる' },
    { if: { flag: 'sealed', noflag: 'hb_sealed' }, text: '玄関ホールの灰原に、封鎖のことを聞く' },
    { if: { flag: 'sealed', noflag: 'got_west_key' }, text: '玄関ホール左上のキーボックスを開ける（蓋の裏：「この館の時間」）' },
    // ---- 第2章 ----
    { if: { flag: 'ch1_end', noflag: 'ch2_end' }, text: (S) => {
      const t = [];
      if (!F(S, 'saw_fire_record')) t.push('資料保管室の棚で消防の記録を見る');
      if (!F(S, 'p04')) t.push('資料保管室の写真を見比べる');
      if (!F(S, 'p03')) t.push('書斎の机で三つの時刻を比べる');
      if (!S.inv.includes('uv_light')) t.push('画廊の美月と話す');
      else if (!F(S, 'p05')) t.push('画廊の左の風景画に紫外線を当てる');
      if (!F(S, 'diary_read')) t.push('図書室の閲覧机を調べる');
      if (!F(S, 'score_got')) t.push('音楽室の譜面台を調べる');
      return '西館を調べる：' + t[0] + (t.length > 1 ? '（ほか ' + (t.length - 1) + ' 件）' : '');
    } },
    // ---- 第3章 ----
    { if: { flag: 'ch2_end', noflag: 'tower_open' }, text: '玄関ホールの柱時計（振り子の奥）を調べる' },
    { if: { flag: 'ch2_end', noflag: 'power_b' }, text: '時計塔の親時計室で、配電盤のブレーカーを直す' },
    { if: { flag: 'ch2_end', noflag: 'p07' }, text: '西館の書斎で、北の本棚（右奥）を調べる' },
    { if: { flag: 'ch2_end', noflag: 'iron_open' }, text: '隠し階段の下、鉄の扉の鍵盤を弾く（ペンダントと楽譜の四音）' },
    { if: { flag: 'ch2_end', noflag: 'got_note' }, text: '記録保管庫の金庫を調べる' },
    { if: { flag: 'ch2_end', noflag: 'p10' }, text: '記録保管庫の机で、母のノートを読む' },
    { if: { flag: 'ch2_end', noflag: 'saw_scratch' }, text: '記録保管庫の床の扉を調べる' },
    { if: { flag: 'ch2_end', noflag: 'fakewall_open' }, text: '記録保管庫の東の壁を調べる' },
    { if: { flag: 'ch2_end', noflag: 'got_tag' }, text: '記録室の奥、研究室の床の灰を調べる' },
    { if: { flag: 'ch2_end', noflag: 'got_record' }, text: '研究室の南、医務室の棚を調べる' },
    { if: { flag: 'ch2_end', noflag: 'p11' }, text: '医務室の診察台で、タグと診療記録を比べる' },
    // ---- 第4章 ----
    { if: { flag: 'ch3_end', noflag: 'p12' }, text: '東館の奥「職員専用」の扉から管理区域へ。監視室で湊と映像を見る' },
    { if: { flag: 'ch3_end', noflag: 'masaka' }, text: '東館の厨房にいる灰原の様子を見る' },
    { if: fn('obj_conf', (S) => F(S, 'ch3_end') && !F(S, 'ch4_end') && CONF.some(([w]) => !F(S, 'conf_' + w) && !F(S, 'dead_' + w))), text: (S) =>
      '食堂で一人ずつ告白を聞く（残り：' + CONF.filter(([w]) => !F(S, 'conf_' + w) && !F(S, 'dead_' + w)).map(([, n]) => n).join('、') + '）' },
    { if: { flag: 'ch3_end', noflag: 'conf_self' }, text: '食堂のテーブルで、自分の番を話す' },
    { if: { flag: 'reina_conf', noflag: 'p13' }, text: '地下の記録室で、書架の取っ手に紫外線を当てる' },
    { if: { flag: 'ch3_end', anyflag: ['mizuki_conf', 'mizuki_notes'], noflag: 'p15' }, text: '図書室で、偽の日記と母のノートを比べる' },
    { if: { flag: 'ch3_end', noflag: ['p14', 'ch4_end'] }, text: '食堂に戻り、図面と映像を並べて考える' },
    { if: { flag: 'ch3_end', noflag: 'ch4_end' }, text: '食堂で皆の様子を確かめる' },
    // ---- 第5章 ----
    { if: { flag: 'ch4_end', noflag: 'trick_broken', anyCond: 'soDone' }, text: '食堂のテーブルで、怜司の死亡偽装の細工を崩す' },
    { if: { flag: 'ch4_end', noflag: 'accused_scene' }, text: '食堂で時系列を組み直す' },
    { if: { flag: 'accused_scene', noflag: 'admin_rights' }, text: '管理区域の監視室で、中央管理盤の権限を奪う' },
    { if: { flag: 'admin_rights', noflag: 'found_maho' }, text: '記録保管庫の西の気密扉（低温書庫）へ' },
    { if: { flag: 'found_maho', noflag: 'ch5_end' }, text: '食堂へ戻る' },
    // ---- 第6章 ----
    { if: { flag: 'ch5_end', noflag: 'got_weight' }, text: '記録保管庫の床の扉から地下通路へ。通路の排水口を調べる' },
    { if: { flag: 'ch5_end', noflag: 'confront' }, text: '地下通路の先、証言の間を抜けて最深部へ' },
    { if: { flag: 'confront', noflag: 'claims_all' }, text: (S) => '怜司と話し、主張を証拠で崩す（' + ['cl1', 'cl2', 'cl3', 'cl4', 'cl5', 'cl6', 'cl7'].filter((k) => F(S, k)).length + ' / 7）' },
    { if: { flag: 'claims_all', noflag: ['refused_proposal', 'accepted_proposal'] }, text: '怜司に、提案への答えを伝える' },
  ];

  /* 美月が第1章で亡くなったとき：手帳のメモで偽の日記を崩せるようにする */
  (function () {
    const L = ELD.ROOMS.m_library.ins.find((i) => i.id === 'lib_diary');
    const a0 = L.acts.find((a) => a.if && a.if.flag === 'mizuki_conf');
    const alt = JSON.parse(JSON.stringify(a0));
    alt.if = { flag: ['mizuki_notes', 'ch3_end'], noflag: ['p15', 'mizuki_conf'] };
    alt.say[0] = '偽の日記と、真帆の研究ノートを並べる。美月の手帳を開く。';
    alt.say[1].choice.opts[0].say = alt.say[1].choice.opts[0].say.map((l) => l.startsWith('美月：') ? '美月の手帳：「この便箋の透かしは2015年発売の紙。2008年にはない」……彼女は、気づいていた。' : l);
    L.acts.splice(L.acts.indexOf(a0) + 1, 0, alt);
  })();
})();
