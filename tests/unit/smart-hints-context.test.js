import { expect, test } from 'vitest';
import * as hints from '../../src/engine/smart-hints.js';
import { applyMove, assertInvariants, isWon } from '../../src/engine/game.js';
import { visibleCards, rememberVisible } from '../../src/engine/knowledge.js';
import { progressStateKey } from '../../src/engine/progress.js';
import { makeState, pile, completedFoundations } from '../fixtures/boards.js';
import { createSession, execute, undo } from '../../src/session.js';
import { serializeSession, restoreSession } from '../../src/persistence.js';
import { h01, h02 } from '../fixtures/smart-hints.js';

const allCards = Array.from({ length: 52 }, (_, id) => id);
const finish = iterator => { let step; do { step = iterator.next(); } while (!step.done); return step.value; };
function move(state, command) { const result = applyMove(state, command); expect(result.ok).toBe(true); assertInvariants(result.state); return result.state; }
function foundationReturnHistory() {
  const foundations = completedFoundations(); foundations[1].pop();
  const root = makeState({ foundations, tableau: [pile([]), pile([25])] });
  const pulled = move(root, { type:'move', from:{pile:'foundation',index:0}, to:{pile:'tableau',index:0} });
  return [root, pulled];
}

test('history memory is not cleared by reversible changes in foundation height', () => {
  const snapshots = foundationReturnHistory();
  const context = hints.createHintContext(snapshots, allCards);
  expect(context.visitedStates).toEqual(new Set(snapshots.map(s => progressStateKey(s, allCards))));
  expect(context.foundationHighWater).toBe(51);
});

test('whole plan avoids earlier actual boards while allowing a new route to victory', () => {
  const snapshots = foundationReturnHistory(), state = snapshots.at(-1);
  const context = hints.createHintContext(snapshots, allCards);
  const result = finish(hints.searchSmartHint(state, allCards, { plannerContext: context, maxDepth: 2, maxStates: 100 }));
  expect(result.status).toBe('FOUND');
  let end = state;
  for (const command of result.plan) {
    end = move(end, command);
    expect(context.visitedStates.has(progressStateKey(end, allCards))).toBe(false);
  }
  expect(isWon(end)).toBe(true);
  expect(context.visitedStates.size).toBe(2); // Search cannot mutate actual history.
});

test('policy rejection is uncertainty, never a no-progress proof', () => {
  const snapshots = foundationReturnHistory(), state = snapshots.at(-1);
  const context = hints.createHintContext(snapshots, allCards);
  const result = finish(hints.searchSmartHint(state, allCards, {plannerContext:context,maxStates:1000,maxDepth:1}));
  expect(result).toMatchObject({status:'INCONCLUSIVE',reason:'HISTORY_RESTRICTED',plan:[]});
  expect(result.diagnostics.historyRejectedGoals).toBeGreaterThan(0);
});

test('information and reveals start a fresh epoch; remembered hidden identity is irrelevant', () => {
  const root = h01();
  const end = move(root,{type:'move',from:{pile:'tableau',index:0,cardIndex:1},to:{pile:'tableau',index:1}});
  const known = rememberVisible(end, visibleCards(root));
  expect(hints.createHintContext([root,end],known).visitedStates)
    .toEqual(new Set([progressStateKey(end,known)]));
  expect(hints.createHintContext([root,end],allCards).visitedStates)
    .toEqual(new Set([progressStateKey(end,allCards)]));
  const drawn = move(root,{type:'draw'}), drawnKnown=rememberVisible(drawn,visibleCards(root));
  expect(hints.createHintContext([root,drawn],drawnKnown).visitedStates)
    .toEqual(new Set([progressStateKey(drawn,drawnKnown)]));
});

test('a necessary foundation pull remains searchable with session history', () => {
  const state=h02(), known=visibleCards(state);
  const result=finish(hints.searchSmartHint(state,known,{plannerContext:hints.createHintContext([state],known),maxStates:100,maxDepth:2}));
  expect(result).toMatchObject({status:'FOUND',goal:'REVEAL'});
  expect(result.plan[0].from.pile).toBe('foundation');
});


test('a four-move column cycle and known stock laps never reset history', () => {
  const foundations=completedFoundations(); foundations[0].pop(); foundations[1].pop();
  const root=makeState({foundations,tableau:[pile([12]),pile([25])]});
  const snapshots=[root];
  for(const [from,to] of [[0,2],[1,3],[2,0],[3,1]]) snapshots.push(move(snapshots.at(-1),{
    type:'move',from:{pile:'tableau',index:from,cardIndex:0},to:{pile:'tableau',index:to},
  }));
  expect(progressStateKey(root,allCards)).toBe(progressStateKey(snapshots.at(-1),allCards));
  expect(hints.createHintContext(snapshots,allCards).visitedStates.size).toBe(4);
  const stockRoot=h01(), lap=[stockRoot];
  for(let n=0;n<2;n++) {
    while(lap.at(-1).stock.length) lap.push(move(lap.at(-1),{type:'draw'}));
    lap.push(move(lap.at(-1),{type:'recycle'}));
  }
  expect(hints.createHintContext(lap,allCards).visitedStates.size).toBe(stockRoot.stock.length+1);
});

test('Undo uses only its active prefix, retaining memory without redo-tail visits', () => {
  const root=h01(), after=move(root,{type:'draw'}), known=rememberVisible(after,visibleCards(root));
  const undone=hints.createHintContext([root],known);
  expect(undone.visitedStates).toEqual(new Set([progressStateKey(root,known)]));
  expect(undone.visitedStates.has(progressStateKey(after,known))).toBe(false);

});

test('continuation cannot turn restoring an old foundation height into a new goal', () => {
  const snapshots=foundationReturnHistory(), state=snapshots.at(-1);
  const plan=[
    {type:'move',from:{pile:'tableau',index:0,cardIndex:0},to:{pile:'tableau',index:2}},
    {type:'move',from:{pile:'tableau',index:2,cardIndex:0},to:{pile:'foundation',index:0}},
  ];
  const next=move(state,plan[0]);
  const result=finish(hints.searchSmartHint(next,allCards,{
    previousHint:{state,plan},plannerContext:hints.createHintContext([...snapshots,next],allCards),maxDepth:2,maxStates:100,
  }));
  expect(result.continued).not.toBe(true);
  let end=next;
  for(const command of result.plan){end=move(end,command);expect(progressStateKey(end,allCards)).not.toBe(progressStateKey(snapshots[0],allCards));}
});


test('restore rebuilds the same context from the active prefix, with retained Undo knowledge', () => {
  let session = createSession({seed:42,drawCount:1});
  for (let n=0;n<4;n++) session = execute(session,{type:'draw'}).session;
  session = undo(session);
  const before = hints.createHintContext(session.snapshots.slice(0,session.cursor+1),session.knownCards);
  const restored = restoreSession(serializeSession(session));
  expect(restored.ok).toBe(true);
  const next=restored.session;
  expect(hints.createHintContext(next.snapshots.slice(0,next.cursor+1),next.knownCards)).toEqual(before);
});
