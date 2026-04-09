#!/usr/bin/env python3
"""
iOS Test Agent â€” Tabibok Health
================================
Two AI agents + cloud infrastructure work together to autonomously
test the iOS app on real iPhones â€” no Mac, no manual tapping.

  Prompt Engineer (DeepSeek-V3)
    Reads every screen, designs test scenarios, triages failures.

  Builder (DeepSeek-R1)
    Writes Maestro YAML test flows, analyses crash logs,
    fixes source code when tests fail.

Pipeline
â”€â”€â”€â”€â”€â”€â”€â”€
  Phase 1  AI reads all 35 screens â†’ generates Maestro YAML test flows
  Phase 2  EAS builds a signed .ipa in the cloud  (~25 min)
  Phase 3  .ipa + test flows uploaded to Maestro Cloud
  Phase 4  Tests run on a real iPhone in the cloud
  Phase 5  AI reads results â†’ fixes failures â†’ loop (up to MAX_FIX_ROUNDS)
  Phase 6  Final test report written to IOS_TEST_REPORT.md

Environment variables required (all already set):
  EXPO_TOKEN       â€” personal access token from expo.dev
  MAESTRO_API_KEY  â€” Maestro Cloud API key

App info (hardcoded â€” no need to change):
  Bundle ID  : com.abdullah.reacttabibok
  EAS project: c6e91624-4f76-4b03-90f1-f4f724ab5547
  Apple Team : Q444HLRBL9
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import threading
import time
import zipfile
from datetime import datetime
from pathlib import Path

import requests
from openai import OpenAI

# â”€â”€â”€ Configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

PROJECT_ROOT   = Path(__file__).parent / "tabibak_react_native"
SRC_DIR        = PROJECT_ROOT / "src"
FLOWS_DIR      = Path(__file__).parent / "maestro_flows"
REPORT_FILE    = PROJECT_ROOT / "IOS_TEST_REPORT.md"
CHECKPOINT     = Path(__file__).parent / ".ios_test_checkpoint.json"
IPA_CACHE      = Path(__file__).parent / ".cached_build.ipa"
TAR_CACHE      = Path(__file__).parent / ".cached_build.tar.gz"
APP_EXTRACT_DIR = Path(__file__).parent / ".cached_sim_app"

APP_ID         = "com.abdullah.reacttabibok"
EAS_PROJECT_ID = "c6e91624-4f76-4b03-90f1-f4f724ab5547"
EAS_OWNER      = "abdanoo"

# â”€â”€ Test credentials (read from env â€” never hardcoded) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def get_test_creds() -> dict:
    return {
        "patient_email":      os.environ.get("TEST_PATIENT_EMAIL",      "patient@test.com"),
        "doctor_email":       os.environ.get("TEST_DOCTOR_EMAIL",       "doctor@test.com"),
        "receptionist_email": os.environ.get("TEST_RECEPTIONIST_EMAIL", "receptionist@test.com"),
        "password":           os.environ.get("TEST_PASSWORD",           "555555"),
    }

# Detect which role a flow needs based on its filename
def flow_role(filename: str) -> str:
    name = filename.lower()
    if any(w in name for w in ("auth", "otp", "phone", "profile_setup", "email_login")):
        return "auth"   # auth flows â€” no login prefix needed
    if "doctor" in name:
        return "doctor"
    if "receptionist" in name:
        return "receptionist"
    return "patient"    # default for patient_ and shared flows

# Build the login YAML block for a given role.
#
# Auth routing in the app:
#   Patient       â†’ PhoneAuth (OTP) â€” cannot be automated; use Doctor login as fallback
#   Doctor        â†’ EmailLoginScreen (email + password) âœ“
#   Receptionist  â†’ EmailLoginScreen (email + password) âœ“
#
# EmailLoginScreen text elements (after tapping role card):
#   title:    "Doctor" / "Receptionist"   (t('roles.doctor') / t('roles.receptionist'))
#   subtitle: "Sign in with your credentials"
#   email field label:    "Email Address"
#   email placeholder:    "Enter your email"
#   password label:       "Password"
#   password placeholder: "Enter your password"
#   button:               "Sign In"
def login_block(role: str, creds: dict) -> str:
    # Patient can't use email login â€” tap Doctor card instead (Doctor email login works)
    if role == "patient":
        tap_role   = "Doctor"
        email_var  = "${TEST_DOCTOR_EMAIL}"
        note       = "(patient flows: logging in as Doctor â€” patient phone auth not automatable)"
    elif role == "receptionist":
        tap_role   = "Receptionist"
        email_var  = "${TEST_RECEPTIONIST_EMAIL}"
        note       = "(receptionist)"
    else:
        tap_role   = "Doctor"
        email_var  = "${TEST_DOCTOR_EMAIL}"
        note       = "(doctor)"

    return f"""# â”€â”€ Auto-injected login {note} â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
