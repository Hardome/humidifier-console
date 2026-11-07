param([string]$Python = 'python')
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
& $Python -c "import sys, venv; assert sys.version_info >= (3, 11), 'Python 3.11+ required'"
if ($LASTEXITCODE -ne 0) { throw 'Install a working Python 3.11+ and run setup.ps1 -Python <path-to-python.exe>' }
& $Python -m venv .venv
if ($LASTEXITCODE -ne 0) { throw 'Could not create virtual environment' }
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed; check network access to GitHub and PyPI' }
& .\.venv\Scripts\python.exe -m pip freeze | Set-Content -Encoding UTF8 requirements.resolved.txt
Write-Host 'Ready. Run: .\.venv\Scripts\python.exe diagnose.py pair'
