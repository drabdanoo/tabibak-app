import re
from pathlib import Path
p = Path('ios_test_agent.py')
s = p.read_text(encoding='utf-8')
pat = r"def _extract_app\(tar_path: Path\) -> Path:[\s\S]*?return app_path\n"
new = (
    "def _extract_app(tar_path: Path) -> Path:\n"
    "    \"\"\"Extract a .tar.gz archive and return either:\n"
    "      - the path to the extracted .app (simulator), or\n"
    "      - the path to a cached .ipa (device) if the archive contains an .ipa.\n"
    "    \"\"\"\n"
    "    if APP_EXTRACT_DIR.exists():\n"
    "        shutil.rmtree(APP_EXTRACT_DIR)\n"
    "    APP_EXTRACT_DIR.mkdir(exist_ok=True)\n\n"
    "    log(CYAN('→'), f'Extracting archive from {tar_path.name}...')\n"
    "    with tarfile.open(tar_path, 'r:gz') as tf:\n"
    "        tf.extractall(APP_EXTRACT_DIR)\n\n"
    "    # Prefer a top-level .app directory (simulator build)\n"
    "    all_app_paths = list(APP_EXTRACT_DIR.rglob('*.app'))\n"
    "    top_level = [p for p in all_app_paths if '.app' not in str(p.parent.relative_to(APP_EXTRACT_DIR))]\n"
    "    if top_level or all_app_paths:\n"
    "        app_path = (top_level or all_app_paths)[0]\n"
    "        log(GREEN('✓'), f'Extracted simulator .app: {app_path.name}')\n"
    "        return app_path\n\n"
    "    # If no .app, look for a device .ipa inside the tarball\n"
    "    ipa_files = list(APP_EXTRACT_DIR.rglob('*.ipa'))\n"
    "    if ipa_files:\n"
    "        shutil.copy2(ipa_files[0], IPA_CACHE)\n"
    "        size_mb = IPA_CACHE.stat().st_size / 1_048_576\n"
    "        log(GREEN('✓'), f'Extracted device .ipa ({size_mb:.1f} MB) → {IPA_CACHE.name}')\n"
    "        return IPA_CACHE\n\n"
    "    raise RuntimeError(f'No .app or .ipa found after extracting {tar_path}')\n"
)
s2 = re.sub(pat, new, s, count=1)
if s2 != s:
    p.write_text(s2, encoding='utf-8')
    print('extractor patched')
else:
    print('no change applied')
