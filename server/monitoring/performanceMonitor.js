const os = require('os');
const { logPerformance } = require('./logger');
const { pool } = require('../db');

// Track the number of active database connections
let activeConnections = 0;
// Track average query times
let queryTimes = [];
const MAX_QUERY_SAMPLES = 100;

// Update tracked metrics
function addQueryTime(time) {
  queryTimes.push(time);
  // Keep only the most recent samples
  if (queryTimes.length > MAX_QUERY_SAMPLES) {
    queryTimes.shift();
  }
}

// Get average query time
function getAverageQueryTime() {
  if (queryTimes.length === 0) return 0;
  const sum = queryTimes.reduce((acc, time) => acc + time, 0);
  return Math.round(sum / queryTimes.length);
}

// Monitor database query performance
function monitorQuery(originalMethod, client) {
  return async function(...args) {
    const startTime = Date.now();
    activeConnections++;
    
    try {
      const result = await originalMethod.apply(client, args);
      const queryTime = Date.now() - startTime;
      addQueryTime(queryTime);
      return result;
    } catch (error) {
      throw error;
    } finally {
      activeConnections--;
    }
  };
}

// Patch the database pool to monitor connections
function patchPool() {
  const originalConnect = pool.connect;
  
  pool.connect = async function() {
    const client = await originalConnect.apply(this);
    const originalQuery = client.query;
    
    client.query = monitorQuery(originalQuery, client);
    
    return client;
  };
}

// Collect system performance metrics
function collectPerformanceMetrics() {
  // Calculate CPU usage
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;
  
  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });
  
  // Calculate CPU usage percentage
  const cpuUsage = Math.round((1 - totalIdle / totalTick) * 100);
  
  // Get memory usage in MB
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const memoryUsage = Math.round((totalMemory - freeMemory) / (1024 * 1024));
  
  // Get average query time
  const queryTime = getAverageQueryTime();
  
  return {
    cpuUsage,
    memoryUsage,
    activeConnections,
    queryTime
  };
}

// Schedule regular performance logging
let monitorInterval = null;

function startMonitoring(intervalMs = 60000) { // Default: log every minute
  if (monitorInterval) {
    clearInterval(monitorInterval);
  }
  
  // Initial metrics capture
  logPerformance(collectPerformanceMetrics());
  
  // Schedule regular logging
  monitorInterval = setInterval(() => {
    const metrics = collectPerformanceMetrics();
    logPerformance(metrics);
    
    // More detailed logging for unusual activity
    if (metrics.cpuUsage > 70 || metrics.activeConnections > 5) {
      console.warn(`[PERFORMANCE ALERT] High resource usage: CPU ${metrics.cpuUsage}%, DB Connections: ${metrics.activeConnections}`);
    }
  }, intervalMs);
  
  // Patch the database pool for query monitoring
  patchPool();
  
  return monitorInterval;
}

function stopMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}

module.exports = {
  startMonitoring,
  stopMonitoring,
  collectPerformanceMetrics
};