from pathlib import Path
import os, re, zipfile
p = Path('ios_test_agent.py')
s = p.read_text(encoding='utf-8')
# Replace _maestro_rest header block to insert app zipping before upload
pattern = r"def _maestro_rest\(ipa_path: Path, flows_dir: Path, api_key: str\) -> dict:\n([\s\S]*?)with open\(ipa_path, \"rb\"\) as ipa_f, open\(zip_path, \"rb\"\) as zip_f:\n"
insert_logic = (
    "def _maestro_rest(ipa_path: Path, flows_dir: Path, api_key: str) -> dict:\n"
    "    \"\"\"Fall-back: Maestro Cloud REST API.\"\"\"\n"
    "    # Zip flows directory\n"
    "    zip_path = Path(__file__).parent / \"_maestro_flows.zip\"\n"
    "    with zipfile.ZipFile(zip_path, \"w\") as zf:\n"
    "        for f in flows_dir.glob(\"*.yaml\"):\n"
    "            zf.write(f, f.name)\n\n"
    "    # If ipa_path points to a simulator .app directory, zip it first for REST upload\n"
    "    app_upload_path = ipa_path\n"
    "    app_upload_name = 'app.ipa'\n"
    "    if ipa_path.is_dir():\n"
    "        sim_zip = Path(__file__).parent / \"_sim_app.zip\"\n"
    "        if sim_zip.exists(): sim_zip.unlink()\n"
    "        with zipfile.ZipFile(sim_zip, 'w', zipfile.ZIP_DEFLATED) as z:\n"
    "            for root, _, files in os.walk(ipa_path):\n"
    "                root_p = Path(root)\n"
    "                for fname in files:\n"
    "                    fpath = root_p / fname\n"
    "                    z.write(str(fpath), str(fpath.relative_to(ipa_path.parent)))\n"
    "        app_upload_path = sim_zip\n"
    "        app_upload_name = 'app.zip'\n\n"
    "    log(CYAN('→'), 'Uploading to Maestro Cloud REST API...')\n"
    "    with open(app_upload_path, 'rb') as ipa_f, open(zip_path, 'rb') as zip_f:\n"
)
s = re.sub(pattern, insert_logic, s, count=1)
# Update files tuple to use app_upload_name
s = s.replace("\"app\":       (\"app.ipa\", ipa_f, \"application/octet-stream\"),", "\"app\":       (app_upload_name, ipa_f, 'application/zip' if app_upload_name.endswith('.zip') else 'application/octet-stream'),")
p.write_text(s, encoding='utf-8')
print('patched REST for .app zip')