- clearState
- launchApp
- waitForAnimationToEnd
- assertVisible: "Choose your role to continue"
- waitForAnimationToEnd
- tapOn: "{tap_role}"
- waitForAnimationToEnd
- assertVisible: "Email Address"
- tapOn: "Enter your email"
- inputText: {email_var}
- tapOn: "Enter your password"
- inputText: ${{TEST_PASSWORD}}
- tapOn: "Sign In"
- waitForAnimationToEnd
# â”€â”€ End login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
"""

ENGINEER_MODEL    = "deepseek-chat"      # DeepSeek-V3
BUILDER_MODEL     = "deepseek-reasoner"  # DeepSeek-R1
DEEPSEEK_BASE_URL = "https://api.deepseek.com"

EAS_API          = "https://api.expo.dev/v2"
MAESTRO_API      = "https://api.mobile.dev/v1"

MAX_FIX_ROUNDS   = 3          # how many fixâ†’rebuildâ†’retest loops
MAX_RETRIES      = 4
RETRY_DELAYS     = [5, 10, 20, 40]
MAX_INPUT_CHARS  = 200_000    # ~50K tokens, safe for DeepSeek 64K context
BUILD_POLL_SEC   = 60         # poll EAS every 60 s while building
MAX_EAS_BUILD_MIN    = 90     # stop waiting after 90 minutes
MAX_MAESTRO_REST_MIN = 150    # match CLI --timeout=150

# â”€â”€â”€ Colours â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _c(t, code): return f"\033[{code}m{t}\033[0m"
BOLD   = lambda t: _c(t, "1")
GREEN  = lambda t: _c(t, "32")
YELLOW = lambda t: _c(t, "33")
RED    = lambda t: _c(t, "31")
CYAN   = lambda t: _c(t, "36")
DIM    = lambda t: _c(t, "2")

def banner(t):
    print("\n" + "â”€" * 64)
    print(f"  {BOLD(t)}")
    print("â”€" * 64)

def log(icon, msg, indent=2):
    print(" " * indent + icon + " " + msg)

# â”€â”€â”€ Checkpoint helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def save_cp(phase: int, data: dict):
    payload = {"phase": phase, "saved_at": datetime.now().isoformat(), **data}
    CHECKPOINT.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    log(DIM("ðŸ’¾"), f"Checkpoint saved (phase {phase})")

def load_cp() -> dict | None:
    if not CHECKPOINT.exists():
        return None
    try:
        return json.loads(CHECKPOINT.read_text(encoding="utf-8"))
    except Exception:
        return None

def clear_cp():
    if CHECKPOINT.exists():
        CHECKPOINT.unlink()

def ask_resume(cp: dict) -> bool:
    print(f"\n{YELLOW('âš¡ Checkpoint found')} â€” {cp.get('saved_at', '?')}")
    print(f"   Last completed phase: {cp.get('phase', '?')}")
    # Auto-resume when stdin is not a TTY (non-interactive / background run)
    if not sys.stdin.isatty():
        print("   Resume? [Y/n]: Y  (auto-resumed â€” non-interactive mode)")
        return True
    try:
        ans = input("   Resume? [Y/n]: ").strip().lower()
        return ans in ("", "y", "yes")
    except EOFError:
        print("Y  (auto-resumed â€” EOF on stdin)")
        return True

# â”€â”€â”€ File helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def read_file(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8")
    except Exception as e:
        return f"[UNREADABLE: {e}]"

def collect_screens() -> dict[str, str]:
    """Return {relative_path: content} for every screen JS file."""
    screens = {}
    for p in SRC_DIR.glob("screens/**/*.js"):
        rel = p.relative_to(PROJECT_ROOT).as_posix()
        screens[rel] = read_file(p)
    return screens

# â”€â”€â”€ HTTP retry helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def http(method: str, url: str, **kwargs) -> requests.Response:
    """
    requests wrapper with automatic retry + exponential backoff.
    Retries on: network errors, 429, 5xx.
    Same delays as DeepSeek retry: 5 â†’ 10 â†’ 20 â†’ 40 s.
    """
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.request(method, url, **kwargs)
            # Retry on rate-limit or server errors
            if resp.status_code in (429, 500, 502, 503, 504) and attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAYS[attempt]
                log(YELLOW("â†»"), f"HTTP {resp.status_code} â€” retry in {delay}s "
                                 f"({attempt+1}/{MAX_RETRIES})")
                time.sleep(delay)
                continue
            return resp
        except (requests.ConnectionError, requests.Timeout) as e:
            if attempt == MAX_RETRIES - 1:
                raise
            delay = RETRY_DELAYS[attempt]
            log(YELLOW("â†»"), f"Network error ({type(e).__name__}) â€” retry in {delay}s "
                              f"({attempt+1}/{MAX_RETRIES})")
            time.sleep(delay)
    raise RuntimeError("http() exhausted retries")

def chunk_dict(d: dict[str, str], overhead=800) -> list[dict[str, str]]:
    budget = MAX_INPUT_CHARS - overhead
    chunks, cur, size = [], {}, 0
    for k, v in d.items():
        n = len(k) + len(v) + 20
        if cur and size + n > budget:
            chunks.append(cur)
            cur, size = {}, 0
        cur[k] = v
        size += n
    if cur:
        chunks.append(cur)
    return chunks or [{}]

# â”€â”€â”€ Response parsers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def strip_think(text: str) -> str:
    return re.sub(r"<think>[\s\S]*?</think>", "", text, flags=re.IGNORECASE).strip()

def extract_json(text: str):
    text = strip_think(text)
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
    text = strip_think(text)
    m = re.search(r"```(?:yaml|yml)?\s*([\s\S]+?)\s*```", text)
    return m.group(1) if m else None

def extract_js(text: str) -> str | None:
    text = strip_think(text)
    m = re.search(r"```(?:javascript|jsx|js)?\s*([\s\S]+?)\s*```", text)
    return m.group(1) if m else None

# â”€â”€â”€ DeepSeek client â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def make_ds_client() -> OpenAI:
    key = os.environ.get("DEEPSEEK_API_KEY")
    if not key:
        print(RED("ERROR") + ": DEEPSEEK_API_KEY not set")
        sys.exit(1)
    return OpenAI(api_key=key, base_url=DEEPSEEK_BASE_URL)

def chat(client: OpenAI, model: str, system: str,
         messages: list[dict], max_tokens=8000) -> str:
    for attempt in range(MAX_RETRIES):
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": system}] + messages,
                max_tokens=max_tokens,
                timeout=180,
            )
            msg = resp.choices[0].message
            content   = (msg.content or "").strip()
            reasoning = (getattr(msg, "reasoning_content", None) or "").strip()
            return content if content else reasoning
        except Exception as e:
            if attempt == MAX_RETRIES - 1:
                raise
            retryable = any(k in str(e).lower() for k in
                           ("connection", "timeout", "503", "502", "500", "429", "reset"))
            if not retryable:
                raise
            delay = RETRY_DELAYS[attempt]
            log(YELLOW("â†»"), f"{type(e).__name__} â€” retry in {delay}s ({attempt+1}/{MAX_RETRIES})")
            time.sleep(delay)
    return ""

# â”€â”€â”€ EAS Build helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def eas_trigger_build() -> str:
    """Trigger a production iOS build via EAS CLI. Returns build ID."""
    banner("EAS: Triggering iOS production build")
    log(CYAN("â†’"), "Starting EAS build (this will take ~25 minutes)...")

    env = {**os.environ, "EXPO_TOKEN": os.environ.get("EXPO_TOKEN", "")}

    # On Windows, npm global binaries are .cmd files â€” use shell=True so the
    # OS resolves eas â†’ eas.cmd automatically via PATH.
    is_windows = sys.platform == "win32"
    # Use 'maestro' profile which sets simulator: true (required by Maestro Cloud)
    cmd = "eas build --platform ios --profile maestro --no-wait --json"

    result = subprocess.run(
        cmd if is_windows else cmd.split(),
        shell=is_windows,
        capture_output=True, text=True,
        cwd=str(PROJECT_ROOT), env=env,
    )

    if result.returncode != 0:
        log(RED("âœ—"), f"EAS build failed to start:\n{result.stderr}")
        raise RuntimeError(f"EAS build error: {result.stderr[:500]}")

    # EAS returns either a JSON object {...} or an array [{...}]
    build_data = None
    try:
        parsed = json.loads(result.stdout.strip())
        # Unwrap array if needed
        build_data = parsed[0] if isinstance(parsed, list) else parsed
    except (json.JSONDecodeError, IndexError):
        # Fallback: scan line by line for a JSON object containing "id"
        for line in reversed(result.stdout.strip().splitlines()):
            try:
                obj = json.loads(line)
                if isinstance(obj, dict) and "id" in obj:
                    build_data = obj
                    break
            except json.JSONDecodeError:
                continue

    if not build_data or "id" not in build_data:
        raise RuntimeError(f"Could not parse EAS build ID from output:\n{result.stdout[:500]}")

    build_id = build_data["id"]
    log(GREEN("âœ“"), f"Build started: {build_id}")
    log(DIM("  "), f"Track at: https://expo.dev/accounts/{EAS_OWNER}/projects/tabibok-app/builds/{build_id}")
    return build_id

def eas_wait_for_build(build_id: str) -> str:
    """Poll EAS until the build finishes. Returns the artifact URL."""
    banner("EAS: Waiting for build to complete")
    is_windows = sys.platform == "win32"
    start      = time.time()
    env        = {**os.environ, "EXPO_TOKEN": os.environ.get("EXPO_TOKEN", "")}

    log(DIM("  "), f"Track live at: https://expo.dev/accounts/{EAS_OWNER}/projects/tabibok-app/builds/{build_id}")

    while True:
        elapsed = int(time.time() - start)
        try:
            cmd    = f"eas build:view {build_id} --json"
            result = subprocess.run(
                cmd if is_windows else cmd.split(),
                shell=is_windows,
                capture_output=True, text=True,
                cwd=str(PROJECT_ROOT), env=env, timeout=60,
            )

            # Parse output â€” EAS CLI may emit warnings before the JSON
            data = None
            try:
                data = json.loads(result.stdout.strip())
            except (json.JSONDecodeError, ValueError):
                for line in result.stdout.strip().splitlines():
                    try:
                        obj = json.loads(line)
                        if isinstance(obj, dict) and "status" in obj:
                            data = obj
                            break
                    except (json.JSONDecodeError, ValueError):
                        continue

            if not data:
                log(YELLOW("âš "), f"Could not parse build status ({elapsed//60}m elapsed) â€” retrying...")
                time.sleep(BUILD_POLL_SEC)
                if int(time.time() - start) > MAX_EAS_BUILD_MIN * 60:
                    raise RuntimeError(f"EAS build wait exceeded {MAX_EAS_BUILD_MIN} minutes â€” check the build page in Expo and fix any issues, then re-run.")
                continue

            status = data.get("status", "UNKNOWN")
            log(CYAN("â³"), f"Status: {status}  ({elapsed//60}m {elapsed%60}s elapsed)")

            if status == "FINISHED":
                artifact_url = (data.get("artifacts") or {}).get("buildUrl")
                if not artifact_url:
                    raise RuntimeError("Build finished but no artifact URL in response")
                log(GREEN("âœ“"), f"Build complete!")
                return artifact_url

            if status in ("ERRORED", "CANCELLED", "EXPIRED"):
                raise RuntimeError(f"EAS build ended with status: {status}\n{result.stdout[-500:]}")
                # merged line

        except subprocess.TimeoutExpired:
            log(YELLOW("âš "), "CLI poll timed out â€” retrying...")
        except Exception as e:
            log(YELLOW("âš "), f"Poll error (will retry): {e}")

        if int(time.time() - start) > MAX_EAS_BUILD_MIN * 60:
            raise RuntimeError(f"EAS build wait exceeded {MAX_EAS_BUILD_MIN} minutes â€” check the build page in Expo and fix any issues, then re-run.")
        time.sleep(BUILD_POLL_SEC)

def download_ipa(url: str) -> Path:
    """Download the .ipa from EAS artifacts."""
    if IPA_CACHE.exists():
        log(GREEN("âœ“"), f"Using cached .ipa: {IPA_CACHE}")
        return IPA_CACHE

    log(CYAN("â†’"), "Downloading .ipa...")
    resp = http("GET", url, stream=True, timeout=300)
    resp.raise_for_status()
    IPA_CACHE.write_bytes(resp.content)
    size_mb = IPA_CACHE.stat().st_size / 1_048_576
    log(GREEN("âœ“"), f"Downloaded {size_mb:.1f} MB â†’ {IPA_CACHE.name}")
    return IPA_CACHE

def _extract_app(tar_path: Path) -> Path:
    """Extract a .tar.gz archive and return either:
      - the path to the extracted .app (simulator), or
      - the path to a cached .ipa (device) if the archive contains an .ipa.
    """
    if APP_EXTRACT_DIR.exists():
        shutil.rmtree(APP_EXTRACT_DIR)
    APP_EXTRACT_DIR.mkdir(exist_ok=True)

    log(CYAN('â†’'), f'Extracting archive from {tar_path.name}...')
    with tarfile.open(tar_path, 'r:gz') as tf:
        tf.extractall(APP_EXTRACT_DIR)

    # Prefer a top-level .app directory (simulator build)
    all_app_paths = list(APP_EXTRACT_DIR.rglob('*.app'))
    top_level = [p for p in all_app_paths if '.app' not in str(p.parent.relative_to(APP_EXTRACT_DIR))]
    if top_level or all_app_paths:
        app_path = (top_level or all_app_paths)[0]
        log(GREEN('âœ“'), f'Extracted simulator .app: {app_path.name}')
        return app_path

    # If no .app, look for a device .ipa inside the tarball
    ipa_files = list(APP_EXTRACT_DIR.rglob('*.ipa'))
    if ipa_files:
        shutil.copy2(ipa_files[0], IPA_CACHE)
        size_mb = IPA_CACHE.stat().st_size / 1_048_576
        log(GREEN('âœ“'), f'Extracted device .ipa ({size_mb:.1f} MB) â†’ {IPA_CACHE.name}')
        return IPA_CACHE

    raise RuntimeError(f'No .app or .ipa found after extracting {tar_path}')

# â”€â”€â”€ Maestro Cloud helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def maestro_run_tests(ipa_path: Path, flows_dir: Path) -> dict:
    """
    Upload .ipa + flows to Maestro Cloud, run tests, return results dict.
    Uses the Maestro CLI if available, otherwise falls back to REST API.
    """
    banner("Maestro Cloud: Running tests on real iPhone")

    api_key = os.environ.get("MAESTRO_API_KEY", "")
    if not api_key:
        raise RuntimeError("MAESTRO_API_KEY not set")

    # Prefer Maestro CLI (simpler + streams logs)
    maestro_bin = shutil.which("maestro")
    if maestro_bin:
        return _maestro_cli(maestro_bin, ipa_path, flows_dir, api_key)
    else:
        log(YELLOW("âš "), "maestro CLI not found â€” falling back to REST API")
        return _maestro_rest(ipa_path, flows_dir, api_key)

def _maestro_cli(bin: str, ipa_path: Path, flows_dir: Path, api_key: str) -> dict:
    """Run via: maestro cloud --apiKey KEY --app-file app.ipa --flows flows/ --format JUNIT"""
    flow_files = list(flows_dir.glob("*.yaml"))
    if not flow_files:
        raise RuntimeError(f"No .yaml flow files found in {flows_dir}")

    log(CYAN("â†’"), f"Uploading {len(flow_files)} test flows + .ipa to Maestro Cloud...")

    is_windows = sys.platform == "win32"
    creds      = get_test_creds()
    report_path = Path(__file__).parent / "maestro_report.xml"

    # Always delete stale report so we never accidentally read results from a previous run
    report_path.unlink(missing_ok=True)

    # -e KEY=VALUE is the correct format for Maestro Cloud env vars
    env_flags = (
        f'-e TEST_PATIENT_EMAIL={creds["patient_email"]} '
        f'-e TEST_DOCTOR_EMAIL={creds["doctor_email"]} '
        f'-e TEST_RECEPTIONIST_EMAIL={creds["receptionist_email"]} '
        f'-e TEST_PASSWORD={creds["password"]}'
    )
    # --timeout=150: Maestro Cloud waits up to 150 min for all flows to finish
    # (default 60 min is too short for 20 flows Ã— ~2-3 min each + overhead)
    cmd = (f'maestro cloud --apiKey {api_key} --app-file "{ipa_path}" '
           f'--format JUNIT --output "{report_path}" '
           f'--timeout=150 '
           f'{env_flags} --flows "{flows_dir}"')

    env_list = [
        "-e", f'TEST_PATIENT_EMAIL={creds["patient_email"]}',
        "-e", f'TEST_DOCTOR_EMAIL={creds["doctor_email"]}',
        "-e", f'TEST_RECEPTIONIST_EMAIL={creds["receptionist_email"]}',
        "-e", f'TEST_PASSWORD={creds["password"]}',
    ]
    # Stream output to terminal AND capture it so Phase 4 can read the error text.
    # Our subprocess timeout is generous â€” actual bound is Maestro's own --timeout=150.
    CLOUD_TIMEOUT = 10800  # 3 hours (outer safety net only)

    proc_cmd = (cmd if is_windows
                else [bin, "cloud", "--apiKey", api_key,
                      "--app-file", str(ipa_path),
                      "--format", "JUNIT", "--output", str(report_path),
                      "--timeout=150",
                      *env_list, "--flows", str(flows_dir)])

    proc = subprocess.Popen(
        proc_cmd,
        shell=is_windows,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,   # merge stderr into stdout stream
        text=True, bufsize=1,
    )

    captured_lines: list[str] = []

    def _stream(stream: object) -> None:
        for line in iter(stream.readline, ""):  # type: ignore[attr-defined]
            sys.stdout.write(line)
            sys.stdout.flush()
            captured_lines.append(line)

    reader_thread = threading.Thread(target=_stream, args=(proc.stdout,), daemon=True)
    reader_thread.start()

    timed_out = False
    try:
        proc.wait(timeout=CLOUD_TIMEOUT)
    except subprocess.TimeoutExpired:
        proc.kill()
        timed_out = True
        log(YELLOW("âš "), f"Maestro CLI timed out after {CLOUD_TIMEOUT//60} min â€” "
                          f"reading partial JUNIT report if available")
    finally:
        reader_thread.join(timeout=10)

    exit_code    = proc.returncode if proc.returncode is not None else 1
    full_output  = "".join(captured_lines)
    # Expose a result-like object for the code below
    result = type("R", (), {"returncode": exit_code})()

    # Parse JUNIT XML report if written
    if report_path.exists():
        try:
            import xml.etree.ElementTree as ET
            tree = ET.parse(report_path)
            root = tree.getroot()
            # Handle both <testsuites> and <testsuite> roots
            suites = root.findall("testsuite") or [root]
            total_tests = sum(int(s.get("tests", 0)) for s in suites)
            total_failures = sum(int(s.get("failures", 0)) + int(s.get("errors", 0)) for s in suites)
            passed = total_tests - total_failures
            failed = total_failures
            flow_results = []
            for tc in root.findall(".//testcase"):
                name = tc.get("name", "unknown")
                is_failed = tc.find("failure") is not None or tc.find("error") is not None
                flow_results.append({"name": name, "status": "FAILED" if is_failed else "PASSED"})
            summary = "\n".join(
                f"  {'âŒ' if r['status']=='FAILED' else 'âœ…'} {r['name']}" for r in flow_results
            )
            return {
                "passed": passed,
                "failed": failed,
                "flow_results": flow_results,
                "success": failed == 0,
                "raw_output": f"JUNIT report: {total_tests} tests, {total_failures} failures\n{summary}",
            }
        except Exception as e:
            log(YELLOW("âš "), f"Could not parse JUNIT report: {e}")

    # â”€â”€ Classify the failure â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    # "upload error" = Maestro rejected the YAML before any test ran
    # "cloud timeout" = tests ran but not all finished within Maestro's --timeout
    # "runtime failures" = tests ran and some/all failed
    #
    # Maestro output signals:
    #   YAML error   â†’ "Invalid Command Format" / "Error parsing" / "Invalid flow"
    #   Cloud timeout â†’ "Waiting for flows to complete has timed out"
    _YAML_ERROR_SIGNALS = (
        "Invalid Command Format",
        "Invalid Maestro command",
        "Error parsing",
        "Unknown command",
        "Invalid flow",
        "Failed to parse",
    )
    is_yaml_error    = any(s in full_output for s in _YAML_ERROR_SIGNALS)
    is_cloud_timeout = "Waiting for flows to complete has timed out" in full_output
    tests_ran        = bool(re.search(r"\[(Failed|Passed)\]", full_output))

    if is_yaml_error and not tests_ran:
        # Real upload/YAML error â€” no tests ran at all
        return {
            "passed": 0,
            "failed": 0,
            "raw_output": full_output.strip() or f"Maestro CLI exited with code {exit_code}.",
            "success": False,
            "upload_error": True,
        }

    # Tests ran (possibly with timeout) â€” parse CLI output for pass/fail counts
    passed_flows, failed_flows, errors = [], [], {}
    for line in full_output.splitlines():
        m = re.match(r"\[Passed\]\s+(\S+)", line)
        if m:
            passed_flows.append(m.group(1))
            continue
        m = re.match(r"\[Failed\]\s+(\S+)\s+\([^)]+\)\s+\((.+)\)", line)
        if m:
            fname, err = m.group(1), m.group(2)
            failed_flows.append(fname)
            errors[fname] = err

    flow_results = (
        [{"name": f, "status": "PASSED"} for f in passed_flows] +
        [{"name": f, "status": "FAILED", "error": errors.get(f, "")} for f in failed_flows]
    )
    summary_lines = [
        f"  {'âœ…' if r['status']=='PASSED' else 'âŒ'} {r['name']}"
        + (f"  â€” {r.get('error','')}" if r.get('error') else "")
        for r in flow_results
    ]
    timeout_note = "\nâš  Cloud timeout â€” some flows may not have reported." if is_cloud_timeout else ""
    raw = f"CLI output: {len(passed_flows)} passed, {len(failed_flows)} failed{timeout_note}\n"
    raw += "\n".join(summary_lines)
    raw += "\n\nFull CLI output:\n" + full_output[:8000]

    return {
        "passed":       len(passed_flows),
        "failed":       len(failed_flows),
        "flow_results": flow_results,
        "raw_output":   raw,
        "success":      len(failed_flows) == 0 and not is_cloud_timeout,
        "upload_error": False,
    }

def _maestro_rest(ipa_path: Path, flows_dir: Path, api_key: str) -> dict:
    """Fall-back: Maestro Cloud REST API."""
    # Zip flows directory
    zip_path = Path(__file__).parent / "_maestro_flows.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        for f in flows_dir.glob("*.yaml"):
            zf.write(f, f.name)

    # If ipa_path points to a simulator .app directory, zip it first for REST upload
    app_upload_path = ipa_path
    app_upload_name = 'app.ipa'
    if ipa_path.is_dir():
        sim_zip = Path(__file__).parent / "_sim_app.zip"
        if sim_zip.exists(): sim_zip.unlink()
        with zipfile.ZipFile(sim_zip, 'w', zipfile.ZIP_DEFLATED) as z:
            for root, _, files in os.walk(ipa_path):
                root_p = Path(root)
                for fname in files:
                    fpath = root_p / fname
                    z.write(str(fpath), str(fpath.relative_to(ipa_path.parent)))
        app_upload_path = sim_zip
        app_upload_name = 'app.zip'

    log(CYAN('â†’'), 'Uploading to Maestro Cloud REST API...')
    with open(app_upload_path, 'rb') as ipa_f, open(zip_path, 'rb') as zip_f:
        resp = http(
            "POST", f"{MAESTRO_API}/upload",
            headers={"Authorization": f"Bearer {api_key}"},
            files={
                "app":       (app_upload_name, ipa_f, 'application/zip' if app_upload_name.endswith('.zip') else 'application/octet-stream'),
                "workspace": ("flows.zip", zip_f, "application/zip"),
            },
            timeout=300,
        )

    resp.raise_for_status()
    run_data = resp.json()
    run_id   = run_data.get("uploadId") or run_data.get("id")
    if not run_id:
        raise RuntimeError(f"No run ID in Maestro response: {run_data}")

    log(GREEN("âœ“"), f"Run started: {run_id}")
    return _maestro_poll(run_id, api_key)

def _maestro_poll(run_id: str, api_key: str) -> dict:
    """Poll Maestro Cloud until the run finishes."""
    headers = {"Authorization": f"Bearer {api_key}"}
    start   = time.time()

    while True:
        elapsed = int(time.time() - start)
        resp    = http(
            "GET", f"{MAESTRO_API}/run/{run_id}",
            headers=headers, timeout=30,
        )
        data   = resp.json()
        status = data.get("status", "PENDING")
        log(CYAN("⏳"), f"Maestro: {status}  ({elapsed//60}m {elapsed%60}s)")

        if status in ("SUCCESS", "ERROR", "CANCELED", "COMPLETED"):
            log(GREEN("✓") if status == "SUCCESS" else RED("✗"), f"Run finished: {status}")
            return data

        if int(time.time() - start) > MAX_MAESTRO_REST_MIN * 60:
            log(YELLOW('⚠'), f'Maestro REST poll timed out after {MAX_MAESTRO_REST_MIN} min')
            return {'status': 'TIMEOUT', 'timeout': True}
        time.sleep(30)

# ─────────────────────────────────────────────────────────────────────────────
ENGINEER_SYSTEM =  """
You are a senior iOS QA Engineer specialising in Maestro test automation for
React Native / Expo apps. You design comprehensive, realistic test scenarios
that cover happy paths, edge cases, and iOS-specific behaviours.

