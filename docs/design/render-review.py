import json, re, html, sys

C = json.load(open(sys.argv[1]))
S = C["shared"]

def esc(s): return html.escape(str(s))

def fill(text, ex, shared_ctx=None, depth=0):
    """Fill {var} and {list:var} from ex; expand shared references; mark filled values."""
    if text is None: return ""
    if depth > 4: return esc(text)
    ctx = dict(ex or {})
    # shared references usable inside any string
    shared_refs = {
        "portalRoot": S["portalRoot"], "reportOnlyLine": S["reportOnlyLine"],
        "exclusionsLine": S["exclusionsLine"], "signature": ex.get("signature", S["signatureDefault"]) if ex else S["signatureDefault"],
        "policyIfWrong": S["policyIfWrong"], "changeIfWrong": S["changeIfWrong"],
        "datesNew": S["datesNew"], "datesChange": S["datesChange"],
        "portalOpen": S["portalOpen"], "existingCoverage": S.get("existingCoverage",""), "syncRoleNote": S.get("syncRoleNote",""),
    }
    defaults = {"announce": "Tue Sep 1", "reportOnly": "Tue Sep 1", "enforce": "Tue Sep 8", "reportOnlyDays": "7", "date": "Aug 28, 2026", "n": 3,
                "exclusionsGroup": "Breakglass Exclusion", "emergencyAccounts": ["Breakglass", "Emergency Access 2"],
                "policy": ex.get("policyName", "") if ex else "", "tenant": "GetIAMAI"}
    def sub_list(m):
        key = m.group(1)
        items = ctx.get(key, defaults.get(key))
        if isinstance(items, str): items = [items]
        if not items: return '<var class="v">(none)</var>'
        return '</p><ol class="names">' + "".join(f"<li><var class=\"v\">{esc(i)}</var></li>" for i in items) + "</ol><p>"
    def sub(m):
        key = m.group(1)
        if key in shared_refs:
            return fill(shared_refs[key], ex, depth=depth+1)
        if key in ctx and not isinstance(ctx[key], (list, dict)):
            return f'<var class="v">{esc(ctx[key])}</var>'
        if key in defaults and not isinstance(defaults[key], list):
            return f'<var class="v">{esc(defaults[key])}</var>'
        return f'<var class="v miss">{{{esc(key)}}}</var>'
    out = esc(text)
    out = re.sub(r"\{list:([a-zA-Z0-9_]+)\}", sub_list, out)
    out = re.sub(r"\{([a-zA-Z0-9_]+)\}", sub, out)
    out = re.sub(r"</ol><p>\s*[.;:,]\s*", "</ol><p>", out)
    out = re.sub(r"<p>\s*</p>", "", out)
    return out

def p(text, ex, cls=""):
    if text is None: return ""
    return f'<p class="{cls}">{fill(text, ex)}</p>'

def ol(items, ex):
    if not items: return ""
    return "<ol>" + "".join(f"<li>{fill(i, ex)}</li>" for i in items) + "</ol>"

def ul(items, ex):
    if not items: return ""
    return "<ul>" + "".join(f"<li>{fill(i, ex)}</li>" for i in items) + "</ul>"

def h(label): return f'<h4>{esc(label)}</h4>'

def chip(t): return f'<span class="chip">{esc(t)}</span>'
def btn(t, primary=False): return f'<span class="btn{" primary" if primary else ""}">{esc(t)}</span>'

def done_when(items, ex):
    out = []
    for i in items:
        if i == "{policyDoneWhen}": out += S["policyDoneWhen"]
        elif i == "{changeDoneWhen}": out += S["changeDoneWhen"]
        else: out.append(i)
    return ul(out, ex)

