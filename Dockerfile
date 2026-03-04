FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

# Use --host to allow external access (from outside the container)
CMD ["npm", "run", "dev", "--", "--host", "--port", "3000"]