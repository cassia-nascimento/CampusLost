# CampusLost — Direção visual e design system

> Tarefa T01 · dono: `ux-designer` · escrito em 19/10/2026 · landing/visitante e ilustrações do seed acrescentados em 22/10/2026 (§2.5, §6.12, §9.13–9.15).
> Implementação dos tokens: `frontend/src/app/globals.css`. Ativos: `frontend/public/brand/`.
> Regras de negócio, telas e critérios de aceite vêm de `SPEC.md` (aqui citados como AC##.#). Este documento **não** altera a SPEC; onde ela deixa lacuna de usabilidade, a lacuna está em §12.

## 0. Rótulos usados neste documento

O projeto **não define identidade visual** (nem o PDF do professor, nem o documento de decisões). Tudo o que segue é **[Premissa de design]**: proposta provisória, reversível, justificada por usabilidade. Nenhum valor é "decisão da equipe". Dados de exemplo (categorias; locais de exemplo do seed) são os demonstrativos da SPEC §3; títulos de itens e nomes nos wireframes são **apenas ilustrativos**.

## 1. Uso real e princípios

**Quem usa e como**

| Persona | Situação real | Consequência de design |
|---|---|---|
| Usuário que **achou** um objeto | De pé, no corredor, com o objeto numa mão e o celular na outra, com pressa | Registro em poucos toques: foto primeiro, campos curtos, ação principal ao alcance do polegar, data já preenchida com hoje |
| Usuário que **perdeu** algo | Caminhando, olhando rápido a lista, às vezes sob sol forte | Reconhecer pela foto, contraste alto, status legível de relance, rolagem vertical simples |
| **Administração** | Sentada, desktop/tablet, comparando duas versões de uma história | Análise com duas colunas lado a lado, decisão sempre visível, confirmações que explicam o efeito |

**Princípios (cada decisão abaixo cita o que a justifica)**

1. **Polegar primeiro.** Ações primárias ficam na metade inferior da tela (barra de ação fixa, BottomNav) e têm 48 px de altura; mínimo absoluto de 44 px (AC07.2).
2. **Reconhecer, não ler.** A foto e o título dominam o card; metadados em segunda linha; status por ícone + texto + cor.
3. **Cor só com significado.** A paleta de marca é uma só (petróleo). Verde, âmbar, vermelho e cinza-ardósia existem **apenas** para status. Assim, cor de status nunca compete com cor decorativa.
4. **Nunca só cor.** Todo status = ícone + texto + cor (§3.4).
5. **Explicar o porquê.** Ação indisponível sempre mostra a razão em texto (SPEC §6).
6. **Menos telas, mais clareza.** Nada de componentes sem uso nas 11 telas.
7. **Contraste de rua.** Todo texto ≥ 4,5:1; texto de apoio ≥ 5:1; sem cinza claro sobre branco.

## 2. Identidade visual

### 2.1 Conceito — "etiqueta institucional"

Objetos achados no campus recebem uma etiqueta (aquela de papel com furo e cordão). O CampusLost é essa etiqueta digital: **confiável como secretaria, rápido como app**. Em vez de gradientes e ilustrações genéricas, a identidade usa:

- **Papel quente** (`paper`, `#F6F4EF`) como fundo, em vez de branco frio. Reduz ofuscamento ao ar livre e dá cara de documento oficial amigável; cards brancos "flutuam" sobre ele.
- **Petróleo** (`primary`, `#0B5563`) como cor única de marca: sóbrio, institucional, longe do azul-roxo genérico de template.
- **O recorte de etiqueta** (canto superior esquerdo chanfrado + furo) como único motivo gráfico: logotipo, placeholder de foto sem imagem, ícone dos estados vazios (`tag-shape` em `globals.css`). Aparece pouco, de propósito.
- **Tipografia com personalidade nos títulos** (Bricolage Grotesque) e **neutra e muito legível no corpo** (Public Sans).
- **Sombras curtas e baixas**, bordas retas, raios médios. Sem blur gratuito, sem vidro, sem gradiente.

### 2.2 Logotipo

Marca original em `frontend/public/brand/`: etiqueta com furo do cordão e um "C" vazado.

| Arquivo | Uso |
|---|---|
| `logo-mark.svg` | Marca colorida (petróleo + branco) sobre fundos claros. Header: 28 px; login: 48–64 px |
| `logo-mark-mono.svg` | `currentColor`, "C" vazado por máscara; sobre fundos coloridos (ex.: painel petróleo da tela de entrada, usar `text-on-primary`) |
| `icon.svg` | Ícone de app/favicon (quadrado petróleo com etiqueta clara) |

**Lockup (montado em HTML, não em SVG, para usar a fonte auto-hospedada):** marca + wordmark "Campus**Lost**" em `font-display`, peso 700, `-0.01em`; "Campus" em `ink`, "Lost" em `primary`. Área livre = altura do furo ao redor. Tamanho mínimo da marca: 24 px. Não distorcer, não aplicar sombra, não recolorir fora dos tokens.

### 2.3 Tom de voz

Direto, cordial, sem jargão ("você", verbos no imperativo nos botões). Frases curtas. Erros dizem **o que houve + o que fazer**. Nunca culpam a pessoa. Sem emojis. Sem humor em erro.

### 2.4 Ícones

`lucide-react` (já permitido). Traço 2 px, tamanhos 16 (badge, metadado), 20 (botão), 24 (BottomNav, EmptyState). Ícones decorativos levam `aria-hidden="true"`; ícone sem texto vizinho leva `aria-label`. Todos os nomes usados aqui existem na versão instalada (1.59.0): `PackageOpen, PackageSearch, PackageCheck, Clock, CircleCheck, CircleX, CircleAlert, TriangleAlert, Info, Search, Plus, ListChecks, LayoutDashboard, SlidersHorizontal, MapPin, Calendar, CalendarDays, Tag, ImageOff, ImagePlus, Camera, X, Check, ChevronLeft, ChevronRight, ChevronDown, ArrowRight, UserRound, LogOut, RotateCcw, Trash2, Pencil, LoaderCircle, ShieldAlert, Lock, RefreshCw, Inbox, Eye, FileText`.

### 2.5 Fotografia

Foto do item: `object-fit: cover`, proporção 1:1 no card horizontal (96 px), 4:3 no card vertical e no detalhe. Sem foto: bloco `sunken` com ícone `Tag` (24–40 px, `ink-subtle`) recortado em `tag-shape`.

**Imagens ilustrativas do seed (P27).** Dos 11 itens demonstrativos, **9 usam fotos reais** (`frontend/public/seed/*.webp`, em retrato 3:4 a 9:16): `fones-de-ouvido`, `bone`, `chaveiro`, `calculadora`, `casaco`, `notebook`, `garrafa-termica`, `guarda-chuva`, `oculos`; **2 seguem como ilustrações vetoriais originais** (`mochila.svg`, `carregador.svg`; 4:3, `viewBox="0 0 400 300"`, fundo `primary-soft`, só cores dos tokens, sem texto, marcas ou pessoas). Mesmo as fotos são **imagens demonstrativas, não o objeto real encontrado**, por isso mantêm o rótulo "Imagem ilustrativa". Autoria/licença das fotos: da equipe, a registrar em `FOTOS.md` (não preenchido por nós). Regras de uso: (a) no card, `alt=""` (o título já descreve); (b) no detalhe, `alt="Imagem ilustrativa: {título}"` para imagem do seed (foto enviada por usuário: `alt="Foto de {título}"`, sem legenda) e, abaixo da imagem, legenda `text-meta` `ink-subtle` "Imagem ilustrativa" (só para itens do seed; item criado por usuário com foto enviada não leva legenda); (c) `object-fit: cover`, `object-position: center`: nas ilustrações 4:3 (card vertical e detalhe) nada é cortado; as fotos em retrato são recortadas na faixa central em 4:3 (sem mudar o layout); no card horizontal 1:1 (96 px) o recorte mantém a faixa central de 300 px de largura, o que corta apenas as pontas de objetos largos (óculos, carregador, notebook) — aceitável, o reconhecimento vem do título e do desenho central; (d) usar `<img>` simples (sem `next/image`). Observação: as fotos mostram marcas visíveis em 3 itens (boné, casaco, notebook); registrado em SPEC §9 (P27). `frontend/public/brand/hero.svg` (etiqueta com lupa) é decorativa da landing (`alt=""`).

### 2.6 Tema escuro

**Fora do escopo** do protótipo (`color-scheme: light` fixo). Justificativa: a SPEC não pede; o uso é diurno/ao ar livre; manter um só conjunto de pares de contraste verificados reduz risco. Reavaliar só se a equipe pedir.

## 3. Cor

### 3.1 Paleta (tokens em `globals.css`, nomes de utilitário Tailwind entre parênteses)

**Superfícies e linhas**

| Token | Hex | Papel |
|---|---|---|
| `paper` (`bg-paper`) | `#F6F4EF` | Fundo da página |
| `surface` (`bg-surface`) | `#FFFFFF` | Cards, campos, diálogos |
| `sunken` (`bg-sunken`) | `#EBE8DF` | Rebaixado: placeholder de foto, trilho de abas, linha de tabela alternada |
| `line` (`border-line`) | `#D8D4C8` | Divisores **decorativos** |
| `line-strong` (`border-line-strong`) | `#7C8580` | Borda de **controles** (campos, checkbox, radio) |

**Texto**

| Token | Hex | Papel |
|---|---|---|
| `ink` | `#1A2321` | Texto principal, títulos |
| `ink-muted` | `#46524E` | Texto secundário, descrição de ajuda |
| `ink-subtle` | `#58645F` | Metadados, placeholder, contadores |

**Marca**

| Token | Hex | Papel |
|---|---|---|
| `primary` | `#0B5563` | Botão primário, link, aba ativa, foco |
| `primary-hover` | `#084553` | Hover |
| `primary-pressed` | `#06384A` | Pressionado |
| `primary-soft` | `#E4F1F2` | Fundo de item ativo (BottomNav), aviso informativo |
| `primary-softer` | `#CBE4E7` | Seleção de texto, hover de ghost |
| `on-primary` | `#FFFFFF` | Texto sobre `primary` |

**Tons semânticos** (texto/ícone = `*-fg`, fundo = `*-bg`, contorno = `*-border`)

| Tom | fg | bg | border | Significado |
|---|---|---|---|---|
| `success` | `#14613A` | `#E0F2E6` | `#2E8B57` | Positivo / disponível / aceita |
| `warning` | `#764200` | `#FBEBC6` | `#B97500` | Aguardando análise |
| `danger` | `#9A1B1B` | `#FBE1DE` | `#C0392B` | Erro / recusada |
| `neutral` | `#37444F` | `#E3E8EC` | `#5C6B78` | Encerrado (devolvido) |
| `info` | `#084553` | `#E4F1F2` | `#3F8591` | Aviso/ajuda, demonstração |

Outros: `danger-solid` `#B42318` (hover `#8F1B12`, texto `on-danger` `#FFFFFF`) para o botão destrutivo; `disabled-bg` `#EBE8DF` / `disabled-fg` `#58645F`; `focus` `#0B5563`; `focus-on-dark` `#F6F4EF` (reservado; nenhuma superfície escura é usada hoje); `scrim` `rgb(26 35 33 / .55)`; `skeleton` `#E2DED2` / `skeleton-hi` `#EEEBE3`.

### 3.2 Como as razões de contraste foram calculadas

Fórmula WCAG 2.x: cada canal sRGB `c/255` é linearizado (`c ≤ 0,03928 ? c/12,92 : ((c+0,055)/1,055)^2,4`); luminância relativa `L = 0,2126·R + 0,7152·G + 0,0722·B`; razão `(L_claro + 0,05) / (L_escuro + 0,05)`. Calculado com um script Python executado de forma avulsa em 19/10/2026 (não versionado, para não criar arquivo fora dos donos permitidos), sobre **todos os pares que a interface usa**; os valores abaixo são a saída desse cálculo. Limiares: texto normal ≥ 4,5:1 (1.4.3); componentes de interface e ícones de status ≥ 3:1 (1.4.11). Meta interna: texto ≥ 4,5 mesmo sobre `sunken`; texto de apoio ≥ 5.

**Texto (mínimo 4,5:1)**

| Primeiro plano | Fundo | Razão | Resultado |
|---|---|---|---|
| `ink` #1A2321 | `paper` #F6F4EF | **14,63** | AAA |
| `ink` | `surface` #FFFFFF | **16,08** | AAA |
| `ink` | `sunken` #EBE8DF | **13,12** | AAA |
| `ink` | `primary-soft` #E4F1F2 | **13,90** | AAA |
| `ink-muted` #46524E | `paper` | **7,41** | AAA |
| `ink-muted` | `surface` | **8,15** | AAA |
| `ink-muted` | `sunken` | **6,65** | AA |
| `ink-muted` | `primary-soft` | **7,05** | AAA |
| `ink-subtle` #58645F | `paper` | **5,61** | AA |
| `ink-subtle` | `surface` | **6,17** | AA |
| `ink-subtle` | `sunken` | **5,04** | AA (menor margem do sistema; não usar sobre outro fundo) |
| `primary` #0B5563 (link, aba) | `paper` | **7,66** | AAA |
| `primary` | `surface` | **8,42** | AAA |
| `primary` | `sunken` | **6,87** | AA |
| `primary` | `primary-soft` | **7,28** | AAA |
| `on-primary` #FFFFFF | `primary` | **8,42** | AAA |
| `on-primary` | `primary-hover` #084553 | **10,57** | AAA |
| `on-primary` | `primary-pressed` #06384A | **12,56** | AAA |
| `on-danger` #FFFFFF | `danger-solid` #B42318 | **6,57** | AA |
| `on-danger` | `danger-solid-hover` #8F1B12 | **9,00** | AAA |
| `success-fg` #14613A | `success-bg` #E0F2E6 | **6,43** | AA |
| `warning-fg` #764200 | `warning-bg` #FBEBC6 | **6,98** | AA |
| `danger-fg` #9A1B1B | `danger-bg` #FBE1DE | **6,65** | AA |
| `neutral-fg` #37444F | `neutral-bg` #E3E8EC | **8,10** | AAA |
| `info-fg` #084553 | `info-bg` #E4F1F2 | **9,14** | AAA |
| `ink` | `success-bg` / `warning-bg` / `danger-bg` / `neutral-bg` / `info-bg` (corpo de Notice) | **13,79 / 13,63 / 12,96 / 13,03 / 13,90** | AAA |
| `ink-muted` | os mesmos cinco fundos | **6,99 / 6,91 / 6,57 / 6,60 / 7,05** | AA |
| `success-fg` / `warning-fg` / `danger-fg` / `neutral-fg` | `surface` | **7,50 / 8,24 / 8,25 / 9,99** | AAA (texto de erro/ajuda direto sobre card) |
| `success-fg` / `warning-fg` / `danger-fg` / `neutral-fg` | `paper` | **6,82 / 7,49 / 7,50 / 9,09** | AA/AAA (idem, sobre a página) |
| `danger-solid` #B42318 | `paper` / `surface` | **5,98 / 6,57** | AA (borda e ícone de erro) |

**Não texto (mínimo 3:1)**

| Elemento | Par | Razão | Resultado |
|---|---|---|---|
| Borda de campo | `line-strong` #7C8580 / `surface` | **3,80** | passa |
| Borda de campo sobre a página | `line-strong` / `paper` | **3,46** | passa |
| Borda de campo/controle sobre `sunken` | `line-strong` / `sunken` | **3,10** | passa (limite; evitar campos sobre `sunken`) |
| Contorno do badge | `success-border` / `success-bg` | **3,64** | passa |
| | `warning-border` / `warning-bg` | **3,17** | passa (limite) |
| | `danger-border` / `danger-bg` | **4,38** | passa |
| | `neutral-border` / `neutral-bg` | **4,44** | passa |
| | `info-border` / `info-bg` | **3,65** | passa |
| Anel de foco `focus` #0B5563 | sobre `paper` / `surface` / `sunken` | **7,66 / 8,42 / 6,87** | passa |
| | sobre `primary-soft` / `success-bg` / `warning-bg` / `neutral-bg` / `danger-bg` | **7,28 / 7,22 / 7,14 / 6,82 / 6,79** | passa em todo fundo do sistema |
| Ícone de status | = `*-fg` sobre `*-bg` | 6,43–9,14 | passa |

**Decorativos, isentos de razão mínima (de propósito):** `line` sobre `paper` = 1,35; `skeleton` sobre `paper` = 1,22. Por isso `line` só serve para divisores e **nunca** para borda de campo ou botão secundário.

**Armadilhas já resolvidas por tokens:** borda de campo em `line-strong` (não em `line`); placeholder em `ink-subtle` (5,61–6,17, não cinza-claro); texto de erro em `danger-fg` (não em vermelho de borda); âmbar nunca é usado como texto direto, só `warning-fg` (marrom) sobre `warning-bg`.

### 3.3 Foco visível

Global em `globals.css`: `outline: 3px solid var(--color-focus)` com `outline-offset: 2px`. Como há 2 px de folga, o anel sempre toca a superfície de página ao redor (não o fundo colorido do botão), então vale a razão do anel sobre `paper`/`surface`. Em campos, além do anel, a borda muda para `primary`. Nenhum componente pode usar `outline: none` sem substituto.

### 3.4 Regra de status: cor + ícone + texto (obrigatória)

Nunca mostrar status só com cor, só com ícone ou só com ponto colorido. Todo status é um **Badge** com ícone + rótulo escrito + cor (+ contorno de 1 px). O rótulo é o nome acessível; o ícone é `aria-hidden`.

**Status do item**

| Status (SPEC) | Rótulo | Tom | Ícone (lucide) | Significado exibido ao lado (StatusNote) |
|---|---|---|---|---|
| `available` | Disponível | success | `PackageOpen` | "Pode ser reivindicado." |
| `under_claim` | Em reivindicação | warning | `PackageSearch` | "Há reivindicação em andamento." |
| `returned` | Devolvido | neutral | `PackageCheck` | "Este item já foi devolvido ao dono." |

**Status da reivindicação**

| Status (SPEC) | Rótulo | Tom | Ícone (lucide) |
|---|---|---|---|
| `pending` | Pendente | warning | `Clock` |
| `accepted` | Aceita | success | `CircleCheck` |
| `rejected` | Recusada | danger | `CircleX` |

Lógica dos tons: âmbar = "aguardando alguém decidir" (tanto item Em reivindicação quanto reivindicação Pendente); verde = "positivo/livre" ; vermelho = "negativo, sem reenvio"; ardósia = "encerrado, saiu da busca". Os ícones de item formam uma família (caixa aberta → caixa com lupa → caixa com visto) e os de reivindicação outra (relógio, visto, x), para não confundir os dois status quando aparecem juntos (ex.: "Minhas reivindicações").

Em tabelas e listas densas, o badge continua com ícone + texto (não abreviar). Em modo de alto contraste do sistema (`forced-colors`) o contorno de 1 px mantém a forma.

## 4. Tipografia (auto-hospedada)

### 4.1 Fontes

| Função | Família | Eixo | Por quê |
|---|---|---|---|
| Corpo, UI, campos | **Public Sans** (variável) | wght 100–900 | Desenhada para interfaces institucionais e leitura em tela; aberturas amplas, boa distinção entre `I`/`l`/`1`, cobre todos os acentos do pt-BR. Neutra: deixa a foto e o status conduzirem |
| Títulos, wordmark, números de destaque | **Bricolage Grotesque** (variável) | wght 200–800 | Grotesca com contraste de traço e fechamentos fortes: dá a personalidade "etiqueta" sem comprometer legibilidade; só em h1–h3/wordmark, nunca em texto corrido |

Licença: ambas SIL OFL (uso livre, incluindo auto-hospedagem). Pesos usados: corpo 400/500/600; títulos 650/700.

### 4.2 Instalação e ligação (pedido ao orquestrador)

Pacotes exatos (verificados no registro npm em 19/10/2026; o tarball foi baixado e inspecionado: família CSS `'Public Sans Variable'` e `'Bricolage Grotesque Variable'`, `font-display: swap`, `.woff2` dentro do pacote, **zero requisição a terceiros**):

```
npm install @fontsource-variable/public-sans@5.3.0 @fontsource-variable/bricolage-grotesque@5.3.0
```

O `frontend-engineer` só precisa importar os CSS **uma vez**, no topo de `layout.tsx` (import de pacote npm, sem `next/font/google`):

```ts
import "@fontsource-variable/public-sans";
import "@fontsource-variable/bricolage-grotesque";
```

`globals.css` já referencia as famílias em `--font-sans` e `--font-display` (utilitários `font-sans`, `font-display`), com cadeia de fallback de sistema. Gancho opcional: se a equipe preferir `next/font/local`, definir `--font-sans-local` / `--font-display-local` no `<html>` basta; sem isso valem os nomes do pacote. Os arquivos `.woff2` do subconjunto `latin` (≈28 KB e ≈44 KB) são os únicos baixados na prática (o navegador só pede `latin-ext`/`vietnamese` se aparecer caractere fora do latim básico).

### 4.3 Escala (token → tamanho → uso)

Mínimo absoluto: **14 px**. Campos: 16 px (evita zoom automático do iOS ao focar).

| Utilitário | Tamanho (360 → ≥1024) | Line-height | Peso / família | Uso |
|---|---|---|---|---|
| `text-display` | 34 → 48 px | 1,08 | 700 · display | Só `/entrar` e `/cadastro` |
| `text-h1` | 28 → 36 px | 1,15 | 700 · display | Título da página (um por página) |
| `text-h2` | 22 → 26 px | 1,25 | 700 · display | Seções |
| `text-h3` | 20 px | 1,3 | 650 · display | Subseções, título de diálogo |
| `text-lead` | 18 px | 1,4 | 600 · sans | Título do card de item, valores em destaque |
| `text-body` | 16 px | 1,5 | 400 · sans | Corpo, campos, botões (600) |
| `text-meta` | 14 px | 1,45 | 400/600 · sans | Metadados, badge (600), ajuda, erro, rótulo de BottomNav |

`text-xs` e `text-sm` do Tailwind foram **fixados em 14 px** para impedir texto menor sem querer. Títulos usam `text-wrap: balance`; parágrafos `pretty`. Datas e contagens: `tabular` (números tabulares). Linhas de leitura: máximo ~65 caracteres (`max-w-form`).

## 5. Espaçamento, forma, camadas e movimento

### 5.1 Espaçamento

Base de 4 px (`--spacing` do Tailwind: `p-1` = 4 px). Escala usada: **4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64** (classes 1, 2, 3, 4, 5, 6, 8, 10, 12, 16).

| Uso | Valor |
|---|---|
| Margem lateral da página (`px-gutter`) | 16 px (360) · 24 px (≥768) · 32 px (≥1024) |
| Padding de card | 12 px (card horizontal), 16 px (demais), 20 px (≥768) |
| Espaço entre cards de lista | 12 px |
| Espaço entre campos de formulário | 20 px |
| Espaço entre seções | 32 px |
| Espaço mínimo entre alvos de toque adjacentes | 8 px |

### 5.2 Alvos de toque

`touch-target` = 44 × 44 px mínimos (todo controle); `touch-target-lg` = 48 px (ações principais e campos). Ícone de 20 px dentro de botão de ícone ocupa área de 44 px. Link de texto corrido tem exceção da WCAG 2.5.8 (inline), mas links isolados (rodapé, "Criar conta") usam `touch-target`.

### 5.3 Raios e sombras

| Token | Valor | Uso |
|---|---|---|
| `rounded-sm` | 6 px | Skeleton, chips pequenos |
| `rounded-md` | 10 px | Botões, campos, foto |
| `rounded-lg` | 14 px | Cards |
| `rounded-xl` | 20 px | Diálogo, topo do bottom sheet |
| `rounded-full` | 9999 px | Badge, chip, avatar |
| `shadow-card` | 1 px curta + anel 4 % | Card em repouso |
| `shadow-raised` | 6/16 px, 14 % | Card em hover/press, menu |
| `shadow-overlay` | 20/44 px, 30 % | Diálogo, toast |
| `shadow-bar` | linha superior + sombra para cima | Barra de ação fixa e BottomNav |

### 5.4 Larguras de conteúdo e breakpoints

Breakpoints padrão do Tailwind, **mobile-first**: base 360 · `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280. Contêineres: `max-w-form` 640 px (formulários, leitura), `max-w-page` 1152 px (busca, detalhe), `max-w-admin` 1280 px (painel, análise).

### 5.5 Camadas (z-index) e movimento

Header e BottomNav `z-30`; barra de ação fixa `z-20`; diálogo/sheet `z-50` (nativo `<dialog>` usa top layer); toast `z-60`. Movimento: 120–200 ms, `--ease-standard`; só `opacity` e `transform`; entradas `animate-rise`/`animate-fade`; `prefers-reduced-motion` desliga animação (já em `globals.css`). Skeleton para de pulsar com movimento reduzido.

## 6. Componentes e estados

Convenções: todo componente usa **somente tokens**; foco por `:focus-visible` global; nomes entre crases são sugestões de API (o `frontend-engineer` decide a implementação). Os estados padrão são: `default · hover · active · focus-visible · disabled · loading · error`, quando aplicáveis. `hover` só existe em ponteiro fino (usar `@media (hover:hover)` ou variante `hover:`; toque não pode depender de hover).

### 6.1 Button

| Variante | Fundo | Texto | Borda | Hover | Active | Uso |
|---|---|---|---|---|---|---|
| `primary` | `primary` | `on-primary` | — | `primary-hover` | `primary-pressed` | Uma por tela: ação principal |
| `secondary` | `surface` | `primary` | 1,5 px `primary` | `primary-soft` | `primary-softer` | Ação alternativa |
| `ghost` | transparente | `primary` | — | `primary-soft` | `primary-softer` | Ações discretas ("Limpar filtros") |
| `danger` | `danger-solid` | `on-danger` | — | `danger-solid-hover` | idem hover | **Só dentro do diálogo** de confirmação destrutiva |
| `danger-quiet` | `surface` | `danger-fg` | 1,5 px `danger-border` | `danger-bg` | idem | Gatilho "Excluir item" (abre diálogo) |

- **Tamanhos:** `md` altura ≥ 44 px, `px-4`, `text-body` 600; `lg` altura 48 px, `px-5` (ações principais em mobile); botão de ícone 44 × 44 px (`aria-label` obrigatório). Raio `rounded-md`; ícone 20 px à esquerda com `gap-2`.
- **Largura:** `w-full` até `sm` em formulários e barras de ação; auto a partir de `sm`.
- **Loading:** ícone `LoaderCircle` girando (`animate-spin`) no lugar do ícone, rótulo vira gerúndio ("Salvando…"), `aria-busy="true"`, cliques ignorados, **largura preservada** (sem salto de layout).
- **Disabled:** `disabled-bg` + `disabled-fg`, sem sombra, `cursor-not-allowed`. **Regra:** quando a ação está indisponível por permissão ou status e a pessoa precisa saber por quê, **não** use `disabled` (não recebe foco, leitor de tela não descobre): mostrar o motivo em texto visível (Notice) no lugar do botão, ou `aria-disabled="true"` + texto associado por `aria-describedby`. `disabled` puro serve só para "enviando".
- **Foco:** anel global; nunca remover.

### 6.2 Input · Select · Textarea · FileInput

Base comum: altura 48 px (`touch-target-lg`), `px-3.5`, `rounded-md`, fundo `surface`, borda 1 px `line-strong`, texto `ink` 16 px, placeholder `ink-subtle`.

| Estado | Visual |
|---|---|
| default | borda `line-strong` |
| hover (ponteiro) | borda `ink-muted` |
| focus-visible | borda 2 px `primary` + anel global |
| filled | idem default |
| error | borda 2 px `danger-border` + **ícone `CircleAlert` + mensagem** abaixo (nunca só a borda) ; `aria-invalid="true"` |
| disabled / read-only | fundo `disabled-bg`, texto `disabled-fg`, sem borda forte; read-only mantém texto `ink` |

- **Select:** `<select>` **nativo** (seletor de sistema no celular é mais rápido e acessível que menu customizado), `appearance: none` + `ChevronDown` 20 px à direita; opção vazia "Selecione…" só quando o campo é obrigatório e sem padrão.
- **Textarea:** altura mínima 112 px (≈ 4 linhas), `resize-y`; contador "0/500" em `text-meta` `ink-subtle` aparece a partir de 80 % do limite.
- **Data:** `<input type="date">` nativo; `max` = hoje no registro; formato exibido do SO (dd/mm/aaaa).
- **FileInput (foto):** com a prop opcional `capture`, duas ações `secondary` **lado a lado a partir de `sm` e empilhadas em largura total abaixo disso (360 px)**: "Enviar foto" (`ImagePlus`, `<input type="file" accept="image/jpeg,image/png,image/webp">`) e "Tirar foto" (`Camera`, segundo `<input type="file" accept="image/*" capture="environment">`, recurso nativo: sem `getUserMedia`, sem JS de câmera). Os dois alimentam o **mesmo** `onChange` e a mesma validação (`validatePhotoFile`: formato e tamanho; HEIC da câmera recebe a mensagem de formato). Sob os botões: nota de formato e a ajuda "Se a câmera não abrir neste aparelho, use Enviar foto." (ligada aos botões por `aria-describedby`; sem suporte a `capture`, o campo cai num seletor de arquivo). Sem a prop `capture`, vale só o botão "Adicionar foto" (o celular oferece câmera **ou** galeria). Selecionada: pré-visualização 4:3 (largura 100 %, máx. 20 rem), nome do arquivo e botões `ghost` "Trocar foto" / "Tirar outra foto" / "Remover foto" (44 px). Erros de tipo/tamanho aparecem como erro de campo. **Limite adotado: 10 MB de entrada (JPG/PNG/WebP), reduzida automaticamente no cliente para ≤ 640 px** — [Premissa]; fotos de celular costumam passar de 2 MB; ver risco em §12 (R2). Foto é sempre opcional (SPEC P6).

**Campos condicionais (padrão).** Um campo que só faz sentido para uma escolha (ex.: "Especifique a categoria" quando a categoria é "Outros") aparece **logo abaixo** do controle que o aciona, é obrigatório só enquanto visível, tem rótulo, ajuda com exemplo e limite, e erro ligado por `aria-describedby`. Não rouba o foco (quem navega o `select` pelo teclado seria interrompido); o leitor de tela é avisado pela região `role="status"` do formulário ("Novo campo abaixo: …"). Ao esconder o campo, seu valor e erro são **limpos** para nunca enviar dado inconsistente. Informação restrita (ex.: "Onde está guardado agora?") traz na ajuda **quem a vê** ("Só a administração vê esta informação").

### 6.3 Field (rótulo + ajuda + erro)

Estrutura vertical: **rótulo** (`text-meta` 600 `ink`, sempre visível, acima do campo — nunca só placeholder) → **ajuda** opcional (`text-meta` `ink-muted`) → **controle** → **erro** (`text-meta` `danger-fg`, ícone `CircleAlert` 16 px). `label for`/`id` associados; ajuda e erro ligados por `aria-describedby` (ajuda primeiro, erro depois); o container do erro é uma região `aria-live="polite"` presente no DOM desde o início para o anúncio funcionar (AC08.1).

- **Obrigatório vs. opcional:** formulários dizem logo abaixo do título "Todos os campos são obrigatórios, exceto os marcados como (opcional)"; campos opcionais levam "(opcional)" em `ink-subtle` junto ao rótulo; **sem asterisco** (leitor de tela e pt-BR lidam melhor com "(opcional)").
- **Quando mostrar erro:** ao sair do campo (`onTouched`) e no envio; ao corrigir, o erro some imediatamente. No envio com erros: foco vai ao **primeiro campo inválido** e uma região `aria-live` anuncia "Corrija 2 campos para continuar". Sem erro "genérico" que não aponte o campo.
- **Grupo de rádio:** usado onde houver escolha única (o cadastro **não** tem mais escolha de papel, 27/10/2026); `<fieldset>` + `<legend>`; cada opção é um cartão de 48 px com rádio nativo estilizado (borda `line-strong`, selecionado = borda 2 px `primary` + fundo `primary-soft` + `Check` — **não só cor**).

### 6.4 Badge de status (`ItemStatusBadge`, `ClaimStatusBadge`)

Pílula `rounded-full`, altura 28 px, `px-2.5`, `gap-1.5`, ícone 16 px + rótulo `text-meta` 600, fundo `*-bg`, texto e ícone `*-fg`, contorno 1 px `*-border`. Mapeamento fechado em §3.4: **cada status tem um único rótulo, ícone e tom**; o componente recebe o status e deriva o resto (impossível renderizar sem ícone/texto). Não interativo (não é botão; sem alvo de 44 px). Tamanho `lg` (32 px, ícone 20) no cabeçalho do detalhe.

### 6.5 ItemCard

Um único elemento de link para `/itens/[id]` (o card inteiro é o alvo; sem botões aninhados). Imagem decorativa com `alt=""` (o título já descreve). Fundo `surface`, `rounded-lg`, `shadow-card`; hover `shadow-raised`; active fundo `paper`; foco = anel global no card.

**Mobile (< 640 px), horizontal:** foto 96 × 96 px (`rounded-md`) | coluna: título (`text-lead` 600, máx. 2 linhas, `line-clamp-2`) → `ItemStatusBadge` → meta (`text-meta` `ink-subtle`, ícone `MapPin` + local · `Calendar` + data relativa). Altura mínima 120 px, padding 12 px, `gap-3`.

**≥ 640 px, vertical em grade (2 col `sm`, 3 col `lg`):** foto 4:3 no topo (sem padding, raio no topo), conteúdo abaixo com padding 16 px.

Slot opcional de rodapé: `ClaimStatusBadge` com prefixo "Sua reivindicação:" quando a pessoa logada já tem reivindicação no item (AC04.1). Estados: default · hover · active · focus-visible · **skeleton** (mesma geometria, sem salto) · **sem foto** (placeholder `sunken` + `Tag` em `tag-shape`). Dados longos: título quebra (`overflow-wrap`), nunca estoura a largura.

### 6.6 Dialog (confirmação e bottom sheet)

`<dialog>` nativo com `showModal()` (foco preso, `Esc` fecha, restante inerte; `globals.css` trava a rolagem do fundo e define o `::backdrop`). Anatomia: título `h2` (`text-h3`) — `aria-labelledby`; descrição curta — `aria-describedby`; corpo; ações; botão fechar `X` 44 px no canto (omitido em confirmação crítica em andamento).

| Variante | Quando | Forma |
|---|---|---|
| `confirm` | Aceitar, recusar, registrar devolução, reiniciar demo | Centrado, `max-w-md` (28 rem), `rounded-xl`, `shadow-overlay`, padding 20 px |
| `destructive` | Excluir item | Igual, ícone `TriangleAlert` `danger-fg` no topo, botão `danger` |
| `sheet` | Filtros no mobile (< 768 px) | Preso à base, largura total, `rounded-t-xl`, altura máx. 85 dvh com rolagem interna, `pb-safe`; rótulo "Filtros" |

- **Ações:** em mobile empilhadas, **ação principal em cima** (alcance do polegar), cancelar embaixo, ambas 48 px; a partir de `sm`, em linha à direita: [Cancelar] [Confirmar].
- **Foco inicial:** primeiro campo (sheet) / botão **Cancelar** (destrutivo e irreversível) / botão de confirmação (demais). Ao fechar, foco volta ao gatilho.
- **Durante envio:** botão de confirmação em `loading`, cancelar desabilitado, `Esc` e clique no scrim ignorados.
- **Regra de conteúdo:** o diálogo diz **o efeito** ("As outras 2 reivindicações serão recusadas") e se é **irreversível**.

### 6.7 Toast

Cartão `surface`, `shadow-overlay`, `rounded-lg`, barra lateral de 4 px na cor `*-border`, ícone `*-fg` (`CircleCheck` sucesso · `CircleAlert`/`TriangleAlert` erro · `Info` informação) + texto `ink` + (opcional) ação em link + `X` 44 px. Largura `calc(100vw - 2 * gutter)`, máx. 24 rem. Posição: mobile = centrado acima do BottomNav (`bottom: bottomnav-h + safe-area + 12 px`) ou a 16 px da base quando não há BottomNav; ≥ 768 px = canto inferior direito. Entrada `animate-rise`. **Semântica:** contêiner `role="status"` (sucesso/info, educado) ou `role="alert"` (erro). **Tempo:** sucesso 6 s, pausa em hover/foco (WCAG 2.2.1); **erro permanece até ser dispensado**. Máximo 1 toast visível (o novo substitui o anterior). Toast nunca é o único registro de algo importante: o resultado também aparece na tela (ex.: o item novo no topo da lista).

### 6.8 Skeleton

Utilitário `skeleton` (`globals.css`). Cada lista tem seu esqueleto com a **mesma geometria** do conteúdo (ItemCardSkeleton: foto 96 px + 3 barras). Quantidade padrão: 4 cards. Contêiner `aria-busy="true"` + texto `sr-only` "Carregando itens…" em `role="status"`; os blocos são `aria-hidden`. Latência mock 300–600 ms (SPEC §6): exibir o esqueleto por **no mínimo 300 ms** para não piscar.

### 6.9 EmptyState

Centrado, máx. `max-w-sm`: ícone 24 px num bloco de 64 px `primary-soft` em `tag-shape`, título `text-h3`, texto `text-body` `ink-muted` (1–2 frases), ação opcional (`primary` ou `secondary`). Variantes:

| Variante | Quando | Exemplo de ação |
|---|---|---|
| `empty` | Nunca houve dados | "Registrar item" |
| `no-results` | Filtros sem retorno (AC03.5) | "Limpar filtros" (`secondary`) |
| `restricted` | Indisponível por **permissão ou status**, explicando o motivo (AC01.5, AC06.1) | Voltar para uma página permitida |

### 6.10 ErrorState

Mesma geometria do EmptyState, mas ícone `TriangleAlert` em `danger-bg`/`danger-fg`, título curto, **causa provável + o que fazer**, botão `secondary` "Tentar novamente" (`RefreshCw`) que refaz a chamada **sem recarregar a página**. Erro de carregamento de lista ocupa o lugar da lista; erro de ação (enviar formulário) vira Notice `danger` no topo do formulário **e** toast de erro; os dados digitados nunca são apagados. `role="alert"`.

### 6.11 Tabs e Filtros

**Tabs** (admin, mobile: alterna "Reivindicações pendentes" / "Itens em reivindicação"): `role="tablist"`; cada aba é botão ≥ 44 px, texto `text-body` 600, contagem em pílula `sunken`; selecionada = texto `ink` + barra inferior de 3 px `primary`; não selecionada = `ink-muted`; setas ← → movem entre abas, `Home`/`End`; painel `role="tabpanel"`. Trilho com borda inferior `line`. Rola horizontalmente só dentro do trilho, se necessário.

**FilterBar** (busca `/itens`): campos Categoria (select), Local (**texto livre**, "contém", máx. 120, aplicado com a mesma espera das datas; chip "Local: …"), **Encontrado de** e **até** (date; o rótulo diz "Encontrado" porque o filtro usa a data em que o item foi encontrado — SPEC P11). Duas apresentações do mesmo componente:

- **< 768 px:** linha fixa sob o header com botão `secondary` "Filtros" (`SlidersHorizontal`, contador `(2)` quando há filtros ativos) + contagem "12 itens" (`text-meta`, `aria-live="polite"`). Toca → `Dialog` variante `sheet` com os campos, [Aplicar] (primary) e [Limpar] (ghost). Filtros ativos viram **chips** removíveis abaixo da linha (altura 44 px, texto + `X`).
- **≥ 768 px:** barra em linha acima da lista (grade de 4 campos + "Limpar filtros"), aplicação imediata ao mudar (sem botão Aplicar).

Em `/admin/devolucoes` só há o período (De/Até), sempre em linha (duas colunas até 360 px).

### 6.12 Header, Navegação e BottomNav

**Header** (`z-30`, altura 56 px, fundo `surface`, borda inferior `line`):

- **Páginas de topo:** marca 28 px + wordmark à esquerda; à direita, botão de usuário (círculo 44 px com inicial do nome, `aria-label="Menu da conta"`) que abre menu: nome e papel de acesso ("Usuário" ou "Administração"), "Reiniciar demonstração", "Sair".
- **Páginas de detalhe/formulário (drill-down):** botão voltar `ChevronLeft` 44 px à esquerda + título da página (`text-lead` 600, truncado) em lugar do wordmark.
- **≥ 768 px:** navegação em texto no header (Itens · Minhas reivindicações para usuário; Painel · Itens · Devoluções para administração) com `aria-current="page"` e indicador inferior de 3 px `primary`; botão `primary` md "Registrar item" à direita antes do menu da conta.

**Header público** (visitante sem sessão, em `/`, `/itens`, `/itens/[id]`; P26). Mesma altura (56 px), fundo e borda do Header logado; **nunca** tem BottomNav (visitante não tem destinos de topo para alternar e a ação principal dele está no conteúdo). Conteúdo:

| Largura | À esquerda | À direita |
|---|---|---|
| **360 px** (< 640) | marca 28 px + wordmark (link para `/`), ≈ 141 px | **um** botão `secondary` md "Entrar" (≈ 84 px, 44 px de altura) |
| `sm` ≥ 640 | idem | "Ver itens" (link de texto 44 px) · "Entrar" `secondary` md · "Criar conta" `primary` md |
| `md` ≥ 768 | marca + wordmark + nav em texto: "Ver itens" (`aria-current="page"` quando em `/itens`) | "Entrar" `ghost` · "Criar conta" `primary` |
| `lg` ≥ 1024 | nav ganha "Como funciona" e "Perguntas" (âncoras `/#como-funciona` e `/#perguntas` da landing; nunca `aria-current`) | idem |

Por que só "Entrar" a 360 px: a área útil é 328 px; marca (141) + "Entrar" (84) + "Criar conta" (≈ 114) + 8 px de folga = 347 px, **não cabe** sem reduzir alvo ou quebrar linha. "Entrar" fica no header porque é a ação de quem já tem conta (a maioria, sendo comunidade acadêmica); **"Criar conta" aparece no corpo** (hero, bloco final da landing, Notice do visitante em `/itens` e no detalhe), sempre ao alcance do polegar. "Ver itens" some do header a 360 px porque a própria landing já tem o CTA principal e em `/itens` o visitante já está lá. Em `/entrar` e `/cadastro` o header continua o de hoje (sem nav). Quando há sessão, vale o Header logado.

**BottomNav** (somente < 768 px, **somente em páginas de topo**: `/itens`, `/minhas-reivindicacoes`, `/admin`, `/admin/devolucoes`): fixa, altura 64 px + `pb-safe`, fundo `surface`, `shadow-bar`, `<nav aria-label="Principal">`. Itens de largura igual (≥ 90 px a 360 px) e 64 px de altura, bem acima do mínimo de 44 px: ícone 24 px + rótulo `text-meta`. Ativo: pílula `primary-soft` atrás do ícone, rótulo `primary` 600, `aria-current="page"`; inativo: `ink-muted`.

| Perfil | Itens (ícone · rótulo) |
|---|---|
| Usuário (3) | `Search` Itens · `Plus` Registrar · `ListChecks` Reivindicações (`aria-label` completo "Minhas reivindicações") |
| Administração (4) | `LayoutDashboard` Painel · `Search` Itens · `Plus` Registrar · `PackageCheck` Devoluções |

"Registrar" é o item central e tem ênfase: o ícone fica num círculo `primary` de 48 px com `on-primary` (é a ação mais frequente de quem achou algo). Em páginas de formulário/detalhe o BottomNav **não aparece**: dá lugar à barra de ação fixa (evita duas barras empilhadas). Conteúdo ganha `pb-bottomnav`.

### 6.13 Componentes compostos (usam apenas os acima)

- **Notice** (aviso inline): tom + ícone + texto (`text-meta`/`body`) + ação opcional; fundo `*-bg`, borda 1 px `*-border`, ícone e título em `*-fg`, **corpo do texto em `ink`** sobre `*-bg` (razões em §3.2). `role="status"` por padrão; `role="alert"` só para erro pós-ação. Usos: banner de demonstração (`info`), motivo de indisponibilidade (`info`/`neutral`/`danger`), alerta antifraude no registro (`info`), item devolvido (`neutral`).
- **ActionBar fixa** (formulário e detalhe, < 768 px): base da tela, `surface`, `shadow-bar`, `px-gutter`, `py-3`, `pb-safe`, botões `lg` de largura total; ≥ 768 px vira linha comum no fim do conteúdo (não fixa).
- **PageHeader:** `h1` + (opcional) texto de apoio `ink-muted` + (opcional) ações à direita em ≥ 768 px.
- **DefinitionList** (detalhe/análise): pares rótulo (`text-meta` `ink-subtle`) / valor (`text-body` `ink`), com ícone de 16 px no rótulo; empilhados em mobile, 2 colunas ≥ 640 px.
- **ClaimCard** (minhas reivindicações / lista do admin): título do item, `ClaimStatusBadge`, "Enviada em …", texto de próximo passo por status (§10), ação "Ver item" / "Analisar".
- **Tabela de devoluções** (≥ 768 px): `<table>` real com `<caption class="sr-only">`, `<th scope="col">`, cabeçalho `sunken`, linhas separadas por `line`, texto `text-body`; < 768 px vira lista de cards empilhados (mesmos dados, rótulos visíveis por linha).

## 7. Padrões de feedback

| Estado | Padrão visual | Texto | Semântica |
|---|---|---|---|
| **Carregando (lista/página)** | Skeleton com a geometria final | "Carregando itens…" (`sr-only`) | `aria-busy`, `role="status"` |
| **Carregando (ação)** | Botão em `loading` (ícone giratório, rótulo "Salvando…") | gerúndio do verbo | `aria-busy` no botão |
| **Vazio** | EmptyState `empty` | Explica quando a lista se preenche + ação | — |
| **Sem resultados do filtro** | EmptyState `no-results` | "Nenhum item com esses filtros" + "Limpar filtros" (AC03.5) | contagem em `aria-live` |
| **Erro de carregamento** | ErrorState | Causa + "Tentar novamente" | `role="alert"` |
| **Erro de ação / formulário** | Erros por campo + Notice `danger` no topo do formulário + foco no primeiro inválido | Ver §10 | `aria-live`, `aria-invalid`, `aria-describedby` |
| **Sucesso** | Toast + resultado visível na tela | Verbo no passado: "Item registrado." | `role="status"` |
| **Indisponível (permissão/status)** | Notice (`info`/`neutral`/`danger`) no lugar da ação, ou EmptyState `restricted` | **Sempre o motivo** + o que fazer | texto visível (não só `disabled`) |
| **Atualização de status sem recarregar** (AC04.8) | Badge troca de rótulo/ícone/cor; região `aria-live="polite"` anuncia "Status atualizado: Aceita" | — | região `aria-live` |

## 8. Layouts

### 8.1 Estrutura global (shell)

```
< 768 px                         ≥ 768 px
+----------------------+         +--------------------------------------------+
| Header 56 px         |         | Header: marca | nav | [Registrar] (A)      |
|----------------------|         |--------------------------------------------|
|                      |         |  conteúdo (max-w-page/admin, px-gutter)    |
| conteúdo (px 16)     |         |                                            |
|                      |         |                                            |
|                      |         +--------------------------------------------+
| BottomNav 64 px (*)  |
+----------------------+
(*) só em páginas de topo; formulários/detalhe usam ActionBar fixa.
```

~~Banner e rodapé de demonstração (AC01.6/RNF01)~~ foram **removidos** por decisão da usuária em 20/10/2026. Permanece apenas uma faixa de aviso de armazenamento indisponível (`role="status"`), exibida somente quando o navegador não guarda os dados.

### 8.2 360 px (base) — o que se aplica

- Uma coluna; `px-gutter` = 16 px ⇒ área útil 328 px; **nenhum elemento fixo > 328 px**; sem rolagem horizontal da página (AC07.1): textos com `overflow-wrap`, imagens `max-w-full`, tabela vira cards, trilho de abas rola só internamente.
- Card horizontal: 12 + 96 + 12 + coluna de texto ≈ 196 px (≈ 24 caracteres por linha de título; 2 linhas).
- Datas em duas colunas (De/Até): ≈ 158 px cada, cabe "dd/mm/aaaa" em 16 px.
- Alvos: 48 px nos botões e campos; 44 px mínimo nos demais; 8 px entre alvos.
- Teclado virtual: a ActionBar fixa **sobe junto** ao teclado (usar `dvh`/`visualViewport`-friendly: não usar `100vh`); campos recebem `scroll-padding` para não ficar sob a barra.

### 8.3 Tablet e desktop

| Largura | Mudança |
|---|---|
| `sm` ≥ 640 | Lista de itens em **grade 2 col** (card vertical); formulário centralizado `max-w-form`; ações de diálogo em linha |
| `md` ≥ 768 | BottomNav some → nav no header; FilterBar em linha (sem sheet); **análise do admin em 2 colunas**; tabela de devoluções; botão "Registrar item" no header |
| `lg` ≥ 1024 | Grade de itens **3 col**; detalhe em 2 colunas (foto à esquerda, dados à direita); painel admin em 2 colunas; gutter 32 px |
| `xl` ≥ 1280 | `max-w-admin` (1280 px) para painel e análise; nada além disso (sem linhas de leitura longas) |

## 9. Wireframes das 11 telas (SPEC §5)

Legenda: `[ Botão ]` botão · `( campo )` campo · `{ Badge }` status (ícone + texto) · `<-` voltar · `*` dado demonstrativo/ilustrativo · `▒▒` foto. Larguras de 360 px; blocos desktop descritos logo abaixo. Todos os textos são os de §10.

### 9.1 `/entrar` — Login (público)

```
+----------------------------------------+
|  [tag] Campus Lost                     |
|                                        |
|  Achou ou perdeu algo                  |   <- text-display
|  no campus?                            |
|  Entre para ver e registrar itens.     |
|                                        |
|  E-mail                                |
|  ( nome@exemplo.com                  ) |
|  [          Entrar                   ] |   <- primary lg
|                                        |
|  [ Usuário                     ->  ]   |   <- secondary, 1 toque, sem título
|  [ Administração               ->  ]   |      de bloco (27/10/2026)
|                                        |
|  Não tem conta? Criar conta            |
+----------------------------------------+
```

Desktop (≥ 1024): duas colunas 50/50. Esquerda: painel `primary` com `logo-mark-mono` grande (`tag-shape`), título e o ciclo em 4 passos (Registrar → Buscar → Reivindicar → Devolver) em `on-primary`. Direita: o formulário acima, `max-w-sm`, centralizado. **Estados:** erro de e-mail inexistente (Field + Notice), `Entrando…` no botão (loading), perfis de demo em `loading` individual.

### 9.2 `/cadastro` — Cadastro (público)

```
+----------------------------------------+
| <-  Criar conta                        |
|                                        |
|  Todos os campos são obrigatórios.     |
|                                        |
|  Nome completo                         |
|  ( Maria Exemplo*                    ) |
|  E-mail                                |
|  ( nome@exemplo.com                  ) |
|  (!) Esse e-mail já tem cadastro.      |   <- erro AC01.1
|      Entre com ele.                    |
|                                        |
|  Senha                                 |
|  ( ••••••••••                        ) |   <- mín. 10 caracteres (AC01.9)
|  [x] Li e aceito os termos e a         |
|      política de privacidade           |   <- AC01.8
|                                        |
|                                        |
+----------------------------------------+
| [        Criar conta                 ] |   <- ActionBar fixa
+----------------------------------------+
```

Desktop: card `max-w-form` centralizado sobre `paper`, ActionBar vira linha no fim do card. **Não há campo de papel nem de vínculo** (27/10/2026): o vínculo institucional/externo é derivado do domínio do e-mail e não é perguntado. Administração **não** é criável por esta tela.

### 9.3 `/itens` — Busca e listagem (logado; variante visitante em §9.14)

```
+----------------------------------------+
| [tag] CampusLost                  (M)  |   <- header + menu da conta
+----------------------------------------+
|  Itens encontrados                     |   <- h1
|  [≡ Filtros (2)]        12 itens       |
|  [Bloco A ×] [Eletrônicos ×]           |   <- chips
|                                        |
|  +----------------------------------+  |
|  | ▒▒▒▒▒▒  Fone de ouvido preto*    |  |
|  | ▒▒▒▒▒▒  {PackageOpen Disponível} |  |
|  | ▒▒▒▒▒▒  ⌖ Bloco A · há 2 dias    |  |
|  +----------------------------------+  |
|  +----------------------------------+  |
|  | ▒▒▒▒▒▒  Chaveiro com 3 chaves*   |  |
|  | ▒▒▒▒▒▒  {PackageSearch Em reiv.} |  |
|  | ▒▒▒▒▒▒  ⌖ Portaria · ontem       |  |
|  |  Sua reivindicação: {Pendente}   |  |   <- slot opcional
|  +----------------------------------+  |
|  ...                                   |
+----------------------------------------+
| [Itens]   ( + Registrar )   [Reivind.] |   <- BottomNav
+----------------------------------------+
```

Desktop: PageHeader com `h1` + contagem; FilterBar em linha (Categoria · Local · Encontrado de · até · Limpar filtros); grade 3 colunas de cards verticais. **Estados:** skeleton ×4; vazio (sem itens) "Nenhum item registrado ainda" + [Registrar item]; sem resultados + [Limpar filtros]; erro + [Tentar novamente]. Ordem: mais recentes primeiro (AC03.4). Devolvidos não aparecem (AC03.2).

### 9.4 `/itens/[id]` — Detalhe do item (logado; variante visitante em §9.15)

```
+----------------------------------------+
| <-  Detalhe do item                    |
+----------------------------------------+
| ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ |   <- foto 4:3, largura total
| ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ |
|                                        |
|  Fone de ouvido preto*                 |   <- h1
|  {PackageOpen Disponível}              |
|  Pode ser reivindicado.  |
|                                        |
|  Categoria     Eletrônicos             |
|  Encontrado em Bloco A                 |
|  Data          14/10/2026              |
|  Guardado em   Portaria                |   <- só administração e dono com reivindicação aceita
|                                        |
|  Descrição                             |
|  Fone com fio, cor preta, sem estojo.  |
+----------------------------------------+
| [ ✓  É meu ]                           |   <- ActionBar fixa (lg)
+----------------------------------------+
```

**Variantes da área de ação (em lugar do botão):**

| Quem / situação | O que aparece |
|---|---|
| Usuário, item Disponível ou Em reivindicação, sem reivindicação sua | `[ É meu ]` primary lg (AC04.1) |
| Usuário com reivindicação **Pendente** | Notice info: "Você já reivindicou este item. Acompanhe em Minhas reivindicações." + `[ Ver minha reivindicação ]` |
| Usuário com reivindicação **Aceita** | Notice success: "Sua reivindicação foi aceita. Procure a administração para retirar o item. Ele está guardado em {local}." (a linha "Guardado em" também aparece nos dados do item; depois da devolução some) |
| Usuário com reivindicação **Recusada** | Notice danger: "Sua reivindicação foi recusada. Não é possível enviar outra para este item. Se acha que foi engano, procure a administração." (AC04.7) |
| **Administração**, item não devolvido | Linha: `[ Editar ]` secondary · `[ Excluir ]` danger-quiet; seção **"Reivindicações deste item (n)"** com ClaimCards `[ Analisar ]`; se houver reivindicação **Aceita**: `[ Registrar devolução ]` primary no topo da seção (AC05.1) |
| Item **Devolvido** (acesso por link) | Notice neutral: "Este item já foi devolvido em 12/10/2026." Sem ações; admin sem Editar/Excluir (AC06.1) |

Desktop (≥ 1024): foto à esquerda (≈ 5/12), coluna de dados à direita; botões no fim da coluna (não fixos).

### 9.5 `/itens/novo` — Registrar item

```
+----------------------------------------+
| <-  Registrar item                     |
+----------------------------------------+
|  Todos os campos são obrigatórios,     |
|  exceto os marcados como (opcional).   |
|                                        |
|  (i) Não escreva na descrição detalhes |
|      que só o dono saberia (número de  |
|      série, conteúdo, marcas). Eles    |
|      serão perguntados na reivindicação|
|                                        |
|  Foto (opcional)                       |
|  [ Enviar foto                       ] |   <- empilhados a 360 px
|  [ Tirar foto                        ] |   <- lado a lado em sm+
|  JPG, PNG ou WebP, até 10 MB           |
|  Se a câmera não abrir neste aparelho, |
|  use Enviar foto.                      |
|                                        |
|  O que foi encontrado?                 |
|  ( Garrafa térmica*                  ) |
|  Descrição                             |
|  (                                   ) |
|  (                                   ) |
|  Categoria                             |
|  ( Outros                          v ) |
|  Especifique a categoria  <- só Outros |
|  ( Crachá de visitante*              ) |
|  Onde foi encontrado?                  |
|  Bloco, andar, sala ou ponto de ref. 0/120|
|  ( Ex.: Bloco C, segundo andar...    ) |
|  Quando foi encontrado?                |
|  ( 19/10/2026                        ) |   <- padrão = hoje, máx. = hoje
|  Onde está guardado agora?             |
|  Informe onde o objeto está guardado.  |
|  Essa informação é privada e só poderá |
|  ser acessada pela administração e pelo|
|  proprietário após a confirmação da    |
|  posse.                                |
|  ( Portaria*                         ) |
+----------------------------------------+
| [        Registrar item              ] |   <- ActionBar fixa
+----------------------------------------+
```

Ordem pensada para uso em pé: **foto primeiro** (o gesto mais natural com o objeto na mão), campos curtos, data já preenchida. Com foto: pré-visualização + [Trocar foto] [Tirar outra foto] [Remover foto]. Erros: foto inválida, data futura ("A data não pode ser no futuro."), campos vazios. Sucesso: volta para `/itens` com toast "Item registrado. Ele já aparece na busca." e o item no topo (AC02.3). Desktop: `max-w-form`, botões [Cancelar] [Registrar item] à direita.

### 9.6 `/itens/[id]/reivindicar` — Reivindicar item

```
+----------------------------------------+
| <-  Reivindicar item                   |
+----------------------------------------+
|  +----------------------------------+  |
|  | ▒▒▒▒  Fone de ouvido preto*      |  |   <- resumo, não clicável
|  | ▒▒▒▒  {PackageOpen Disponível}   |  |
|  +----------------------------------+  |
|                                        |
|  Responda com detalhes que só o dono   |
|  saberia. A administração compara com  |
|  o item guardado.                      |
|                                        |
|  Que detalhes só o dono saberia?       |
|  Ex.: marcas, riscos, objetos dentro,  |
|  capa. Não repita a descrição pública. |
|  (                                   ) |
|  (                                   ) |   0/500
|                                        |
|  Onde e quando você perdeu?            |
|  (                                   ) |
|                                        |
|  (i) Ao enviar, o item passa para      |
|      "Em reivindicação".               |
+----------------------------------------+
| [      Enviar reivindicação          ] |
+----------------------------------------+
```

Duas perguntas obrigatórias (SPEC P7). Se a pessoa já tem reivindicação ativa/recusada ou é administração, a rota mostra EmptyState `restricted` com o motivo e link para o item (não o formulário). Sucesso: vai a `/minhas-reivindicacoes` com toast "Reivindicação enviada. A administração vai analisar." (AC04.2). Mínimo sugerido de caracteres por resposta: 10 (validação é do `mock-engineer`).

### 9.7 `/minhas-reivindicacoes` — Acompanhamento

```
+----------------------------------------+
| [tag] CampusLost                  (M)  |
+----------------------------------------+
|  Minhas reivindicações                 |
|                                        |
|  +----------------------------------+  |
|  | ▒▒▒  Chaveiro com 3 chaves*      |  |
|  | ▒▒▒  {Clock Pendente}            |  |
|  |      Enviada em 18/10/2026       |  |
|  |  Aguardando análise da           |  |
|  |  administração.                  |  |
|  |  [ Ver item ]                    |  |
|  +----------------------------------+  |
|  +----------------------------------+  |
|  | ▒▒▒  Fone de ouvido preto*       |  |
|  | ▒▒▒  {CircleCheck Aceita}        |  |
|  |  Aceita! Procure a administração |  |
|  |  para retirar. Guardado em:      |  |
|  |  Portaria.                       |  |
|  +----------------------------------+  |
|  +----------------------------------+  |
|  | ▒▒▒  Carteira*  {CircleX Recusada}| |
|  |  A administração recusou. Você   |  |
|  |  não pode reenviar. Se acha que  |  |
|  |  foi engano, procure a           |  |
|  |  administração.                  |  |
|  +----------------------------------+  |
+----------------------------------------+
| [Itens]   ( + Registrar )   [Reivind.] |
+----------------------------------------+
```

Cada card mostra o status da **reivindicação** e, quando relevante, o do **item** ("Item: {PackageCheck Devolvido} em 20/10/2026" para aceita já devolvida). O bloco "próximo passo" (texto por status) é o conteúdo principal; `Aceita` ganha fundo `success-bg` na caixa de instrução. Atualiza sem recarregar (AC04.8): troca do badge + anúncio `aria-live`. Vazio: "Você ainda não reivindicou nenhum item" + [Ver itens]. Desktop: lista em coluna `max-w-form` ou grade 2 col.

### 9.8 `/admin` — Painel da administração

```
+----------------------------------------+
| [tag] CampusLost                  (M)  |
+----------------------------------------+
|  Painel                                |
|  +---------+ +---------+ +---------+   |
|  |    3    | |    2    | |    5    |   |   <- 3 contagens, text-h2
|  |Pendentes| |Em reiv. | |Devoluç. |   |
|  +---------+ +---------+ +---------+   |
|  [ Reivindicações pendentes (3) |      |
|    Itens em reivindicação (2) ]        |   <- Tabs (mobile)
|  --------------------------------------|
|  +----------------------------------+  |
|  | Fone de ouvido preto*            |  |
|  | Maria Exemplo* · {Clock Pendente}|  |
|  | Enviada em 18/10/2026            |  |
|  | [ Analisar  -> ]                 |  |
|  +----------------------------------+  |
|  ...                                   |
+----------------------------------------+
| [Painel] [Itens] (+Registrar) [Devol.] |
+----------------------------------------+
```

Desktop (≥ 1024): as duas listas **lado a lado** (sem abas), contagens em linha no topo. A lista "Itens em reivindicação" ordena primeiro os que têm reivindicação **Aceita** (aguardando devolução: linha "{CircleCheck Aceita} Maria Exemplo* · aguardando devolução" + [ Abrir ]), depois os que só têm pendentes ("2 pendentes"). Vazio: "Nenhuma reivindicação pendente. Quando chegar uma, ela aparece aqui." (opcional da SPEC: indicador de contagem de pendências no item "Painel" do nav).

### 9.9 `/admin/reivindicacoes/[id]` — Análise (aceitar/recusar)

```
Mobile (360)                              Desktop (≥ 768): duas colunas
+--------------------------------+        +------------------------------+------------------------------+
| <-  Analisar reivindicação     |        | <-  Analisar reivindicação                                  |
+--------------------------------+        +------------------------------+------------------------------+
| {Clock Pendente}               |        | O QUE FOI PUBLICADO          | O QUE A PESSOA RESPONDEU     |
| Maria Exemplo*                 |        | ▒▒▒▒▒▒▒▒▒▒                   | Maria Exemplo*               |
| Enviada em 18/10/2026          |        | Fone de ouvido preto*        | maria@exemplo.com*           |
|                                |        | {Em reivindicação}           | {Clock Pendente}             |
| O QUE FOI PUBLICADO            |        | Categoria · Local · Data     |                              |
| ▒▒▒▒▒▒▒▒▒▒                     |        | Guardado em Portaria         | Detalhes que só o dono sabe: |
| Fone de ouvido preto*          |        | Descrição pública:           | "Tem um adesivo no cabo..."  |
| Descrição pública: ...         |        | "Fone com fio, preto..."     |                              |
|                                |        |                              | Onde e quando perdeu:        |
| O QUE A PESSOA RESPONDEU       |        |                              | "Biblioteca, terça à tarde"  |
| Detalhes que só o dono sabia:  |        +------------------------------+------------------------------+
| "..."                          |        | (i) Outras 2 reivindicações neste item: se você aceitar,    |
| Onde e quando perdeu:          |        |     elas serão recusadas automaticamente.                   |
| "..."                          |        |                             [ Recusar ]   [ Aceitar ]       |
|                                |        +-------------------------------------------------------------+
| (i) Outras 2 reivindicações... |
+--------------------------------+
| [ Aceitar ]                    |   <- ActionBar fixa: principal em cima
| [ Recusar ]                    |
+--------------------------------+
```

A comparação **lado a lado** (desktop/tablet) usa duas colunas de altura igual com títulos em versalete `text-meta` 600; em mobile empilha na mesma ordem (publicado → resposta). A barra de decisão é **fixa no rodapé** da área de análise (desktop: sticky na base da viewport) para estar sempre visível ao rolar respostas longas. Diálogos:

- **Aceitar:** "Aceitar esta reivindicação?" — "As outras *n* reivindicações deste item serão recusadas automaticamente. O item continua Em reivindicação até você registrar a devolução." [Aceitar reivindicação] [Cancelar].
- **Recusar:** "Recusar esta reivindicação?" — "Maria Exemplo* não poderá reenviar para este item." + (se for a última ativa) "O item voltará a ficar Disponível." [Recusar reivindicação] (`danger`) [Cancelar].
- **Após aceitar** (reivindicação Aceita): a barra troca para **[ Registrar devolução ]** (primary, só aqui, AC05.1) → diálogo `confirm`: "Registrar a devolução?" — "Item: Fone de ouvido preto*. Entregue a: Maria Exemplo*. Esta ação não pode ser desfeita." [Registrar devolução] [Cancelar]. Sucesso: toast "Devolução registrada. O item saiu da busca." e volta ao painel.
- **Já decidida (Aceita/Recusada):** sem botões Aceitar/Recusar; Notice neutral com a decisão e a data.

### 9.10 `/admin/itens/[id]/editar` — Editar item

```
+----------------------------------------+
| <-  Editar item                        |
+----------------------------------------+
|  {PackageSearch Em reivindicação}      |
|  Todos os campos são obrigatórios,     |
|  exceto os marcados como (opcional).   |
|  [mesmos campos de "Registrar item",   |
|   preenchidos]                         |
|                                        |
|  ───────────────────────────────────── |
|  Excluir item                          |
|  Remove o item e não pode ser desfeito.|
|  [ 🗑  Excluir item ]                   |   <- danger-quiet
+----------------------------------------+
| [        Salvar alterações           ] |
+----------------------------------------+
```

Reusa exatamente o formulário de `/itens/novo` (um só componente). Excluir abre `Dialog destructive`: "Excluir este item?" — "“Fone de ouvido preto*” será removido da busca. Esta ação não pode ser desfeita." + se houver reivindicações: "As *n* reivindicações ligadas a ele também serão removidas." [Excluir item] (`danger`) [Cancelar] (foco inicial em Cancelar) — ver §12 R4. Item **Devolvido**: a rota mostra EmptyState `restricted` "Item devolvido não pode ser editado" (AC06.1). Sucesso: toast "Alterações salvas." / "Item excluído.".

### 9.11 `/admin/devolucoes` — Listagem de devoluções

```
Mobile (360)                           Desktop (≥ 768)
+--------------------------------+     +----------------------------------------------------------+
| [tag] CampusLost          (M)  |     | Devoluções                                               |
+--------------------------------+     | Devolvido de (dd/mm/aaaa) até (dd/mm/aaaa)  [Limpar]     |
|  Devoluções                    |     +--------------+---------------+--------------+------------+
|  Devolvido de      até         |     | Item         | Entregue a    | Registrada   | Data       |
|  (dd/mm/aaaa)  (dd/mm/aaaa)    |     |              |               | por          |            |
|  [Limpar período]    3 devoluç.|     +--------------+---------------+--------------+------------+
|  +--------------------------+  |     | Fone preto*  | Maria Exemplo*| Admin Demo*  | 20/10/2026 |
|  | Fone de ouvido preto*    |  |     | ...                                                      |
|  | Entregue a Maria Exemplo*|  |     +----------------------------------------------------------+
|  | {PackageCheck Devolvido} |  |     (sem botão de exportar — AC05.3)
|  | 20/10/2026 · Admin Demo* |  |
|  +--------------------------+  |
+--------------------------------+
| [Painel] [Itens] (+) [Devol.]  |
+--------------------------------+
```

Filtro por período usa a data da devolução (premissa de design: aqui o "período" é o da devolução; ver §12 R5). Vazio: "Nenhuma devolução registrada ainda". Sem resultados: "Nenhuma devolução nesse período" + [Limpar período]. Erro: ErrorState.

### 9.12 Telas de apoio (sem rota própria na SPEC)

- **Acesso negado** (`/admin/**` para usuário comum, AC01.5): EmptyState `restricted`, ícone `ShieldAlert`, "Acesso restrito" / "Esta área é só para a administração. Você entrou como Usuário." [Voltar para os itens]. Visitante vai a `/entrar` (sem tela de erro).
- **Item não encontrado:** EmptyState `restricted`, ícone `FileText`, "Item não encontrado" / "Ele pode ter sido excluído." [Ver itens].
- **Diálogo "Reiniciar demonstração":** confirm — ver §10.

### 9.13 `/` — Landing page (pública, P26)

**Objetivo de usabilidade.** Em 5 segundos, quem chega (de pé, pelo celular, talvez por link de um colega) entende o que é, vê que há itens reais para olhar **sem cadastro**, e escolhe: ver itens (CTA principal) ou entrar. Nada de carrossel, vídeo ou animação de entrada além de `animate-fade` curto. Uma única `h1`. Quem já tem sessão é redirecionado para a página inicial do perfil (SPEC §5); enquanto a sessão é resolvida, mostrar só o header com a marca e um `LoaderCircle` central com `sr-only` "Carregando…" (evita piscar a landing para quem está logado).

**Ordem das seções (faixas de largura total que alternam o fundo; conteúdo em `max-w-page`; 48 px de respiro vertical a 360 px, 64 px em `lg`):** Header público → Hero (`primary-soft`) → Benefícios (`paper`) → Como funciona (`primary`) → Itens recentes (`paper`) → Perguntas frequentes (`surface`) → Bloco final (`paper`) → Rodapé (`surface`). *(Revisão de 25/10/2026: tom de produto, sem menção a projeto acadêmico, sem a seção "Para cada perfil" que lia como tabela de requisitos; os wireframes abaixo mostram a versão anterior, sem as faixas.)*

```
360 px
+----------------------------------------+
| [tag] CampusLost          [ Entrar ]   |  <- Header público 56 px
+----------------------------------------+
|                                        |
|  Achados e perdidos do campus          |  <- eyebrow text-meta 600 primary
|  Perdeu algo? Veja se já                |  <- h1 (text-h1; text-display só /entrar)
|  foi encontrado.                       |
|  Veja os itens achados sem precisar    |  <- text-lead ink-muted, 1 frase
|  entrar. Para reivindicar, é só criar  |
|  uma conta.                            |
|                                        |
|  [ Ver itens encontrados  -> ]         |  <- primary lg, largura total
|  [ Entrar                      ]       |  <- secondary lg, largura total
|                                        |
|  +----------------------------------+  |
|  |   hero.svg (4:3, rounded-lg)     |  |  <- decorativa, alt="", abaixo dos botões
|  +----------------------------------+  |
|----------------------------------------|
|  Como funciona                         |  <- h2
|  +----------------------------------+  |
|  | (1) Registrar                    |  |  <- cartão surface, número em círculo
|  | Quem acha cadastra o item com    |  |     primary 32 px + ícone 24 px
|  | foto e local.                    |  |
|  +----------------------------------+  |
|  | (2) Buscar ...                   |  |
|  | (3) Reivindicar ...              |  |
|  | (4) Devolver ...                 |  |
|  +----------------------------------+  |
|----------------------------------------|
|  Itens recentes          Ver todos ->  |  <- h2 + link 44 px
|  +----------------------------------+  |
|  | ▒▒▒▒▒▒  Fones de ouvido sem fio* |  |  <- ItemCard horizontal x4
|  | ▒▒▒▒▒▒  {PackageOpen Disponível} |  |
|  | ▒▒▒▒▒▒  ⌖ Bloco A · há 2 dias    |  |
|  +----------------------------------+  |
|  ... (até 4 cards)                     |
|  [ Ver todos os itens ]                |  <- secondary, largura total
|----------------------------------------|
|  +----------------------------------+  |
|  | Achou algo ou quer reivindicar?  |  |  <- bloco primary-soft, rounded-xl
|  | Crie sua conta para registrar    |  |
|  | itens e reivindicar o seu.       |  |
|  | [ Criar conta ]  [ Entrar ]      |  |  <- primary lg + secondary lg (empilhados)
|  +----------------------------------+  |
|----------------------------------------|
|  CampusLost · Achados e perdidos       |  <- rodapé simples
|  Ver itens · Entrar · Criar conta      |
|  Projeto acadêmico · UNDB              |  <- text-meta ink-muted
+----------------------------------------+
```

```
Desktop (>= 1024; max-w-page 1152, gutter 32)
+------------------------------------------------------------------------------+
| [tag] CampusLost   Ver itens                     Entrar   [ Criar conta ]    |
+------------------------------------------------------------------------------+
|  Achados e perdidos do campus          +-----------------------------+        |
|  Perdeu algo? Veja se já               |       hero.svg (4:3)        |        |
|  foi encontrado.      (7/12)           |           (5/12)            |        |
|  Veja os itens ... [ Ver itens encontrados -> ] [ Entrar ]  |  <- botões em linha, largura auto
+------------------------------------------------------------------------------+
|  Como funciona                                                               |
|  [1 Registrar] [2 Buscar] [3 Reivindicar] [4 Devolver]     <- 4 colunas      |
+------------------------------------------------------------------------------+
|  Itens recentes                                              Ver todos ->    |
|  [card vert.] [card vert.] [card vert.] [card vert.]       <- 4 colunas lg   |
+------------------------------------------------------------------------------+
|  [ bloco final: texto à esquerda, botões à direita, uma linha ]              |
+------------------------------------------------------------------------------+
|  Rodapé: marca + descrição · colunas Plataforma e Conta · © ano CampusLost   |
+------------------------------------------------------------------------------+
```

Tablet (`sm`–`md`): hero em coluna única centralizada em `max-w-form`, botões em linha; passos em grade 2×2; itens recentes em 2 colunas (card vertical); bloco final em linha.

**Decisões e porquês**

- **Hero:** faixa `primary-soft`; título `text-h1` a 360 px e `text-display` a partir de `lg` (única exceção à regra de §3 que reservava `text-display` a `/entrar` e `/cadastro`). Botões **empilhados** em mobile (polegar): "Procurar meu item" (primário) e "Entrar". Abaixo, **uma** linha de confiança com `ShieldCheck`: "Cada devolução é conferida e registrada pela administração do campus" (vale pela SPEC, RF04/RF05). Evitar no hero frases de funcionalidade ("feito para o celular", "sem criar conta") e checklists: soam como produto de trabalho, não como serviço do campus (decisão da usuária, 25/10/2026). À direita (abaixo dos botões em mobile), uma **prévia do produto**: `hero.svg` dentro de um cartão `surface` com `shadow-raised` e os três `ItemStatusBadge` reais (Disponível, Em reivindicação, Devolvido) sobrepostos; `aria-hidden`, pois é decorativa. Texto: `ink`, `ink-muted` e `primary` sobre `primary-soft` (pares calculados abaixo).
- **Benefícios:** três cartões `surface` com ícone em quadrado `primary-soft` (`Layers`, `ShieldCheck`, `ListChecks`); só afirmam regras já existentes (lista única e filtros, verificação pela administração e local de guarda oculto a visitantes, status do item). **Sem números nem depoimentos inventados.**
- **Perguntas frequentes:** em `lg`, título à esquerda (4/12) e lista à direita (8/12) sobre a faixa `surface`; abaixo disso, empilhados. Cinco `<details>` nativos com fundo `paper` e borda `line` (teclado e leitor de tela sem JavaScript), `summary` com alvo ≥ 44 px e chevron que gira ao abrir; respostas só com o que a SPEC garante.
- **Como funciona:** os mesmos 4 passos de `/entrar` (um único módulo de dados compartilhado entre as duas telas; ver pendências). Cada passo: círculo `primary` 36 px com número em `on-primary` (8,42:1) + ícone 24 px `primary` + `h3` + 1 frase. Ícones (lucide, existentes): Registrar `Camera`, Buscar `Search`, Reivindicar `Tag`, Devolver `PackageCheck`. Faixa `primary`: `h2` e frase em `on-primary` (8,42:1), cartões `surface` com `shadow-card`, `rounded-lg`; **não clicável** (sem hover de link). Lista semântica `<ol>`: leitor de tela anuncia "lista de 4 itens"; o número visível é `aria-hidden`.
- **Itens recentes:** os **até 4 itens não devolvidos mais recentes** (mesma regra de AC03.2/03.4; sem filtros). ItemCard exatamente como em §6.5 (nenhuma variante nova), sem slot "Sua reivindicação" (visitante). Cada card leva a `/itens/[id]`. "Ver todos" aparece no cabeçalho da seção (link com seta, 44 px) **e** como botão `secondary` largura total ao fim da lista em < 640 px (o alvo do fim da lista é o lugar natural do polegar).
- **Bloco final:** fundo `primary-soft`, `rounded-xl`, padding 24 px; título `h2`; texto `ink`; botões `primary` "Criar conta" e `secondary` "Entrar". Escolhido `primary-soft` e não um painel `primary` cheio para não precisar de anel de foco claro (`focus-on-dark`) e manter um só par de foco verificado.
- **Rodapé:** `surface`, borda superior `line`, `text-meta`, links com `touch-target` e sublinhado, `<footer>`; sem redes sociais, sem política inventada, sem logos de terceiros. Marca com descrição curta, colunas "Plataforma" (Ver itens, Como funciona, Perguntas frequentes) e "Conta" (Entrar, Criar conta) e "© ano CampusLost". Não há mais crédito de projeto acadêmico na landing (decisão da usuária, 25/10/2026).
- **Landmarks:** `header`, `main` (Hero, Como funciona e Itens recentes são `section` com `aria-labelledby` do seu título), `footer`; link "Pular para o conteúdo" como primeiro foco.

**Movimento e interação (25/10/2026).** Mínimo e sempre opcional: tudo some com `prefers-reduced-motion` (movimento) e nada depende de JavaScript.

- *Botões* (§6.1): ao passar o mouse, `primary`, `secondary` e `danger` sobem 1 px e ganham sombra (`shadow-raised`/`shadow-card`); ao pressionar, encolhem para 98 %. Não vale para botão desabilitado nem para `ghost`. A seta do CTA do hero e a de "Ver todos" andam 4 px para a direita. Duração 150 ms, curva `ease-standard`.
- *Cartão de item* (§6.5): sobe 2 px, ganha `shadow-raised`, o título vira `primary` e a foto dá zoom de 5 % (recortada pelo cartão).
- *Navegação do header*: o indicador de 3 px cresce da esquerda ao passar o mouse; no item ativo já está inteiro.
- *Revelação ao rolar* (`reveal`, em `globals.css`): cartões de Benefícios, passos, itens recentes, lista do FAQ e bloco final sobem 20 px e aparecem ao entrar na tela, com `animation-timeline: view()`. Onde o navegador não suporta, o conteúdo já está visível. Os cartões de Benefícios e de passos **não** ganham hover, porque não são clicáveis.
- *Hero*: a prévia entra subindo (`animate-rise`) e os três selos de status flutuam 6 px em ciclos de 6 s, defasados (`animate-float`). *FAQ*: o `summary` ganha fundo `primary-soft` no hover e a pergunta aberta vira cartão `surface`; a resposta entra com `animate-fade`.

**Estados de "Itens recentes"** (a landing nunca fica quebrada por causa dessa faixa)

| Estado | Visual |
|---|---|
| Carregando | 4 `ItemCardSkeleton` (6.8), `sr-only` "Carregando itens…"; mínimo 300 ms |
| Com itens | 1 a 4 cards; com menos de 4, sem preencher com vazios |
| Vazio | EmptyState compacto `empty` no lugar da grade: "Nenhum item registrado ainda" / "Quando alguém registrar um item encontrado, ele aparece aqui." Sem botão "Registrar" (visitante); o bloco final já oferece criar conta |
| Erro | ErrorState compacto (sem `min-h`) só dentro da seção: "Não conseguimos carregar os itens" + [Tentar novamente]. Hero, passos e bloco final continuam utilizáveis |

**Contraste dos pares novos** (nenhum token novo; todos já calculados em §3.2): `ink`/`paper` 14,63; `ink-muted`/`paper` 7,41 (texto de apoio do hero); `primary`/`paper` 7,66 (eyebrow, "Ver todos"); `on-primary`/`primary` 8,42 (número do passo e botão primário); `ink`/`primary-soft` 13,90 e `ink-muted`/`primary-soft` 7,05 (bloco final); `primary`/`primary-soft` 7,28 (botão `secondary` sobre `primary-soft` usa fundo `surface`: `primary`/`surface` 8,42); `ink-muted`/`surface` 8,15 (rodapé e descrição dos passos). Anel de foco `focus` sobre `paper`/`surface`/`primary-soft`: 7,66 / 8,42 / 7,28. Conferência manual em 22/10/2026 (mesma fórmula de §3.2) do par `primary`/`paper`: L(paper) ≈ 0,9056, L(primary) ≈ 0,0746, razão ≈ 7,67 (a tabela registra 7,66; diferença de arredondamento). Os demais valores vêm da tabela existente, pois **nenhum par novo foi criado**.

### 9.14 `/itens` — variante visitante (P26)

Mesmo conteúdo, filtros, ordem (mais recentes primeiro), skeleton e estados de §9.3, com estas diferenças:

```
360 px, visitante
+----------------------------------------+
| [tag] CampusLost          [ Entrar ]   |  <- Header público (sem BottomNav)
+----------------------------------------+
|  Itens encontrados                     |
|  (i) Entre para reivindicar um item    |  <- Notice info, uma vez, sem fechar
|      ou registrar o que você achou.    |
|      Entrar · Criar conta              |     (links 44 px)
|  [≡ Filtros]            12 itens       |
|  +----------------------------------+  |
|  | ▒▒▒▒▒▒  Mochila preta*           |  |
|  | ...                              |  |
|  ...                                   |
+----------------------------------------+
```

- **Notice do visitante:** tom `info`, ícone `Info`, abaixo do `h1` e acima dos filtros; uma linha em ≥ 640 px. Explica **por que** não há "Registrar" nem "É meu" (princípio 5) e dá as duas saídas. Não é banner de demonstração.
- **Sem** BottomNav e sem botão "Registrar item" no header ou na tela. Conteúdo sem `pb-bottomnav` (usa o padding normal + `pb-safe`).
- Cards sem o slot "Sua reivindicação".
- FilterBar idêntica (sheet < 768 px; barra em linha ≥ 768 px).
- **Estados:** carregando = skeleton ×4; vazio (nenhum item no sistema) = EmptyState `empty` "Nenhum item registrado ainda" / "Quando alguém registrar um item encontrado, ele aparece aqui." + [Criar conta] `secondary` (sem "Registrar item"); sem resultados = igual a §9.3 ("Limpar filtros"); erro = ErrorState "Tentar novamente".
- **Sem "Registrado por":** o visitante não vê quem registrou o item (nem nome nem papel), nem no card nem no detalhe (§9.15). O ItemCard não exibe essa informação em nenhuma variante; vale também para os cards da landing.
- **Entrar a partir desta tela:** os links "Entrar" / "Criar conta" do Header e do Notice levam a `/entrar` e `/cadastro` **sem** `?next=`. Depois de entrar ou criar a conta, a pessoa vai para a **página inicial do perfil** (P28); **não** volta a `/itens` com os filtros. Motivo: `next` aceita somente `/itens/<id>` (§9.15); aceitar uma URL com query de filtros ampliaria a superfície do parâmetro (redirecionamento aberto) por um ganho pequeno, já que refazer um filtro leva poucos toques. Só o detalhe do item usa `?next=`.

### 9.15 `/itens/[id]` — variante visitante (P26)

```
360 px, visitante
+----------------------------------------+
| <-  Detalhe do item                    |  <- header de drill-down (volta à busca)
+----------------------------------------+
| ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ |  <- imagem 4:3
| Imagem ilustrativa                     |  <- legenda text-meta (só itens do seed)
|                                        |
|  Mochila preta*                        |  <- h1
|  {PackageOpen Disponível}              |
|  Pode ser reivindicado.                |
|                                        |
|  Categoria     Acessórios              |
|  Encontrado em Bloco A                 |
|  Data          14/10/2026              |
|                                        |  <- SEM "Guardado em"
|  Descrição                             |
|  ...                                   |
|                                        |
|  (i) Para reivindicar este item,       |  <- Notice info
|      entre na sua conta. Só quem tem   |
|      conta e e-mail confirmado pode   |
|      reivindicar.                      |
+----------------------------------------+
| [ -> Entre para reivindicar ]          |  <- ActionBar fixa, primary lg
+----------------------------------------+
```

- **Quando o header é o de drill-down:** igual a §6.12 (voltar `ChevronLeft` + título da página). A rota é pública, então o voltar leva à última busca ou, se a pessoa veio de link externo, a `/itens`.
- **Ação:** botão `primary` lg "Entre para reivindicar" (ícone `LogIn`) que leva a `/entrar?next=/itens/{id}`; depois do login o app retorna ao detalhe, onde já aparece "É meu". Link secundário de texto no Notice: "Ainda não tem conta? Criar conta" → `/cadastro?next=/itens/{id}`. **Validação de `next` (regra própria, P28; não reutiliza a lista de `?de=`):** só vale `/itens/<id>` com `id` em `[A-Za-z0-9_-]{1,64}`, sem query, sem fragmento e sem subcaminho; `/itens`, `/itens/novo` e qualquer outro valor são descartados e a pessoa vai para a página inicial do perfil.
- **O que o visitante NÃO vê (nem o usuário comum sem reivindicação aceita):** "Guardado em" (linha inteira ausente, não "oculta com ***"); botões Editar/Excluir/É meu; seção de reivindicações. **Motivo explicado em texto** no Notice (princípio 5), em vez de simplesmente omitir.
- **Sem "Registrado por":** o detalhe do visitante não mostra quem registrou o item (nem nome nem papel). Não há linha, rótulo vazio ou "***": a informação simplesmente não existe nesta variante.
- **Item Devolvido ou inexistente:** para o visitante os dois casos mostram o **mesmo** estado "Item não encontrado" (EmptyState `restricted`, ícone `FileText`): "Este item não está mais disponível: ele pode ter sido excluído ou já devolvido." + botão "Ver itens" (`/itens`). Motivo: um texto único não deixa o visitante distinguir "devolvido" de "nunca existiu" (evita enumerar ids e expor o histórico de devoluções). Não existe Notice "Item devolvido" para visitante e não há wireframe dele. Logado continua com §9.4 (Notice "devolvido em {data}").
- **Item Em reivindicação:** mesmo botão "Entre para reivindicar" (a regra de §9.4 permite reivindicar enquanto há outras pendentes).
- **Não encontrado:** ver "Item Devolvido ou inexistente" acima; o texto de §9.12 ("Ele pode ter sido excluído.") vale só para quem tem sessão.
- **Imagem:** `alt="Foto de {título}"` para foto enviada; `alt="Imagem ilustrativa: {título}"` + legenda "Imagem ilustrativa" para imagem do seed (§2.5).
- **Carregando:** skeleton da geometria final (imagem 4:3, 3 barras, lista de 3 linhas); `sr-only` "Carregando item…". **Erro:** ErrorState "Não conseguimos carregar este item" + [Tentar novamente].
- **Desktop (≥ 1024):** imagem à esquerda, dados à direita, botão e Notice no fim da coluna de dados (não fixos). A imagem de 4:3 a 5/12 de 1152 px ≈ 480 × 360 px.

## 10. Microcopy-chave (pt-BR)

Regras: voz ativa, "você", verbo no botão, sem pontuação em rótulo de botão, **reticências "…" (um caractere) só em estados em andamento**, datas `dd/mm/aaaa` (relativas só até 7 dias: "hoje", "ontem", "há 3 dias", com `<time datetime>` e título completo), horas `hh:mm`.

**Global e navegação**

| Onde | Texto |
|---|---|
| Nome do app | CampusLost |
| Aviso de armazenamento (só se indisponível) | Seus dados desta demonstração não serão guardados neste navegador e serão perdidos ao recarregar. |
| Nav usuário | Itens · Registrar · Reivindicações (`aria-label` "Minhas reivindicações") |
| Nav admin | Painel · Itens · Registrar · Devoluções |
| Menu da conta | {Nome} · {Usuário|Administração} · Reiniciar demonstração · Sair |
| Reiniciar (diálogo) | **Reiniciar a demonstração?** Todos os dados voltam ao estado inicial e você sairá da conta. [Reiniciar] [Cancelar] · toast: Demonstração reiniciada. |
| Carregando | Carregando itens… · Entrando… · Salvando… · Enviando… · Registrando… |

**Landing e visitante (P26)**

| Contexto | Texto |
|---|---|
| Header público | Ver itens · Entrar · Criar conta |
| Eyebrow | Achados e perdidos do campus |
| `h1` | Perdeu algo? Veja se já foi encontrado. |
| Apoio (1 frase) | Veja os itens achados sem precisar entrar. Para reivindicar o seu, é só criar uma conta. |
| CTAs do hero | **Ver itens encontrados** (principal) · **Entrar** (secundário) |
| `h2` passos | Como funciona |
| Passo 1 | **Registrar** — Quem acha um objeto cadastra o item, com foto e o local onde o encontrou. |
| Passo 2 | **Buscar** — Qualquer pessoa pode ver os itens e filtrar por categoria, local e data. |
| Passo 3 | **Reivindicar** — Quem perdeu entra na conta, diz que o item é seu e responde a duas perguntas. |
| Passo 4 | **Devolver** — A administração confere as respostas, aceita e registra a devolução. |
| `h2` recentes / links | Itens recentes · Ver todos · Ver todos os itens |
| Bloco final | **Achou algo ou quer reivindicar o seu?** Crie sua conta para registrar itens e reivindicar o que é seu. [Criar conta] [Entrar] |
| Rodapé | CampusLost · Achados e perdidos do campus · Projeto acadêmico · UNDB |
| Notice do visitante em `/itens` | Entre para reivindicar um item ou registrar o que você achou. [Entrar] [Criar conta] |
| Detalhe — botão | Entre para reivindicar |
| Detalhe — Notice | Para reivindicar este item, entre na sua conta. Só quem tem conta e e-mail confirmado pode reivindicar. Ainda não tem conta? Criar conta |
| Legenda de imagem do seed | Imagem ilustrativa |
| Visitante: item devolvido ou inexistente | **Item não encontrado** — Este item não está mais disponível: ele pode ter sido excluído ou já devolvido. [Ver itens] |
| Carregando detalhe | Carregando item… |
| Erro de detalhe | **Não conseguimos carregar este item** — Verifique sua conexão e tente de novo. [Tentar novamente] |

Os passos 1–4 acima **substituem os textos curtos** do painel de `/entrar` (§9.1), que continua com o mesmo título e rótulos "Registrar → Buscar → Reivindicar → Devolver"; as descrições são as mesmas nas duas telas (fonte única).

**Entrar / cadastro**

| Contexto | Texto |
|---|---|
| Título `/entrar` | Achou ou perdeu algo no campus? |
| Apoio | Entre para ver e registrar itens. |
| Campo | E-mail · placeholder nome@exemplo.com |
| Botões | Entrar · Criar conta · Usuário · Administração (atalhos de demonstração) |
| Atalho (rótulo do bloco) | **Removido** em 27/10/2026: os dois botões ficam sem título visível. Também não há texto sobre a senha de demonstração nem parágrafo sob o botão do Google (a explicação do vínculo fica nos Termos, no FAQ e em `/conta`) |
| Dica de senha | Use pelo menos 10 caracteres. Evite senhas comuns. |
| Senha longa demais | A senha é longa demais. Use uma senha mais curta. *(a interface não fala em bytes; o limite de 72 bytes é técnico, SPEC P33)* |
| E-mail vazio / inválido | Informe seu e-mail. / Esse e-mail não parece válido. Use o formato nome@exemplo.com. |
| E-mail não cadastrado (AC01.2) | Não encontramos esse e-mail. Confira a digitação ou crie uma conta. |
| E-mail já usado (AC01.1) | Esse e-mail já tem cadastro. Entre com ele. |
| Nome vazio | Informe seu nome. |
| Termos não aceitos (AC01.8) | Aceite os termos e a política de privacidade para criar a conta. |
| Vínculo (somente exibição, quando mostrado) | Vínculo pelo e-mail: institucional · externo. Não verificado. |

**Itens e busca**

| Contexto | Texto |
|---|---|
| Título | Itens encontrados · contagem "12 itens" / "1 item" |
| Filtros | Filtros · Categoria · Local · Encontrado de · até · Aplicar · Limpar filtros · Todas / Todos |
| Vazio | **Nenhum item registrado ainda** — Quando alguém registrar um item encontrado, ele aparece aqui. [Registrar item] |
| Sem resultados (AC03.5) | **Nenhum item com esses filtros** — Tente outra categoria, local ou período, ou limpe os filtros. [Limpar filtros] |
| Erro | **Não conseguimos carregar os itens** — Verifique sua conexão e tente de novo. [Tentar novamente] |
| Cartão (meta) | {Local} · {data relativa} |
| Cartão com reivindicação sua | Sua reivindicação: Pendente / Aceita / Recusada |

**Detalhe e reivindicação**

| Contexto | Texto |
|---|---|
| CTA | É meu |
| Rótulos | Categoria · Encontrado em · Data · Guardado em · Descrição |
| Status do item | Disponível · Em reivindicação · Devolvido (+ frases de §3.4) |
| Pendente (aviso) | Você já reivindicou este item. Acompanhe em Minhas reivindicações. |
| Aceita (aviso) | Sua reivindicação foi aceita. Procure a administração para retirar o item. (O local de guarda não é mostrado ao reivindicante: o responsável informa o procedimento e o local de retirada fora do sistema.) |
| Recusada (aviso) | Sua reivindicação foi recusada e não é possível enviar outra para este item. Se acha que foi engano, procure a administração. |
| Admin vê item | Administração gerencia itens, mas não reivindica. |
| Devolvido (aviso) | Este item já foi devolvido em {data}. |
| Form — título | Reivindicar item |
| Intro | Responda com detalhes que só o dono saberia. A administração compara suas respostas com o item guardado. |
| Pergunta 1 / ajuda | Que detalhes só o dono saberia? / Ex.: marcas, riscos, objetos dentro, capa. Não repita a descrição pública. |
| Pergunta 2 | Onde e quando você perdeu? |
| Aviso | Ao enviar, o item passa para "Em reivindicação". |
| Erros | Conte pelo menos um detalhe que só o dono saberia. · Diga onde e quando você perdeu o item. · Use no máximo 500 caracteres. |
| Botão / toast | Enviar reivindicação / Reivindicação enviada. A administração vai analisar. |
| Bloqueio no form | Você já tem uma reivindicação neste item. · Administração não reivindica itens. |

**Registrar / editar item**

| Contexto | Texto |
|---|---|
| Título | Registrar item · Editar item |
| Aviso antifraude | Não escreva na descrição detalhes que só o dono saberia (número de série, conteúdo, marcas). Eles serão perguntados na reivindicação. |
| Rótulos | Foto (opcional) · O que foi encontrado? · Descrição · Categoria · Especifique a categoria (só com Outros) · Onde foi encontrado? · Quando foi encontrado? · Onde está guardado agora? (obrigatório; texto auxiliar: "Informe onde o objeto está guardado. Essa informação é privada e só poderá ser acessada pela administração e pelo proprietário após a confirmação da posse.") |
| Ajudas | Ex.: Garrafa térmica, Chaveiro, Fone de ouvido · Cor, tamanho, estado. · Bloco, andar, sala ou ponto de referência. n/120 · Ex.: Crachá de visitante. Até 40 caracteres. · Opcional. Só a administração vê esta informação; ela não aparece para outras pessoas. |
| Foto | Enviar foto · Tirar foto · Trocar foto · Tirar outra foto · Remover foto · JPG, PNG ou WebP, até 10 MB · Se a câmera não abrir neste aparelho, use Enviar foto. |
| Erros | Informe o que foi encontrado. · Descreva o item. · Escolha uma categoria. · Informe o local onde foi encontrado. · Especifique a categoria. · A data não pode ser no futuro. · Formato não aceito. Use JPG, PNG ou WebP. · A foto passa de 10 MB. Escolha uma menor. |
| Botões | Registrar item · Salvar alterações · Cancelar · Excluir item |
| Toasts | Item registrado. Ele já aparece na busca. · Alterações salvas. · Item excluído. |
| Excluir (diálogo) | **Excluir este item?** "{título}" será removido da busca. Esta ação não pode ser desfeita. (+ "As {n} reivindicações ligadas a ele também serão removidas.") |

**Minhas reivindicações**

| Contexto | Texto |
|---|---|
| Título / vazio | Minhas reivindicações / **Você ainda não reivindicou nenhum item** — Se algo seu foi encontrado, ele aparece em Itens. [Ver itens] |
| Pendente | Aguardando análise da administração. |
| Aceita | Aceita! Procure a administração para retirar o item. |
| Aceita + devolvido | Item devolvido em {data}. |
| Recusada | A administração recusou esta reivindicação. Você não pode reenviar. Se acha que foi engano, procure a administração. |
| Anúncio ao vivo (`sr-only`) | Status atualizado: {status}. |

**Administração**

| Contexto | Texto |
|---|---|
| Painel | Painel · Reivindicações pendentes · Itens em reivindicação · Devoluções |
| Vazio pendentes | Nenhuma reivindicação pendente. Quando chegar uma, ela aparece aqui. |
| Linha de item | Aceita para {nome} · aguardando devolução / {n} pendentes |
| Análise | Analisar reivindicação · O que foi publicado · O que a pessoa respondeu · Detalhes que só o dono saberia · Onde e quando perdeu |
| Aviso | Outras {n} reivindicações neste item: se você aceitar, elas serão recusadas automaticamente. |
| Aceitar (diálogo) | **Aceitar esta reivindicação?** As outras {n} reivindicações deste item serão recusadas automaticamente. O item continua Em reivindicação até você registrar a devolução. [Aceitar reivindicação] |
| Recusar (diálogo) | **Recusar esta reivindicação?** {nome} não poderá reenviar para este item. (+ "O item voltará a ficar Disponível.") [Recusar reivindicação] |
| Devolução (diálogo) | **Registrar a devolução?** Item: {título}. Entregue a: {nome}. Esta ação não pode ser desfeita. [Registrar devolução] |
| Toasts | Reivindicação aceita. · Reivindicação recusada. · Devolução registrada. O item saiu da busca. |
| Devoluções | Devoluções · Devolvido de · até · Limpar período · Entregue a · Registrada por · Nenhuma devolução registrada ainda · Nenhuma devolução nesse período |
| Acesso negado | **Acesso restrito** — Esta área é só para a administração. Você entrou como {Usuário|Administração}. [Voltar para os itens] |

**Erro genérico de ação:** "Não foi possível {verbo no infinitivo}. Tente de novo em instantes. Suas respostas foram mantidas." (ex.: "Não foi possível enviar a reivindicação. …").

## 11. Acessibilidade — como este design atende AC07/AC08

| Critério | Como o design atende |
|---|---|
| AC07.1 (360 px, sem rolagem horizontal) | §8.2: uma coluna, gutter 16, `overflow-wrap`, tabela → cards, trilho de abas rola internamente |
| AC07.2 (alvo ≥ 44 px) | `touch-target` 44, `touch-target-lg` 48; botão de ícone 44 × 44; chips 44; BottomNav 64 |
| AC08.1 rótulo associado | Field: `label` sempre visível (§6.3); nunca só placeholder |
| AC08.1 erros anunciados | `aria-invalid` + `aria-describedby` + região `aria-live`; foco no primeiro inválido |
| AC08.1 foco visível | Anel global 3 px (razão ≥ 6,79:1 em todo fundo); campos mudam borda |
| AC08.1 teclado completo | Nativos (`dialog`, `select`, `input`, `button`, `a`); abas com setas; menu de conta com `Esc`/setas |
| AC08.1 contraste AA | §3.2: todo texto ≥ 4,5:1 e todo controle ≥ 3:1 |
| AC08.1 diálogos | `showModal()` (foco preso, `Esc`), `aria-labelledby/describedby`, foco inicial seguro, retorno de foco |
| Status sem depender de cor (WCAG 1.4.1) | §3.4: ícone + texto + cor |
| Movimento reduzido | `prefers-reduced-motion` em `globals.css` |
| Zoom/texto | Unidades `rem`; **não** bloquear zoom (`maximum-scale`); layout fluido até 200 % |
| Idioma | `<html lang="pt-BR">` |
| Landmarks | `header`, `nav aria-label="Principal"`, `main`, um `h1` por página, link "Pular para o conteúdo" (primeiro foco) |

## 12. Problemas e riscos de UX encontrados (explicados antes das propostas)

Nenhum altera a SPEC sozinho; ficam para o orquestrador decidir/registrar em `SPEC.md §9`.

| # | Problema | Por que importa | Proposta adotada neste design |
|---|---|---|---|
| R1 | A descrição **pública** do item pode revelar o detalhe que o dono usaria para provar posse (SPEC P7) — o fraudador só copia. | Enfraquece a validação por perguntas. | Aviso antifraude no formulário de registro (§9.5); a reivindicação pede o que **não** está na descrição (§9.6). Sem mudança de regra. |
| R2 | Foto é guardada como `photoDataUrl` em `localStorage` (quota típica de ~5 MB). Fotos de celular têm 3–10 MB. | O armazenamento estoura e o app quebra silenciosamente. | Limite de 10 MB de entrada **e** redução obrigatória no cliente (lado maior ≤ 640 px, JPEG) antes de salvar — pedido ao `frontend-engineer`/`mock-engineer`; erro claro se ainda assim estourar a quota. |
| R3 | Recusa **sem motivo** e sem reenvio (SPEC §4/AC04.7) deixa a pessoa sem saída. | Frustração e retrabalho presencial. | Texto orienta a procurar a administração (§10); campo de motivo fica como sugestão futura (não incluído). |
| R4 | A SPEC não diz o que acontece com as **reivindicações** ao excluir um item. | Pode deixar reivindicação órfã ou apagar histórico sem aviso. | Premissa de design: exclusão remove as reivindicações do item e o diálogo avisa a contagem. **Registrar como P14 e alinhar com `mock-engineer`.** |
| R5 | O filtro de período do **usuário** usa a data em que o item foi *encontrado* (P11), mas a listagem de **devoluções** (admin) não tem data de achado óbvia. | Rótulo ambíguo ("período de quê?"). | Rótulos explícitos: "Encontrado de/até" na busca; "Devolvido de/até" em devoluções (data de `returnedAt`). **Confirmar com o orquestrador** — se preferirem filtrar devoluções pela data do achado, só muda o rótulo. |
| R6 | Item **Devolvido** some da busca, mas continua acessível por link e em "Minhas reivindicações". | Usuário pode cair numa página sem ação e sem explicação. | Estado `neutral` read-only com a data da devolução (§9.4) e badge "Devolvido" nos cards de reivindicação. |
| R7 | ~~Banner permanente de demonstração~~ | Removido em 20/10/2026 por decisão da usuária. | Sem banner nem rodapé de demonstração. |
| R8 | Reivindicação aceita não informa **como retirar**. | Usuário aceito não sabe o que fazer a seguir. | **Revisto em 27/10/2026 (SPEC P43):** o local de guarda é obrigatório e privado; é mostrado ao reivindicante **somente com reivindicação aceita** e item aguardando devolução ("Ele está guardado em {local}"); pendente, recusada e devolvida nunca o citam. Sem estados novos nem verificação de identidade além da análise da administração. |
| R9 | O vínculo institucional/externo vem só do domínio do e-mail e não é verificado (P40); se a administração o vir na análise, pode confiar demais. | Informação pode induzir confiança indevida. | Se exibido, rotular como "Vínculo pelo e-mail (não verificado)" em texto pequeno; nunca como "aluno" ou "professor". |
| R10 | Sheet de filtros sem contagem ao vivo exigiria cálculo duplicado de resultados. | Complexidade sem ganho. | Botão "Aplicar" simples; contagem só depois de aplicar. |

## 13. Notas de implementação para outros donos

**Para o orquestrador (instalação):** `npm install @fontsource-variable/public-sans@5.3.0 @fontsource-variable/bricolage-grotesque@5.3.0` (única dependência nova).

**Para o `frontend-engineer` (`layout.tsx`, `lib/utils.ts` etc.):**

1. Remover `next/font/google` e as variáveis Geist; importar os dois pacotes (§4.2). `<html lang="pt-BR">`; manter `antialiased` (já em `body`).
2. `metadata`: `title: { default: "CampusLost", template: "%s · CampusLost" }`, `description: "Achados e perdidos do campus."`, `icons: { icon: "/brand/icon.svg" }`. `viewport`: `{ width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#F6F4EF" }` (**sem** `maximumScale`; `viewportFit: "cover"` é necessário para `pb-safe`/`pb-bottomnav` funcionarem).
3. Cores só por tokens: a paleta padrão do Tailwind foi desativada (`--color-*: initial`), portanto `text-white`, `bg-red-500`, etc. **não geram CSS**. Use `bg-surface`, `text-on-primary`, `text-success-fg`, `bg-warning-bg`, `border-line-strong`…
4. Utilitários prontos em `globals.css`: `touch-target`, `touch-target-lg`, `pb-safe`, `pt-safe`, `pb-bottomnav`, `px-gutter`, `link`, `tabular`, `skeleton`, `tag-shape`, `animate-rise`, `animate-fade`, contêineres `max-w-form|page|admin`, tamanhos `text-meta|body|lead|h3|h2|h1|display`.
5. Mapeamento status → rótulo/ícone/tom num único módulo (sugestão: `components/ui/status.ts`), conforme §3.4.
6. Apagar os SVGs do scaffold em `public/` e a página `app/page.tsx` do scaffold (fora do meu escopo).

**Não verificado por mim:** renderização no navegador (sem `Bash` de build/execução neste papel); o CSS foi apenas **compilado** com o motor do Tailwind 4.3.3 (sem erros; `text-white`/`bg-blue-500` ausentes como esperado; utilitários `link`, `skeleton`, `touch-target` e tokens geram CSS) e os SVGs foram rasterizados para conferência visual. Contrastes: calculados, não medidos em tela.


## 14. Atualizações de implementação (pós-revisão e QA)

- **Reivindicações relacionadas e BackLink (27/10/2026, AC04.10/AC04.11, P44):**
  - *Reivindicações deste item* (§9.9): cartão `surface` + `shadow-card` após os avisos de decisão, só com 2 ou mais reivindicações. Título em versalete `text-meta` com a contagem, frase "Reivindicação 2 de 3, da mais antiga para a mais recente.", botões `secondary` "Anterior" (esquerda) e "Próxima" (direita) com `aria-label` "Reivindicação anterior"/"Próxima reivindicação", ausentes nos extremos. Lista de links (mín. 44 px): nome, "Enviada em …" e `ClaimStatusBadge` (texto + ícone + cor); a aberta tem `aria-current="true"`, borda `primary`, fundo `primary-soft` e o texto "Aberta agora". Sem proofDetails/lostWhereWhen. Ao trocar de reivindicação o foco vai ao `#conteudo` e a página volta ao topo. A lógica de ordem e vizinhas é `components/admin/related-claims.ts`.
  - *BackLink* (`components/layout/BackLink.tsx`): link `ghost` com `ChevronLeft` e o texto do destino, antes do `PageHeader`, **visível só a partir de `md`** (no celular o header já tem a seta; não duplicar). Destino e rótulo vêm de `getRouteChrome` (`backHref`/`backLabel`), respeitando `?de=` e a última busca de `/itens`. Usado em análise, detalhe do item, editar, reivindicar, registrar, Usuários, Convites, Auditoria, Minha conta, Privacidade e Termos; não existe nas páginas de topo.

- **Visitante, `next` e alt (22/10/2026, P28):** `?next=` aceita somente `/itens/<id>` (§9.15); entrar a partir de `/itens` leva à página inicial do perfil, sem restaurar filtros (§9.14); devolvido e inexistente mostram o mesmo "Item não encontrado" ao visitante; visitante não vê "Registrado por"; `alt` do detalhe: "Foto de {título}" (enviada) e "Imagem ilustrativa: {título}" (seed).
- **Landing pública e visitante (22/10/2026, P26/P27):** `/` ganhou landing (§9.13); `/itens` e `/itens/[id]` têm variante visitante (§9.14, §9.15) com Header público (§6.12) e sem BottomNav; imagens ilustrativas do seed em `frontend/public/seed/` (§2.5). Nenhum token novo foi necessário; nenhum aviso de "modo demonstração" existe na interface.

Registro do que mudou na implementação em relação ao desenho original; vale sobre o texto das seções anteriores quando divergirem.

- **Frases de status (§3.4):** Disponível "Pode ser reivindicado."; Em reivindicação "Há reivindicação em andamento."; Devolvido "Este item já foi devolvido.". Motivo: as frases antigas contradiziam o estado depois de uma recusa ou de uma aceitação. Na tela de item, a frase é omitida quando a pessoa tem reivindicação própria (o aviso específico já a explica).
- **Aviso de armazenamento (§8.1):** o banner/rodapé de demonstração foi removido (20/10/2026). Quando o armazenamento do navegador está indisponível, uma faixa em `role="status"` mostra: "Seus dados desta demonstração não serão guardados neste navegador e serão perdidos ao recarregar."
- **Texto longo sem espaços:** utilidade `user-text` (`overflow-wrap: anywhere`) em `globals.css`, usada em todo texto digitado por usuários; grids de conteúdo usam `grid-cols-1`/`min-w-0` para não esticar além da tela.
- **Página 404 própria** (`app/not-found.tsx`, pt-BR, com botão "Voltar ao início").
- **Título da aba:** o detalhe do item e "Acesso restrito" definem o título pelo hook `useDocumentTitle` (o `metadata` do Next sobrescreve o título após a hidratação).
- **Voltar no celular (§6.12):** de `/itens/[id]` e `/itens/novo` volta à última busca; de itens abertos a partir de Minhas reivindicações, Devoluções, Painel ou análise, volta à tela de origem (parâmetro `?de=` validado por lista de permissão).
- **Após registrar a devolução (§9.9):** o app abre `/admin/devolucoes` (premissa P25), não o painel, para mostrar a devolução recém-registrada.
- **Admin no celular (§9.8):** os títulos dos cartões das abas são `h2` abaixo de `md` (`h3` na grade desktop).
- **Mensagens de erro de formulário (§10):** e-mail, foto e data seguem esta seção; título, descrição e local do cadastro ainda usam o texto do domínio (diferenças pequenas, listadas em PROGRESSO).