You output structured JSON or Maestro YAML â€” never plain prose unless asked.
""".strip()

BUILDER_SYSTEM = """
You are an elite React Native iOS engineer who writes Maestro test flows and
fixes source code failures. You reason step-by-step before writing.

Maestro YAML rules:
  â€¢ Every flow starts with: appId: com.abdullah.reacttabibok
  â€¢ Then --- on its own line
  â€¢ Commands: launchApp, tapOn, assertVisible, inputText, swipe,
              scrollUntilVisible, waitForAnimationToEnd, runFlow, takeScreenshot
  â€¢ tapOn matches by text, testID, or index (0-based)
  â€¢ assertVisible checks text or testID is on screen
  â€¢ Use clearState (NOT clearKeychain) to wipe auth state before login flows
  â€¢ Patient role uses phone/OTP â€” NEVER try to email-login as Patient
  â€¢ Doctor/Receptionist login: tapOn "Doctor"/"Receptionist" â†’ EmailLoginScreen appears
    with "Email Address" field and "Enter your email" / "Enter your password" placeholders
  â€¢ There is NO "Sign in with Email" button anywhere â€” do NOT include that step

CRITICAL SYNTAX â€” Maestro Cloud rejects these patterns immediately:
  â€¢ NEVER add sub-properties to inline commands (inputText, assertVisible,
    assertNotVisible, eraseText, back, scroll, clearState, clearKeychain,
    launchApp, stopApp, waitForAnimationToEnd).
    These take ONE value on the same line â€” no indented block below them.
    WRONG:  - inputText: "hello"\n    id: "field"
    RIGHT:  - tapOn: "field"\n- inputText: "hello"
  â€¢ NEVER use swipeLeft/swipeRight/swipeUp/swipeDown â€” use swipe: with direction:
  â€¢ NEVER use pressBack (Android only) â€” use: - back
  â€¢ NEVER use optional: true â€” not a valid Maestro property
  â€¢ takeScreenshot ALWAYS needs a name: takeScreenshot: "name"

