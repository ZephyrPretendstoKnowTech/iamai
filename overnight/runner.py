#!/usr/bin/env python3
"""IAMAI Overnight Runner V3.2 — live incremental queue.

Lean coordination only: no branches, worktrees, merges, rebases, rollback, or
source repair. Claude Code owns edits/commit/push; this process owns durable
state, exact-SHA verification, bounded review/correction policy and reporting.
"""
from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import json
import hashlib
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Callable, Iterable

ROOT = Path(__file__).resolve().parents[1]
OVERNIGHT = ROOT / "overnight"
TASKS = OVERNIGHT / "tasks"
DRY_TASKS = OVERNIGHT / "dryrun_tasks"
RUNTIME = ROOT / ".overnight"
STATE_PATH = RUNTIME / "state.json"
GATE_PATH = RUNTIME / "dryrun-gate.json"
REPORT_PATH = RUNTIME / "OVERNIGHT-REPORT.md"
BUDGET_PATH = RUNTIME / "budget-ledger.json"
LOGS = RUNTIME / "logs"
REVIEWS = RUNTIME / "reviews"
CORRECTIONS = RUNTIME / "corrections"
CONTRACTS = RUNTIME / "contracts"
SESSION_PATH = RUNTIME / "session.json"
SESSIONS = RUNTIME / "sessions"
DISCOVERY_PATH = RUNTIME / "task-discovery.json"
CONFIG_PATH = OVERNIGHT / "CONFIG.json"
GLOBAL_PATH = OVERNIGHT / "GLOBAL_CONTRACT.md"
FROZEN_PATH = OVERNIGHT / "FROZEN_FOUNDATIONS.md"

SUCCESS = {"PASS", "PASS_WITH_NOTES"}
ACTIVE = {"CLAUDE_RUNNING", "CLAUDE_DONE", "REVIEWING", "CORRECTION_RUNNING"}
TERMINAL = {
    "PASS", "PASS_WITH_NOTES", "CLAUDE_FAILED", "CI_FAILED", "BLOCKED",
    "REVIEW_INCONCLUSIVE", "MANUAL_DECISION_REQUIRED",
}
SEVERITIES = {"BLOCKER", "MAJOR", "FUNCTIONAL", "CLEANUP"}
VERDICTS = {"PASS", "PASS_WITH_NOTES", "CORRECTION_REQUIRED", "BLOCKED"}
HANDOFF_STATUSES = {"DONE", "NO_CHANGE", "MANUAL_DECISION_REQUIRED", "FAILED"}
SHA_RE = re.compile(r"\b[0-9a-f]{40}\b", re.I)
HANDOFF_RE = re.compile(r"<handoff>\s*(\{.*?\})\s*</handoff>", re.S)

FROZEN_PROTECTED = {
    "src/roadmap/foundationA.test.ts",
    "src/roadmap/operations.ts",
    "src/roadmap/resolvePolicy.ts",
    "src/roadmap/foundationB.test.ts",
    "src/roadmap/lifecycle.ts",
    "src/roadmap/observation.ts",
    "src/roadmap/foundationC.test.ts",
    "src/mapping/safetyChoice.ts",
    "src/ui/surfaces/stepContract.ts",
    "src/ui/surfaces/StepSections.tsx",
    "src/ui/surfaces/stepContract.test.ts",
}
PIN_PROTECTED = {
    "baselines/jhope188-conditionalaccesspolicies.index.json",
    "baselines/jhope188-conditionalaccesspolicies.pinned.json",
}


class RunnerError(RuntimeError):
    pass


