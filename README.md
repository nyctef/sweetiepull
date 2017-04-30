basic running:

```
npm install node azure redis
cat '[azure service bus key]' > sb_account_key.txt
nodejs server.js
```

running with docker:

```
# build docker container
docker build -t sweetiepull .

# create a docker network
docker network create spnet

# run a redis instance for sweetiepull to connect to
docker run --detach --network=spnet --name spredis --volume "$(pwd)/data:/data" redis

# run sweetiepull
docker run --detach --network=spnet --name sweetiepull sweetiepull

# watch sweetiepull output
docker logs --follow sweetiepull
```
