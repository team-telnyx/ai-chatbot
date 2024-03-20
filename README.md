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
3. **Create User**: Execute `CREATE USER ai_chatbot WITH PASSWORD 'postgres';`.
4. **Grant Permissions**: Allow the new user to create databases with `ALTER ROLE ai_chatbot WITH CREATEDB;`.
5. **Connect as User**: In a new terminal, connect as the new user via `psql -U ai_chatbot postgres` (password: `postgres`).
6. **Create Database**: Create the database using `CREATE DATABASE ai_chatbot;`.
7. **Switch to Database**: Use `\c ai_chatbot` to switch to the newly created database.
8. **Initialize Database**: Execute the schema found at the route of the repository.
9. If you want to work with production data, you will need to take a dump of the tables. Please contact #squad-noc-eng for assistance.


### Environment Configuration

1. **Create .env File**: In the project directory, create a `.env` file with the following variables:

```
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=ai_chatbot
POSTGRES_PASSWORD=postgres
POSTGRES_DATABASE=ai_chatbot

LOCAL=true
LOCAL_USERNAME=ANY_USERNAME
LOCAL_NAME=YOUR_FULL_NAME

HCAPTCHA_SECRET_KEY=YOUR_HCAPTCHA_API_KEY
INTERCOM_API_KEY=YOUR_INTERCOM_API_KEY
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
TELNYX_API_KEY=YOUR_TELNYX_API_KEY

JWT_SECRET=CAN_BE_ANY_STRING
AUTH_SECRET=CAN_BE_ANY_STRING
```

## Environment Setup

To run the project, you need to install Node. This project uses Node version 19.8.1. Consider installing NVM if you have version <19. https://github.com/nvm-sh/nvm

## Starting the App

1. Install the project dependencies with `yarn`.
2. Start the project backend with `yarn run dev:backend`.