"use client";

import { PageHeader } from "@/components/ui";
import { RoleAwareAdminGuard } from "../../role";
import { NotificationPreferencesTab } from "../notification-preferences-tab";

export default function NotificationSettingsPage() {
  return (
    <RoleAwareAdminGuard>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader
          title="Notification preferences"
          description="Manage which events trigger notifications for each contact and channel."
        />
        <div className="px-6 pb-6">
          <NotificationPreferencesTab />
        </div>
      </div>
    </RoleAwareAdminGuard>
  );
}