def render_step(st):
    ex = dict(st.get("example") or {})
    kind = st["kind"]
    parts = []
    status = "Ready" if kind in ("blocker", "object", "check", "campaign") else "Blocked"
    lic = st.get("licence")
    parts.append(f'<div class="steprow"><span class="chip status">{esc(status)}</span><span class="title">{esc(st["title"])}</span>'
                 + (f'<span class="lic">needs a licence this tenant does not hold: {esc(lic)}</span>' if lic else "") + '</div>')
    parts.append('<div class="stepbody">')
    parts.append(f'<div class="stephead"><span class="title2">{esc(st["title"])}</span> <span class="chip status">{esc(status)}</span></div>')
    if st.get("changeLine"): parts.append(p(st["changeLine"], ex, "change"))
    if st.get("partner"): parts.append(p(st["partner"], ex, "partner"))
    if st.get("placement"): parts.append(p(st["placement"], ex, "sub"))
    # Why
    parts.append(h("Why"))
    learn = st.get("learn") or {}
    cis = f' <span class="chip cis">CIS {esc(learn["cis"])}</span>' if learn.get("cis") else ""
    parts.append(f'<p>{fill(st["why"], ex)} <a class="learn" href="{esc(learn.get("url",""))}">Learn →</a>{cis}</p>')
    # Who
    who = st.get("who") or {}
    parts.append(h("Who this touches"))
    if who.get("lead"): parts.append(p(who["lead"], ex))
    if who.get("timeline"): parts.append(p(who["timeline"], ex, "evidence"))
    for k, v in who.items():
        if k in ("lead", "groups", "adminsNote", "timeline", "overlap"): continue
        if isinstance(v, list):
            # evidence lines: show each as its own paragraph; skip lines whose list is empty and whose count is 0
            for line in v:
                if line == "{existingCoverage}":
                    if not ex.get("existingPolicies"): continue
                    line = S["existingCoverage"]
                keys = re.findall(r"\{(?:list:)?([a-zA-Z0-9_]+)\}", line)
                listkeys = re.findall(r"\{list:([a-zA-Z0-9_]+)\}", line)
                if listkeys and all(not ex.get(k2) for k2 in listkeys):
                    continue
                if not listkeys and "{n}" in line and ex.get("n", 1) == 0:
                    continue
                e2 = dict(ex)
                if listkeys and "{n}" in line: e2["n"] = len(ex.get(listkeys[0]) or [])
                parts.append(p(line, e2, "evidence"))
        elif isinstance(v, str):
            if k == "none" and (ex.get("locationsWithMatches") == [] or ex.get("accountsWithSignals") is None and "none" in k):
                pass
            if k == "none":
                # render only when the main list is empty
                main = [kk for kk in ("locationsWithMatches","accountsWithSignals","devicesWithSignals","members","strengths","syncAddresses") if kk in ex]
                if main and not ex.get(main[0]): parts.append(p(v, ex, "evidence"))
                continue
            if k in ("remoteHint", "emergencyNote", "timeline"): parts.append(p(v, ex, "evidence")); continue
            if k == "match":
                if ex.get("matchedStrength"): parts.append(p(v, ex, "evidence"))
                continue
            parts.append(p(v, ex, "evidence"))
    if who.get("groups"):
        g = who["groups"]
        for gk, gl in g.items():
            items = ex.get(gk) or []
            if not items: continue
            e2 = dict(ex); e2["n"] = len(items)
            parts.append(f'<p class="evidence">{fill(gl, e2)}</p><ol class="names">' + "".join(f"<li><var class=\"v\">{esc(i)}</var></li>" for i in items) + "</ol>")
        if who.get("overlap"): parts.append(p(who["overlap"], ex, "sub"))
        if who.get("adminsNote"):
            e2 = dict(ex); e2["admins"] = ex.get("admins", ex.get("adminsList", []))
            parts.append(p(who["adminsNote"], e2, "evidence"))
    # Decision
    d = st.get("decision")
    if d:
        parts.append('<div class="decision">')
        parts.append(f'<div class="dlabel">{esc(d["label"])}</div>')
        if d.get("help"): parts.append(p(d["help"], ex, "dhelp"))
        if d.get("location"):
            L = d["location"]
            parts.append(f'<div class="dlabel">{esc(L["label"])}</div>' + p(L["help"], ex, "dhelp"))
            lrows = ex.get(L["pickerSource"]) or []
            parts.append('<div class="picker">' + ("".join(f'<label><input type="radio" checked disabled> <var class="v">{esc(r)}</var></label>' for r in lrows) if lrows else f'<p class="dhelp">{esc(L["none"])}</p>') + "</div>")
            parts.append(f'<div class="dlabel">{esc(d["label"])}</div>')
        if d.get("pickerRow"):
            rows = []
            keys = [d["pickerSource"]] if d.get("pickerSource") else ["emergencyAccounts","countriesWithCounts","locationsWithMatches","accountsWithSignals","devicesWithSignals","adminsList"]
            for key in keys:
                if ex.get(key): rows = ex[key]; break
            if rows:
                kind_in = "checkbox" if d.get("multi") or not d.get("pickerSource") in ("groups","countryLocations") else "radio"
                parts.append('<div class="picker">' + "".join(f'<label><input type="{kind_in}" {"checked" if i==0 or d.get("multi") else ""} disabled> <var class="v">{esc(r)}</var></label>' for i, r in enumerate(rows)) + "</div>")
            else:
                parts.append(f'<div class="picker"><label><input type="checkbox" disabled> {fill(d["pickerRow"], ex)}</label></div>')
        if d.get("options"):
            parts.append('<div class="picker">' + "".join(f'<label><input type="radio" disabled> {fill(o, ex)}</label>' for o in d["options"]) + "</div>")
        if d.get("question"):
            q = d["question"]
            parts.append(f'<div class="dlabel q">{esc(q["label"])}</div>' + p(q["text"], ex, "dhelp") +
                         '<div class="picker">' + "".join(f'<label><input type="radio" disabled> {fill(o, ex)}</label>' for o in q["options"]) + "</div>" + p(q["effect"], ex, "dhelp"))
        parts.append(btn(d.get("save","Save")) + "</div>")
    # What to do
    w = st.get("whatToDo") or {}
    parts.append(h("What to do"))
    if w.get("lead"): parts.append(p(w["lead"], ex))
    if w.get("steps"): parts.append(ol(w["steps"], ex))
    if w.get("generic"): parts.append('<p class="sub">For everyone else:</p>' + ol(w["generic"], ex))
    if w.get("new"):
        parts.append('<p class="sub">If the policy does not exist yet:</p>' + ol(w["new"], ex))
    if w.get("create"):
        parts.append('<p class="sub">Create:</p>' + ol(w["create"], ex))
    if w.get("fallback"):
        fb = w["fallback"]; parts.append('<p class="sub">' + esc(fb["when"]) + '</p>' + ol(fb["steps"], ex))
    if w.get("correct"):
        parts.append('<p class="sub">Correct (when it already exists):</p>' + ol(w["correct"], ex))
    if w.get("checkFixes"):
        fails = ex.get("failingChecks", [])
        lines = []
        for cid, vals in fails:
            e2 = dict(ex); e2.update(vals)
            lines.append(fill(w["checkFixes"][cid], e2))
        parts.append('<p class="sub">Failing checks, each with its fix:</p><ol>' + "".join(f"<li>{l}</li>" for l in lines) + "</ol>")
        parts.append('<details class="allchecks"><summary>Every check this step can raise (' + str(len(w["checkFixes"])) + ')</summary><ul>' +
                     "".join(f"<li>{fill(v, {})}</li>" for v in w["checkFixes"].values()) + "</ul></details>")
    if kind == "policy":
        parts.append('<div class="tabs"><span class="tab on">Portal steps</span><span class="tab">JSON</span><span class="tab">PowerShell</span></div>' + btn("Download JSON"))
    # Dates
    if st.get("dates"):
        parts.append(h("Dates")); parts.append(p(st["dates"], ex))
    # Done when
    parts.append(h("Done when"))
    parts.append(done_when(st.get("doneWhen") or [], ex))
    # If it goes wrong
    if st.get("ifWrong"):
        parts.append(h("If it goes wrong")); parts.append(p(st["ifWrong"], ex))
    if st.get("lockedOut"):
        lo = st["lockedOut"]; parts.append(h(lo["label"])); parts.append(ol(lo["steps"], ex))
    # Comms
    cm = st.get("comms")
    if cm:
        parts.append(h("Tell your people"))
        body = f'<p>{esc(cm["salutation"])}</p><p>{fill(cm["body"], ex)}</p><p>{fill(cm["signature"], ex)}</p>'
        parts.append(f'<div class="copybox"><span class="copy">Copy</span>{body}</div>')
        if cm.get("adminBody"):
            parts.append(f'<div class="copybox"><span class="copy">Copy</span><p>{esc("Admins,")}</p><p>{fill(cm["adminBody"], ex)}</p><p>{fill(cm["signature"], ex)}</p></div>')
        parts.append(f'<p class="adapt">{esc(S["adaptLine"])}</p>')
    # Controls
    ctrls = []
    if st.get("doesntApply"): ctrls.append(btn(S["doesntApplyControl"]))
    if st.get("scanControl"): ctrls.append(btn(S["scanControl"], primary=True))
    if ctrls: parts.append('<div class="controls">' + " ".join(ctrls) + "</div>")
    # More
    m = st.get("more") or {}
    parts.append('<details class="more" open><summary>More</summary>')
    risks = m.get("risks") or []
    if risks:
        parts.append(h("What could go wrong"))
        ap = [r for r in risks if r["applies"] == "always" or ex.get(r["applies"])]
        rest = [r for r in risks if r not in ap]
        if ap: parts.append("<ul>" + "".join(f'<li>{fill(r["text"], ex)} <span class="chip applies">applies here</span></li>' for r in ap) + "</ul>")
        if rest: parts.append('<p class="sub">Also possible</p><ul>' + "".join(f'<li>{fill(r["text"], ex)}</li>' for r in rest) + "</ul>")
    if m.get("waits"): parts.append(h("What waits on this")); parts.append(p(m["waits"], ex))
    if m.get("helpDesk"): parts.append(h("For the help desk")); parts.append(ul(m["helpDesk"], ex))
    if m.get("manager"): parts.append(h("For your manager")); parts.append(p(m["manager"], ex))
    mb = [btn("Copy as prompt")]
    if st.get("skip"): mb.append(btn("Skip this step"))
    parts.append('<div class="controls">' + " ".join(mb) + "</div></details>")
    parts.append("</div>")
    return '<section class="step">' + "".join(parts) + "</section>"

