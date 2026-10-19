# CampusLost — Direção visual e design system

> Tarefa T01 · dono: `ux-designer` · escrito em 19/10/2026.
> Implementação dos tokens: `frontend/src/app/globals.css`. Ativos: `frontend/public/brand/`.
> Regras de negócio, telas e critérios de aceite vêm de `SPEC.md` (aqui citados como AC##.#). Este documento **não** altera a SPEC; onde ela deixa lacuna de usabilidade, a lacuna está em §12.

## 0. Rótulos usados neste documento

O projeto **não define identidade visual** (nem o PDF do professor, nem o documento de decisões). Tudo o que segue é **[Premissa de design]**: proposta provisória, reversível, justificada por usabilidade. Nenhum valor é "decisão da equipe". Dados de exemplo (categorias, locais) são os demonstrativos da SPEC §3; títulos de itens e nomes nos wireframes são **apenas ilustrativos**.

## 1. Uso real e princípios

**Quem usa e como**

| Persona | Situação real | Consequência de design |
|---|---|---|
| Aluno/professor que **achou** um objeto | De pé, no corredor, com o objeto numa mão e o celular na outra, com pressa | Registro em poucos toques: foto primeiro, campos curtos, ação principal ao alcance do polegar, data já preenchida com hoje |
| Aluno/professor que **perdeu** algo | Caminhando, olhando rápido a lista, às vezes sob sol forte | Reconhecer pela foto, contraste alto, status legível de relance, rolagem vertical simples |
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
- **FileInput (foto):** botão `secondary` "Adicionar foto" (`ImagePlus`) que aciona `<input type="file" accept="image/jpeg,image/png,image/webp">` (sem `capture`: o celular oferece câmera **ou** galeria). Selecionada: pré-visualização 4:3 (largura 100 %, máx. 20 rem), nome do arquivo e dois botões `ghost` "Trocar foto" / "Remover foto" (44 px). Erros de tipo/tamanho aparecem como erro de campo. **Limite adotado: 10 MB de entrada (JPG/PNG/WebP), reduzida automaticamente no cliente para ≤ 640 px** — [Premissa]; fotos de celular costumam passar de 2 MB; ver risco em §12 (R2). Foto é sempre opcional (SPEC P6).

### 6.3 Field (rótulo + ajuda + erro)

Estrutura vertical: **rótulo** (`text-meta` 600 `ink`, sempre visível, acima do campo — nunca só placeholder) → **ajuda** opcional (`text-meta` `ink-muted`) → **controle** → **erro** (`text-meta` `danger-fg`, ícone `CircleAlert` 16 px). `label for`/`id` associados; ajuda e erro ligados por `aria-describedby` (ajuda primeiro, erro depois); o container do erro é uma região `aria-live="polite"` presente no DOM desde o início para o anúncio funcionar (AC08.1).

- **Obrigatório vs. opcional:** formulários dizem logo abaixo do título "Todos os campos são obrigatórios, exceto os marcados como (opcional)"; campos opcionais levam "(opcional)" em `ink-subtle` junto ao rótulo; **sem asterisco** (leitor de tela e pt-BR lidam melhor com "(opcional)").
- **Quando mostrar erro:** ao sair do campo (`onTouched`) e no envio; ao corrigir, o erro some imediatamente. No envio com erros: foco vai ao **primeiro campo inválido** e uma região `aria-live` anuncia "Corrija 2 campos para continuar". Sem erro "genérico" que não aponte o campo.
- **Grupo de rádio (papel no cadastro):** `<fieldset>` + `<legend>`; cada opção é um cartão de 48 px com rádio nativo estilizado (borda `line-strong`, selecionado = borda 2 px `primary` + fundo `primary-soft` + `Check` — **não só cor**).

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

**FilterBar** (busca `/itens`): campos Categoria (select), Local (select), **Encontrado de** e **até** (date; o rótulo diz "Encontrado" porque o filtro usa a data em que o item foi encontrado — SPEC P11). Duas apresentações do mesmo componente:

- **< 768 px:** linha fixa sob o header com botão `secondary` "Filtros" (`SlidersHorizontal`, contador `(2)` quando há filtros ativos) + contagem "12 itens" (`text-meta`, `aria-live="polite"`). Toca → `Dialog` variante `sheet` com os campos, [Aplicar] (primary) e [Limpar] (ghost). Filtros ativos viram **chips** removíveis abaixo da linha (altura 44 px, texto + `X`).
- **≥ 768 px:** barra em linha acima da lista (grade de 4 campos + "Limpar filtros"), aplicação imediata ao mudar (sem botão Aplicar).

Em `/admin/devolucoes` só há o período (De/Até), sempre em linha (duas colunas até 360 px).

### 6.12 Header, Navegação e BottomNav

**Header** (`z-30`, altura 56 px, fundo `surface`, borda inferior `line`):

- **Páginas de topo:** marca 28 px + wordmark à esquerda; à direita, botão de usuário (círculo 44 px com inicial do nome, `aria-label="Menu da conta"`) que abre menu: nome e papel (ex.: "Aluno"), "Reiniciar demonstração", "Sair".
- **Páginas de detalhe/formulário (drill-down):** botão voltar `ChevronLeft` 44 px à esquerda + título da página (`text-lead` 600, truncado) em lugar do wordmark.
- **≥ 768 px:** navegação em texto no header (Itens · Minhas reivindicações para usuário; Painel · Itens · Devoluções para administração) com `aria-current="page"` e indicador inferior de 3 px `primary`; botão `primary` md "Registrar item" à direita antes do menu da conta.

**BottomNav** (somente < 768 px, **somente em páginas de topo**: `/itens`, `/minhas-reivindicacoes`, `/admin`, `/admin/devolucoes`): fixa, altura 64 px + `pb-safe`, fundo `surface`, `shadow-bar`, `<nav aria-label="Principal">`. Itens de largura igual (≥ 90 px a 360 px) e 64 px de altura, bem acima do mínimo de 44 px: ícone 24 px + rótulo `text-meta`. Ativo: pílula `primary-soft` atrás do ícone, rótulo `primary` 600, `aria-current="page"`; inativo: `ink-muted`.

| Perfil | Itens (ícone · rótulo) |
|---|---|
| Aluno/Professor (3) | `Search` Itens · `Plus` Registrar · `ListChecks` Reivindicações (`aria-label` completo "Minhas reivindicações") |
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
| Banner demonstração  |         | Banner demonstração                        |
| Header 56 px         |         | Header: marca | nav | [Registrar] (A)      |
|----------------------|         |--------------------------------------------|
|                      |         |  conteúdo (max-w-page/admin, px-gutter)    |
| conteúdo (px 16)     |         |                                            |
|                      |         |  rodapé: "Modo demonstração" + versão      |
|                      |         +--------------------------------------------+
| BottomNav 64 px (*)  |
+----------------------+
(*) só em páginas de topo; formulários/detalhe usam ActionBar fixa.
```

O **banner de demonstração** (AC01.6/RNF01) é um Notice `info` de largura total acima do header, **não fixo** (rola junto, para não roubar altura): "Demonstração: login simulado e dados salvos só neste navegador." Em todas as páginas, e com texto completo em `/entrar` e no rodapé desktop.

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
| (i) Demonstração: login simulado e     |
|     dados salvos só neste navegador.   |
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
|  ── Ou entre com um perfil de demo ──  |
|  [ Aluno demo                  ->  ]   |   <- secondary, 1 toque
|  [ Professor demo              ->  ]   |
|  [ Administração demo          ->  ]   |
|                                        |
|  Não tem conta? Criar conta            |
|  Reiniciar demonstração                |   <- ghost
+----------------------------------------+
```

Desktop (≥ 1024): duas colunas 50/50. Esquerda: painel `primary` com `logo-mark-mono` grande (`tag-shape`), título e o ciclo em 4 passos (Registrar → Buscar → Reivindicar → Devolver) em `on-primary`. Direita: o formulário acima, `max-w-sm`, centralizado. **Estados:** erro de e-mail inexistente (Field + Notice), `Entrando…` no botão (loading), perfis de demo em `loading` individual.

### 9.2 `/cadastro` — Cadastro (público)

```
+----------------------------------------+
| (i) Demonstração: login simulado ...   |
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
|  Você é                                |
|  ( ) Aluno       (•) Professor         |   <- cartões 48 px
|                                        |
|  Não pedimos senha nesta demonstração. |
|                                        |
+----------------------------------------+
| [        Criar conta                 ] |   <- ActionBar fixa
+----------------------------------------+
```

Desktop: card `max-w-form` centralizado sobre `paper`, ActionBar vira linha no fim do card. Papel "Administração" **não** aparece (só por seed).

### 9.3 `/itens` — Busca e listagem (logado)

```
+----------------------------------------+
| Banner demo                            |
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

### 9.4 `/itens/[id]` — Detalhe do item

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
|  Guardado em   Portaria                |
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
| Usuário com reivindicação **Aceita** | Notice success: "Sua reivindicação foi aceita. Procure a administração para retirar o item em *Guardado em*." |
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
|  [ 📷 Adicionar foto ]  JPG, PNG ou    |
|                         WebP, até 10 MB |
|                                        |
|  O que foi encontrado?                 |
|  ( Garrafa térmica*                  ) |
|  Descrição                             |
|  (                                   ) |
|  (                                   ) |
|  Categoria                             |
|  ( Selecione…                      v ) |
|  Onde foi encontrado?                  |
|  ( Selecione…                      v ) |
|  Quando foi encontrado?                |
|  ( 19/10/2026                        ) |   <- padrão = hoje, máx. = hoje
|  Onde está guardado agora?             |
|  ( Portaria*                         ) |
|  Para o dono saber onde retirar.       |
+----------------------------------------+
| [        Registrar item              ] |   <- ActionBar fixa
+----------------------------------------+
```

Ordem pensada para uso em pé: **foto primeiro** (o gesto mais natural com o objeto na mão), campos curtos, data já preenchida. Com foto: pré-visualização + [Trocar foto] [Remover foto]. Erros: foto inválida, data futura ("A data não pode ser no futuro."), campos vazios. Sucesso: volta para `/itens` com toast "Item registrado. Ele já aparece na busca." e o item no topo (AC02.3). Desktop: `max-w-form`, botões [Cancelar] [Registrar item] à direita.

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
| Maria Exemplo* (Aluno)         |        | ▒▒▒▒▒▒▒▒▒▒                   | Maria Exemplo* (Aluno)       |
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

- **Acesso negado** (`/admin/**` para aluno/professor, AC01.5): EmptyState `restricted`, ícone `ShieldAlert`, "Acesso restrito" / "Esta área é só para a administração. Você entrou como Aluno." [Voltar para os itens]. Visitante vai a `/entrar` (sem tela de erro).
- **Item não encontrado:** EmptyState `restricted`, ícone `FileText`, "Item não encontrado" / "Ele pode ter sido excluído." [Ver itens].
- **Diálogo "Reiniciar demonstração":** confirm — ver §10.

## 10. Microcopy-chave (pt-BR)

Regras: voz ativa, "você", verbo no botão, sem pontuação em rótulo de botão, **reticências "…" (um caractere) só em estados em andamento**, datas `dd/mm/aaaa` (relativas só até 7 dias: "hoje", "ontem", "há 3 dias", com `<time datetime>` e título completo), horas `hh:mm`.

**Global e navegação**

| Onde | Texto |
|---|---|
| Nome do app | CampusLost |
| Banner demonstração | Demonstração: login simulado e dados salvos só neste navegador. |
| Texto completo (`/entrar`, rodapé) | Este é um protótipo. O login é simulado, nenhuma senha é pedida ou guardada, e os dados ficam apenas neste navegador. A segurança real depende do sistema final. |
| Nav usuário | Itens · Registrar · Reivindicações (`aria-label` "Minhas reivindicações") |
| Nav admin | Painel · Itens · Registrar · Devoluções |
| Menu da conta | {Nome} · {Papel} · Reiniciar demonstração · Sair |
| Reiniciar (diálogo) | **Reiniciar a demonstração?** Todos os dados voltam ao estado inicial e você sairá da conta. [Reiniciar] [Cancelar] · toast: Demonstração reiniciada. |
| Carregando | Carregando itens… · Entrando… · Salvando… · Enviando… · Registrando… |

**Entrar / cadastro**

| Contexto | Texto |
|---|---|
| Título `/entrar` | Achou ou perdeu algo no campus? |
| Apoio | Entre para ver e registrar itens. |
| Campo | E-mail · placeholder nome@exemplo.com |
| Botões | Entrar · Criar conta · Aluno demo · Professor demo · Administração demo |
| Atalho (rótulo do bloco) | Ou entre com um perfil de demonstração |
| E-mail vazio / inválido | Informe seu e-mail. / Esse e-mail não parece válido. Use o formato nome@exemplo.com. |
| E-mail não cadastrado (AC01.2) | Não encontramos esse e-mail. Confira a digitação ou crie uma conta. |
| E-mail já usado (AC01.1) | Esse e-mail já tem cadastro. Entre com ele. |
| Nome vazio / papel não escolhido | Informe seu nome. / Escolha como você se identifica. |
| Legenda do papel | Você é · opções: Aluno · Professor |
| Aviso senha | Não pedimos senha nesta demonstração. |

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
| Aceita (aviso) | Sua reivindicação foi aceita. Procure a administração para retirar o item. Ele está guardado em {local}. |
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
| Rótulos | Foto (opcional) · O que foi encontrado? · Descrição · Categoria · Onde foi encontrado? · Quando foi encontrado? · Onde está guardado agora? |
| Ajudas | Ex.: Garrafa térmica, Chaveiro, Fone de ouvido · Cor, tamanho, estado. · Para o dono saber onde retirar. |
| Foto | Adicionar foto · Trocar foto · Remover foto · JPG, PNG ou WebP, até 10 MB |
| Erros | Informe o que foi encontrado. · Descreva o item. · Escolha uma categoria. · Escolha onde foi encontrado. · A data não pode ser no futuro. · Informe onde o item está guardado. · Formato não aceito. Use JPG, PNG ou WebP. · A foto passa de 10 MB. Escolha uma menor. |
| Botões | Registrar item · Salvar alterações · Cancelar · Excluir item |
| Toasts | Item registrado. Ele já aparece na busca. · Alterações salvas. · Item excluído. |
| Excluir (diálogo) | **Excluir este item?** "{título}" será removido da busca. Esta ação não pode ser desfeita. (+ "As {n} reivindicações ligadas a ele também serão removidas.") |

**Minhas reivindicações**

| Contexto | Texto |
|---|---|
| Título / vazio | Minhas reivindicações / **Você ainda não reivindicou nenhum item** — Se algo seu foi encontrado, ele aparece em Itens. [Ver itens] |
| Pendente | Aguardando análise da administração. |
| Aceita | Aceita! Procure a administração para retirar o item. Guardado em: {local}. |
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
| Acesso negado | **Acesso restrito** — Esta área é só para a administração. Você entrou como {papel}. [Voltar para os itens] |

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
| R7 | Banner permanente de demonstração (AC01.6) consome altura (≈ 48 px de 640). | Menos conteúdo visível no mobile. | Banner **não fixo** (rola junto); texto completo só em `/entrar` e rodapé. |
| R8 | Reivindicação aceita não informa **como retirar** (SPEC tem `storedAt`, mas não o exibe explicitamente no fluxo do usuário). | Usuário aceito não sabe o que fazer a seguir. | Mostrar "Guardado em: {local}" no card de "Minhas reivindicações" e no detalhe quando Aceita. |
| R9 | Papel aluno/professor é autodeclarado (limitação já registrada) e o admin vê o papel na análise. | Informação pode induzir confiança indevida. | Exibir o papel como "informado no cadastro" em texto pequeno na análise (§9.9 mostra "(Aluno)"; **prefixo "informado:"** recomendado em implementação). |
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

Registro do que mudou na implementação em relação ao desenho original; vale sobre o texto das seções anteriores quando divergirem.

- **Frases de status (§3.4):** Disponível "Pode ser reivindicado."; Em reivindicação "Há reivindicação em andamento."; Devolvido "Este item já foi devolvido.". Motivo: as frases antigas contradiziam o estado depois de uma recusa ou de uma aceitação. Na tela de item, a frase é omitida quando a pessoa tem reivindicação própria (o aviso específico já a explica).
- **Faixa de demonstração (§8.1):** é um `<aside aria-label="Aviso de demonstração">`. Texto: "Demonstração: login simulado; usuários, itens, categorias e locais são fictícios e os dados ficam salvos só neste navegador." Quando o armazenamento do navegador está indisponível, ganha uma segunda linha em `role="status"`: "Seus dados desta demonstração não serão guardados neste navegador e serão perdidos ao recarregar."
- **Texto longo sem espaços:** utilidade `user-text` (`overflow-wrap: anywhere`) em `globals.css`, usada em todo texto digitado por usuários; grids de conteúdo usam `grid-cols-1`/`min-w-0` para não esticar além da tela.
- **Página 404 própria** (`app/not-found.tsx`, pt-BR, com aviso de demonstração e botão "Voltar ao início").
- **Título da aba:** o detalhe do item e "Acesso restrito" definem o título pelo hook `useDocumentTitle` (o `metadata` do Next sobrescreve o título após a hidratação).
- **Voltar no celular (§6.12):** de `/itens/[id]` e `/itens/novo` volta à última busca; de itens abertos a partir de Minhas reivindicações, Devoluções, Painel ou análise, volta à tela de origem (parâmetro `?de=` validado por lista de permissão).
- **Após registrar a devolução (§9.9):** o app abre `/admin/devolucoes` (premissa P25), não o painel, para mostrar a devolução recém-registrada.
- **Admin no celular (§9.8):** os títulos dos cartões das abas são `h2` abaixo de `md` (`h3` na grade desktop).
- **Mensagens de erro de formulário (§10):** e-mail, foto e data seguem esta seção; título, descrição, local e papel do cadastro ainda usam o texto do domínio (diferenças pequenas, listadas em PROGRESSO).
