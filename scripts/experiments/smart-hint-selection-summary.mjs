import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Resample seeds together with both modes: Draw1/Draw3 from one seed are correlated.
function pairedSeedInterval(games) {
  const seeds=[...new Set(games.map(g=>g.seed))];
  const differences=seeds.map(seed=>{
    const pair=games.filter(g=>g.seed===seed);
    assert.equal(pair.length,4);
    return [1,3].reduce((sum,draw)=>{
      const a=pair.find(g=>g.drawCount===draw&&g.algorithm==='previous');
      const b=pair.find(g=>g.drawCount===draw&&g.algorithm==='current');
      assert(a&&b);
      return sum+Number(b.stop==='WON')-Number(a.stop==='WON');
    },0)/2;
  });
  let randomState=20261016;
  const random=()=>{randomState=(Math.imul(1664525,randomState)+1013904223)>>>0;return randomState/4294967296;};
  const samples=Array.from({length:20000},()=>{
    let sum=0;for(let n=0;n<seeds.length;n++)sum+=differences[Math.floor(random()*seeds.length)];
    return sum/seeds.length;
  }).sort((a,b)=>a-b);
  return {method:'paired seed-cluster percentile bootstrap; both draw modes remain together',
    repetitions:20000,randomSeed:20261016,seedCount:seeds.length,
    difference:differences.reduce((a,b)=>a+b,0)/seeds.length,
    interval95:[samples[499],samples[19499]],
    limitation:'Descriptive small-sample bootstrap; not proof of improvement. Training is exploratory.'};
}

const configurations=[['4096','exploratory'],['validation','validation'],['seed202','diagnostic']];
const summaries=[];
for(const [name,purpose] of configurations){
  const base=`.cache/T028-selection-${name}`;
  const rawText=readFileSync(`${base}.json`,'utf8'),raw=JSON.parse(rawText);
  const summary=JSON.parse(readFileSync(`${base}-summary.json`,'utf8'));
  assert.equal(createHash('sha256').update(rawText).digest('hex'),summary.rawSha256);
  assert.equal(summary.games.length,raw.games.length);
  const selectionCounts=Object.fromEntries(['previous','current'].map(id=>{
    const choices=raw.games.filter(g=>g.algorithm===id).flatMap(g=>g.choices);
    return [id,{fresh:choices.length,multipleReveal:choices.filter(c=>c.acceptedRevealCandidates>1).length,
      multipleRevealFirstMoves:choices.filter(c=>c.distinctRevealFirstMoves>1).length,
      candidateChanges:choices.filter(c=>c.candidateChoiceChanged).length,
      planChanges:choices.filter(c=>c.choiceChanged).length,firstMoveChanges:choices.filter(c=>c.firstMoveChanged).length}];
  }));
  const byMode=Object.fromEntries([1,3].map(draw=>[draw,Object.fromEntries(['previous','current'].map(id=>{
    const games=summary.games.filter(g=>g.algorithm===id&&g.drawCount===draw);
    return [id,{deals:games.length,wins:games.filter(g=>g.stop==='WON').length}];
  }))]));
  const discordantSeeds=[...new Set(raw.games.map(g=>g.seed))].flatMap(seed=>[1,3].flatMap(draw=>{
    const a=raw.games.find(g=>g.seed===seed&&g.drawCount===draw&&g.algorithm==='previous');
    const b=raw.games.find(g=>g.seed===seed&&g.drawCount===draw&&g.algorithm==='current');
    return (a.stop==='WON')!==(b.stop==='WON')?[{seed,draw,control:a.stop,variant:b.stop}]:[];
  }));
  const result={...summary,purpose,byMode,selectionCounts,discordantSeeds,
    ...(purpose==='diagnostic'?{}:{pairedDifference:pairedSeedInterval(raw.games)})};
  if(result.pairedDifference) assert.equal(result.pairedDifference.difference,
    (summary.paired.currentOnlyWon-summary.paired.previousOnlyWon)/summary.summaries.previous.deals);
  writeFileSync(`.project/reports/T028-selection-${name}-summary.json`,JSON.stringify(result,null,2)+'\n');
  summaries.push(result);
  console.log(JSON.stringify({purpose,summaries:result.summaries,paired:result.paired,byMode,selectionCounts,discordantSeeds,pairedDifference:result.pairedDifference}));
}
const [training,validation]=summaries;
assert.deepEqual(training.metadata,validation.metadata);
assert(training.games.every(g=>!validation.games.some(h=>h.seed===g.seed)));
assert.equal(training.games.length,80);assert.equal(validation.games.length,160);
assert.equal(training.options.maxStates,validation.options.maxStates);
assert.equal(training.options.maxDepth,validation.options.maxDepth);
