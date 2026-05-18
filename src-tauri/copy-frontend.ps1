# Copia o frontend (raiz do projeto) para src-tauri/dist/ antes do build/dev do Tauri.
# Necessário porque o Tauri não aceita frontendDist apontando para um diretório
# que contém o próprio src-tauri/target. Esta cópia isola os assets web.

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$src = Resolve-Path '..'
$dst = Join-Path $PSScriptRoot 'dist'

if (Test-Path $dst) {
    Remove-Item $dst -Recurse -Force
}
New-Item -ItemType Directory -Path $dst | Out-Null

# Arquivos soltos da raiz
$rootFiles = @('index.html', 'manifest.json', 'service-worker.js')
foreach ($f in $rootFiles) {
    $path = Join-Path $src $f
    if (Test-Path $path) {
        Copy-Item -LiteralPath $path -Destination $dst
    }
}

# Diretórios
$dirs = @('src', 'public')
foreach ($d in $dirs) {
    $path = Join-Path $src $d
    if (Test-Path $path) {
        Copy-Item -LiteralPath $path -Destination $dst -Recurse
    }
}

Write-Host "[copy-frontend] dist atualizada: $dst"