def render_cleanup(key, c):
    parts = [f'<div class="steprow"><span class="chip status">Ready</span><span class="title">{esc(c["title"])}</span></div><div class="stepbody">']
    parts.append(h("Why") + p(c["why"], {}))
    parts.append(h("What to do") + ol(c["whatToDo"], {"emergencyAccountUpns": ["breakglass@getiamai.onmicrosoft.com", "emergency2@getiamai.onmicrosoft.com"], "renames": ["ACME - APP - BLOCK - Copilot → Core - Block - Copilot"], "convention": "Core - Verb - Subject", "overlaps": ["Core - Allow - MFA for Admins", "Core - Require - Phishing-resistant MFA for admins"], "policies": ["IAC - AGENT - BLOCK - HighRiskAgent", "IAC - AGENT - BLOCK - NonTrustedAgents"]}))
    parts.append(h("Done when") + ul(c["doneWhen"], {"convention": "Core - Verb - Subject"}))
    parts.append('<div class="controls">' + btn(S["scanControl"], True) + "</div></div>")
    return '<section class="step">' + "".join(parts) + "</section>"

def kv(label, val, ex=None):
    return f'<div class="kv"><div class="k">{esc(label)}</div><div class="val">{fill(val, ex or {}) if isinstance(val,str) else val}</div></div>'

