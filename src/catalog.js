(function (global) {
'use strict';
const P=global.DispatchPlanner;
const PRODUCTS=[
 ['Wireless Earbuds','Electronics',2499],['Cotton T-Shirt','Fashion',899],['Smartphone Case','Electronics',599],['Running Shoes','Fashion',2999],
 ['Yoga Mat','Sports',1299],['Stainless Water Bottle','Home',749],['Laptop Backpack','Accessories',1899],['Bluetooth Speaker','Electronics',3499],
 ['Kids Building Blocks','Toys',999],['Light-Emitting Diode Desk Lamp','Home',1599],['Face Moisturizer','Beauty',699],['Kitchen Storage Set','Home',1199],
 ['Phone Charging Cable','Electronics',349],['Sports Watch','Accessories',2299],['Bed Sheet Set','Home',1699],['Coffee Mug Set','Home',799]
];
const CITIES=P.ROUTES.flatMap(r=>r.stops.map(([city])=>city));
function seed(today=P.todayString()) {
 const basic=P.makeSample(today); const channels=['Web Store','Marketplace','Mobile Application'];
 const active=basic.map((o,i)=>{
   const [product,category,price]=PRODUCTS[(i*5+3)%PRODUCTS.length];
   const fulfillmentStatus= i<3?'packed':i%4===0?'processing':i%4===1?'placed':'packed';
   return {...o, product,category,amount:price*Math.max(1,Math.round(o.units/20)),
    orderType:['Standard Order','Express Order','Bulk Order','Replacement Order'][i%4], fulfillmentStatus,
    channel:channels[i%channels.length],source:'Illustrative seed',receivedAt:new Date(Date.now()-i*3600000).toISOString()};
 });
 // Historical sample records demonstrate actual fulfillment stages. These are not
 // outstanding dispatch requests and must NOT be added to future trip optimization.
 const historyTypes=['dispatched','in_transit','delivered','returned','cancelled'];
 const historyDest=['Delhi','Hyderabad','Patna','Jaipur','Bengaluru'];
 const history=historyTypes.map((fulfillmentStatus,i)=>{
   const [product,category,price]=PRODUCTS[(i+7)%PRODUCTS.length];
   const destination=historyDest[i];
   const d=Math.min(...P.ROUTES.flatMap(r=>r.stops.filter(s=>s[0]===destination).map(s=>s[1])));
   return {id:`HISTORY-${String(i+1).padStart(3,'0')}`,destination,units:[90,170,85,120,75][i],
     bid:P.addDays(today,[-1,-2,-4,-8,0][i]+d),product,category,amount:price*3,
     orderType:['Standard Order','Express Order','Bulk Order','Replacement Order','Standard Order'][i],
     fulfillmentStatus,cancelled:fulfillmentStatus==='cancelled',
     shippedAt:i<4?new Date(Date.now()-[1,2,4,8][i]*86400000).toISOString():undefined,
     deliveredAt:i===2?new Date(Date.now()-86400000).toISOString():i===3?new Date(Date.now()-3*86400000).toISOString():undefined,
     returnedAt:i===3?new Date(Date.now()-86400000).toISOString():undefined,
     channel:'Marketplace',source:'Illustrative historical order (not live fulfillment)',
     receivedAt:new Date(Date.now()-(i+6)*86400000).toISOString()};
 });
 return active.concat(history);
}
function simulateOrder(existing,today=P.todayString(),productOverride=null) {
 const n=existing.length+1, city=CITIES[(n*7+Math.floor(Math.random()*CITIES.length))%CITIES.length];
 const stops=P.ROUTES.flatMap(r=>r.stops.filter(s=>s[0]===city));
 const minDays=Math.min(...stops.map(x=>x[1]));
 const [product,category,price]=productOverride||PRODUCTS[Math.floor(Math.random()*PRODUCTS.length)];
 const units=[20,25,30,35,40,45,50,60,75,80,90,100,110][Math.floor(Math.random()*13)];
 return {id:'EC-'+Date.now().toString(36).toUpperCase()+'-'+Math.floor(Math.random()*999).toString().padStart(3,'0'),
  destination:city,units,bid:P.addDays(today,minDays+Math.floor(Math.random()*4)),
  product,category,amount:price*Math.max(1,Math.round(units/20)),channel:'Live Simulator',
  source:'Simulated event',receivedAt:new Date().toISOString()};
}
function fromCart(cart, idx, today=P.todayString()) {
 const dest=CITIES[(idx*7+3)%CITIES.length];
 const minDay=Math.min(...P.ROUTES.flatMap(r=>r.stops.filter(s=>s[0]===dest).map(s=>s[1])));
 const first=cart.products?.[0]||{};
 const totalQty=Number(cart.totalQuantity)||1;
 // Demo mapping: cart quantity is NOT actual physical weight or volume.
 const units=Math.min(150,Math.max(10,totalQty*12));
 return {id:`DJ-CART-${cart.id}`,destination:dest,units,bid:P.addDays(today,minDay+(idx%4)),
  product:first.title||`Cart #${cart.id}`,category:'Mixed cart',amount:Math.round((Number(cart.discountedTotal)||Number(cart.total)||0)*84),
  channel:'DummyJSON sample dataset',orderType:'Standard Order',fulfillmentStatus:'placed',source:'Public sample cart (mapped to hypothetical India dispatch)',receivedAt:new Date().toISOString()};
}
function csvEscape(value) {const s=String(value??'');return /[\n\r,\"]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
const CSV_FIELDS=['id','destination','units','bid','product','category','amount','orderType','fulfillmentStatus','channel','source','receivedAt'];
function toCSV(orders) {return [CSV_FIELDS.join(','),...orders.map(o=>CSV_FIELDS.map(k=>csvEscape(o[k])).join(','))].join('\r\n');}
function parseCSV(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(cell);cell='';}else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}
 if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);} if(!rows.length)return [];
 const fields=rows.shift().map(v=>v.trim().replace(/^\uFEFF/,''));
 return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(fields.map((k,i)=>[k,(r[i]||'').trim()]))).map(o=>({...o,units:Number(o.units),amount:Number(o.amount)||0}));
}
const API={PRODUCTS,CITIES,seed,simulateOrder,fromCart,toCSV,parseCSV};
if(typeof module!=='undefined'&&module.exports)module.exports=API;
global.DispatchData=API;
})(typeof window!=='undefined'?window:globalThis);
