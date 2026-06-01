const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getActiveItems = async () => {
  return await prisma.item.findMany({ where: { isActive: true } });
};

const createItem = async (data) => {
  const { category, name, price, silverPrice, goldPrice, platinumPrice, titaniumPrice, photo_filename } = data;
  return await prisma.item.create({
    data: { 
      category: category || 'Model', 
      name, 
      price: parseFloat(price) || 0,
      silverPrice: silverPrice !== undefined && silverPrice !== null ? parseFloat(silverPrice) : null,
      goldPrice: goldPrice !== undefined && goldPrice !== null ? parseFloat(goldPrice) : null,
      platinumPrice: platinumPrice !== undefined && platinumPrice !== null ? parseFloat(platinumPrice) : null,
      titaniumPrice: titaniumPrice !== undefined && titaniumPrice !== null ? parseFloat(titaniumPrice) : null,
      photo_filename: photo_filename || null
    }
  });
};

const checkItemLinks = async (id) => {
  const item = await prisma.item.findUnique({ where: { id: parseInt(id) } });
  if (!item) throw new Error('Item not found');
  
  const count = await prisma.order.count({
    where: {
      OR: [
        { itemId: parseInt(id) },
        { baseModel: item.name }
      ]
    }
  });
  
  return { count, name: item.name };
};

const deleteItem = async (id) => {
  const item = await prisma.item.findUnique({ where: { id: parseInt(id) } });
  if (!item) throw new Error('Item not found');

  const orderCount = await prisma.order.count({
    where: {
      OR: [
        { itemId: parseInt(id) },
        { baseModel: item.name }
      ]
    }
  });

  if (orderCount > 0) {
    throw new Error(`Cannot delete. '${item.name}' is used in ${orderCount} Sales Orders.`);
  }

  const deletedItem = await prisma.item.delete({ where: { id: parseInt(id) } });
  return deletedItem;
};

const updateItem = async (id, data) => {
  const { category, name, price, silverPrice, goldPrice, platinumPrice, titaniumPrice, photo_filename } = data;
  
  const updateData = { 
    category: category || 'Model', 
    name, 
    price: parseFloat(price) || 0,
    silverPrice: silverPrice !== undefined && silverPrice !== null ? parseFloat(silverPrice) : null,
    goldPrice: goldPrice !== undefined && goldPrice !== null ? parseFloat(goldPrice) : null,
    platinumPrice: platinumPrice !== undefined && platinumPrice !== null ? parseFloat(platinumPrice) : null,
    titaniumPrice: titaniumPrice !== undefined && titaniumPrice !== null ? parseFloat(titaniumPrice) : null
  };
  
  if (photo_filename !== undefined) {
    updateData.photo_filename = photo_filename;
  }

  return await prisma.item.update({
    where: { id: parseInt(id) },
    data: updateData
  });
};

module.exports = {
  getActiveItems,
  createItem,
  checkItemLinks,
  deleteItem,
  updateItem
};
