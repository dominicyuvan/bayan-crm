import type { UserRole } from "@/lib/types";

export type ManagedEntity = "contacts" | "leads" | "activities";
export type EntityAction = "create" | "delete";

const ALL_ENTITIES: ManagedEntity[] = ["contacts", "leads", "activities"];
const ALL_ACTIONS: EntityAction[] = ["create", "delete"];

type PermissionMatrix = Record<UserRole, Record<ManagedEntity, Record<EntityAction, boolean>>>;

const BASE_MATRIX: PermissionMatrix = {
  admin: {
    contacts: { create: true, delete: true },
    leads: { create: true, delete: true },
    activities: { create: true, delete: true },
  },
  manager: {
    contacts: { create: true, delete: true },
    leads: { create: true, delete: true },
    activities: { create: true, delete: true },
  },
  agent: {
    contacts: { create: true, delete: true },
    leads: { create: true, delete: true },
    activities: { create: true, delete: true },
  },
};

type PermissionInput = {
  role?: UserRole | null;
  entity: ManagedEntity;
  action: EntityAction;
  ownerUid?: string | null;
  profileUid?: string | null;
};

export function canManageEntity(input: PermissionInput) {
  const role = input.role ?? "agent";
  const matrix = BASE_MATRIX[role];
  if (!matrix) return false;

  if (!ALL_ENTITIES.includes(input.entity) || !ALL_ACTIONS.includes(input.action)) {
    return false;
  }

  const allowed = matrix[input.entity][input.action];
  if (!allowed) return false;

  // Ownership restriction: agents can only delete records they own.
  if (input.action === "delete" && role === "agent") {
    const ownerUid = (input.ownerUid ?? "").trim();
    const profileUid = (input.profileUid ?? "").trim();
    return !!ownerUid && !!profileUid && ownerUid === profileUid;
  }

  return true;
}

export function getRecordOwnerUid(record: {
  createdBy?: string | null;
  assignedToUid?: string | null;
  assignedRepId?: string | null;
}) {
  return (record.createdBy ?? record.assignedToUid ?? record.assignedRepId ?? "").trim();
}
