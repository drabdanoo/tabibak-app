#!/usr/bin/env python3
"""
iOS Review & Fix Agent — Tabibok Health App
============================================
Two-agent pipeline powered by DeepSeek API (OpenAI-compatible):

  Agent 1 – Prompt Engineer  (deepseek-chat / DeepSeek-V3)
  Agent 2 – Builder           (deepseek-reasoner / DeepSeek-R1)

Resilience features:
  • Checkpoint / resume  — progress saved after every phase to
                           .ios_agent_checkpoint.json
                           If the script crashes or is interrupted, re-run and
                           it will ask whether to resume from the last phase.
  • Retry + backoff      — every API call retries up to 4 times on any network
                           or server error (5 s → 10 s → 20 s → 40 s).
  • Token budget guard   — DeepSeek has a 64 K-token context window.
                           File batches are automatically split so no single
                           request exceeds ~50 K tokens (~200 K chars).

Setup:
    pip install openai
    DEEPSEEK_API_KEY already set in your environment variables

Run:
    python ios_review_agent.py

Output:
    • Fixed source files written back to tabibak_react_native/src/
    • Updated app.json  (Maps key + iOS permissions already applied)
    • IOS_REVIEW_REPORT.md  — full audit + App Store checklist
    • .ios_agent_checkpoint.json  — auto-deleted on clean finish
"""

import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

from openai import OpenAI

# ─── Configuration ────────────────────────────────────────────────────────────

PROJECT_ROOT    = Path(__file__).parent / "tabibak_react_native"
SRC_DIR         = PROJECT_ROOT / "src"
REPORT_FILE     = PROJECT_ROOT / "IOS_REVIEW_REPORT.md"
CHECKPOINT_FILE = Path(__file__).parent / ".ios_agent_checkpoint.json"

ENGINEER_MODEL    = "deepseek-chat"      # DeepSeek-V3  — fast structured planning
BUILDER_MODEL     = "deepseek-reasoner"  # DeepSeek-R1  — deep code reasoning
DEEPSEEK_BASE_URL = "https://api.deepseek.com"

ALWAYS_INCLUDE = ["app.json", "eas.json", "package.json"]

# Token budget — DeepSeek context = 64 K tokens.
# We reserve 10 K for the response, leaving 54 K for input.
# Rough estimate: 1 token ≈ 4 characters.
MAX_INPUT_CHARS = 54_000 * 4   # ~216 000 chars

# Retry settings
MAX_RETRIES  = 4
RETRY_DELAYS = [5, 10, 20, 40]   # seconds between attempts

# ─── Colours ─────────────────────────────────────────────────────────────────

def _c(text, code): return f"\033[{code}m{text}\033[0m"
BOLD   = lambda t: _c(t, "1")
GREEN  = lambda t: _c(t, "32")
YELLOW = lambda t: _c(t, "33")
RED    = lambda t: _c(t, "31")
CYAN   = lambda t: _c(t, "36")
DIM    = lambda t: _c(t, "2")

# ─── Logging ──────────────────────────────────────────────────────────────────

def banner(title: str):
    print("\n" + "─" * 64)
    print(f"  {BOLD(title)}")
    print("─" * 64)

def log(icon: str, msg: str, indent: int = 2):
    print(" " * indent + icon + " " + msg)

# ─── Checkpoint helpers ───────────────────────────────────────────────────────

def save_checkpoint(phase: int, data: dict):
    """Persist progress so we can resume after a crash."""
    payload = {"phase": phase, "saved_at": datetime.now().isoformat(), **data}
    CHECKPOINT_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    log(DIM("💾"), f"Checkpoint saved (phase {phase} complete)")

def load_checkpoint() -> dict | None:
    """Return saved checkpoint dict, or None if none exists."""
    if not CHECKPOINT_FILE.exists():
        return None
    try:
        return json.loads(CHECKPOINT_FILE.read_text(encoding="utf-8"))
    except Exception:
        return None

def clear_checkpoint():
    if CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()

def ask_resume(cp: dict) -> bool:
    """Ask the user whether to resume from the checkpoint."""
    print(f"\n{YELLOW('⚡ Checkpoint found')} from {cp.get('saved_at', '?')}")
    print(f"   Last completed phase: {cp.get('phase', '?')}")
    answer = input("   Resume from checkpoint? [Y/n]: ").strip().lower()
    return answer in ("", "y", "yes")

