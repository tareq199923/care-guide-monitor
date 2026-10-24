const mockCreate = jest.fn();

const mockEnv = {
  isLlmConfigured: true,
  LLM_API_KEY: 'test-key',
  LLM_BASE_URL: 'http://llm.test/v1',
  LLM_MODEL: 'test-model',
  LLM_TIMEOUT_MS: 1000,
  LLM_MAX_COMPLETION_TOKENS: 1024,
  LLM_REASONING_EFFORT: 'low',
  LOG_LEVEL: 'error',
};

jest.mock('../src/config/env', () => mockEnv);
jest.mock('openai', () => jest.fn(() => ({
  chat: {
    completions: {
      create: mockCreate,
    },
  },
})));

const {
  SYSTEM_PROMPT,
  buildPrompt,
  generateMessage,
} = require('../src/services/aiAlert');
const { buildFallbackMessage } = require('../src/utils/fallbackMessages');

const item = {
  api_name: 'Payments API',
  response_time_ms: 4200,
  status_code: 200,
  records_returned: 150,
};

const slowAnomaly = { type: 'HIGH_RESPONSE_TIME', severity: 'warning' };

beforeEach(() => {
  mockCreate.mockReset();
  mockEnv.isLlmConfigured = true;
  mockEnv.LLM_REASONING_EFFORT = 'low';
});

describe('buildPrompt', () => {
  it('includes the metric values and threshold', () => {
    const prompt = buildPrompt(item, slowAnomaly, { consecutiveFailures: 1 });

    expect(prompt).toContain('"api_name": "Payments API"');
    expect(prompt).toContain('"response_time_ms": 4200');
    expect(prompt).toContain('"records_returned": 150');
    expect(prompt).toContain('"threshold_ms": 3000');
    expect(prompt).toContain('"consecutive_failures": 1');
  });

  it('includes records_returned for a failed request', () => {
    const prompt = buildPrompt(
      { ...item, status_code: 500, records_returned: 0 },
      { type: 'FAILED_REQUEST', severity: 'critical' },
      { consecutiveFailures: 1 },
    );

    expect(prompt).toContain('"status_code": 500');
    expect(prompt).toContain('"records_returned": 0');
  });

  it('includes invalid-data issues', () => {
    const prompt = buildPrompt(
      { api_name: 'Payments API' },
      { type: 'INVALID_DATA', severity: 'warning', issues: ['status_code is invalid'] },
    );

    expect(prompt).toContain('status_code is invalid');
  });
});

