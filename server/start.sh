#!/bin/bash

# Entry-Point for starting application
# Loads environment variables from the vault when using secrets_from: file

set -o allexport
source /vault/secrets/noc-chatbot.env
set +o allexport
npm run server