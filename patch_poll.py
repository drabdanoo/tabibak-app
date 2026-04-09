import re
from pathlib import Path
p = Path('ios_test_agent.py')
s = p.read_text(encoding='utf-8')
pat = r"def _maestro_poll\(run_id: str, api_key: str\) -> dict:[\s\S]*?ENGINEER_SYSTEM ="
new = '''def _maestro_poll(run_id: str, api_key: str) -> dict:
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
ENGINEER_SYSTEM = '''

s2 = re.sub(pat, new, s, count=1)
if s2 == s:
    print('pattern not found')
else:
    p.write_text(s2, encoding='utf-8')
    print('maestro_poll replaced')
