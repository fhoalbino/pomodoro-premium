# Build & distribuição

Este projeto tem duas vidas:

1. **PWA web** (raiz do projeto) — abre em navegador, instalável via Chrome/Edge. Continua funcionando.
2. **App nativo Windows via Tauri** (`src-tauri/`) — instalador `.msi`/`.exe`, sem terminal visível, fechar = encerra tudo.

Os dois compartilham o **mesmo frontend** (`index.html`, `src/`, `public/`). Manter um, manter os dois.

---

## 1. Pré-requisitos (uma única vez por máquina)

### Para usar o app (usuário final)
- Windows 10 (1809+) ou 11
- WebView2 (já vem no Win11; auto-instalado pelo bundle no Win10)

### Para compilar (desenvolvedor)
1. **Rust** — https://rustup.rs/ → rode `rustup-init.exe`
2. **Microsoft C++ Build Tools** — https://visualstudio.microsoft.com/visual-cpp-build-tools/ → marque "Desktop development with C++"
3. **Tauri CLI** (em qualquer pasta):
   ```powershell
   cargo install tauri-cli --version "^2.0" --locked
   ```
4. **WebView2 SDK** — instalado automaticamente pelo Tauri quando rodar pela primeira vez

Verificar instalação:
```powershell
rustc --version
cargo --version
cargo tauri --version
```

---

## 2. Gerar ícones (uma única vez ou quando trocar a logo)

```powershell
cd src-tauri
cargo tauri icon ../public/icons/icon-512.svg
```

Se a CLI reclamar do formato SVG, exporte para PNG 1024×1024 antes (Inkscape, Figma, Photopea) e passe o `.png`. Detalhes: `src-tauri/icons/README.md`.

---

## 3. Rodar em desenvolvimento

```powershell
cd src-tauri
cargo tauri dev
```

- Abre janela nativa carregando `../index.html`
- DevTools com `F12` (build debug)
- Hot-reload automático ao salvar HTML/CSS/JS
- Sem terminal extra para o usuário

> **Versão PWA** (servidor browser) continua disponível:
> ```powershell
> python -m http.server 8080
> ```
> ou duplo clique em `abrir-pomodoro.bat`.

---

## 4. Build de produção (instalador Windows)

```powershell
cd src-tauri
cargo tauri build
```

Tempo: 3–8 min na primeira compilação (Rust cacheado depois).

Saída em `src-tauri/target/release/bundle/`:

| Pasta | Conteúdo | Para quem |
|-------|----------|-----------|
| `msi/`  | `Pomodoro Premium_1.0.2_x64_pt-BR.msi` | Distribuição corporativa / Windows clássico |
| `nsis/` | `Pomodoro Premium_1.0.2_x64-setup.exe` | Usuário comum (instalação por usuário, leve, ~3-6 MB) |

Recomende o **NSIS `.exe`** para o usuário final — menor, instalação per-user, sem privilégios admin.

### Build apenas um formato
```powershell
cargo tauri build --bundles nsis
# ou
cargo tauri build --bundles msi
```

---

## 5. SmartScreen e assinatura de código

Os instaladores gerados localmente não são assinados por padrão. No Windows, isso pode acionar o Microsoft Defender SmartScreen com aviso de "editor desconhecido", principalmente em máquinas onde o app ainda não tem reputação.

Para distribuição pública recorrente, assine o `.exe`/`.msi` com um certificado de code signing antes de publicar no GitHub Releases. Para testes internos, informe os usuários sobre o aviso e publique checksums junto dos binários.

Exemplo de checksum:

```powershell
Get-FileHash "src-tauri/target/release/bundle/nsis/Pomodoro Premium_1.0.2_x64-setup.exe" -Algorithm SHA256
```

---

## 6. Publicar no GitHub

### Commit do projeto (sem binários)

```powershell
git init
git branch -M main
git add .
git status                   # confira: sem target/, sem .msi/.exe, sem .env
git commit -m "Initial commit: Pomodoro Premium"
```

Crie repo vazio em https://github.com/new (sem README/license — já temos). Depois:

```powershell
git remote add origin https://github.com/fhoalbino/pomodoro-premium.git
git push -u origin main
```

Se o remote `origin` já existir:

```powershell
git remote set-url origin https://github.com/fhoalbino/pomodoro-premium.git
```

### Publicar o instalador como Release

1. No GitHub: aba **Releases** → **Draft a new release**
2. **Tag version:** `v1.0.2` (criar nova). **Title:** `Pomodoro Premium v1.0.2`
3. Descreva mudanças no corpo
4. Anexe o `.exe` do NSIS em `src-tauri/target/release/bundle/nsis/` e, se necessário, o `.msi` em `src-tauri/target/release/bundle/msi/`
5. Inclua o SHA256 gerado com `Get-FileHash`
6. **Publish release**

Usuário comum acessa a página de releases, baixa o `.exe`, duplo clique, instala.

Não envie instaladores no commit. Binários `.exe` e `.msi` devem ser distribuídos apenas por Releases.

### Hospedar a versão PWA grátis (opcional)

Habilite **GitHub Pages** em Settings → Pages → Source: `main` / root. Em ~1 min:
`https://<seu-usuario>.github.io/<nome-repo>/`

A PWA fica acessível por link, instalável direto do Chrome/Edge.

---

## 7. Atualizar versão

Sempre que mudar algo significativo:

1. Atualize `version` em **dois** lugares:
   - `src-tauri/Cargo.toml` → `[package] version = "1.0.2"`
   - `src-tauri/tauri.conf.json` → `"version": "1.0.2"`
2. Atualize `CACHE_VERSION` em `service-worker.js` quando o shell PWA mudar (força refresh em PWA)
3. Rebuild: `cargo tauri build`
4. Nova release no GitHub com nova tag

---

## 8. Resolução de problemas

### `error: linker 'link.exe' not found`
Instale **Microsoft C++ Build Tools** (veja pré-requisitos).

### `cargo tauri build` muito lento
Primeira vez: 5-10 min normal. Próximas: cache Rust acelera para ~1 min. Não delete `src-tauri/target/`.

### App não abre, erro WebView2
Win10: baixe o Evergreen Bootstrapper https://developer.microsoft.com/microsoft-edge/webview2/
Win11: já incluso, não deve falhar.

### localStorage diferente do navegador
Tauri webview tem storage isolado por app. Dados do navegador (`http://localhost:8080`) **não** migram automaticamente para o app nativo. Soluções:
- Aceitar reset (config e histórico voltam ao padrão na primeira execução do app)
- Implementar import/export JSON na UI (próximo passo no roadmap)

### Service Worker não registra no Tauri
Esperado. Tauri usa protocolo custom (`tauri://`), service workers só funcionam em `http(s)://`. Não afeta funcionalidade — `pwa.js` já captura o erro silenciosamente. Cache offline não é necessário num app nativo.

### Ctrl+R recarrega o app
Comportamento padrão do WebView. Estado persiste no localStorage → resume funciona normalmente. Para desabilitar, sobrescreva o atalho via Tauri API (não implementado).
