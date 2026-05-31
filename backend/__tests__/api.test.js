const request = require('supertest');
const { app, server } = require('../server');

afterAll((done) => {
  // Ensure the server closes after tests are done
  server.close(done);
});

describe('Basic API Endpoints', () => {
  it('GET /health should return 200 OK', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/csrf-token should return a token', async () => {
    const res = await request(app).get('/api/csrf-token');
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.csrfToken).toBeDefined();
  });
});

describe('Authentication', () => {
  it('POST /api/auth/login without credentials should return 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});
    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
  });

  it('POST /api/auth/login with invalid credentials should return 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'invalid_user', pin: '0000' });
    expect(res.statusCode).toEqual(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Protected Routes', () => {
  it('GET /api/orders without auth token should return 401 Unauthorized', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.statusCode).toEqual(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Unauthorized');
  });
});