class ReviewFailure(RunnerError):
    pass


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(value, f, indent=2, sort_keys=True)
            f.write("\n")
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def write_text_atomic(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def config() -> dict[str, Any]:
    c = load_json(CONFIG_PATH)
    if os.getenv("IAMAI_OVERNIGHT_BUDGET_USD"):
        c["hard_budget_usd"] = float(os.environ["IAMAI_OVERNIGHT_BUDGET_USD"])
    if os.getenv("IAMAI_OPENAI_REVIEW_MODEL"):
        c["openai_review_model"] = os.environ["IAMAI_OPENAI_REVIEW_MODEL"]
    return c


def cmd(args: list[str], *, cwd: Path = ROOT, check: bool = True, timeout: float | None = 120,
        input_text: str | None = None) -> subprocess.CompletedProcess[str]:
    try:
        p = subprocess.run(args, cwd=cwd, text=True, input=input_text, capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired as e:
        raise RunnerError(f"command timed out: {' '.join(args)}") from e
    if check and p.returncode != 0:
        tail = (p.stderr or p.stdout or "").strip()[-3000:]
        raise RunnerError(f"command failed ({p.returncode}): {' '.join(args)}\n{tail}")
    return p


def git(*args: str, check: bool = True, timeout: float | None = 120) -> str:
    return cmd(["git", *args], check=check, timeout=timeout).stdout.strip()


def gh_json(args: list[str], *, timeout: float = 120) -> Any:
    p = cmd(["gh", *args], timeout=timeout)
    text = p.stdout.strip()
    return json.loads(text) if text else None


def current_head() -> str:
    return git("rev-parse", "HEAD")


def current_branch() -> str:
    return git("branch", "--show-current")


def dirty_paths() -> list[str]:
    out = git("status", "--porcelain", "--untracked-files=all")
    return [line for line in out.splitlines() if line.strip()]


def fetch_main() -> None:
    git("fetch", "--quiet", "origin", "main", timeout=180)


def origin_main() -> str:
    return git("rev-parse", "origin/main")


def changed_paths(base: str, head: str) -> list[str]:
    if base == head:
        return []
    out = git("diff", "--name-only", f"{base}..{head}")
    return [p for p in out.splitlines() if p]


def exact_diff(base: str, head: str, limit: int, *, context_lines: int = 80) -> str:
    if base == head:
        return "(no diff; audit reported NO_CHANGE)"
    text = git("diff", "--no-ext-diff", f"--unified={context_lines}", f"{base}..{head}", timeout=180)
    if len(text.encode("utf-8")) > limit:
        raise RunnerError(f"task diff is {len(text.encode('utf-8'))} bytes; exceeds configured bounded review limit {limit}")
    return text


@dataclasses.dataclass(frozen=True)
class Task:
    id: str
    path: Path
    meta: dict[str, Any]
    implement: str
    review: str
    contract_hash: str = ""
    source_path: Path | None = None

    @property
    def depends_on(self) -> list[str]:
        return list(self.meta.get("depends_on", []))

    @property
    def budget(self) -> float:
        return float(self.meta.get("task_budget_usd", 7.0))

    @property
    def max_corrections(self) -> int:
        return int(self.meta.get("max_corrections", 3))

    @property
    def max_review_retries(self) -> int:
        return int(self.meta.get("max_review_retries", 2))


@dataclasses.dataclass
class TaskDiscovery:
    valid: list[Task]
    incomplete: dict[str, str]
    settling: dict[str, str]
    invalid: dict[str, str]
    warnings: list[str]


def normalize_meta(raw: dict[str, Any]) -> dict[str, Any]:
    """Normalize a small set of harmless aliases while preserving the task contract."""
    if not isinstance(raw, dict):
        raise RunnerError("META.json must contain a JSON object")
    m = dict(raw)
    aliases = {
        "dependencies": "depends_on",
        "budget_usd": "task_budget_usd",
        "review_files": "relevant_files",
        "model": "claude_model",
        "effort": "claude_effort",
    }
    for old, new in aliases.items():
        if new not in m and old in m:
            m[new] = m[old]
    m.setdefault("depends_on", [])
    m.setdefault("risk", "normal")
    m.setdefault("max_corrections", 3)
    m.setdefault("max_review_retries", 2)
    m.setdefault("task_budget_usd", 7.0)
    m.setdefault("claude_model", "opus")
    m.setdefault("claude_effort", "high")
    m.setdefault("relevant_files", [])
    return m


def task_contract_hash(path: Path) -> str:
    h = hashlib.sha256()
    for name in ("META.json", "IMPLEMENT.md", "REVIEW.md"):
        data = (path / name).read_bytes()
        h.update(name.encode("utf-8"))
        h.update(b"\0")
        h.update(data)
        h.update(b"\0")
    return h.hexdigest()


def load_task_dir(path: Path, *, require_dir_match: bool = True, source_path: Path | None = None) -> Task:
    for name in ("META.json", "IMPLEMENT.md", "REVIEW.md"):
        if not (path / name).is_file():
            raise RunnerError(f"missing {path / name}")
    meta = normalize_meta(load_json(path / "META.json"))
    tid = meta.get("id")
    if not isinstance(tid, str) or not tid.strip():
        raise RunnerError(f"{path}: META id must be a non-empty string")
    if require_dir_match and tid != path.name:
        raise RunnerError(f"{path}: META id {tid!r} does not match directory name {path.name!r}")
    implement = (path / "IMPLEMENT.md").read_text(encoding="utf-8")
    review = (path / "REVIEW.md").read_text(encoding="utf-8")
    return Task(
        tid,
        path,
        meta,
        implement,
        review,
        contract_hash=task_contract_hash(path),
        source_path=source_path or path,
    )


def validate_tasks(tasks: list[Task], *, enforce_batch: bool = False, allow_unknown_dependencies: bool = True) -> list[str]:
    """Validate contracts without assuming a fixed batch or total queue size."""
    errors: list[str] = []
    c = config()
    ids = [t.id for t in tasks]
    idset = set(ids)
    if len(ids) != len(idset):
        errors.append("duplicate task id")
    for t in tasks:
        m = t.meta
        if not re.fullmatch(r"\d{3,4}-[A-Za-z0-9][A-Za-z0-9._-]*", t.id):
            # Synthetic dry-run ids are allowed outside the live inbox.
            if t.id not in {"pass", "correction"}:
                errors.append(f"{t.id}: id should look like 001-short-slug")
        if not isinstance(m.get("depends_on"), list) or not all(isinstance(x, str) and x for x in m.get("depends_on", [])):
            errors.append(f"{t.id}: depends_on must be an array of task-id strings")
        try:
            budget = float(m.get("task_budget_usd"))
        except (TypeError, ValueError):
            errors.append(f"{t.id}: task_budget_usd must be numeric")
            budget = 0.0
        if budget <= 0:
            errors.append(f"{t.id}: task_budget_usd must be positive")
        if budget <= float(c["review_reserve_usd"]):
            errors.append(
                f"{t.id}: budget ${budget:.2f} must exceed reviewer reserve ${float(c['review_reserve_usd']):.2f}"
            )
        try:
            mc = int(m.get("max_corrections", 3))
            rr = int(m.get("max_review_retries", 2))
        except (TypeError, ValueError):
            errors.append(f"{t.id}: correction/review retry limits must be integers")
            mc, rr = -1, -1
        if mc < 0 or mc > 3:
            errors.append(f"{t.id}: max_corrections must be 0..3")
        if rr < 0 or rr > 5:
            errors.append(f"{t.id}: max_review_retries must be 0..5")
        if t.id in t.depends_on:
            errors.append(f"{t.id}: self dependency")
        if not allow_unknown_dependencies:
            unknown = [d for d in t.depends_on if d not in idset]
            if unknown:
                errors.append(f"{t.id}: unknown dependencies {unknown}")
        relevant = m.get("relevant_files", [])
        if not isinstance(relevant, list) or not all(isinstance(x, str) and x for x in relevant):
            errors.append(f"{t.id}: relevant_files must be an array of repo-relative strings")
        allowed = m.get("allowed_paths", [])
        if allowed and (not isinstance(allowed, list) or not all(isinstance(x, str) and x for x in allowed)):
            errors.append(f"{t.id}: allowed_paths must be an array of repo-relative strings")
        if len(t.implement.strip()) < 80:
            errors.append(f"{t.id}: IMPLEMENT.md is unexpectedly short")
        if len(t.review.strip()) < 80:
            errors.append(f"{t.id}: REVIEW.md is unexpectedly short")
        upper_review = t.review.upper()
        lower_review = t.review.lower()
        uses_global_severity = "global severity contract" in lower_review
        if not uses_global_severity:
            for severity in ("BLOCKER", "MAJOR", "FUNCTIONAL", "CLEANUP"):
                if severity not in upper_review:
                    errors.append(f"{t.id}: REVIEW.md must use {severity} or explicitly invoke the global severity contract")
        if "CLEANUP" in upper_review or uses_global_severity:
            cleanup_nonblocking = any(
                phrase in lower_review
                for phrase in (
                    "does not block", "must not block", "never blocks", "non-blocking", "cannot block",
                    "must not cause correction", "cannot cause correction", "does not cause correction"
                )
            )
            if not cleanup_nonblocking and not uses_global_severity:
                errors.append(f"{t.id}: REVIEW.md must explicitly keep CLEANUP non-blocking/non-corrective")
        declared_bytes = 0
        for rel in relevant if isinstance(relevant, list) else []:
            source = ROOT / rel
            if source.is_file():
                size = source.stat().st_size
                declared_bytes += size
                if size > int(c["max_relevant_file_bytes"]):
                    errors.append(
                        f"{t.id}: relevant file {rel} is {size} bytes, over per-file review cap {c['max_relevant_file_bytes']}"
                    )
        if declared_bytes > int(c["max_declared_source_bytes"]):
            errors.append(
                f"{t.id}: declared reviewer source bundle is {declared_bytes} bytes, over cap {c['max_declared_source_bytes']}"
            )
    return errors


def dependency_cycle_warnings(tasks: list[Task]) -> list[str]:
    graph = {t.id: [d for d in t.depends_on if d in {x.id for x in tasks}] for t in tasks}
    warnings: list[str] = []
    visiting: list[str] = []
    done: set[str] = set()

    def visit(n: str) -> None:
        if n in visiting:
            cycle = visiting[visiting.index(n):] + [n]
            msg = "dependency cycle: " + " -> ".join(cycle)
            if msg not in warnings:
                warnings.append(msg)
            return
        if n in done:
            return
        visiting.append(n)
        for d in graph.get(n, []):
            visit(d)
        visiting.pop()
        done.add(n)

    for n in graph:
        visit(n)
    return warnings


def discover_tasks(root: Path = TASKS) -> TaskDiscovery:
    valid: list[Task] = []
    incomplete: dict[str, str] = {}
    settling: dict[str, str] = {}
    invalid: dict[str, str] = {}
    warnings: list[str] = []
    if not root.exists():
        return TaskDiscovery(valid, incomplete, settling, invalid, [f"task inbox does not exist yet: {root}"])
    stability = max(0.0, float(config().get("task_stability_seconds", 15)))
    now_ts = time.time()
    required = ("META.json", "IMPLEMENT.md", "REVIEW.md")
    for path in sorted((p for p in root.iterdir() if p.is_dir()), key=lambda p: p.name.lower()):
        missing = [name for name in required if not (path / name).is_file()]
        if missing:
            incomplete[path.name] = "missing " + ", ".join(missing)
            continue
        try:
            latest = max((path / name).stat().st_mtime for name in required)
        except OSError as e:
            incomplete[path.name] = f"cannot stat task package: {e}"
            continue
        age = now_ts - latest
        if age < stability:
            settling[path.name] = f"files changed {age:.1f}s ago; waiting for {stability:.0f}s stability window"
            continue
        try:
            task = load_task_dir(path)
            errs = validate_tasks([task], allow_unknown_dependencies=True)
            if errs:
                invalid[path.name] = "; ".join(errs)
                continue
            valid.append(task)
            for rel in task.meta.get("relevant_files", []):
                source = ROOT / rel
                if not source.exists():
                    warnings.append(
                        f"{task.id}: declared relevant file does not exist yet: {rel} (allowed if an earlier task creates it)"
                    )
        except (RunnerError, json.JSONDecodeError, UnicodeDecodeError, OSError, ValueError) as e:
            invalid[path.name] = str(e)
    valid_ids = {t.id for t in valid}
    for t in valid:
        missing_deps = [d for d in t.depends_on if d not in valid_ids]
        if missing_deps:
            warnings.append(f"{t.id}: waiting for dependency package(s): {', '.join(missing_deps)}")
    warnings.extend(dependency_cycle_warnings(valid))
    return TaskDiscovery(valid, incomplete, settling, invalid, list(dict.fromkeys(warnings)))


def persist_discovery(d: TaskDiscovery) -> None:
    atomic_json(
        DISCOVERY_PATH,
        {
            "updated_at": now(),
            "valid": [t.id for t in d.valid],
            "incomplete": d.incomplete,
            "settling": d.settling,
            "invalid": d.invalid,
            "warnings": d.warnings,
        },
    )


def load_tasks(root: Path = TASKS) -> list[Task]:
    return discover_tasks(root).valid


def lint_or_raise() -> list[Task]:
    d = discover_tasks()
    persist_discovery(d)
    errors: list[str] = []
    if not d.valid:
        errors.append("no stable, valid task package is currently available in overnight/tasks")

    for mode, expected_corrections in (("pass", 0), ("correction", 1)):
        path = DRY_TASKS / mode
        try:
            dry = load_task_dir(path)
        except (RunnerError, json.JSONDecodeError, UnicodeDecodeError) as e:
            errors.append(f"dryrun/{mode}: {e}")
            continue
        dry_errors = validate_tasks([dry], allow_unknown_dependencies=False)
        errors.extend(f"dryrun/{mode}: {e}" for e in dry_errors)
        if dry.id != mode:
            errors.append(f"dryrun/{mode}: id must be {mode!r}")
        if dry.max_corrections != expected_corrections:
            errors.append(f"dryrun/{mode}: max_corrections must be {expected_corrections}")

    if errors:
        raise RunnerError("task lint failed:\n- " + "\n- ".join(errors))
    return d.valid


def archive_current_session() -> None:
    if not SESSION_PATH.exists():
        return
    try:
        sess = load_json(SESSION_PATH)
        sid = str(sess.get("id") or "unknown-session")
        dest = SESSIONS / sid
        dest.mkdir(parents=True, exist_ok=True)
        for src in (SESSION_PATH, BUDGET_PATH, GATE_PATH, REPORT_PATH, DISCOVERY_PATH):
            if src.exists():
                shutil.copy2(src, dest / src.name)
    except Exception:
        # Archiving is diagnostic convenience, never a reason to corrupt/repair state.
        return


def start_new_session() -> dict[str, Any]:
    RUNTIME.mkdir(parents=True, exist_ok=True)
    if SESSION_PATH.exists():
        archive_current_session()
    sid = dt.datetime.now().astimezone().strftime("%Y%m%d-%H%M%S") + f"-{os.getpid()}"
    session = {
        "version": 1,
        "id": sid,
        "status": "OPEN",
        "started_at": now(),
        "updated_at": now(),
        "closed_at": None,
        "close_reason": None,
        "start_sha": current_head() if (ROOT / ".git").exists() else None,
    }
    atomic_json(SESSION_PATH, session)
    atomic_json(
        BUDGET_PATH,
        {"version": 2, "session_id": sid, "started_at": now(), "updated_at": now(), "spent_usd": 0.0, "entries": []},
    )
    if GATE_PATH.exists():
        GATE_PATH.unlink()
    return session


def ensure_session() -> dict[str, Any]:
    if SESSION_PATH.exists():
        session = load_json(SESSION_PATH)
        if session.get("status") == "OPEN":
            return session
    return start_new_session()


def close_session(reason: str) -> None:
    if not SESSION_PATH.exists():
        return
    session = load_json(SESSION_PATH)
    if session.get("status") != "OPEN":
        return
    session["status"] = "CLOSED"
    session["closed_at"] = now()
    session["updated_at"] = now()
    session["close_reason"] = reason
    atomic_json(SESSION_PATH, session)
    archive_current_session()


def force_new_session() -> dict[str, Any]:
    if STATE_PATH.exists():
        state = load_json(STATE_PATH)
        active = [tid for tid, item in state.get("tasks", {}).items() if item.get("status") in ACTIVE]
        if active:
            raise RunnerError("cannot start a new night while task state is active: " + ", ".join(active))
    if SESSION_PATH.exists():
        session = load_json(SESSION_PATH)
        if session.get("status") == "OPEN":
            close_session("manual-new-night")
    return start_new_session()


def night_budget() -> dict[str, Any]:
    session = ensure_session()
    if not BUDGET_PATH.exists():
        atomic_json(
            BUDGET_PATH,
            {"version": 2, "session_id": session["id"], "started_at": now(), "updated_at": now(), "spent_usd": 0.0, "entries": []},
        )
    value = load_json(BUDGET_PATH)
    if not isinstance(value, dict) or not isinstance(value.get("entries", []), list):
        raise RunnerError(f"invalid overnight budget ledger: {BUDGET_PATH.relative_to(ROOT)}")
    if value.get("session_id") != session.get("id"):
        raise RunnerError("budget ledger belongs to a different session; run `new-night` or inspect .overnight state")
    return value


def night_spent_usd() -> float:
    return float(night_budget().get("spent_usd", 0.0))


def record_night_spend(tid: str, amount: float, kind: str) -> float:
    amount = max(0.0, float(amount))
    ledger = night_budget()
    total = round(float(ledger.get("spent_usd", 0.0)) + amount, 6)
    ledger["spent_usd"] = total
    ledger["updated_at"] = now()
    ledger.setdefault("entries", []).append(
        {"at": now(), "task": tid, "kind": kind, "amount_usd": round(amount, 6)}
    )
    atomic_json(BUDGET_PATH, ledger)
    return total


def fresh_task_state() -> dict[str, Any]:
    return {
        "status": "PENDING",
        "base_sha": None,
        "head_sha": None,
        "corrections": 0,
        "review_attempts": 0,
        "spent_usd": 0.0,
        "claude_spent_usd": 0.0,
        "openai_spent_usd": 0.0,
        "handoffs": [],
        "reviews": [],
        "ci": [],
        "notes": [],
        "started_at": None,
        "finished_at": None,
        "contract_hash": None,
        "snapshot_path": None,
        "source_path": None,
    }


def fresh_state(tasks: list[Task], start_sha: str, *, initial_spent_usd: float = 0.0) -> dict[str, Any]:
    session = ensure_session()
    return {
        "version": 2,
        "created_at": now(),
        "updated_at": now(),
        "start_sha": start_sha,
        "end_sha": start_sha,
        "session_id": session["id"],
        "session_started_at": session["started_at"],
        "session_start_sha": start_sha,
        "spent_usd": round(float(initial_spent_usd), 6),
        "prequeue_spent_usd": round(float(initial_spent_usd), 6),
        "hard_budget_usd": float(config()["hard_budget_usd"]),
        "tasks": {t.id: fresh_task_state() for t in tasks},
        "discovery": {},
    }


def sync_tasks_into_state(s: dict[str, Any], tasks: list[Task]) -> None:
    s.setdefault("tasks", {})
    for t in tasks:
        item = s["tasks"].setdefault(t.id, fresh_task_state())
        if item.get("status") in SUCCESS and item.get("contract_hash") and item.get("contract_hash") != t.contract_hash:
            note = (
                f"Contract changed after successful completion; completed task remains immutable. "
                f"Stored={item.get('contract_hash')[:12]} current={t.contract_hash[:12]}. Create a new task id for new work."
            )
            if note not in item.setdefault("notes", []):
                item["notes"].append(note)


def load_state(tasks: list[Task]) -> dict[str, Any]:
    session = ensure_session()
    spent = night_spent_usd()
    if not STATE_PATH.exists():
        s = fresh_state(tasks, current_head(), initial_spent_usd=spent)
        return s
    s = load_json(STATE_PATH)
    if not isinstance(s, dict) or not isinstance(s.get("tasks", {}), dict):
        raise RunnerError("invalid .overnight/state.json")
    prior_session = s.get("session_id")
    s["version"] = 2
    s["session_id"] = session["id"]
    s["session_started_at"] = session["started_at"]
    s["spent_usd"] = round(spent, 6)
    s["hard_budget_usd"] = float(config()["hard_budget_usd"])
    if prior_session != session["id"]:
        s["session_start_sha"] = current_head()
        s["prequeue_spent_usd"] = round(spent, 6)
    sync_tasks_into_state(s, tasks)
    return s


def save_state(s: dict[str, Any]) -> None:
    s["updated_at"] = now()
    try:
        s["end_sha"] = current_head()
    except Exception:
        pass
    atomic_json(STATE_PATH, s)
    write_report(s)


def transition(s: dict[str, Any], tid: str, status: str, **fields: Any) -> None:
    item = s["tasks"][tid]
    item["status"] = status
    item.update(fields)
    if status in TERMINAL:
        item["finished_at"] = now()
    save_state(s)


def spend(s: dict[str, Any], tid: str, amount: float, kind: str) -> None:
    amount = max(0.0, float(amount))
    s["spent_usd"] = record_night_spend(tid, amount, kind)
    item = s["tasks"][tid]
    item["spent_usd"] = round(float(item.get("spent_usd", 0)) + amount, 6)
    key = "claude_spent_usd" if kind == "claude" else "openai_spent_usd"
    item[key] = round(float(item.get(key, 0)) + amount, 6)
    save_state(s)


def remaining_budget(s: dict[str, Any], task: Task) -> float:
    global_remaining = float(s["hard_budget_usd"]) - float(s.get("spent_usd", 0))
    task_remaining = task.budget - float(s["tasks"][task.id].get("spent_usd", 0))
    return max(0.0, min(global_remaining, task_remaining))


def claude_budget(s: dict[str, Any], task: Task) -> float:
    """Budget available to one Claude pass while preserving a real Sol review."""
    remaining = remaining_budget(s, task)
    reserve = float(config()["review_reserve_usd"])
    available = remaining - reserve
    if available <= 0:
        raise RunnerError(
            f"{task.id}: ${remaining:.2f} remains, which is not enough to preserve the ${reserve:.2f} reviewer reserve"
        )
    return min(available, float(config()["claude_max_per_call_usd"]))


def estimated_review_cost(prompt: str) -> float:
    """Conservative pre-call estimate used only as a hard-budget guard."""
    c = config()
    chars_per_token = max(1.0, float(c["review_token_estimate_chars"]))
    input_tokens = len(prompt.encode("utf-8")) / chars_per_token
    output_tokens = float(c["openai_max_output_tokens"])
    input_rate = float(c["openai_input_usd_per_mtok"])
    output_rate = float(c["openai_output_usd_per_mtok"])
    if input_tokens > float(c["openai_long_context_threshold_tokens"]):
        input_rate *= float(c["openai_long_context_input_multiplier"])
        output_rate *= float(c["openai_long_context_output_multiplier"])
    return input_tokens / 1_000_000 * input_rate + output_tokens / 1_000_000 * output_rate

REVIEW_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "verdict": {"type": "string", "enum": sorted(VERDICTS)},
        "summary": {"type": "string"},
        "manual_decision_required": {"type": "boolean"},
        "primary_outcome_broken": {"type": "boolean"},
        "manual_decision": {"type": ["string", "null"]},
        "needs_more_context": {"type": "boolean"},
        "requested_paths": {"type": "array", "items": {"type": "string"}, "maxItems": 8},
        "findings": {
            "type": "array",
            "maxItems": 20,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "severity": {"type": "string", "enum": sorted(SEVERITIES)},
                    "title": {"type": "string"},
                    "user_impact": {"type": "string"},
                    "evidence": {"type": "string"},
                    "paths": {"type": "array", "items": {"type": "string"}, "maxItems": 8},
                    "required_change": {"type": "string"},
                },
                "required": ["severity", "title", "user_impact", "evidence", "paths", "required_change"],
            },
        },
        "notes": {"type": "array", "items": {"type": "string"}, "maxItems": 20},
    },
    "required": ["verdict", "summary", "manual_decision_required", "primary_outcome_broken", "manual_decision", "needs_more_context", "requested_paths", "findings", "notes"],
}


