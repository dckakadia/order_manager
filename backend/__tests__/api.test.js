const request = require('supertest');
const { app, server } = require('../server');

// Mock Prisma completely for tests to avoid touching the real database
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn()
    },
    order: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn()
    },
    orderStatusHistory: {
      create: jest.fn()
    },
    auditLog: {
      create: jest.fn()
    },
    customer: {
      delete: jest.fn(),
      findUnique: jest.fn()
    },
    $transaction: jest.fn(async (callback) => callback(mockPrisma))
  };
  return { PrismaClient: jest.fn(() => mockPrisma) };
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mock auth middleware for protected route tests
jest.mock('../middleware/authUtils', () => {
  const originalModule = jest.requireActual('../middleware/authUtils');
  return {
    ...originalModule,
    authMiddleware: (req, res, next) => {
      // If the route expects a token (has Authorization header in the test), let it pass
      if (req.headers.authorization === 'Bearer valid_token') {
        req.user = { id: 1, role: 'ADMIN', username: 'testadmin' };
        return next();
      }
      return originalModule.authMiddleware(req, res, next);
    },
    requireRole: () => (req, res, next) => next()
  };
});

afterAll((done) => {
  if (server && server.listening) {
    server.close(done);
  } else {
    done();
  }
});

describe('Basic API Endpoints', () => {
  it('GET /health should return 200 OK', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/csrf-token should return a token', async () => {
    const res = await request(app).get('/api/csrf-token');
    expect(res.statusCode).toEqual(200);
    expect(res.body.csrfToken).toBeDefined();
  });
});

describe('Authentication & Rate Limiting', () => {
  beforeEach(() => {
    // Reset rate limiter state by redefining it if possible, but supertest persists it across tests.
    // Instead of hitting 429 which might take a lot of time, let's just test a few failures.
  });

  it('POST /api/auth/login with invalid credentials should return 401', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'invalid_user', pin: '0000' });
    expect(res.statusCode).toEqual(401);
  });

  it('Rate Limiter should block after 5 failed attempts', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    let res;
    // We already made 1 attempt in the previous test. Let's make 5 more.
    for (let i = 0; i < 5; i++) {
      res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'spam', pin: '0000' });
    }
    // The 6th overall attempt should be rate limited
    expect(res.statusCode).toEqual(429);
    expect(res.text).toContain('Too many login attempts');
  });
});

describe('Order CRUD', () => {
  it('should create an order successfully', async () => {
    prisma.order.create.mockResolvedValue({ id: 1, customerId: 1, totalPrice: 500, customer: { name: 'Test Customer' } });
    
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', 'Bearer valid_token')
      .send({ customerId: 1, baseModel: 'Test Model', totalPrice: 500 });
      
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(1);
    expect(prisma.orderStatusHistory.create).toHaveBeenCalled();
  });

  it('should list orders successfully', async () => {
    prisma.order.findMany.mockResolvedValue([{ id: 1, status: 'Order Form Received' }]);
    prisma.order.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', 'Bearer valid_token');
      
    expect(res.statusCode).toEqual(200);
    expect(res.body.data.length).toBe(1);
  });

  it('should soft delete an order', async () => {
    prisma.order.update.mockResolvedValue({ id: 1, deletedAt: new Date() });

    const res = await request(app)
      .delete('/api/orders/1')
      .set('Authorization', 'Bearer valid_token');
      
    expect(res.statusCode).toEqual(200);
    expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 1 },
      data: expect.objectContaining({ deletedAt: expect.any(Date) })
    }));
  });
});

describe('Customer Constraints', () => {
  it('should block deletion of customer if they have orders', async () => {
    // Mock customerService checking links
    prisma.customer.findUnique.mockResolvedValue({ id: 1, name: 'Test Customer' });
    prisma.order.count.mockResolvedValue(5); // Simulate 5 orders exist

    const res = await request(app)
      .delete('/api/customers/1')
      .set('Authorization', 'Bearer valid_token');
      
    expect(res.statusCode).toEqual(400); // Because of the error thrown by customerService
    expect(res.body.error).toContain('Cannot delete');
    expect(res.body.error).toContain('used in 5 Sales Orders');
  });
});
