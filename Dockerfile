# Dockerfile
FROM node:12
WORKDIR /opt/cboard-api/
COPY . /opt/cboard-api/

RUN ls -a
RUN pwd
RUN chmod 777 google-auth.json
RUN npm install -g node-gyp 
RUN npm install -g swagger
RUN npm install

EXPOSE 80 10010
CMD [ "npm", "start"]