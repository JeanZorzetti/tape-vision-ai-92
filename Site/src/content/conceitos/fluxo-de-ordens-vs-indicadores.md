---
title: "Fluxo de ordens ou indicadores: qual a diferença?"
description: "Fluxo de ordens analisa negócios e livro de ofertas em tempo real; indicadores calculam médias sobre o preço passado. A diferença explicada para o WDO."
targetQuery: "diferença entre fluxo de ordens e indicadores técnicos"
answer: "Fluxo de ordens analisa o que está acontecendo agora — negócios executados e ofertas no livro. Indicadores técnicos (médias móveis, osciladores) calculam fórmulas matemáticas sobre o histórico de preço, ou seja, olham para trás e reagem com atraso ao que já aconteceu."
updated: 2026-08-12
published: 2026-08-12
draft: false
---

Fluxo de ordens analisa o que está acontecendo agora — negócios executados e ofertas no livro.
Indicadores técnicos (médias móveis, osciladores) calculam fórmulas matemáticas sobre o histórico
de preço, ou seja, olham para trás e reagem com atraso ao que já aconteceu.

## Indicadores de gráfico não funcionam?

Indicadores técnicos resumem o histórico de preço em um número ou uma linha — são úteis para dar
uma visão geral de tendência, mas, por construção, são calculados sobre dados que já aconteceram.
Toda média móvel, por exemplo, é uma média de preços passados: ela nunca antecede o movimento,
apenas o descreve depois que ele ocorreu.

## O que o fluxo de ordens mostra que o gráfico não mostra?

O gráfico de preço (candles) mostra apenas quatro números por período: abertura, máxima, mínima e
fechamento. O fluxo de ordens mostra cada negócio individual, quem foi o agressor, e como o livro
de ofertas se comportou entre um negócio e outro — informação que o candle simplesmente descarta ao
resumir o período inteiro em quatro números.

## Por que o WDO é especialmente adequado para leitura de fluxo?

O mini-dólar (WDO), negociado na B3, tem alta liquidez e forte participação institucional, o que
gera um fluxo de ordens denso e informativo — há volume suficiente circulando a cada segundo para
que padrões de absorção e agressão sejam observáveis com consistência, diferente de ativos com
pouca liquidez, onde o fluxo é esparso demais para gerar sinal confiável.

## É possível combinar fluxo de ordens com indicadores?

Tecnicamente sim, mas o Tape Vision AI foi construído deliberadamente sem indicadores de gráfico —
a leitura de fita pura é o diferencial do produto (ver "como funciona"). A escolha não é contra
indicadores por princípio, mas para evitar diluir o sinal de fluxo de ordens com informação
atrasada que pode contradizê-lo.
