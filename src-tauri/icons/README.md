# Tauri icons

Tauri requires binary PNG/ICO files at specific sizes. Generate them automatically from the SVG source.

## Comando único (recomendado)

A partir da raiz do projeto:

```powershell
cd src-tauri
cargo tauri icon ../public/icons/icon-512.svg
```

Isto gera, dentro desta pasta:
- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.ico`
- `icon.icns` (macOS, opcional)
- Tamanhos extras para Microsoft Store

> Se a CLI não aceitar SVG diretamente, exporte `icon-512.svg` para um `.png` 1024×1024 com qualquer editor (Inkscape, Figma, Photopea) e rode `cargo tauri icon ./icon-source.png`.

## Alternativa manual

Se preferir fornecer os arquivos:
- `32x32.png`        — 32×32 PNG
- `128x128.png`      — 128×128 PNG
- `128x128@2x.png`   — 256×256 PNG
- `icon.ico`         — multi-resolução (16, 24, 32, 48, 64, 256)

Coloque-os neste diretório. Os caminhos estão referenciados em `tauri.conf.json` > `bundle.icon`.

> Os ícones gerados **não** devem ser commitados se forem grandes. Avalie adicionar `src-tauri/icons/*.png` ao `.gitignore` se preferir regenerar localmente.