def render_pages():
    P = C["pages"]; out = []
    ex_t = {"tenant": "GetIAMAI", "upn": "Lachlan@getiamai.com", "baselineName": "Jon Hope — Defense in Depth", "policyCount": 46, "people": 12, "policies": 10, "from": "Aug 1", "to": "Aug 31", "emergencyAccounts": ["Breakglass"], "signals": "name, Global Administrator, excluded from 9 policies", "exclusionsGroup": "Breakglass Exclusion", "n": 9, "total": 10, "countries": "the United States", "trustedLocations": [], "serviceAccounts": [], "sharedDevices": [], "timezone": "America/Denver", "lane": "Reading sign-in records", "done": 3, "steps": 31, "inPlace": 7, "finish": "Sun Sep 27", "weeks": "4 weeks", "age": "17h ago", "active": 4, "enabled": 12, "admins": 3, "pct": "50%", "date": "Sep 1, 2026", "blocker": "Create or Correct Emergency Access Accounts", "constraint": "two changes prompt the same people, so Require a Fresh Sign-in for Intune Enrollment cannot enforce in the same window as Block Unsupported Device Platforms", "stepTitle": "Define the Trusted Network", "reason": "fully remote, no office network", "licence": "Microsoft Entra ID P2", "policy": "Monitor Kaladin using Forms", "verdict": "fine to keep", "proposed": "Core - Block - Copilot", "current": "weekly", "wanted": "4 hours", "name": "Phase 1", "start": "Sep 8", "end": "Sep 13", "measure": "MFA readiness", "threshold": "90%", "value": "50%", "thing": "emergency access accounts", "have": 1}
    def sec(title, body): out.append(f'<section class="page"><h3>{esc(title)}</h3>{body}</section>')
    o = P["opener"]
    sec("The opener (signed out)",
        f'<h2 class="h1">{esc(o["h1"])}</h2>' + p(o["intro"], {}) + h(o["builtForLabel"]) + p(o["builtFor"], {}) + h(o["catchesLabel"]) + ul(o["catches"], {})
        + btn(o["signIn"], True) + f'<details><summary>{esc(o["permissionsSummary"])}</summary><p class="sub">(the six-row permissions table, unchanged)</p><p>{esc(o["permissionsNote"])}</p>{h(o["removingLabel"])}{ol(o["removing"], {})}</details>'
        + '<p>' + " &nbsp;·&nbsp; ".join(f'<a>{esc(l)}</a>' for l in o["links"]) + '</p>' + f'<div class="tip">{esc(o["tip"])}<span class="q">?</span></div>')
    c = P["connectNoScan"]
    sec("Connect (signed in, no scan)", f'<h2 class="h1">{esc(c["h1"])}</h2>' + p(c["signedIn"], ex_t) + p(c["baselineLine"], ex_t) + p(c["baselineWhat"], ex_t) + p(c["baselineHow"], ex_t) + btn(c["scanButton"], True) + p(c["scanNote"], {}) + p(c["baselineUpdated"], {"date": "Aug 28, 2026", "n": 3}, "sub") + p(c["baselineUpdatedNote"], {}, "sub") + f'<p class="sub">While scanning: <span class="progress">{fill(c["scanning"], {"lane": "Reading sign-in records", "done": 3, "total": 8})}</span> {btn(c["stop"])}</p>')
    t = P["tenant"]
    found = t["found"]
    rows = [fill(found["emergency"], ex_t), fill(found["exclusions"], ex_t), fill(found["trustedNone"], ex_t), fill(found["countries"], ex_t), fill(found["serviceAccountsNone"], ex_t), fill(found["sharedDevicesNone"], ex_t), fill(found["window"], ex_t), fill(found["timezone"], ex_t)]
    sec("The tenant page (scanned)", f'<h2 class="h1">{esc(t["h1"])}</h2>' + p(t["scanLine"], ex_t) + h(t["foundLabel"]) + '<div class="found">' + "".join(f'<div class="frow"><p>{r}</p></div>' for r in rows) + '</div>' + btn(t["open"], True) + f'<div class="tip">{esc(t["tip"])}<span class="q">?</span></div>')
    pl = P["plan"]
    s = pl["settings"]
    sec("Plan header, settings, blocked reasons, footer",
        f'<h2 class="h1">{esc(pl["h1"])}</h2>' + p(pl["line1"], ex_t) + p(pl["line2"], ex_t) + f'<p class="sub">If it cannot finish: {fill(pl["line1CannotFinish"], ex_t)}</p><p class="sub">Length tooltip: {fill(pl["lengthTip"], ex_t)}</p>'
        + f'<p class="sub">Phase heading: <b>{fill(C["phases"]["heading"], ex_t)}</b> — first phase <b>{esc(C["phases"]["first"])}</b>, last <b>{esc(C["phases"]["last"])}</b></p>'
        + '<div class="settings"><b>' + esc(s["h3"]) + '</b>' + kv(s["start"], "[date]  " + s["startNote"]) + kv(s["freeze"], f'{s["freezeFrom"]} [date] {s["freezeTo"]} [date]  {s["freezeNote"]}') + kv(s["timezone"], "America/Denver") + kv(s["signature"], "IT") + btn(s["close"]) + '</div>'
        + h("Blocked reasons (one per row)") + ul([pl["blocked"]["after"], pl["blocked"]["readiness"], pl["blocked"]["count"]], ex_t)
        + h("Gap suffix on a partly-in-place row") + ul([pl["gapSuffix"]["admin-session"]], ex_t)
        + h("Footer groups") + ul([pl["footer"]["inPlace"], pl["footer"]["doesntApply"] + " — " + pl["footer"]["doesntApplyRow"], pl["footer"]["notLicensed"] + " — " + pl["footer"]["notLicensedRow"] + " — " + pl["footer"]["notLicensedNote"], pl["footer"]["housekeeping"] + " — " + pl["footer"]["notInBaseline"] + " · " + pl["footer"]["rename"]], ex_t)
        + f'<div class="tip">{esc(pl["tip"])}<span class="q">?</span></div>')
    td = P["today"]
    tiles = "".join(f'<div class="tile"><div class="tv">{fill(v["value"], ex_t)}</div><div class="tl">{esc(v["label"])}</div>' + (f'<div class="held">{esc(v["heldBy"])}</div>' if v["heldBy"] else "") + f'<div class="ttip">{esc(v["tip"])}</div></div>' for v in td["tiles"].values())
    sec("Today", f'<h2 class="h1">{esc(td["h1"])}</h2>' + p(td["purpose"], {}) + p(td["line"], ex_t) + f'<div class="tiles">{tiles}</div>' + f'<p class="sub">Show: {" · ".join(td["show"])}</p>' + h("State definitions") + "<ul>" + "".join(f"<li><b>{esc(k)}</b> — {esc(v)}</li>" for k, v in td["states"].items()) + "</ul>" + h("Method definitions") + "<ul>" + "".join(f"<li><b>{esc(k)}</b> — {esc(v)}</li>" for k, v in td["methods"].items()) + "</ul>" + f'<div class="tip">{esc(td["tip"])}<span class="q">?</span></div>')
    ex_p = P["export"]
    sec("Export and print page 1", "".join(f'<div class="card"><b>{esc(v[0])}</b><p>{esc(v[1])}</p><p class="sub">{esc(v[2])}</p></div>' for v in ex_p["cards"].values()) + h("Print page 1") + ul([ex_p["printPage1"]["title"], ex_p["printPage1"]["inPlace"], ex_p["printPage1"]["toDo"], ex_p["printPage1"]["doesntApply"], ex_p["printPage1"]["notLicensed"]], {"tenant": "GetIAMAI", "date": "September 1, 2026", "n": 7, "finish": "September 27"}) + f'<div class="tip">{esc(ex_p["tip"])}<span class="q">?</span></div>')
    sec("Footer, How IAMAI works, step tip", p(P["footer"]["readOnly"] + " · " + " · ".join(P["footer"]["links"]), {}) + h("How IAMAI works — reworded lines") + ul([P["how"]["exclusionsCheckReworded"], P["how"]["groupSearchReworded"], P["how"]["packageProblem"]], {"policy": "IAC - AGENT - BLOCK - HighRiskAgent"}) + p("Needs column now names the step: " + ", ".join(P["how"]["needsByStep"].values()), {}) + h("Tip on every step") + p(P["stepTip"], {}))
    return "".join(out)

