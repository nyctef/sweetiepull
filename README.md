basic running:

```
npm install
cp config.js.example config.js
edit config.js
nodejs server.js
```

running with docker:

```
# dev:
docker-compose up --build --force-recreate -d

# pushing up to a server (without using an image repository):
docker save sweetiepull -o sweetiepull.tar
docker load -i sweetiepull.tar
docker-compose up --force-recreate -d
```
