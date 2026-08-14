# Handoff — tape-vision-ai-92

> Reescrito em 14/08/2026. Substitui o handoff de 12/08, carregando dele tudo que
> continua verdadeiro (seções 0–4 e 7 são herdadas e revalidadas; 5 e 6 mudaram).
> **Regra de ouro deste projeto: verifique por `curl` antes de afirmar qualquer
> estado de infra. Não confie em memória, README ou `tasks.md`.** Esta regra foi
> honrada hoje — a tabela da seção 1 é resultado de request real, não de memória.

---

## 0. LEIA ISTO PRIMEIRO — não é opcional

**O repositório é PÚBLICO** (`github.com/JeanZorzetti/tape-vision-ai-92`) **e há
segredos reais versionados.** Vazamento ativo, não dívida técnica.

- `.env.production` commitado, com `JWT_SECRET`, senha do Postgres e senha da conta
  de serviço ML em texto claro.
- O mesmo `JWT_SECRET` de produção está **hardcoded como fallback** em
  `Backend/src/server-production.js:21` e escrito no `DEPLOYMENT.md`. (O valor não é
  reproduzido aqui de propósito: este arquivo é versionado num repo público. Leia-o
  nos dois locais acima.)
- Consequência real: qualquer um assina um JWT de admin e loga no backend que está
  no ar agora.

**Correção necessária** (rotacionar `JWT_SECRET` + senha do Postgres `tape_db` +
senha `ml.engine@...`; `git rm --cached .env.production`; matar o fallback para o
servidor **recusar subir** sem a env var; purgar do histórico ou aceitar o segredo
antigo como queimado). Rotacionar é o que protege; purgar é higiene.

> **Status: o dono adiou conscientemente**, até o primeiro cliente pagante. A branch
> `security/secret-containment` existe, está parada e **não foi pushada**. Isto é
> decisão dele, não pendência esquecida — **não refaça sem pedir**. Ver memória
> `[[tape-vision-seguranca-adiada]]`.

---

## 1. Estado verificado da produção (por request real, 14/08/2026)

| Domínio | Papel | Estado |
|---|---|---|
| `tapevision.roilabs.com.br` | Site público / waitlist (Astro) | **200, vivo** |
| `apptapevision.roilabs.com.br` | Dashboard (React/Vite) | **200, vivo** |
| `apitapevision.roilabs.com.br` | Backend (Express) | **200, `/health` OK** |
| `ml.aitrading.roilabs.com.br` | ML Engine (Python) | **NXDOMAIN — nunca deployado** |

Idêntico a 12/08 — nada mudou em infra nestes dois dias.

- **Banco: um só Postgres**, no VPS `2.24.207.200:5456/tape_db`. Serve waitlist +
  auth + tudo. **NÃO existe Neon** (o "Attach Neon" em
  `specs/001-public-product-site/tasks.md` T045 é texto obsoleto — ignore).
- **Deploy é automático**: push em `main` deploya em produção (projetos Vercel).
  Trate como sistema vivo — nada de commit exploratório em `main`.
- Login retorna o token em `tokens.accessToken` (não na raiz). Contas de teste estão
  no `DEPLOYMENT.md`.

---

## 2. O problema central

**O código deployado e o código escrito são dois projetos diferentes.**

- `Backend/src/` tem ~87 arquivos / ~41.000 linhas: `TradingEngine`, `TapeReader`,
  `OrderFlowAnalyzer`, `MLValidator`, `NelogicaService`, `ProfitProConnector`,
  WebSocket manager. Uma catedral.
- **O que serve produção é `server-production.js`: ~510 linhas** que ignoram a
  catedral inteira e respondem tudo com `Math.random()`.
- **Nenhum dado de mercado real jamais entrou no sistema.** `/api/trading/status`
  responde preço, confiança e P&L aleatórios — o P&L com viés positivo. Pontos:
  `NelogicaService.ts:630`, várias linhas de `server-production.js`,
  `Frontend/.../NelogicaConnection.tsx:103`, e o gráfico com random no front em
  `Frontend/src/hooks/useTradingData.ts:78`. Ver `[[tape-vision-dados-sao-falsos]]`.
- **A integração real com a Nelogica nunca foi tocada** pelo Backend: zero bindings
  nativos nas dependências. O campo `dllPath` no frontend sempre foi decoração.

Portanto isto **não** é "refactor de limpar código", é decidir **o que manter, o que
deletar, e como alinhar à forma de produto** (seção 4).

---

## 3. Inventário

- `Backend/src` — ~87 arq. / ~41.252 linhas (só `server-production.js` no ar)
- `Frontend/src` — ~97 / ~17.105 (no ar, funciona)
- `Site/src` — ~30 / ~2.656 (no ar, funciona — a parte mais saudável do repo)
- `MLEngine` — ~38 / ~4.712 (**NÃO** no ar; NXDOMAIN)
- `agent/` — 4 arquivos Python, o único código novo saudável (seção 5)

