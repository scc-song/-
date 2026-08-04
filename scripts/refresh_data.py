#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ResumeAuto 数据自动刷新脚本（纯标准库，无需 pip 安装任何依赖）

- soe.json : 尝试抓取中国公共招聘网·重点行业 等官方渠道，写入最新国企/央企招聘公告；
            抓取失败或解析不足时，保留已有 soe.json（绝不破坏网站）。
- jobs.json: 保留现有的「平台搜索链接」目录（点击即跳平台实时搜索），仅刷新 generatedAt 时间戳；
            若存在 jobs_extra.json，则把里面的新搜索词合并追加进去。
- version.json: 刷新「最后更新」时间戳为 Asia/Shanghai 当前时间。

设计目标：在 GitHub Actions (ubuntu-latest) 中运行，拥有公网访问能力；
任何一步失败都只影响那一步，不会让站点数据丢失或报错中断。
"""
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
SHANGHAI = timezone(timedelta(hours=8))

# ---- 数据源配置（可继续扩展）----
SOE_SOURCES = [
    {
        "name": "中国公共招聘网·重点行业",
        "url": "https://job.mohrss.gov.cn/zdqyzpxx/index.jhtml",
        "source_tag": "中国公共招聘网·重点行业",
        "fallback_http": "http://job.mohrss.gov.cn/zdqyzpxx/index.jhtml",
    },
]

# 过滤导航/菜单/栏目落地页等噪声
NOISE_TITLES = {
    "中国公共招聘网", "中国公共招聘网 >", "名企招聘信息", "重点行业重点企业招聘专栏",
    "事业单位公开招聘", "高校毕业生就业服务平台", "扶贫基地招聘岗位", "制造业招聘专区",
    "首页", "个人服务", "单位服务", "就业服务", "招聘会",
}
NOISE_URL_RE = re.compile(
    r"(/cjobs/|/zdhy/|listInstitution|baseList|/202008gx/|index\.jhtml$|"
    r"^https?://[^/]+/?$|/$)"
)


def now_shanghai():
    return datetime.now(SHANGHAI)


def today_str():
    return now_shanghai().strftime("%Y-%m-%d")


def ts_str():
    return now_shanghai().strftime("%Y-%m-%d %H:%M")


def fetch_html(url, timeout=20):
    last_err = None
    for u in [url]:
        try:
            req = urllib.request.Request(
                u, headers={"User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9"}
            )
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read()
                for enc in ("utf-8", "gbk", "gb18030"):
                    try:
                        return raw.decode(enc)
                    except UnicodeDecodeError:
                        continue
                return raw.decode("utf-8", "ignore")
        except Exception as e:  # noqa: BLE001
            last_err = e
    raise last_err or RuntimeError("fetch failed: " + url)


def clean_text(s):
    s = re.sub(r"<[^>]+>", "", s or "")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def classify_tag(title):
    t = title or ""
    if any(k in t for k in ("央企", "国企", "集团", "有限公司", "股份", "公司")):
        return "国企·央企"
    return "招聘公告"


def extract_links(html, base_url):
    out = []
    seen = set()
    pat = re.compile(r'<a\b([^>]*)href=["\']([^"\']+)["\']([^>]*)>(.*?)</a>', re.S | re.I)
    for m in pat.finditer(html):
        open_tag = m.group(1) + " " + m.group(3)
        href = m.group(2).strip()
        text = clean_text(m.group(4))
        if not text or len(text) < 6:
            # 退而求其次：用 <a> 标签的 title 属性
            ta = re.search(r'title=["\']([^"\']+)', open_tag)
            if ta:
                text = clean_text(ta.group(1))
        if not text or len(text) < 6:
            continue
        if href.startswith(("javascript:", "#", "mailto:")):
            continue
        if href.startswith("//"):
            abs_url = "https:" + href
        elif href.startswith("http"):
            abs_url = href
        else:
            abs_url = urljoin(base_url, href)
        norm = abs_url.split("?")[0].rstrip("/")
        if norm in seen:
            continue
        seen.add(norm)
        out.append({"title": text, "url": abs_url, "norm": norm})
    return out


def refresh_soe(existing):
    """返回 (announcements, note)；抓取不足时返回已有数据以保证站点不破。"""
    collected = []
    seen_norm = set()
    for src in SOE_SOURCES:
        tried = [src["url"]]
        if src.get("fallback_http"):
            tried.append(src["fallback_http"])
        ok = False
        for u in tried:
            try:
                html = fetch_html(u)
                links = extract_links(html, u)
                for ln in links:
                    if ln["norm"] in seen_norm:
                        continue
                    seen_norm.add(ln["norm"])
                    collected.append({
                        "title": ln["title"],
                        "url": ln["url"],
                        "source": src["source_tag"],
                        "tag": classify_tag(ln["title"]),
                    })
                ok = True
                break
            except Exception as e:  # noqa: BLE001
                print(f"[soe] 抓取 {src['name']} ({u}) 失败: {e}", file=sys.stderr)
        if not ok:
            print(f"[soe] 数据源 {src['name']} 全部失败", file=sys.stderr)

    # 过滤噪声（导航/栏目落地页）并按标题去重；微信招聘公告优先排序
    filtered = []
    seen_title = set()
    for c in collected:
        if c["title"] in NOISE_TITLES:
            continue
        if NOISE_URL_RE.search(c["url"]):
            continue
        t = c["title"].strip()
        if t in seen_title:
            continue
        seen_title.add(t)
        filtered.append(c)
    collected = filtered
    collected.sort(key=lambda c: (0 if "mp.weixin.qq.com/s/" in c["url"] else 1, c["title"]))

    if len(collected) < 5:
        print(f"[soe] 仅抓到 {len(collected)} 条，低于阈值(5)，保留已有 soe.json", file=sys.stderr)
        return existing.get("announcements", []), existing.get("note", "")

    existing_by_norm = {}
    for a in existing.get("announcements", []):
        n = a.get("url", "").split("?")[0].rstrip("/")
        existing_by_norm.setdefault(n, a)
    max_num = 0
    for a in existing.get("announcements", []):
        m = re.search(r"(\d+)$", a.get("id", ""))
        if m:
            max_num = max(max_num, int(m.group(1)))

    merged = []
    used_norm = set()
    for c in collected:
        n = c["url"].split("?")[0].rstrip("/")
        if n in used_norm:
            continue
        used_norm.add(n)
        prev = existing_by_norm.get(n)
        if prev:
            item = dict(prev)  # 沿用已有 id / updatedAt，保持稳定，避免每次都误报“新增”
        else:
            max_num += 1
            item = {
                "id": f"SOE{max_num:03d}",
                "title": c["title"],
                "tag": c["tag"],
                "source": c["source"],
                "url": c["url"],
                "status": "open",
                "updatedAt": today_str(),
            }
        merged.append(item)

    for a in existing.get("announcements", []):
        n = a.get("url", "").split("?")[0].rstrip("/")
        if n in used_norm:
            continue
        used_norm.add(n)
        merged.append(a)
        if len(merged) >= 50:
            break

    note = ("自动抓取自中国公共招聘网·重点行业等官方渠道；url 均为官方公告页直达链接（点击无中间跳转）。"
            "status 默认 open（可投递），updatedAt 为抓取日期。后台定时任务每 6 小时重新抓取并更新本文件，"
            "访客 30 秒内自动看到最新公告。")
    return merged, note


def main():
    today = today_str()
    ts = ts_str()

    # ---- soe.json ----
    soe_path = os.path.join(REPO_ROOT, "soe.json")
    soe_existing = {}
    if os.path.exists(soe_path):
        try:
            with open(soe_path, "r", encoding="utf-8") as f:
                soe_existing = json.load(f)
        except Exception:  # noqa: BLE001
            soe_existing = {}
    announcements, soe_note = refresh_soe(soe_existing)
    soe_new = {
        "generatedAt": ts,
        "note": soe_note,
        "announcements": announcements,
    }
    with open(soe_path, "w", encoding="utf-8") as f:
        json.dump(soe_new, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"[soe] 写入 {len(announcements)} 条公告")

    # ---- jobs.json ----
    jobs_path = os.path.join(REPO_ROOT, "jobs.json")
    jobs = {}
    if os.path.exists(jobs_path):
        with open(jobs_path, "r", encoding="utf-8") as f:
            jobs = json.load(f)
    jobs["generatedAt"] = today

    extra_path = os.path.join(REPO_ROOT, "jobs_extra.json")
    if os.path.exists(extra_path):
        try:
            with open(extra_path, "r", encoding="utf-8") as f:
                extra = json.load(f)
            existing_ids = {j.get("id") for j in jobs.get("jobs", [])}
            added = 0
            for j in extra.get("jobs", []):
                if j.get("id") not in existing_ids:
                    jobs.setdefault("jobs", []).append(j)
                    added += 1
            if added:
                print(f"[jobs] 追加 {added} 条额外搜索")
        except Exception as e:  # noqa: BLE001
            print(f"[jobs] 读取 jobs_extra.json 失败: {e}", file=sys.stderr)

    with open(jobs_path, "w", encoding="utf-8") as f:
        json.dump(jobs, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"[jobs] 保留 {len(jobs.get('jobs', []))} 条职位目录")

    # ---- version.json ----
    version_path = os.path.join(REPO_ROOT, "version.json")
    with open(version_path, "w", encoding="utf-8") as f:
        f.write('{\n  "ts": "' + ts + '"\n}\n')
    print(f"[version] 时间戳 {ts}")


if __name__ == "__main__":
    main()