When fixing code: output ONLY the complete corrected file in a JS code block.
""".strip()

# â”€â”€â”€ Phase 1: Generate Maestro test flows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def phase1_generate_flows(client: OpenAI, screens: dict[str, str]) -> dict[str, str]:
    banner("Phase 1 â€” Engineer + Builder: generating Maestro test flows")
    FLOWS_DIR.mkdir(exist_ok=True)

    # Step A: Engineer designs test scenarios
    log(CYAN("â†’"), "Engineer designing test scenarios...")
    file_list = "\n".join(f"  â€¢ {k}" for k in sorted(screens))

    e_prompt = f"""
Design Maestro test scenarios for this React Native / Expo app.
App ID: com.abdullah.reacttabibok

SCREENS:
{file_list}

USER ROLES: Patient | Doctor | Receptionist

For each screen, define test scenarios as JSON:
{{
  "flows": [
    {{
      "filename":    "01_auth_role_selection.yaml",
      "screen":      "src/screens/auth/RoleSelectionScreen.js",
      "description": "User selects Patient role",
      "role":        "patient|doctor|receptionist|any",
      "priority":    "critical|high|medium|low",
      "steps": [
        "Launch app",
        "Verify role selection screen is visible",
        "Tap Patient button",
        "Verify next screen appears"
      ]
    }}
  ]
}}

Cover: auth flow, main dashboard, key features per role, navigation, forms.
Focus on critical + high priority first. Max 20 flows total.
"""

    e_raw       = chat(client, ENGINEER_MODEL, ENGINEER_SYSTEM,
                       [{"role": "user", "content": e_prompt}])
    scenario_data = extract_json(e_raw) or {"flows": []}
    scenarios   = scenario_data.get("flows", [])
    log(GREEN("âœ“"), f"{len(scenarios)} test scenarios designed")

    # Step B: Builder writes YAML for each scenario
    log(CYAN("â†’"), "Builder writing Maestro YAML flows...")
    flows: dict[str, str] = {}

    for i, scenario in enumerate(scenarios, 1):
        fname    = scenario.get("filename", f"flow_{i:02d}.yaml")
        src_file = scenario.get("screen", "")
        steps    = scenario.get("steps", [])
        desc     = scenario.get("description", "")

        # Include source code for the relevant screen
        screen_code = screens.get(src_file, "")
        if not screen_code and src_file:
            # Try partial match
            for k, v in screens.items():
                if Path(src_file).name in k:
                    screen_code = v
                    break

        b_prompt = f"""
