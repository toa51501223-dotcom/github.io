/* =====================================================================
 * エンディングのデータ（ロジックから分離）
 * ---------------------------------------------------------------------
 * ENDINGS[id]
 *   kind     : NORMAL / BAD / TRUE / SECRET（クリア画面の種類表示）
 *   name     : 正式名称
 *   color    : テーマ色   bgm : 専用BGMの鍵（engine の Audio）   scene : 一枚絵の種類（js/ending.js）
 *   lines    : 結末の文章（{name} は主人公名）。{rec:'…'} は録音の再生演出
 *   message  : クリア画面の専用メッセージ
 *   special  : TRUE / SECRET の特別演出
 * ENDING_ORDER : 判定順（設計書 12章：BAD → SECRET → TRUE → NORMAL）
 * ENDING_RULES : 判定条件。各条件は
 *   label  : 条件の名前（指示書の表現）
 *   design : 本編シナリオでの判定内容（設計書）
 *   cond   : いまの仮の物語での判定（本編の実装時に差し替える）
 *   cond の書式: {flag} {noflag} {items:[入手済み]} {notes:[手帳に記録済み]} {examined}
 *               {victimsMax:n} {victimsAtLeast:n} {trueCleared:true} {all:[…]} {any:[…]}
 * ===================================================================== */