def api_request(payload: dict[str, Any], timeout: int) -> tuple[dict[str, Any], dict[str, str]]:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key or key.lower() in {"placeholder", "changeme"}:
        raise ReviewFailure("OPENAI_API_KEY missing or placeholder")
    req = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "X-Client-Request-Id": f"iamai-overnight-{int(time.time() * 1000)}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            headers = {k.lower(): v for k, v in resp.headers.items()}
            return json.loads(resp.read().decode("utf-8")), headers
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise ReviewFailure(f"OpenAI HTTP {e.code}: {body[-2500:]}") from e
    except (urllib.error.URLError, TimeoutError) as e:
        raise ReviewFailure(f"OpenAI request failed: {e}") from e


def output_text(response: dict[str, Any]) -> str:
    parts: list[str] = []
    for item in response.get("output", []):
        if item.get("type") != "message":
            continue
        for part in item.get("content", []):
            if part.get("type") == "output_text" and isinstance(part.get("text"), str):
                parts.append(part["text"])
    if not parts and isinstance(response.get("output_text"), str):
        parts.append(response["output_text"])
    return "".join(parts)


def openai_cost(response: dict[str, Any]) -> float:
    usage = response.get("usage") or {}
    inp = float(usage.get("input_tokens", 0) or 0)
    out = float(usage.get("output_tokens", 0) or 0)
    c = config()
    input_rate = float(c["openai_input_usd_per_mtok"])
    output_rate = float(c["openai_output_usd_per_mtok"])
    if inp > float(c["openai_long_context_threshold_tokens"]):
        input_rate *= float(c["openai_long_context_input_multiplier"])
        output_rate *= float(c["openai_long_context_output_multiplier"])
    # Treat all input as uncached. That can only overestimate cost.
    return inp / 1_000_000 * input_rate + out / 1_000_000 * output_rate


def validate_openai() -> float:
    c = config()
    payload = {
        "model": c["openai_review_model"],
        "store": False,
        "reasoning": {"effort": "none"},
        "max_output_tokens": 16,
        "input": "Reply with exactly OK.",
    }
    response, _ = api_request(payload, min(60, int(c["review_timeout_seconds"])))
    if response.get("status") not in {"completed", None}:
        raise RunnerError(f"OpenAI validation did not complete: {response.get('status')}")
    if not output_text(response).strip():
        raise RunnerError("OpenAI validation returned no text")
    return openai_cost(response)


def safe_read_repo_path(rel: str, max_bytes: int) -> str:
    p = (ROOT / rel).resolve()
    try:
        p.relative_to(ROOT.resolve())
    except ValueError as e:
        raise RunnerError(f"reviewer requested path outside repo: {rel}") from e
    if not p.is_file():
        raise RunnerError(f"reviewer requested missing/non-file path: {rel}")
    data = p.read_bytes()
    if len(data) > max_bytes:
        raise RunnerError(f"reviewer requested oversized file ({len(data)} bytes): {rel}")
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        raise RunnerError(f"reviewer requested non-text file: {rel}")


def relevant_sources(task: Task, extras: Iterable[str] = ()) -> str:
    c = config()
    paths = list(dict.fromkeys([*task.meta.get("relevant_files", []), *extras]))
    chunks: list[str] = []
    for rel in paths:
        chunks.append(f"\n--- {rel} ---\n{safe_read_repo_path(rel, int(c['max_relevant_file_bytes']))}")
    return "".join(chunks)


def review_prompt(task: Task, *, base_sha: str, head_sha: str, handoff_text: str,
                  ci_record: dict[str, Any], correction_count: int, extras: Iterable[str] = (),
                  dryrun_mode: str | None = None, second_independent: bool = False,
                  compact: bool = False) -> str:
    c = config()
    diff = exact_diff(base_sha, head_sha, int(c["max_diff_bytes"]), context_lines=20 if compact else 80)
    global_contract = GLOBAL_PATH.read_text(encoding="utf-8")
    frozen = FROZEN_PATH.read_text(encoding="utf-8")
    control = ""
    if dryrun_mode == "correction":
        if correction_count == 0:
            control = """
SYNTHETIC CORRECTION HARNESS CONTROL:
This is not a code-quality finding. To prove the runner's correction state machine, your verdict on this first review MUST be CORRECTION_REQUIRED with exactly one FUNCTIONAL finding titled "Synthetic correction pass required". Its required change is: "Run the synthetic correction task's second Claude pass and create/push the requested second empty commit; do not change source files." Do not add any CLEANUP or other findings unless there is an actual BLOCKER in the harness itself.
"""
        else:
            control = """
SYNTHETIC CORRECTION HARNESS CONTROL:
This is the re-review after the runner has executed the required second Claude pass. If exact-SHA git/CI evidence is healthy and no tracked source file changed, PASS. Do not invent another correction.
"""
    independent = "This is an independent second review. Do not assume or defer to any prior reviewer result.\n" if second_independent else ""
    compact_note = "This is a fresh compacted retry after a reviewer/tool failure; the exact diff uses reduced context but no changed lines are omitted.\n" if compact else ""
    return f"""You are the independent IAMAI overnight task reviewer.
{compact_note}
{independent}
Your job is to protect end-user functionality and load-bearing security/data correctness without chasing perfection. Apply the severity contract exactly. CLEANUP can never block PASS. A FUNCTIONAL issue should cause correction only when it is real, task-scope, plausible for an end user, and reasonably bounded. Do not reopen frozen Foundations A/B/C/D.

{control}

=== GLOBAL CONTRACT ===
{global_contract}

=== FROZEN FOUNDATIONS ===
{frozen}

=== TASK REVIEW RUBRIC ===
{task.review}

=== REVIEW INSTANCE ===
Task: {task.id}
Base SHA: {base_sha}
Head SHA: {head_sha}
Correction count already completed: {correction_count}

=== CLAUDE HANDOFF ===
{handoff_text}

=== RUNNER EXACT-SHA CI EVIDENCE ===
{json.dumps(ci_record, indent=2, sort_keys=True)}

=== EXACT TASK DIFF ({base_sha}..{head_sha}) ===
{diff}

=== DECLARED RELEVANT SOURCE FILES ===
{relevant_sources(task, extras)}

Return only the structured review object. If you need more context, set needs_more_context=true and request only exact repo-relative text paths needed to decide; do that at most once. If enough context is present, needs_more_context=false.
"""


def normalize_review(review: dict[str, Any]) -> dict[str, Any]:
    findings = review.get("findings", [])
    sevs = {f.get("severity") for f in findings}
    verdict = review.get("verdict")
    # Machine-enforce the anti-perfection policy even if a reviewer slips.
    if verdict == "CORRECTION_REQUIRED" and sevs and sevs <= {"CLEANUP"}:
        review["verdict"] = "PASS_WITH_NOTES"
        review.setdefault("notes", []).append("Runner normalized a cleanup-only correction request to PASS_WITH_NOTES per global contract.")
    if sevs & {"BLOCKER", "MAJOR"}:
        review["verdict"] = "CORRECTION_REQUIRED"
    if review.get("manual_decision_required"):
        review["verdict"] = "BLOCKED"
    return review


def validate_review_semantics(review: dict[str, Any]) -> None:
    findings = list(review.get("findings") or [])
    actionable = [f for f in findings if f.get("severity") in {"BLOCKER", "MAJOR", "FUNCTIONAL"}]
    if review.get("verdict") == "CORRECTION_REQUIRED" and not actionable and not review.get("primary_outcome_broken"):
        raise ReviewFailure("reviewer requested correction without an actionable finding or broken primary outcome")
    if review.get("needs_more_context") and not review.get("requested_paths"):
        raise ReviewFailure("reviewer requested more context without exact paths")


def merge_reviews(primary: dict[str, Any], secondary: dict[str, Any]) -> dict[str, Any]:
    """Conservatively merge two independent completed reviews.

    The second review can add a load-bearing finding; it can never erase a real
    finding from the first review merely because the reviewers disagree.
    """
    merged = dict(primary)
    seen: set[tuple[str, str, str, str]] = set()
    findings: list[dict[str, Any]] = []
    for review in (primary, secondary):
        for finding in review.get("findings", []):
            key = (
                str(finding.get("severity", "")),
                str(finding.get("title", "")),
                str(finding.get("evidence", "")),
                str(finding.get("required_change", "")),
            )
            if key not in seen:
                seen.add(key)
                findings.append(finding)
    reviewer_notes = list(dict.fromkeys([
        *primary.get("notes", []),
        *secondary.get("notes", []),
    ]))
    notes = [*reviewer_notes, f"Independent second review verdict: {secondary.get('verdict')}"]
    merged.update({
        "findings": findings,
        "notes": notes,
        "manual_decision_required": bool(primary.get("manual_decision_required") or secondary.get("manual_decision_required")),
        "primary_outcome_broken": bool(primary.get("primary_outcome_broken") or secondary.get("primary_outcome_broken")),
        "manual_decision": primary.get("manual_decision") or secondary.get("manual_decision"),
        "needs_more_context": False,
        "requested_paths": [],
    })
    if merged["manual_decision_required"] or "BLOCKED" in {primary.get("verdict"), secondary.get("verdict")}:
        merged["verdict"] = "BLOCKED"
    else:
        sevs = {f.get("severity") for f in findings}
        if sevs & {"BLOCKER", "MAJOR"}:
            merged["verdict"] = "CORRECTION_REQUIRED"
        elif "CORRECTION_REQUIRED" in {primary.get("verdict"), secondary.get("verdict")}:
            merged["verdict"] = "CORRECTION_REQUIRED"
        elif "PASS_WITH_NOTES" in {primary.get("verdict"), secondary.get("verdict")} or reviewer_notes or findings:
            merged["verdict"] = "PASS_WITH_NOTES"
        else:
            merged["verdict"] = "PASS"
    merged["summary"] = f"Primary: {primary.get('summary', '')} | Independent: {secondary.get('summary', '')}".strip()
    merged = normalize_review(merged)
    validate_review_semantics(merged)
    return merged


