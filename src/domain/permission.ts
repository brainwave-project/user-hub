/**
 * Permission domain — fine-grained capabilities mapped to roles.
 *
 * Naming convention:  "{resource}:{action}"
 * e.g.  "document:read",  "user:delete",  "permission:manage"
 */

export interface Permission {
  id:          string;
  name:        string;   // "document:read"
  description: string | null;
  resource:    string;   // "document"
  action:      string;   // "read"
  createdAt:   Date;
}

export interface RoleWithPermissions {
  id:          string;
  name:        string;
  description: string | null;
  permissions: Permission[];
  createdAt:   Date;
}

// ---------------------------------------------------------------------------
// Canonical permission catalogue — single source of truth for both
// the seed script and the know-hub permission middleware.
// ---------------------------------------------------------------------------

export const PERMISSION_CATALOGUE: Array<{
  name:        string;
  resource:    string;
  action:      string;
  description: string;
}> = [
  // Document
  { name: 'document:read',    resource: 'document', action: 'read',    description: 'List and view documents' },
  { name: 'document:create',  resource: 'document', action: 'create',  description: 'Upload new documents' },
  { name: 'document:update',  resource: 'document', action: 'update',  description: 'Update document metadata' },
  { name: 'document:archive', resource: 'document', action: 'archive', description: 'Archive documents' },
  { name: 'document:delete',  resource: 'document', action: 'delete',  description: 'Delete documents' },
  // Note
  { name: 'note:read',   resource: 'note', action: 'read',   description: 'Read notes on documents' },
  { name: 'note:create', resource: 'note', action: 'create', description: 'Add notes to documents' },
  { name: 'note:update', resource: 'note', action: 'update', description: 'Edit own notes' },
  { name: 'note:delete', resource: 'note', action: 'delete', description: 'Delete notes' },
  // User
  { name: 'user:read',   resource: 'user', action: 'read',   description: 'View user list and profiles' },
  { name: 'user:create', resource: 'user', action: 'create', description: 'Create new users' },
  { name: 'user:update', resource: 'user', action: 'update', description: 'Update user status and details' },
  { name: 'user:delete', resource: 'user', action: 'delete', description: 'Disable users' },
  // Role & Permission management
  { name: 'role:read',          resource: 'role',       action: 'read',   description: 'View roles and their permissions' },
  { name: 'role:assign',        resource: 'role',       action: 'assign', description: 'Assign roles to users' },
  { name: 'permission:manage',  resource: 'permission', action: 'manage', description: 'Grant or revoke permissions on roles' },
];

/** Default permission sets per role (used for seeding and know-hub middleware). */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  VIEWER: [
    'document:read',
    'note:read',
    'user:read',
    'role:read',
  ],
  EDITOR: [
    'document:read', 'document:create', 'document:update', 'document:archive',
    'note:read',     'note:create',     'note:update',     'note:delete',
    'user:read',
    'role:read',
  ],
  ADMIN: PERMISSION_CATALOGUE.map(p => p.name),
};
