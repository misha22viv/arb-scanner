/* Canonical data, conservative matching and cross-book arbitrage core.
 * This module never fetches bookmaker sites. Providers must supply permitted public data.
 */
(function(root){
"use strict";
const VERSION="1.0.0";
const norm=s=>String(s??"").normalize("NFKC").toLowerCase().replace(/ё/g,"е").replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");
const translit=s=>Array.from(norm(s)).map(c=>({"а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ж":"zh","з":"z","и":"i","й":"i","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f","х":"kh","ц":"ts","ч":"ch","ш":"sh","щ":"shch","ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya"}[c]??c)).join("");
const STOP=new Set(["fc","fk","sc","club","team","клуб","фк","ск","ж","жен","women","u19","u20","u21","u23"]);
function cleanName(v){let s=translit(v).replace(/\bmanchester siti\b/g,"manchester city").replace(/\bmanchester iunaited\b/g,"manchester united").replace(/\bparis saint zhermen\b/g,"paris saint germain");return s.split(" ").filter(x=>x&&!STOP.has(x)).sort().join(" ");}
function sim(a,b){if(a===b)return 1;if(!a||!b)return 0;const A=a.split(" "),B=b.split(" ");const token=(x,y)=>{let p=Array.from({length:y.length+1},(_,i)=>i);for(let i=1;i<=x.length;i++){const q=[i];for(let j=1;j<=y.length;j++)q[j]=Math.min(q[j-1]+1,p[j]+1,p[j-1]+(x[i-1]===y[j-1]?0:1));p=q;}return 1-p[y.length]/Math.max(x.length,y.length,1);};let score=0,used=new Set();for(const x of A){let best=0,idx=-1;for(let j=0;j<B.length;j++)if(!used.has(j)&&token(x,B[j])>best){best=token(x,B[j]);idx=j;}if(idx>=0){used.add(idx);score+=best;}}return score/Math.max(A.length,B.length,1);}
function ms(v){if(v==null)return null;if(typeof v==="number")return v<1e12?v*1000:v;const n=Date.parse(v);return Number.isFinite(n)?n:null;}
function first(o,keys){for(const k of keys)if(o&&o[k]!=null)return o[k];return null;}
function normalizeEvent(x,provider="unknown"){
 const home=first(x,["home","home_team_name","homeTeam","team1","participant1"])??first(x?.home_team||{},["name_ru","name","title"]);
 const away=first(x,["away","away_team_name","awayTeam","team2","participant2"])??first(x?.away_team||{},["name_ru","name","title"]);
 const start=first(x,["startTime","start_time","start_at","scheduled_at","date"]);
 const sport=first(x,["sport_name","sport","sport_id"])??first(x?.sport||{},["name","slug","id"]);
 const league=first(x,["league_name","competition","tournament","league_id"])??first(x?.league||{},["name","title","id"]);
 return {schema:VERSION,provider:String(provider),sourceEventId:String(first(x,["id","event_id","match_id","slug"])??""),sport:cleanName(typeof sport==="object"?sport.name:sport),league:cleanName(typeof league==="object"?league.name:league),home:cleanName(home),away:cleanName(away),startTime:ms(start),status:String(first(x,["status","event_status"])??"unknown").toLowerCase(),raw:x};
}
function matchEvents(a,b,opts={}){
 const maxMinutes=opts.maxMinutes??90,threshold=opts.threshold??0.9;
 if(!a.home||!a.away||!b.home||!b.away)return {matched:false,reason:"missing_teams"};
 if(!a.sport||!b.sport||a.sport!==b.sport)return {matched:false,reason:"sport_mismatch"};
 if(!a.league||!b.league)return {matched:false,reason:"missing_league"};\n if(sim(a.league,b.league)<0.82)return {matched:false,reason:"league_mismatch"};
 if(a.startTime==null||b.startTime==null)return {matched:false,reason:"missing_start_time"};
 const delta=Math.abs(a.startTime-b.startTime)/60000;if(delta>maxMinutes)return {matched:false,reason:"start_time_mismatch",deltaMinutes:Math.round(delta)};
 const direct=(sim(a.home,b.home)+sim(a.away,b.away))/2;
 const reverse=(sim(a.home,b.away)+sim(a.away,b.home))/2;
 const swapped=reverse>direct,score=Math.max(direct,reverse);
 return {matched:score>=threshold,score:Number(score.toFixed(3)),swapped,deltaMinutes:Math.round(delta),reason:score>=threshold?"matched":"ambiguous_names"};
}
function decimal(v){if(typeof v==="string")v=Number(v.replace(",","."));return Number.isFinite(v)&&v>1&&v<=10000?v:null;}
function marketKey(x){
 const type=norm(first(x,["market_type","marketType","market_id","market","market_name","marketName"]));
 const period=norm(first(x,["period","period_name","time_period","scope"])??"full time");
 const line=first(x,["line","handicap","total","points"]);
 const settlement=norm(first(x,["settlement","settlement_rule","regulation"])??"regulation");
 if(/first half|1st half|первый тайм|1 тайм|second half|2nd half|второй тайм|period|период|quarter|четверть|set|сет/.test(period))return null;
 let kind=null;
 if(["1x2","match result","full time result","исход матча","результат матча","winner 1x2"].includes(type))kind="1x2";
 else if(["moneyline","2 way moneyline","winner","победитель","победитель матча"].includes(type))kind="two_way";
 else return null;
 return [kind,period,line==null?"":String(line),settlement].join("|");
}
function remapOutcome(outcome,swapped){if(!swapped)return outcome;if(outcome==="home")return "away";if(outcome==="away")return "home";return outcome;}\nfunction outcomeKey(v){const s=norm(v);if(["1","home","home win","п1","победа 1","хозяева"].includes(s))return "home";if(["x","draw","tie","ничья"].includes(s))return "draw";if(["2","away","away win","п2","победа 2","гости"].includes(s))return "away";return null;}
function activeRow(x){return x.is_active!==false&&x.active!==false&&x.suspended!==true&&x.status!=="suspended"&&x.status!=="closed"&&x.status!=="removed";}
function normalizeOddsRows(rows,provider){
 const out=[];
 for(const x of rows||[]){
  const book=String(first(x,["bookmaker","bookmaker_name","book","source"])??provider??"unknown");
  const market=marketKey(x),outcome=outcomeKey(first(x,["outcome","selection","outcome_name","selection_name","factor_name"])),odd=decimal(first(x,["odds","odd","coefficient","price","value"]));
  if(!market||!outcome||!odd)continue;
  out.push({provider:String(provider??book),book,market,outcome,odd,active:activeRow(x),updatedAt:ms(first(x,["updated_at","updatedAt","timestamp","last_update"])),raw:x});
 }
 return out;
}
function calcArbitrage(legs,bank=10000){
 if(!Array.isArray(legs)||legs.length<2||legs.some(x=>!x||!decimal(x.odd)))return null;
 const sum=legs.reduce((s,x)=>s+1/x.odd,0),roi=(1/sum-1)*100;
 return {inverseSum:sum,roi,bank,guaranteedReturn:bank/sum,profit:bank/sum-bank,legs:legs.map(x=>({...x,stake:bank*(1/x.odd)/sum}))};
}
function findCrossBookArbitrage(rows,minRoi=0,bank=10000){
 const active=(rows||[]).filter(x=>x.active!==false),groups=new Map();
 for(const r of active){const k=r.market;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
 const found=[];
 for(const [market,list] of groups){
  const outcomes=market.startsWith("1x2|")?["home","draw","away"]:["home","away"];
  const legs=outcomes.map(o=>list.filter(r=>r.outcome===o).sort((a,b)=>b.odd-a.odd)[0]||null);
  if(legs.some(x=>!x)||new Set(legs.map(x=>x.book)).size<2)continue;
  const result=calcArbitrage(legs,bank);if(result&&result.roi>minRoi)found.push({market,...result});
 }
 return found;
}
function freshness(v,now=Date.now(),warn=5,stale=10){const t=ms(v);if(t==null)return {state:"unknown",ageMinutes:null};const age=(now-t)/60000;if(age< -2)return {state:"future_timestamp",ageMinutes:Math.round(age)};return {state:age>=stale?"stale":age>=warn?"warning":"fresh",ageMinutes:Math.max(0,Math.round(age))};}
root.ArbCore={VERSION,cleanName,normalizeEvent,matchEvents,normalizeOddsRows,findCrossBookArbitrage,calcArbitrage,freshness,marketKey,outcomeKey,remapOutcome};
})(typeof window!=="undefined"?window:globalThis);
