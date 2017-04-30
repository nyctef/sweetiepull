docker rm -f sweetiepull
docker build -t sweetiepull .
docker run --detach --network=spnet --name sweetiepull --publish 50505:3000 sweetiepull
