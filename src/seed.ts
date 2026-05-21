/**
 * Dev seed — mirrors Keycloak realm users into user-hub's database and
 * seeds the permission catalogue + default role-permission assignments.
 *
 * Queries Keycloak Admin API to discover user IDs and realm roles, then
 * upserts each user + assigns matching platform roles (ADMIN / EDITOR / VIEWER).
 *
 * Run inside the container:
 *   docker exec brainwave-user-hub sh -c "cd /workspace/user-hub && npx prisma db seed"
 */

import { PrismaClient } from '@prisma/client';
import { PERMISSION_CATALOGUE, DEFAULT_ROLE_PERMISSIONS } from './domain/permission.js';

const prisma = new PrismaClient();

const KEYCLOAK_URL      = process.env.KEYCLOAK_BASE_URL      ?? 'http://keycloak:8080';
const KEYCLOAK_ADMIN    = process.env.KEYCLOAK_ADMIN_USER    ?? 'admin';
const KEYCLOAK_ADMIN_PW = process.env.KEYCLOAK_ADMIN_PASSWORD ?? 'admin_dev_pass';
const REALM             = 'brainwave';
const PLATFORM_ROLES    = new Set(['ADMIN', 'EDITOR', 'VIEWER']);

// ---------------------------------------------------------------------------

async function getAdminToken(): Promise<string> {
  const res = await fetch(`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type: 'password',
      client_id:  'admin-cli',
      username:   KEYCLOAK_ADMIN,
      password:   KEYCLOAK_ADMIN_PW,
    }),
  });
  if (!res.ok) throw new Error(`Keycloak admin login failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

interface KcUser {
  id:         string;
  username:   string;
  email?:     string;
  firstName?: string;
  lastName?:  string;
}

async function getRealmUsers(token: string): Promise<KcUser[]> {
  const res = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/users?max=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to list realm users: ${res.status}`);
  return res.json() as Promise<KcUser[]>;
}

async function getUserRealmRoles(token: string, userId: string): Promise<string[]> {
  const res = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userId}/role-mappings/realm`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return [];
  const roles = await res.json() as Array<{ name: string }>;
  return roles.map(r => r.name).filter(n => PLATFORM_ROLES.has(n));
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Seed permissions + role-permission assignments
// ---------------------------------------------------------------------------

async function seedPermissions() {
  console.log('\n── Seeding permissions catalogue ──');

  for (const perm of PERMISSION_CATALOGUE) {
    await prisma.permission.upsert({
      where:  { name: perm.name },
      update: { description: perm.description, resource: perm.resource, action: perm.action },
      create: { name: perm.name, description: perm.description, resource: perm.resource, action: perm.action },
    });
    console.log(`  ✔ permission: ${perm.name}`);
  }

  console.log('\n── Seeding role-permission assignments ──');

  for (const [roleName, permNames] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      console.warn(`  ⚠ role ${roleName} not found — skipping`);
      continue;
    }

    const perms = await prisma.permission.findMany({ where: { name: { in: permNames } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data:           perms.map(p => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
    console.log(`  ✔ ${roleName.padEnd(8)} → [${permNames.join(', ')}]`);
  }
}

// ---------------------------------------------------------------------------

async function seedUsersFromKeycloak() {
  console.log('\n── Seeding users from Keycloak ──');
  console.log('Connecting to Keycloak…');
  const token = await getAdminToken();

  const kcUsers = await getRealmUsers(token);
  console.log(`Found ${kcUsers.length} users in realm "${REALM}"\n`);

  for (const kc of kcUsers) {
    if (!kc.email) {
      console.log(`Skipping ${kc.username} — no email (service account)`);
      continue;
    }

    const platformRoles = await getUserRealmRoles(token, kc.id);
    const fullName = [kc.firstName, kc.lastName].filter(Boolean).join(' ') || null;

    // Upsert by email first (handles the case where the same user was previously
    // inserted with a different keycloakId), then fall back to keycloakId.
    const existing = await prisma.user.findFirst({
      where: { OR: [{ keycloakId: kc.id }, { email: kc.email }] },
    });

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data:  { keycloakId: kc.id, email: kc.email, fullName, accountStatus: 'active' },
        })
      : await prisma.user.create({
          data: { keycloakId: kc.id, email: kc.email, fullName, accountStatus: 'active' },
        });

    if (platformRoles.length > 0) {
      const roleRows = await prisma.role.findMany({
        where:  { name: { in: platformRoles } },
        select: { id: true },
      });
      await prisma.userRole.deleteMany({ where: { userId: user.id } });
      await prisma.userRole.createMany({
        data:           roleRows.map(r => ({ userId: user.id, roleId: r.id })),
        skipDuplicates: true,
      });
    }

    console.log(`✔ ${kc.username.padEnd(15)} keycloakId=${kc.id}  roles=[${platformRoles.join(', ')}]`);
  }

  console.log('\nKeycloak user sync complete.');
}

async function main() {
  // Step 1 — always seed permissions (pure DB, no external deps)
  await seedPermissions();

  // Step 2 — optionally sync users from Keycloak (non-fatal if unavailable)
  try {
    await seedUsersFromKeycloak();
  } catch (err) {
    console.warn('\n⚠  Keycloak user sync skipped:', (err as Error).message);
    console.warn('   This is fine in CI or when Keycloak is not running.');
    console.warn('   Run "npx prisma db seed" again once Keycloak is up to sync users.');
  }

  console.log('\nSeed complete.');
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
