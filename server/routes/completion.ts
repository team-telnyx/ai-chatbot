import { Router } from 'express';
import { WeatherChatbot } from '../libs/services/inference/chatbot/weather.chatbot.js';
import { ExampleWeatherTool } from '../libs/services/inference/tools/presets/weather.tool.js';
import { ExampleBucketSearchTool } from '../libs/services/inference/tools/presets/bucket.tool.js';

const router = Router();

/*
  All routes in this file begin with /completion
*/

router.get('/', async (req, res) => {
  const http = req.query.http === 'true';

  const chatbot = req?.query?.chatbot || 'weather_bot';
  const required = { query: ['user_id', 'session_id', 'question'] };

  const tools = [new ExampleWeatherTool({ req }), new ExampleBucketSearchTool({ req })];
  const conditional_tools = [];

  const system = [
    'You are a helpful assistant who can also tell the weather, and also search a Telnyx bucket to answer Telnyx questions.',
  ].join('\n');

  // we set the response object to null if HTTP is specified, so we will not stream the response
  const response = http ? null : res;
  const bot = new WeatherChatbot({ system, req, res: response, tools, conditional_tools, chatbot, required });

  const configuration = {
    user_id: req.query.user_id as string,
    session_id: req.query.session_id as string,
    message_id: req.query.message_id as string,
    question: req.query.question as string,
  };

  // ask the bot a question and stream the response
  if (!http) return bot.ask(configuration);

  // ask the bot the question and return a HTTP response
  const completion = await bot.ask(configuration);
  return res.json(completion);
});

export default router;