(function () {
  const ELD = (window.ELD = window.ELD || {});

  ELD.ENDINGS = {
    normal: {
      kind: 'NORMAL', name: '偽りの解放', color: '#9fb6cc', bgm: 'end_normal', scene: 'normal',
      lines: [
        '夜が明けきる前に、{name}たちは館を出た。',
        '御影怜司は逮捕された。だが「火災は事故だ。真帆の死には関わっていない」と言い続けている。',
        '決め手になるはずの証拠は、焼けたか、館のどこかに眠ったままだった。',
        '十八年前の事件は、未解決のまま書類棚に戻された。',
        '{name}は、母が亡くなったことだけを確かめ、名前のない墓に花を手向けた。',
        '数週間後。差出人の書かれていない封筒が届く。',
        '中には、一行だけ。',
        '「まだ、すべてが終わったわけではない。」',
      ],
      message: '館には、まだ集めきれていない証拠が残っている。',
      summary: '館からは脱出できた。しかし怜司の罪を証明する証拠は足りず、18年前の事件は未解決のまま残された。数週間後、差出人のない手紙が届く。',
    },
    bad: {
      kind: 'BAD', name: '沈黙の選択', color: '#c0605a', bgm: 'end_bad', scene: 'bad',
      lines: [
        '「署名すれば、全員を帰そう」——灰原の顔をした男は、穏やかにそう言った。',
        '生き残った全員が、「御影怜司は十八年前に死に、如月真帆は失踪した」という声明に名前を書いた。',
        '地下の記録は燃やされ、男は霧の中へ消えた。',
        '{name}たちは、何もなかったように日常へ戻った。',
        '誰も、あの夜のことを口にしない。真実を知りながら、黙っている。',
        '帰りのバスで、{name}は知らないうちに夜想曲を口ずさんでいた。',
        'その六番目の音は、半音下がっていた。',
      ],
      message: '沈黙は、誰のことも守らなかった。',
      summary: 'あなたは怜司の提案を受け入れ、声明に署名した。{all}館を出たが、記録は燃やされ、怜司は姿を消した。真実を知る者たちは、今も沈黙を続けている。',
    },
    true: {
      kind: 'TRUE', name: '最後の鍵', color: '#f2c96a', bgm: 'end_true', scene: 'true', special: true,
      lines: [
        '夜明けの鐘が、十八年ぶりに正しい時刻を告げた。',
        '氷室へ逃げ込んだ怜司を、黒瀬が取り押さえた。',
        'ボイスレコーダーと文鎮が決め手となり、御影怜司は如月真帆殺害の罪で起訴された。',
        'DNAの照合で、灰原が怜司本人であることも確かめられた。',
        '事件は再捜査となり、怜司は十八年分の責任を問われることになった。',
        '{name}は蓮と連名で、あの夜の記録を記事にした。',
        '冬子が一通の手紙を差し出す。「あなたのお母さんから。大人になったら渡してほしいと頼まれていたの」',
        '封を切る。見覚えはないのに、どこか懐かしい字だった。',
        '十八年前の事件は、ここで完全に終わった。',
        '{name}は冬子と並んで、如月真帆の名を刻んだ墓に、母を納めた。',
      ],
      message: '十八年前の夜が、ようやく明けた。',
      summary: '11人の証拠と証言が、御影怜司の罪を証明した。事件は再捜査となり、怜司は責任を問われる。あなたは母の手紙を読み、18年ぶりに母を弔った。',
    },
    secret: {
      kind: 'SECRET', name: 'ELDIA', color: '#c9a6ff', bgm: 'end_secret', scene: 'secret', special: true,
      lines: [
        '事件が終わって、ひと月。{name}は琴音と二人、鐘楼で夜想曲を弾き終えた。',
        '琴音が、ボイスレコーダーの録音一覧に、一つだけ音量の違う短いファイルを見つける。',
        '真帆は、事件の証拠を十一人に分けて預けていた。誰か一人が消されても、真実が消えないように。',
        'LAST KEY——最後の鍵とは、十一人の証拠と証言そのものだった。',
        '冬子は真帆の頼みを受けて、炎の中から幼い{name}を連れ出していた。',
        'あの招待状に宛名を書いて投函したのも、冬子だった。',
        '{name}が生き延びたこと。それが、真帆の最後の願いにつながっていた。',
        '再生ボタンを押す。子守歌のあとに、母の声が続いた。',
        { rec: '「もし、この声を聞いているなら、あなたはもう大丈夫。もう、誰かの嘘に縛られなくていい。」' },
      ],
      message: '最後の鍵は、ずっとあなたの中にあった。',
      summary: '母は真実を11人に託し、自分の死後も消えないようにしていた。最後の鍵とは、その証拠と証言そのものだった。母の最後の声が、あなたを嘘から解き放つ。',
    },
  };

  ELD.ENDING_ORDER = ['bad', 'secret', 'true', 'normal'];
  ELD.ENDING_LIST = ['normal', 'bad', 'true', 'secret']; // END LIST の並び

  // TRUE の条件（指示書の7項目）。SECRET はこれに加えて追加条件を満たす
  // TRUE の条件（統合版12章の8条件）。res はクリア画面「事件の解決状況」に出す項目名
  const TRUE_REQ = [
    { id: 'evidence', label: '重要証拠をすべて集める', design: '11のかけら（各人の物の証拠）がそろっている',
      cond: { items: ['incident_record', 'research_note', 'old_tape', 'blueprint', 'burnt_photo', 'cracked_watch'] } },
    { id: 'identity', res: '怜司の正体', label: '怜司の正体を証明する', design: '第5章でNO.11を1回で告発し、筆跡・空港の写真・DNA照合の3つを提示',
      cond: { flag: 'photo_identified' } },
    { id: 'maho', res: '真帆の殺害', label: '如月真帆の殺害を証明する', design: '低温書庫で真帆を見つけ、ボイスレコーダーを回収する',
      cond: { flag: 'read_emma_letter' } },
    { id: 'trick', res: '火災の経緯', label: '18年前の火災の経緯を証明する', design: '死亡偽装の細工をすべて崩す',
      cond: { flag: 'portrait_complete' } },
    { id: 'timeline', res: '5つの柱と時系列', label: '動機・方法・機会・時系列をつなぐ', design: '5つの柱をすべて立て、第5章の時系列を正しく組む',
      cond: { flag: 'time_matched' } },
    { id: 'victims', label: '犠牲者を一人も出さない', design: '湊・冬子・黒瀬・宗一郎の4人全員を救出',
      cond: { victimsMax: 0 } },
    { id: 'claims', res: '怜司の7つの主張', label: '最終謎解きを成功させる', design: '第6章の怜司の7つの主張をすべて証言つきで崩す',
      cond: { flag: 'refused_proposal' } },
    { id: 'coop', label: '11人の協力関係を保つ', design: '第4章で10人全員が告白し、黒瀬が公の証言を約束し、冬子の信頼度4以上',
      cond: { noflag: 'coop_broken' } },
  ];
  // クリア画面の「証拠の達成状況」で数える証拠（本編では11のかけら）
  ELD.KEY_EVIDENCE = TRUE_REQ[0].cond.items;
  // 生存者一覧に出す人物（本編で11人を実装したら埋める。空なら行を出さない）
  ELD.CAST = [];
  ELD.TRUE_REQ = TRUE_REQ;


  ELD.ENDING_RULES = {
    // どれか一つでも満たせば BAD
    // BAD は「主人公が自分で提案を受け入れ、確認にも『はい』と答えた」ときだけ（統合版 決定C）。
    // 犠牲者の数・告発の誤り・時系列の誤りは BAD に直結させない（TRUE 不可や最終選択の難しさに移した）
    bad: { any: [
      { id: 'accept', label: '怜司の提案を受け入れる', design: '第6章の最終選択で「受け入れる」を選び、確認でも「はい」と答える', cond: { flag: 'accepted_proposal' } },
    ] },
    // TRUE クリア済みの周回で、TRUE の条件＋3つの追加条件
    // SECRET = TRUE の条件すべて ＋ マスターの6条件（TRUE を一度達成した周回でのみ判定）
    secret: { all: [
      { id: 'cleared', label: 'TRUE ENDを一度達成している', design: '周回をまたぐ記録（eldia_records）', cond: { trueCleared: true } },
    ].concat(TRUE_REQ, [
      { id: 'deep', label: '隠された記録を発見している', design: '低温書庫の奥で、真帆が残した研究の告発文を見つける',
        cond: { examined: 'tr_box' } },
      { id: 'records', label: '11人それぞれの秘密に関係する情報', design: '11人全員の「隠していた記録」を手帳に集める（怜司の分は2012年のカードの下書き）',
        cond: { notes: ['t_ledger', 't_servant_diary', 't_servant_memo', 't_lord_diary', 't_staff_letter'] } },
      { id: 'invitation', label: '冬子が招待状を送った理由を解明', design: '手書きの宛名・消印・事務室の未発送の控えを組み合わせ、冬子に確かめる',
        cond: { examined: 'g1_desk' } },
      { id: 'diary', label: '真帆が残した追加記録', design: '日記の切り取られた頁と、レコーダーの暗号化ファイル（ペンダントで開く）',
        cond: { examined: 'item:research_note:ink' } },
      { id: 'lastkey', label: 'LAST KEYの本当の意味を理解', design: '最終の問い「最後の鍵とは何か」に「11人の証拠と証言そのもの」と答える',
        cond: { flag: 'lastkey_understood' } },
    ]) },
    true: { all: TRUE_REQ },
    normal: { all: [] }, // BAD ではなく、TRUE の条件を一つ以上欠く
  };

  // 全エンディング達成
  ELD.ENDING_COMPLETE = {
    title: 'ALL ENDINGS COMPLETE',
    message: '偽りも、沈黙も、真実も、その先も。あなたはエルディア館のすべての夜明けを見届けた。',
  };
})();
