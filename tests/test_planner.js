const assert = require('node:assert/strict');
const P = require('../src/planner.js');
const L = require('../src/lifecycle.js');
const D = require('../src/catalog.js');

const today = '2026-11-19';
const fleet = {Small: 3, Medium: 3, Large: 1};
const orders = P.makeSample(today);
const plan = P.plan(orders, fleet, today);

assert.equal(orders.length, 15);
assert.equal(plan.scheduledOrders, 14);
assert(plan.schedules.every(trip => trip.utilization >= 80 && trip.utilization <= 100));
for (const trip of plan.schedules) {
  const route = P.getRoute(trip.routeId);
  for (const order of trip.orders) {
    const stop = route.stops.find(([city]) => city === order.destination);
    assert.equal(P.addDays(trip.depart, stop[1]), order.bid);
  }
}
const accepted = P.evaluateBooking(orders, fleet, {
  id: 'BOOKING-001', destination: 'Bhopal', units: 40, bid: P.addDays(today, 9)
}, today);
assert(accepted.accepted, 'Compatible order should meet the 80% loading rule');
const denied = P.evaluateBooking(orders, fleet, {
  id: 'BOOKING-002', destination: 'Bhopal', units: 10, bid: P.addDays(today, 9)
}, today);
assert(!denied.accepted, 'Infeasible booking should not be promised');
const seed = D.seed(today);
assert.equal(seed.length, 20);
assert.equal(seed.filter(L.isPlannable).length, 15);
console.log('PASS: bookings, exact requested dates, vehicle utilization, and order lifecycle.');
