# The Node version should always match what's in .nvmrc.
FROM node:26.5.1
WORKDIR /opt/cboard-api/
COPY . /opt/cboard-api/

RUN npm install -g node-gyp 
RUN npm install -g swagger
RUN npm ci

EXPOSE 80 10010
CMD [ "npm", "start"]
