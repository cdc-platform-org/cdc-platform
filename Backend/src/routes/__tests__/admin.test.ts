import { prisma } from '../../lib/prisma';
import { applyUserRoleChange, applyUserStatusChange, AdminUserActionError } from '../admin';
import { createUser } from '../../test/factories';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('applyUserRoleChange', () => {
  it('changes a plain user role (Student -> Client) and writes an audit log entry', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const target = await createUser({ role: 'Student' });

    const updated = await applyUserRoleChange({
      targetUserId: target.id,
      callerId: admin.id,
      callerAdminRole: 'MANAGER',
      newRole: 'Client',
    });
    expect(updated.role).toBe('Client');

    const log = await prisma.auditLog.findFirst({ where: { action: 'user.role_change', targetId: target.id } });
    expect(log).not.toBeNull();
    expect(log?.metadata).toMatchObject({ from: 'Student', to: 'Client' });
  });

  it('covers every non-SuperAdmin Role transition a MANAGER is allowed to make', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const roles = ['Student', 'Mentor', 'Client'] as const;
    for (const newRole of roles) {
      const target = await createUser({ role: newRole === 'Student' ? 'Client' : 'Student' });
      const updated = await applyUserRoleChange({
        targetUserId: target.id,
        callerId: admin.id,
        callerAdminRole: 'MANAGER',
        newRole,
      });
      expect(updated.role).toBe(newRole);
    }
  });

  it('rejects a MANAGER granting SuperAdmin — only SUPER_ADMIN may touch that role', async () => {
    const manager = await createUser({ adminRole: 'MANAGER' });
    const target = await createUser({ role: 'Student' });

    await expect(
      applyUserRoleChange({ targetUserId: target.id, callerId: manager.id, callerAdminRole: 'MANAGER', newRole: 'SuperAdmin' })
    ).rejects.toThrow(AdminUserActionError);

    const unchanged = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(unchanged.role).toBe('Student');
  });

  it('rejects a MANAGER demoting an existing SuperAdmin away from that role', async () => {
    const manager = await createUser({ adminRole: 'MANAGER' });
    const target = await createUser({ role: 'SuperAdmin' });

    await expect(
      applyUserRoleChange({ targetUserId: target.id, callerId: manager.id, callerAdminRole: 'MANAGER', newRole: 'Student' })
    ).rejects.toThrow(AdminUserActionError);
  });

  it('allows a SUPER_ADMIN to grant and revoke the SuperAdmin role', async () => {
    const superAdmin = await createUser({ adminRole: 'SUPER_ADMIN' });
    const target = await createUser({ role: 'Student' });

    const granted = await applyUserRoleChange({
      targetUserId: target.id,
      callerId: superAdmin.id,
      callerAdminRole: 'SUPER_ADMIN',
      newRole: 'SuperAdmin',
    });
    expect(granted.role).toBe('SuperAdmin');

    const revoked = await applyUserRoleChange({
      targetUserId: target.id,
      callerId: superAdmin.id,
      callerAdminRole: 'SUPER_ADMIN',
      newRole: 'Client',
    });
    expect(revoked.role).toBe('Client');
  });

  it('rejects an admin changing their own role', async () => {
    const admin = await createUser({ adminRole: 'SUPER_ADMIN', role: 'Student' });

    await expect(
      applyUserRoleChange({ targetUserId: admin.id, callerId: admin.id, callerAdminRole: 'SUPER_ADMIN', newRole: 'Client' })
    ).rejects.toThrow(AdminUserActionError);
  });

  it('rejects a no-op role change (already that role)', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const target = await createUser({ role: 'Mentor' });

    await expect(
      applyUserRoleChange({ targetUserId: target.id, callerId: admin.id, callerAdminRole: 'MANAGER', newRole: 'Mentor' })
    ).rejects.toThrow(AdminUserActionError);
  });
});

describe('applyUserStatusChange', () => {
  it('covers every UserStatus transition and writes an audit log entry', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const statuses = ['APPROVED', 'REJECTED', 'PENDING_APPROVAL'] as const;
    for (const newStatus of statuses) {
      const target = await createUser({ status: newStatus === 'APPROVED' ? 'PENDING_APPROVAL' : 'APPROVED' });
      const updated = await applyUserStatusChange({ targetUserId: target.id, callerId: admin.id, newStatus });
      expect(updated.status).toBe(newStatus);

      const log = await prisma.auditLog.findFirst({ where: { action: 'user.status_change', targetId: target.id } });
      expect(log).not.toBeNull();
      expect(log?.metadata).toMatchObject({ to: newStatus });
    }
  });

  it('records the reason and clears it again on a later non-REJECTED transition', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const target = await createUser({ status: 'PENDING_APPROVAL' });

    const rejected = await applyUserStatusChange({
      targetUserId: target.id,
      callerId: admin.id,
      newStatus: 'REJECTED',
      reason: 'Incomplete verification documents.',
    });
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.rejectionReason).toBe('Incomplete verification documents.');

    const approved = await applyUserStatusChange({ targetUserId: target.id, callerId: admin.id, newStatus: 'APPROVED' });
    expect(approved.status).toBe('APPROVED');
    expect(approved.rejectionReason).toBeNull();
  });

  it('rejects an admin changing their own status', async () => {
    const admin = await createUser({ adminRole: 'SUPER_ADMIN', status: 'PENDING_APPROVAL' });

    await expect(
      applyUserStatusChange({ targetUserId: admin.id, callerId: admin.id, newStatus: 'APPROVED' })
    ).rejects.toThrow(AdminUserActionError);
  });

  it('rejects a no-op status change (already that status)', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const target = await createUser({ status: 'APPROVED' });

    await expect(
      applyUserStatusChange({ targetUserId: target.id, callerId: admin.id, newStatus: 'APPROVED' })
    ).rejects.toThrow(AdminUserActionError);
  });
});
