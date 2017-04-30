FROM node

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV

# copy just package.json first so that we can cache the npm install step
COPY package.json /usr/src/app/
RUN npm install && npm cache clean

# now copy everything else
COPY . /usr/src/app/

CMD [ "npm", "start" ]
