import { pool } from '../db';
import { sql } from 'drizzle-orm';
import logger from './logger';

export interface HealthCheckResult {
  status: 'ok' | 'error';
  timestamp: string;
  dependencies: {
    database: {
      status: 'connected' | 'disconnected' | 'error';
      responseTime?: number;
      error?: string;
    };
    memory: {
      status: 'ok' | 'warning' | 'critical';
      usage: {
        used: number;
        total: number;
        percentage: number;
      };
    };
    uptime: {
      status: 'ok';
      seconds: number;
      formatted: string;
    };
  };
  overall: 'healthy' | 'degraded' | 'unhealthy';
}

export async function performHealthCheck(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  logger.info('Starting health check', { timestamp });

  const result: HealthCheckResult = {
    status: 'ok',
    timestamp,
    dependencies: {
      database: {
        status: 'disconnected'
      },
      memory: {
        status: 'ok',
        usage: {
          used: 0,
          total: 0,
          percentage: 0
        }
      },
      uptime: {
        status: 'ok',
        seconds: 0,
        formatted: ''
      }
    },
    overall: 'healthy'
  };

  // Check database connection
  try {
    const dbStartTime = Date.now();
    
    // Simple database ping query using pool
    const client = await pool.connect();
    await client.query('SELECT 1 as ping');
    client.release();
    
    const dbResponseTime = Date.now() - dbStartTime;
    
    result.dependencies.database = {
      status: 'connected',
      responseTime: dbResponseTime
    };

    logger.info('Database health check passed', { 
      responseTime: dbResponseTime,
      timestamp 
    });

  } catch (error) {
    result.dependencies.database = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown database error'
    };
    result.status = 'error';
    
    logger.error('Database health check failed', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : error,
      timestamp
    });
  }

  // Check memory usage
  try {
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal;
    const usedMemory = memoryUsage.heapUsed;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    let memoryStatus: 'ok' | 'warning' | 'critical' = 'ok';
    if (memoryPercentage > 90) {
      memoryStatus = 'critical';
    } else if (memoryPercentage > 75) {
      memoryStatus = 'warning';
    }

    result.dependencies.memory = {
      status: memoryStatus,
      usage: {
        used: Math.round(usedMemory / 1024 / 1024), // Convert to MB
        total: Math.round(totalMemory / 1024 / 1024), // Convert to MB
        percentage: Math.round(memoryPercentage * 100) / 100
      }
    };

    if (memoryStatus === 'critical') {
      result.status = 'error';
    }

  } catch (error) {
    logger.error('Memory check failed', {
      error: error instanceof Error ? error.message : 'Unknown memory error',
      timestamp
    });
  }

  // Check uptime
  try {
    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    
    result.dependencies.uptime = {
      status: 'ok',
      seconds: uptimeSeconds,
      formatted: `${hours}h ${minutes}m ${seconds}s`
    };

  } catch (error) {
    logger.error('Uptime check failed', {
      error: error instanceof Error ? error.message : 'Unknown uptime error',
      timestamp
    });
  }

  // Determine overall health
  if (result.dependencies.database.status === 'error') {
    result.overall = 'unhealthy';
  } else if (result.dependencies.memory.status === 'critical') {
    result.overall = 'unhealthy';
  } else if (result.dependencies.memory.status === 'warning') {
    result.overall = 'degraded';
  } else {
    result.overall = 'healthy';
  }

  const totalTime = Date.now() - startTime;
  
  logger.info('Health check completed', {
    overall: result.overall,
    totalTime: `${totalTime}ms`,
    timestamp
  });

  return result;
}

export function getHealthCheckSummary(healthResult: HealthCheckResult): {
  statusCode: number;
  message: string;
} {
  switch (healthResult.overall) {
    case 'healthy':
      return {
        statusCode: 200,
        message: 'All systems operational'
      };
    case 'degraded':
      return {
        statusCode: 200,
        message: 'System operational with minor issues'
      };
    case 'unhealthy':
      return {
        statusCode: 503,
        message: 'System experiencing critical issues'
      };
    default:
      return {
        statusCode: 500,
        message: 'Unknown system status'
      };
  }
}