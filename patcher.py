import re, time
from pathlib import Path
p = Path('ios_test_agent.py')
s = p.read_text(encoding='utf-8')
# 1) Insert constants after BUILD_POLL_SEC line
s = re.sub(r"(BUILD_POLL_SEC\s*=\s*60\s*#.*\n)", r"\1MAX_EAS_BUILD_MIN    = 90     # stop waiting after 90 minutes\nMAX_MAESTRO_REST_MIN = 150    # match CLI --timeout=150\n", s, count=1)
# 2) Replace download_ipa to support .tar.gz
s = re.sub(r"def download_ipa\([^\)]*\):[\s\S]*?\n\s*def _extract_app", (
    "def download_ipa(url: str) -> Path:\n"
    "    \"\"\"Download EAS artifact. Handles both device .ipa and simulator .tar.gz.\n\n"
    "    Returns:\n"
    "      - Path to `.ipa` for device builds, or\n"
    "      - Path to extracted `.app` bundle for simulator builds.\n"
    "    \"\"\"\n"
    "    # If we already cached a device build, prefer it.\n"
    "    if IPA_CACHE.exists() and not TAR_CACHE.exists():\n"
    "        log(GREEN(\"✓\"), f\"Using cached .ipa: {IPA_CACHE}\")\n"
    "        return IPA_CACHE\n\n"
    "    is_tar = url.endswith('.tar.gz') or '.tar.gz' in url\n"
    "    log(CYAN('→'), f\"Downloading {'simulator build (.tar.gz)' if is_tar else '.ipa'}...\")\n"
    "    resp = http('GET', url, stream=True, timeout=300)\n"
    "    resp.raise_for_status()\n\n"
    "    if is_tar:\n"
    "        TAR_CACHE.write_bytes(resp.content)\n"
    "        size_mb = TAR_CACHE.stat().st_size / 1_048_576\n"
    "        log(GREEN('✓'), f\"Downloaded {size_mb:.1f} MB → {TAR_CACHE.name}\")\n"
    "        return _extract_app(TAR_CACHE)\n"
    "    else:\n"
    "        IPA_CACHE.write_bytes(resp.content)\n"
    "        size_mb = IPA_CACHE.stat().st_size / 1_048_576\n"
    "        log(GREEN('✓'), f\"Downloaded {size_mb:.1f} MB → {IPA_CACHE.name}\")\n"
    "        return IPA_CACHE\n\n\n"
    "def _extract_app"), s, count=1)
# 3) Add REST poll timeout (ensure start exists already)
s = re.sub(r"time\.sleep\(30\)\n\s*\n", (
    "        if int(time.time() - start) > MAX_MAESTRO_REST_MIN * 60:\n"
    "            log(YELLOW('⚠'), f'Maestro REST poll timed out after {MAX_MAESTRO_REST_MIN} min')\n"
    "            return {'status': 'TIMEOUT', 'timeout': True}\n"
    "        time.sleep(30)\n\n"), s, count=1)
# 4) Add EAS build wait timeout: insert start_time and timeout check
s = re.sub(r"(def eas_wait_for_build\([\s\S]*?Track at:.*\n)(\s*)", r"\1\2start_time = time.time()\n\2", s, count=1)
s = re.sub(r"(time\.sleep\(BUILD_POLL_SEC\)\n)", r"        if int(time.time() - start_time) > MAX_EAS_BUILD_MIN * 60:\n            raise RuntimeError(f'EAS build wait exceeded {MAX_EAS_BUILD_MIN} minutes — check the build page in Expo and fix any issues, then re-run.')\n        \1", s, count=1)
# 5) Guard for simulator .app without CLI
s = re.sub(r"(maestro_bin = shutil\.which\(\"maestro\"\)\s*\n\s*)if maestro_bin:\n", r"\1# If we have a simulator .app but no CLI, fail fast with a clear message\n    if ipa_path.is_dir() and not maestro_bin:\n        raise RuntimeError('Simulator .app detected but Maestro CLI is not installed. Install the CLI (see https://docs.maestro.dev) or rebuild a device .ipa by setting ios.simulator=false in eas.json and rerun.')\n    if maestro_bin:\n", s, count=1)

p.write_text(s, encoding='utf-8')
print('patched OK')
