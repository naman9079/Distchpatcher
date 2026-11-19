(function (global) {
  'use strict';

  const ROUTES = [
    { id: 'north', name: 'Punjab Corridor', color: '#4f76e8', short: 'North', factor: 1.10, roundTripDays: 16, stops: [
      ['Patna',2], ['Prayagraj',3], ['Lucknow',4], ['Jaipur',5], ['Delhi',6], ['Chandigarh',7]
    ]},
    { id: 'central', name: 'Madhya Pradesh Corridor', color: '#b77b39', short: 'Central', factor: 0.93, roundTripDays: 12, stops: [
      ['Patna',2], ['Prayagraj',3], ['Bhopal',5]
    ]},
    { id: 'south', name: 'Bengaluru Corridor', color: '#12a78a', short: 'South', factor: 1.28, roundTripDays: 16, stops: [
      ['Kolkata',1], ['Bhubaneswar',2], ['Hyderabad',5], ['Bengaluru',7]
    ]}
  ];
  const TYPES = [
    {type:'Small', capacity:100, cost:9000},
    {type:'Medium', capacity:200, cost:15000},
    {type:'Large', capacity:400, cost:26000}
  ];

  function dayNumber(s) {
    const parts = String(s).split('-').map(Number);
    if (parts.length !== 3 || parts.some(x=>!Number.isInteger(x))) return NaN;
    const [year,month,day]=parts;
    if(year<2000 || year>2100 || month<1 || month>12 || day<1 || day>31) return NaN;
    const n=Math.round(Date.UTC(year,month-1,day)/86400000);
    if(dayString(n)!==String(s))return NaN;
    return n;
  }
  function dayString(n) { return new Date(n * 86400000).toISOString().slice(0,10); }
  function addDays(s,n) { return dayString(dayNumber(s)+n); }
  function todayString() {const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function getRoute(id) { return ROUTES.find(r=>r.id===id); }
  function getOptions(order, today) {
    if (!order || !Number.isInteger(Number(order.units)) || Number(order.units) <= 0) return [];
    const bid=dayNumber(order.bid);
    if (!Number.isFinite(bid)) return [];
    return ROUTES.flatMap(route => {
      const stop=route.stops.find(([city])=>city === order.destination);
      if (!stop) return [];
      const depart=bid-stop[1];
      if (depart < dayNumber(today)) return [];
      return [{routeId:route.id, depart, transit:stop[1]}];
    });
  }
  function createFleet(counts, busyTrips=[]) {
    const fleet=[];
    for (const type of TYPES) {
      const count = Math.max(0,Math.min(20,Math.floor(Number(counts[type.type])||0)));
      for(let i=1;i<=count;i++) fleet.push({id:`${type.type[0]}-${String(i).padStart(2,'0')}`,type:type.type,capacity:type.capacity,cost:type.cost, nextAvailable:-Infinity});
    }
    // Already-departed trucks remain unavailable until their recorded return date.
    // Busy trips are stored independently from future planning results.
    for(const truck of fleet){
      const until=busyTrips.filter(x=>x.truckId===truck.id).map(x=>dayNumber(x.returnDate)).filter(Number.isFinite);
      if(until.length)truck.nextAvailable=Math.max(truck.nextAvailable,...until);
    }
    return fleet;
  }
  function bestPacks(orders, available, route) {
    const n=orders.length;
    if (!n || !available.length) return [];
    if(n>12) return greedyPacks(orders,available,route);
    const limit=1<<n;
    const sums=new Float64Array(limit);
    const counts=new Uint8Array(limit);
    const committed=new Uint8Array(limit);
    for(let m=1;m<limit;m++) {
      const bit=m&-m, idx=31-Math.clz32(bit), prev=m^bit;
      sums[m]=sums[prev]+Number(orders[idx].units);
      counts[m]=counts[prev]+1;
      committed[m]=committed[prev]+(orders[idx].confirmedBooking?1:0);
    }
    const byCapacity=new Map();
    for(const truck of available){
      if(byCapacity.has(truck.capacity)) continue;
      const candidates=[];
      for(let m=1;m<limit;m++) {
        if(sums[m]>=0.8*truck.capacity-0.00001 && sums[m]<=truck.capacity+0.00001){
          candidates.push(m);
        }
      }
      byCapacity.set(truck.capacity,candidates);
    }
    // Dynamic programming over already-assigned order subsets; an individual truck
    // may be used at most once. Each chosen manifest must meet [80%, 100%].
    let states=new Map([[0,{cost:0, assignments:[],tripCount:0}]]);
    for(const truck of available){
      const next=new Map(states);
      const tripCost=Math.round(truck.cost*route.factor);
      for(const [mask,state] of states){
        for(const sub of byCapacity.get(truck.capacity)){
          if(mask & sub) continue;
          const combined=mask|sub;
          const cost=state.cost+tripCost;
          const existing=next.get(combined);
          if(!existing || cost<existing.cost || (cost===existing.cost && state.tripCount+1<existing.tripCount)){
            next.set(combined,{cost,tripCount:state.tripCount+1,assignments:state.assignments.concat([{truck,mask:sub,units:sums[sub],tripCost}])});
          }
        }
      }
      states=next;
    }
    let bestMask=0, best=states.get(0);
    for(const [mask,state] of states){
      const better=committed[mask]>committed[bestMask] ||
        (committed[mask]===committed[bestMask] && counts[mask]>counts[bestMask]) ||
        (committed[mask]===committed[bestMask] && counts[mask]===counts[bestMask] && sums[mask]>sums[bestMask]) ||
        (committed[mask]===committed[bestMask] && counts[mask]===counts[bestMask] && sums[mask]===sums[bestMask] && state.cost<best.cost) ||
        (committed[mask]===committed[bestMask] && counts[mask]===counts[bestMask] && sums[mask]===sums[bestMask] && state.cost===best.cost && state.tripCount<best.tripCount);
      if(better){bestMask=mask;best=state;}
    }
    return best.assignments.map(a=>({...a, orders:orders.filter((_,i)=>a.mask & (1<<i))}));
  }
  function greedyPacks(orders,available,route){
    // Clearly labelled fallback for larger groups; demo is not a global optimizer.
    const remaining=orders.slice().sort((a,b)=>(Number(!!b.confirmedBooking)-Number(!!a.confirmedBooking))||b.units-a.units);
    const result=[];
    for(const truck of available.slice().sort((a,b)=>a.capacity-b.capacity)){
      const picks=[];
      let sum=0;
      for(const order of remaining){
        if(sum+order.units<=truck.capacity){picks.push(order);sum+=order.units;}
      }
      if(sum>=0.8*truck.capacity){
        result.push({truck,orders:picks,units:sum,tripCost:Math.round(truck.cost*route.factor)});
        for(const o of picks)remaining.splice(remaining.findIndex(x=>x.id===o.id),1);
      }
    }
    return result;
  }
  function failureReason(order, option, groups, schedules, fleet, today){
    if(!option) return 'No feasible departure before the requested Booking End Date, or unsupported destination';
    const group=groups.find(g=>g.key===`${option.depart}_${option.routeId}`);
    if(!group) return 'No matching dispatch group';
    const route=getRoute(option.routeId);
    const total=group.orders.reduce((s,x)=>s+Number(x.units),0);
    const minCap=Math.min(...TYPES.map(x=>x.capacity));
    if(Number(order.units)>Math.max(...TYPES.map(x=>x.capacity))) return 'Order exceeds every individual truck capacity (splitting is not enabled)';
    if(total<0.8*minCap) return `Only ${total} load units are available for this dispatch; minimum is ${0.8*minCap} for a Small truck`;
    const available=fleet.filter(t=>t.nextAvailable<=option.depart);
    if(!available.length) return 'No available vehicles; trucks are already assigned to other trips';
    if(total > available.reduce((s,t)=>s+t.capacity,0)) return 'Insufficient remaining fleet capacity for this dispatch';
    return 'No vehicle combination can satisfy the 80–100% fill rule and existing assignments';
  }
  function computeSchedule(orders, choices, counts, today, busyTrips=[]){
    const fleet=createFleet(counts,busyTrips);
    const todayDay=dayNumber(today);
    const groupsMap=new Map();
    for(const order of orders){
      const opt=choices.get(order.id);
      if(!opt) continue;
      const key=`${opt.depart}_${opt.routeId}`;
      if(!groupsMap.has(key)) groupsMap.set(key,{key,depart:opt.depart,routeId:opt.routeId,orders:[]});
      groupsMap.get(key).orders.push(order);
    }
    const groups=[...groupsMap.values()].sort((a,b)=>
       a.depart-b.depart || b.orders.filter(x=>x.confirmedBooking).length-a.orders.filter(x=>x.confirmedBooking).length || b.orders.reduce((s,x)=>s+Number(x.units),0)-a.orders.reduce((s,x)=>s+Number(x.units),0)
    );
    const schedules=[];
    const scheduledIds=new Set();
    for(const group of groups){
      const route=getRoute(group.routeId);
      const eligibleFleet=fleet.filter(t=>t.nextAvailable<=group.depart);
      const assigned=bestPacks(group.orders,eligibleFleet,route);
      for(const pack of assigned){
        pack.truck.nextAvailable=group.depart+route.roundTripDays;
        pack.orders.forEach(x=>scheduledIds.add(x.id));
        schedules.push({
          id:`T${String(schedules.length+1).padStart(2,'0')}`,
          truckId:pack.truck.id, truckType:pack.truck.type,capacity:pack.truck.capacity,
          units:pack.units,utilization:Math.round(pack.units/pack.truck.capacity*100),
          tripCost:pack.tripCost, routeId:route.id, routeName:route.name,
          depart:dayString(group.depart), returnDate:dayString(pack.truck.nextAvailable),
          orders:pack.orders.map(o=>({id:o.id,destination:o.destination,units:Number(o.units),bid:o.bid}))
        });
      }
    }
    const unscheduled=orders.filter(o=>!scheduledIds.has(o.id)).map(o=>({
      ...o,reason:failureReason(o,choices.get(o.id),groups,schedules,fleet,today)
    }));
    const cost=schedules.reduce((sum,t)=>sum+t.tripCost,0);
    const deliveredUnits=schedules.reduce((sum,t)=>sum+t.units,0);
    const totalUnits=orders.reduce((sum,o)=>sum+Number(o.units||0),0);
    const overallUtil=schedules.length?
      Math.round(schedules.reduce((sum,t)=>sum+t.units,0)/schedules.reduce((sum,t)=>sum+t.capacity,0)*100):0;
    return {schedules,unscheduled,scheduledIds,cost,deliveredUnits,totalUnits,overallUtil,groups,firstDay:todayDay};
  }
  function plan(orders,counts,today=todayString(),busyTrips=[]){
    const valid=orders.filter(o=>o&&o.id&&o.destination&&o.bid&&Number.isFinite(Number(o.units))&&Number(o.units)>0);
    const options=new Map(valid.map(o=>[o.id,getOptions(o,today)]));
    const choices=new Map(valid.map(o=>[o.id,(options.get(o.id)||[])[0]||null]));
    let best=computeSchedule(valid,choices,counts,today,busyTrips);
    const score=x=>({committed:valid.filter(o=>o.confirmedBooking&&x.scheduledIds.has(o.id)).length,n:x.scheduledIds.size,units:x.deliveredUnits,cost:x.cost});
    function isBetter(a,b){
      const x=score(a), y=score(b);
      return x.committed>y.committed || x.committed===y.committed&&(x.n>y.n || x.n===y.n&&(x.units>y.units || x.units===y.units&&x.cost<y.cost));
    }
    const flexible=valid.filter(o=>options.get(o.id).length>1).sort((a,b)=>Number(b.units)-Number(a.units));
    // Exhaustive route combinations for a small interactive demo; this handles
    // coupled choices where swapping only one shared-stop order is insufficient.
    if(flexible.length<=10) {
      // Store the winning choice assignment independently from the mutable map.
      let bestChoices=new Map(choices);
      const previousIsBetter=isBetter;
      function enumerateWithChoices(i) {
        if(i===flexible.length){
          const candidate=computeSchedule(valid,choices,counts,today,busyTrips);
          if(previousIsBetter(candidate,best)){
            best=candidate;
            bestChoices=new Map(choices);
          }
          return;
        }
        const o=flexible[i];
        for(const opt of options.get(o.id)){
          choices.set(o.id,opt);
          enumerateWithChoices(i+1);
        }
      }
      enumerateWithChoices(0);
      choices.clear();
      for(const [id,choice] of bestChoices)choices.set(id,choice);
    }else{
      // For larger instances, keep route choice search bounded; no global-optimality claim.
      for(let pass=0;pass<3;pass++) {
        let improved=false;
        for(const order of flexible){
          let chosen=choices.get(order.id);
          for(const choice of options.get(order.id)){
            choices.set(order.id,choice);
            const candidate=computeSchedule(valid,choices,counts,today,busyTrips);
            if(isBetter(candidate,best)){
              best=candidate;chosen=choice;improved=true;
            }
          }
          choices.set(order.id,chosen);
        }
        if(!improved)break;
      }
    }
    const detail=new Map();
    best.schedules.forEach(s=>s.orders.forEach(o=>detail.set(o.id,{status:'scheduled',truckId:s.truckId,routeId:s.routeId,depart:s.depart,tripId:s.id})));
    best.unscheduled.forEach(o=>detail.set(o.id,{status:'at-risk',reason:o.reason,routeId:choices.get(o.id)?.routeId||null,depart:choices.get(o.id)?dayString(choices.get(o.id).depart):null}));
    return {...best, detail, choices, today, coverage:valid.length?Math.round(best.scheduledIds.size/valid.length*100):100,
       totalOrders:valid.length, scheduledOrders:best.scheduledIds.size};
  }
  function makeSample(today=todayString(),scenario='base'){
    let i=0;
    const orders=[];
    function add(dest,units,days,ref='Retail') {
      orders.push({id:`ORD-${String(++i).padStart(3,'0')}`,destination:dest,units,bid:addDays(today,days),reference:ref});
    }
    add('Delhi',35,6); add('Chandigarh',45,7); add('Lucknow',10,4);
    add('Bhopal',110,5); add('Prayagraj',40,3); add('Patna',25,2);
    add('Bengaluru',90,7); add('Hyderabad',65,5); add('Kolkata',30,1);
    add('Delhi',55,7); add('Jaipur',35,6);
    add('Bengaluru',90,8); add('Bhubaneswar',35,3); add('Hyderabad',50,6);
    add('Bhopal',40,9,'Low demand lane');
    if(scenario==='spike'){
      add('Chandigarh',200,7,'Peak demand'); add('Delhi',180,6,'Peak demand');
      add('Bengaluru',220,7,'Peak demand'); add('Hyderabad',145,5,'Peak demand');
      add('Bhopal',100,5,'Peak demand'); add('Bhopal',75,9,'Peak demand');
      add('Lucknow',90,5,'Peak demand'); add('Delhi',150,7,'Peak demand');
    }
    return orders;
  }
  function evaluateBooking(orders, counts, order, today=todayString(),busyTrips=[]){
    const current=plan(orders,counts,today,busyTrips);
    const next=plan([...orders,order],counts,today,busyTrips);
    const accepted=next.scheduledIds.has(order.id) && [...current.scheduledIds].every(id=>next.scheduledIds.has(id));
    return {accepted,current,next,reason:accepted?'Booking fits a valid 80–100% dispatch without displacing an existing scheduled order':
       next.detail.get(order.id)?.reason||'Booking would displace an existing scheduled order'};
  }
  const API={ROUTES,TYPES,dayNumber,dayString,addDays,todayString,getRoute,getOptions,createFleet,plan,makeSample,evaluateBooking};
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
  global.DispatchPlanner=API;
})(typeof window!=='undefined'?window:globalThis);