Write a Maestro YAML test flow for this scenario.

SCENARIO: {desc}
FILENAME: {fname}
STEPS REQUIRED:
{json.dumps(steps, indent=2)}

SCREEN SOURCE CODE:
```javascript
{screen_code[:6000] if screen_code else "(not found)"}
```

Output ONLY the complete Maestro YAML inside a yaml code block.
Rules:
- First line: appId: com.abdullah.reacttabibok
- Second line: ---
- Use assertVisible to check screen loaded before tapping
- Add waitForAnimationToEnd after navigation taps
- Use takeScreenshot after key assertions
- For auth screens: add clearState at start for clean state (NOT clearKeychain)
- Doctor/Receptionist login flow: clearState â†’ launchApp â†’ waitForAnimationToEnd
  â†’ assertVisible: "Choose your role to continue" â†’ waitForAnimationToEnd
  â†’ tapOn: "Doctor" (or "Receptionist") â†’ waitForAnimationToEnd
  â†’ assertVisible: "Email Address" â†’ tapOn: "Enter your email" â†’ inputText: ${{TEST_DOCTOR_EMAIL}}
  â†’ tapOn: "Enter your password" â†’ inputText: ${{TEST_PASSWORD}} â†’ tapOn: "Sign In"
- Patient uses phone/OTP auth only â€” NEVER attempt email login for Patient role
- There is NO "Sign in with Email" button in the app â€” do NOT include that step
- Use text as it appears in the Arabic/English UI (use English text)
- Do NOT test with real phone numbers or OTPs â€” mock or skip those steps
STRICT SYNTAX RULES (Maestro Cloud will reject invalid YAML):
- NEVER use "optional: true" â€” it is not a valid Maestro property
- NEVER use "any:" inside assertVisible â€” use a single string only: assertVisible: "text"
- NEVER use "or:" at the same level as assertVisible â€” not supported
- NEVER use "visibleOnly:" â€” not a valid property
- NEVER use "into:" on inputText â€” use a separate tapOn before inputText
- tapOn only accepts: text, id, point, index (no optional, no visibleOnly)
- assertVisible only accepts: text, id (no any, no or)
- takeScreenshot ALWAYS requires a name: takeScreenshot: "my_screenshot_name" â€” bare "takeScreenshot" is invalid
- NEVER use swipeLeft/swipeRight/swipeUp/swipeDown â€” use: swipe:\n    direction: LEFT (or RIGHT/UP/DOWN)\n    duration: 500
- NEVER give `scroll` sub-properties like direction/amount â€” `scroll` is standalone only. For directional scrolling use swipe: with direction: and duration:
- NEVER use "pressBack" â€” Android-only; does not exist on iOS. Use "- back" instead
- NEVER use "hideKeyboard" â€” not a valid Maestro command; just omit it
- NEVER use "clearText" â€” not a valid command; use "- eraseText: 50" to clear a field
- NEVER use "scrollDown" or "scrollUp" alone â€” use "- scroll" (scrolls the current view)
- NEVER use "click:" â€” use "- tapOn:"
- NEVER use "type:" â€” use "- inputText:"
- NEVER use "verify:" â€” use "- assertVisible:"
- NEVER use "setText:" â€” use tapOn then inputText
- NEVER add sub-properties (id:, label:, into:, element:, etc.) to inline commands
  (inputText, eraseText, assertVisible, assertNotVisible, back, scroll, clearState,
  clearKeychain, launchApp, stopApp, waitForAnimationToEnd).
  These commands accept ONE value on the same line only.
  WRONG:  - inputText: "Hello"\n    id: "message_input"
  CORRECT: - tapOn: "message_input"\n- inputText: "Hello"
