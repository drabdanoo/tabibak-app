Set-Location G:\tabibak-app

# Load env vars from Windows registry
$regPath = 'HKCU:\Environment'
$regKeys = Get-ItemProperty -Path $regPath -ErrorAction SilentlyContinue
if ($regKeys) {
    $regKeys.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object {
        [System.Environment]::SetEnvironmentVariable($_.Name, $_.Value, 'Process')
    }
}

if (-not $env:MAESTRO_API_KEY) {
    $env:MAESTRO_API_KEY = 'rb_58yDBtvMEFQXbL9JXRYb8cJo5PiNsPQ3DTTnWQDsce69YHKH4OXvJGZNG9xNlILBSZIFDEFlTBOUgFw4d6xTd42ujJJ9NfrX4Mj'
}

$env:PYTHONIOENCODING = 'utf-8'
$env:PYTHONUTF8 = '1'
$env:PATH = 'G:\tabibak-app\maestro_cli\maestro\bin;' + $env:PATH

Write-Host "MAESTRO_API_KEY: $(if ($env:MAESTRO_API_KEY) { 'SET (' + $env:MAESTRO_API_KEY.Substring(0, 8) + '...)' } else { 'MISSING' })"
Write-Host "DEEPSEEK_API_KEY: $(if ($env:DEEPSEEK_API_KEY) { 'SET' } else { 'MISSING' })"
Write-Host "Resuming from checkpoint (skipping flow generation)..."

# No --fresh: resume from existing checkpoint so flows are reused
python -u -X utf8 ios_test_agent.py --ipa 'https://expo.dev/artifacts/eas/fzSvqV3K2pvpp5uPqgpYZv.ipa'
