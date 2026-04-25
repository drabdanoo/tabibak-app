import re
from pathlib import Path
p = Path('ios_test_agent.py')
s = p.read_text(encoding='utf-8')
pattern = r"def eas_wait_for_build\([\s\S]*?\ndef download_ipa"
new = '''def eas_wait_for_build(build_id: str) -> str:
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

            # Parse output — EAS CLI may emit warnings before the JSON
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
                log(YELLOW("⚠"), f"Could not parse build status ({elapsed//60}m elapsed) — retrying...")
                time.sleep(BUILD_POLL_SEC)
                if int(time.time() - start) > MAX_EAS_BUILD_MIN * 60:
                    raise RuntimeError(f"EAS build wait exceeded {MAX_EAS_BUILD_MIN} minutes — check the build page in Expo and fix any issues, then re-run.")
                continue

            status = data.get("status", "UNKNOWN")
            log(CYAN("⏳"), f"Status: {status}  ({elapsed//60}m {elapsed%60}s elapsed)")

            if status == "FINISHED":
                artifact_url = (data.get("artifacts") or {}).get("buildUrl")
                if not artifact_url:
                    raise RuntimeError("Build finished but no artifact URL in response")
                log(GREEN("✓"), f"Build complete!")
                return artifact_url

            if status in ("ERRORED", "CANCELLED", "EXPIRED"):
                raise RuntimeError(f"EAS build ended with status: {status}\n{result.stdout[-500:]}")

        except subprocess.TimeoutExpired:
            log(YELLOW("⚠"), "CLI poll timed out — retrying...")
        except Exception as e:
            log(YELLOW("⚠"), f"Poll error (will retry): {e}")

        if int(time.time() - start) > MAX_EAS_BUILD_MIN * 60:
            raise RuntimeError(f"EAS build wait exceeded {MAX_EAS_BUILD_MIN} minutes — check the build page in Expo and fix any issues, then re-run.")
        time.sleep(BUILD_POLL_SEC)

def download_ipa'''

s2 = re.sub(pattern, new, s, count=1)
if s2 == s:
    print('pattern not found')
else:
    p.write_text(s2, encoding='utf-8')
    print('eas_wait_for_build replaced')
