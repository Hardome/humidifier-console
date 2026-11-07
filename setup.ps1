param([string]$Python)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Find-WorkingPython {
    if ($Python) {
        $candidates = @($Python)
    } else {
        $candidates = @()
        if (Get-Command py -ErrorAction SilentlyContinue) {
            $launcherPaths = & py -0p 2>$null
            foreach ($line in $launcherPaths) {
                if ($line -match '([A-Za-z]:\\.*python.exe)\s*$') {
                    $candidates += $Matches[1]
                }
            }
        }
        $candidates += @(Get-ChildItem "$env:LOCALAPPDATA\Programs\Python\Python*\python.exe", "$env:ProgramFiles\Python*\python.exe" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
        $candidates += @(Get-Command python,python3 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)
    }
    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        # Windows Store aliases are not installed interpreters.
        if ($candidate -like '*\Microsoft\WindowsApps\*') { continue }
        try {
            $probe = & $candidate -c "import sys, venv, encodings; assert sys.version_info >= (3, 11); print('PYTHON_OK')" 2>$null
            if ($LASTEXITCODE -eq 0 -and $probe -contains 'PYTHON_OK') { return $candidate }
        } catch { continue }
    }
    return $null
}

$Python = Find-WorkingPython
if (-not $Python) {
    Write-Host 'No working Python 3.11+ found. Install Python, then rerun setup:'
    Write-Host 'winget install --exact --id Python.Python.3.12 --source winget --scope user'
    Write-Host 'powershell -ExecutionPolicy Bypass -File .\setup.ps1'
    Write-Host 'Do not run pair/check until setup completes successfully.'
    exit 1
}
Write-Host "Using Python: $Python"
& $Python -m venv .venv
if ($LASTEXITCODE -ne 0) { throw 'Could not create virtual environment' }
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed; check network access to GitHub and PyPI' }
$resolved = & .\.venv\Scripts\python.exe -m pip freeze
if ($LASTEXITCODE -ne 0) { throw 'Could not record installed dependency versions' }
$resolved | Set-Content -Encoding UTF8 requirements.resolved.txt
Write-Host 'Ready. Run: .\.venv\Scripts\python.exe diagnose.py pair'
