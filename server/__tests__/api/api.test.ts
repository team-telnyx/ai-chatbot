import { describe, expect, it, afterAll } from '@jest/globals';
import { application } from '../../server';

import request from 'supertest';

// http://localhost:3000/completion/?user_id=12345&session_id=098123781&question=How's the weather in Dublin, Ireland ? Tell me in Farenheight&http=true

// generate a 6 digit random number
const getRandomNumber = () => Math.floor(100000 + Math.random() * 900000);

afterAll((done) => {
  application.dispose();
  done();
});

/**
 * Sample response from completions
 * {
 *   chatbot: 'weather_bot',
 *   type: 'http',
 *   user_id: '781890',
 *   message_id: '27514941-33e9-48f8-b50e-98f2d6b8ff6c',
 *   session_id: '587063',
 *   query: "How's the weather in Dublin, Ireland?",
 *   answer: 'The current weather in Dublin, Ireland is clear sky with a temperature of 10.35°C.',
 *   system: 'You are a weather reporter who can check the weather in real-time.\n' +
 *     'You should tell the user the current weather in the location they specify.',
 *   model: 'gpt-4-turbo-preview',
 *   start: 1499.781875,
 *   prompt_tokens: 196,
 *   completion_tokens: 21,
 *   metadata: {
 *     tool_completions: [ [Object] ],
 *     documents: [],
 *     processing_duration: 0,
 *     show_help_action: false,
 *     show_feedback: true,
 *     error: null,
 *     result: 'weather_response'
 *   },
 *   response_format: { type: 'text' },
 *   save_thread: true
 * }
 */

describe('GET /completions', function () {
  it('responds', async function () {
    const randomUserId = getRandomNumber();
    const randomSessionId = getRandomNumber();
    const testQuestion = "How's the weather in Dublin, Ireland?";

    const response = await request(application.app)
      .get('/completion')
      .query({
        user_id: randomUserId,
        session_id: randomSessionId,
        question: testQuestion,
        http: true,
      })
      .set('Accept', 'application/json');

    expect(5).toEqual(5);
    expect(response.headers['content-type']).toEqual('application/json; charset=utf-8');
    expect(response.status).toEqual(200);

    const responseData = response.body;

    expect(responseData).toEqual(
      expect.objectContaining({
        chatbot: 'weather_bot',
        type: 'http',
        user_id: randomUserId.toString(),
        session_id: randomSessionId.toString(),
        query: testQuestion,
        answer: expect.stringContaining('The current weather in Dublin, Ireland is'),
        model: expect.stringContaining('gpt-4'),
        start: expect.any(Number),
        prompt_tokens: expect.any(Number),
        completion_tokens: expect.any(Number),
        metadata: expect.objectContaining({
          tool_completions: expect.arrayContaining([expect.any(Object)]),
          documents: expect.arrayContaining([]),
          processing_duration: expect.any(Number),
          show_help_action: false,
          show_feedback: true,
          error: null,
          result: 'weather_response',
        }),
        response_format: expect.objectContaining({
          type: 'text',
        }),
        save_thread: true,
      })
    );
  }, 15000);
});

/**
 * Sample response from pricing/model
 *  {
 *      "cost_per_prompt_token": 0.00001,
 *      "cost_per_completion_token": 0.000029999999999999997,
 *      "model": "gpt-4-turbo-preview"
 *  }
 */

describe('GET /pricing/model', function () {
  it('responds with that specific model pricing', async function () {
    const modelName = 'gpt-4-turbo-preview';

    const response = await request(application.app)
      .get('/pricing/model')
      .query({
        model: modelName,
      })
      .set('Accept', 'application/json');

    expect(response.headers['content-type']).toEqual('application/json; charset=utf-8');
    expect(response.status).toEqual(200);

    const responseData = response.body;

    expect(responseData).toEqual(
      expect.objectContaining({
        cost_per_prompt_token: expect.any(Number),
        cost_per_completion_token: expect.any(Number),
        model: modelName,
      })
    );
  }, 15000);
});

/**
 * Sample pricing model cost
 * {
 *  "total_cost": "0.00",
 *  "total_chat_cost": "0.00",
 *  "total_tool_cost": "0.00"
 * }
 */

describe('GET /pricing/model/cost', function () {
  it('responds with cost from start_date till end_date', async function () {
    const startDate = '2024-01-01';
    const endDate = '2024-03-15';

    const response = await request(application.app)
      .get('/pricing/model/cost')
      .query({
        start_date: startDate,
        end_date: endDate,
      })
      .set('Accept', 'application/json');

    expect(response.headers['content-type']).toEqual('application/json; charset=utf-8');
    expect(response.status).toEqual(200);

    const responseData = response.body;

    expect(responseData).toEqual(
      expect.objectContaining({
        total_cost: expect.any(String),
        total_chat_cost: expect.any(String),
        total_tool_cost: expect.any(String),
      })
    );
  }, 15000);
});

/**
 * Sample state response
 * {
 *   "status": "operational",
 *   "notice": null
 * }
 */

describe('GET /state', function () {
  it('responds with status of the service', async function () {
    const response = await request(application.app).get('/state').set('Accept', 'application/json');

    expect(response.headers['content-type']).toEqual('application/json; charset=utf-8');
    expect(response.status).toEqual(200);

    const responseData = response.body;

    console.log(responseData);

    expect(responseData).toEqual(
      expect.objectContaining({
        status: expect.stringMatching(/operational|degraded|maintenance|offline/),
        notice: null,
      })
    );
  }, 15000);
});
