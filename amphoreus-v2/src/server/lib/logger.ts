// src/server/lib/logger.ts
// Minimal Winston logger — full configuration (transports, JSON format, log rotation)
// will be added in Milestone 03 (Backend Core).
import winston from "winston";

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format:
    process.env.NODE_ENV === "production"
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
  transports: [new winston.transports.Console()],
});