- If a step might fail, simply omit it rather than using optional
"""

        raw  = chat(client, BUILDER_MODEL, BUILDER_SYSTEM,
                    [{"role": "user", "content": b_prompt}])
        yaml = extract_code(raw)
        if yaml:
            # Ensure appId header is present
            if "appId:" not in yaml:
                yaml = f"appId: {APP_ID}\n---\n{yaml}"
            flows[fname] = yaml
            flow_path = FLOWS_DIR / fname
            flow_path.write_text(yaml, encoding="utf-8")
            log(GREEN("âœ“"), f"  {fname}", 4)
        else:
            log(YELLOW("âš "), f"  No YAML extracted for {fname}", 4)

    log(GREEN("âœ“"), f"{len(flows)} Maestro flow files written to {FLOWS_DIR.name}/")

    # Post-process: fix common invalid Maestro YAML syntax
    _fix_maestro_yaml_syntax(FLOWS_DIR)

    return flows

def _fix_maestro_yaml_syntax(flows_dir: Path) -> None:
    """Fix invalid Maestro YAML syntax patterns in all flow files."""
    import re as _re
    fixed_count = 0
    for f in sorted(flows_dir.glob("*.yaml")):
        content = f.read_text(encoding="utf-8")
        original = content
        basename = _re.sub(r"[^a-zA-Z0-9]", "_", f.stem)
        counter = [0]

        def replace_bare_screenshot(m):
            counter[0] += 1
            return f'{m.group(1)}- takeScreenshot: "{basename}_{counter[0]}"'

        content = _re.sub(
            r"^([ \t]*)- takeScreenshot\s*$",
            replace_bare_screenshot,
            content, flags=_re.MULTILINE,
        )
        # assertVisible: any: [...] â†’ assertVisible: "first item"
        content = _re.sub(
            r"^([ \t]*)- assertVisible:\s*\n\1  any:\s*\n\1    - (.+)",
            lambda m: f'{m.group(1)}- assertVisible: "{m.group(2).strip().strip(chr(34)).strip(chr(39))}"',
            content, flags=_re.MULTILINE,
        )
        # Remove trailing "or:" blocks
        content = _re.sub(r"\n[ \t]+or:\s*\n(?:[ \t]+-[^\n]*\n)*", "\n", content)
        # Remove "optional: true" and "visibleOnly: true" lines
        content = _re.sub(r"^[ \t]+optional: true\s*$\n?", "", content, flags=_re.MULTILINE)
        content = _re.sub(r"^[ \t]+visibleOnly: true\s*$\n?", "", content, flags=_re.MULTILINE)

        # Fix swipeLeft/Right/Up/Down â†’ swipe: direction: DIR
        def _fix_swipe(m):
            direction = m.group(1).upper()
            indent = m.group(2)
            rest = m.group(3)  # any sub-keys after swipeXxx:
            return f"{indent}- swipe:\n{indent}    direction: {direction}\n{indent}    duration: 500"
        content = _re.sub(
            r"^([ \t]*)- swipe(Left|Right|Up|Down):(.*)",
            lambda m: f"{m.group(1)}- swipe:\n{m.group(1)}    direction: {m.group(2).upper()}\n{m.group(1)}    duration: 500",
            content, flags=_re.MULTILINE | _re.IGNORECASE,
        )
        # Remove sub-keys that belonged to swipeXxx (element:, index:)
        # (handled by the swipe: direction: pattern above overwriting the block)

        if content != original:
            f.write_text(content, encoding="utf-8")
            fixed_count += 1
    if fixed_count:
        log(GREEN("âœ“"), f"Auto-fixed YAML syntax in {fixed_count} flow files")

# â”€â”€â”€ Phase 1b: Inject login steps into every flow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def phase1b_inject_login(flows: dict[str, str]) -> dict[str, str]:
    """
    Prepend a full login sequence to every non-auth flow so Maestro Cloud
    can reach the actual screen under test.

    Auth flows (role selection, OTP, etc.) are left untouched â€” they ARE
    the login flow.
    """
    banner("Phase 1b â€” Injecting login steps into flows")
    creds   = get_test_creds()
    updated = {}

    for fname, content in flows.items():
        role = flow_role(fname)

        if role == "auth":
            updated[fname] = content
            log(DIM("  Â·"), f"{fname}  (auth flow â€” no login prefix)")
            continue

        # Guard: skip if login block was already injected (idempotency)
        if "Auto-injected login" in content:
            updated[fname] = content
            log(DIM("  Â·"), f"{fname}  (login already present â€” skipped)")
            continue

        # Split the flow at the --- separator and inject login after it
        if "---" in content:
            header, _, body = content.partition("---")
            new_content = f"{header.strip()}\n---\n{login_block(role, creds)}\n{body.strip()}\n"
        else:
            # No separator found â€” prepend after appId line
            lines = content.splitlines()
            insert_at = next((i+1 for i, l in enumerate(lines) if l.startswith("appId:")), 0)
            lines.insert(insert_at, "\n---")
            lines.insert(insert_at + 1, login_block(role, creds))
            new_content = "\n".join(lines)

        updated[fname] = new_content

        # Write back to disk
        flow_path = FLOWS_DIR / fname
        flow_path.write_text(new_content, encoding="utf-8")
        log(GREEN("âœ“"), f"{fname}  [{role}]")

    log(GREEN("âœ“"), f"Login injected into {sum(1 for f in flows if flow_role(f) != 'auth')} flows")
    return updated

# â”€â”€â”€ YAML Sanitizer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

# â”€â”€ Complete set of valid Maestro top-level command names (whitelist) â”€â”€â”€â”€â”€â”€â”€â”€â”€
_VALID_MAESTRO_COMMANDS = {
    # App lifecycle
    "launchApp", "stopApp", "clearState", "clearKeychain",
    # Interaction
    "tapOn", "longPressOn", "doubleTapOn", "pressKey", "back",
    "inputText", "eraseText", "copyTextFrom", "pasteText",
    # Gestures
    "scroll", "scrollUntilVisible", "swipe",
    # Assertions
    "assertVisible", "assertNotVisible", "assertTrue", "assertNoDefectsWithAI",
    # Timing / control flow
    "waitForAnimationToEnd", "runFlow", "repeat", "runScript",
    # Media
    "takeScreenshot", "startRecording", "stopRecording",
    # Network / device
    "openLink", "setLocation", "travel",
    "setAirplaneMode", "toggleWifi", "toggleBluetooth",
    # Env / env vars
    "evalScript", "env",
    # Maestro AI
    "aiAction", "aiAssert",
}

# Known invalid commands â†’ their correct Maestro replacements.
# Each entry: (bad_string, good_string).  Order: specific first.
_YAML_REPLACEMENTS = [
    ("- pressBack",          "- back"),
    ("- hideKeyboard",       ""),
    ("- clearText",          "- eraseText: 50"),
    ("- scroll:",             "- scroll"),   # bare scroll: with colon is invalid
    ("- scrollDown",         "- scroll"),
    ("- scrollUp",           "- scroll"),
    ("- click:",             "- tapOn:"),
    ("- type:",              "- inputText:"),
    ("- verify:",            "- assertVisible:"),
    ("- setText:",           "- inputText:"),
    ("- tapByText:",         "- tapOn:"),
    ("- findElement:",       "- assertVisible:"),
    ("- screenshot:",        "- takeScreenshot:"),
    ("- screenshot",         "- takeScreenshot: \"screenshot\""),
    ("- dragAndDrop:",       ""),   # not supported â€” omit
    ("- checkElement:",      "- assertVisible:"),
]

import re as _re

# Regex: catch `- clearText` with any trailing argument
_CLEAR_TEXT_RE = _re.compile(r"^(\s*)-\s*clearText(\s*:.*)?\s*$", _re.MULTILINE)

def _fix_cleartext(m: "_re.Match") -> str:
    return m.group(1) + "- eraseText: 50"

# Regex: catch `- scroll` (or `- scrollDown/Up`) followed by indented sub-properties
# (direction:, amount:, duration:) and convert to a proper `swipe:` block.
_SCROLL_PROPS_RE = _re.compile(
    r"([ \t]*)-[ \t]+scroll(?:Down|Up)?[ \t]*\n"
    r"((?:[ \t]+(?:direction|amount|duration|start|end|speed)[^\n]*\n)+)",
    _re.MULTILINE,
)

def _fix_scroll_props(m: "_re.Match") -> str:
    indent = m.group(1)
    props  = m.group(2)
    # Try to extract direction value
    dm = _re.search(r"direction:\s*([A-Za-z]+)", props)
    direction = dm.group(1).upper() if dm else "DOWN"
    return f"{indent}- swipe:\n{indent}    direction: {direction}\n{indent}    duration: 500\n"

# Regex: strip invalid sub-properties from inline single-value commands.
# These commands only accept one string on the same line â€” any indented block
# below them (e.g. "  id: message_input") is invalid and causes upload rejection.
_INLINE_SUBPROP_RE = _re.compile(
    r"([ \t]*-[ \t]+(?:inputText|eraseText|assertVisible|assertNotVisible|back|scroll"
    r"|clearKeychain|clearState|launchApp|stopApp|waitForAnimationToEnd)"
    r":[ \t]+[^\n]+)\n"
    r"((?:[ \t]+[a-zA-Z_][^\n]*\n)+)",
    _re.MULTILINE,
)

def _strip_inline_subprops(m: "_re.Match") -> str:
    # Keep the command line; discard the sub-property block that follows it
    return m.group(1) + "\n"

def sanitize_flows(flows_dir: Path):
    """
    1. Apply known badâ†’good string replacements.
    2. Detect any remaining unknown top-level command and comment it out
       so Maestro doesn't reject the whole suite.
    """
    for flow_file in sorted(flows_dir.glob("*.yaml")):
        content = flow_file.read_text(encoding="utf-8")
        original = content

        # â”€â”€ Pass 1: string replacements â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        for bad, good in _YAML_REPLACEMENTS:
            if bad in content:
                content = content.replace(bad, good)

        # â”€â”€ Pass 2: regex for clearText with args â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        content = _CLEAR_TEXT_RE.sub(_fix_cleartext, content)

        # â”€â”€ Pass 2b: scroll with sub-properties â†’ swipe â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        content = _SCROLL_PROPS_RE.sub(_fix_scroll_props, content)

        # â”€â”€ Pass 2c: strip invalid sub-properties from inline commands â”€â”€â”€â”€â”€â”€â”€â”€
        # e.g.  - inputText: "hello"\n  id: "field"  â†’  - inputText: "hello"
        content = _INLINE_SUBPROP_RE.sub(_strip_inline_subprops, content)

        # â”€â”€ Pass 3: whitelist â€” comment out any unknown top-level command â”€â”€â”€â”€
        lines_out = []
        for line in content.splitlines():
            # Match lines like "  - someCamelCommand" or "  - someCamelCommand:"
            m = _re.match(r"^(\s*)-\s+([a-zA-Z][a-zA-Z0-9_]+)(:\s*.*|)\s*$", line)
            if m:
                cmd = m.group(2)
                # Skip known-good structural keys and multi-word values
                if cmd not in _VALID_MAESTRO_COMMANDS and cmd[0].islower():
                    # Comment it out rather than deleting (easier to debug)
                    lines_out.append(f"# SANITIZED (invalid cmd '{cmd}'): {line.strip()}")
                    continue
            lines_out.append(line)
        content = "\n".join(lines_out)

        # â”€â”€ Pass 4: collapse excess blank lines â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        content = _re.sub(r"\n{3,}", "\n\n", content)

        if content != original:
            flow_file.write_text(content, encoding="utf-8")
            log(YELLOW("âš "), f"sanitized {flow_file.name}  (invalid commands replaced)")

# â”€â”€â”€ Phase 2: EAS Build â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def phase2_build(use_cached: bool = False) -> Path:
    banner("Phase 2 â€” EAS Build: creating signed .ipa")

    if use_cached and IPA_CACHE.exists():
        log(GREEN("âœ“"), f"Using cached .ipa from previous build: {IPA_CACHE}")
        return IPA_CACHE

    build_id    = eas_trigger_build()
    artifact_url = eas_wait_for_build(build_id)
    ipa_path    = download_ipa(artifact_url)
    return ipa_path

# â”€â”€â”€ Phase 3: Run tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def phase3_run_tests(ipa_path: Path) -> dict:
    return maestro_run_tests(ipa_path, FLOWS_DIR)

# â”€â”€â”€ Phase 4: Analyse results and fix failures â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def phase4_analyse_and_fix(client: OpenAI, results: dict,
                            screens: dict[str, str], round_num: int) -> dict[str, str]:
    banner(f"Phase 4 â€” Round {round_num}: Analysing results + fixing failures")

    passed       = results.get("passed", 0)
    failed       = results.get("failed", 0)
    upload_error = results.get("upload_error", False)
    raw_output   = results.get("raw_output", json.dumps(results, indent=2))

    log(CYAN("â†’"), f"Passed: {passed}  Failed: {failed}"
        + ("  [YAML upload error]" if upload_error else ""))

    if failed == 0 and not upload_error:
        log(GREEN("âœ“"), "All tests passed â€” no fixes needed!")
        return {}

    if upload_error:
        log(YELLOW("âš "), "YAML upload error â€” Engineer will analyse and fix invalid commands...")

    # Engineer triages failures (or upload error)
    if upload_error:
        e_prompt = f"""
Maestro Cloud rejected the test flow upload with this error (round {round_num}):