def call_reviewer(task: Task, *, base_sha: str, head_sha: str, handoff_text: str,
                  ci_record: dict[str, Any], correction_count: int, extras: Iterable[str] = (),
                  dryrun_mode: str | None = None, second_independent: bool = False,
                  budget_limit: float | None = None, compact: bool = False) -> tuple[dict[str, Any], float, dict[str, Any]]:
    c = config()
    prompt = review_prompt(task, base_sha=base_sha, head_sha=head_sha, handoff_text=handoff_text,
                           ci_record=ci_record, correction_count=correction_count, extras=extras,
                           dryrun_mode=dryrun_mode, second_independent=second_independent, compact=compact)
    prompt_bytes = len(prompt.encode("utf-8"))
    if prompt_bytes > int(c["max_review_prompt_bytes"]):
        raise ReviewFailure(f"bounded review prompt is {prompt_bytes} bytes, over cap {c['max_review_prompt_bytes']}")
    estimated = estimated_review_cost(prompt)
    if budget_limit is not None and estimated > budget_limit:
        raise ReviewFailure(
            f"estimated review cost ${estimated:.2f} exceeds remaining task/global budget ${budget_limit:.2f}"
        )
    payload = {
        "model": c["openai_review_model"],
        "store": False,
        "reasoning": {"effort": c["openai_reasoning_effort"]},
        "max_output_tokens": int(c["openai_max_output_tokens"]),
        "input": prompt,
        "text": {
            "format": {
                "type": "json_schema",
                "name": "iamai_task_review",
                "description": "Bounded IAMAI overnight task review verdict and findings.",
                "strict": True,
                "schema": REVIEW_SCHEMA,
            }
        },
    }
    response, headers = api_request(payload, int(c["review_timeout_seconds"]))
    if response.get("status") != "completed":
        reason = (response.get("incomplete_details") or {}).get("reason") or response.get("error") or response.get("status")
        raise ReviewFailure(f"reviewer response did not complete: {reason}")
    text = output_text(response)
    try:
        review = json.loads(text)
    except json.JSONDecodeError as e:
        raise ReviewFailure(f"reviewer returned invalid JSON: {text[:1000]}") from e
    if review.get("verdict") not in VERDICTS:
        raise ReviewFailure(f"reviewer returned invalid verdict: {review.get('verdict')}")
    review = normalize_review(review)
    validate_review_semantics(review)
    raw = {"response_id": response.get("id"), "request_id": headers.get("x-request-id"), "usage": response.get("usage")}
    return review, openai_cost(response), raw

def parse_claude_output(raw: str) -> tuple[str, dict[str, Any] | None, float | None]:
    """Return result text, handoff object, and reported Claude cost."""
    text = raw.strip()
    cost: float | None = None
    result_text = text
    try:
        envelope = json.loads(text)
        if isinstance(envelope, dict):
            for key in ("total_cost_usd", "cost_usd"):
                if isinstance(envelope.get(key), (int, float)):
                    cost = float(envelope[key])
                    break
            if isinstance(envelope.get("result"), str):
                result_text = envelope["result"]
    except json.JSONDecodeError:
        pass
    m = HANDOFF_RE.search(result_text)
    handoff = None
    if m:
        try:
            handoff = json.loads(m.group(1))
        except json.JSONDecodeError:
            handoff = None
    return result_text, handoff, cost


def build_implementation_prompt(task: Task, base_sha: str) -> str:
    snapshot_rel = task.path.relative_to(ROOT).as_posix()
    return f"""You are executing exactly one IAMAI overnight task in a fresh Claude Code session.

Read `CLAUDE.md`, then `overnight/GLOBAL_CONTRACT.md`, `overnight/FROZEN_FOUNDATIONS.md`, and the snapshotted task contract below. The live inbox at `overnight/tasks/` may receive future tasks while you work. Do not edit that inbox, the runner, or any task contract. Your authoritative contract for this execution is the immutable snapshot at `{snapshot_rel}`.

Current runner-observed base SHA: {base_sha}
Task: {task.id}
Contract hash: {task.contract_hash}

=== TASK CONTRACT ===
{task.implement}

Implement only this task. Keep scope tight. End with the required `<handoff>` JSON from GLOBAL_CONTRACT.md. Do not claim reviewer approval.
"""


def build_correction_prompt(task: Task, base_sha: str, review: dict[str, Any], correction_number: int, *, dryrun_mode: str | None = None) -> str:
    findings = [f for f in review.get("findings", []) if f.get("severity") != "CLEANUP"]
    dry = ""
    if dryrun_mode == "correction":
        dry = """
This is the synthetic correction-path harness. Do not modify tracked source files. Create a second empty commit with message `chore: overnight runner correction dry run phase 2`, push it to main, verify exact-SHA CI/deploy, and return the normal handoff.
"""
    return f"""You are the correction pass for one IAMAI overnight task in a fresh Claude Code session.

Read `CLAUDE.md`, `overnight/GLOBAL_CONTRACT.md`, `overnight/FROZEN_FOUNDATIONS.md`, and the task contract at `{task.path.relative_to(ROOT).as_posix()}/IMPLEMENT.md`.

Runner-observed correction base SHA: {base_sha}
Task: {task.id}
Correction number: {correction_number} of {task.max_corrections}

{dry}
The independent reviewer returned these task-scope findings that are eligible for correction:
{json.dumps(findings, indent=2)}

Reviewer notes (do not turn CLEANUP into scope):
{json.dumps(review.get('notes', []), indent=2)}

Correct only the findings above. Preserve frozen Foundations A/B/C/D. Do not opportunistically refactor or polish unrelated code. Re-run the task validation and the common execution contract. End with the required `<handoff>` JSON. Do not claim reviewer approval.
"""


def run_claude(task: Task, prompt: str, budget: float) -> tuple[str, dict[str, Any] | None, float]:
    if budget <= 0:
        raise RunnerError(f"{task.id}: no remaining task/global budget for Claude")
    c = config()
    args = [
        "claude", "-p", "--output-format", "json",
        "--model", str(task.meta.get("claude_model", "opus")),
        "--effort", str(task.meta.get("claude_effort", "high")),
        "--permission-mode", "bypassPermissions",
        "--no-session-persistence",
        "--max-budget-usd", f"{budget:.2f}",
    ]
    p = cmd(args, cwd=ROOT, check=False, timeout=float(c["claude_timeout_minutes"]) * 60, input_text=prompt)
    raw = p.stdout if p.stdout.strip() else p.stderr
    result_text, handoff, reported_cost = parse_claude_output(raw)
    # If an older/variant CLI doesn't report cost, conservatively reserve the full cap.
    charged = reported_cost if reported_cost is not None else budget
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    LOGS.mkdir(parents=True, exist_ok=True)
    (LOGS / f"{task.id}-{stamp}-claude.json.txt").write_text(raw, encoding="utf-8")
    if p.returncode != 0:
        raise RunnerError(f"Claude Code failed ({p.returncode}) for {task.id}: {result_text[-2500:]}")
    return result_text, handoff, float(charged)


def validate_handoff(handoff: dict[str, Any] | None, expected_base: str) -> dict[str, Any]:
    if not isinstance(handoff, dict):
        raise RunnerError("Claude did not return the required valid <handoff> JSON block")
    required = {"status", "base_sha", "head_sha", "summary", "files_changed", "tests", "ci", "manual_decision", "deferred", "notes"}
    missing = sorted(required - set(handoff))
    if missing:
        raise RunnerError(f"Claude handoff missing required fields: {missing}")
    status = handoff.get("status")
    if status not in HANDOFF_STATUSES:
        raise RunnerError(f"Claude handoff status is invalid: {status!r}")
    base = handoff.get("base_sha")
    head = handoff.get("head_sha")
    if not isinstance(base, str) or not SHA_RE.fullmatch(base):
        raise RunnerError(f"Claude handoff base_sha is not a 40-character SHA: {base!r}")
    if not isinstance(head, str) or not SHA_RE.fullmatch(head):
        raise RunnerError(f"Claude handoff head_sha is not a 40-character SHA: {head!r}")
    if base.lower() != expected_base.lower():
        raise RunnerError(f"Claude handoff base_sha {base} != runner base {expected_base}")
    if not isinstance(handoff.get("summary"), str):
        raise RunnerError("Claude handoff summary must be a string")
    for key in ("files_changed", "tests", "deferred", "notes"):
        if not isinstance(handoff.get(key), list):
            raise RunnerError(f"Claude handoff {key} must be a list")
    if not all(isinstance(p, str) for p in handoff["files_changed"]):
        raise RunnerError("Claude handoff files_changed must contain only repo-relative strings")
    if not all(isinstance(v, str) for key in ("deferred", "notes") for v in handoff[key]):
        raise RunnerError("Claude handoff deferred/notes must contain only strings")
    for test in handoff["tests"]:
        if not isinstance(test, dict) or not {"command", "result", "detail"} <= set(test):
            raise RunnerError("Claude handoff tests must contain command/result/detail objects")
        if test.get("result") not in {"pass", "fail", "not_run"}:
            raise RunnerError(f"Claude handoff test result is invalid: {test.get('result')!r}")
    if not isinstance(handoff.get("ci"), dict):
        raise RunnerError("Claude handoff ci must be an object")
    if handoff.get("manual_decision") is not None and not isinstance(handoff.get("manual_decision"), str):
        raise RunnerError("Claude handoff manual_decision must be null or a string")
    return handoff


def handoff_status(handoff: dict[str, Any]) -> str:
    return str(handoff["status"])


def verify_git_after_claude(base_sha: str, handoff: dict[str, Any] | None) -> str:
    if dirty_paths():
        raise RunnerError("Claude returned with a dirty tracked/untracked working tree: " + "; ".join(dirty_paths()[:20]))
    if current_branch() != "main":
        raise RunnerError(f"Claude left branch {current_branch()!r}; expected main")
    head = current_head()
    fetch_main()
    remote = origin_main()
    if head != remote:
        raise RunnerError(f"local HEAD {head} != origin/main {remote} after Claude")
    if handoff:
        claimed = handoff.get("head_sha")
        if isinstance(claimed, str) and SHA_RE.fullmatch(claimed) and claimed.lower() != head.lower():
            raise RunnerError(f"Claude handoff head_sha {claimed} != verified HEAD {head}")
        status = handoff.get("status")
        if status == "NO_CHANGE" and head != base_sha:
            raise RunnerError(f"Claude reported NO_CHANGE but HEAD moved {base_sha} -> {head}")
        if status == "DONE" and head == base_sha and handoff.get("files_changed"):
            raise RunnerError("Claude reported changed files but HEAD did not move")
    return head


def wait_workflow(workflow: str, sha: str, required_jobs: list[str]) -> dict[str, Any]:
    c = config()
    deadline = time.time() + float(c["ci_timeout_minutes"]) * 60
    selected: dict[str, Any] | None = None
    while time.time() < deadline:
        runs = gh_json(["run", "list", "--workflow", workflow, "--commit", sha, "--limit", "10",
                        "--json", "databaseId,headSha,status,conclusion,name,url"]) or []
        exact = [r for r in runs if str(r.get("headSha", "")).lower() == sha.lower()]
        if exact:
            exact.sort(key=lambda r: int(r.get("databaseId", 0)), reverse=True)
            selected = exact[0]
            if selected.get("status") == "completed":
                break
        time.sleep(float(c["poll_seconds"]))
    if not selected:
        raise RunnerError(f"no exact-SHA {workflow} run appeared for {sha}")
    if selected.get("status") != "completed":
        raise RunnerError(f"{workflow} did not complete before timeout for {sha}")
    run_id = str(selected["databaseId"])
    detail = gh_json(["run", "view", run_id, "--json", "databaseId,headSha,status,conclusion,name,url,jobs"])
    if str(detail.get("headSha", "")).lower() != sha.lower():
        raise RunnerError(f"{workflow} run {run_id} belongs to {detail.get('headSha')}, not {sha}")
    if detail.get("conclusion") != "success":
        raise RunnerError(f"{workflow} run {run_id} concluded {detail.get('conclusion')}")
    jobs = {j.get("name"): j.get("conclusion") for j in detail.get("jobs", [])}
    missing = [name for name in required_jobs if jobs.get(name) != "success"]
    if missing:
        raise RunnerError(f"{workflow} run {run_id} required jobs not successful: {missing}; jobs={jobs}")
    return {
        "workflow": workflow,
        "run_id": run_id,
        "head_sha": sha,
        "conclusion": detail.get("conclusion"),
        "url": detail.get("url"),
        "jobs": jobs,
    }


