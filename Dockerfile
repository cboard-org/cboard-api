# The Node version should always match what's in .nvmrc.
FROM node:18.18.1
WORKDIR /opt/cboard-api/
COPY . /opt/cboard-api/

RUN npm install -g node-gyp 
RUN npm install -g swagger
#RUN npm install -g yarn
RUN yarn install

EXPOSE 80 10010
CMD [ "yarn", "start"]
