import { Tool } from '../tool.js';

export class ExampleWeatherTool extends Tool {
  constructor({ req }) {
    super({ req });

    this.name = 'get_current_weather';
    this.description = 'Get the current weather in a given location';
  }

  public get define() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The city and state, e.g. San Francisco, CA',
            },
            unit: {
              type: 'string',
              enum: ['metric', 'imperial'],
            },
          },
          required: ['location'],
        },
      },
    };
  }

  public async execute() {
    try {
      const args = JSON.parse(this.arguments);

      console.log('Execute:', { name: this.name, arguments: args });

      const system = [
        'You are a weather reporter who can check the weather in real-time.',
        'You should tell the user the current weather in the location they specify.',
      ].join('\n');

      const location = args.location || 'unknown';
      const unit = args.unit || 'metric';
      const weatherReport = await this.checkWeather(location, unit);

      return this.response({
        system,
        tool_output: weatherReport,
        metadata: {
          result: 'weather_response',
          show_feedback: true,
          show_help_action: false,
        },
      });
    } catch (e) {
      return this.error(e);
    }
  }

  private checkWeather = async (location: string, unit: 'metric' | 'imperial'): Promise<string> => {
    // Create an account here: https://openweathermap.org/ to get an API key
    // if key not found throw an error
    if (!process.env.OPEN_WEATHER_MAP_API_KEY) {
      throw new Error(
        'OPEN_WEATHER_MAP Key not found. Please get one from https://openweathermap.org and then paste it in your environment file.'
      );
    }
    const apiKey = process.env.OPEN_WEATHER_MAP_API_KEY;

    const baseUrl = 'https://api.openweathermap.org/data/2.5/weather';
    const url = `${baseUrl}?q=${encodeURIComponent(location)}&units=${unit}&appid=${apiKey}`;

    const errorMessage = 'The weather data could not be fetched. Please prompt the user for more information.';

    try {
      // Use fetch to get the weather data
      const response = await fetch(url);
      const data = await response.json();

      // Check if the request was successful
      if (response.ok) {
        const report = `The weather in ${location} is ${data.weather[0].description}. The temperature is ${
          data.main.temp
        }°${unit === 'metric' ? 'C' : 'F'}.`;

        return report;
      } else {
        // If the API request failed, log the error message
        console.log(data.message || 'An error occurred while fetching the weather data.');
        return errorMessage;
      }
    } catch (error) {
      return errorMessage;
    }
  };
}