CSS = """
:root{--ink:#1c1c1a;--muted:#5d5d58;--line:#dcdad3;--paper:#faf9f6;--raised:#f2f0ea;--accent:#0f5f57;--var:#0f5f57}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif}
main{max-width:760px;margin:0 auto;padding:40px 24px 80px}
h1,h2,h3,.title2{font-family:Iowan Old Style,Palatino Linotype,Georgia,serif;font-weight:400}
h1{font-size:30px;margin:0 0 6px}.lede{color:var(--muted);margin:0 0 24px}
h2.h1{font-size:26px;margin:0 0 8px}h3{font-size:22px;margin:0 0 12px}
h4{font-size:14px;margin:18px 0 4px;font-weight:600}
p{margin:6px 0}ol,ul{margin:6px 0 6px 22px;padding:0}li{margin:3px 0}
var{font-style:normal}.v{color:var(--var);text-decoration:underline dotted;text-underline-offset:3px}.v.miss{background:#ffe9c7}
.phase{background:var(--raised);border:1px solid var(--line);border-radius:8px;padding:14px 18px;margin:28px 0 10px}
.phase h3{margin:0}.step{border-bottom:1px solid var(--line);padding:10px 0 18px}
.steprow{display:flex;gap:12px;align-items:baseline;padding:6px 0}.steprow .title{font-weight:600}.lic{color:var(--muted);font-size:13px;margin-left:auto}
.stepbody{margin:8px 0 0 18px;padding:12px 16px;border-left:2px solid var(--line)}
.stephead .title2{font-size:17px}.change{color:var(--muted)}.partner{color:var(--accent);font-size:14px}
.chip{display:inline-block;font-size:12px;padding:1px 8px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--muted)}
.chip.status{color:var(--accent);border-color:var(--accent)}.chip.cis{margin-left:6px}.chip.applies{margin-left:6px;color:#8a4b00;border-color:#e0b27a}
.btn{display:inline-block;font-size:13px;padding:5px 12px;border:1px solid var(--line);border-radius:6px;background:#fff;margin:6px 6px 0 0}
.btn.primary{background:var(--accent);color:#fff;border-color:var(--accent)}
.controls{margin-top:12px}.learn{color:var(--accent)}a{color:var(--accent)}
.evidence{margin-left:0}.sub{color:var(--muted);font-size:13px}
.names{margin:4px 0 8px 22px}
.decision{border:1px solid var(--line);border-radius:8px;background:#fff;padding:10px 14px;margin:14px 0}
.dlabel{font-weight:600;margin-bottom:4px}.dlabel.q{margin-top:12px}.dhelp{color:var(--muted);font-size:13px;margin:2px 0 8px}
.picker label{display:block;margin:3px 0;font-size:14px}
.tabs{margin-top:8px}.tab{display:inline-block;padding:3px 10px;border-bottom:2px solid transparent;color:var(--muted);font-size:13px}.tab.on{border-color:var(--accent);color:var(--ink)}
.copybox{position:relative;border:1px solid var(--line);border-radius:8px;background:#fff;padding:12px 14px;margin:8px 0}
.copy{position:absolute;top:8px;right:10px;font-size:12px;border:1px solid var(--line);border-radius:5px;padding:1px 8px;background:var(--paper)}
.adapt{color:var(--muted);font-size:13px;margin-top:2px}
details.more{margin-top:14px;border-top:1px dashed var(--line);padding-top:6px}details.more summary{cursor:default;color:var(--muted)}
details.allchecks{margin:6px 0}details.allchecks summary{font-size:13px;color:var(--muted)}
.page{border:1px solid var(--line);border-radius:8px;background:#fff;padding:18px 22px;margin:22px 0}
.tip{border:1px solid var(--line);border-radius:8px;background:var(--raised);padding:8px 40px 8px 12px;font-size:13px;color:var(--muted);position:relative;margin:14px 0 0}
.tip .q{position:absolute;right:10px;top:7px;width:20px;height:20px;border-radius:10px;border:1px solid var(--line);text-align:center;line-height:18px;background:#fff;color:var(--ink)}
.found .frow{border-bottom:1px solid var(--line);padding:4px 0}.found .frow:last-child{border:0}
.tiles{display:flex;gap:18px;margin:12px 0}.tile{flex:1}.tv{font-family:Georgia,serif;font-size:22px}.tl{font-weight:600;font-size:13px}.held{font-size:12px;color:var(--muted)}.ttip{font-size:12px;color:var(--muted);margin-top:4px}
.settings{border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin:10px 0;background:#fff}.kv{display:flex;gap:12px;margin:6px 0}.k{width:130px;color:var(--muted);font-size:13px}.val{font-size:14px}
.card{border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin:8px 0;background:var(--raised)}
.legend{font-size:13px;color:var(--muted);border:1px solid var(--line);border-radius:8px;padding:8px 12px;background:#fff;margin-bottom:20px}
.index li{margin:2px 0}
"""

