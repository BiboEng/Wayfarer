import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isApiError } from '@shared/api/errors';
import { classifyError, errorHandler } from '../error-handler';

describe('classifyError', () => {
  it('maps a body-parser parse failure to 400 BAD_REQUEST with a JSON message', () => {
    expect(classifyError({ status: 400, type: 'entity.parse.failed' })).toEqual({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'Malformed JSON body.',
    });
  });

  it('maps other 4xx errors (status or statusCode) to BAD_REQUEST keeping the status', () => {
    expect(classifyError({ status: 413 })).toMatchObject({ status: 413, code: 'BAD_REQUEST' });
    expect(classifyError({ statusCode: 415 })).toMatchObject({ status: 415, code: 'BAD_REQUEST' });
  });

  it('maps everything else to 500 INTERNAL with a generic message', () => {
    for (const err of [new Error('db password is hunter2'), { status: 503 }, { status: 302 }, 'string', null, undefined, 42]) {
      const result = classifyError(err);
      expect(result).toEqual({ status: 500, code: 'INTERNAL', message: 'Something went wrong on the server.' });
    }
  });
});

describe('errorHandler (500 path)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a generic INTERNAL ApiError without leaking the thrown message or stack', async () => {
    const app = express();
    app.get('/boom', () => {
      throw new Error('secret-internal-detail');
    });
    app.use(errorHandler);

    const res = await request(app).get('/boom');

    expect(res.status).toBe(500);
    expect(isApiError(res.body)).toBe(true);
    expect(res.body.error.code).toBe('INTERNAL');
    expect(res.text).not.toContain('secret-internal-detail');
    expect(res.text).not.toMatch(/\n\s+at\s/);
    expect(res.text).not.toContain('node_modules');
  });

  it('logs only route, status, code and error kind; never the message, stack, headers or body', async () => {
    const app = express();
    app.use(express.json());
    app.post('/boom', () => {
      throw new Error('kaboom');
    });
    app.use(errorHandler);

    await request(app).post('/boom').set('x-wayfarer-token', 'logged-token-value').send({ body: 'private-body' });

    const logged = vi.mocked(console.error).mock.calls.flat().join(' ');
    expect(logged).toContain('POST /boom -> 500 INTERNAL (Error)');
    expect(logged).not.toContain('kaboom');
    expect(logged).not.toContain('logged-token-value');
    expect(logged).not.toContain('private-body');
    expect(logged).not.toMatch(/\n\s+at\s/);
  });
});
