# Pomodoro Premium

Timer Pomodoro com tema preto e dourado, foco em produtividade e pausas ergonômicas. Sem frameworks, sem build do frontend, sem dependências externas no runtime.

**Duas formas de uso:**
- 🌐 **PWA** — abre no Chrome/Edge, instalável como app web
- 🖥️ **App nativo Windows (Tauri)** — `.exe` ou `.msi`, sem terminal, fechar = encerra tudo. Veja [`BUILD.md`](./BUILD.md).

> ⚠️ **Aviso:** este aplicativo é uma ferramenta de produtividade e ergonomia. Ele **não substitui orientação médica**. Em caso de dor, desconforto persistente ou lesão, procure um profissional de saúde.

---

## ✨ Funcionalidades

- ⏱️ Timer Pomodoro com foco, pausa curta e pausa longa
- 🔁 Pausa longa automática a cada N ciclos (configurável)
- 🎨 Tema premium preto/dourado — sistema completo de temas via CSS variables
- 🎯 Anel de progresso animado com glow dinâmico por etapa
- 🔔 Som suave estilo notificação macOS (Web Audio API, sem arquivos externos)
- 🖥️ Notificações nativas do navegador (com permissão)
- 💾 Persistência em `localStorage` (config + estado + histórico do dia)
- 📊 Contador de pomodoros concluídos hoje + tempo focado
- 🎹 Atalhos de teclado: `Espaço` `Shift+R` `S` `M`
- 📦 PWA instalável no Chrome / Edge / Windows
- ♿ Acessível por teclado, respeita `prefers-reduced-motion`
- 🪶 Leve: 5 arquivos JS + 4 CSS, todos < 12 KB cada

---

## 🖼️ Screenshots

> _Reserve esta seção. Adicione capturas após primeira execução._

| Tela principal | Configurações | Instalado no Windows |
|:---:|:---:|:---:|
| `<img width="1600" height="858" alt="Home" src="https://github.com/user-attachments/assets/99feb298-6755-4139-b288-7eced890a956" />` | `docs/screenshot-settings.png` | `docs/screenshot-installed.png` |

---

## 🚀 Como rodar localmente

PWA exige protocolo HTTP/HTTPS — **não funciona via `file://`**.

### Opção 1 — Python (já vem no Windows com Python instalado)

```powershell
cd pomodoro-premium
python -m http.server 8080
```

Abra `http://localhost:8080` no navegador.

### Opção 2 — Node (sem instalar nada permanente)

```powershell
cd pomodoro-premium
npx serve .
```

### Opção 3 — VSCode

Instale a extensão **Live Server** → clique direito em `index.html` → **Open with Live Server**.

---

## 📥 Como instalar como app no Windows

1. Abra o app no **Chrome** ou **Edge** via `http://localhost:8080`.
2. Clique no botão **"⬇ Instalar app"** que aparece no topo direito, **ou** no ícone de instalação na barra de endereço.
3. Confirme a instalação.
4. O app fica disponível no **Menu Iniciar** do Windows como janela standalone (sem barra de navegador).
5. Funciona offline após a primeira visita (graças ao service worker).

> 💡 Para desinstalar: abra o app instalado → menu `⋮` → **Desinstalar**.

---

## 📁 Estrutura de pastas

```
pomodoro-premium/
├── public/
│   └── icons/
│       ├── favicon.svg
│       ├── icon-192.svg
│       ├── icon-512.svg
│       └── icon-maskable.svg
├── src/
│   ├── css/
│   │   ├── base.css         # reset, body, fundo, splash, brand
│   │   ├── themes.css       # CSS vars + temas alternativos
│   │   ├── components.css   # card, botão, ring, tabs, switch, stats
│   │   └── responsive.css   # media queries + reduced motion
│   └── js/
│       ├── app.js           # boot, integração entre módulos
│       ├── timer.js         # engine Pomodoro (drift-resistant)
│       ├── storage.js       # localStorage (settings, state, histórico)
│       ├── audio.js         # Web Audio API (chime + tick)
│       ├── notifications.js # Notification API
│       ├── pwa.js           # install prompt + service worker
│       └── settings.js      # defaults + binding do formulário
├── index.html               # entry (referencia src/ e public/)
├── manifest.json            # raiz — escopo PWA correto
├── service-worker.js        # raiz — escopo PWA correto
├── README.md
├── .gitignore
└── LICENSE                  # MIT
```