# ─── File helpers ─────────────────────────────────────────────────────────────

def read_file(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except Exception as e:
        return f"[UNREADABLE: {e}]"

def write_file(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    log(GREEN("✓"), f"Written: {path.relative_to(PROJECT_ROOT)}")

def collect_files() -> dict[str, str]:
    files: dict[str, str] = {}
    for pat in ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"]:
        for p in SRC_DIR.glob(pat):
            rel = p.relative_to(PROJECT_ROOT).as_posix()
            files[rel] = read_file(p)
    for name in ALWAYS_INCLUDE:
        p = PROJECT_ROOT / name
        if p.exists():
            files[name] = read_file(p)
    return files

# ─── Token budget helpers ─────────────────────────────────────────────────────

def estimate_chars(text: str) -> int:
    return len(text)

def chunk_file_dict(file_dict: dict[str, str],
                    overhead: int = 0) -> list[dict[str, str]]:
    """
    Split a {path: content} dict into chunks where each chunk's total
    character count stays under MAX_INPUT_CHARS (minus overhead for the
    surrounding prompt text).
    """
    budget = MAX_INPUT_CHARS - overhead
    chunks: list[dict[str, str]] = []
    current: dict[str, str] = {}
    current_size = 0

    for path, content in file_dict.items():
        size = len(path) + len(content) + 20   # 20 = separator chars
        if current and current_size + size > budget:
            chunks.append(current)
            current = {}
            current_size = 0
        current[path] = content
        current_size += size

    if current:
        chunks.append(current)

    return chunks or [{}]

# ─── Response parsers ─────────────────────────────────────────────────────────

def extract_json(text: str):
    text = re.sub(r"<think>[\s\S]*?</think>", "", text, flags=re.IGNORECASE).strip()
    for m in re.finditer(r"```(?:json)?\s*([\s\S]+?)\s*```", text):
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            continue
    for m in re.finditer(r"(\{[\s\S]*\}|\[[\s\S]*\])", text):
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            continue
    return None

def extract_code(text: str) -> str | None:
    text = re.sub(r"<think>[\s\S]*?</think>", "", text, flags=re.IGNORECASE).strip()
    m = re.search(r"```(?:javascript|jsx|typescript|tsx|js|ts)?\s*([\s\S]+?)\s*```", text)
    return m.group(1) if m else None

# ─── DeepSeek client + retry ──────────────────────────────────────────────────

def make_client() -> OpenAI:
    key = os.environ.get("DEEPSEEK_API_KEY")
    if not key:
        print(RED("ERROR") + ": DEEPSEEK_API_KEY environment variable is not set.")
        sys.exit(1)
    return OpenAI(api_key=key, base_url=DEEPSEEK_BASE_URL)

def chat(client: OpenAI, model: str, system: str,
         messages: list[dict], max_tokens: int = 8000) -> str:
    """
    Single-turn call with automatic retry + exponential backoff.

    Retries on:
      • Network errors (ConnectionError, TimeoutError)
      • HTTP 5xx server errors
      • HTTP 429 rate-limit errors (waits the full retry delay)

    DeepSeek-R1 quirk: `content` can be empty; falls back to `reasoning_content`.
    """
    full_messages = [{"role": "system", "content": system}] + messages

    for attempt in range(MAX_RETRIES):
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=full_messages,
                max_tokens=max_tokens,
                timeout=120,          # 2-minute per-request timeout
            )
            msg = resp.choices[0].message
            content   = (msg.content or "").strip()
            reasoning = (getattr(msg, "reasoning_content", None) or "").strip()
            return content if content else reasoning

        except Exception as e:
            is_last = (attempt == MAX_RETRIES - 1)
            err_str  = str(e)

            # Decide whether to retry
            retryable = any(k in err_str.lower() for k in (
                "connection", "timeout", "503", "502", "500", "429",
                "rate limit", "network", "reset", "eof"
            ))

            if is_last or not retryable:
                log(RED("✗"), f"API call failed after {attempt + 1} attempt(s): {e}")
                raise

            delay = RETRY_DELAYS[attempt]
            log(YELLOW("↻"), f"API error ({type(e).__name__}): {err_str[:80]}")
            log(YELLOW(" "), f"Retrying in {delay}s… (attempt {attempt + 1}/{MAX_RETRIES})")
            time.sleep(delay)

    return ""   # unreachable

# ─── Agent system prompts ─────────────────────────────────────────────────────

ENGINEER_SYSTEM = """
You are a senior iOS / React Native Prompt Engineer specialising in App Store readiness.
Your responsibilities:
  • Design precise, exhaustive audit tasks for the Builder agent.
  • Prioritise and batch fixes to minimise file rewrites.
  • Validate the Builder's output and write developer-friendly reports.

Deep knowledge areas:
  • iOS App Store review guidelines and Info.plist privacy string requirements
  • Expo Managed Workflow / EAS Build iOS pipeline
  • @react-native-firebase iOS integration and known gotchas
  • react-native-maps with PROVIDER_GOOGLE on iOS
  • expo-notifications APNs permission flow on iOS
  • expo-image-picker, expo-file-system iOS permission strings
  • Arabic RTL layout on iOS vs Android differences
  • Common Android→iOS porting pitfalls

Always respond with structured JSON unless explicitly asked for prose.
""".strip()

BUILDER_SYSTEM = """
You are an elite cross-platform mobile engineer. You reason carefully through code
before writing fixes. Your specialisation is making React Native / Expo apps work
perfectly on iOS.

Mastered areas:
  • Every iOS vs Android API difference in React Native core
  • Expo SDK iOS quirks (expo-notifications, expo-image-picker, expo-file-system)
  • @react-native-firebase: phone auth on iOS, FCM vs APNs token handling
  • react-native-maps: PROVIDER_GOOGLE on iOS needs config.googleMapsApiKey in app.json
  • KeyboardAvoidingView: behavior="padding" on iOS, behavior="height" on Android
  • Shadow styles: elevation (Android-only) → must add shadowColor/Offset/Opacity/Radius
  • SafeAreaView / useSafeAreaInsets: correct usage on notched iPhones
  • StatusBar: translucent differences between platforms
  • Platform.OS guard patterns — every Android-only block needs an iOS branch
  • RTL (Arabic) layout: I18nManager.forceRTL works differently on iOS
  • App Store Privacy Manifest (PrivacyInfo.xcprivacy) requirements

When auditing: output structured JSON with every issue found.
When fixing: output ONLY the complete corrected file — no commentary, no diff.
""".strip()

# ─── Phase 1 ──────────────────────────────────────────────────────────────────

def phase1_design_audit(client: OpenAI, files: dict[str, str]) -> dict:
    banner("Phase 1 — Prompt Engineer: designing audit plan")

    file_list = "\n".join(f"  • {k}" for k in sorted(files))

    prompt = f"""
You are auditing this React Native / Expo app for full iOS compatibility and
App Store readiness.

PROJECT FILES:
{file_list}

KEY DEPENDENCIES:
  @react-native-firebase/app, /auth, /storage
  react-native-maps  ← DoctorMapScreen uses PROVIDER_GOOGLE
  expo-notifications, expo-image-picker, expo-file-system
  expo-print, expo-sharing, @react-native-community/datetimepicker
  expo-localization + react-i18next  ← Arabic RTL + English
  react-native-webview, expo-auth-session, expo-web-browser

ALREADY CONFIGURED IN app.json:
  ✓ googleMapsApiKey  ✓ NSCameraUsageDescription
  ✓ NSPhotoLibraryUsageDescription  ✓ NSLocationWhenInUseUsageDescription
  ✓ ITSAppUsesNonExemptEncryption = false

CURRENT app.json:
{files.get("app.json", "(not found)")}

Design a thorough audit plan as JSON:
{{
  "audit_tasks": [
    {{
      "id":             "unique_snake_case_id",
      "category":       "permissions|styling|keyboard|navigation|firebase|maps|notifications|platform_guards|rtl|appstore|eas",
      "title":          "Human readable title",
      "description":    "What to look for",
      "files_to_check": ["src/relative/path.js"],
      "ios_rules":      ["specific iOS rule to enforce"],
      "severity":       "critical|high|medium|low"
    }}
  ],
  "appstore_checklist": ["App Store requirement to verify"]
}}

Cover EVERY potential iOS issue. Reference real files from the project list above.
"""

    raw  = chat(client, ENGINEER_MODEL, ENGINEER_SYSTEM, [{"role": "user", "content": prompt}])
    plan = extract_json(raw)

    if not plan:
        log(YELLOW("⚠"), "Could not parse audit plan — using full-scan fallback")
        plan = {
            "audit_tasks": [{
                "id": "full_scan", "title": "Full iOS Audit",
                "files_to_check": [k for k in files if k.startswith("src/")],
                "ios_rules": [], "severity": "high",
            }],
            "appstore_checklist": [],
        }

    log(GREEN("✓"), f"{len(plan.get('audit_tasks', []))} audit tasks designed")
    return plan

# ─── Phase 2 ──────────────────────────────────────────────────────────────────

def phase2_audit(client: OpenAI, plan: dict, files: dict[str, str]) -> list[dict]:
    banner("Phase 2 — Builder (DeepSeek-R1): auditing every file")

    all_issues: list[dict] = []
    tasks = plan.get("audit_tasks", [])

    for task in tasks:
        title = task.get("title", task["id"])
        log(CYAN("→"), title)

        # Assemble files relevant to this task
        task_files = {
            k: v for k, v in files.items()
            if k in task.get("files_to_check", []) or k in ALWAYS_INCLUDE
        }
        if not task_files:
            task_files = {k: v for k, v in files.items() if k.startswith("src/")}

        # ── Token budget: chunk if files are too large ────────────────────────
        prompt_overhead = 800   # chars for the prompt text outside the files
        chunks = chunk_file_dict(task_files, overhead=prompt_overhead)

        if len(chunks) > 1:
            log(YELLOW("⚡"), f"Files chunked into {len(chunks)} batches (token budget)")

        for chunk_idx, chunk in enumerate(chunks, 1):
            chunk_label = f" (chunk {chunk_idx}/{len(chunks)})" if len(chunks) > 1 else ""
            file_block  = "\n\n".join(
                f"/* ─── {path} ─── */\n{content}"
                for path, content in chunk.items()
            )

            prompt = f"""
iOS Audit Task{chunk_label}
ID:          {task["id"]}
Category:    {task.get("category", "")}
Description: {task.get("description", "")}
Severity:    {task.get("severity", "medium")}

iOS rules:
{json.dumps(task.get("ios_rules", []), indent=2)}

Source code:
{file_block}

Find EVERY iOS issue. Respond ONLY with JSON:
{{
  "issues": [
    {{
      "file":            "src/relative/path.js",
      "line_hint":       "short code snippet near the issue",
      "severity":        "critical|high|medium|low",
      "category":        "{task.get("category", "")}",
      "description":     "what is wrong and why it breaks on iOS",
      "ios_impact":      "exact symptom on a real iPhone",
      "fix_description": "what must change",
      "fixed_snippet":   "corrected 2-10 lines"
    }}
  ]
}}

If no issues found return {{"issues": []}}.
"""

            raw    = chat(client, BUILDER_MODEL, BUILDER_SYSTEM,
                          [{"role": "user", "content": prompt}], max_tokens=8000)
            result = extract_json(raw)

            if result and isinstance(result.get("issues"), list):
                found = result["issues"]
                all_issues.extend(found)
                log(DIM("  ·"), f"{len(found)} issue(s){chunk_label}" if found else GREEN(f"clean{chunk_label}"))
            else:
                log(DIM("  ·"), f"no structured issues{chunk_label}")

    # Deduplicate
    seen: set[tuple] = set()
    unique: list[dict] = []
    for iss in all_issues:
        key = (iss.get("file", ""), iss.get("description", "")[:60])
        if key not in seen:
            seen.add(key)
            unique.append(iss)

    log(GREEN("✓"), f"Total unique issues found: {len(unique)}")
    return unique

# ─── Phase 3 ──────────────────────────────────────────────────────────────────

def phase3_plan_fixes(client: OpenAI, issues: list[dict], plan: dict) -> dict:
    banner("Phase 3 — Prompt Engineer: planning fixes")

    prompt = f"""
The Builder found these iOS issues:
{json.dumps(issues, indent=2)}

App Store checklist:
{json.dumps(plan.get("appstore_checklist", []), indent=2)}

Create a fix plan as JSON:
{{
  "fix_batches": [
    {{
      "batch_id":    "b1",
      "priority":    1,
      "title":       "Critical blockers",
      "files_to_fix": {{
        "src/path/file.js": ["issue description 1", "issue 2"]
      }}
    }}
  ],
  "app_json_patch": {{
    "expo.ios.infoPlist": {{ "KEY": "value if still missing" }}
  }},
  "manual_steps": [
    "Step requiring Apple Developer account, Xcode, or real device"
  ]
}}

Rules:
• Batch 1 = critical (crash), Batch 2 = high (broken feature), Batch 3 = polish.
• Group ALL issues for the same file into one entry.
• Only include app_json_patch keys genuinely still missing.
"""

    raw      = chat(client, ENGINEER_MODEL, ENGINEER_SYSTEM, [{"role": "user", "content": prompt}])
    fix_plan = extract_json(raw)

    if not fix_plan:
        log(YELLOW("⚠"), "Could not parse fix plan")
        fix_plan = {"fix_batches": [], "app_json_patch": {}, "manual_steps": []}

    log(GREEN("✓"), f"{len(fix_plan.get('fix_batches', []))} fix batch(es) planned")
    return fix_plan

# ─── Phase 4 ──────────────────────────────────────────────────────────────────

def phase4_apply_fixes(client: OpenAI,
                       fix_plan: dict,
                       files: dict[str, str]) -> dict[str, str]:
    banner("Phase 4 — Builder (DeepSeek-R1): applying fixes")

    fixed: dict[str, str] = {}

    for batch in fix_plan.get("fix_batches", []):
        log(CYAN("→"), f"Batch {batch.get('batch_id')}: {batch.get('title')}")

        for file_path, issue_list in batch.get("files_to_fix", {}).items():
            current = fixed.get(file_path, files.get(file_path))
            if current is None:
                log(YELLOW("⚠"), f"Not found, skipping: {file_path}", 4)
                continue

            # Warn if the file alone is very large
            if len(current) > MAX_INPUT_CHARS - 2000:
                log(YELLOW("⚡"), f"Large file ({len(current)//1000}K chars) — may be near token limit", 4)

            prompt = f"""
Fix these iOS issues in the file.

ISSUES:
{json.dumps(issue_list, indent=2)}

FILE: {file_path}
```
{current}
```

Output the COMPLETE corrected file in one fenced code block. No commentary.

Rules:
1. Fix ONLY the listed issues — preserve all other logic.
2. KeyboardAvoidingView: behavior={{Platform.OS === 'ios' ? 'padding' : 'height'}}
3. Shadows: keep elevation AND add shadowColor/shadowOffset/shadowOpacity/shadowRadius
4. Platform.OS checks: both 'ios' and 'android' branches must exist.
5. Add import {{ Platform }} from 'react-native' if missing.
6. expo-notifications requestPermissionsAsync must handle iOS.
7. react-native-maps PROVIDER_GOOGLE is already handled via app.json — keep as-is.
8. RTL: ensure I18nManager / flexDirection is platform-safe.
"""

            raw  = chat(client, BUILDER_MODEL, BUILDER_SYSTEM,
                        [{"role": "user", "content": prompt}], max_tokens=16000)
            code = extract_code(raw)
            if code:
                fixed[file_path] = code
                log(GREEN("✓"), file_path, 4)
            else:
                log(YELLOW("⚠"), f"No code block extracted for {file_path}", 4)

    # app.json patch
    patch = fix_plan.get("app_json_patch", {})
    if patch:
        try:
            app_json = json.loads(fixed.get("app.json", files.get("app.json", "{}")))

            def deep_set(obj: dict, dot_path: str, value):
                keys = dot_path.split(".")
                for k in keys[:-1]:
                    obj = obj.setdefault(k, {})
                last = keys[-1]
                if isinstance(value, dict) and isinstance(obj.get(last), dict):
                    for k2, v2 in value.items():
                        obj[last][k2] = v2
                else:
                    obj[last] = value

            for dot_path, value in patch.items():
                deep_set(app_json, dot_path, value)

            fixed["app.json"] = json.dumps(app_json, indent=2, ensure_ascii=False)
            log(GREEN("✓"), "app.json patched")
        except Exception as e:
            log(YELLOW("⚠"), f"app.json patch error: {e}")

    log(GREEN("✓"), f"{len(fixed)} file(s) ready to write")
    return fixed

# ─── Agent dialogue ───────────────────────────────────────────────────────────

def agent_dialogue(client: OpenAI, issues: list[dict], fixed: dict[str, str]) -> str:
    banner("Agent Dialogue — Engineer ↔ Builder cross-check")

    e_raw = chat(client, ENGINEER_MODEL, ENGINEER_SYSTEM, [{"role": "user", "content": f"""
The Builder fixed {len(fixed)} file(s) and found {len(issues)} issues.

Ask exactly 3 probing questions about risks that may STILL exist — focus on:
  Firebase phone auth on iOS, APNs vs FCM token handling, Arabic RTL on iPhone,
  App Store Privacy Manifest (PrivacyInfo.xcprivacy), EAS Build config gaps.

Output JSON: {{"questions": ["q1", "q2", "q3"]}}
"""}])

    q_data    = extract_json(e_raw) or {"questions": []}
    questions = q_data.get("questions", [])
    if not questions:
        return ""

    log(CYAN("→"), "Engineer's cross-check questions:")
    for q in questions:
        log(DIM("  ?"), q)

    b_raw  = chat(client, BUILDER_MODEL, BUILDER_SYSTEM, [{"role": "user", "content": f"""
Answer these iOS readiness questions. Flag any risk not yet addressed in the code.

{json.dumps(questions, indent=2)}

Output JSON:
{{
  "answers": [
    {{
      "question":        "...",
      "answer":          "...",
      "remaining_risk":  "none|low|medium|high",
      "action_required": "developer action or 'none'"
    }}
  ]
}}
"""}])

    a_data = extract_json(b_raw) or {"answers": []}
    lines  = ["\n## Agent Cross-Check Dialogue\n"]
    for item in a_data.get("answers", []):
        risk   = item.get("remaining_risk", "unknown")
        dot    = {"none": "🟢", "low": "🟡", "medium": "🟠", "high": "🔴"}.get(risk, "⚪")
        action = item.get("action_required", "none")
        lines += [
            f"**Q:** {item.get('question', '')}",
            f"**A:** {item.get('answer', '')}",
            f"**Risk:** {dot} {risk}" + (f"  |  **Action:** {action}" if action != "none" else ""),
            "",
        ]
    log(GREEN("✓"), "Dialogue complete")
    return "\n".join(lines)

# ─── Phase 5 ──────────────────────────────────────────────────────────────────

def phase5_report(client: OpenAI, issues: list[dict],
                  fixed: dict[str, str], fix_plan: dict) -> str:
    banner("Phase 5 — Prompt Engineer: writing final report")

    by_sev = lambda s: [i for i in issues if i.get("severity") == s]

    # Build outside the f-string — dict literals inside f-string expressions
    # cause a TypeError because Python reads {{ as a set literal, not an escaped brace.
    issues_summary = json.dumps(
        [{"file": i.get("file"), "severity": i.get("severity"),
          "description": i.get("description"), "ios_impact": i.get("ios_impact")}
         for i in issues],
        indent=2
    )

    prompt = f"""
Write a complete iOS readiness report for Tabibok Health (React Native / Expo).

AUDIT SUMMARY:
  Total issues : {len(issues)}  |  Critical: {len(by_sev("critical"))}
  High: {len(by_sev("high"))}  |  Medium: {len(by_sev("medium"))}  |  Low: {len(by_sev("low"))}
  Files modified: {len(fixed)}

ALL ISSUES:
{issues_summary}

MANUAL STEPS:
{json.dumps(fix_plan.get("manual_steps", []), indent=2)}

APNs KEY: ID=WT3KP84WDH  File=AuthKey_WT3KP84WDH.p8  (upload to EAS — never commit)

Write Markdown with these sections:
# iOS Readiness Report — Tabibok Health
## Executive Summary
## Issues Fixed  (table: File | Severity | Issue | Status)
## app.json Changes Applied
## EAS Build Instructions  (exact CLI commands, no Mac needed)
## APNs / Push Notification Setup
## App Store Submission Checklist  (numbered)
## Manual Steps Required
## Known Limitations
"""

    report = chat(client, ENGINEER_MODEL, ENGINEER_SYSTEM,
                  [{"role": "user", "content": prompt}], max_tokens=4096)
    log(GREEN("✓"), "Report generated")
    return report

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("\n" + "═" * 64)
    print(f"  {BOLD('iOS Review & Fix Agent — Tabibok Health')}")
    print(f"  DeepSeek-V3 (Engineer) + DeepSeek-R1 (Builder)")
    print(f"  {DIM(datetime.now().strftime('%Y-%m-%d %H:%M:%S'))}")
    print("═" * 64)

    if not PROJECT_ROOT.exists():
        print(RED("ERROR") + f": Project not found at {PROJECT_ROOT}")
        sys.exit(1)

    client = make_client()

    # ── Load or start fresh ───────────────────────────────────────────────────
    audit_plan: dict       = {}
    issues:     list[dict] = []
    fix_plan:   dict       = {}
    fixed:      dict[str, str] = {}
    start_phase = 1

    cp = load_checkpoint()
    if cp and ask_resume(cp):
        start_phase = cp.get("phase", 0) + 1
        audit_plan  = cp.get("audit_plan", {})
        issues      = cp.get("issues", [])
        fix_plan    = cp.get("fix_plan", {})
        fixed       = cp.get("fixed", {})
        log(GREEN("✓"), f"Resuming from phase {start_phase}")
    else:
        clear_checkpoint()

    # Always re-read files from disk (they may have changed)
    log(CYAN("→"), "Loading source files...")
    files = collect_files()
    log(GREEN("✓"), f"{len(files)} files loaded")

    # ── Pipeline with checkpoint saves ────────────────────────────────────────
    if start_phase <= 1:
        audit_plan = phase1_design_audit(client, files)
        save_checkpoint(1, {"audit_plan": audit_plan})

    if start_phase <= 2:
        issues = phase2_audit(client, audit_plan, files)
        save_checkpoint(2, {"audit_plan": audit_plan, "issues": issues})

    if start_phase <= 3:
        fix_plan = phase3_plan_fixes(client, issues, audit_plan)
        save_checkpoint(3, {"audit_plan": audit_plan, "issues": issues,
                            "fix_plan": fix_plan})

    if start_phase <= 4:
        fixed = phase4_apply_fixes(client, fix_plan, files)
        save_checkpoint(4, {"audit_plan": audit_plan, "issues": issues,
                            "fix_plan": fix_plan, "fixed": fixed})

    # ── Write fixed files ─────────────────────────────────────────────────────
    if fixed:
        banner("Writing fixed files to disk")
        for rel_path, content in fixed.items():
            write_file(PROJECT_ROOT / rel_path, content)

    # ── Report + dialogue (not checkpointed — fast) ───────────────────────────
    dialogue = agent_dialogue(client, issues, fixed)
    report   = phase5_report(client, issues, fixed, fix_plan)

    full_report = (
        report + "\n" + dialogue
        + f"\n\n---\n*Generated {datetime.now().isoformat()}*\n"
        + "*DeepSeek-V3 (Prompt Engineer) + DeepSeek-R1 (Builder)*\n"
    )
    REPORT_FILE.write_text(full_report, encoding="utf-8")

    # ── Clean up checkpoint on success ────────────────────────────────────────
    clear_checkpoint()
    log(GREEN("✓"), "Checkpoint cleared")

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "═" * 64)
    print(f"  {GREEN(BOLD('ALL DONE'))}")
    print(f"  Issues found  : {len(issues)}")
    print(f"  Files fixed   : {len(fixed)}")
    print(f"  Report        : {REPORT_FILE.name}")
    print("═" * 64)

    manual = fix_plan.get("manual_steps", [])
    if manual:
        print(f"\n  {YELLOW('MANUAL STEPS REQUIRED:')}")
        for i, step in enumerate(manual, 1):
            print(f"    {i}. {step}")

    print(f"""
  {BOLD('Build & submit (no Mac needed):')}

    cd tabibak_react_native
    eas build --platform ios --profile production
    eas credentials        ← upload AuthKey_WT3KP84WDH.p8  (Key ID: WT3KP84WDH)
    eas submit --platform ios
""")


if __name__ == "__main__":
    main()