def verify_ci(sha: str) -> dict[str, Any]:
    records: dict[str, Any] = {}
    for workflow, jobs in config()["required_workflows"].items():
        records[workflow] = wait_workflow(workflow, sha, list(jobs))
    # deploy-pages currently checks out `main` in its build job. The runner is
    # intentionally serial, so require main to have remained on the reviewed
    # SHA through both workflow completions; never approve a stale task after
    # an external/concurrent push moved main.
    fetch_main()
    remote = origin_main()
    if remote.lower() != sha.lower():
        raise RunnerError(f"origin/main moved to {remote} while verifying CI for {sha}")
    if current_head().lower() != sha.lower():
        raise RunnerError(f"local HEAD moved to {current_head()} while verifying CI for {sha}")
    return records


def review_with_retry(s: dict[str, Any], task: Task, *, base_sha: str, head_sha: str,
                      handoff_text: str, ci_record: dict[str, Any], correction_count: int,
                      dryrun_mode: str | None = None, second_independent: bool = False) -> dict[str, Any]:
    extras: list[str] = []
    context_requested = False
    failures = 0
    while True:
        if remaining_budget(s, task) <= 0:
            raise ReviewFailure(f"{task.id}: no budget remains for reviewer")
        try:
            review, cost, raw = call_reviewer(
                task, base_sha=base_sha, head_sha=head_sha, handoff_text=handoff_text,
                ci_record=ci_record, correction_count=correction_count, extras=extras,
                dryrun_mode=dryrun_mode, second_independent=second_independent,
                budget_limit=remaining_budget(s, task), compact=failures > 0,
            )
            spend(s, task.id, cost, "openai")
            item = s["tasks"][task.id]
            item["review_attempts"] = int(item.get("review_attempts", 0)) + 1
            stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S-%f")
            REVIEWS.mkdir(parents=True, exist_ok=True)
            atomic_json(REVIEWS / f"{task.id}-{stamp}.json", {"review": review, "api": raw})
            if review.get("needs_more_context"):
                if context_requested:
                    raise ReviewFailure("reviewer requested additional context more than once")
                requested = list(review.get("requested_paths") or [])
                if not requested:
                    raise ReviewFailure("reviewer set needs_more_context without paths")
                # Validate/read now; second call receives exact extras.
                for rel in requested:
                    safe_read_repo_path(rel, int(config()["max_relevant_file_bytes"]))
                extras.extend(requested)
                context_requested = True
                continue
            item["reviews"].append(review)
            save_state(s)
            return review
        except (ReviewFailure, json.JSONDecodeError, RunnerError) as e:
            failures += 1
            if failures > task.max_review_retries:
                raise ReviewFailure(f"review inconclusive after {failures} failed calls: {e}") from e
            time.sleep(min(5 * failures, 15))


def should_double_review(task: Task, review: dict[str, Any], correction_count: int,
                         correction_trigger_severities: Iterable[str] = ()) -> bool:
    sevs = {f.get("severity") for f in review.get("findings", [])}
    if sevs & {"BLOCKER", "MAJOR"}:
        return True
    if task.meta.get("double_review") is True:
        return True
    # V3.1 calls for a second independent review when a correction changed a
    # load-bearing security boundary, not after every minor correction on a
    # security-sensitive task. The triggering review is the evidence for that.
    trigger = set(correction_trigger_severities)
    if correction_count > 0 and task.meta.get("load_bearing_security") is True and trigger & {"BLOCKER", "MAJOR"}:
        return True
    return False


def correction_allowed(task: Task, review: dict[str, Any], completed: int) -> bool:
    if completed >= task.max_corrections:
        return False
    sevs = {f.get("severity") for f in review.get("findings", [])}
    if completed >= 2:
        if sevs & {"BLOCKER", "MAJOR"}:
            return True
        return bool(review.get("primary_outcome_broken", False))
    if sevs & {"BLOCKER", "MAJOR", "FUNCTIONAL"}:
        return True
    return False

def validate_changed_scope(task: Task, base_sha: str, head_sha: str, *, dryrun: bool = False) -> None:
    paths = changed_paths(base_sha, head_sha)
    if dryrun:
        if paths:
            raise RunnerError(f"synthetic dry run changed tracked files: {paths}")
        return
    bad_frozen = sorted(set(paths) & FROZEN_PROTECTED)
    if bad_frozen:
        raise RunnerError(f"{task.id} changed frozen Foundation source/test paths: {bad_frozen}")
    bad_pin = sorted(set(paths) & PIN_PROTECTED)
    if bad_pin:
        raise RunnerError(f"{task.id} changed pinned baseline automatically: {bad_pin}")
    overnight_changes = [p for p in paths if p.startswith("overnight/")]
    if overnight_changes:
        raise RunnerError(f"{task.id} changed overnight infrastructure during execution: {overnight_changes}")
    allowed = list(task.meta.get("allowed_paths", []))
    if allowed:
        outside = [p for p in paths if not any(p == a or p.startswith(a.rstrip("/") + "/") for a in allowed)]
        if outside:
            raise RunnerError(f"{task.id} changed paths outside task scope: {outside}")


def claim_task_contract(s: dict[str, Any], task: Task) -> Task:
    """Snapshot a stable live-inbox task before Claude sees it."""
    item = s["tasks"][task.id]
    existing_hash = item.get("contract_hash")
    existing_snapshot = item.get("snapshot_path")
    if existing_hash and existing_snapshot:
        snap_path = ROOT / existing_snapshot
        if not snap_path.is_dir():
            raise RunnerError(f"{task.id}: recorded contract snapshot is missing: {existing_snapshot}")
        snap = load_task_dir(snap_path, require_dir_match=False, source_path=task.source_path)
        if snap.contract_hash != existing_hash:
            raise RunnerError(f"{task.id}: recorded contract snapshot hash mismatch; manual inspection required")
        return snap

    source = task.source_path or task.path
    # Re-load immediately before claiming so a task cannot change between discovery and snapshot.
    latest = load_task_dir(source)
    errs = validate_tasks([latest], allow_unknown_dependencies=True)
    if errs:
        raise RunnerError(f"{task.id}: task changed before claim and is no longer valid: {'; '.join(errs)}")
    dest = CONTRACTS / task.id / latest.contract_hash
    if not dest.exists():
        tmp = CONTRACTS / task.id / (latest.contract_hash + f".tmp-{os.getpid()}")
        if tmp.exists():
            shutil.rmtree(tmp)
        tmp.mkdir(parents=True, exist_ok=False)
        try:
            for name in ("META.json", "IMPLEMENT.md", "REVIEW.md"):
                shutil.copy2(source / name, tmp / name)
            manifest = {
                "task_id": task.id,
                "contract_hash": latest.contract_hash,
                "claimed_at": now(),
                "source_path": str(source),
                "files": {
                    name: hashlib.sha256((tmp / name).read_bytes()).hexdigest()
                    for name in ("META.json", "IMPLEMENT.md", "REVIEW.md")
                },
            }
            atomic_json(tmp / "MANIFEST.json", manifest)
            dest.parent.mkdir(parents=True, exist_ok=True)
            os.replace(tmp, dest)
        finally:
            if tmp.exists():
                shutil.rmtree(tmp, ignore_errors=True)
    snap = load_task_dir(dest, require_dir_match=False, source_path=source)
    if snap.contract_hash != latest.contract_hash:
        raise RunnerError(f"{task.id}: contract snapshot did not preserve exact task bytes")
    item["contract_hash"] = latest.contract_hash
    item["snapshot_path"] = dest.relative_to(ROOT).as_posix()
    item["source_path"] = str(source)
    save_state(s)
    return snap


def run_one_task(s: dict[str, Any], task: Task, *, dryrun_mode: str | None = None) -> str:
    item = s["tasks"][task.id]
    original_base = current_head()
    item["base_sha"] = original_base
    item["started_at"] = now()
    transition(s, task.id, "CLAUDE_RUNNING")

    prompt = build_implementation_prompt(task, original_base)
    if dryrun_mode:
        prompt = task.implement.replace("{{BASE_SHA}}", original_base) + "\n\nEnd with the required `<handoff>` JSON from `overnight/GLOBAL_CONTRACT.md`.\n"
    try:
        handoff_text, handoff, cost = run_claude(task, prompt, claude_budget(s, task))
        spend(s, task.id, cost, "claude")
    except Exception as e:
        transition(s, task.id, "CLAUDE_FAILED", notes=[*item.get("notes", []), str(e)])
        return "CLAUDE_FAILED"

    try:
        handoff = validate_handoff(handoff, original_base)
    except Exception as e:
        item["handoffs"].append({"raw": handoff_text[-5000:]})
        transition(s, task.id, "CLAUDE_FAILED", notes=[*item.get("notes", []), str(e)])
        return "CLAUDE_FAILED"
    item["handoffs"].append(handoff)
    handoff_review_text = json.dumps(handoff, indent=2, sort_keys=True)
    status = handoff_status(handoff)
    if status == "FAILED":
        transition(s, task.id, "CLAUDE_FAILED", notes=[*item.get("notes", []), "Claude handoff reported FAILED"])
        return "CLAUDE_FAILED"
    if status == "MANUAL_DECISION_REQUIRED":
        # A manual-decision task must not leave unreviewed source changes behind.
        try:
            if dirty_paths() or current_branch() != "main":
                raise RunnerError("manual-decision handoff left the working tree/branch unsafe")
            if current_head() != original_base:
                raise RunnerError("manual-decision handoff moved HEAD; manual decisions must leave code unchanged")
        except Exception as e:
            transition(s, task.id, "CLAUDE_FAILED", notes=[*item.get("notes", []), str(e)])
            return "CLAUDE_FAILED"
        transition(s, task.id, "MANUAL_DECISION_REQUIRED",
                   notes=[*item.get("notes", []), (handoff or {}).get("manual_decision") or "Claude identified a manual decision"])
        return "MANUAL_DECISION_REQUIRED"
    try:
        head = verify_git_after_claude(original_base, handoff)
        validate_changed_scope(task, original_base, head, dryrun=bool(dryrun_mode))
    except Exception as e:
        transition(s, task.id, "CLAUDE_FAILED", notes=[*item.get("notes", []), str(e)])
        return "CLAUDE_FAILED"
    item["head_sha"] = head
    transition(s, task.id, "CLAUDE_DONE")

    try:
        ci_record = verify_ci(head)
        item["ci"].append(ci_record)
        save_state(s)
    except Exception as e:
        transition(s, task.id, "CI_FAILED", notes=[*item.get("notes", []), str(e)])
        return "CI_FAILED"

    while True:
        transition(s, task.id, "REVIEWING")
        try:
            review = review_with_retry(
                s, task, base_sha=original_base, head_sha=head, handoff_text=handoff_review_text,
                ci_record=ci_record, correction_count=int(item["corrections"]), dryrun_mode=dryrun_mode,
            )
            if should_double_review(task, review, int(item["corrections"]), item.get("correction_trigger_severities", [])):
                try:
                    second = review_with_retry(
                        s, task, base_sha=original_base, head_sha=head, handoff_text=handoff_review_text,
                        ci_record=ci_record, correction_count=int(item["corrections"]), dryrun_mode=dryrun_mode,
                        second_independent=True,
                    )
                except ReviewFailure as second_error:
                    first_sevs = {f.get("severity") for f in review.get("findings", [])}
                    if first_sevs & {"BLOCKER", "MAJOR"}:
                        item["notes"].append(
                            f"Independent second review was inconclusive; proceeding with the primary load-bearing finding: {second_error}"
                        )
                        save_state(s)
                    else:
                        raise
                else:
                    review = merge_reviews(review, second)
                    item["notes"].append(f"Independent review pair resolved to {review['verdict']}")
                    save_state(s)
        except ReviewFailure as e:
            transition(s, task.id, "REVIEW_INCONCLUSIVE", notes=[*item.get("notes", []), str(e)])
            return "REVIEW_INCONCLUSIVE"

        if review.get("manual_decision_required"):
            transition(s, task.id, "MANUAL_DECISION_REQUIRED",
                       notes=[*item.get("notes", []), review.get("manual_decision") or review.get("summary", "manual decision")])
            return "MANUAL_DECISION_REQUIRED"
        verdict = review["verdict"]
        if verdict in SUCCESS:
            transition(s, task.id, verdict)
            return verdict
        if verdict == "BLOCKED":
            transition(s, task.id, "BLOCKED", notes=[*item.get("notes", []), review.get("summary", "review blocked")])
            return "BLOCKED"

        completed = int(item["corrections"])
        if not correction_allowed(task, review, completed):
            sevs = {f.get("severity") for f in review.get("findings", [])}
            if sevs <= {"FUNCTIONAL", "CLEANUP"}:
                item["notes"].append("Non-load-bearing finding deferred after bounded correction policy was exhausted.")
                transition(s, task.id, "PASS_WITH_NOTES")
                return "PASS_WITH_NOTES"
            transition(s, task.id, "BLOCKED", notes=[*item.get("notes", []), "Required correction remained after correction budget/policy was exhausted."])
            return "BLOCKED"

        correction_number = completed + 1
        item["correction_trigger_severities"] = sorted({str(f.get("severity")) for f in review.get("findings", []) if f.get("severity")})
        correction_prompt = build_correction_prompt(task, head, review, correction_number, dryrun_mode=dryrun_mode)
        CORRECTIONS.mkdir(parents=True, exist_ok=True)
        (CORRECTIONS / f"{task.id}-{correction_number}.md").write_text(correction_prompt, encoding="utf-8")
        transition(s, task.id, "CORRECTION_RUNNING")
        correction_base = head
        try:
            handoff_text, handoff, cost = run_claude(task, correction_prompt, claude_budget(s, task))
            spend(s, task.id, cost, "claude")
        except Exception as e:
            transition(s, task.id, "CLAUDE_FAILED", notes=[*item.get("notes", []), f"correction {correction_number}: {e}"])
            return "CLAUDE_FAILED"
        try:
            handoff = validate_handoff(handoff, correction_base)
        except Exception as e:
            item["handoffs"].append({"raw": handoff_text[-5000:]})
            transition(s, task.id, "CLAUDE_FAILED", notes=[*item.get("notes", []), f"correction {correction_number}: {e}"])
            return "CLAUDE_FAILED"
        item["handoffs"].append(handoff)
        handoff_review_text = json.dumps(handoff, indent=2, sort_keys=True)
        correction_status = handoff_status(handoff)
        if correction_status == "FAILED":
            transition(s, task.id, "CLAUDE_FAILED", notes=[*item.get("notes", []), f"correction {correction_number}: Claude handoff reported FAILED"])
            return "CLAUDE_FAILED"
        if correction_status == "MANUAL_DECISION_REQUIRED":
            try:
                if dirty_paths() or current_branch() != "main" or current_head() != correction_base:
                    raise RunnerError("manual-decision correction left unreviewed repository changes")
            except Exception as e:
                transition(s, task.id, "CLAUDE_FAILED", notes=[*item.get("notes", []), str(e)])
                return "CLAUDE_FAILED"
            transition(s, task.id, "MANUAL_DECISION_REQUIRED",
                       notes=[*item.get("notes", []), (handoff or {}).get("manual_decision") or "correction reached manual decision"])
            return "MANUAL_DECISION_REQUIRED"
        try:
            head = verify_git_after_claude(correction_base, handoff)
            validate_changed_scope(task, original_base, head, dryrun=bool(dryrun_mode))
        except Exception as e:
            transition(s, task.id, "CLAUDE_FAILED", notes=[*item.get("notes", []), f"correction {correction_number}: {e}"])
            return "CLAUDE_FAILED"
        item["corrections"] = correction_number
        item["head_sha"] = head
        transition(s, task.id, "CLAUDE_DONE")
        try:
            ci_record = verify_ci(head)
            item["ci"].append(ci_record)
            save_state(s)
        except Exception as e:
            transition(s, task.id, "CI_FAILED", notes=[*item.get("notes", []), f"correction {correction_number}: {e}"])
            return "CI_FAILED"


