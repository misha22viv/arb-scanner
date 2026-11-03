/* Winline adapter contract.
 * No network requests are made here. Supply only data from a source/feed whose use is authorized.
 */
(function(root){
"use strict";
function rows(payload){
 if(Array.isArray(payload))return payload;
 for(const key of ["odds","outcomes","selections","prices","data","items"])if(Array.isArray(payload?.[key]))return payload[key];
 return [];
}
function normalizeEvent(payload){return root.ArbCore.normalizeEvent(payload,"Winline");}
function normalizeOdds(payload){return root.ArbCore.normalizeOddsRows(rows(payload),"Winline").map(x=>({...x,provider:"Winline"}));}
function inspect(){return {provider:"Winline",connected:false,mode:"authorized_feed_adapter",reason:"No authorized public feed configured; no site polling or protection bypass is performed."};}
root.WinlineAdapter={normalizeEvent,normalizeOdds,inspect};
})(typeof window!=="undefined"?window:globalThis);
