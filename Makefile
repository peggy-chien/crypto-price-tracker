up:
	docker-compose -f docker-compose.yml up --build frontend backend

up-dev:
	docker-compose up --build frontend backend

build:
	docker-compose -f docker-compose.yml build frontend backend

build-dev:
	docker-compose build frontend backend

down:
	docker-compose -f docker-compose.yml down

down-dev:
	docker-compose down

clean:
	docker-compose -f docker-compose.yml down -v --rmi all --remove-orphans

clean-dev:
	docker-compose down -v --rmi all --remove-orphans

pause:
	docker-compose -f docker-compose.yml pause

pause-dev:
	docker-compose pause

resume:
	docker-compose -f docker-compose.yml unpause

resume-dev:
	docker-compose unpause