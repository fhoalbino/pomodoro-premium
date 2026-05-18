# =============================================================================
# abrir-pomodoro.ps1
# Sobe servidor estatico em http://localhost:8080 + abre o navegador.
# Ctrl+C ou fechar a janela encerra o servidor (sem processos orfaos).
#
# Execucao:
#   - Clique direito > "Run with PowerShell"        (recomendado)
#   - Ou via terminal:  powershell -ExecutionPolicy Bypass -File .\abrir-pomodoro.ps1
#
# Se aparecer erro de policy, rode UMA vez como admin:
#   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
# =============================================================================

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Pomodoro Premium'

# Move para a pasta do script
Set-Location -LiteralPath $PSScriptRoot

Write-Host ''
Write-Host '  ====================================================' -ForegroundColor DarkYellow
Write-Host '   Pomodoro rodando em http://localhost:8080'           -ForegroundColor Yellow
Write-Host '   Feche esta janela para encerrar.'                    -ForegroundColor Yellow
Write-Host '  ====================================================' -ForegroundColor DarkYellow
Write-Host ''

# ---- Verifica Python no PATH ----
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) {
    Write-Host '[ERRO] Python nao encontrado no PATH.' -ForegroundColor Red
    Write-Host 'Instale Python 3.x: https://www.python.org/downloads/' -ForegroundColor Red
    Write-Host 'Durante a instalacao, marque "Add Python to PATH".' -ForegroundColor Red
    Read-Host 'Pressione Enter para sair'
    exit 1
}

# ---- Abre o navegador em paralelo apos 2s (job leve, encerrado no finally) ----
$browserJob = Start-Job -ScriptBlock {
    Start-Sleep -Seconds 2
    Start-Process 'http://localhost:8080'
}

# ---- Servidor em primeiro plano. Ctrl+C ou fechamento encerra. ----
try {
    & python -m http.server 8080
}
finally {
    if ($browserJob) {
        try { Stop-Job   -Job $browserJob -ErrorAction SilentlyContinue } catch {}
        try { Remove-Job -Job $browserJob -ErrorAction SilentlyContinue } catch {}
    }
    Write-Host ''
    Write-Host 'Servidor encerrado.' -ForegroundColor DarkGray
}
