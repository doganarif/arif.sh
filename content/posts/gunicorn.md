+++
title = "Senior Developer's Guide to Dockerizing Django with NumPy and Gunicorn"
date = "2021-01-20"
author = "Arif"
tags = ["Django", "Docker", "NumPy", "Gunicorn", "Python", "DevOps"]
+++

As senior developers, we often face the challenge of containerizing complex Django applications. Today, we'll tackle Dockerizing a Django project that uses NumPy and Pillow, optimized for production with Gunicorn. We'll focus on security, performance, and maintainability.

## Tech Stack

- Django
- NumPy
- Pillow
- PostgreSQL
- Gunicorn
- Docker

## The Sophisticated Dockerfile

Let's create a production-ready Dockerfile:

```dockerfile
# Use an official Python runtime as a parent image
FROM python:3.9-slim-buster as builder

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set work directory
WORKDIR /usr/src/app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libjpeg-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /usr/src/app/wheels -r requirements.txt

# Final stage
FROM python:3.9-slim-buster

# Create directory for the app user
RUN mkdir -p /home/app

# Create the app user
RUN groupadd app && useradd -g app app

# Create the home directory
ENV HOME=/home/app
ENV APP_HOME=/home/app/web
RUN mkdir $APP_HOME
WORKDIR $APP_HOME

# Install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    libjpeg-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/src/app/wheels /wheels
COPY --from=builder /usr/src/app/requirements.txt .
RUN pip install --no-cache /wheels/*

# Copy project
COPY . $APP_HOME

# Chown all the files to the app user
RUN chown -R app:app $APP_HOME

# Change to the app user
USER app

# Run gunicorn
CMD gunicorn --bind 0.0.0.0:$PORT --workers $WORKERS --threads $THREADS --worker-class gthread your_project.wsgi:application
```

This Dockerfile uses multi-stage building to reduce the final image size and runs the application as a non-root user for improved security.

## Optimized Django Settings

Create a `settings` folder with `base.py`, `development.py`, and `production.py`:

```python
# settings/base.py
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')

DEBUG = False

ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', '').split(',')

# ... rest of your settings ...

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}

# ... more settings ...

# settings/production.py
from .base import *

DEBUG = False

# Enable HSTS
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Enable SSL redirect
SECURE_SSL_REDIRECT = True

# Set secure cookie settings
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
```

## Docker Compose for Local Development

Create a `docker-compose.yml` for easy local development:

```yaml
version: '3.8'

services:
  web:
    build: .
    command: python manage.py runserver 0.0.0.0:8000
    volumes:
      - .:/home/app/web
    ports:
      - "8000:8000"
    env_file:
      - .env.dev
    depends_on:
      - db
  db:
    image: postgres:13
    volumes:
      - postgres_data:/var/lib/postgresql/data/
    environment:
      - POSTGRES_USER=your_db_user
      - POSTGRES_PASSWORD=your_db_password
      - POSTGRES_DB=your_db_name

volumes:
  postgres_data:
```

## Environment Variables

Create a `.env.dev` file for development:

```
DEBUG=True
SECRET_KEY=your_secret_key
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DB_NAME=your_db_name
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=db
DB_PORT=5432
```

## Makefile for Convenience

Create a comprehensive Makefile:

```makefile
.PHONY: build run test migrate shell clean

build:
	docker-compose build

run:
	docker-compose up

test:
	docker-compose run web python manage.py test

migrate:
	docker-compose run web python manage.py migrate

shell:
	docker-compose run web python manage.py shell

clean:
	docker-compose down -v
```

## Gunicorn Configuration

Create a `gunicorn.conf.py` file:

```python
import multiprocessing

# Number of worker processes
workers = multiprocessing.cpu_count() * 2 + 1

# Number of threads per worker
threads = 4

# Maximum requests a worker will process before restarting
max_requests = 1000
max_requests_jitter = 50

# Time to wait for requests on a Keep-Alive connection
keepalive = 5

# Log level
loglevel = 'info'

# Access log format
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# Error log file
errorlog = '-'

# Access log file
accesslog = '-'
```

## Conclusion

This setup provides a robust, scalable, and secure environment for running Django applications with complex dependencies like NumPy and Pillow. Key takeaways:

1. Use multi-stage builds to reduce image size.
2. Run your application as a non-root user.
3. Use environment variables for configuration.
4. Implement proper settings for development and production environments.
5. Use Docker Compose for local development.
6. Create a Makefile for common tasks.
7. Configure Gunicorn for optimal performance.

Remember, always review and adjust these configurations based on your specific needs and security requirements. Regularly update your dependencies and Docker images to patch any vulnerabilities.
