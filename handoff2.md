# Handoff 2 — implementação da spec 002 (motor de tape reading)

> Escrito em 14/08/2026, logo após o handoff.md. **Não substitui o handoff.md** —
> soma-se a ele. Leia o handoff.md primeiro (seções 0, 1, 4, 5 e 7 continuam
> integralmente válidas); este arquivo cobre só o que mudou depois dele e o que
> fazer agora.
>
> **Regra de ouro do projeto, herdada e revalidada: verifique por `curl` antes de
> afirmar qualquer estado de infra.** Esta sessão não tocou em infra nenhuma.

---

## 0. Onde você está

**Branch: `002-tape-reading-engine`** (criada a partir de `main`, ainda não pushada).
Foi criada de propósito: push em `main` deploya produção (handoff.md §1).

**Nada foi commitado.** O working tree tem:

```
 M .specify/memory/constitution.md          <- emendada para v2.0.0
?? specs/002-tape-reading-engine/           <- spec/plan/research/data-model/quickstart/tasks
```

Último commit da `main`: `a7bf389` ("Rewrite handoff for the data-feed pivot").

**Nenhuma linha de código de produção foi escrita.** `agent/` continua com os mesmos
4 arquivos do handoff.md §5. A sessão inteira foi planejamento via Spec Kit.

---

## 1. O que esta sessão fez

