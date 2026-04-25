"""Launcher that sets env vars then runs ios_test_agent via subprocess."""
import os, sys, subprocess, winreg

# Load all user env vars from Windows registry (including MAESTRO_API_KEY)
env = os.environ.copy()
try:
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as key:
        count = winreg.QueryInfoKey(key)[1]
        for i in range(count):
            name, val, _ = winreg.EnumValue(key, i)
            env[name.upper()] = val
except Exception as e:
    print(f"Registry warning: {e}", file=sys.stderr)

# Force UTF-8
env["PYTHONUTF8"] = "1"
env["PYTHONIOENCODING"] = "utf-8"

print(f"MAESTRO_API_KEY: {'SET (' + env.get('MAESTRO_API_KEY','')[:8] + '...)' if env.get('MAESTRO_API_KEY') else 'MISSING'}")
print(f"DEEPSEEK_API_KEY: {'SET' if env.get('DEEPSEEK_API_KEY') else 'MISSING'}")

ipa_url = "https://expo.dev/artifacts/eas/fzSvqV3K2pvpp5uPqgpYZv.ipa"

result = subprocess.run(
    [sys.executable, "-X", "utf8", "ios_test_agent.py",
     "--ipa", ipa_url,
     "--fresh"],
    cwd=os.path.dirname(os.path.abspath(__file__)),
    env=env,
)
sys.exit(result.returncode)
