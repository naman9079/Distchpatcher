# Dispatch Intelligence — Logistics Operations Demonstration

A self-contained, plain-language logistics planning demonstration for one warehouse in Guwahati, three predefined road corridors, customer-requested **Booking End Dates**, and a limited fleet of different-capacity vehicles. Every *scheduled* vehicle must be between **80% and 100% loaded**. Unschedulable orders are reported as exceptions, not silently dispatched.

**GitHub edition:** This repository contains the standalone browser demo, its editable frontend source, a Python rebuild script, and a focused Node.js planner test. The optional local ingestion server, sample CSV files, and full browser/server test suite are available in the separate project ZIP shared in the conversation, but are not in this GitHub repository. The HTML demo runs without them.

## Order fulfillment and order types

**A planned departure is not a completed dispatch.** The Orders view now has two separate columns:

- **Order status** is the recorded fulfillment stage: **Order Placed**, **Processing**, **Packed and Ready**, **Dispatched**, **In Transit**, **Delivered**, **Returned**, or **Cancelled**.
- **Dispatch plan** is the optimization result for future shipments: **Dispatch planned**, **Awaiting consolidation**, **Needs scheduling review**, or **Not in future dispatch plan**.

The demonstration starts with **20 sample orders** (15 awaiting fulfillment and five illustrative historical/closed records). All eight fulfillment stages appear in the dashboard. Product categories and **order types** (Standard Order, Express Order, Bulk Order, Replacement Order) can be inspected and filtered in Orders. Order types are labels for demonstration, not different paid delivery service guarantees.

Under **Order Fulfillment**, users can view a record of each stage and any truck departures recorded in the current session. Operational buttons move orders through `Order Placed → Processing → Packed and Ready`. Once **all orders assigned to a truck are packed**, and its departure date has arrived, use **Mark truck dispatched** in Dispatch Planning. The planner verifies that the entire truck meets **80%–100% loading** and then moves all manifest orders to Dispatched simultaneously. Each order can then move to In Transit, Delivered, and Returned. Delivered/returned orders cannot be cancelled as though they were unshipped. The recorded truck cannot be assigned to another trip until its return date.

**Boundaries:** The lifecycle actions are manually simulated operational events; there is no live courier tracking. Historical example shipments without a recorded truck/return ID do not consume active fleet capacity. New Order imports default to Order Placed unless they carry a valid fulfillment stage. Data remains local in the browser; use Export Orders to save it.

## Run the demonstration

- Open `index.html` in a modern desktop browser. The embedded frontend and sample order data work without an internet connection.
- If you want to serve the included HTML locally, run `python -m http.server 8000` and open `http://localhost:8000`. The optional order-ingestion Python server from the separate project ZIP is not included in this GitHub edition.
- Use the **Delivery Promise** tab for the central customer-facing example. Choose **Bhopal** and **40 load units**, then select **Find available delivery dates**. The example should offer a feasible date nine days after today. Select that date and click **Confirm and record capacity reservation**. The initially isolated 40-unit Bhopal shipment and the new 40-unit booking can share a 100-unit small vehicle at exactly 80% loading.
- Under **Fleet Management**, reduce or restore the truck counts to see how availability changes feasibility. Under **Exceptions**, review unscheduled orders and management-review requests.

## Customer-promise audit

| Requirement | Demonstration behavior | Important limitation |
|---|---|---|
| Check available trucks and existing orders before accepting a date | **Implemented.** The checker replans with the prospective order and rejects it if an existing feasible dispatch would become infeasible. | Only the Delivery Promise workflow applies this check. Ordinary incoming orders may already have been accepted by a merchant. |
| Only show delivery dates that can be met | **Implemented.** The Find available delivery dates button tests the next **21 days** and displays only currently feasible choices, with a vehicle, loading percentage, and illustrative change in cost. | Feasibility relies on assumed transit times, vehicle availability, and a single local planning state. Suggested dates can change. |
| Reserve truck space after confirming | **Partially implemented.** Confirmation rechecks feasibility and records the planned vehicle, route, departure date, and percentage load alongside the booking. Previously confirmed orders are prioritized, and changes that put them at risk trigger a visible warning. | A **true, durable reservation** across multiple customers and concurrent devices needs a shared database, transaction locks, dispatch-plan versioning, and production scheduling. The demonstration's reservation is a local planning record, not a distributed hard lock. |
| Combine compatible orders or use a smaller truck | **Implemented.** Orders with compatible route/departure timing may be consolidated; the planner chooses among small, medium and large vehicles that meet 80–100% utilization. | The planner is a bounded heuristic, not a globally optimal commercial transport solver. |
| Handle orders that still cannot achieve 80% utilization | **Implemented.** The date is rejected; a **Request management review** button records the reason in the Exceptions section. An operator can mark the request reviewed, but the 80% rule is never silently bypassed. | There is no automatic purchase of external capacity or managerial exception approval. Those need a business policy. |
| Keep transport costs under control | **Implemented as an illustrative estimate.** Trip costs are compared in the planner and each feasible suggested date shows a cost change. | Costs are simulated. Profitability and global minimum costs cannot be guaranteed without real tariffs, taxes, tolls, staffing, and service penalties. |

