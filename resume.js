/* ResumeAuto 智能简历编辑器 —— 纯前端，无后端依赖
 * 功能：docx 本地解析(方案A) + JD 关键词提取 + 按岗位智能重排模块 + 实时编辑 + 本地保存 + 导出
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'resumeauto.data.v1';

  // 简历数据模型
  function emptyState() {
    return {
      basics: { name: '', phone: '', email: '', location: '', links: '' },
      summary: '',
      sections: [
        { type: 'experience', title: '工作经历', items: [] },
        { type: 'projects', title: '项目经历', items: [] },
        { type: 'skills', title: '技能特长', items: [] },
        { type: 'education', title: '教育背景', items: [] },
        { type: 'extra', title: '证书 / 其他', items: [] }
      ],
      jd: '',
      order: null // 智能排序后的 section type 顺序
    };
  }

  var state = emptyState();

  /* ---------- 本地存储 ---------- */
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      flash('已自动保存到本地');
    } catch (e) { /* 忽略隐私模式限制 */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) state = Object.assign(emptyState(), JSON.parse(raw));
    } catch (e) { /* 损坏则重置 */ }
  }
  var flashTimer;
  function flash(msg) {
    var el = document.getElementById('saveState');
    if (!el) return;
    el.textContent = msg + ' · ' + new Date().toLocaleTimeString();
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { el.textContent = ''; }, 2500);
  }

  /* ---------- JD 关键词与信号 ---------- */
  // 领域词典（新能源求职向，可扩展）
  var SKILL_DICT = [
    'python', 'c++', 'java', 'matlab', 'sql', 'excel', 'ppt', 'word', 'linux',
    '锂离子电池', '锂电池', '动力电池', '固态电池', 'bms', '电池管理系统', '储能',
    '光伏', '风电', '氢能', '燃料电池', '碳中和', '新能源', '电力系统', '电气',
    '仿真', '建模', '数据分析', '机器学习', '深度学习', '算法', '嵌入式',
    '项目管理', 'pmp', '团队协作', '沟通', '供应链', '质量控制', 'ie', '六西格玛',
    'autocad', 'solidworks', 'ansys', 'catia', 'cad', 'plc', 'mes', 'erp'
  ];
  // 模块权重信号：命中关键词 -> 提升对应模块优先级
  var SIGNAL_RULES = [
    { kw: ['开发', '编程', '技术', '工程', '算法', '嵌入式', '仿真', '建模', 'cad', '代码'],
      up: ['skills', 'projects'] },
    { kw: ['管理', '团队', '负责', 'leader', '总监', '主管', '项目经理'],
      up: ['experience'] },
    { kw: ['研究', '论文', '科研', '课题', '专利'], up: ['projects', 'extra'] },
    { kw: ['实习', '在校', '校园', '应届'], up: ['education', 'projects'] },
    { kw: ['销售', '市场', '客户', '商务', '运营'], up: ['experience', 'skills'] }
  ];

  function parseJD(text) {
    text = (text || '').toLowerCase();
    var found = [];
    SKILL_DICT.forEach(function (k) {
      if (text.indexOf(k) !== -1) found.push(k);
    });
    // 也抽取 JD 里出现的英文技能词
    var en = text.match(/[a-z][a-z0-9\+\#\.]{1,}/g) || [];
    en.forEach(function (w) {
      if (w.length >= 2 && SKILL_DICT.indexOf(w) === -1) found.push(w);
    });
    // 去重
    found = found.filter(function (v, i) { return found.indexOf(v) === i; });

    // 信号计分
    var weight = { experience: 1, projects: 1, skills: 1, education: 1, extra: 1 };
    SIGNAL_RULES.forEach(function (r) {
      r.kw.forEach(function (k) {
        if (text.indexOf(k) !== -1) r.up.forEach(function (t) { weight[t] += 1; });
      });
    });
    return { keywords: found, weight: weight };
  }

  function reorderSections(weight) {
    var order = state.sections.map(function (s) { return s.type; })
      .sort(function (a, b) { return (weight[b] || 1) - (weight[a] || 1); });
    state.order = order;
  }

  /* ---------- 自动起草总结 ---------- */
  function autoSummary(jd) {
    var kws = parseJD(jd).keywords.slice(0, 6);
    if (!kws.length) return state.summary;
    var kwText = kws.join('、');
    return '具备' + kwText + '等相关能力，熟悉岗位核心要求，能够结合项目与实践经验高效达成目标；' +
      '注重结果导向与团队协作，期望在对应方向上持续深耕。';
  }

  /* ---------- docx 解析（方案 A）---------- */
  function handleDocx(file) {
    var status = document.getElementById('parseStatus');
    if (!window.mammoth) {
      status.className = 'status err';
      status.textContent = '解析库未加载（可能网络受限）。请检查网络后重试，或改用「粘贴文本」方式。';
      return;
    }
    status.className = 'status';
    status.textContent = '正在解析 ' + file.name + ' …';
    var reader = new FileReader();
    reader.onload = function (e) {
      mammoth.extractRawText({ arrayBuffer: e.target.result })
        .then(function (result) {
          var text = result.value || '';
          if (!text.trim()) { status.className = 'status err'; status.textContent = '未提取到文本，请确认是 .docx 文档。'; return; }
          parseResumeText(text);
          status.className = 'status ok';
          status.textContent = '解析成功，已填充到右侧编辑器（可继续编辑）。';
          save(); render();
        })
        .catch(function (err) {
          status.className = 'status err';
          status.textContent = '解析失败：' + (err && err.message ? err.message : err);
        });
    };
    reader.onerror = function () {
      status.className = 'status err'; status.textContent = '读取文件失败。';
    };
    reader.readAsArrayBuffer(file);
  }

  // 把 docx 纯文本拆成结构化简历（启发式）
  function parseResumeText(text) {
    var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); })
      .filter(function (l) { return l.length; });

    var basics = state.basics;
    // 邮箱 / 电话
    var emailM = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    var phoneM = text.match(/(?:\+?86[-\s]?)?1[3-9]\d{9}/);
    if (emailM) basics.email = emailM[0];
    if (phoneM) basics.phone = phoneM[0];
    // 姓名：第一个较短的非标题行
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].length <= 4 && !/教育|工作|项目|技能|经历|评价|求职|基本|信息|背景/.test(lines[i])) {
        basics.name = lines[i]; break;
      }
    }

    // 按常见小标题切分
    var map = {
      experience: /工作|实习|经验/, projects: /项目/, skills: /技能|特长|专业/,
      education: /教育|学历|背景/, extra: /证书|荣誉|获奖|其他|语言/
    };
    var blocks = {}; var current = null;
    lines.forEach(function (line) {
      var hit = null;
      for (var t in map) { if (map[t].test(line) && line.length < 12) { hit = t; break; } }
      if (hit) { current = hit; blocks[current] = blocks[current] || []; return; }
      if (current) blocks[current].push(line);
    });

    // 写入 sections
    state.sections.forEach(function (s) {
      var raw = blocks[s.type];
      if (!raw || !raw.length) return;
      if (s.type === 'skills') {
        s.items = raw.join(' ').split(/[、,，;；\s]+/).filter(function (x) { return x.length; })
          .map(function (x) { return { text: x }; });
      } else if (s.type === 'education') {
        s.items = chunkEducation(raw).map(function (b) { return { title: b[0] || '', meta: '', desc: b.slice(1).join('\n') }; });
      } else {
        s.items = chunkByGap(raw).map(function (b) {
          return { title: b[0] || '', meta: b[1] && /\d{4}|公司|大学|学院/.test(b[1]) ? b[1] : '', desc: b.slice(b[1] && /\d{4}|公司|大学|学院/.test(b[1]) ? 2 : 1).join('\n') };
        });
      }
    });
  }
  // 按空行/明显换行把段落切块
  function chunkByGap(arr) {
    var out = [], cur = [];
    arr.forEach(function (l) {
      if (/^\d{4}[\s.\-/]?\d{0,2}/.test(l) || cur.length >= 4) { if (cur.length) out.push(cur); cur = [l]; }
      else cur.push(l);
    });
    if (cur.length) out.push(cur);
    return out;
  }
  function chunkEducation(arr) {
    var out = [], cur = [];
    arr.forEach(function (l) {
      if (/大学|学院|学校/.test(l) && cur.length) { out.push(cur); cur = [l]; } else cur.push(l);
    });
    if (cur.length) out.push(cur);
    return out;
  }

  /* ---------- 渲染（可编辑）---------- */
  function render() {
    var root = document.getElementById('resume');
    root.innerHTML = '';

    // 姓名 + 联系方式
    var h1 = document.createElement('h1');
    h1.className = 'name'; h1.contentEditable = 'true';
    h1.textContent = state.basics.name || '你的姓名';
    h1.oninput = function () { state.basics.name = h1.textContent.trim(); debouncedSave(); };
    root.appendChild(h1);

    var contact = document.createElement('div');
    contact.className = 'contact'; contact.contentEditable = 'true';
    var c = state.basics;
    contact.textContent = [c.phone, c.email, c.location, c.links].filter(Boolean).join('  |  ') || '电话 | 邮箱 | 城市 | 主页';
    contact.oninput = function () {
      var parts = contact.textContent.split('|').map(function (x) { return x.trim(); });
      state.basics.phone = parts[0] || ''; state.basics.email = parts[1] || '';
      state.basics.location = parts[2] || ''; state.basics.links = parts[3] || '';
      debouncedSave();
    };
    root.appendChild(contact);

    // 总结
    root.appendChild(blockEl({
      type: 'summary', title: '个人总结',
      render: function () {
        var d = document.createElement('div'); d.contentEditable = 'true';
        d.textContent = state.summary || '粘贴 JD 后点「智能生成」，或在此直接撰写。';
        d.oninput = function () { state.summary = d.textContent; debouncedSave(); };
        return d;
      }
    }));

    // 各模块（按 order 排序）
    var order = state.order || state.sections.map(function (s) { return s.type; });
    order.forEach(function (type) {
      var sec = state.sections.find(function (s) { return s.type === type; });
      if (!sec) return;
      root.appendChild(sectionEl(sec));
    });
  }

  function blockEl(opt) {
    var sec = document.createElement('section'); sec.className = 'block';
    var h2 = document.createElement('h2'); h2.textContent = opt.title;
    sec.appendChild(h2); sec.appendChild(opt.render());
    return sec;
  }

  function sectionEl(sec) {
    var wrap = document.createElement('section'); wrap.className = 'block';
    var h2 = document.createElement('h2'); h2.textContent = sec.title; wrap.appendChild(h2);

    if (sec.type === 'skills') {
      var line = document.createElement('div'); line.className = 'skills-line';
      var hitSet = currentHits();
      sec.items.forEach(function (it, i) {
        var chip = document.createElement('span');
        chip.className = 'chip' + (hitSet.has(it.text.toLowerCase()) ? ' hit' : '');
        chip.contentEditable = 'true'; chip.textContent = it.text;
        chip.oninput = function () { it.text = chip.textContent; debouncedSave(); };
        var del = delBtn(function () { sec.items.splice(i, 1); render(); save(); });
        chip.appendChild(del);
        line.appendChild(chip); line.appendChild(document.createTextNode(' '));
      });
      wrap.appendChild(line);
      wrap.appendChild(addBtn('+ 添加技能', function () {
        sec.items.push({ text: '新技能' }); render(); save();
      }));
      return wrap;
    }

    var ul = document.createElement('ul'); ul.className = 'items';
    sec.items.forEach(function (it, i) {
      var li = document.createElement('li'); li.className = 'item';
      var row1 = document.createElement('div'); row1.className = 'row1';
      var title = document.createElement('span'); title.className = 'title'; title.contentEditable = 'true';
      title.textContent = it.title || '职位 / 项目名';
      title.oninput = function () { it.title = title.textContent; debouncedSave(); };
      var meta = document.createElement('span'); meta.className = 'meta'; meta.contentEditable = 'true';
      meta.textContent = it.meta || '公司 / 时间';
      meta.oninput = function () { it.meta = meta.textContent; debouncedSave(); };
      row1.appendChild(title); row1.appendChild(meta);
      var desc = document.createElement('div'); desc.className = 'desc'; desc.contentEditable = 'true';
      desc.textContent = it.desc || '主要职责与成果…';
      desc.oninput = function () { it.desc = desc.textContent; debouncedSave(); };
      li.appendChild(row1); li.appendChild(desc);
      li.appendChild(delBtn(function () { sec.items.splice(i, 1); render(); save(); }));
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
    wrap.appendChild(addBtn('+ 添加一条', function () {
      sec.items.push({ title: '', meta: '', desc: '' }); render(); save();
    }));
    return wrap;
  }

  function delBtn(onclick) {
    var b = document.createElement('button'); b.className = 'del-btn'; b.textContent = '✕';
    b.onclick = onclick; return b;
  }
  function addBtn(label, onclick) {
    var b = document.createElement('button'); b.className = 'add-btn'; b.textContent = label;
    b.onclick = onclick; return b;
  }

  var hitCache = null;
  function currentHits() {
    if (hitCache) return hitCache;
    hitCache = new Set();
    if (state.jd) parseJD(state.jd).keywords.forEach(function (k) { hitCache.add(k); });
    // 也把用户技能小写加入，便于高亮
    state.sections.forEach(function (s) {
      if (s.type === 'skills') s.items.forEach(function (it) { hitCache.add(it.text.toLowerCase()); });
    });
    return hitCache;
  }

  /* ---------- 导出 ---------- */
  function exportJSON() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    download(blob, (state.basics.name || 'resume') + '.json');
  }
  function exportMarkdown() {
    var s = state, md = '';
    md += '# ' + (s.basics.name || '姓名') + '\n';
    md += [s.basics.phone, s.basics.email, s.basics.location, s.basics.links].filter(Boolean).join(' | ') + '\n\n';
    if (s.summary) md += '## 个人总结\n' + s.summary + '\n\n';
    s.sections.forEach(function (sec) {
      md += '## ' + sec.title + '\n';
      if (sec.type === 'skills') {
        md += sec.items.map(function (i) { return '- ' + i.text; }).join('\n') + '\n\n';
      } else {
        sec.items.forEach(function (it) {
          md += '- **' + (it.title || '') + '**' + (it.meta ? '  _' + it.meta + '_' : '') + '\n';
          if (it.desc) md += '  ' + it.desc.replace(/\n/g, '\n  ') + '\n';
        });
        md += '\n';
      }
    });
    download(new Blob([md], { type: 'text/markdown' }), (s.basics.name || 'resume') + '.md');
  }
  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  var saveT;
  function debouncedSave() { clearTimeout(saveT); saveT = setTimeout(save, 600); }

  /* ---------- 事件绑定 ---------- */
  function init() {
    load(); render();

    document.getElementById('genBtn').onclick = function () {
      var jd = document.getElementById('jdInput').value.trim();
      if (!jd) { flash('请先粘贴岗位 JD'); return; }
      state.jd = jd;
      var res = parseJD(jd);
      reorderSections(res.weight);
      if (!state.summary) state.summary = autoSummary(jd);
      render(); save();
      // 匹配面板
      var card = document.getElementById('matchCard'); card.hidden = false;
      var tags = document.getElementById('matchTags'); tags.innerHTML = '';
      res.keywords.slice(0, 24).forEach(function (k) {
        var t = document.createElement('span'); t.className = 'tag'; t.textContent = k; tags.appendChild(t);
      });
      if (!res.keywords.length) {
        var t = document.createElement('span'); t.className = 'tag miss'; t.textContent = '未在词典中找到明确技能词'; tags.appendChild(t);
      }
      var topSec = (state.order || [])[0];
      var secObj = state.sections.find(function (s) { return s.type === topSec; });
      document.getElementById('reorderHint').textContent = secObj
        ? '已根据 JD 将「' + secObj.title + '」模块置顶——岗位更看重的经历被排在前面。'
        : '';
      hitCache = null; render();
      flash('已按岗位定制');
    };

    var dz = document.getElementById('dropzone');
    var input = document.getElementById('docxInput');
    input.onchange = function () { if (input.files[0]) handleDocx(input.files[0]); };
    ['dragover', 'dragenter'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('drag'); });
    });
    dz.addEventListener('drop', function (e) {
      if (e.dataTransfer.files[0]) handleDocx(e.dataTransfer.files[0]);
    });

    document.getElementById('saveBtn').onclick = function () { save(); flash('已保存'); };
    document.getElementById('exportJson').onclick = exportJSON;
    document.getElementById('exportMd').onclick = exportMarkdown;
    document.getElementById('exportPdf').onclick = function () { window.print(); };
    document.getElementById('resetBtn').onclick = function () {
      if (confirm('确定清空当前简历？此操作不可撤销。')) {
        state = emptyState(); save(); render(); flash('已重置');
      }
    };
    // 自动保存（离开前）
    window.addEventListener('beforeunload', save);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
