(function (global) {
  'use strict';
  // Fulfillment is an observed or manually recorded operation, NOT an optimizer prediction.
  const PHASES = [
    {id:'placed', label:'Order Placed', tone:'gray'},
    {id:'processing', label:'Processing', tone:'blue'},
    {id:'packed', label:'Packed and Ready', tone:'teal'},
    {id:'dispatched', label:'Dispatched', tone:'purple'},
    {id:'in_transit', label:'In Transit', tone:'blue'},
    {id:'delivered', label:'Delivered', tone:'green'},
    {id:'returned', label:'Returned', tone:'orange'},
    {id:'cancelled', label:'Cancelled', tone:'gray'}
  ];
  const TYPES = ['Standard Order', 'Express Order', 'Bulk Order', 'Replacement Order'];
  const NEXT = {placed:'processing',processing:'packed',dispatched:'in_transit',in_transit:'delivered',delivered:'returned'};
  function getStatus(order){
    if(order.cancelled || order.fulfillmentStatus==='cancelled') return 'cancelled';
    const status=order.fulfillmentStatus||'placed';
    return PHASES.some(p=>p.id===status)?status:'placed';
  }
  function getLabel(value){return PHASES.find(p=>p.id===value)?.label||'Order Placed';}
  function getTone(value){return PHASES.find(p=>p.id===value)?.tone||'gray';}
  function isPlannable(order){return ['placed','processing','packed'].includes(getStatus(order));}
  function isCancellable(order){return isPlannable(order);}
  function next(order){return NEXT[getStatus(order)]||null;}
  const API={PHASES,TYPES,NEXT,getStatus,getLabel,getTone,isPlannable,isCancellable,next};
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
  global.DispatchLifecycle=API;
})(typeof window!=='undefined'?window:globalThis);