def dependencies_satisfied(s: dict[str, Any], task: Task) -> bool:
    for dep in task.depends_on:
        item = s.get("tasks", {}).get(dep)
        if not item or item.get("status") not in SUCCESS:
            return False
    return True


def dependency_wait_reason(s: dict[str, Any], task: Task) -> str | None:
    missing = [d for d in task.depends_on if d not in s.get("tasks", {})]
    if missing:
        return "waiting for dependency package(s): " + ", ".join(missing)
    failed = [d for d in task.depends_on if s["tasks"][d].get("status") in TERMINAL - SUCCESS]
    if failed:
        return "dependency did not pass: " + ", ".join(f"{d}={s['tasks'][d].get('status')}" for d in failed)
    pending = [d for d in task.depends_on if s["tasks"][d].get("status") not in SUCCESS]
    if pending:
        return "waiting for dependency result(s): " + ", ".join(f"{d}={s['tasks'][d].get('status')}" for d in pending)
    return None


def next_runnable(s: dict[str, Any], tasks: list[Task]) -> Task | None:
    for t in sorted(tasks, key=lambda x: x.id.lower()):
        item = s["tasks"].get(t.id)
        if not item or item.get("status") != "PENDING":
            continue
        if dependencies_satisfied(s, t):
            return t
    return None


def mark_dependency_blocks(s: dict[str, Any], tasks: list[Task]) -> None:
    """Block only on a dependency that exists and has actually failed.

    Missing future dependency packages remain PENDING/WAITING so the live inbox can
    satisfy them later without manual state repair.
    """
    changed = False
    for t in tasks:
        item = s["tasks"].get(t.id)
        if not item or item.get("status") != "PENDING":
            continue
        failed = [
            d for d in t.depends_on
            if d in s.get("tasks", {}) and s["tasks"][d].get("status") in TERMINAL - SUCCESS
        ]
        if failed:
            item["status"] = "BLOCKED"
            item["finished_at"] = now()
            note = "Dependency did not pass: " + ", ".join(
                f"{d}={s['tasks'][d].get('status')}" for d in failed
            )
            if note not in item.setdefault("notes", []):
                item["notes"].append(note)
            changed = True
    if changed:
        save_state(s)


def write_report(s: dict[str, Any]) -> None:
    session = load_json(SESSION_PATH) if SESSION_PATH.exists() else {}
    discovery = load_json(DISCOVERY_PATH) if DISCOVERY_PATH.exists() else {}
    lines = [
        "# IAMAI Overnight Report", "",
        f"- Session: `{s.get('session_id') or session.get('id')}`",
        f"- Session status: **{session.get('status', 'unknown')}**",
        f"- Session started: {session.get('started_at')}",
        f"- Updated: {s.get('updated_at')}",
        f"- Session start SHA: `{s.get('session_start_sha') or s.get('start_sha')}`",
        f"- Current/end SHA: `{s.get('end_sha')}`",
        f"- Estimated session spend: **${float(s.get('spent_usd', 0)):.2f} / ${float(s.get('hard_budget_usd', 0)):.2f}**",
        f"- Spend before real queue: **${float(s.get('prequeue_spent_usd', 0)):.2f}**", "",
        "## Tasks", "",
        "| Task | Status | Corrections | Spend | Contract | Head SHA |",
        "|---|---|---:|---:|---|---|",
    ]
    notes: list[str] = []
    for tid, item in sorted(s.get("tasks", {}).items()):
        head = item.get("head_sha") or "—"
        if head != "—":
            head = f"`{head}`"
        contract = item.get("contract_hash")
        contract_display = f"`{contract[:12]}`" if contract else "—"
        lines.append(
            f"| {tid} | {item.get('status')} | {item.get('corrections', 0)} | "
            f"${float(item.get('spent_usd', 0)):.2f} | {contract_display} | {head} |"
        )
        for n in item.get("notes", []):
            notes.append(f"- **{tid}:** {n}")
        for r in item.get("reviews", []):
            if r.get("verdict") == "PASS_WITH_NOTES":
                for n in r.get("notes", []):
                    notes.append(f"- **{tid} reviewer note:** {n}")
            for f in r.get("findings", []):
                if f.get("severity") in {"FUNCTIONAL", "CLEANUP"} and item.get("status") in SUCCESS:
                    notes.append(f"- **{tid} {f.get('severity')}:** {f.get('title')} — {f.get('user_impact')}")

    lines.extend(["", "## Live inbox", ""])
    valid = discovery.get("valid", [])
    lines.append(f"- Stable valid packages currently visible: **{len(valid)}**")
    for key, label in (("incomplete", "Incomplete"), ("settling", "Settling"), ("invalid", "Invalid")):
        values = discovery.get(key, {}) or {}
        lines.append(f"- {label}: **{len(values)}**")
        for tid, why in sorted(values.items()):
            lines.append(f"  - `{tid}` — {why}")
    for warning in discovery.get("warnings", []) or []:
        lines.append(f"- Warning: {warning}")

    lines.extend(["", "## PASS_WITH_NOTES / deferred backlog", ""])
    lines.extend(notes or ["- None recorded."])
    lines.extend(["", "## Exact CI / deploy runs", ""])
    any_ci = False
    for tid, item in sorted(s.get("tasks", {}).items()):
        for round_no, rec in enumerate(item.get("ci", []), 1):
            any_ci = True
            ci = rec.get("ci", {})
            dep = rec.get("deploy-pages", {})
            lines.append(
                f"- **{tid} round {round_no}:** ci `{ci.get('run_id')}`; deploy-pages `{dep.get('run_id')}`; "
                f"SHA `{ci.get('head_sha') or dep.get('head_sha')}`"
            )
    if not any_ci:
        lines.append("- None yet.")

    active_problem = [
        tid for tid, item in s.get("tasks", {}).items()
        if item.get("status") in {"BLOCKED", "MANUAL_DECISION_REQUIRED", "REVIEW_INCONCLUSIVE", "CLAUDE_FAILED", "CI_FAILED"}
    ]
    if active_problem:
        first = "Review these non-success task results before relying on dependent work: " + ", ".join(active_problem)
    else:
        first = (
            "If more task packages are still being authored, add them to overnight/tasks and start/resume the runner. "
            "No-work-in-the-inbox is IDLE, not proof that the product backlog is complete."
        )
    lines.extend(["", "## First recommended morning action", "", first, ""])
    write_text_atomic(REPORT_PATH, "\n".join(lines))


