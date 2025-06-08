import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { pool } from '../db';
import { roles, permissions, rolePermissions } from '@shared/schema';

async function seedRolesAndPermissions() {
  const db = drizzle(pool);

  // Define initial roles and permissions
  const roleNames = ['admin', 'manager', 'user'];
  const permissionNames = [
    'products:create',
    'products:view',
    'products:edit',
    'products:delete',
    'users:create',
    'users:view',
    'users:edit',
    'users:delete',
    'orders:create',
    'orders:view',
    'orders:edit',
    'orders:delete',
  ];

  // Insert roles
  for (const name of roleNames) {
    const existing = await db.select().from(roles).where(eq(roles.name, name));
    if (!existing.length) {
      await db.insert(roles).values({ name });
    }
  }

  // Insert permissions
  for (const name of permissionNames) {
    const existing = await db.select().from(permissions).where(eq(permissions.name, name));
    if (!existing.length) {
      await db.insert(permissions).values({ name });
    }
  }

  // Link all permissions to admin, some to manager, few to user
  const allRoles = await db.select().from(roles);
  const allPermissions = await db.select().from(permissions);

  const adminRole = allRoles.find(r => r.name === 'admin');
  const managerRole = allRoles.find(r => r.name === 'manager');
  const userRole = allRoles.find(r => r.name === 'user');

  if (adminRole) {
    for (const perm of allPermissions) {
      const exists = await db.select().from(rolePermissions)
        .where(eq(rolePermissions.roleId, adminRole.id))
        .where(eq(rolePermissions.permissionId, perm.id));
      if (!exists.length) {
        await db.insert(rolePermissions).values({ roleId: adminRole.id, permissionId: perm.id });
      }
    }
  }

  if (managerRole) {
    const managerPerms = permissionNames.filter(p => !p.startsWith('users:delete'));
    for (const permName of managerPerms) {
      const perm = allPermissions.find(p => p.name === permName);
      if (perm) {
        const exists = await db.select().from(rolePermissions)
          .where(eq(rolePermissions.roleId, managerRole.id))
          .where(eq(rolePermissions.permissionId, perm.id));
        if (!exists.length) {
          await db.insert(rolePermissions).values({ roleId: managerRole.id, permissionId: perm.id });
        }
      }
    }
  }

  if (userRole) {
    const userPerms = ['products:view', 'orders:view'];
    for (const permName of userPerms) {
      const perm = allPermissions.find(p => p.name === permName);
      if (perm) {
        const exists = await db.select().from(rolePermissions)
          .where(eq(rolePermissions.roleId, userRole.id))
          .where(eq(rolePermissions.permissionId, perm.id));
        if (!exists.length) {
          await db.insert(rolePermissions).values({ roleId: userRole.id, permissionId: perm.id });
        }
      }
    }
  }

  console.log('Seeded roles, permissions, and role_permissions successfully.');
  process.exit(0);
}

seedRolesAndPermissions().catch(e => {
  console.error(e);
  process.exit(1);
}); 