{raw_output[:6000]}

The error is caused by an invalid Maestro command in one of the YAML flow files.
Common culprits on iOS: pressBack (use: back), hideKeyboard (omit entirely),
optional: true (omit), swipeLeft/swipeRight (use swipe with direction:).

Identify the broken file(s) and the exact fix needed.

Output JSON (use the ACTUAL filenames from the error above â€” do NOT invent names):
{{
  "code_fixes": [],
  "test_fixes": [
    {{
      "flow_file":   "<exact filename from the error message above>",
      "problem":     "<what is wrong>",
      "fix":         "<what to change>"
    }}
  ],
  "skip_retest": false
}}
"""
    else:
        e_prompt = f"""
Test results from Maestro Cloud (round {round_num}):

{raw_output[:6000]}

Triage these failures. For each failure determine:
1. Is it a CODE bug (fixable in JS) or a TEST bug (wrong selector/timing)?
2. What file needs to change?
3. What is the minimal fix?

Output JSON:
{{
  "code_fixes": [
    {{
      "file":        "src/screens/path/file.js",
      "problem":     "what is broken",
      "fix":         "what to change"
    }}
  ],
  "test_fixes": [
    {{
      "flow_file":   "01_flow_name.yaml",
      "problem":     "what selector/step is wrong",
      "fix":         "corrected step"
    }}
  ],
  "skip_retest": false
}}

Set skip_retest=true only if all failures are minor test-selector issues fixed inline.
"""

    e_raw    = chat(client, ENGINEER_MODEL, ENGINEER_SYSTEM,
                    [{"role": "user", "content": e_prompt}])
    triage   = extract_json(e_raw) or {"code_fixes": [], "test_fixes": [], "skip_retest": False}

    fixed_files: dict[str, str] = {}

    # Fix source code issues
    for fix in triage.get("code_fixes", []):
        fpath   = fix.get("file", "")
        problem = fix.get("problem", "")
        fix_desc = fix.get("fix", "")
        current = screens.get(fpath, "")
        if not current:
            log(YELLOW("âš "), f"Source not found: {fpath}", 4)
            continue

        b_prompt = f"""
Fix this iOS bug found during automated testing.

FILE: {fpath}
PROBLEM: {problem}
REQUIRED FIX: {fix_desc}

CURRENT FILE:
```javascript
{current}
```

Output the COMPLETE fixed file in a javascript code block. No commentary.
"""
        raw  = chat(client, BUILDER_MODEL, BUILDER_SYSTEM,
                    [{"role": "user", "content": b_prompt}], max_tokens=12000)
        code = extract_js(raw)
        if code:
            full_path = PROJECT_ROOT / fpath
            full_path.write_text(code, encoding="utf-8")
            fixed_files[fpath] = code
            log(GREEN("âœ“"), f"Fixed: {fpath}", 4)
        else:
            log(YELLOW("âš "), f"Could not extract fix for {fpath}", 4)

    # Fix test flow issues
    for fix in triage.get("test_fixes", []):
        fname    = fix.get("flow_file", "")
        fix_desc = fix.get("fix", "")
        fpath    = FLOWS_DIR / fname
        if not fpath.exists():
            continue

        b_prompt = f"""
Fix this Maestro test flow. The selector or timing is wrong.

FLOW FILE: {fname}
PROBLEM: {fix.get("problem", "")}
FIX NEEDED: {fix_desc}

CURRENT FLOW:
```yaml
{fpath.read_text(encoding="utf-8")}
```

Output the COMPLETE corrected flow in a yaml code block.
"""
        log(CYAN("â†’"), f"Builder rewriting {fname}...", 4)
        raw  = chat(client, BUILDER_MODEL, BUILDER_SYSTEM,
                    [{"role": "user", "content": b_prompt}])
        yaml_fixed = extract_code(raw)
        if yaml_fixed:
            fpath.write_text(yaml_fixed, encoding="utf-8")
            log(GREEN("âœ“"), f"Fixed flow: {fname}", 4)
        else:
            log(YELLOW("âš "), f"Builder returned no YAML for {fname} â€” skipping", 4)

    # Always run the sanitizer after AI-generated fixes (catches regressed bad commands)
    sanitize_flows(FLOWS_DIR)

    log(GREEN("âœ“"), f"{len(fixed_files)} source file(s) fixed")
    return fixed_files

# â”€â”€â”€ Phase 5: Final report â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def phase5_report(client: OpenAI, all_results: list[dict],
                  total_fixed: int, flows: dict[str, str]) -> str:
    banner("Phase 5 â€” Engineer: writing final test report")

    last = all_results[-1] if all_results else {}

    results_summary = json.dumps(
        [{"round": i+1, "passed": r.get("passed", 0),
          "failed": r.get("failed", 0), "status": r.get("status", "?")}
         for i, r in enumerate(all_results)],
        indent=2
    )

    prompt = f"""
Write a complete iOS automated test report for Tabibok Health.

TESTING SUMMARY:
  Test rounds    : {len(all_results)}
  Total flows    : {len(flows)}
  Source fixes   : {total_fixed}
  Final passed   : {last.get("passed", "?")}
  Final failed   : {last.get("failed", "?")}

ROUND RESULTS:
{results_summary}

FLOWS TESTED:
{json.dumps(list(flows.keys()), indent=2)}

