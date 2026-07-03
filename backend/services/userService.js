const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { PAGES, getDefaultPermissions } = require('./permissionDefaults');

const prisma = new PrismaClient();

const USER_SELECT = {
  id: true,
  username: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  pagePermissions: true
};

const getAllUsers = async () => {
  return prisma.user.findMany({ select: USER_SELECT, orderBy: { username: 'asc' } });
};

const getUserWithPermissions = async (id) => {
  const user = await prisma.user.findUnique({ where: { id: parseInt(id) }, select: USER_SELECT });
  if (!user) throw new Error('User not found');
  return user;
};

const getMyPermissions = async (userId) => {
  const rows = await prisma.userPagePermission.findMany({ where: { userId: parseInt(userId) } });
  const map = {};
  for (const page of PAGES) {
    const row = rows.find(r => r.page === page);
    map[page] = row
      ? { canView: row.canView, canEdit: row.canEdit, canDelete: row.canDelete }
      : { canView: false, canEdit: false, canDelete: false };
  }
  return map;
};

const createUser = async ({ username, pin, role }) => {
  if (!['ADMIN', 'MANAGER', 'SALES'].includes(role)) {
    throw new Error('Invalid role');
  }
  const hashedPin = await bcrypt.hash(pin, 10);
  const defaults = getDefaultPermissions(role);

  const createdId = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { username, pin: hashedPin, role, isActive: true }
    });
    await tx.userPagePermission.createMany({
      data: defaults.map(p => ({ userId: user.id, ...p }))
    });
    return user.id;
  });
  return getUserWithPermissions(createdId);
};

const updateUser = async (id, { username, role, isActive, pin, permissions }) => {
  const userId = parseInt(id);
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) throw new Error('User not found');

  if (role && !['ADMIN', 'MANAGER', 'SALES'].includes(role)) {
    throw new Error('Invalid role');
  }

  const data = {};
  if (username !== undefined) data.username = username;
  if (role !== undefined) data.role = role;
  if (isActive !== undefined) data.isActive = isActive;
  if (pin) data.pin = await bcrypt.hash(pin, 10);

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.user.update({ where: { id: userId }, data });
    }
    if (Array.isArray(permissions)) {
      await tx.userPagePermission.deleteMany({ where: { userId } });
      await tx.userPagePermission.createMany({
        data: permissions
          .filter(p => PAGES.includes(p.page))
          .map(p => ({
            userId,
            page: p.page,
            canView: !!p.canView,
            canEdit: !!p.canEdit,
            canDelete: !!p.canDelete
          }))
      });
    }
  });
  return getUserWithPermissions(userId);
};

const deleteUser = async (id, requestingUserId) => {
  const userId = parseInt(id);
  if (userId === parseInt(requestingUserId)) {
    throw new Error('You cannot delete your own account');
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new Error('User not found');

  if (target.role === 'ADMIN' && target.isActive) {
    const otherActiveAdmins = await prisma.user.count({
      where: { role: 'ADMIN', isActive: true, id: { not: userId } }
    });
    if (otherActiveAdmins === 0) {
      throw new Error('Cannot delete the last active admin account');
    }
  }

  return prisma.user.delete({ where: { id: userId } });
};

module.exports = {
  getAllUsers,
  getUserWithPermissions,
  getMyPermissions,
  createUser,
  updateUser,
  deleteUser
};
