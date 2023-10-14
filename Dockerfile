# The Node version should always match what's in .nvmrc.
FROM node:18.18.2
WORKDIR /opt/cboard-api/
COPY . /opt/cboard-api/

RUN npm install -g node-gyp 
RUN npm install -g swagger
RUN npm install

EXPOSE 80 10010
CMD [ "npm", "start"]