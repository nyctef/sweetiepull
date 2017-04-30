docker rm -f sweetiepull
docker build -t sweetiepull .
docker run --detach --network=spnet --name sweetiepull sweetiepull
