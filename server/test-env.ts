import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Print the APP_URL environment variable
console.log('APP_URL from environment:', process.env.APP_URL);