# Product & Commerce Phase 5.1

Phase 5.1 establishes the Product & Commerce operating-system foundation. It does not build the full catalog, order management, fulfillment operations, inventory, subscriptions, or external integrations.

## Lifecycle

The default commerce lifecycle is:

Customer -> Order -> Fulfillment

Commerce workspaces do not use the service CRM lifecycle by default:

Lead -> Opportunity -> Sale -> Client

Commerce CRM lead capture is reserved for a future optional capability.

## Default Modules

Product & Commerce enables these foundation modules:

- Customers
- Products
- Orders
- Fulfillment

Future modules are registry-defined but hidden by default:

- Inventory
- Subscriptions
- Wholesale
- Returns
- Discounts
- Suppliers
- Commerce CRM leads

## Capability Architecture

Workspace capability resolution remains centralized in `getWorkspaceCapabilities()`. Product & Commerce workspaces resolve commerce module flags from the business model and existing workspace configuration rather than scattered raw business-model checks.

The capability model exposes:

- `commerce.commerceEnabled`
- `commerce.customersEnabled`
- `commerce.productsEnabled`
- `commerce.ordersEnabled`
- `commerce.fulfillmentEnabled`
- disabled future capability flags for inventory, subscriptions, wholesale, returns, discounts, suppliers, and commerce CRM

Service workspaces keep existing CRM capabilities and resolve commerce modules as disabled.

## Terminology Architecture

Commerce terminology is centralized in `lib/commerce/commerceRegistry.ts`.

Default terms:

- Customer / Customers
- Product / Products
- Order / Orders
- Fulfillment / Fulfillment
- Inventory
- Subscription / Subscriptions
- Wholesale Account
- Return / Returns

Existing service customer terminology fields remain supported. The legacy Sales label is preserved for service layouts and compatibility, but Orders are represented through canonical commerce terminology.

## Navigation Rules

Product & Commerce sidebar navigation is organized as:

- Overview: Dashboard
- Commerce: Customers, Products, Orders, Fulfillment
- Workflows: Automations, Executions, Templates
- Operations: Tasks, and Service Requests when role/capability allows
- Analytics: Analytics, Reports
- Team: Members
- AI: AI Coach
- Settings: Settings

Product & Commerce hides Leads, Opportunities, Sales Pipeline, and Clients by default.

Consultative Sales and Direct Sales navigation remain service-CRM oriented.

## Route Rules

Commerce foundation routes are capability guarded:

- `/dashboard/[workspaceSlug]/customers`
- `/dashboard/[workspaceSlug]/products`
- `/dashboard/[workspaceSlug]/orders`
- `/dashboard/[workspaceSlug]/fulfillment`

Service workspaces are redirected away from commerce-only routes unless a future capability enables them.

The existing Clients route remains service-client oriented and is hidden/guarded when Product & Commerce disables service Client records.

## Status Domains

Order, Payment, and Fulfillment statuses are separate:

- Order status answers: What is the overall state of the purchase?
- Payment status answers: Has money been authorized, paid, failed, or refunded?
- Fulfillment status answers: Has the merchandise been prepared and delivered?

These are intentionally not collapsed into one field.

## Workspace Isolation

All commerce foundation types and preview storage helpers require workspace identity. Preview storage keys are workspace-scoped and malformed or cross-workspace data returns empty collections safely.

Future commerce records must remain isolated by workspace ID and route slug.

## Foundation Only

Phase 5.1 creates:

- capability flags
- terminology registry
- module registry
- status registries
- route foundations
- foundation pages
- preview/local storage helpers
- automation event names
- analytics metric names
- AI context awareness

It does not create real products, orders, fulfillments, inventory records, external integrations, background jobs, or production commerce execution.

## Roadmap

- 5.1 Commerce navigation, capability registry, and data-model foundation
- 5.2 Product catalog
- 5.3 Orders
- 5.4 Fulfillment
- 5.5 Commerce customer profiles
- 5.6 Inventory and purchasing foundation
- 5.7 Commerce automations and integrations foundation
- 5.8 Commerce dashboard, analytics, and final cross-module review