Write Markdown:
# iOS Automated Test Report â€” Tabibok Health
## Executive Summary
## Test Results by Round  (table: Round | Passed | Failed | Action Taken)
## Flows Tested  (table: Flow | Screen | Status)
## Source Code Fixes Applied
## Remaining Issues  (anything still failing)
## Next Steps
"""

    report = chat(client, ENGINEER_MODEL, ENGINEER_SYSTEM,
                  [{"role": "user", "content": prompt}], max_tokens=4096)
    log(GREEN("âœ“"), "Report generated")
    return report

# â”€â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def parse_args():
    """
    Supports optional flags:
      --ipa <url|path>   Skip EAS build â€” use this .ipa directly.
                         Can be a https:// download URL or a local file path.
      --fresh            Force regenerate flows even if checkpoint exists
                         or maestro_flows/ already has cached YAML files.

    Examples:
      python ios_test_agent.py
      python ios_test_agent.py --ipa https://expo.dev/.../build.ipa
      python ios_test_agent.py --ipa C:/Downloads/tabibok.ipa
    """
    args   = sys.argv[1:]
    result = {"ipa": None, "fresh": False}
    i = 0
    while i < len(args):
        if args[i] == "--ipa" and i + 1 < len(args):
            result["ipa"] = args[i + 1]
            i += 2
        elif args[i] == "--fresh":
            result["fresh"] = True
            i += 1
        else:
            i += 1
    return result

def resolve_ipa(ipa_arg: str) -> Path:
    """Download URL â†’ cache, or copy local file â†’ cache.
    Handles both .ipa (device) and .tar.gz (simulator) EAS artifacts.
    For simulator .tar.gz: downloads â†’ extracts â†’ returns path to .app bundle.
    """
    is_tar = ".tar.gz" in ipa_arg or ipa_arg.endswith(".gz")

    if ipa_arg.startswith("http"):
        if is_tar:
            if not TAR_CACHE.exists():
                log(CYAN("â†’"), "Downloading simulator build (.tar.gz)...")
                resp = http("GET", ipa_arg, stream=True, timeout=300)
                resp.raise_for_status()
                TAR_CACHE.write_bytes(resp.content)
                size_mb = TAR_CACHE.stat().st_size / 1_048_576
                log(GREEN("âœ“"), f"Downloaded {size_mb:.1f} MB â†’ {TAR_CACHE.name}")
            else:
                log(GREEN("âœ“"), f"Using cached simulator build: {TAR_CACHE.name}")
            return _extract_app(TAR_CACHE)
        else:
            log(CYAN("â†’"), "Downloading .ipa from URL...")
            resp = http("GET", ipa_arg, stream=True, timeout=300)
            resp.raise_for_status()
            IPA_CACHE.write_bytes(resp.content)
            size_mb = IPA_CACHE.stat().st_size / 1_048_576
            log(GREEN("âœ“"), f"Downloaded {size_mb:.1f} MB â†’ {IPA_CACHE.name}")
            return IPA_CACHE
    else:
        src = Path(ipa_arg)
        if not src.exists():
            print(RED("ERROR") + f": --ipa file not found: {src}")
            sys.exit(1)
        if is_tar:
            shutil.copy2(src, TAR_CACHE)
            log(GREEN("âœ“"), f"Copied .tar.gz from {src.name} â†’ {TAR_CACHE.name}")
            return _extract_app(TAR_CACHE)
        shutil.copy2(src, IPA_CACHE)
        log(GREEN("âœ“"), f"Copied .ipa from {src.name} â†’ {IPA_CACHE.name}")
        return IPA_CACHE

def main():
    print("\n" + "â•" * 64)
    print(f"  {BOLD('iOS Test Agent â€” Tabibok Health')}")
    print(f"  DeepSeek-V3 (Engineer) + DeepSeek-R1 (Builder)")
    print(f"  {DIM(datetime.now().strftime('%Y-%m-%d %H:%M:%S'))}")
    print("â•" * 64)

    args = parse_args()

    # Pre-flight checks â€” EXPO_TOKEN not needed if --ipa is supplied
    required_keys = ["MAESTRO_API_KEY", "DEEPSEEK_API_KEY"]
    if not args["ipa"]:
        required_keys.append("EXPO_TOKEN")
    missing = [k for k in required_keys if not os.environ.get(k)]
    if missing:
        for k in missing:
            print(RED("ERROR") + f": {k} not set in environment")
        sys.exit(1)

    if not PROJECT_ROOT.exists():
        print(RED("ERROR") + f": Project not found at {PROJECT_ROOT}")
        sys.exit(1)

    # If --ipa supplied, copy/download it into the cache immediately
    _resolved_app_path: Path | None = None
    if args["ipa"]:
        log(GREEN("âš¡"), f"--ipa supplied â€” EAS build phase will be skipped")
        _resolved_app_path = resolve_ipa(args["ipa"])

    # --fresh clears checkpoint and old flow files
    if args["fresh"]:
        if CHECKPOINT.exists():
            clear_cp()
        if FLOWS_DIR.exists():
            import shutil as _shutil
            _shutil.rmtree(FLOWS_DIR)
            FLOWS_DIR.mkdir(exist_ok=True)
        log(YELLOW("âš¡"), "--fresh flag: checkpoint + old flows cleared")

    client = make_ds_client()

    # Resume from checkpoint?
    flows:        dict[str, str] = {}
    ipa_path:     Path | None    = None
    all_results:  list[dict]     = []
    total_fixed:  int            = 0
    start_phase = 1

    cp = load_cp()
    if cp and ask_resume(cp):
        start_phase  = cp.get("phase", 0) + 1
        flows        = cp.get("flows", {})
        all_results  = cp.get("all_results", [])
        total_fixed  = cp.get("total_fixed", 0)
        log(GREEN("âœ“"), f"Resuming from phase {start_phase}")
    else:
        clear_cp()

    log(CYAN("â†’"), "Loading screen files...")
    screens = collect_screens()
    log(GREEN("âœ“"), f"{len(screens)} screens loaded")

    # â”€â”€ Phase 1: Generate or reuse flows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    reuse_cached = (not args["fresh"]) and FLOWS_DIR.exists() and any(FLOWS_DIR.glob("*.yaml"))
    if reuse_cached:
        flows = {f.name: f.read_text(encoding="utf-8") for f in FLOWS_DIR.glob("*.yaml")}
        log(GREEN("âœ“"), f"Reusing cached flows ({len(flows)}) from {FLOWS_DIR.name}/")
    elif start_phase <= 1:
        flows = phase1_generate_flows(client, screens)
        save_cp(1, {"flows": flows, "all_results": [], "total_fixed": 0})
    elif FLOWS_DIR.exists():
        # Re-load flows from disk if resuming (no fresh cache)
        flows = {f.name: f.read_text(encoding="utf-8") for f in FLOWS_DIR.glob("*.yaml")}
        log(GREEN("âœ“"), f"Loaded {len(flows)} flows from disk (resumed)")

    # â”€â”€ Phase 1b: Inject login into flows (skip if reusing cache) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if reuse_cached:
        log(DIM("  "), "Cached flows in use â€” skipping login reinjection")
    else:
        flows = phase1b_inject_login(flows)

    # â”€â”€ Phase 1c: Sanitize flows (replace invalid iOS commands) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    sanitize_flows(FLOWS_DIR)

    # â”€â”€ Phase 2: Build (skipped if --ipa supplied or cache exists) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if _resolved_app_path is not None:
        # --ipa was supplied and already downloaded/extracted above
        ipa_path = _resolved_app_path
        log(GREEN("âš¡"), f"Using resolved app â€” build phase skipped  ({ipa_path.name})")
        save_cp(2, {"flows": flows, "all_results": all_results,
                    "total_fixed": total_fixed, "ipa_cached": True})
    elif IPA_CACHE.exists():
        ipa_path = IPA_CACHE
        log(GREEN("âš¡"), f"Using existing .ipa â€” build phase skipped  ({IPA_CACHE.name})")
        save_cp(2, {"flows": flows, "all_results": all_results,
                    "total_fixed": total_fixed, "ipa_cached": True})
    elif TAR_CACHE.exists():
        log(GREEN("âš¡"), f"Using existing simulator archive â€” build phase skipped  ({TAR_CACHE.name})")
        ipa_path = _extract_app(TAR_CACHE)
        save_cp(2, {"flows": flows, "all_results": all_results,
                    "total_fixed": total_fixed, "ipa_cached": True})
    elif start_phase <= 2:
        ipa_path = phase2_build(use_cached=False)
        save_cp(2, {"flows": flows, "all_results": all_results,
                    "total_fixed": total_fixed, "ipa_cached": True})
    else:
        log(YELLOW("âš "), "No cached build â€” re-triggering EAS build")
        ipa_path = phase2_build(use_cached=False)

    # â”€â”€ Phase 3 â†’ 4: Test + Fix loop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    for round_num in range(1, MAX_FIX_ROUNDS + 1):
        if start_phase > 3 and round_num == 1:
            log(DIM("  "), "Skipping round 1 test (already done â€” loading from checkpoint)")
            if all_results:
                log(DIM("  "), f"Prior results: {all_results}")
            start_phase = 3  # allow subsequent rounds to run
            continue

        banner(f"Test Round {round_num} / {MAX_FIX_ROUNDS}")
        results = phase3_run_tests(ipa_path)
        all_results.append(results)

        save_cp(3, {"flows": flows, "all_results": all_results,
                    "total_fixed": total_fixed})

        has_real_results = results.get("passed", 0) + results.get("failed", 0) > 0
        upload_error = results.get("upload_error", False)
        if results.get("success") and has_real_results and not upload_error:
            log(GREEN("âœ“"), "All tests passed! ðŸŽ‰")
            break
        if upload_error:
            log(RED("âœ—"), f"Upload error â€” check flow YAML syntax. {results.get('raw_output', '')}")

        if round_num == MAX_FIX_ROUNDS:
            log(YELLOW("âš "), f"Max fix rounds ({MAX_FIX_ROUNDS}) reached")
            break

        # Fix failures and rebuild
        fixed = phase4_analyse_and_fix(client, results, screens, round_num)
        total_fixed += len(fixed)

        # Only rebuild when we have a proper EAS-built .ipa â€” NOT when using a
        # pre-supplied simulator .app (the .app can't be rebuilt on Windows).
        using_sim_app = ipa_path is not None and ipa_path.suffix == ".app"
        if fixed and not using_sim_app:
            log(CYAN("â†’"), "Rebuilding .ipa after source fixes...")
            IPA_CACHE.unlink(missing_ok=True)  # force fresh build
            ipa_path = phase2_build(use_cached=False)
        elif fixed and using_sim_app:
            log(YELLOW("âš "), "Source fixes applied â€” skipping rebuild (simulator .app in use). "
                              "Re-run with a new EAS build to pick up code changes.")
        else:
            log(DIM("  "), "Only test fixes â€” no rebuild needed")

        save_cp(3, {"flows": flows, "all_results": all_results,
                    "total_fixed": total_fixed})

    # â”€â”€ Phase 5: Report â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    report = phase5_report(client, all_results, total_fixed, flows)
    REPORT_FILE.write_text(
        report + f"\n\n---\n*Generated {datetime.now().isoformat()}*\n"
        "*iOS Test Agent â€” DeepSeek-V3 + DeepSeek-R1 + EAS Build + Maestro Cloud*\n",
        encoding="utf-8",
    )

    clear_cp()

    # â”€â”€ Summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    last = all_results[-1] if all_results else {}
    print("\n" + "â•" * 64)
    print(f"  {GREEN(BOLD('TESTING COMPLETE'))}")
    print(f"  Flows generated : {len(flows)}")
    print(f"  Test rounds     : {len(all_results)}")
    print(f"  Final passed    : {last.get('passed', '?')}")
    print(f"  Final failed    : {last.get('failed', '?')}")
    print(f"  Source fixes    : {total_fixed}")
    print(f"  Report          : {REPORT_FILE.name}")
    print("â•" * 64)
    print(f"\n  Flows saved in  : {FLOWS_DIR}/")
    print(f"  View results at : https://app.maestro.mobile.dev\n")


if __name__ == "__main__":
    main()


