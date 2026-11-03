/* ARB Scanner engine: conservative event matching and arbitrage detection.
 * Accepts only explicit decimal odds rows; unknown payload shapes are rejected, never guessed.
 */
(function (root) {
  "use strict";
  const STOP = new Set(["fc","fk","sc","team","club","the","u","19","20","21","23","women","жен","ж","фк","ск","кф"]);
  const ALIASES = new Map([
    ["манчестер юнайтед","manchester united"],["манчестер сити","manchester city"],
    ["бавария мюнхен","bayern munich"],["мюнхенская бавария","bayern munich"],
    ["псж","paris saint germain"],["пари сен-жермен","paris saint germain"],
    ["интер милан","inter"],["милан интер","inter"],["атлетико мадрид","atletico madrid"],
    ["реал мадрид","real madrid"],["барселона","barcelona"],["спартак москва","spartak moscow"],
    ["цска москва","cska moscow"],["зенит санкт-петербург","zenit"]
  ]);
  const CYR = {"а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ж":"zh","з":"z","и":"i","й":"i","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f","х":"kh","ц":"ts","ч":"ch","ш":"sh","щ":"shch","ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya"};
  function translit(value) { return Array.from(value).map(c=>CYR[c]??c).join(""); }
  function editSimilarity(a,b) {
    if(a===b)return 1;if(!a||!b)return 0;
    const aa=a.split(" "),bb=b.split(" ");
    const sim=(x,y)=>{let prev=Array.from({length:y.length+1},(_,i)=>i);for(let i=1;i<=x.length;i++){const cur=[i];for(let j=1;j<=y.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(x[i-1]===y[j-1]?0:1));prev=cur;}return 1-prev[y.length]/Math.max(x.length,y.length,1);};
    let sum=0;const used=new Set();
    for(const x of aa){let best=0,idx=-1;for(let j=0;j<bb.length;j++)if(!used.has(j)){const score=sim(x,bb[j]);if(score>best){best=score;idx=j;}}if(idx>=0){used.add(idx);sum+=best;}}
    return sum/Math.max(aa.length,bb.length,1);
  }
  function cleanName(value) {
    let s = String(value || "").normalize("NFKD").toLowerCase()
      .replace(/[ё]/g,"е").replace(/\b(fc|fk|sc|club)\b/gi," ")
      .replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");
    s = ALIASES.get(s) || s;
    return translit(s).split(" ").filter(x => x && !STOP.has(x)).sort().join(" ");
  }
  function eventParts(x) {
    const home = x?.home_team?.name_ru || x?.home_team?.name || x?.home || x?.team1 || x?.participant1;
    const away = x?.away_team?.name_ru || x?.away_team?.name || x?.away || x?.team2 || x?.participant2;
    return {home:cleanName(home),away:cleanName(away),start:x?.scheduled_at || x?.start_time || x?.start_at || x?.date || null};
  }
  function eventKey(x) {
    const p=eventParts(x);
    if(!p.home || !p.away) return null;
    return [p.home,p.away].sort().join("::");
  }
  function timeMs(v) {
    if(v==null) return null;
    if(typeof v==="number") return v < 1e12 ? v*1000 : v;
    const n=Date.parse(v); return Number.isFinite(n)?n:null;
  }
  function matchEvent(a,b,windowHours=6) {
    const x=eventParts(a),y=eventParts(b);
    if(!x.home||!x.away||!y.home||!y.away) return {matched:false,reason:"missing_teams"};
    const direct=(editSimilarity(x.home,y.home)+editSimilarity(x.away,y.away))/2;
    const reverse=(editSimilarity(x.home,y.away)+editSimilarity(x.away,y.home))/2;
    const swapped=reverse>direct,score=Math.max(direct,reverse);
    const tx=timeMs(x.start),ty=timeMs(y.start);
    if(tx==null||ty==null)return {matched:false,reason:"missing_start_time",score};
    if(Math.abs(tx-ty)>windowHours*3600000)return {matched:false,reason:"start_time_mismatch",score};
    const matched=score>=0.88;
    return {matched,swapped,score:Number(score.toFixed(3)),reason:matched?"team_names_match":"team_names_ambiguous"};
  }
  function sameEvent(a,b,windowHours=6) { return matchEvent(a,b,windowHours).matched; }
  const first = (o,keys) => { for(const k of keys) if(o && o[k]!=null) return o[k]; return null; };
  function decimal(v) {
    if(typeof v==="string") v=Number(v.replace(",","."));
    return Number.isFinite(v)&&v>1&&v<=10000?v:null;
  }
  function canonicalMarket(v) {
    const s=String(v||"").toLowerCase().replace(/ё/g,"е").replace(/[^\p{L}\p{N}]+/gu," ").trim();
    if(/\b(first half|1st half|second half|2nd half|первый тайм|второй тайм|1 тайм|2 тайм|период|четверть|сет)\b/.test(s)) return null;
    if(["1x2","match result","full time result","исход матча","результат матча"].includes(s)) return "FT_1X2";
    if(["moneyline 2 way","2 way moneyline","победитель 2 исхода"].includes(s)) return "TWO_WAY";
    return null;
  }
  function canonicalOutcome(v) {
    const s=String(v||"").toLowerCase().replace(/ё/g,"е").trim();
    if(["1","home","home win","п1","победа 1","хозяева"].includes(s)) return "HOME";
    if(["x","draw","tie","ничья"].includes(s)) return "DRAW";
    if(["2","away","away win","п2","победа 2","гости"].includes(s)) return "AWAY";
    return null;
  }
  function bookmaker(v) {
    const s=String(typeof v==="object"?(v.name||v.title||v.slug||""):v||"").toLowerCase();
    if(/fonbet|фонбет/.test(s)) return "Fonbet";
    if(/winline|винлайн/.test(s)) return "Winline";
    return null;
  }
  function collectRows(payload) {
    const rows=[],seen=new Set(),stack=[payload];let visited=0;
    while(stack.length&&visited<12000){
      const x=stack.pop();visited++;
      if(!x||typeof x!=="object")continue;
      if(Array.isArray(x)){for(let i=x.length-1;i>=0;i--)stack.push(x[i]);continue;}
      const book=bookmaker(first(x,["bookmaker","bookmaker_name","book","bookie","source"]));
      const market=canonicalMarket(first(x,["market","market_name","marketName","name"]));
      const period=String(first(x,["period","period_name","time_period"])||"UNSPECIFIED").toUpperCase();
      const allowedPeriod=["UNSPECIFIED","FULL_TIME","FT","MATCH"].includes(period);
      const outcome=canonicalOutcome(first(x,["outcome","selection","outcome_name","selection_name","factor_name"]));
      const odd=decimal(first(x,["odds","odd","coefficient","coefficient_value","value","price"]));
      if(book&&market&&outcome&&odd&&allowedPeriod){
        const id=[book,market,period,outcome,odd].join("|");
        if(!seen.has(id)){seen.add(id);rows.push({book,market:market+"|"+period,outcome,odd,active:x.is_active!==false&&x.active!==false&&x.suspended!==true&&!/suspend|closed|removed|unavailable|приостанов|закрыт/i.test(String(x.status||x.state||""))});}
      }
      for(const [k,v] of Object.entries(x)){
        if(v&&typeof v==="object") stack.push(v);
      }
    }
    return rows;
  }
  function findArbitrage(payload,minRoi=0) {
    const rows=collectRows(payload).filter(x=>x.active);
    const groups=new Map();
    for(const r of rows){const k=r.market;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
    const found=[];
    for(const [market,list] of groups){
      const required=market.startsWith("FT_1X2")?["HOME","DRAW","AWAY"]:["HOME","AWAY"];
      const best=required.map(outcome=>{
        const options=list.filter(x=>x.outcome===outcome).sort((a,b)=>b.odd-a.odd);
        return options[0]||null;
      });
      if(best.some(x=>!x)||new Set(best.map(x=>x.book)).size<2)continue;
      const inverse=best.reduce((s,x)=>s+1/x.odd,0),roi=(1/inverse-1)*100;
      if(roi>minRoi)found.push({market,legs:best,roi,inverse});
    }
    return {rows,arbitrage:found};
  }
  function freshness(iso,now=Date.now(),warnMinutes=35,staleMinutes=45){
    const t=timeMs(iso);if(t==null)return {state:"unknown",ageMinutes:null};
    const age=Math.max(0,(now-t)/60000);
    return {state:age>=staleMinutes?"stale":age>=warnMinutes?"warning":"fresh",ageMinutes:Math.round(age)};
  }
  root.ArbEngine={cleanName,eventKey,matchEvent,sameEvent,collectRows,findArbitrage,freshness};
})(typeof window!=="undefined"?window:globalThis);
