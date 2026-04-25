Set-Location G:\tabibak-app

# Load env vars from Windows registry (MAESTRO_API_KEY, DEEPSEEK_API_KEY, etc.)
$regPath = 'HKCU:\Environment'
$regKeys = Get-ItemProperty -Path $regPath -ErrorAction SilentlyContinue
if ($regKeys) {
    $regKeys.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object {
        [System.Environment]::SetEnvironmentVariable($_.Name, $_.Value, 'Process')
    }
}

# Hardcode MAESTRO_API_KEY in case it's not in registry
if (-not $env:MAESTRO_API_KEY) {
    $env:MAESTRO_API_KEY = 'rb_58yDBtvMEFQXbL9JXRYb8cJo5PiNsPQ3DTTnWQDsce69YHKH4OXvJGZNG9xNlILBSZIFDEFlTBOUgFw4d6xTd42ujJJ9NfrX4Mj'
}

$env:PYTHONIOENCODING = 'utf-8'
$env:PYTHONUTF8 = '1'
$env:PATH = 'G:\tabibak-app\maestro_cli\maestro\bin;' + $env:PATH

Write-Host "MAESTRO_API_KEY: $(if ($env:MAESTRO_API_KEY) { 'SET (' + $env:MAESTRO_API_KEY.Substring(0, [Math]::Min(8, $env:MAESTRO_API_KEY.Length)) + '...)' } else { 'MISSING' })"
Write-Host "DEEPSEEK_API_KEY: $(if ($env:DEEPSEEK_API_KEY) { 'SET' } else { 'MISSING' })"

# Use the simulator .tar.gz build (maestro profile) — required by Maestro Cloud
# Build: d022f75a  (maestro profile, iphonesimulator, 2026-04-05)
python -u -X utf8 ios_test_agent.py --ipa 'https://expo.dev/artifacts/eas/rGGaee3yq5akquFaLfXsak.tar.gz' --fresh
