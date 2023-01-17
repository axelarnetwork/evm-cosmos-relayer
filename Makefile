# Spin up docker compose with force recreated
up-force:
	rm -rf .db && docker-compose up -d --force-recreate

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker logs db -f

prisma-pull:
	npx prisma db pull

prisma-generate:
	npx prisma generate

prisma-push:
	npx prisma db push