Já deletado no commit `c5c4a4c`: `Backend.zip`, entrypoints rivais, Dockerfile
quebrado. **Ainda por deletar:** middleware duplicado (`Backend/src/middleware/` vs
`Backend/src/api/middleware/` — dois conjuntos quase idênticos, um é morto) e os
Dockerfiles sobrando do `MLEngine` (4 deles, para um serviço que não está no ar).

> Rodar a skill `ponytail-audit` dá o ranking completo do que cortar.

---

## 4. A decisão de produto que ancora tudo (já tomada pelo dono)

Ver `[[tape-vision-forma-do-produto]]`:

- **Agente local Windows**: o cliente roda um agente na própria máquina, ao lado da
  licença Profit dele. A nuvem nunca toca no feed.
- **Só sinal**: o bot sugere; quem envia a ordem é o cliente. Sem execução
  automática (evita regra da CVM — **confirmar com advogado antes da copy**).

Consequência: o backend na nuvem encolhe para **auth + billing + histórico de
sinais**, stateless. Provavelmente mortos: `OrderManager`, `executeTrade`/
`closePosition`, `DataIntegrationService`, e o **MongoDB inteiro** (o Postgres já
basta). O motor (`TapeReader`, `OrderFlowAnalyzer`, `SignalGenerator`) **sai da
nuvem** e vai para o agente.

> **Nuance nova (14/08):** as duas razões originais do agente ser local eram a
> ProfitDLL ser Windows-only e o licenciamento de redistribuição da B3. **Nenhuma
> das duas se aplica a cripto.** Dado da Binance pode rodar na nuvem legalmente. Isso
> não muda o produto (o produto é WDO), mas abre uma porta — ver seção 6, opção C.

---

## 5. O gate de dados — MUDOU MUITO (esta é a seção nova)

O gate do §5 antigo era "obter a doc da ProfitDLL e imprimir uma tick real". A doc
foi obtida, o spike foi escrito, e aí o gate virou **dinheiro**: a licença **DLL Feed**
da Nelogica é paga e o dono não pode pagar agora.

### O que foi investigado e descartado (não repita)

- **MetaTrader 5 é beco sem saída para WDO/WIN.** Testado ao vivo: o MT5 na máquina
  do dono só tinha servidores **Admirals** (forex/CFD internacional, sem contratos
  B3). Fomos ao catálogo real de plataformas da Rico
  (`arealogada.rico.com.vc/plataformas-disponiveis`) e **não existe MetaTrader 5 lá**
  — só família Nelogica (ProfitPRO, ProfitULTRA) e terminais próprios (Tryd, Fast
  Trader, TraderEvolution). No Brasil, B3 roda sobre o ecossistema Nelogica; MT5 em
  corretora BR é produto de mesa forex. **Fóruns antigos dizendo que Rico/Clear têm
  MT5 com WIN/WDO estão desatualizados — eu caí nessa, não caia também.**
- **ProfitPRO/ULTRA grátis não libera a DLL Feed.** Mesmo com isenção por volume
  operado, a DLL Feed é assinatura separada em Assinaturas na Nelogica.

### O que existe hoje em `agent/` (tudo com `--selftest` que passa)

| Arquivo | O que é | Estado |
|---|---|---|
| `tick_spike.py` | ProfitDLL via ctypes/`WinDLL`, modo Market Data | Escrito, **nunca rodou** (falta licença) |
| `mt5_feed.py` | MetaTrader 5 via API Python | Escrito, **inútil para WDO/WIN** (seção acima) |
| `binance_feed.py` | WebSocket público da Binance | **Rodou ao vivo, funciona** |
| `normalize.py` | Percentil móvel (`RollingSizes`) | **Validado contra dado real** |

**Decisão de escopo:** o motor **não** vai depender de rastrear corretora agressora
(player). É o único dado que só a ProfitDLL entrega; ancorar a estratégia nele
travaria o projeto até haver dinheiro. Todos os feeds emitem `broker=-` para o schema
não mudar quando/se a ProfitDLL voltar.

### Por que Binance, e o limite disso

Binance dá trades + book L2 ao vivo, sem conta e sem custo. **Mercado errado, mecânica
certa.** Serve para validar o motor agora.

**O que transfere:** classificação de agressão, absorção, desequilíbrio de book,
pipeline de eventos, schema de sinal, arquitetura do agente.

**O que NÃO transfere:** todo threshold, lógica de sessão, tick size, spread,
regime de volatilidade. Cripto é 24/7, sem leilão, sem circuit breaker.

**Armadilha já resolvida:** todo threshold de volume em `Backend/config/trading.json`
é contagem absoluta de contratos WDO (`aggressiveOrderThreshold: 1000`,
`minVolume: 500`, `unusualVolume: 5000`). Um print real de BTCUSDT é `0.00023`.
Medido ao vivo em 400 trades: o threshold absoluto disparou **0 vezes**, o percentil
p95 disparou **3** (prints de 444x, 333x e 288x a mediana). O modo de falha é o pior
que existe — não dá erro, dá **silêncio**, e você lê "nenhum sinal hoje" em vez de
"meu filtro está quebrado". Por isso existe o `normalize.py`.

