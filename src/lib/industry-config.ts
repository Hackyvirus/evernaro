import { prisma } from "./prisma";
import { getIndustryTemplate, type IndustryTemplateConfig } from "./industry-templates";

/**
 * Merge org-specific config overrides on top of the industry template defaults.
 * Deep-merge is shallow by design: only top-level keys in config can be overridden.
 */
function mergeConfig(
  base: IndustryTemplateConfig,
  override: Partial<IndustryTemplateConfig>
): IndustryTemplateConfig {
  return {
    terminology: { ...base.terminology, ...(override.terminology || {}) },
    features: { ...base.features, ...(override.features || {}) },
    workflows: {
      ...base.workflows,
      ...(override.workflows || {}),
      queueStatuses: override.workflows?.queueStatuses ?? base.workflows.queueStatuses,
      appointmentStatuses: override.workflows?.appointmentStatuses ?? base.workflows.appointmentStatuses,
      jobStatuses: override.workflows?.jobStatuses ?? base.workflows.jobStatuses,
    },
    dashboard: {
      ...base.dashboard,
      ...(override.dashboard || {}),
      nav: override.dashboard?.nav ?? base.dashboard.nav,
      overviewCards: override.dashboard?.overviewCards ?? base.dashboard.overviewCards,
    },
    defaultServices: override.defaultServices ?? base.defaultServices,
    defaultAutomations: override.defaultAutomations ?? base.defaultAutomations,
  };
}

export async function getOrgIndustryConfig(orgId: string): Promise<{
  templateCode: string;
  config: IndustryTemplateConfig;
} | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { industryTemplate: true, industryConfig: true },
  });

  if (!org?.industryTemplate) return null;

  const template = getIndustryTemplate(org.industryTemplate.code);
  if (!template) return null;

  const override = (org.industryConfig?.config as Partial<IndustryTemplateConfig>) ?? {};
  return {
    templateCode: org.industryTemplate.code,
    config: mergeConfig(template.config, override),
  };
}

export function getIndustryConfigSync(
  templateCode: string,
  override: Partial<IndustryTemplateConfig> = {}
): IndustryTemplateConfig | null {
  const template = getIndustryTemplate(templateCode as never);
  if (!template) return null;
  return mergeConfig(template.config, override);
}
