process.env.LOG_LEVEL = 'error';

const request = require('supertest');
const app = require('../src/app');

describe('app', () => {
  it('returns health status', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(typeof response.body.uptime).toBe('number');
  });

  it('serves the dashboard at the root', async () => {
    const response = await request(app)
      .get('/')
      .expect(200)
      .expect('Content-Type', /html/);

    expect(response.text).toContain('<title>Care Guide Monitor</title>');
  });

  it('serves the dashboard script', async () => {
    const response = await request(app)
      .get('/app.js')
      .expect(200)
      .expect('Content-Type', /javascript/);

    expect(response.text).toContain('loadAlerts');
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
