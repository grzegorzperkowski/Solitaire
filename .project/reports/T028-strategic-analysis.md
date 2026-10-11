# T028 strategic-goal analysis — 2026-10-11

Base: `90fba4f`, Node/Windows, Draw 1, seed 2284836135. Source:
`tests/fixtures/solitaire-stan-2284836135-draw1-114.json` (unchanged user export).
Independently run before coordinator's instruction to skip tests/benchmark.
No tests or benchmark were subsequently run. This is a single-position diagnostic,
not statistical evidence of improved hint quality.

## Independent baseline findings

restoreSession(JSON.stringify(export.save)) succeeded. assertInvariants accepted
all 52 distinct cards; session cursor 114, knownCards 40. Root legal actions:
- draw;
- tableau column 1, cardIndex 2 (J♥ run) → column 4 (Q♠);
- tableau column 3, cardIndex 2 (7♠ run) → column 7 (8♦);
- tableau column 3, cardIndex 4 (5♠) → column 5 (6♦);
- foundation hearts (4♥) → column 3 (5♠).

Formal searchProgress: PROGRESS_FOUND, visitedStates 76, noLegalMoves false.
Previous SmartHint, 10000 states / depth 12: INCONCLUSIVE, visitedStates 250,
truncated true. Depth 16: INCONCLUSIVE, visitedStates 256, truncated false.
Independent breadth-first enumeration, stopping at reveal/new information,
retained 256 unique known states, maximum shortest-path depth 14, zero edges
achieving H>0, net F>0 or new information. No claim about the deal's
unwinnability, earlier history or positions beyond an information boundary.

## 2♦ preparation

Legal sequence: draw 9♥, draw J♠, draw 2♦; foundation 4♥ to 5♠ in column 3;
foundation 3♠ to 4♥ in column 3; waste 2♦ to 3♠ in column 3.
All six commands were previously replayed successfully through applyMove.
Resulting components from the terminal board and unchanged formula:
H=0, F=-2, I=0, W=1, M=0, B=0, L=6; U=65-80-24=-39.
Removing standalone waste from M/B does not change this sequence's M/B (zero).
The new goal classifier returns no primary goal by construction; no new
post-change search result is claimed without execution.

Terminal board (CardId convention suit*13+rank-1; last array entry is top):
```json
{
  "stock": [],
  "waste": [
    37,
    34,
    49
  ],
  "tableau": [
    {
      "cards": [
        38,
        11,
        36,
        9,
        21,
        46,
        32,
        44
      ],
      "faceUpStart": 0
    },
    {
      "cards": [
        12,
        24,
        10
      ],
      "faceUpStart": 0
    },
    {
      "cards": [
        47,
        33,
        45,
        31,
        43,
        29,
        41,
        14
      ],
      "faceUpStart": 1
    },
    {
      "cards": [
        25,
        50
      ],
      "faceUpStart": 0
    },
    {
      "cards": [
        16,
        42,
        18
      ],
      "faceUpStart": 2
    },
    {
      "cards": [
        23,
        17,
        51,
        35,
        15
      ],
      "faceUpStart": 4
    },
    {
      "cards": [
        19,
        48,
        30,
        22,
        13,
        8,
        20
      ],
      "faceUpStart": 5
    }
  ],
  "foundations": [
    [
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7
    ],
    [],
    [
      26,
      27,
      28
    ],
    [
      39,
      40
    ]
  ]
}
```

The earlier suggestion to accept a negative waste-only plan was rejected after
this independent analysis: formal F04 progress is broader than strategic value.
The actual design issue is accepting W as sufficient elsewhere, not this seed
returning INCONCLUSIVE. No weights were changed without calibration.

## Reproduction

The independent diagnostic invocation was `@' <module below> '@ | node --input-type=module`
from the repository root on master at 90fba4f. Its outputs are recorded above.
Run only when diagnostics/checks are assigned again:
```js
import {readFileSync} from 'node:fs';
import {restoreSession} from './src/persistence.js';
import {getLegalMoves,applyMove,assertInvariants} from './src/engine/game.js';
import {searchProgress,progressStateKey} from './src/engine/progress.js';
import {searchSmartHint} from './src/engine/smart-hints.js';
import {visibleCards} from './src/engine/knowledge.js';
const d=JSON.parse(readFileSync('tests/fixtures/solitaire-stan-2284836135-draw1-114.json'));
const r=restoreSession(JSON.stringify(d.save));
if(!r.ok) throw Error(JSON.stringify(r));
const s=r.session; assertInvariants(s.state);
const run=g=>{let n;do{n=g.next();}while(!n.done);return n.value;};
const q=[{state:s.state,depth:0}], seen=new Set([progressStateKey(s.state,s.knownCards)]), k=new Set(s.knownCards);
const rootHidden=s.state.tableau.reduce((n,c)=>n+c.faceUpStart,0),rootF=s.state.foundations.flat().length;
let goals=0,maxDepth=0;
for(let i=0;i<q.length;i++) {
  const {state,depth}=q[i]; maxDepth=Math.max(maxDepth,depth);
  for(const m of getLegalMoves(state)) {
    const n=applyMove(state,m); if(!n.ok)throw Error('invalid engine move');
    const h=rootHidden-n.state.tableau.reduce((n,c)=>n+c.faceUpStart,0),f=n.state.foundations.flat().length-rootF,newInfo=visibleCards(n.state).some(id=>!k.has(id));
    if(h>0||f>0||newInfo){goals++;continue;}
    const key=progressStateKey(n.state,s.knownCards);
    if(!seen.has(key)){seen.add(key);q.push({state:n.state,depth:depth+1});}
  }
}
console.log(JSON.stringify({cursor:s.cursor,cards:52,legal:getLegalMoves(s.state),progress:run(searchProgress(s.state,s.knownCards)),hint12:run(searchSmartHint(s.state,s.knownCards)),hint16:run(searchSmartHint(s.state,s.knownCards,{maxDepth:16})),uniqueKnownStates:seen.size,maxShortestDepth:maxDepth,goalEdges:goals},null,2));
```

For the new diagnostic evaluator, replay the six explicit commands via
analyzeHintPlan; it returns legality, terminal board, H/F/I/W/M/B/L and one-ply
verification. That post-change execution remains unrun at coordinator request.