describe('generateMessage', () => {
  it('returns the cleaned LLM message on success', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: ' "Payments API is slow: 4200\u202fms, above the 3000\u202fms threshold." ',
        },
      }],
    });

    const result = await generateMessage(item, slowAnomaly);

    expect(result).toEqual({
      message: 'Payments API is slow: 4200 ms, above the 3000 ms threshold.',
      aiGenerated: true,
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const request = mockCreate.mock.calls[0][0];
    expect(request.model).toBe('test-model');
    expect(request.temperature).toBe(0.6);
    expect(request.max_completion_tokens).toBe(1024);
    expect(request.max_tokens).toBeUndefined();
    expect(request.reasoning_effort).toBe('low');
    expect(request.messages).toHaveLength(2);
    expect(request.messages[0].role).toBe('system');
    expect(request.messages[0].content).toBe(SYSTEM_PROMPT);
    expect(request.messages[1].content).toContain('"api_name": "Payments API"');
  });

  it('omits reasoning_effort when it is not configured', async () => {
    mockEnv.LLM_REASONING_EFFORT = '';
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Payments API is slow.' } }],
    });

    await generateMessage(item, slowAnomaly);

    const request = mockCreate.mock.calls[0][0];
    expect(request.reasoning_effort).toBeUndefined();
    expect(request.max_completion_tokens).toBe(1024);
  });

  it('retries once and succeeds', async () => {
    mockCreate
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Payments API recovered on retry.' } }],
      });

    const result = await generateMessage(item, slowAnomaly);

    expect(result).toEqual({
      message: 'Payments API recovered on retry.',
      aiGenerated: true,
    });
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('falls back after both attempts fail', async () => {
    mockCreate.mockRejectedValue(new Error('provider down'));

    const result = await generateMessage(item, slowAnomaly);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.aiGenerated).toBe(false);
    expect(result.message).toBe(
      'Payments API is responding slowly: 4200 ms (threshold 3000 ms).',
    );
  });

  it('falls back when the LLM returns an empty message', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '   ' } }],
    });

    const result = await generateMessage(item, slowAnomaly);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.aiGenerated).toBe(false);
  });

  it('skips the LLM when configuration is missing', async () => {
    mockEnv.isLlmConfigured = false;

    const result = await generateMessage(item, slowAnomaly);

    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.aiGenerated).toBe(false);
    expect(result.message).toContain('responding slowly');
  });

  it('normalizes non-breaking hyphens and removes zero-width characters', async () => {
    const nbsp = String.fromCharCode(0x2011);
    const zwsp = String.fromCharCode(0x200b);
    const zwnj = String.fromCharCode(0x200c);
    const zwj = String.fromCharCode(0x200d);
    const bom = String.fromCharCode(0xfeff);
    const content =
      'Payments API is slow: 4200' + nbsp + 'ms'
      + zwsp + zwnj + zwj + bom
      + ' (threshold 3000' + nbsp + 'ms).';

    mockCreate.mockResolvedValue({
      choices: [{ message: { content } }],
    });

    const result = await generateMessage(item, slowAnomaly);

    expect(result.message).toBe('Payments API is slow: 4200-ms (threshold 3000-ms).');
    expect(result.message).not.toContain(zwsp);
    expect(result.message).not.toContain(zwnj);
    expect(result.message).not.toContain(zwj);
    expect(result.message).not.toContain(bom);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('normalizes thin and ideographic spaces and collapses repeated spaces', async () => {
    const thin = String.fromCharCode(0x2009);
    const ideographic = String.fromCharCode(0x3000);
    const content =
      '  Payments' + thin + 'API' + ideographic + ideographic
      + 'is slow: 4200' + thin + 'ms.' + ideographic;

    mockCreate.mockResolvedValue({
      choices: [{ message: { content } }],
    });

    const result = await generateMessage(item, slowAnomaly);

    expect(result.message).toBe('Payments API is slow: 4200 ms.');
    expect(result.message).not.toContain(thin);
    expect(result.message).not.toContain(ideographic);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('caps a long message at 500 characters', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'x'.repeat(600) } }],
    });

    const result = await generateMessage(item, slowAnomaly);

    expect(result.message).toHaveLength(500);
    expect(result.message.endsWith('...')).toBe(true);
  });
});

describe('fallback messages', () => {
  it('mentions zero records for a failed request', () => {
    const message = buildFallbackMessage(
      { api_name: 'Payments API', status_code: 500, records_returned: 0 },
      { type: 'FAILED_REQUEST' },
    );

    expect(message).toBe(
      'Payments API is returning HTTP 500 and returned 0 records, so requests are failing.',
    );
  });

  it('mentions the missing records for NO_RECORDS', () => {
    const message = buildFallbackMessage(
      { api_name: 'Payments API', status_code: 200, records_returned: 0 },
      { type: 'NO_RECORDS' },
    );

    expect(message).toBe(
      'Payments API returned 0 records, so downstream data may be missing.',
    );
  });

  it('includes invalid-data issues', () => {
    const message = buildFallbackMessage(
      { api_name: 'Payments API' },
      { type: 'INVALID_DATA', issues: ['status_code is invalid'] },
    );

    expect(message).toBe(
      'Payments API sent an invalid check result: status_code is invalid.',
    );
  });

  it('includes the consecutive failure count', () => {
    const message = buildFallbackMessage(
      { api_name: 'Payments API', status_code: 503 },
      { type: 'REPEATED_FAILURE' },
      { consecutiveFailures: 3 },
    );

    expect(message).toBe(
      'Payments API has failed 3 consecutive checks (last HTTP 503).',
    );
  });

  it('caps a long fallback message at 500 characters', () => {
    const message = buildFallbackMessage(
      {
        api_name: 'A'.repeat(600),
        status_code: 500,
        records_returned: 0,
      },
      { type: 'FAILED_REQUEST' },
    );

    expect(message).toHaveLength(500);
    expect(message.endsWith('...')).toBe(true);
  });
});
