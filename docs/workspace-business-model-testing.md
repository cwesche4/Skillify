# Workspace Business Model Testing

Use this note to manually verify the onboarding and CRM routing foundation.

## Fresh onboarding state

Create a new Clerk user or remove the local test user's `WorkspaceMember`,
`Workspace`, and `OnboardingProgress` rows in a local database only. Do not add a
production-facing reset button.

## Database fields to inspect

Check the selected workspace row:

- `businessModel`
- `opportunitiesEnabled`
- `commerceEnabled`
- `defaultLeadDestination`
- `allowDirectLeadToSale`
- `customerSingularLabel`
- `customerPluralLabel`
- `salesLabel`

## Expected navigation

- Consultative Sales: Leads, Opportunities, Sales Pipeline, Clients.
- Direct Sales and Services: Leads, Sales Pipeline, Clients. Opportunities is
  hidden from normal navigation.
- Product and Commerce: Customers, Orders, Fulfillment foundation links.
  Opportunities is hidden by default.

Hidden modules are not deleted. Deep links should continue to resolve where the
underlying route already exists.

## Expected lead conversion

- Consultative Sales defaults Lead conversion to Opportunity.
- Direct Sales and Services defaults Lead conversion to Sale.
- Product and Commerce defaults manually entered lead inquiries to Customer.
- Opportunities-disabled workspaces must not create new Opportunity records from
  default lead conversion.

## Change or reset a workspace layout

Go to Settings -> Sales Process. Owners and admins can choose a layout, toggle
Opportunities, and adjust customer/sales labels. Changing a layout updates
defaults only; it does not migrate or delete existing CRM records.

## Product and Commerce placeholders

This phase only establishes Customers, Orders, and Fulfillment as workspace
capabilities/navigation foundation. It does not add product catalog, checkout,
inventory, shipping, refunds, subscription billing, or commerce analytics.