def doctor(*, live_openai: bool = True) -> list[str]:
    tasks = lint_or_raise()
    checks: list[str] = []
    if sys.version_info < (3, 10):
        raise RunnerError("Python 3.10+ required")
    checks.append(f"python {sys.version.split()[0]}")
    if not (ROOT / ".git").exists():
        raise RunnerError("this is not a git clone (.git missing); live overnight work must run from the real main clone")
    if current_branch() != "main":
        raise RunnerError(f"branch is {current_branch()!r}, expected 'main'")

    # The live task inbox must be ignored so the human can add future task packages
    # while Claude is running without dirtying main.
    inbox_probe = None
    for t in tasks:
        source = t.source_path or t.path
        inbox_probe = (source / "META.json").relative_to(ROOT).as_posix()
        break
    if inbox_probe:
        ignored = cmd(["git", "check-ignore", "-q", inbox_probe], check=False, timeout=30)
        if ignored.returncode != 0:
            raise RunnerError(
                f"live task inbox is not git-ignored ({inbox_probe}); add /overnight/tasks/ to .gitignore before unattended work"
            )
    checks.append("live task inbox is git-ignored")

    dirty = dirty_paths()
    if dirty:
        raise RunnerError("working tree is dirty: " + "; ".join(dirty[:30]))
    fetch_main()
    if current_head() != origin_main():
        raise RunnerError(f"local main {current_head()} != origin/main {origin_main()}")
    checks.append(f"clean main == origin/main @ {current_head()}")

    for exe in ("git", "gh", "claude", "node", "npm"):
        if shutil.which(exe) is None:
            raise RunnerError(f"required executable not found: {exe}")
    cmd(["gh", "auth", "status"], timeout=60)
    checks.append("gh authenticated")
    workflows = gh_json(["workflow", "list", "--all", "--json", "name,path,state"]) or []
    by_name = {w.get("name"): w for w in workflows}
    for wf in config()["required_workflows"]:
        if wf not in by_name:
            raise RunnerError(f"required GitHub workflow not found: {wf}")
        if by_name[wf].get("state") not in {"active", None}:
            raise RunnerError(f"required workflow {wf} is not active: {by_name[wf].get('state')}")
    checks.append("GitHub workflows ci + deploy-pages present")

    cmd(["claude", "auth", "status"], timeout=60)
    help_text = cmd(["claude", "--help"], timeout=60).stdout
    for flag in ("--output-format", "--model", "--effort", "--permission-mode", "--no-session-persistence", "--max-budget-usd"):
        if flag not in help_text:
            raise RunnerError(f"Claude Code does not advertise required flag {flag}; update Claude Code before unattended run")
    checks.append(cmd(["claude", "--version"], timeout=60).stdout.strip() or "Claude Code available")
    node_version = cmd(["node", "--version"], timeout=30).stdout.strip()
    package = load_json(ROOT / "package.json")
    engine = str((package.get("engines") or {}).get("node", "")).strip()
    actual_match = re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)", node_version)
    floor_match = re.fullmatch(r">=\s*(\d+)\.(\d+)(?:\.(\d+))?", engine)
    if actual_match and floor_match:
        actual = tuple(int(x) for x in actual_match.groups())
        required = (int(floor_match.group(1)), int(floor_match.group(2)), int(floor_match.group(3) or 0))
        if actual < required:
            raise RunnerError(f"Node {node_version} does not satisfy repository engine {engine}")
    checks.append(f"node {node_version} (engine {engine or 'unspecified'})")
    checks.append("npm " + (cmd(["npm", "--version"], timeout=30).stdout.strip() or "available"))

    if STATE_PATH.exists():
        state = load_json(STATE_PATH)
        stale = [tid for tid, item in state.get("tasks", {}).items() if item.get("status") in ACTIVE]
        if stale:
            raise RunnerError(
                "stale RUNNING state requires human inspection; automatic repair is intentionally absent: " + ", ".join(stale)
            )

    session = ensure_session()
    spent = night_spent_usd()
    hard = float(config()["hard_budget_usd"])
    if spent >= hard:
        raise RunnerError(f"nightly hard stop already exhausted: ${spent:.2f}/${hard:.2f}")

    if live_openai:
        validation_cost = validate_openai()
        spent = record_night_spend("doctor", validation_cost, "openai-validation")
        if spent >= hard:
            raise RunnerError(
                f"OpenAI validation consumed the remaining nightly budget: ${spent:.2f}/${hard:.2f}"
            )
        checks.append(
            f"OpenAI validation succeeded with {config()['openai_review_model']} (ledger +${validation_cost:.4f})"
        )

    d = discover_tasks()
    persist_discovery(d)
    checks.append(
        f"live queue discovery: {len(d.valid)} valid, {len(d.incomplete)} incomplete, "
        f"{len(d.settling)} settling, {len(d.invalid)} invalid"
    )
    for warning in d.warnings[:8]:
        checks.append("queue warning: " + warning)
    if d.invalid:
        checks.append("invalid task packages are quarantined and will not stop unrelated runnable work")
    checks.append(f"session {session['id']} budget ${spent:.2f}/${hard:.2f}")
    return checks


def gate_ok_for_run() -> tuple[bool, str]:
    session = ensure_session()
    if not GATE_PATH.exists():
        return False, "live dry-run gate file is missing for this session"
    gate = load_json(GATE_PATH)
    if gate.get("session_id") != session.get("id"):
        return False, "live dry-run gate belongs to a different overnight session"
    for mode in ("pass", "correction"):
        rec = gate.get(mode)
        if not rec or rec.get("status") not in SUCCESS:
            return False, f"live {mode} dry run has not succeeded in this session"
    gate_head = gate.get("final_head_sha")
    if STATE_PATH.exists():
        state = load_json(STATE_PATH)
        if state.get("session_id") == session.get("id") and state.get("session_start_sha") == gate_head:
            return True, f"dry-run gate satisfied at this session's queue start SHA {gate_head}"
    if gate_head != current_head():
        return False, f"dry-run gate was proven at {gate_head}, but current HEAD is {current_head()}"
    return True, f"dry-run gate satisfied at current HEAD {gate_head}"


def live_dry_run(mode: str) -> str:
    if mode not in {"pass", "correction"}:
        raise RunnerError("dry-run mode must be pass or correction")
    doctor(live_openai=True)
    task = load_task_dir(DRY_TASKS / mode)
    prior_state = STATE_PATH.read_bytes() if STATE_PATH.exists() else None
    dry_state = fresh_state([task], current_head(), initial_spent_usd=night_spent_usd())
    try:
        atomic_json(STATE_PATH, dry_state)
        result = run_one_task(dry_state, task, dryrun_mode=mode)
        if result not in SUCCESS:
            raise RunnerError(f"live {mode} dry run ended {result}; real queue remains gated")
        completed_corrections = int(dry_state["tasks"][task.id].get("corrections", 0))
        if mode == "pass" and completed_corrections != 0:
            raise RunnerError(f"PASS dry run unexpectedly used {completed_corrections} correction(s)")
        if mode == "correction" and completed_corrections != 1:
            raise RunnerError(f"correction dry run did not traverse exactly one correction; got {completed_corrections}")
        if mode == "correction" and len(dry_state["tasks"][task.id].get("handoffs", [])) != 2:
            raise RunnerError("correction dry run did not launch exactly two fresh Claude passes")
        archive = RUNTIME / f"dryrun-{mode}-state.json"
        atomic_json(archive, dry_state)
        session = ensure_session()
        gate = load_json(GATE_PATH) if GATE_PATH.exists() else {"version": 2, "session_id": session["id"]}
        if gate.get("session_id") != session["id"]:
            gate = {"version": 2, "session_id": session["id"]}
        gate[mode] = {"status": result, "completed_at": now(), "head_sha": current_head(), "state_file": archive.name, "spent_usd": dry_state["tasks"][task.id]["spent_usd"]}
        gate["nightly_spent_usd"] = night_spent_usd()
        gate["final_head_sha"] = current_head()
        gate["updated_at"] = now()
        atomic_json(GATE_PATH, gate)
        return result
    finally:
        if prior_state is None:
            if STATE_PATH.exists():
                STATE_PATH.unlink()
        else:
            STATE_PATH.write_bytes(prior_state)


def self_test() -> list[str]:
    """Exercise live-queue, PASS and correction transitions with fake external adapters."""
    results: list[str] = ["runner core loaded without a fixed Batch A task list"]

    cleanup = normalize_review({
        "verdict": "CORRECTION_REQUIRED", "summary": "x", "manual_decision_required": False,
        "manual_decision": None, "needs_more_context": False, "requested_paths": [],
        "findings": [{"severity": "CLEANUP", "title": "n", "user_impact": "none", "evidence": "n", "paths": [], "required_change": "n"}],
        "notes": [], "primary_outcome_broken": False,
    })
    if cleanup["verdict"] != "PASS_WITH_NOTES":
        raise RunnerError("cleanup-only reviewer correction was not normalized")
    results.append("CLEANUP cannot force correction")

    merged = merge_reviews(
        {
            "verdict": "CORRECTION_REQUIRED", "summary": "primary", "manual_decision_required": False,
            "manual_decision": None, "needs_more_context": False, "requested_paths": [],
            "findings": [{"severity": "MAJOR", "title": "first", "user_impact": "x", "evidence": "x", "paths": [], "required_change": "x"}],
            "notes": [], "primary_outcome_broken": False,
        },
        {
            "verdict": "PASS_WITH_NOTES", "summary": "second", "manual_decision_required": False,
            "manual_decision": None, "needs_more_context": False, "requested_paths": [],
            "findings": [{"severity": "FUNCTIONAL", "title": "second", "user_impact": "y", "evidence": "y", "paths": [], "required_change": "y"}],
            "notes": ["independent note"], "primary_outcome_broken": False,
        },
    )
    if merged["verdict"] != "CORRECTION_REQUIRED" or {f["title"] for f in merged["findings"]} != {"first", "second"}:
        raise RunnerError("independent review merge dropped a finding or load-bearing verdict")
    results.append("independent reviewer findings merge conservatively")

    security_task = Task("security-selftest", OVERNIGHT, {
        "id": "security-selftest", "depends_on": [], "risk": "critical",
        "max_corrections": 2, "max_review_retries": 1, "task_budget_usd": 5.0,
        "claude_model": "opus", "claude_effort": "high", "relevant_files": [],
        "load_bearing_security": True,
    }, "", "")
    functional_review = {"findings": [{"severity": "FUNCTIONAL"}]}
    blocker_review = {"findings": [{"severity": "BLOCKER"}]}
    if should_double_review(security_task, functional_review, 1, {"FUNCTIONAL"}):
        raise RunnerError("security-sensitive FUNCTIONAL correction incorrectly forced an independent second review")
    if not should_double_review(security_task, blocker_review, 1, {"BLOCKER"}):
        raise RunnerError("load-bearing BLOCKER correction failed to require an independent second review")
    results.append("double-review policy triggers on load-bearing severity, not routine FUNCTIONAL cleanup")

    globals_to_patch = ["current_head", "run_claude", "verify_git_after_claude", "validate_changed_scope", "verify_ci", "review_with_retry", "save_state", "record_night_spend", "ensure_session", "CORRECTIONS"]
    originals = {name: globals()[name] for name in globals_to_patch}
    temp_runtime = tempfile.TemporaryDirectory(prefix="iamai-runner-selftest-")
    try:
        globals()["save_state"] = lambda s: None
        globals()["ensure_session"] = lambda: {"id": "selftest", "started_at": now(), "status": "OPEN"}
        synthetic_ledger = {"spent": 0.0}
        def fake_record_spend(tid: str, amount: float, kind: str) -> float:
            synthetic_ledger["spent"] += float(amount)
            return synthetic_ledger["spent"]
        globals()["record_night_spend"] = fake_record_spend
        globals()["validate_changed_scope"] = lambda *a, **k: None
        globals()["verify_ci"] = lambda sha: {"ci": {"run_id": "1", "head_sha": sha, "conclusion": "success", "jobs": {"ci": "success"}}, "deploy-pages": {"run_id": "2", "head_sha": sha, "conclusion": "success", "jobs": {"walk": "success", "build": "success", "deploy": "success"}}}
        globals()["CORRECTIONS"] = Path(temp_runtime.name) / "corrections"

        def fake_task(name: str) -> Task:
            return Task(name, OVERNIGHT, {
                "id": name, "depends_on": [], "risk": "low", "max_corrections": 2,
                "max_review_retries": 1, "task_budget_usd": 5.0, "claude_model": "opus",
                "claude_effort": "high", "relevant_files": []
            }, "User-facing outcome Scope Acceptance Validation Frozen boundaries", "review")

        def fake_handoff(base_sha: str, head_sha: str, status: str = "DONE") -> dict[str, Any]:
            return {
                "status": status, "base_sha": base_sha, "head_sha": head_sha,
                "summary": "synthetic self-test", "files_changed": [], "tests": [],
                "ci": {"ci_run_id": None, "ci_conclusion": None, "deploy_run_id": None, "deploy_conclusion": None},
                "manual_decision": None, "deferred": [], "notes": [],
            }

        # PASS path.
        base = "a" * 40
        head1 = "b" * 40
        t = fake_task("self-pass")
        s = fresh_state([t], base)
        if abs(claude_budget(s, t) - (t.budget - float(config()["review_reserve_usd"]))) > 0.0001:
            raise RunnerError("Claude budget did not preserve the configured reviewer reserve")
        globals()["current_head"] = lambda: base
        globals()["run_claude"] = lambda task, prompt, budget: ("ok", fake_handoff(base, head1), 0.05)
        globals()["verify_git_after_claude"] = lambda b, h: head1
        globals()["review_with_retry"] = lambda *a, **k: {"verdict": "PASS", "findings": [], "notes": [], "manual_decision_required": False}
        if run_one_task(s, t) != "PASS":
            raise RunnerError("fake PASS path did not PASS")
        results.append("PASS-path state machine simulation passed with reviewer budget reserved")

        # CORRECTION_REQUIRED -> second Claude -> re-review -> PASS.
        synthetic_ledger["spent"] = 0.0
        base2, h1, h2 = "c" * 40, "d" * 40, "e" * 40
        t2 = fake_task("self-correction")
        s2 = fresh_state([t2], base2)
        globals()["current_head"] = lambda: base2
        calls = {"claude": 0, "review": 0}
        def fake_claude(task: Task, prompt: str, budget: float):
            calls["claude"] += 1
            h = h1 if calls["claude"] == 1 else h2
            b = base2 if calls["claude"] == 1 else h1
            return "ok", fake_handoff(b, h), 0.05
        def fake_verify(b: str, h: dict[str, Any] | None):
            return h1 if calls["claude"] == 1 else h2
        def fake_review(*a: Any, **k: Any):
            calls["review"] += 1
            if calls["review"] == 1:
                return {"verdict": "CORRECTION_REQUIRED", "findings": [{"severity": "FUNCTIONAL", "title": "synthetic", "user_impact": "exercise correction", "evidence": "synthetic", "paths": [], "required_change": "second pass"}], "notes": [], "manual_decision_required": False}
            return {"verdict": "PASS", "findings": [], "notes": [], "manual_decision_required": False}
        globals()["run_claude"] = fake_claude
        globals()["verify_git_after_claude"] = fake_verify
        globals()["review_with_retry"] = fake_review
        if run_one_task(s2, t2) != "PASS" or s2["tasks"][t2.id]["corrections"] != 1 or calls["claude"] != 2:
            raise RunnerError("fake correction path did not execute one bounded correction and PASS")
        results.append("CORRECTION_REQUIRED -> second Claude -> re-review -> PASS simulation passed")
    finally:
        for name, value in originals.items():
            globals()[name] = value
        temp_runtime.cleanup()
    return results


