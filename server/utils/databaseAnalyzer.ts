import { sql } from 'drizzle-orm';
import { db } from '../db';

export interface QueryPerformanceMetrics {
  query: string;
  executionTime: number;
  rowsReturned: number;
  indexesUsed: string[];
  scanType: 'Index Scan' | 'Sequential Scan' | 'Bitmap Scan' | 'Other';
  cost: number;
}

export interface IndexUsageStats {
  schemaName: string;
  tableName: string;
  indexName: string;
  indexScans: number;
  tuplesRead: number;
  tuplesFetched: number;
  indexSize: string;
  isUnused: boolean;
}

export interface TableStats {
  tableName: string;
  rowCount: number;
  tableSize: string;
  indexSize: string;
  totalSize: string;
  lastVacuum: Date | null;
  lastAnalyze: Date | null;
}

export class DatabaseAnalyzer {
  /**
   * Get performance metrics for a specific query
   */
  static async analyzeQuery(query: string): Promise<QueryPerformanceMetrics> {
    const startTime = Date.now();
    
    // Execute EXPLAIN ANALYZE to get detailed performance metrics
    const explainResult = await db.execute(
      sql.raw(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`)
    );
    
    const executionTime = Date.now() - startTime;
    const planData = explainResult[0]?.['QUERY PLAN']?.[0];
    
    if (!planData) {
      throw new Error('Unable to analyze query plan');
    }
    
    const plan = planData.Plan;
    const indexesUsed = this.extractIndexesFromPlan(plan);
    const scanType = this.determineScanType(plan);
    
    return {
      query,
      executionTime: planData['Execution Time'] || executionTime,
      rowsReturned: plan['Actual Rows'] || 0,
      indexesUsed,
      scanType,
      cost: plan['Total Cost'] || 0
    };
  }

  /**
   * Get comprehensive index usage statistics
   */
  static async getIndexUsageStats(): Promise<IndexUsageStats[]> {
    const result = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
        CASE WHEN idx_scan = 0 THEN true ELSE false END as is_unused
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      ORDER BY idx_scan DESC, pg_relation_size(indexrelid) DESC
    `);

    return result.map(row => ({
      schemaName: row.schemaname,
      tableName: row.tablename,
      indexName: row.indexname,
      indexScans: row.idx_scan,
      tuplesRead: row.idx_tup_read,
      tuplesFetched: row.idx_tup_fetch,
      indexSize: row.index_size,
      isUnused: row.is_unused
    }));
  }

  /**
   * Get table statistics including size and maintenance info
   */
  static async getTableStats(): Promise<TableStats[]> {
    const result = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins + n_tup_upd + n_tup_del as row_count,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size,
        last_vacuum,
        last_analyze
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `);

    return result.map(row => ({
      tableName: row.tablename,
      rowCount: row.row_count || 0,
      tableSize: row.table_size,
      indexSize: row.index_size,
      totalSize: row.total_size,
      lastVacuum: row.last_vacuum,
      lastAnalyze: row.last_analyze
    }));
  }

  /**
   * Identify slow queries from pg_stat_statements (if available)
   */
  static async getSlowQueries(limit: number = 10): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          min_time,
          max_time,
          rows,
          100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat_statements%'
        ORDER BY mean_time DESC
        LIMIT ${limit}
      `);

      return result;
    } catch (error) {
      // pg_stat_statements extension might not be installed
      return [];
    }
  }

  /**
   * Get missing index recommendations based on query patterns
   */
  static async getMissingIndexRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];

    // Analyze tables without proper indexes
    const result = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        seq_scan,
        seq_tup_read,
        idx_scan,
        n_tup_ins + n_tup_upd + n_tup_del as modifications
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      AND seq_scan > 0
      ORDER BY seq_tup_read DESC
    `);

    for (const row of result) {
      const seqScanRatio = row.seq_scan / (row.seq_scan + (row.idx_scan || 1));
      
      if (seqScanRatio > 0.1 && row.seq_tup_read > 1000) {
        recommendations.push(
          `Consider adding indexes to ${row.tablename} - High sequential scan ratio (${(seqScanRatio * 100).toFixed(1)}%)`
        );
      }
    }

    return recommendations;
  }

  /**
   * Benchmark common warehouse operations
   */
  static async benchmarkOperations(): Promise<Record<string, number>> {
    const benchmarks: Record<string, number> = {};

    // Product SKU lookup
    const skuStart = Date.now();
    await db.execute(sql`SELECT * FROM products WHERE sku = 'BENCHMARK-TEST' LIMIT 1`);
    benchmarks.productSkuLookup = Date.now() - skuStart;

    // Order status filter
    const statusStart = Date.now();
    await db.execute(sql`SELECT * FROM orders WHERE status = 'pending' LIMIT 10`);
    benchmarks.orderStatusFilter = Date.now() - statusStart;

    // Low stock products
    const stockStart = Date.now();
    await db.execute(sql`SELECT * FROM products WHERE current_stock <= min_stock_level LIMIT 10`);
    benchmarks.lowStockQuery = Date.now() - stockStart;

    // Customer order history
    const historyStart = Date.now();
    await db.execute(sql`SELECT * FROM orders WHERE customer_name = 'Test Customer' ORDER BY order_date DESC LIMIT 10`);
    benchmarks.customerHistory = Date.now() - historyStart;

    return benchmarks;
  }

  /**
   * Extract indexes used from query execution plan
   */
  private static extractIndexesFromPlan(plan: any): string[] {
    const indexes: string[] = [];
    
    if (plan['Index Name']) {
      indexes.push(plan['Index Name']);
    }

    if (plan.Plans) {
      for (const subPlan of plan.Plans) {
        indexes.push(...this.extractIndexesFromPlan(subPlan));
      }
    }

    return indexes.filter((index, i, arr) => arr.indexOf(index) === i);
  }

  /**
   * Determine the primary scan type from execution plan
   */
  private static determineScanType(plan: any): QueryPerformanceMetrics['scanType'] {
    const nodeType = plan['Node Type'];
    
    if (nodeType.includes('Index')) return 'Index Scan';
    if (nodeType.includes('Seq')) return 'Sequential Scan';
    if (nodeType.includes('Bitmap')) return 'Bitmap Scan';
    
    return 'Other';
  }

  /**
   * Generate performance recommendations
   */
  static async generateRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];
    
    // Check for unused indexes
    const indexStats = await this.getIndexUsageStats();
    const unusedIndexes = indexStats.filter(stat => stat.isUnused);
    
    if (unusedIndexes.length > 0) {
      recommendations.push(
        `Found ${unusedIndexes.length} unused indexes that could be dropped to improve write performance`
      );
    }

    // Check for missing indexes
    const missingIndexRecs = await this.getMissingIndexRecommendations();
    recommendations.push(...missingIndexRecs);

    // Check table maintenance
    const tableStats = await this.getTableStats();
    const needsVacuum = tableStats.filter(stat => 
      !stat.lastVacuum || (Date.now() - stat.lastVacuum.getTime()) > 7 * 24 * 60 * 60 * 1000
    );

    if (needsVacuum.length > 0) {
      recommendations.push(
        `${needsVacuum.length} tables need VACUUM maintenance for optimal performance`
      );
    }

    return recommendations;
  }

  /**
   * Run comprehensive database health check
   */
  static async healthCheck(): Promise<{
    indexHealth: IndexUsageStats[];
    tableHealth: TableStats[];
    recommendations: string[];
    benchmarks: Record<string, number>;
    slowQueries: any[];
  }> {
    const [indexHealth, tableHealth, recommendations, benchmarks, slowQueries] = await Promise.all([
      this.getIndexUsageStats(),
      this.getTableStats(),
      this.generateRecommendations(),
      this.benchmarkOperations(),
      this.getSlowQueries()
    ]);

    return {
      indexHealth,
      tableHealth,
      recommendations,
      benchmarks,
      slowQueries
    };
  }
}