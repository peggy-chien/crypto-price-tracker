up-dev:
	docker-compose -f docker-compose.yml -f docker-compose.override.yml up --build frontend backend

build-dev:
	docker-compose -f docker-compose.yml -f docker-compose.override.yml build frontend backend

up-prod:
	docker-compose -f docker-compose.yml up --build frontend backend

build-prod:
	docker-compose -f docker-compose.yml build frontend backend

down:
	docker-compose -f docker-compose.yml -f docker-compose.override.yml down

clean:
	docker-compose -f docker-compose.yml -f docker-compose.override.yml down -v --rmi all --remove-orphans 