**Armadilha ainda aberta:** a Binance entrega o agressor no campo `m` — verdade do
exchange, sem chute. A ProfitDLL pode não ser tão limpa. **Não escreva o motor
assumindo agressão sempre confiável.** O `binance_feed.py` já avisa isso no docstring.

### Dívida deliberada, nomeada

- `Backend/config/trading.json` **continua com os números absolutos errados, de
  propósito.** Aquele motor está condenado a sair da nuvem (seção 4); corrigir config
  de código que vai ser relocado é trabalho jogado fora duas vezes. O docstring do
  `normalize.py` nomeia quais chaves ele substitui, para a hora da migração.
- **Os cutoffs em si (p95? p99?) não estão calibrados**, e **não podem ser calibrados
  na Binance**. Só com histórico da B3 (arquivos de negócios diários, grátis). A
  primitiva torna a pergunta portável; a resposta ainda exige dado de WDO.
- **Filtros de sessão** (`allowedHours`, `noTradingZones`, `tradingHours`) devem
  ficar **desligados** no cripto e ligados no WDO. Não retune — a diferença ali é de
  microestrutura, não de escala.

### Contato comercial em aberto

O dono está em conversa com a **Nelogica pelo WhatsApp** (+55 51 8913-9118) pedindo
trial/condição de entrada para Market Data sem roteamento. Se houver resposta, ela
destrava o `tick_spike.py` e o gate real cai.

---

## 6. Ordem sugerida para a próxima sessão

O motor **ainda não existe** em `agent/` — lá só há feeds e a primitiva de
normalização. A catedral em `Backend/src/core/` nunca rodou contra dado real. Esse é
o buraco central.

1. **Construir o motor no agente** — `TapeReader`/`OrderFlowAnalyzer` de verdade
   dentro de `agent/`, consumindo `binance_feed` + `normalize`. **Fazer via Spec Kit**
   (o projeto tem `.specify/`; seria a spec `002`): `speckit-specify` →
   `clarify` → `plan` → `tasks` → `implement`. Este é o próximo passo grande.
2. **Deletar o morto** (seção 3) — middleware duplicado, Dockerfiles do MLEngine.
   Baixo risco, alto alívio. `ponytail-audit` dá o ranking.
3. **(Opção C) Parar o dashboard de mentir** — com Binance é possível servir fluxo
   real de cripto em produção **hoje**, sem custo e sem esperar a DLL Feed. Não é o
   produto (o produto é WDO), mas tira do ar um sistema que inventa P&L com viés
   positivo. Cuidado: a tentativa anterior foi revertida (`5db18a9`) por derrubar o
   login junto — refazer em branch, com estado vazio decente no dashboard e **sem**
   boot guard que mate a API. Corrigir também `useTradingData.ts:78`.
4. **Segredos** (seção 0) — só quando o dono liberar.

---

## 7. Armadilhas (as de 12/08 + as desta sessão)

- **Push em `main` = deploy.** Branch para tudo que for mudança de comportamento.
- **Confirme a infra por request antes de afirmar qualquer coisa.** A produção está
  mais viva do que a documentação sugere.
- **Não confie em fórum antigo sobre corretora/plataforma.** O catálogo real da
  corretora é a fonte. Eu afirmei "Rico e Clear têm MT5 com WIN/WDO" com base em
  fórum e estava errado; custou uma volta inteira.
- **Cuidado ao descrever o projeto para terceiros.** Numa mensagem para a Nelogica eu
  escrevi que "o motor já está funcionando e validado" — **não está**. O que está
  validado é o *feed*. O motor são 41k linhas de TypeScript que nunca viram dado real.
- **`git commit -m` com here-string PowerShell (`@'...'@`) quebra se a mensagem tiver
  aspas duplas.** Use `git commit -F arquivo.txt`. No Bash, use heredoc.
- **O Python do `C:\Python313` na máquina do dono está quebrado** (stdlib vazia, sem
  `os.py`; `python`/`py` no PATH apontam para ele ou para um venv do hermes sem pip).
  O que funciona é o da Microsoft Store:
  `C:\Users\jeanz\AppData\Local\Microsoft\WindowsApps\python.exe` — já tem
  `MetaTrader5`, `websockets` e `numpy`. Use o caminho completo.

---

## Memórias relacionadas (`~/.claude/projects/c--dev/memory/`)
- `tape-vision-infra-pendente.md` — infra verificada
- `tape-vision-dados-sao-falsos.md` — onde o `Math.random()` vive
- `tape-vision-forma-do-produto.md` — agente local + só sinal
- `tape-vision-profitdll-gate.md` — o gate de dados, com toda a virada desta sessão
- `tape-vision-seguranca-adiada.md` — por que os segredos seguem lá
