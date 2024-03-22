# AI Chatbot

## Introduction

The AI Chatbot is a backend-driven tool aimed at transforming the way businesses interact with their customers through advanced AI capabilities. Developed by Telnyx — a leader in global connectivity solutions — this open-source project is designed to empower the community, enabling businesses to support their end-users more effectively. By leveraging the power of Large Language Models (LLMs) like OpenAI, coupled with the rich data sources available in Telnyx storage buckets, the AI Chatbot offers a dynamic framework for creating responsive and informed AI chat interfaces.

Our vision with releasing the AI Chatbot is to provide a scaffold that not only demonstrates the potential of integrating LLMs for answering queries but also showcases how additional content stored within the Telnyx Mission Control Portal can enrich the chatbot's responses. This approach aims to deliver a more personalized and context-aware user experience, helping businesses enhance their customer support and engagement through our products.

Before diving into the technical setup of the AI Chatbot, it's essential to configure your Telnyx Mission Control Portal account to work seamlessly with the chatbot. This section guides you through the necessary steps to ensure your stored content in Telnyx buckets is accessible and usable by the chatbot for generating responses.

## Table of Contents

- [Introduction](#introduction)
- [Mission Control Portal Configuration](#mission-control-portal-configuration)
  - [Configure Storage Buckets](#configure-storage-buckets)
  - [Generate API Keys](#generate-api-keys)
  - [Test AI Inference Playground](#test-ai-inference-playground)
  - [Update Env Configuration](#update-env-configuration)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Setting Up the Databases](#setting-up-the-databases)
  - [Environment Configuration](#environment-configuration)
- [Environment Setup](#environment-setup)
- [Starting the App](#starting-the-app)
- [Test your endpoints](#test-your-endpoints)
- [Run Tests](#run-tests)
- [How to Contribute](#how-to-contribute)
- [FAQs](#faqs)
- [Future Work](#future-work)
- [License](#license)
- [Acknowledgments](#acknowledgments)


## Mission Control Portal Configuration

1. **Create a Telnyx Mission Control Portal Account**: Begin by creating an account at [Telnyx Sign Up](https://portal.telnyx.com/#/login/signup).
2. **Log in to your Mission Control Portal Account**: Once your account is set up, log in at [Telnyx Sign In](https://portal.telnyx.com/#/login/sign-in) to access your dashboard for configuring storage buckets and managing API keys.

### Configure Storage Buckets

- **Access Storage Buckets**: Navigate to the [Storage Buckets](https://portal.telnyx.com/#/app/next/storage/buckets) section to set up and manage your content storage. This content will be accessible by the chatbot for generating answers.
- For more information on setting up storage, refer to the [Storage Developer Documentation](https://developers.telnyx.com/api/cloud-storage).
- **GetObject**: This API is utilized to retrieve the contents of a file from a bucket within Telnyx Storage, supporting the chatbot's ability to access and use stored data effectively. For more details, see [GetObject](https://developers.telnyx.com/api/cloud-storage/object-operations/get-object).
- **HeadObject**: Before fetching file contents, the HeadObject API is used to determine if the file is a PDF, as PDFs are loaded differently. This is crucial for handling diverse file formats seamlessly. For more information, check [HeadObject](https://developers.telnyx.com/api/cloud-storage/object-operations/head-object).

### Generate API Keys

- **Create API Keys**: Visit the [API Keys](https://portal.telnyx.com/#/app/api-keys) section to generate the API keys needed for the chatbot to interact with Telnyx services, including storage and LLMs.

### Test AI Inference Playground

- **Set Up AI Inference**: To use Telnyx AI for processing and generating responses, check out the [AI Inference](https://portal.telnyx.com/#/app/next/ai/ai-playground) section and the [Inference Changelog](https://telnyx.com/landing/telnyx-ai-inference-changelog) for the latest updates.
- For detailed API information, consult the [Inference Developer Documentation](https://developers.telnyx.com/api/inference).
- **Search for Documents**: This API performs a similarity search within a single bucket. The AI Chatbot enhances this functionality by searching across multiple buckets simultaneously, sorting results based on the certainty value and allowing for weighted preferences for certain buckets. This is key for optimizing search results. For details, see [Search for Documents](https://developers.telnyx.com/api/inference/inference-embedding/post-embedding-similarity-search).

- **OpenAI SDK Compatibility**: The AI Chatbot leverages the OpenAI SDK, setting Telnyx as the `baseURL` and using a `TELNYX_API_KEY` for authentication. This enables sending requests to OpenAI through Telnyx, utilizing the "Create a Chat completion" API for all inference requests within this service. This integration allows for a seamless connection with OpenAI's capabilities. See the [OpenAI SDK documentation](https://platform.openai.com/docs/api-reference/chat/create) for more information.

Here is an example of how the chatbot integrates these services within its codebase: [AI Chatbot Service Example](https://github.com/team-telnyx/ai-chatbot/blob/f6edf2027ef3bb4178e90d654b42ab4947b2695c/server/libs/app/application.ts#L111-L114).

These integrations provide the foundation for the AI Chatbot's functionality, enabling it to offer a comprehensive, AI-driven chat service that leverages the best of Telnyx's storage and inference capabilities alongside the advanced AI models provided by OpenAI.

### Update .env Configuration

1. **Reflect API and Storage Details**: Update your chatbot's `.env` file with the new API keys and storage bucket details to enable seamless integration between the AI Chatbot and Telnyx services.


By completing these initial setup steps, you'll create a robust environment where the AI Chatbot can dynamically access and utilize content from your Telnyx account, enhancing the quality and relevance of its responses.

## Getting Started

### Prerequisites

- [PostgreSQL (with psql client)](https://www.postgresql.org/download/)
- [Docker (version 2.5.0 or higher)](https://docs.docker.com/get-docker/)
- [Node.js (version 20 or higher)](https://nodejs.org/en/)
- [Yarn package manager](https://yarnpkg.com/getting-started/install)

### Setting Up the Databases

#### PostgreSQL Database

Follow the official [installation guide](https://www.postgresql.org/download/) and make sure to use your own strong password.

1. **Install PostgreSQL**: Ensure PostgreSQL and the psql client are installed on your system.
2. **Access PostgreSQL**: Run `sudo -u postgres psql` to access your local PostgreSQL instance.
3. **Create User**: Execute `CREATE USER ai_chatbot WITH PASSWORD 'postgres';`.
4. **Grant Permissions**: Allow the new user to create databases with `ALTER ROLE ai_chatbot WITH CREATEDB;`.
5. **Connect as User**: In a new terminal, connect as the new user via `psql -U ai_chatbot postgres`. Enter the password.
6. **Create Database**: Create the database using `CREATE DATABASE ai_chatbot;`.
7. **Switch to Database**: Use `\c ai_chatbot` to switch to the newly created database.
8. **Initialize Database**: You can now copy and paste the schema found at the route of the repository to set up the tables.


### Environment Configuration

1. **Create .env File**: In the root project directory, create a `.env` file with the following variables:

```
PORT=3000
NGINX_PORT=80

INTERCOM_API_KEY=YOUR_INTERCOM_API_KEY
OPEN_WEATHER_MAP_API_KEY=YOUR_OPEN_WEATHER_MAP_API_KEY
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
TELNYX_API_KEY=YOUR_TELNYX_API_KEY

POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=ai_chatbot
POSTGRES_DATABASE=ai_chatbot
POSTGRES_PASSWORD=postgres
POSTGRES_DEV_PORT=25432

LOCAL=true
```

This is just a sample of environment variables we have included. 

## Environment Setup

To run the project, you need to install Node. This project uses Node version 20. Consider installing [NVM](https://github.com/nvm-sh/nvm) for virtual environment management.

```
nvm install 20.4.0
nvm use 20.4.0
```

## Starting the App

### With Yarn

1. Make sure to have followed the postgres database setup instructions above. 
2, Install the project dependencies with `yarn`.
2. Start the project backend with `yarn run dev:backend`.

```
$ yarn run dev:backend

10:30:22 - Starting compilation in watch mode...
10:30:25 - Found 0 errors. Watching for file changes.
Server running on http (port 3000)
```

### With Docker

Refer to the Dockerfile and Docker Compose configurations provided.

We create containers for nginx, api, and postgres, all within a shared network, enabling intercommunication. Only nginx is exposed to the external world. The other containers expose their ports exclusively within the internal network. Within nginx, we configure the endpoints accessible to external users.

For enhanced user-friendliness, we default to providing access through port 80 (modifiable via .env).

Nginx can also serve as a proxy for other services, such as front-end, Redis, RabbitMQ, ElasticSearch, Jaeger, etc. Notably, nginx efficiently handles static content requests, reducing the load on the primary service.

`docker-compose.yml` is tailored for production, exposing only the essential services.

`docker-compose.dev.yml` caters to development needs, offering direct access to both the DB and API.

1. To run the prod version: execute `docker compose up -d`.
2. To run the dev version: execute `docker compose -f docker-compose.yml up -d`

#### Run the Containers

```
$ docker compose up -d
[+] Building 0.0s (0/0)                                                                                                         
[+] Running 3/3
 ✔ Container ai-chatbot-postgres-1  Started                                                                               10.7s 
 ✔ Container ai-chatbot-api-1       Started                                                                               10.7s 
 ✔ Container ai-chatbot-nginx-1     Started 
 ```

#### List the Containers

 ```
 $ docker ps -a
CONTAINER ID   IMAGE            COMMAND                  CREATED          STATUS         PORTS                                               NAMES
9c912beb51ab   nginx:1.25.1     "/docker-entrypoint.…"   5 seconds ago    Up 4 seconds   80/tcp, 0.0.0.0:8080->8080/tcp, :::8080->8080/tcp   ai-chatbot-nginx-1
be4aee0277d5   ai_chatbot_api   "./entrypoint.sh"        15 seconds ago   Up 5 seconds   3000/tcp                                            ai-chatbot-api-1
30d1e83c684b   postgres:15      "docker-entrypoint.s…"   16 seconds ago   Up 5 seconds   5432/tcp                                            ai-chatbot-postgres-1
```

#### Docker Notes

1. In the prod version, internal services (API and Postgres DB) are hidden behind nginx. You can access the ready service at http://localhost.
2. If you need direct access to the API and Postgres DB, you need the dev version. Note that the DB will be accessible on the POSTGRES_DEV_PORT from .env (default is 25432).
3. NGINX_PORT - the port on which the service will be available in prod (default is 80).
4. PORT - the port on which the API service is available in dev (default is 3000).

### With Make

For convenience, Makefile commands are available to manage the project with ease:

1. To start the application in development mode with live reloading and debug capabilities, use: `make start`.
2. To start the application in detached mode, ideal for production environments where you want the process to run in the background, execute: `make start -d`.

## Test your Endpoints Locally

`GET /completion`

Initiate chat requests to the base chatbot class.

```
curl --request GET \
  --url 'http://localhost:3000/completion?response_method=http&user_id=example_user&session_id=example_session&message_id=example_message&question=Your%20question%20here' \
  --header 'Content-Type: application/json'

```

`GET /datastore/conversations`

Get a list of conversations between a specified time period.

```
curl --request GET \
  --url 'http://localhost:3000/datastore/conversations?start_date=2024-03-05&end_date=2024-03-13' \
  --header 'Content-Type: application/json'

```

`GET /datastore/messages`

List all messages between a specified time period.

```
curl --request GET \
  --url 'http://localhost:3000/datastore/messages?start_date=2024-03-05&end_date=2024-03-13' \
  --header 'Content-Type: application/json'
```

`GET /datastore/messages/:message_id`

Get the information for a particular message using the message_id.

```
curl --request GET \
  --url 'http://localhost:3000/datastore/messages/da33329b-7297-48b9-aa30-b85628bbb537' \
  --header 'Content-Type: application/json'
```

`GET /datastore/messages/:message_id/metadata`

Get the metadata stored for a message using the message_id.

```
curl --request GET \
  --url 'http://localhost:3000/datastore/messages/da33329b-7297-48b9-aa30-b85628bbb537/metadata' \
  --header 'Content-Type: application/json'
```

`GET /pricing/model/cost`

Check the cost for chat completion, tool completion, and total spent for a given time period.

```
curl --request GET \
  --url 'http://localhost:3000/pricing/model/cost?start_date=2024-03-05&end_date=2024-03-13' \
  --header 'Content-Type: application/json'
```

`GET /pricing/model`

Get the price for prompt tokens and completion tokens for a given model.

```
curl --request GET \
  --url 'http://localhost:3000/pricing/model?model=gpt-4' \
  --header 'Content-Type: application/json'
```

`GET /datastore/feedback`

Get messages with a given feedback for the time period.

```
curl --request GET \
  --url 'http://localhost:3000/datastore/feedback?start_date=2024-03-05&end_date=2024-03-13&type=positive' \
  --header 'Content-Type: application/json'
```

When using docker, use whatever you have set as the NGINX port variable. 

## Run Tests

This section provides guidance on running tests for the AI Chatbot project, including unit tests and API tests. With the recent updates, we've made it simpler and more efficient to test the various components and functionalities.

### Prerequisites

Ensure your Node.js version is updated to at least **v20**.

### Running Tests

To run all tests, use:
```
  yarn run test
```

For debugging and to view logs during test execution, use:
```
yarn run test:debug
```

Alternatively, you can run the testing suite using Make:
```
make test
```

### Technologies Used

- Jest: utilized for unit testing.
- Supertest: employed for API testing.

#### Test Structure

Tests are organized under server/__tests__/*.

Unit Tests: Located under server/__tests__/unit/*. 

These tests currently cover the functionality of document splitters, including:

- intercom.tests.ts
- json.tests.ts
- markdown.tests.ts
- pdf.tests.ts
- unstructured.tests.ts

API Tests: Found under server/__tests__/api/*. These tests cover various endpoints, such as:

- /completions
- /pricing/model
- /pricing/model/cost
- /state

#### Test Development

Important:
- Update the values in your .env file as per the .env/example file for accurate testing environments.

Unit Tests Development:
- To add a new unit test, create a file under server/__tests__/unit/.
- Use yarn run test:unit:watch to watch development in real-time.

API Tests Development:
- For API tests, place them in server/__tests__/api/api.tests.ts.
- Run API tests with yarn run test:api.

Note:
API tests are consolidated into a single file to avoid the error ERROR: Address already in use, which arises due to multiple instances of the express app being created when supertest is used across multiple files.

## How to Contribute

We welcome contributions from the community! Whether it's reporting a bug, submitting a feature request, or making a pull request, your input is valuable to the AI Chatbot project. Here's how you can contribute:

### Reporting Issues

1. **Create a Detailed Issue**: Visit our [Issues page](https://github.com/team-telnyx/ai-chatbot/issues) and create a new issue. Please provide as much detail as possible to help us understand the problem. Include steps to reproduce the issue, expected outcomes, and actual outcomes.
2. **Environment Details**: Mention your operating environment, including OS, Node.js version, Docker version, and any other relevant details that could help replicate the issue.
3. **Logs and Error Messages**: If applicable, include any console logs or error messages to provide further insight into the issue.

### Submitting Pull Requests

1. **Fork the Repository**: Start by forking the [ai-chatbot repository](https://github.com/team-telnyx/ai-chatbot/).
2. **Create a New Branch**: Make your changes in a new git branch based on the `main` branch.
3. **Commit Changes**: Commit your changes, adhering to the project's coding standards and commit message conventions.
4. **Open a Pull Request**: Submit a pull request (PR) against the `main` branch of the `ai-chatbot` repository. Please provide a clear description of the changes and any other information that will help us review your PR.

## FAQs

**Q: What is Telnyx?**  
A: Telnyx is a cloud communications platform that provides a suite of services including voice, messaging, video, and more to help businesses communicate more effectively. It offers APIs for developers to integrate communication capabilities into their applications and services.

**Q: When was Telnyx founded?**  
A: Telnyx was founded in 2009.

**Q: What is Telnyx Inference?**  
A: Telnyx Inference refers to Telnyx's AI-driven services that can analyze and interpret data. This can include services like speech recognition, natural language processing, and other AI capabilities to enhance communication solutions.

**Q: What is Telnyx Storage?**  
A: Telnyx Storage is a service provided by Telnyx that offers secure and scalable cloud storage solutions. It's designed to store and manage large volumes of data, such as call recordings, message logs, and other communication-related data, with ease and reliability.

**Q: What is the AI Chatbot?**
A: The AI Chatbot is an open-source, backend-driven tool designed to enhance customer support through AI-driven interactions, using Telnyx services and Large Language Models (LLMs).

**Q: How do I set up the AI Chatbot?**
A: Follow the setup instructions in the [Getting Started](#getting-started) section of this README, including configuring your Telnyx Mission Control Portal account.

**Q: Can I contribute to the AI Chatbot project?**
A: Yes, contributions are welcome! Check the [How to Contribute](#how-to-contribute) section for details on reporting issues and submitting pull requests.

## Future Work

Our vision for the AI Chatbot encompasses a future where it seamlessly integrates with additional Telnyx API products, offering expanded capabilities. A particularly promising development is the prospect of incorporating an AI Assistant into call center solutions. Telnyx is laying the groundwork for such advancements by leveraging our Voice and Inference APIs, which now feature public endpoints powered by Telnyx GPU-backed services. These enhancements are further complemented by our newly introduced APIs for OpenAI-compatible transcriptions and Telnyx Storage summarizations, paving the way for innovative customer engagement solutions.

## License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/team-telnyx/ai-chatbot/blob/main/LICENSE) file for details.

## Acknowledgments

I would like to extend thanks to our dedicated engineers who have contributed to the AI Chatbot project:

- **Ciaran** for his expertise and hard work on the backend development, ensuring the chatbot's core functionalities are robust and efficient.
- **Artem** for his skills in Docker configuration, making the setup process smoother and more reliable for all users.
- **Rudra** for his meticulous testing efforts, identifying bugs and issues to enhance the overall quality and user experience of the chatbot.

Their contributions have been invaluable to the success of this project. We look forward to continued collaboration as we expand the capabilities of the AI Chatbot.