## What is working

All ten sections are functional: Overview, Orders, Order Fulfillment, Dispatch Planning, Delivery Promise, Fleet Management, Route Network, Order Data Sources, Analytics, and Exceptions. Order creation/cancellation/restoration, lifecycle status filters, recorded truck dispatches, fleet return-time locks, fleet changes, route editing, document exports, Comma-Separated Values import, demo order arrivals, and sample cart import are covered by browser interaction tests.

There are three vehicle sizes in the sample: **small 100, medium 200, and large 400 normalized load units**. The unit represents assumed cargo utilization, not verified kilograms or cubic meters. The three configured corridors share some stops; travel times, round-trip durations, and costs are illustrative.

**Booking End Date** is used as the *exact required arrival date* in this project. If your organization means "delivery on or before the date," the scheduling rule must change.

## Online and near-real-time data

- **Built-in orders and simulator:** Representative e-commerce records created for the demonstration; **not live Amazon orders**.
- **Public sample carts:** `https://dummyjson.com/carts?limit=30` provides mock cart/product data. The app fetches real responses from that public example service, when internet is available, and imports only previously unseen cart identifiers. Indian destination, Booking End Date, and load fields are assigned by the demonstration, not supplied by the service. Repeated polling usually adds zero new records because the sample service is static.
- **Incoming order Application Programming Interface:** This requires the optional Python server from the separate project ZIP; it is not active in the GitHub standalone edition. That server accepts authenticated incoming orders, but **does not automatically guarantee their customer delivery dates**. A real store needs an authoritative reservation transaction before accepting bookings.
- **Amazon:** No real customer order data or merchant credentials are included. Amazon seller order integrations require authorized access and merchant approval.

## Repository files

```text
index.html              Standalone, browser-ready demonstration
src/template.html       Page structure used for rebuilds
src/styles.css          Dashboard styling
src/planner.js          Scheduling and vehicle assignment logic
src/catalog.js          Example orders and imports
src/lifecycle.js        Order statuses and transitions
src/app.js              Interface interactions and browser data feeds
build.py                Rebuild standalone index.html
tests/test_planner.js   Booking, loading and lifecycle checks
```

To rebuild after editing the frontend sources: `python build.py`.

Run the included automated check with `node tests/test_planner.js` (Node.js 18 or later). The broader Python/browser/API test suite and optional server are in the separately provided source ZIP, not this GitHub repository.

## Production-readiness boundaries

This is a **single-user, local, illustrative proof of concept**, not a live commerce booking gateway. Avoid presenting its simulated bookings as irrevocable customer guarantees. Production implementation should use centralized order and fleet storage, transaction-safe inventory/capacity holds, a fast optimizer, event-driven updates, cancellation/retry policies, customer notification, payment and returns handling, monitoring, and measured service levels. If no truck can satisfy all three rules (on-time arrival, finite available fleet, and at least 80% fill), the business must either present a different achievable date or authorize a clearly defined exception. The application cannot guarantee all three simultaneously for arbitrary demand.

### Fleet controls visibility fix
The Fleet Management page uses larger 38 × 38 pixel increase and decrease buttons with dark, high-contrast symbols, visible focus indicators, and descriptive accessibility labels. A decrease button is disabled when removing a vehicle would contradict current dispatched-trip reservations. The increase button is disabled at the demo's 20-vehicle-per-type limit. Run `python tests/test_fleet_controls.py` to check button appearance and behavior.