def main():
    steps = C["steps"]
    prep = [s for s in steps if s["kind"] in ("blocker","object","check","campaign")]
    pol = [s for s in steps if s["kind"] == "policy" and s["id"] != "s-shared-devices"]
    shared_dev = [s for s in steps if s["id"] == "s-shared-devices"]
    body = []
    body.append('<h1>IAMAI Planner — every sentence, for review</h1><p class="lede">One box per step in the order the plan shows them, then every non-step string. Nothing here works; only the words and their format are real. GetIAMAI names where GetIAMAI has the case, demo names where it does not.</p>')
    body.append('<div class="legend"><var class="v">Underlined green</var> is filled by the engine from the tenant; everything else is fixed text from the content file. Chips, buttons and pickers are drawn as they would appear. <var class="v miss">{orange}</var> marks a variable the example did not fill.</div>')
    body.append('<h3>Titles</h3><ol class="index">' + "".join(f'<li>{esc(s["title"])}' + (f' <span class="sub">— {esc(s["licence"])}</span>' if s.get("licence") else "") + '</li>' for s in prep + shared_dev + pol) + "".join(f'<li>{esc(c["title"])} <span class="sub">— Cleanup</span></li>' for c in C["cleanup"].values()) + "</ol>")
    body.append('<div class="phase"><h3>Preparation · Sep 1 → Sep 7</h3></div>')
    for s in prep + shared_dev: body.append(render_step(s))
    body.append('<div class="phase"><h3>Phase 1 · Sep 8 → Sep 13 &nbsp;/&nbsp; Phase 2 · Sep 15 → Sep 20 &nbsp;/&nbsp; Phase 3 · Sep 22 → Sep 27</h3><p class="sub">Policy steps, one box each; which phase a step lands in is the engine&#8217;s call.</p></div>')
    for s in pol: body.append(render_step(s))
    body.append('<div class="phase"><h3>Cleanup · after the last enforcement</h3></div>')
    for k, c in C["cleanup"].items(): body.append(render_cleanup(k, c))
    body.append('<h2 class="h1" style="margin-top:40px">Everything that is not a step</h2>')
    body.append(render_pages())
    html_out = f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>IAMAI Planner — wording review</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>{CSS}</style></head><body><main>{"".join(body)}</main></body></html>'
    open(sys.argv[2], "w").write(html_out)
    print("wrote", sys.argv[2], len(html_out))

main()