Rodou o fluxo Spec Kit completo para o passo 1 da seção 6 do handoff.md ("construir o
motor no agente"), **parando antes de implementar**:

`speckit-specify` → `speckit-plan` → `speckit-tasks` → `speckit-analyze` →
`speckit-constitution` (para resolver um achado CRITICAL) → correções nos artefatos.

Resultado em `specs/002-tape-reading-engine/`:

| Arquivo | O que tem |
|---|---|
| `spec.md` | 3 user stories (P1/P2/P3), 11 FRs, 5 SCs, edge cases, assumptions |
| `plan.md` | stack, estrutura de arquivos em `agent/`, Constitution Check |
| `research.md` | 6 decisões técnicas **com as alternativas rejeitadas e o porquê** |
| `data-model.md` | 5 entidades, incluindo a fórmula do `strength` e o schema do log |
| `quickstart.md` | como validar cada user story, offline e ao vivo |
| `tasks.md` | **14 tarefas (T001-T014) em 6 fases — é isto que você vai executar** |
| `checklists/requirements.md` | checklist de qualidade da spec, tudo passou |

Não existe `contracts/`: a feature não tem interface externa (nenhum outro processo
consome o motor hoje). O schema do sinal está no `data-model.md`.

---

## 2. A constitution mudou — v1.0.0 → v2.0.0 (MAJOR)

**Isto é o mais importante deste handoff e o que você mais provavelmente vai
estranhar.**

A `.specify/memory/constitution.md` foi escrita em 12/08 para a arquitetura de
**execução automática na nuvem**. O pivot de produto do handoff.md §4 (agente local,
só sinal) é de 14/08. A constitution ficou factualmente errada, e o `speckit-analyze`
pegou isso como CRITICAL — o `plan.md` estava "reinterpretando" o princípio III para
caber, que é exatamente o que a regra do analyze proíbe.

Em vez de deixar a exceção enterrada no plano, a constitution foi emendada:

- **Princípio II** era "Risk-First, Confidence-Gated Execution" (mínimo 90% de
  confiança, position sizing, circuit breaker). Virou **"Signal-Only, No Order
  Path" (NON-NEGOTIABLE)**: nenhuma ordem é enviada, nunca — nem desabilitada,
  nem atrás de feature flag, nem por config. **Isso é mais forte que o gate
  anterior, não mais fraco**: uma regra absoluta se verifica por inspeção, um gate
  só vale o quanto o próprio gate estiver correto.
- **Princípio III** era "Real-Time Performance Budget (Sub-10ms)". Virou **"Keep
  Pace With the Live Feed"**: sem backlog, sem sinal derivado de estado velho,
  suspender emissão quando o feed cai. O número 10ms era requisito de segurança de
  capital para execução desatendida; com um humano lendo cada sinal, dezenas de ms
  são invisíveis — e o 10ms não era medido por nada nem cobrado por ninguém.
- **Technology Constraints** agora reconhece **dois alvos** com regras diferentes:
  agente local Python (stdlib-first) e backend de nuvem Node/TS encolhido para
  auth + billing + histórico de sinais.
- **Development Workflow** agora aceita explicitamente o padrão `--selftest` com
  `assert` como teste automatizado válido no agente Python (era "requires unit
  tests", que sugeria framework).
- **Governance** ganhou uma cláusula nova: *um plano ou spec não pode reinterpretar
  um princípio para se encaixar; se o princípio não bate com a realidade, emenda-se
  a constitution primeiro.* Foi a lição exata desta sessão.

Princípios I, IV e V ficaram intactos.

> Se você discordar da emenda, **reverta a constitution antes de implementar**, não
> depois — o `plan.md` já foi reescrito para bater com a v2.0.0.

---

## 3. Decisões já tomadas — não relitigue

Estão todas no `research.md` com as alternativas rejeitadas, mas as que mais
provavelmente serão questionadas:

- **O motor consome o feed in-process**, importando `binance_feed` direto. Não
  parseie o stdout do feed (pior em tudo), não monte fila/IPC (não há requisito
  multi-processo: um instrumento, um trader, uma máquina).
- **`binance_feed.py` muda de forma aditiva**, expondo o dict já parseado um nível
  antes. Não transforme os 3 feeds numa abstração compartilhada — dois deles não
  são usáveis hoje (um travado por licença, outro é beco sem saída).
- **Detecção de gap por watchdog de `time.monotonic()`**, não só pelas exceções do
  `websockets`. O modo de falha silencioso (conectado, mas o exchange parou de
  mandar) não gera exceção nenhuma.
- **Log de sinal em JSON Lines**, mesmo custo de código que string formatada e
  continua parseável.
- **Imbalance = `bid_size / (bid_size + ask_size)`**, só topo de livro. `bookTicker`
  já entrega isso; profundidade L2 está fora de escopo.
- **Session filter com `datetime.time`**, sem `zoneinfo`/DSL. O requisito é "está
  dentro de alguma destas janelas", nada além.

### Duas correções que vieram do `speckit-analyze` e importam

1. **`confidence` foi renomeado para `strength`, com fórmula explícita**:
   `(aggressor_rank + directional_imbalance) / 2` — média simples, sem pesos
   ajustados. O nome mudou porque **não existe nada neste projeto capaz de calibrar
   uma "confiança"**: o sistema nunca envia ordem, logo não há outcome. Chamar de
   confidence um número não calibrado é a mesma família de mentira que o
   `Math.random()` com viés positivo do dashboard (handoff.md §2). É heurística de
   ordenação ("este sinal é mais forte que aquele"), e a spec diz isso na cara.
2. **O corte percentil é p95 por default e configurável** (FR-005a). Vem da única
   medição real que o projeto tem: 400 trades de BTCUSDT ao vivo, onde p95 disparou
   3 vezes e o threshold absoluto disparou 0 (handoff.md §5). **Não é calibrado** —
   calibrar exige histórico da B3, que não temos.

---

## 4. O que fazer agora

Rodar `/speckit-implement` (o projeto tem `.specify/`, então o fluxo é Spec Kit —
regra global do usuário). As 14 tarefas estão em
`specs/002-tape-reading-engine/tasks.md` com caminho de arquivo em cada uma.

**MVP = T001-T007** (Fases 1-3): motor detectando e logando sinal real da Binance.
Pare no checkpoint da US1 para validação ao vivo antes de seguir.

Ordem e dependências resumidas:

| Fase | Tarefas | Entrega |
|---|---|---|
| 1. Setup | T001 | baseline: selftests atuais passando |
| 2. Foundational | T002, T003 | feed expõe eventos in-process; `engine.py` com watchdog e writer |
| 3. US1 (MVP) 🎯 | T004-T007 | `tape_reader.py`, `order_flow_analyzer.py`, wiring, validação ao vivo |
| 4. US2 | T008, T009 | sessão longa desatendida + prova mecânica de independência de feed |
| 5. US3 | T010-T012 | `session_filter.py` + wiring + validação |
| 6. Polish | T013, T014 | suite completa de selftests, docs batendo com o código |

**T007, T008 e T012 são validação manual ao vivo** — dependem de rodar contra o feed
de verdade. T008 pede sessão de várias horas. Um agente não fecha essas sozinho;
não marque como feito sem ter rodado.

---

## 5. Armadilhas — as do handoff.md §7 continuam todas valendo

Releia lá. As que mais vão morder nesta implementação especificamente:

- **O Python que funciona é o da Microsoft Store**:
  `C:\Users\jeanz\AppData\Local\Microsoft\WindowsApps\python.exe`. O `C:\Python313`
  está quebrado (stdlib vazia) e `python`/`py` no PATH podem apontar pra ele. Use o
  caminho completo. Já tem `websockets`, `numpy`, `MetaTrader5`.
- **Push em `main` = deploy em produção.** Fique na branch.
- **`git commit -m` com here-string PowerShell (`@'...'@`) quebra com aspas duplas
  na mensagem.** Use `git commit -F arquivo.txt`, ou heredoc no Bash.
- **Não escreva o motor assumindo que a agressão é sempre confiável.** A Binance
  entrega o agressor no campo `m` (verdade do exchange). A ProfitDLL pode não ser
  tão limpa. Essa adaptação está fora do escopo da 002, mas não crave a suposição
  no código de forma que doa depois.
- **Cuidado ao descrever este projeto para terceiros.** O feed está validado; o
  motor **não existe ainda** — é o que a 002 vai construir. A sessão anterior errou
  isso numa mensagem para a Nelogica.

### Armadilha nova, desta sessão

- **O `--selftest` atual do `binance_feed.py` não cobre `_stream()`** — só
  `aggression()`, `fmt_trade()` e `fmt_book()`. Ou seja: ele passaria intacto mesmo
  que a T002 quebrasse o streaming inteiro. Por isso a T002 exige **adicionar** caso
  de selftest para o gerador novo, e não "manter o selftest passando". Se você ler a
  tarefa rápido demais e só rodar o selftest existente, vai ter uma garantia vazia.

---

## 6. Estado dos outros passos do handoff.md §6

Nada deles foi feito nesta sessão:

- **Passo 2 (deletar o morto)** — middleware duplicado e Dockerfiles do MLEngine
  continuam lá. `ponytail-audit` dá o ranking.
- **Passo 3 (Opção C, parar o dashboard de mentir)** — não tocado. Continua servindo
  `Math.random()` com P&L de viés positivo em produção.
- **Passo 4 (segredos)** — não tocado, por decisão do dono
  (`[[tape-vision-seguranca-adiada]]`). Branch `security/secret-containment` segue
  parada e sem push. **Não refaça sem pedir.**

---

## Memórias relacionadas (`~/.claude/projects/c--dev/memory/`)
- `tape-vision-infra-pendente.md` — infra verificada
- `tape-vision-dados-sao-falsos.md` — onde o `Math.random()` vive
- `tape-vision-forma-do-produto.md` — agente local + só sinal
- `tape-vision-profitdll-gate.md` — o gate de dados
- `tape-vision-seguranca-adiada.md` — por que os segredos seguem lá
