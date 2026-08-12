/* ResumeAuto 简历编辑器 v2 —— 结构化表单 + 实时预览 + 多模板 + ATS 评分 + 多份简历
   纯前端，数据仅存浏览器 localStorage，不上传任何服务器。 */
(function () {
  'use strict';

  var KEY = 'resumeauto.v2';

  /* ---------- 字段 schema ---------- */
  var SCHEMA = {
    experience: { label: '工作经历', fields: [
      { k: 'role', label: '职位', type: 'text', ex: '光伏电站运维工程师' },
      { k: 'company', label: '公司 / 单位', type: 'text', ex: '某某新能源科技有限公司' },
      { k: 'period', label: '时间', type: 'text', ex: '2023.07 - 至今' },
      { k: 'bullets', label: '职责 / 业绩（每行一条，动词+数据）', type: 'lines', ex: '负责 50MW 光伏电站日常巡检与故障排查，年发电效率提升 8%' }
    ] },
    education: { label: '教育背景', fields: [
      { k: 'school', label: '学校', type: 'text', ex: '某某大学' },
      { k: 'degree', label: '学历 / 专业', type: 'text', ex: '本科 · 电气工程及其自动化' },
      { k: 'period', label: '时间', type: 'text', ex: '2019.09 - 2023.06' },
      { k: 'note', label: '备注（GPA / 荣誉，可选）', type: 'lines', ex: 'GPA 3.6/4.0，校级一等奖学金' }
    ] },
    projects: { label: '项目经历', fields: [
      { k: 'name', label: '项目名称', type: 'text', ex: '某园区分布式光伏并网项目' },
      { k: 'role', label: '角色', type: 'text', ex: '项目助理 / 电气调试' },
      { k: 'period', label: '时间', type: 'text', ex: '2024.03 - 2024.09' },
      { k: 'bullets', label: '项目描述 / 成果（每行一条）', type: 'lines', ex: '参与 2MW 屋顶光伏系统电气设计，协助完成并网验收' }
    ] },
    skills: { label: '技能特长', fields: [
      { k: 'category', label: '分类', type: 'text', ex: '专业技能' },
      { k: 'items', label: '内容（逗号或换行分隔）', type: 'text', ex: '光伏系统运维, 电气接线, AutoCAD, 并网调试' }
    ] },
    certificates: { label: '证书 / 资质', fields: [
      { k: 'name', label: '证书名称', type: 'text', ex: '高压电工证' },
      { k: 'issuer', label: '颁发机构', type: 'text', ex: '应急管理部' },
      { k: 'date', label: '获取时间', type: 'text', ex: '2023.05' }
    ] },
    custom: { label: '自定义模块', fields: [
      { k: 'heading', label: '小标题', type: 'text', ex: '自我评价' },
      { k: 'body', label: '内容（每行一条）', type: 'lines', ex: '踏实肯干，熟悉新能源场站运维流程与安全生产规范' }
    ] }
  };

  var BASICS = [
    { k: 'name', label: '姓名', type: 'text' },
    { k: 'title', label: '求职方向', type: 'text', ex: '新能源 · 光伏/风电运维' },
    { k: 'phone', label: '电话', type: 'text' },
    { k: 'email', label: '邮箱', type: 'text' },
    { k: 'birthday', label: '出生年月', type: 'text', ex: '2002.11' },
    { k: 'location', label: '所在城市', type: 'text', ex: '江苏 · 盐城' },
    { k: 'links', label: '其他（官网/领英/GitHub 等）', type: 'text' },
    { k: 'summary', label: '自我评价 / 摘要', type: 'lines', ex: '电气工程背景，熟悉光伏电站运维与并网流程，具备现场故障排查与数据分析能力。' }
  ];

  /* ---------- 工具 ---------- */
  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function emptyItem(type) {
    var it = {}; SCHEMA[type].fields.forEach(function (f) { it[f.k] = (f.type === 'lines') ? [] : ''; }); return it;
  }
  function defaultDesign() {
    return { font: '', lh: 1.55, base: 14, sec: 14, gap: 16, margin: 32, para: 2, modes: { icon: false, subCenter: false, longTitle: false } };
  }
  function DEFAULT_STATE() {
    return {
      meta: { template: 'magic', accent: '#E1251B', design: defaultDesign() },
      basics: { name: '', title: '', phone: '', email: '', birthday: '', location: '', links: '', summary: '' },
      sections: [
        { type: 'experience', title: '', items: [emptyItem('experience')] },
        { type: 'education', title: '', items: [emptyItem('education')] },
        { type: 'skills', title: '', items: [emptyItem('skills')] },
        { type: 'projects', title: '', items: [] },
        { type: 'certificates', title: '', items: [] }
      ]
    };
  }
  function defaultData() {
    return { current: '默认简历', resumes: { '默认简历': DEFAULT_STATE() } };
  }

  /* ---------- 存储 ---------- */
  var data, state;
  function load() {
    try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { data = null; }
    if (!data || !data.resumes || !data.current) data = defaultData();
    if (!data.resumes[data.current]) data.current = Object.keys(data.resumes)[0];
    state = data.resumes[data.current];
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { flash('保存失败：' + e); }
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- 渲染：基本信息 ---------- */
  function renderBasics() {
    var html = '<h2>基本信息</h2>';
    BASICS.forEach(function (f) {
      html += '<div class="field"><label>' + f.label + '</label>';
      if (f.type === 'lines')
        html += '<textarea data-bind="' + f.k + '" rows="3" placeholder="' + esc(f.ex || '') + '">' + esc(state.basics[f.k] || '') + '</textarea>';
      else
        html += '<input data-bind="' + f.k + '" value="' + esc(state.basics[f.k] || '') + '" placeholder="' + esc(f.ex || '') + '" />';
      html += '</div>';
    });
    document.getElementById('basicsForm').innerHTML = html;
  }

  /* ---------- 渲染：模块 ---------- */
  function renderSections() {
    var html = '';
    state.sections.forEach(function (sec, si) {
      var sch = SCHEMA[sec.type];
      var hidden = sec.hidden ? ' hidden' : '';
      html += '<div class="sec' + hidden + '" data-sec="' + si + '">';
      html += '<div class="sec-head"><span class="drag-handle" title="按住拖拽排序">⠿</span><span class="sec-title">' + esc(sec.title || sch.label) + '</span>'
        + '<button class="mini" data-act="up" title="上移">↑</button>'
        + '<button class="mini" data-act="down" title="下移">↓</button>'
        + '<button class="mini" data-act="hide" title="隐藏/显示">' + (sec.hidden ? '显示' : '隐藏') + '</button>'
        + '<button class="mini danger" data-act="del" title="删除模块">✕</button></div>';
      html += '<div class="sec-body">';
      sec.items.forEach(function (it, ij) {
        html += '<div class="item" data-item="' + ij + '"><div class="item-head"><span>#' + (ij + 1) + '</span>'
          + '<span><button class="mini" data-act="upitem">↑</button><button class="mini" data-act="downitem">↓</button>'
          + '<button class="mini danger" data-act="delitem">✕</button></span></div>';
        sch.fields.forEach(function (f) {
          var val = it[f.k];
          html += '<div class="field"><label>' + f.label + '</label>';
          if (f.type === 'lines')
            html += '<textarea data-field="' + f.k + '" data-type="lines" rows="3" placeholder="' + esc(f.ex || '') + '">' + esc(Array.isArray(val) ? val.join('\n') : (val || '')) + '</textarea>';
          else
            html += '<input data-field="' + f.k + '" data-type="' + f.type + '" value="' + esc(val || '') + '" placeholder="' + esc(f.ex || '') + '" />';
          html += '</div>';
        });
        html += '<span class="example-link" data-act="example">填入示例</span></div>';
      });
      html += '<button class="mini" data-act="additem">＋ 添加一条</button></div></div>';
    });
    document.getElementById('sections').innerHTML = html;
  }

  function renderForm() { renderBasics(); renderSections(); }

  /* ---------- 渲染：预览 ---------- */
  function secTitle(sec) {
    if (sec.type === 'custom') return (sec.items[0] && sec.items[0].heading) || '自定义模块';
    return sec.title || SCHEMA[sec.type].label;
  }
  function renderSectionHtml(sec) {
    var title = secTitle(sec), body = '';
    if (sec.type === 'skills') {
      sec.items.forEach(function (it) {
        var tags = (it.items || '').split(/[,，\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
        if (tags.length) body += '<div class="pv-skill-cat"><b>' + esc(it.category || '技能') + '</b></div>'
          + '<div class="pv-skill-tags">' + tags.map(function (t) { return '<span class="pv-tag">' + esc(t) + '</span>'; }).join('') + '</div>';
      });
    } else if (sec.type === 'custom') {
      sec.items.forEach(function (it) {
        var lines = (it.body || []).filter(Boolean);
        if (lines.length) body += '<ul class="pv-bullets">' + lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>';
      });
    } else if (sec.type === 'certificates') {
      sec.items.forEach(function (it) {
        var head = [it.name, it.issuer].filter(Boolean).join(' · ');
        body += '<div class="pv-item"><div class="pv-item-head"><span class="pv-item-title">' + esc(head)
          + '</span>' + (it.date ? '<span class="pv-period">' + esc(it.date) + '</span>' : '') + '</div></div>';
      });
    } else {
      sec.items.forEach(function (it) {
        var title = it.role || it.name || it.school || '';
        var sub = [sec.type === 'education' ? it.degree : (it.company || it.role), it.location].filter(Boolean).join(' · ');
        var bullets = (it.bullets || []).filter(Boolean);
        body += '<div class="pv-item"><div class="pv-item-head"><span class="pv-item-title">' + esc(title) + '</span>'
          + (it.period ? '<span class="pv-period">' + esc(it.period) + '</span>' : '') + '</div>'
          + (sub ? '<div class="pv-item-sub">' + esc(sub) + '</div>' : '')
          + (bullets.length ? '<ul class="pv-bullets">' + bullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
      });
    }
    return '<div class="pv-section"><div class="pv-sec-title">' + esc(title) + '</div>' + body + '</div>';
  }
  function renderPreview() {
    var b = state.basics;
    var contact = [];
    if (b.phone) contact.push(esc(b.phone));
    if (b.email) contact.push(esc(b.email));
    if (b.location) contact.push(esc(b.location));
    if (b.links) contact.push(esc(b.links));
    var contactHtml = contact.length ? '<div class="pv-contact">' + contact.map(function (c) { return '<span>' + c + '</span>'; }).join('') + '</div>' : '';
    var asideTypes = { skills: 1, certificates: 1 };
    var single = (state.meta.template === 'classic' || state.meta.template === 'cn' || state.meta.template === 'cover' || state.meta.template === 'standard' || state.meta.template === 'magic');
    var aside = '', main = '';
    if (b.summary) main += '<div class="pv-summary">' + esc(b.summary) + '</div>';
    state.sections.forEach(function (sec) {
      if (sec.hidden) return;
      var h = renderSectionHtml(sec);
      if (!single && asideTypes[sec.type]) aside += h; else main += h;
    });
    var head = '<h1 class="pv-name">' + esc(b.name || '你的名字') + '</h1>'
      + (b.title ? '<div class="pv-ptitle">' + esc(b.title) + '</div>' : '');
    var inner;
    if (state.meta.template === 'cover') inner = '<div class="pv-cover-head">' + head + contactHtml + '</div><div class="pv-cover-body">' + main + '</div>';
    else if (single) inner = head + contactHtml + main;
    else inner = head + '<div class="pv-grid"><div class="pv-aside">' + contactHtml + aside + '</div><div class="pv-main">' + main + '</div></div>';
    var pv = document.getElementById('preview');
    pv.className = 'resume-preview t-' + state.meta.template;
    applyDesignVars(pv);
    pv.innerHTML = inner;
    renderAtsBadge();
  }

  /* ---------- ATS / JD ---------- */
  function resumeText() {
    var t = (state.basics.name || '') + ' ' + (state.basics.title || '') + ' ' + (state.basics.summary || '') + ' ';
    state.sections.forEach(function (s) {
      if (s.hidden) return;
      s.items.forEach(function (it) { for (var k in it) { var v = it[k]; t += (Array.isArray(v) ? v.join(' ') : (v || '')) + ' '; } });
    });
    return t;
  }
  function parseJD(jd) {
    var dict = ['光伏', '风电', '风能', '新能源', '储能', '电池', 'bms', '电气', 'cad', 'autocad', '并网', '逆变', '运维', '电网', '充电桩', '氢能', '锂电', '系统集成', 'plc', 'scada', 'python', 'sql', '数据分析', '项目管理', '安全规范', '调度', '继电保护'];
    var low = (jd || '').toLowerCase(), found = [];
    dict.forEach(function (k) { if (low.indexOf(k.toLowerCase()) >= 0) found.push(k); });
    return found;
  }
  function computeAts() {
    var jd = document.getElementById('jdInput').value || '';
    if (!jd.trim()) return null;
    var text = resumeText().toLowerCase();
    var kws = parseJD(jd);
    var matched = kws.filter(function (k) { return text.indexOf(k.toLowerCase()) >= 0; });
    var missing = kws.filter(function (k) { return text.indexOf(k.toLowerCase()) < 0; });
    var kwScore = kws.length ? Math.round(matched.length / kws.length * 100) : 100;
    var sp = 0;
    if (state.basics.summary) sp += 20;
    if (state.sections.some(function (s) { return s.type === 'experience' && s.items.length; })) sp += 25;
    if (state.sections.some(function (s) { return s.type === 'skills'; })) sp += 20;
    if (state.sections.some(function (s) { return s.type === 'education'; })) sp += 15;
    if (state.basics.phone && state.basics.email) sp += 20;
    var tplBonus = (state.meta.template === 'classic' || state.meta.template === 'cn' || state.meta.template === 'cover' || state.meta.template === 'standard' || state.meta.template === 'magic') ? 5 : 0;
    var score = Math.max(0, Math.min(100, Math.round(kwScore * 0.5 + sp * 0.5) + tplBonus));
    return { score: score, matched: matched, missing: missing, kwScore: kwScore };
  }
  function renderAtsBadge() {
    var a = computeAts(), badge = document.getElementById('atsBadge');
    if (!a) { badge.textContent = '匹配度 —'; badge.style.background = '#0f172a'; return; }
    badge.textContent = '匹配度 ' + a.score;
    badge.style.background = a.score >= 80 ? '#16a34a' : (a.score >= 60 ? '#d97706' : '#dc2626');
  }
  function renderJd() {
    var a = computeAts(), box = document.getElementById('jdResult');
    if (!a) { box.innerHTML = ''; return; }
    var html = '<div class="ats-score">岗位匹配度 <b>' + a.score + '</b>（关键词命中 ' + a.kwScore + '%）</div>'
      + '<div class="ats-bar"><i style="width:' + a.score + '%"></i></div>';
    html += '<div class="kw-list">已具备：' + (a.matched.length ? a.matched.map(function (k) { return '<span class="tag">' + k + '</span>'; }).join('') : '（暂无）') + '</div>';
    html += '<div class="kw-list" style="margin-top:6px">建议补充：' + (a.missing.length ? a.missing.map(function (k) { return '<span class="tag miss">' + k + '</span>'; }).join('') : '✅ 已覆盖主要关键词') + '</div>';
    box.innerHTML = html;
  }

  /* ---------- 求职信 / 差距分析 ---------- */
  function extractPosition(jd) {
    var m = (jd || '').match(/(?:招聘|诚聘|招募|招)\s*([一-龥A-Za-z]{2,12}?)(工程师|专员|经理|主管|助理|技术员|运维|分析师|设计师|顾问)/);
    if (m) return m[1] + m[2];
    var m2 = (jd || '').match(/([一-龥A-Za-z]{2,12}?(?:工程师|专员|经理|主管|运维|分析师))/);
    return m2 ? m2[1] : null;
  }
  function generateCoverLetter() {
    var jd = document.getElementById('jdInput').value || '', b = state.basics;
    var pos = extractPosition(jd) || b.title || '贵公司相关岗位';
    var skills = [];
    state.sections.forEach(function (s) { if (s.type === 'skills') s.items.forEach(function (it) { (it.items || '').split(/[,，\n]/).forEach(function (x) { var t = x.trim(); if (t) skills.push(t); }); }); });
    var skillLine = skills.slice(0, 6).join('、');
    var ta = document.getElementById('coverOut');
    ta.value = '尊敬的人事经理：\n\n您好！我叫' + (b.name || '___') + '，应聘「' + pos + '」一职。\n\n'
      + '我具备' + (skillLine || '相关专业') + '等能力，' + (b.summary ? b.summary : '对该岗位有浓厚兴趣并具备相应的实践基础') + '。\n'
      + '如有机会加入，我将以扎实的专业能力与踏实的态度，为团队创造价值。期待您的回复！\n\n此致\n敬礼\n' + (b.name || '') + '\n' + (b.phone || '');
    document.getElementById('copyCover').hidden = false;
    flash('已生成求职信，可手动修改后复制');
  }
  function skillGapAnalysis() {
    var a = computeAts(), box = document.getElementById('gapResult');
    if (!a) { box.innerHTML = '<p class="hint">请先在上方粘贴岗位 JD。</p>'; return; }
    var html = '<div class="ats-score">匹配度 <b>' + a.score + '</b></div><div class="ats-bar"><i style="width:' + a.score + '%"></i></div>'
      + '<div class="kw-list">已具备关键词：' + (a.matched.length ? a.matched.map(function (k) { return '<span class="tag">' + k + '</span>'; }).join('') : '（暂无）') + '</div>'
      + '<div class="kw-list" style="margin-top:6px">待补足关键词：' + (a.missing.length ? a.missing.map(function (k) { return '<span class="tag miss">' + k + '</span>'; }).join('') : '✅ 已覆盖主要关键词') + '</div>';
    box.innerHTML = html;
  }

  /* ---------- 文本解析（.docx / .pdf 共用）---------- */
  var SURNAMES = '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳酆鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍万柯卢莫房缪干解应宗丁宣邓郁单杭洪包诸左石崔吉钮龚程嵇邢滑裴陆荣翁荀羊於惠甄麴家封芮羿储靳汲邴糜松井段富巫乌焦巴弓牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾暴甘钭厉戎祖武符刘景詹束龙叶幸司韶郜黎蓟薄印宿白怀蒲邰从鄂索咸籍赖卓蔺屠蒙池乔阴郁胥能苍双闻莘党翟谭贡劳逄姬申扶堵冉宰郦雍舄璩桑桂濮牛寿通边扈燕冀郏浦尚农温别庄晏柴瞿阎充慕连茹习宦艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡国文寇广禄阙东欧殳沃利蔚越夔隆师巩厍聂晁勾敖融冷訾辛阚那简饶空曾毋沙乜养鞠须丰巢关蒯相查后荆红游竺权逯盖益桓公';
  function isChineseName(s) {
    if (!/[\u4e00-\u9fa5]{2,4}/.test(s) || s.length < 2 || s.length > 4) return false;
    if (!/[\u4e00-\u9fa5]/.test(s)) return false;
    return SURNAMES.indexOf(s.charAt(0)) !== -1;
  }
  function isContactLine(l) {
    return /^(生日|出生|出生年月|地址|所在地|城市|电话|手机|邮箱|邮件|Email|E-mail|联系|基本信息|联系方式)[:：\s]/.test(l);
  }
  function parseDocxToState(text) {
    text = text.replace(/\r/g, '');
    var lines = text.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l.length; });
    var st = DEFAULT_STATE();

    // 姓名：在所有行里找第一个像中文名的短词
    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i].replace(/\s+/g, '');
      if (isChineseName(raw)) { st.basics.name = raw; break; }
    }
    // 电话 / 邮箱 / 生日 / 地址：支持“电话：138...”或裸号
    lines.forEach(function (l) {
      var p = l.match(/(?:电话|手机|Tel|Phone)[:：\s]*(1[3-9]\d{9})/i) || l.match(/(1[3-9]\d{9})/);
      if (p) st.basics.phone = p[1];
      var e = l.match(/(?:邮箱|邮件|Email|E-mail)[:：\s]*([\w.\-]+@[\w.\-]+)/i) || l.match(/([\w.\-]+@[\w.\-]+)/);
      if (e) st.basics.email = e[1];
      var b = l.match(/(?:生日|出生|出生年月)[:：\s]*(\d{4}[.\-/]\d{1,2}(?:[.\-/]\d{1,2})?)/);
      if (b) st.basics.birthday = b[1];
      var loc = l.match(/(?:地址|所在地|城市)[:：\s]*(\S{2,20})/);
      if (loc) st.basics.location = loc[1];
    });

    var map = [
      ['教育', 'education'], ['学校', 'education'], ['学历', 'education'],
      ['工作', 'experience'], ['职业', 'experience'], ['经验', 'experience'], ['实习', 'experience'],
      ['项目', 'projects'],
      ['技能', 'skills'], ['特长', 'skills'], ['优势', 'skills'],
      ['证书', 'certificates'], ['资质', 'certificates'],
      ['校园', 'experience'],
      ['获奖', 'custom'], ['荣誉', 'custom'], ['个人', 'custom'], ['实践', 'custom'], ['志愿', 'custom'], ['自我', 'custom'], ['评价', 'custom']
    ];
    var cur = null, curTitle = '', buf = [], sections = [];
    function flush() {
      if (cur && buf.length) {
        // 过滤掉联系方式行，避免把“电话：xxx”当模块正文
        var body = buf.filter(function (l) { return !isContactLine(l); });
        if (cur === 'skills') sections.push({ type: 'skills', title: curTitle, items: [{ category: curTitle || '技能', items: body.join('，') }] });
        else if (cur === 'certificates') sections.push({ type: 'certificates', title: curTitle, items: body.map(function (l) { return { name: l, issuer: '', date: '' }; }) });
        else if (cur === 'experience') sections.push({ type: 'experience', title: curTitle, items: [{ role: body[0] || '', company: '', period: '', bullets: body.slice(1) }] });
        else if (cur === 'projects') sections.push({ type: 'projects', title: curTitle, items: [{ name: body[0] || '', role: '', period: '', bullets: body.slice(1) }] });
        else if (cur === 'education') sections.push({ type: 'education', title: curTitle, items: [{ school: body[0] || '', degree: body[1] || '', period: '', note: body.slice(2).join(' ') }] });
        else sections.push({ type: 'custom', title: curTitle, items: [{ heading: curTitle || '其他', body: body }] });
      }
      cur = null; curTitle = ''; buf = [];
    }
    lines.forEach(function (l) {
      if (isContactLine(l)) return; // 跳过联系方式行，不进任何模块
      var hit = null, title = '';
      map.forEach(function (p) { if (!hit && new RegExp(p[0]).test(l) && l.length < 20) { hit = p[1]; title = l; } });
      if (hit) { flush(); cur = hit; curTitle = title; }
      else if (cur) buf.push(l);
    });
    flush();

    // 按常规简历顺序重排模块，避免 PDF 流顺序导致版面错乱
    var order = { experience: 1, education: 2, projects: 3, skills: 4, certificates: 5, custom: 6 };
    sections.sort(function (a, b) { return (order[a.type] || 99) - (order[b.type] || 99); });

    if (sections.length) st.sections = sections;
    return st;
  }
  function handleDocx(file) {
    if (!window.mammoth) { alert('解析库未加载，请刷新后重试'); return; }
    var r = new FileReader();
    r.onload = function (e) {
      mammoth.extractRawText({ arrayBuffer: e.target.result }).then(function (res) {
        var st = parseDocxToState(res.value || '');
        mergeImported(st);
      }).catch(function (err) { alert('解析失败：' + (err && err.message ? err.message : err)); });
    };
    r.readAsArrayBuffer(file);
  }

  /* 把 PDF 文本片段按视觉阅读顺序重组成行（pdf.js 返回的是零散文本块，需重建换行） */
  function pdfItemsToText(items) {
    // 先按 y（从上到下）、再按 x（从左到右）排序
    var sorted = (items || []).slice().sort(function (a, b) {
      var ya = (a.transform && a.transform[5]) || 0;
      var yb = (b.transform && b.transform[5]) || 0;
      if (Math.abs(ya - yb) > 2) return yb - ya; // 不同行：y 大的在上
      var xa = (a.transform && a.transform[4]) || 0;
      var xb = (b.transform && b.transform[4]) || 0;
      return xa - xb; // 同一行：从左到右
    });
    // 按 y 相近性合并成行
    var lines = [], curY = null, curLine = [];
    sorted.forEach(function (it) {
      var y = (it.transform && it.transform[5]) || 0;
      if (curY === null || Math.abs(y - curY) > 2) {
        if (curLine.length) lines.push(curLine.join(' '));
        curY = y; curLine = [it.str];
      } else {
        curLine.push(it.str);
      }
    });
    if (curLine.length) lines.push(curLine.join(' '));
    return lines.join('\n');
  }

  /* 把解析结果并入当前简历：仅覆盖非空字段，保留模板/配色/设计等 meta */
  function mergeImported(st) {
    if (st.basics) {
      Object.keys(state.basics).forEach(function (k) {
        if (st.basics[k] != null && String(st.basics[k]).trim() !== '') state.basics[k] = st.basics[k];
      });
    }
    if (st.sections && st.sections.length) state.sections = st.sections;
    save(); renderForm(); renderPreview();
    flash('已导入并解析简历，可继续编辑');
  }

  /* ---------- .pdf 导入 ---------- */
  function handlePdf(file) {
    if (!window.pdfjsLib) { alert('PDF 解析库未加载，请刷新后重试'); return; }
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    var r = new FileReader();
    r.onload = function (e) {
      pdfjsLib.getDocument({ data: e.target.result }).promise.then(function (pdf) {
        var texts = [];
        function next(i) {
          if (i > pdf.numPages) {
            var st = parseDocxToState(texts.join('\n'));
            mergeImported(st);
            return;
          }
          pdf.getPage(i).then(function (page) {
            page.getTextContent().then(function (tc) {
              texts.push(pdfItemsToText(tc.items));
              next(i + 1);
            }).catch(function (err) { alert('PDF 解析失败：' + (err && err.message ? err.message : err)); });
          }).catch(function (err) { alert('PDF 解析失败：' + (err && err.message ? err.message : err)); });
        }
        next(1);
      }).catch(function (err) { alert('无法读取 PDF：' + (err && err.message ? err.message : err)); });
    };
    r.readAsArrayBuffer(file);
  }

  /* ---------- AI 润色（用户自己的 Key，直连厂商）---------- */
  var AIKEY = 'resumeauto.ai';
  function loadAI() { try { return JSON.parse(localStorage.getItem(AIKEY) || '{}'); } catch (e) { return {}; } }
  function saveAI(o) { try { localStorage.setItem(AIKEY, JSON.stringify(o)); } catch (e) { flash('AI 设置保存失败：' + e); } }
  function parseJsonSafe(s) {
    try { return JSON.parse(s); } catch (e) {}
    var m = s.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
    return null;
  }
  function applyAiResults(json, blocks) {
    if (!json || !Array.isArray(json.results)) { flash('模型返回格式异常，未应用'); return; }
    var map = {}; json.results.forEach(function (r) { if (r && r.id != null) map[r.id] = r; });
    var n = 0;
    blocks.forEach(function (b) {
      var res = map[b.id]; if (!res || !res.text) return;
      var lines = res.text.split('\n').map(function (x) { return x.replace(/^\s*[-•·]\s*/, '').trim(); }).filter(Boolean);
      if (!lines.length) return;
      if (b.id === 'summary') state.basics.summary = lines.join('\n');
      else {
        var p = b.id.split(':'), si = +p[1], ij = +p[2];
        if (state.sections[si] && state.sections[si].items[ij]) {
          if (p[0] === 'b') state.sections[si].items[ij].bullets = lines.slice();
          else if (p[0] === 'c') state.sections[si].items[ij].body = lines.slice();
        }
      }
      n++;
    });
    flash('已按 JD 润色 ' + n + ' 处，请检查并补全 [数字] 占位');
  }
  function aiPolish() {
    var cfg = loadAI();
    if (!cfg.key) { document.getElementById('aiSettings').hidden = false; flash('请先填写 API Key'); return; }
    var jd = document.getElementById('jdInput').value || '';
    if (!jd.trim()) { flash('请先在 JD 匹配卡片粘贴岗位 JD'); return; }
    var blocks = [];
    if (state.basics.summary) blocks.push({ id: 'summary', text: state.basics.summary });
    state.sections.forEach(function (sec, si) {
      if (sec.hidden) return;
      if (sec.type === 'experience' || sec.type === 'projects')
        sec.items.forEach(function (it, ij) { var ls = (it.bullets || []).filter(Boolean); if (ls.length) blocks.push({ id: 'b:' + si + ':' + ij, text: ls.join('\n') }); });
      else if (sec.type === 'custom')
        sec.items.forEach(function (it, ij) { var ls = (it.body || []).filter(Boolean); if (ls.length) blocks.push({ id: 'c:' + si + ':' + ij, text: ls.join('\n') }); });
    });
    if (!blocks.length) { flash('当前没有可润色的条目（先填些职责/业绩）'); return; }
    var btn = document.getElementById('aiPolish'), st = document.getElementById('aiStatus');
    btn.disabled = true; st.textContent = '润色中（浏览器直连你的模型）…';
    var blockTxt = blocks.map(function (b) { return '[' + b.id + ']\n' + b.text; }).join('\n\n');
    var prompt = '你是一名资深简历优化顾问。下面是候选人的若干简历文本片段与目标岗位 JD。\n'
      + '请逐条专业润色：用强动词开头、突出量化成果（用 [数字] 占位让候选人自行填写）、保持中文、忠于原文事实、不要编造新经历。\n'
      + '严格只返回一个 JSON 对象：{"results":[{"id":"原id","text":"润色后文本（保留原换行结构）"}]}，每个输入 id 必须对应一个结果。\n\n'
      + '【岗位 JD】\n' + jd + '\n\n【待润色片段】\n' + blockTxt;
    var url = (cfg.base || 'https://api.openai.com/v1').replace(/\/+$/, '') + '/chat/completions';
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      body: JSON.stringify({
        model: cfg.model || 'gpt-4o-mini', temperature: 0.3,
        messages: [
          { role: 'system', content: 'You are a precise resume editor. Output only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 200)); }); return r.json(); })
      .then(function (d) {
        var content = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
        if (!content) throw new Error('模型返回为空');
        applyAiResults(parseJsonSafe(content), blocks);
        btn.disabled = false; st.textContent = '✅ 已润色 ' + blocks.length + ' 处';
        save(); renderForm(); renderPreview();
      }).catch(function (err) {
        btn.disabled = false; st.textContent = '';
        alert('AI 润色失败：' + err.message + '\n（请检查 API 设置 / 网络 / 额度；请求由你的浏览器直连模型厂商，不经过任何中转服务器）');
      });
  }

  /* ---------- 多份简历管理 ---------- */
  function renderResumeSelector() {
    var sel = document.getElementById('resumeSel');
    sel.innerHTML = '';
    Object.keys(data.resumes).forEach(function (name) {
      var o = document.createElement('option'); o.value = name; o.textContent = name; sel.appendChild(o);
    });
    sel.value = data.current;
  }
  function switchResume(name) { if (data.resumes[name]) { data.current = name; state = data.resumes[name]; save(); renderAll(); } }

  /* ---------- 导出 ---------- */
  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function exportJson() { download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), (state.basics.name || 'resume') + '.json'); }
  function exportMd() {
    var b = state.basics, md = '# ' + (b.name || '简历') + '\n';
    if (b.title) md += '**' + b.title + '**\n';
    var c = [b.phone, b.email, b.location, b.links].filter(Boolean).join(' | ');
    if (c) md += '\n' + c + '\n';
    if (b.summary) md += '\n## 自我评价\n' + b.summary + '\n';
    state.sections.forEach(function (s) {
      if (s.hidden || !s.items.length) return;
      md += '\n## ' + secTitle(s) + '\n';
      if (s.type === 'skills') s.items.forEach(function (it) { md += '- **' + (it.category || '技能') + '**：' + it.items + '\n'; });
      else if (s.type === 'certificates') s.items.forEach(function (it) { md += '- ' + [it.name, it.issuer, it.date].filter(Boolean).join(' · ') + '\n'; });
      else if (s.type === 'custom') s.items.forEach(function (it) { (it.body || []).forEach(function (l) { md += '- ' + l + '\n'; }); });
      else s.items.forEach(function (it) {
        var head = it.role || it.name || it.school || '';
        md += '- **' + head + '**' + (it.company || it.school ? ' · ' + (it.company || it.school) : '') + (it.period ? '（' + it.period + '）' : '') + '\n';
        (it.bullets || []).forEach(function (bl) { md += '  - ' + bl + '\n'; });
      });
    });
    download(new Blob([md], { type: 'text/markdown;charset=utf-8' }), (b.name || 'resume') + '.md');
  }

  /* ---------- toast ---------- */
  function flash(msg) {
    var t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(t._t); t._t = setTimeout(function () { t.style.opacity = '0'; }, 1700);
  }

  /* ---------- 事件 ---------- */
  var pvT, svT, jdT;
  function schedulePreview() { clearTimeout(pvT); pvT = setTimeout(renderPreview, 120); }
  function scheduleSave() { clearTimeout(svT); svT = setTimeout(save, 500); }
  function scheduleJd() { clearTimeout(jdT); jdT = setTimeout(function () { renderJd(); renderAtsBadge(); }, 250); }

  function onInput(e) {
    var t = e.target;
    if (t.dataset.bind) { state.basics[t.dataset.bind] = t.value; schedulePreview(); scheduleSave(); return; }
    if (t.dataset.field) {
      var secEl = t.closest('.sec'), itemEl = t.closest('.item');
      if (secEl && itemEl) {
        var si = +secEl.dataset.sec, ij = +itemEl.dataset.item, f = t.dataset.field;
        state.sections[si].items[ij][f] = (t.dataset.type === 'lines') ? t.value.split('\n') : t.value;
        schedulePreview(); scheduleSave();
      }
    }
  }
  function onClick(e) {
    var btn = e.target.closest('[data-act]'); if (!btn) return;
    var act = btn.dataset.act;
    var secEl = btn.closest('.sec'), itemEl = btn.closest('.item');
    var si = secEl ? +secEl.dataset.sec : -1, ij = itemEl ? +itemEl.dataset.item : -1;
    if (act === 'up') swapSection(si, -1);
    else if (act === 'down') swapSection(si, 1);
    else if (act === 'hide') state.sections[si].hidden = !state.sections[si].hidden;
    else if (act === 'del') state.sections.splice(si, 1);
    else if (act === 'additem') state.sections[si].items.push(emptyItem(state.sections[si].type));
    else if (act === 'upitem') swapItem(si, ij, -1);
    else if (act === 'downitem') swapItem(si, ij, 1);
    else if (act === 'delitem') state.sections[si].items.splice(ij, 1);
    else if (act === 'example') {
      SCHEMA[state.sections[si].type].fields.forEach(function (f) {
        state.sections[si].items[ij][f.k] = (f.type === 'lines') ? (f.ex || '').split('\n') : (f.ex || '');
      });
    }
    save(); renderForm(); renderPreview();
  }
  function swapSection(i, dir) { var j = i + dir; if (j < 0 || j >= state.sections.length) return; var t = state.sections[i]; state.sections[i] = state.sections[j]; state.sections[j] = t; }
  function swapItem(si, ij, dir) { var arr = state.sections[si].items, j = ij + dir; if (j < 0 || j >= arr.length) return; var t = arr[ij]; arr[ij] = arr[j]; arr[j] = t; }

  function renderAll() {
    document.getElementById('tplSel').value = state.meta.template;
    document.getElementById('accent').value = state.meta.accent || '#E1251B';
    renderResumeSelector(); renderForm(); renderPreview(); renderJd();
    renderTemplateGallery(); renderDesign();
  }

  /* ---------- 模板画廊 + 设计 ---------- */
  var BUILTIN = [
    { tpl: 'magic', name: 'Magic Resume 风', desc: '清爽卡片 · 姓名强调色 · 竖条标题' },
    { tpl: 'standard', name: '统一标准模板', desc: '京东红 · 色条标题 · 结构统一' },
    { tpl: 'classic', name: '经典单栏', desc: 'ATS 友好 · 简洁单栏' },
    { tpl: 'cn', name: '清爽中文单栏', desc: '左侧色条标题 · 留白舒适' },
    { tpl: 'sidebar', name: '双栏侧边', desc: '左栏信息 · 右栏正文' },
    { tpl: 'energy', name: '新能源商务', desc: '强调色侧边 · 专业大气' },
    { tpl: 'cover', name: '封面头图风', desc: '彩色头图 · 个性封面' },
    { tpl: 'table', name: '表格简历风', desc: '表格化排版 · 条理清晰' }
  ];
  var SAMPLE = {
    basics: { name: '宋创创', title: '京东物流 · 运营管培生', phone: '138-0000-0000', email: 'sc@example.com', location: '河南 · 郑州', summary: '能源与动力工程背景，具备 4S 店销售与新媒体运营实习经验，执行力强、善于沟通。' },
    sections: [
      { type: 'education', title: '教育背景', items: [{ school: '黄河交通学院', degree: '能源与动力工程 本科', period: '2018 – 2022', location: '河南', bullets: [] }] },
      { type: 'experience', title: '工作经历', items: [{ role: '销售助理', company: '奇瑞汽车 4S 店', period: '2021 – 2022', location: '郑州', bullets: ['负责客户接待与需求分析', '协助完成月度销售目标'] }] },
      { type: 'skills', title: '技能专长', items: [{ category: '专业技能', items: '销售沟通，新媒体运营，客户服务' }, { category: '工具', items: 'Excel，PPT，剪映' }] }
    ]
  };
  function sampleSecHTML(sec) {
    var title = sec.title || '', body = '';
    if (sec.type === 'skills') {
      sec.items.forEach(function (it) {
        var tags = (it.items || '').split(/[,，\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
        if (tags.length) body += '<div class="pv-skill-cat"><b>' + esc(it.category || '技能') + '</b></div><div class="pv-skill-tags">' + tags.map(function (t) { return '<span class="pv-tag">' + esc(t) + '</span>'; }).join('') + '</div>';
      });
    } else {
      sec.items.forEach(function (it) {
        var t = it.role || it.school || '';
        var sub = [sec.type === 'education' ? it.degree : (it.company || it.role), it.location].filter(Boolean).join(' · ');
        var bl = (it.bullets || []).filter(Boolean);
        body += '<div class="pv-item"><div class="pv-item-head"><span class="pv-item-title">' + esc(t) + '</span>' + (it.period ? '<span class="pv-period">' + esc(it.period) + '</span>' : '') + '</div>' + (sub ? '<div class="pv-item-sub">' + esc(sub) + '</div>' : '') + (bl.length ? '<ul class="pv-bullets">' + bl.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
      });
    }
    return '<div class="pv-section"><div class="pv-sec-title">' + esc(title) + '</div>' + body + '</div>';
  }
  function genPreview(tpl, acc) {
    var b = SAMPLE.basics;
    var contact = []; ['phone', 'email', 'location'].forEach(function (f) { if (b[f]) contact.push(esc(b[f])); });
    var contactHtml = contact.length ? '<div class="pv-contact">' + contact.map(function (c) { return '<span>' + c + '</span>'; }).join('') + '</div>' : '';
    var single = ['classic', 'cn', 'cover', 'standard', 'magic'].indexOf(tpl) >= 0;
    var main = '';
    if (b.summary) main += '<div class="pv-summary">' + esc(b.summary) + '</div>';
    SAMPLE.sections.forEach(function (sec) { if (!single && sec.type === 'skills') return; main += sampleSecHTML(sec); });
    var head = '<h1 class="pv-name">' + esc(b.name) + '</h1>' + (b.title ? '<div class="pv-ptitle">' + esc(b.title) + '</div>' : '');
    var inner = (tpl === 'cover') ? ('<div class="pv-cover-head">' + head + contactHtml + '</div><div class="pv-cover-body">' + main + '</div>')
      : (single ? (head + contactHtml + main) : (head + '<div class="pv-grid"><div class="pv-aside">' + contactHtml + sampleSecHTML(SAMPLE.sections[2]) + '</div><div class="pv-main">' + main + '</div></div>'));
    return '<div class="resume-preview t-' + tpl + '" style="--accent:' + acc + '">' + inner + '</div>';
  }
  function renderTemplateGallery() {
    var grid = document.getElementById('tplGallery'); if (!grid) return;
    grid.innerHTML = '';
    var acc = (state.meta && state.meta.accent) || '#E1251B';
    BUILTIN.forEach(function (t) {
      var card = document.createElement('div');
      card.className = 'tpl-thumb' + (state.meta.template === t.tpl ? ' active' : '');
      card.innerHTML = '<div class="shot"><div class="sheet">' + genPreview(t.tpl, acc) + '</div></div>'
        + '<div class="meta"><div class="nm">' + esc(t.name) + '</div><div class="ds">' + esc(t.desc) + '</div></div>';
      card.onclick = function () { setTemplate(t.tpl); };
      grid.appendChild(card);
    });
  }
  function setTemplate(tpl) {
    state.meta.template = tpl;
    var sel = document.getElementById('tplSel'); if (sel) sel.value = tpl;
    save(); renderTemplateGallery(); renderPreview();
  }
  function applyDesignVars(pv) {
    var d = state.meta.design || defaultDesign();
    pv.style.setProperty('--accent', state.meta.accent || '#E1251B');
    if (d.font) pv.style.setProperty('--rs-font', d.font); else pv.style.removeProperty('--rs-font');
    pv.style.setProperty('--rs-lh', d.lh);
    pv.style.setProperty('--rs-base', d.base + 'px');
    pv.style.setProperty('--rs-sec', d.sec + 'px');
    pv.style.setProperty('--rs-gap', d.gap + 'px');
    pv.style.setProperty('--rs-margin', d.margin + 'px');
    pv.style.setProperty('--rs-para', d.para + 'px');
    pv.classList.toggle('icon-mode', !!d.modes.icon);
    pv.classList.toggle('subtitle-center', !!d.modes.subCenter);
    pv.classList.toggle('long-title', !!d.modes.longTitle);
  }
  var SWATCHES = ['#E1251B', '#f97316', '#16a34a', '#2563eb', '#7c3aed', '#db2777', '#0891b2', '#475569', '#111827'];
  function renderDesign() {
    var d = state.meta.design || defaultDesign();
    var set = function (id, v, valId, unit) {
      var el = document.getElementById(id); if (!el) return;
      el.value = v;
      if (valId) { var vv = document.getElementById(valId); if (vv) vv.textContent = (unit ? v + unit : v); }
    };
    set('rsFont', d.font || '');
    set('rsLh', d.lh, 'rsLhVal'); set('rsBase', d.base, 'rsBaseVal', 'px'); set('rsSec', d.sec, 'rsSecVal', 'px');
    set('rsMargin', d.margin, 'rsMarginVal', 'px'); set('rsGap', d.gap, 'rsGapVal', 'px'); set('rsPara', d.para, 'rsParaVal', 'px');
    var ai = document.getElementById('accent'); if (ai) ai.value = state.meta.accent || '#E1251B';
    var sw = document.getElementById('themeSwatches'); if (sw) {
      sw.innerHTML = '';
      SWATCHES.forEach(function (c) {
        var s = document.createElement('span'); s.className = 'ts' + (state.meta.accent === c ? ' active' : '');
        s.style.background = c; s.title = c;
        s.onclick = function () { setAccent(c); };
        sw.appendChild(s);
      });
    }
    var modeMap = { mIcon: 'icon', mSubCenter: 'subCenter', mLongTitle: 'longTitle' };
    Object.keys(modeMap).forEach(function (id) {
      var el = document.getElementById(id); if (el) el.checked = !!d.modes[modeMap[id]];
    });
  }
  function setAccent(c) {
    state.meta.accent = c;
    var ai = document.getElementById('accent'); if (ai) ai.value = c;
    save(); renderDesign(); renderPreview();
  }

  function init() {
    load();
    if (!state.meta) state.meta = { template: 'magic', accent: '#E1251B', design: defaultDesign() };
    if (!state.meta.design) state.meta.design = defaultDesign();
    // 支持 ?tpl= 预选模板、?accent= 预选主题色（来自模板库）
    try {
      var qp = new URLSearchParams(location.search);
      var tp = qp.get('tpl');
      var ac = qp.get('accent');
      var VALID = ['magic', 'standard', 'classic', 'cn', 'sidebar', 'energy', 'cover', 'table'];
      if (tp && VALID.indexOf(tp) >= 0 && state.meta.template !== tp) {
        state.meta.template = tp; save();
      }
      if (ac && /^#[0-9A-Fa-f]{6}$/.test(ac) && state.meta.accent !== ac) {
        state.meta.accent = ac; save();
      }
    } catch (e) {}
    renderAll();
    var form = document.querySelector('.wb-side');
    form.addEventListener('input', onInput);
    form.addEventListener('click', onClick);
    document.getElementById('tplSel').addEventListener('change', function (e) { setTemplate(e.target.value); });
    document.getElementById('accent').addEventListener('input', function (e) { setAccent(e.target.value); });
    document.getElementById('resumeSel').addEventListener('change', function (e) { switchResume(e.target.value); });
    document.getElementById('newResume').addEventListener('click', function () {
      var name = prompt('新简历名称（如：光伏岗版）：', state.basics.title || '新简历');
      if (!name) return;
      if (data.resumes[name]) { alert('已存在同名简历'); return; }
      data.resumes[name] = clone(state); data.current = name; save(); renderAll(); flash('已创建「' + name + '」');
    });
    document.getElementById('delResume').addEventListener('click', function () {
      if (Object.keys(data.resumes).length <= 1) { alert('至少保留一份简历'); return; }
      if (!confirm('删除当前简历「' + data.current + '」？')) return;
      delete data.resumes[data.current];
      data.current = Object.keys(data.resumes)[0]; state = data.resumes[data.current]; save(); renderAll(); flash('已删除');
    });
    document.getElementById('saveResume').addEventListener('click', function () { save(); flash('已保存'); });
    document.getElementById('resetBtn').addEventListener('click', function () {
      if (!confirm('重置当前简历为空白模板？此操作不可撤销。')) return;
      state.sections = DEFAULT_STATE().sections; state.basics = { name: '', title: '', phone: '', email: '', location: '', links: '', summary: '' }; save(); renderForm(); renderPreview(); flash('已重置');
    });
    document.getElementById('addSection').addEventListener('click', function () {
      var type = document.getElementById('addType').value;
      state.sections.push({ type: type, title: '', items: (type === 'skills' || type === 'certificates') ? [emptyItem(type)] : [] });
      save(); renderForm(); renderPreview();
    });
    document.getElementById('analyzeJd').addEventListener('click', renderJd);
    document.getElementById('jdInput').addEventListener('input', scheduleJd);
    document.getElementById('genCover').addEventListener('click', generateCoverLetter);
    document.getElementById('genGap').addEventListener('click', skillGapAnalysis);
    document.getElementById('copyCover').addEventListener('click', function () {
      var ta = document.getElementById('coverOut'); ta.select();
      try { document.execCommand('copy'); flash('求职信已复制'); } catch (e) { flash('复制失败，请手动选择'); }
    });
    // AI 润色：设置与执行
    document.getElementById('aiSettingsBtn').addEventListener('click', function () {
      var box = document.getElementById('aiSettings'); box.hidden = !box.hidden;
      if (!box.hidden) { var cfg = loadAI(); document.getElementById('aiBase').value = cfg.base || 'https://api.openai.com/v1'; document.getElementById('aiKey').value = cfg.key || ''; document.getElementById('aiModel').value = cfg.model || 'gpt-4o-mini'; }
    });
    ['aiBase', 'aiKey', 'aiModel'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', function () {
        var cfg = loadAI();
        cfg.base = document.getElementById('aiBase').value.trim();
        cfg.key = document.getElementById('aiKey').value.trim();
        cfg.model = document.getElementById('aiModel').value.trim();
        saveAI(cfg); flash('AI 设置已保存（仅本机）');
      });
    });
    document.getElementById('aiPolish').addEventListener('click', aiPolish);
    // 模块拖拽排序（手柄 + HTML5 DnD，箭头按钮仍可用作兜底）
    var sectionsEl = document.getElementById('sections'), dragSi = null;
    sectionsEl.addEventListener('mousedown', function (e) {
      var h = e.target.closest('.drag-handle'), sec = e.target.closest('.sec');
      if (h && sec) sec.setAttribute('draggable', 'true');
    });
    sectionsEl.addEventListener('dragstart', function (e) {
      var sec = e.target.closest('.sec'); if (!sec) return;
      if (e.target.matches('input,textarea,button')) { e.preventDefault(); return; }
      dragSi = +sec.dataset.sec; sec.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(dragSi)); } catch (_) {}
    });
    sectionsEl.addEventListener('dragover', function (e) {
      if (dragSi == null) return; e.preventDefault();
      var sec = e.target.closest('.sec'); if (!sec || sec.classList.contains('dragging')) return;
      var dragging = sectionsEl.querySelector('.dragging'); if (!dragging) return;
      var rect = sec.getBoundingClientRect(), after = (e.clientY - rect.top) > rect.height / 2;
      if (after) sectionsEl.insertBefore(dragging, sec.nextSibling); else sectionsEl.insertBefore(dragging, sec);
    });
    sectionsEl.addEventListener('drop', function (e) {
      if (dragSi == null) return; e.preventDefault();
      var order = Array.prototype.map.call(sectionsEl.querySelectorAll('.sec'), function (el) { return +el.dataset.sec; });
      state.sections = order.map(function (i) { return state.sections[i]; });
      dragSi = null; save(); renderForm(); renderPreview();
    });
    sectionsEl.addEventListener('dragend', function (e) {
      var d = sectionsEl.querySelector('.dragging'); if (d) d.classList.remove('dragging');
      Array.prototype.forEach.call(sectionsEl.querySelectorAll('.sec'), function (el) { el.removeAttribute('draggable'); });
      dragSi = null;
    });
    document.getElementById('exportPdf').addEventListener('click', function () { window.print(); });
    document.getElementById('exportJson').addEventListener('click', exportJson);
    document.getElementById('exportMd').addEventListener('click', exportMd);
    document.getElementById('importJson').addEventListener('click', function () { document.getElementById('importFile').click(); });
    document.getElementById('importFile').addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return;
      var name = f.name.toLowerCase();
      if (/\.docx$/i.test(name) || /\.doc$/i.test(name)) { handleDocx(f); e.target.value = ''; return; }
      if (/\.pdf$/i.test(name)) { handlePdf(f); e.target.value = ''; return; }
      // 默认按 JSON 处理
      var r = new FileReader();
      r.onload = function (ev) {
        try {
          var d = JSON.parse(ev.target.result);
          if (!d.resumes) throw new Error('格式不正确');
          data = d; if (!data.resumes[data.current]) data.current = Object.keys(data.resumes)[0];
          state = data.resumes[data.current]; save(); renderAll(); flash('已导入简历数据');
        } catch (err) { alert('导入失败：' + err.message); }
      };
      r.readAsText(f);
    });
    // drag & drop .docx anywhere on form
    form.addEventListener('dragover', function (e) { e.preventDefault(); });
    form.addEventListener('drop', function (e) {
      e.preventDefault();
      var f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      if (/\.docx$/i.test(f.name) || /\.doc$/i.test(f.name)) handleDocx(f);
      else if (/\.pdf$/i.test(f.name)) handlePdf(f);
      else flash('仅支持 .docx / .pdf 简历导入');
    });
    // 模板画廊在 renderAll 已渲染；绑定 tab 切换与设计面板控件
    Array.prototype.forEach.call(document.querySelectorAll('.wb-tab'), function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.dataset.tab;
        Array.prototype.forEach.call(document.querySelectorAll('.wb-tab'), function (b) { b.classList.toggle('active', b === btn); });
        document.getElementById('pane-template').hidden = tab !== 'template';
        document.getElementById('pane-content').hidden = tab !== 'content';
        document.getElementById('pane-design').hidden = tab !== 'design';
      });
    });
    document.getElementById('rsFont').addEventListener('change', function (e) { state.meta.design.font = e.target.value; save(); renderPreview(); });
    var rsMap = { rsLh: 'lh', rsBase: 'base', rsSec: 'sec', rsMargin: 'margin', rsGap: 'gap', rsPara: 'para' };
    Object.keys(rsMap).forEach(function (id) {
      document.getElementById(id).addEventListener('input', function (e) {
        var v = parseFloat(e.target.value); state.meta.design[rsMap[id]] = v; save(); renderPreview();
        var valEl = document.getElementById(id + 'Val'); if (valEl) valEl.textContent = (rsMap[id] === 'lh') ? v : v + 'px';
      });
    });
    document.getElementById('mIcon').addEventListener('change', function (e) { state.meta.design.modes.icon = e.target.checked; save(); renderPreview(); });
    document.getElementById('mSubCenter').addEventListener('change', function (e) { state.meta.design.modes.subCenter = e.target.checked; save(); renderPreview(); });
    document.getElementById('mLongTitle').addEventListener('change', function (e) { state.meta.design.modes.longTitle = e.target.checked; save(); renderPreview(); });

    // expose for testing
    window.__ra = { state: function () { return state; }, computeAts: computeAts, parseDocxToState: parseDocxToState, applyAiResults: applyAiResults, loadAI: loadAI };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