def discovery_record(d: TaskDiscovery) -> dict[str, Any]:
    return {
        "updated_at": now(),
        "valid": [t.id for t in d.valid],
        "incomplete": d.incomplete,
        "settling": d.settling,
        "invalid": d.invalid,
        "warnings": d.warnings,
    }


def run_queue(max_tasks: int | None = None, *, idle_minutes: float | None = None) -> dict[str, Any]:
    doctor(live_openai=True)
    ok, why = gate_ok_for_run()
    if not ok:
        raise RunnerError(
            f"real queue is gated: {why}. Run `live-dry-run pass` and `live-dry-run correction` first."
        )

    d = discover_tasks()
    if not d.valid:
        raise RunnerError("no stable valid task package is available to start")
    s = load_state(d.valid)
    if not STATE_PATH.exists():
        s = fresh_state(d.valid, current_head(), initial_spent_usd=night_spent_usd())
        s["session_start_sha"] = current_head()
        save_state(s)
    else:
        sync_tasks_into_state(s, d.valid)
        save_state(s)

    c = config()
    poll = max(5.0, float(c.get("idle_poll_seconds", 30)))
    idle_limit = max(0.0, float(idle_minutes if idle_minutes is not None else c.get("idle_timeout_minutes", 60))) * 60
    min_task_start = max(float(c["review_reserve_usd"]) + 0.25, float(c.get("min_task_start_budget_usd", 4.0)))
    count = 0
    idle_since: float | None = None
    last_idle_message = 0.0

    while True:
        # Re-discover on every loop: a human may add new packages while Claude/review work runs.
        d = discover_tasks()
        persist_discovery(d)
        sync_tasks_into_state(s, d.valid)
        s["discovery"] = discovery_record(d)
        mark_dependency_blocks(s, d.valid)
        save_state(s)

        spent = night_spent_usd()
        s["spent_usd"] = spent
        remaining = float(s["hard_budget_usd"]) - spent
        if remaining <= 0:
            s["stop_reason"] = "BUDGET_EXHAUSTED"
            save_state(s)
            close_session("budget-exhausted")
            save_state(s)
            print(f"IDLE/BUDGET: nightly hard stop reached (${spent:.2f}/${float(s['hard_budget_usd']):.2f}).")
            break

        t = next_runnable(s, d.valid)
        if t is not None:
            if remaining < min(min_task_start, t.budget):
                s["stop_reason"] = "INSUFFICIENT_SAFE_TASK_START_BUDGET"
                save_state(s)
                close_session("insufficient-safe-task-start-budget")
                save_state(s)
                print(
                    f"BUDGET STOP: ${remaining:.2f} remains; not enough to safely start {t.id} "
                    f"while preserving reviewer capacity."
                )
                break
            idle_since = None
            try:
                claimed = claim_task_contract(s, t)
            except Exception as e:
                # A copy/write race or newly-invalid package is quarantined by the next discovery.
                note = f"Task package could not be claimed yet: {e}"
                item = s["tasks"].setdefault(t.id, fresh_task_state())
                if note not in item.setdefault("notes", []):
                    item["notes"].append(note)
                save_state(s)
                print(f"WAIT: {t.id} was not claimed: {e}")
                time.sleep(poll)
                continue

            print(f"RUNNING: {claimed.id} (contract {claimed.contract_hash[:12]})")
            result = run_one_task(s, claimed)
            print(f"RESULT: {claimed.id} -> {result}")
            count += 1
            if max_tasks is not None and count >= max_tasks:
                s["stop_reason"] = f"MAX_TASKS_{max_tasks}"
                save_state(s)
                print(f"STOP: --max-tasks {max_tasks} reached; session remains open for resume.")
                break
            continue

        # No task can run right now. This is IDLE, never proof that the broader backlog is complete.
        if idle_since is None:
            idle_since = time.time()
            print(
                "IDLE: no runnable task is currently available. The runner will keep rescanning "
                f"overnight/tasks every {poll:.0f}s for up to {idle_limit/60:.0f} minute(s)."
            )
        elapsed = time.time() - idle_since
        if time.time() - last_idle_message >= 300:
            waiting = []
            for task in d.valid:
                item = s["tasks"].get(task.id, {})
                if item.get("status") == "PENDING":
                    why_wait = dependency_wait_reason(s, task)
                    if why_wait:
                        waiting.append(f"{task.id}: {why_wait}")
            if waiting:
                print("WAITING: " + " | ".join(waiting[:6]))
            if d.incomplete or d.settling or d.invalid:
                print(
                    f"INBOX: {len(d.valid)} valid, {len(d.incomplete)} incomplete, "
                    f"{len(d.settling)} settling, {len(d.invalid)} invalid."
                )
            last_idle_message = time.time()
        if idle_limit == 0 or elapsed >= idle_limit:
            s["stop_reason"] = "IDLE_TIMEOUT"
            save_state(s)
            close_session("idle-timeout")
            save_state(s)
            print(
                f"IDLE_TIMEOUT: no runnable package appeared for {elapsed/60:.1f} minute(s). "
                "Queue state is preserved. A future night can add new task IDs and start a new session."
            )
            break
        time.sleep(min(poll, max(1.0, idle_limit - elapsed)))

    return s


def print_status() -> None:
    if SESSION_PATH.exists():
        sess = load_json(SESSION_PATH)
        print(
            f"Session {sess.get('id')}  {sess.get('status')}  started={sess.get('started_at')} "
            f"reason={sess.get('close_reason') or '—'}"
        )
    else:
        print("Session: none")

    d = discover_tasks()
    persist_discovery(d)
    print(
        f"Inbox: {len(d.valid)} valid  {len(d.incomplete)} incomplete  "
        f"{len(d.settling)} settling  {len(d.invalid)} invalid"
    )
    for tid, why in sorted(d.incomplete.items()):
        print(f"  INCOMPLETE {tid}: {why}")
    for tid, why in sorted(d.settling.items()):
        print(f"  SETTLING   {tid}: {why}")
    for tid, why in sorted(d.invalid.items()):
        print(f"  INVALID    {tid}: {why}")
    for warning in d.warnings:
        print(f"  WARNING    {warning}")

    if not STATE_PATH.exists():
        print("No real-queue task history exists yet.")
    else:
        s = load_json(STATE_PATH)
        if SESSION_PATH.exists() and (load_json(SESSION_PATH).get("status") == "OPEN"):
            try:
                session_spend = night_spent_usd()
            except Exception:
                session_spend = float(s.get("spent_usd", 0))
        else:
            session_spend = float(s.get("spent_usd", 0))
        print(
            f"Queue history: start={s.get('start_sha')} current/end={s.get('end_sha')} "
            f"session spend=${session_spend:.2f}/${float(config()['hard_budget_usd']):.2f}"
        )
        live_by_id = {t.id: t for t in d.valid}
        for tid, item in sorted(s.get("tasks", {}).items()):
            status = item.get("status")
            suffix = ""
            task = live_by_id.get(tid)
            if status == "PENDING" and task:
                why = dependency_wait_reason(s, task)
                if why:
                    suffix = f"  [{why}]"
            contract = item.get("contract_hash")
            ch = contract[:12] if contract else "—"
            print(
                f"{tid:44} {str(status):24} corrections={item.get('corrections', 0)} "
                f"spend=${float(item.get('spent_usd', 0)):.2f} contract={ch}{suffix}"
            )

    if GATE_PATH.exists():
        g = load_json(GATE_PATH)
        print(f"Dry-run gate session={g.get('session_id')} final SHA={g.get('final_head_sha')}")
        for mode in ("pass", "correction"):
            print(f"  {mode}: {(g.get(mode) or {}).get('status', 'missing')}")
    else:
        print("Dry-run gate: missing")
    if BUDGET_PATH.exists():
        try:
            ledger = load_json(BUDGET_PATH)
            print(
                f"Current session budget ledger: ${float(ledger.get('spent_usd', 0)):.2f}/"
                f"${float(config()['hard_budget_usd']):.2f}"
            )
        except Exception as e:
            print(f"Budget ledger error: {e}")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="IAMAI Overnight Runner V3.2 — live incremental queue")
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("lint", help="validate stable live task packages; quarantine incomplete/invalid packages")
    sub.add_parser("self-test", help="offline adapter/state-machine PASS + correction simulations")
    sub.add_parser("doctor", help="live preflight for real unattended work")
    dry = sub.add_parser("live-dry-run", help="real Claude/git/CI/Sol dry-run gate for this session")
    dry.add_argument("mode", choices=["pass", "correction"])
    runp = sub.add_parser("run", help="run/resume the live queue; rescan for newly-added tasks while idle")
    runp.add_argument("--max-tasks", type=int, default=None)
    runp.add_argument(
        "--idle-minutes",
        type=float,
        default=None,
        help="override how long to wait/rescan when no runnable task is available",
    )
    sub.add_parser("status", help="show durable task history, live inbox, session and dry-run gate state")
    sub.add_parser(
        "new-night",
        help="close any non-active current session and start a fresh nightly budget/gate; completed task history is preserved",
    )
    args = p.parse_args(argv)
    try:
        if args.command == "lint":
            tasks = lint_or_raise()
            d = discover_tasks()
            dry_total = sum(load_task_dir(DRY_TASKS / mode).budget for mode in ("pass", "correction"))
            print(
                f"PASS: {len(tasks)} stable valid live task package(s); "
                f"{len(d.incomplete)} incomplete; {len(d.settling)} settling; {len(d.invalid)} invalid/quarantined."
            )
            print(
                f"INFO: task envelope total ${sum(t.budget for t in tasks):.2f} is not required to fit in one night; "
                f"the session hard stop is ${float(config()['hard_budget_usd']):.2f}."
            )
            print(f"INFO: required live dry-run envelopes total ${dry_total:.2f}.")
            for warning in d.warnings:
                print("WARNING:", warning)
            for tid, why in sorted(d.incomplete.items()):
                print(f"INCOMPLETE: {tid}: {why}")
            for tid, why in sorted(d.settling.items()):
                print(f"SETTLING: {tid}: {why}")
            for tid, why in sorted(d.invalid.items()):
                print(f"INVALID/QUARANTINED: {tid}: {why}")
        elif args.command == "self-test":
            for line in self_test():
                print("PASS:", line)
        elif args.command == "doctor":
            for line in doctor(live_openai=True):
                print("PASS:", line)
        elif args.command == "live-dry-run":
            print(f"PASS: live {args.mode} dry run -> {live_dry_run(args.mode)} at {current_head()}")
        elif args.command == "run":
            s = run_queue(args.max_tasks, idle_minutes=args.idle_minutes)
            print(
                f"Queue stopped at {s.get('end_sha')} with current-session estimated spend "
                f"${float(s.get('spent_usd', 0)):.2f}."
            )
            print(f"Stop reason: {s.get('stop_reason', 'manual/unknown')}")
            print(f"Report: {REPORT_PATH.relative_to(ROOT)}")
        elif args.command == "status":
            print_status()
        elif args.command == "new-night":
            session = force_new_session()
            print(f"PASS: started new overnight session {session['id']}; budget reset to $0.00 and live dry-run gate reset.")
            print("Completed task history was preserved. Run doctor + both live dry runs before run.")
        return 0
    except (RunnerError, ReviewFailure, json.JSONDecodeError, UnicodeDecodeError, OSError, ValueError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