> **Por que `manifest.json` e `service-worker.js` ficam na raiz?**
> O service worker controla apenas o **escopo do diretório onde está registrado**. Para um PWA build-less servir corretamente toda a aplicação, o SW precisa estar no diretório raiz que é servido. Os ícones e demais assets permanecem em `public/` para organização.

---

## 🎨 Como customizar temas

Edite **apenas** `src/css/themes.css`. Toda a UI lê as variáveis de lá.

### Trocar tema padrão

No `index.html`, atribua um tema ao `<html>`:

```html
<html lang="pt-BR" data-theme="midnight-blue">
```

Temas inclusos: `premium-gold` (padrão), `midnight-blue`, `forest-emerald`.

### Criar um tema novo

Copie um bloco em `themes.css` e altere as cores:

```css
[data-theme="meu-tema"] {
  --color-bg:            #0e0a14;
  --color-primary:       #ff6f91;
  --color-primary-hover: #ff97b3;
  --color-primary-deep:  #b34d6a;
  --color-primary-ink:   #1a0610;
  --color-text:          #fff5f8;
  /* ... veja themes.css para a lista completa */
}
```

Aplique trocando o atributo `data-theme` no `<html>`. Os componentes adaptam automaticamente.

### Variáveis principais

| Token                 | Função                                |
|-----------------------|----------------------------------------|
| `--color-bg`          | Fundo profundo                         |
| `--color-surface`     | Fundo dos cards                        |
| `--color-primary`     | Cor de marca                           |
| `--color-primary-hover` | Cor de marca clareada                |
| `--color-primary-ink` | Cor do texto sobre superfície primária |
| `--color-text`        | Texto principal                        |
| `--color-muted`       | Texto secundário                       |
| `--color-phase-*`     | Cores por etapa (foco/curta/longa)     |
| `--radius-card`       | Raio das bordas dos cards              |
| `--shadow-card`       | Sombra dos cards                       |
| `--font-main`         | Família tipográfica                    |

---

## ⌨️ Atalhos

| Tecla         | Ação                                |
|---------------|-------------------------------------|
| `Espaço`      | Iniciar / Pausar                    |
| `Shift` + `R` | Resetar (combinação evita conflito) |
| `S`           | Pular etapa                         |
| `M`           | Mute / Unmute som                   |

> O timer **persiste em `localStorage` e retoma após Ctrl+R / refresh**. Se estava rodando, o tempo decorrido é descontado via `Date.now()` e a etapa avança se necessário. Janela com timer ativo dispara confirmação de saída.

---

## 🔧 Próximos passos sugeridos

- [ ] Histórico semanal/mensal com gráfico (canvas)
- [ ] Exportar/importar configurações (JSON)
- [ ] Modo tela cheia ergonômico (esconder UI durante foco)
- [ ] Sincronização opcional via WebDAV (sem backend próprio)
- [ ] Selector de tema dentro das configurações
- [ ] Sons alternativos (sino tibetano, ondas, etc.)
- [ ] Integração com `windowControlsOverlay` para janela frameless premium

---

## 🧪 Testar antes de comitar

Checklist mínimo:

- [ ] App abre em `http://localhost:8080` sem erros no console
- [ ] Timer roda 25min de foco e dispara chime + notificação
- [ ] Mudar configurações e clicar **Salvar** atualiza imediatamente
- [ ] Recarregar a página mantém estado e histórico do dia
- [ ] Botão **Instalar app** aparece no Chrome/Edge
- [ ] Após instalado, abre em janela standalone
- [ ] DevTools → Application → Manifest sem warnings
- [ ] DevTools → Application → Service Workers: ativo, cache populado

---

## 📜 Licença

MIT — veja [`LICENSE`](./LICENSE).

---

## ⚠️ Aviso ergonômico

Pomodoro Premium oferece lembretes leves para alongar pulso, ombro, pescoço e descansar os olhos. **Isto não é orientação médica.** Se você sente dor recorrente, formigamento ou desconforto persistente durante o uso do computador, procure um profissional de saúde (fisioterapeuta, ortopedista, oftalmologista). Use este app como ferramenta complementar, nunca como diagnóstico ou tratamento.
