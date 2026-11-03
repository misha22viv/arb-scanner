/* Local-only odds history and browser notifications. No server storage or betting actions. */
(function(root){
"use strict";
const KEY="arb-scanner-history-v1",MAX=500;
function read(){try{const x=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(x)?x:[];}catch(_){return [];}}
function write(rows){try{localStorage.setItem(KEY,JSON.stringify(rows.slice(-MAX)));return true;}catch(_){return false;}}
function fingerprint(x){return [x.eventKey,x.market,x.outcome,x.book].join("|");}
function record(snapshot){
 const rows=read(),prior=rows.slice().reverse().find(x=>x.eventKey===snapshot.eventKey)||null,changes=[];
 const previous=new Map((prior?.quotes||[]).map(q=>[fingerprint(q),q]));
 for(const q of snapshot.quotes||[]){const old=previous.get(fingerprint(q));if(!old)changes.push({type:"new",quote:q});else if(old.odd!==q.odd)changes.push({type:"changed",before:old.odd,quote:q});}
 const item={id:Date.now()+"-"+Math.random().toString(36).slice(2,7),at:new Date().toISOString(),eventKey:snapshot.eventKey||"unknown",quotes:snapshot.quotes||[],changes};
 rows.push(item);const saved=write(rows);return {item,changes,saved,count:Math.min(rows.length,MAX)};
}
function list(limit=100){return read().slice(-limit).reverse();}
function clear(){try{localStorage.removeItem(KEY);return true;}catch(_){return false;}}
async function enableNotifications(){if(!("Notification" in root))return "unsupported";if(Notification.permission==="granted")return "granted";if(Notification.permission==="denied")return "denied";return await Notification.requestPermission();}
function notify(title,body){if("Notification" in root&&Notification.permission==="granted"&&!document.hidden)new Notification(title,{body});}
root.ArbHistory={record,list,clear,enableNotifications,notify};
})(typeof window!=="undefined"?window:globalThis);
