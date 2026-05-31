const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createOrder = async (data, userId) => {
  return await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        customerId: parseInt(data.customerId),
        baseModel: data.baseModel,
        itemId: data.itemId ? parseInt(data.itemId) : null,
        variant: data.variant || null,
        basePrice: parseFloat(data.basePrice) || 0,
        totalPrice: parseFloat(data.totalPrice) || 0,
        notes: data.notes || null,
        faucetPosition: data.faucetPosition || null,
        sidePanel: data.sidePanel || null,
        orderBy: data.orderBy || null,
        locationLat: data.locationLat,
        locationLng: data.locationLng,
        checkInTime: data.checkInTime ? new Date(data.checkInTime) : null,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        status: 'Order Form Received'
      },
      include: { customer: true }
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        previousStatus: null,
        newStatus: 'Order Form Received',
        changedByUserId: userId || null
      }
    });

    return order;
  });
};

const getOrders = async (page = 1, limit = 20, includeDeleted = false) => {
  const skip = (page - 1) * limit;

  const orders = await prisma.order.findMany({
    where: includeDeleted ? {} : { deletedAt: null },
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: { customer: true }
  });

  const total = await prisma.order.count({
    where: includeDeleted ? {} : { deletedAt: null }
  });

  return { orders, total, page, limit, pages: Math.ceil(total / limit) };
};

const updateOrderStatus = async (id, status, userId) => {
  return await prisma.$transaction(async (tx) => {
    const existingOrder = await tx.order.findUnique({ where: { id: parseInt(id) } });
    if (!existingOrder) throw new Error('Order not found');

    const order = await tx.order.update({ 
      where: { id: parseInt(id) }, 
      data: { status },
      include: { customer: true }
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        previousStatus: existingOrder.status,
        newStatus: status,
        changedByUserId: userId || null
      }
    });

    return order;
  });
};

const softDeleteOrder = async (id) => {
  return await prisma.order.update({ 
    where: { id: parseInt(id) },
    data: { deletedAt: new Date() }
  });
};

const updateOrder = async (id, data) => {
  const updateData = {};
  if (data.customerId !== undefined) updateData.customerId = parseInt(data.customerId);
  if (data.baseModel !== undefined) updateData.baseModel = data.baseModel;
  if (data.variant !== undefined) updateData.variant = data.variant;
  if (data.totalPrice !== undefined) updateData.totalPrice = parseFloat(data.totalPrice) || 0;
  if (data.deliveryDate !== undefined) updateData.deliveryDate = data.deliveryDate ? new Date(data.deliveryDate) : null;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.faucetPosition !== undefined) updateData.faucetPosition = data.faucetPosition;
  if (data.sidePanel !== undefined) updateData.sidePanel = data.sidePanel;
  if (data.orderBy !== undefined) updateData.orderBy = data.orderBy;
  
  return await prisma.order.update({
    where: { id: parseInt(id) },
    data: updateData,
    include: { customer: true }
  });
};

const getOrderHistory = async (id) => {
  return await prisma.orderStatusHistory.findMany({
    where: { orderId: parseInt(id) },
    orderBy: { timestamp: 'asc' },
    include: {
      user: {
        select: { username: true, role: true }
      }
    }
  });
};

module.exports = {
  createOrder,
  getOrders,
  updateOrderStatus,
  softDeleteOrder,
  updateOrder,
  getOrderHistory
};
