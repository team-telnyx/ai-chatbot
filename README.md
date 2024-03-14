# NOC Chatbot

This repository contains the backend and frontend components of the NOC Chatbot, a tool designed to handle service requests and provide an interface for testing and tweaking the chatbot.

## Getting Started

### Prerequisites

- PostgreSQL (with psql client)
- Docker (version 2.5.0 or higher)
- Node.js (version 19.8.1 or higher)
- Yarn package manager

### Setting Up the Databases

#### PostgreSQL Database

1. **Install PostgreSQL**: Ensure PostgreSQL and the psql client are installed on your system.
2. **Access PostgreSQL**: Run `sudo -u postgres psql` to access your local PostgreSQL instance.
3. **Create User**: Execute `CREATE USER noc_chatbot WITH PASSWORD 'postgres';`.
4. **Grant Permissions**: Allow the new user to create databases with `ALTER ROLE noc_chatbot WITH CREATEDB;`.
5. **Connect as User**: In a new terminal, connect as the new user via `psql -U noc_chatbot postgres` (password: `postgres`).
6. **Create Database**: Create the database using `CREATE DATABASE noc_chatbot;`.
7. **Switch to Database**: Use `\c noc_chatbot` to switch to the newly created database.
8. **Initialize Database**: Execute the schema found at [this link](https://github.com/team-telnyx/noc-chatbot/blob/main/server/datastore/schema.sql).
9. If you want to work with production data, you will need to take a dump of the tables. Please contact #squad-noc-eng for assistance.

#### Vector Database (Weaviate)

1. **Configure Weaviate**: In your project's root directory, create a `docker-compose.yml` file and populate it with the provided configuration below.
---
```
version: '3.4'
services:
  weaviate:
    command:
    - --host
    - 0.0.0.0
    - --port
    - '8080'
    - --scheme
    - http
    image: semitechnologies/weaviate:1.18.4
    ports:
    - 8080:8080
    restart: on-failure:0
    environment:
      OPENAI_APIKEY: OPENAI_API_KEY_HERE
      QUERY_DEFAULTS_LIMIT: 25
      AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: 'true'
      PERSISTENCE_DATA_PATH: '/var/lib/weaviate'
      DEFAULT_VECTORIZER_MODULE: 'text2vec-openai'
      ENABLE_MODULES: 'text2vec-openai'
      CLUSTER_HOSTNAME: 'node1'
...
```

2. **Set API Key**: Replace `OPENAI_API_KEY_HERE` with your actual OpenAI API key.
3. **Start Vector Database**: Use `docker-compose up -d` to start Weaviate. This also runs a PostgreSQL database in a separate container.

   _Note: The `-d` flag runs the container in detached mode. Use `docker-compose down -v` to stop the containers._

4. **Database Initialization**: Create a `dump.sql` file in the root directory with the initial schema (link provided above) and include the following SQL commands at the beginning:

```
CREATE ROLE noc_chatbot WITH LOGIN PASSWORD 'postgres';
ALTER ROLE noc_chatbot CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE noc_chatbot TO noc_chatbot;
```

5. **Verify Setup**: Confirm the setup by sending a `GET` request to `http://localhost:8080/v1/objects`.

### Environment Configuration

1. **Create .env File**: In the project directory, create a `.env` file with the following variables:

```
DEBUG=true

INTERCOM_API_KEY=VAULT
OPENAI_API_KEY=sk-...
AUTH_SECRET=CAN_BE_ANY_STRING
TELNYX_API_KEY=YOUR_TELNYX_API_KEY

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=noc_chatbot
POSTGRES_PASSWORD=postgres
POSTGRES_DATABASE=noc_chatbot

LOCAL=true
LOCAL_USERNAME=OKTA_USERNAME
LOCAL_NAME=YOUR_FULL_NAME

WEAVIATE_HOST=localhost
WEAVIATE_PORT=8080
WEAVIATE_SCHEME=http
WEAVIATE_ENABLE_MODULES=text2vec-openai,reranker-cohere

HCAPTCHA_SECRET_KEY=SECRET_IN_VAULT
JWT_SECRET=SECRET_IN_VAULT
REPOSITORY_PATH=PATH_TO_DEVDOCS_FILES
```

If you want to connect to the production vector database hosted on TBM, you can change these `.env` variables to the following:
```
WEAVIATE_HOST=10.236.6.13
WEVIATE_PORT=3000
```
Be very careful when doing this as any changes to the vector database will affect production.

## Environment Setup

To run the project, you need to install Node. This project uses Node version 19.8.1. Consider installing NVM if you have version <19. https://github.com/nvm-sh/nvm

## Starting the App

1. Install the project dependencies with `yarn`.
2. Start the project backend with `yarn run dev:backend`.
3. Start the project frontend with `yarn run dev:frontend`.