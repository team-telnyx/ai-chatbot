FROM node:19.8.1

# set working directory
WORKDIR /src/app

# add `/app/node_modules/.bin` to $PATH
ENV PATH /app/node_modules/.bin:$PATH

# install app dependencies
COPY package.json ./
COPY yarn.lock ./

RUN yarn

COPY . ./

# compile frontend into bundle
RUN yarn run build:frontend

# compile backend ts into js
RUN yarn run build:backend

EXPOSE 3000

# Copy start script and make it executable
COPY ./server/start.sh start.sh
RUN chmod +x start.sh

# start app using the shell script
ENTRYPOINT ["./start.sh"]