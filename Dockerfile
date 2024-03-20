FROM node:19.8.1

# set working directory
WORKDIR /src/app

# install app dependencies
COPY package.json ./
COPY yarn.lock ./

RUN yarn

COPY . ./

# compile backend ts into js
RUN yarn run build:backend

# make the entrypoint script executable
RUN chmod +x entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]