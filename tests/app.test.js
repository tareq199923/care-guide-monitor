process.env.LOG_LEVEL = 'error';

const request = require('supertest');
const app = require('../src/app');

describe('app', () => {
  it('returns health status', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(typeof response.body.uptime).toBe('number');
  });

  it('returns 404 for an unknown route', async () => {
    const response = await request(app).get('/missing').expect(404);

    expect(response.body).toEqual({ error: 'Not found' });
  });

  it('returns 400 for malformed JSON', async () => {
    const response = await request(app)
      .post('/monitor')
      .set('Content-Type', 'application/json')
      .send('{"api_name":')
      .expect(400);

    expect(response.body).toEqual({ error: 'Malformed JSON body' });
  });
});
