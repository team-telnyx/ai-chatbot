tag := red
service := ai-chatbot
port := 3000

main_image := $(service):$(tag)
node_version := 19.8.1

docker_build_args = \
	--build-arg GIT_COMMIT=$(shell git show -s --format=%H) \
	--build-arg GIT_COMMIT_DATE="$(shell git show -s --format=%ci)" \
	--build-arg IMAGE_NAME=$(service) \
	--build-arg BUILD_DATE=$(shell date -u +"%Y-%m-%dT%T.%N%Z") \
	--build-arg BUILD_URL=$(BUILD_URL) \
	--build-arg VER_NODE=$(node_version) \

.PHONY: build
build:
	docker build $(docker_build_args) --tag $(main_image) .

.PHONY: start
start:
	docker compose up -d

.PHONY: stop
stop:
	docker compose down

.PHONY: startdev
startdev:
	docker compose -f docker-compose.yml up -d

.PHONY: test
test:
	yarn run test