const assert=require("node:assert/strict");
require("../public/arb-core.js");
const C=globalThis.ArbCore;
const now=Date.parse("2026-10-01T12:00:00Z");
const a=C.normalizeEvent({id:1,sport:"football",league:"Premier League",home:"Манчестер Сити",away:"Арсенал",start_time:now},"Fonbet");
const b=C.normalizeEvent({id:2,sport:"football",league:"Premier League",home:"Manchester City",away:"Arsenal",start_time:now+10*60000},"Winline");
assert.equal(C.matchEvents(a,b).matched,true);
assert.equal(C.matchEvents(a,{...b,sport:"hockey"}).reason,"sport_mismatch");
assert.equal(C.matchEvents(a,{...b,startTime:now+4*3600000}).reason,"start_time_mismatch");
const rows=[
 {book:"Fonbet",market:"1x2|full time||regulation",outcome:"home",odd:2.2,active:true},
 {book:"Winline",market:"1x2|full time||regulation",outcome:"draw",odd:4.1,active:true},
 {book:"Fonbet",market:"1x2|full time||regulation",outcome:"away",odd:4.0,active:true}
];
const arbs=C.findCrossBookArbitrage(rows,0,1000);
assert.equal(arbs.length,1);
assert.ok(arbs[0].roi>0);
assert.ok(Math.abs(arbs[0].legs.reduce((s,x)=>s+x.stake,0)-1000)<1e-8);
assert.equal(C.marketKey({market:"1X2",period:"first half"}),null);
assert.equal(C.marketKey({market:"total"}),null);
assert.equal(C.freshness(now,now+60*1000).state,"fresh");
console.log("arb-core tests: OK");
