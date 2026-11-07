# LoFi City

Cenas lo-fi em pixel art que seguem o **horário real** e o **clima ao vivo** de cada cidade. Se está chovendo lá, chove na tela; se é noite lá, é noite aqui. Com duas rádios de músicas reais sob licença Creative Commons.

**Cidades**

- **Tóquio** (padrão): `Esquina da chuva`, `Beco neon`, `Rua do konbini`, `Santuário`. Estações japonesas: sakura, tsuyu, momiji, neve no fim do ano, hanabi.
- **Esperança · PB** (horário de Brasília): `Praça da Matriz`, com a igreja de Nossa Senhora do Bom Conselho, e `Rua do Comércio`. Calendário local: festa da padroeira em janeiro, São João, Natal.

Tudo é desenhado por código (sem imagens), num framebuffer indexado com gradação de paleta para dia, noite, pôr do sol e tempo nublado.

## Rodar

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # dist/index.html, um único arquivo autocontido
pnpm shot       # capturas em ./shots (precisa de um build)
```

## Opções na URL

- `#city=esperanca` ou `#city=tokyo`
- `#scene=praca-matriz`: fixa um cenário (`praca-matriz`, `rua-comercio`, `rain-corner`, `neon-alley`, `konbini`, `shrine`)
- `#at=2026-12-24T22:00`: congela um momento no fuso da cidade (para testes; a interface sempre usa a hora real)
- `#wx=rain`: força o clima (`clear`, `cloudy`, `rain`, `snow`, `storm`, `fog`)

## Teclas

T cidade, S cenário, R rádio, N próxima faixa, P estação, M som ambiente, W chuva no vidro, C CRT, L relâmpago, D detalhes, Enter tela cheia.

## Estrutura

- `src/engine`: framebuffer indexado, paleta, pós-processamento em WebGL2
- `src/sky`: cidades, relógio e astronomia, modelos de clima (Japão e Agreste), clima ao vivo, gradação
- `src/fx`: chuva, neve, pétalas e folhas, relâmpagos, fogos
- `src/actors`: pedestres, carros e motos, árvores
- `src/scenes`: passes compartilhados, kit de Esperança (`br-kit.ts`) e um arquivo por cenário
- `src/audio`: som ambiente generativo e as rádios

## Créditos

- **Clima**: [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). Sem chave; atualiza a cada 10 minutos e cai para o clima simulado se a rede falhar.
- **Músicas**: transmitidas do [Internet Archive](https://archive.org/), lançadas por seus selos sob licenças Creative Commons. A rádio mostra artista, álbum e licença de cada faixa com link para a página original.
  - Rádio Lo-Fi City: [Dusted Wax Kingdom](https://archive.org/search?query=identifier%3ADWK%2A) (CC BY-NC-ND).
  - Rádio Vaporwave: lançamentos de netlabels como Enough Records, Section 27, Internet Daemon e outros (CC BY-NC-ND / BY-NC-SA / BY-SA).
  - As músicas **não** fazem parte deste repositório nem da licença MIT; as licenças NC proíbem uso comercial.

## Licença

Código sob [MIT](LICENSE).
