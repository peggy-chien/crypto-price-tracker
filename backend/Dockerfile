FROM python:3.11-slim AS base

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create a non-root user
RUN groupadd -r app && useradd -m -g app app
USER app

EXPOSE 5000

CMD ["python", "app.py"] 