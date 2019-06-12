# EECS Office Hours Queue
A simple, web-based queueing system for office hours. If you'd like to contribute, here's how to get a development environment set up...

### Install Docker

[https://docs.docker.com/install/](https://docs.docker.com/install/)

### Clone the repo to your local machine.

### Build the `eecsoh` Image

In the base directory of the repository:
```console
docker build --tag=eecsoh .
```

### Run a container

```console
docker run -d -i -t --rm -p 8080:80 -e ALLOW_OVERRIDE=All -v $PWD/public/:/var/www/html -v $PWD/php/:/var/www/php -v eecsoh-db:/var/lib/mysql --name eecsoh-container eecsoh
```

### Initialize Database

This only needs to be done the first time you launch the container.

```console
docker exec eecsoh-container bash -c '/var/www/sql/init_db.sh'
```

### Try it Out

That's it! Access the queue in your web browser at [http://localhost:8080/queue](http://localhost:8080/queue).

### Develop

First, install the local front-end development tools:
```console
npm install
```

You can edit the source files in the help_queue directory locally. Use whatever editor you like.

If you edit `queue.ts` or any other Typescript files, you'll need to recompile:
```console
npm run build
```

### Open a Terminal inside Container

```console
docker exec -i -t eecsoh-container bash
```

This might be useful if you need to e.g. access the mysql database directly.


