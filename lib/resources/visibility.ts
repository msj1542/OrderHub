/**
 * Pure resource-visibility rule for external users. Internal staff always
 * see everything (including inactive/hidden resources) via a separate path
 * in lib/resources/service.ts. Mirrored by the `resources_select_external`
 * RLS policy in supabase/migrations/0006_phase6.sql.
 */

export type ResourceVisibilityInput = {
  isActive:          boolean;
  customerVisible:   boolean;
  pricingRestricted: boolean;
};

export type ExternalViewerVisibilityInput = {
  pricingVisible: boolean;
};

export function canExternalUserSeeResource(
  resource: ResourceVisibilityInput,
  viewer: ExternalViewerVisibilityInput,
): boolean {
  if (!resource.isActive || !resource.customerVisible) return false;
  if (resource.pricingRestricted && !viewer.pricingVisible) return false;
  return true;
}
