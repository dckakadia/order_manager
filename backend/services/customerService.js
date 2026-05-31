const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getActiveCustomers = async () => {
  return await prisma.customer.findMany({ where: { isActive: true } });
};

const createCustomer = async (data) => {
  const { name, phone, email, shippingAddress, taxNumber } = data;
  return await prisma.customer.create({
    data: { name, phone, email, shippingAddress, taxNumber }
  });
};

const checkCustomerLinks = async (id) => {
  const customer = await prisma.customer.findUnique({ where: { id: parseInt(id) } });
  if (!customer) throw new Error('Customer not found');
  
  const count = await prisma.order.count({
    where: { customerId: parseInt(id) }
  });
  
  return { count, name: customer.name };
};

const deleteCustomer = async (id) => {
  const customer = await prisma.customer.findUnique({ where: { id: parseInt(id) } });
  if (!customer) throw new Error('Customer not found');

  const orderCount = await prisma.order.count({
    where: { customerId: parseInt(id) }
  });

  if (orderCount > 0) {
    throw new Error(`Cannot delete. '${customer.name}' is used in ${orderCount} Sales Orders.`);
  }

  return await prisma.customer.delete({ where: { id: parseInt(id) } });
};

const updateCustomer = async (id, data) => {
  const { name, phone, email, shippingAddress, taxNumber } = data;
  return await prisma.customer.update({
    where: { id: parseInt(id) },
    data: { name, phone, email, shippingAddress, taxNumber }
  });
};

module.exports = {
  getActiveCustomers,
  createCustomer,
  checkCustomerLinks,
  deleteCustomer,
  updateCustomer
};
