/**
 * Payment Audit Service
 * Provides comprehensive audit logging for all payment and invoice operations
 */
import { db } from '../db';

export interface AuditLogEntry {
  entityType: 'invoice' | 'payment';
  entityId: number;
  action: 'created' | 'updated' | 'status_changed' | 'deleted' | 'payment_added' | 'payment_removed';
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  userId?: number;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
}

export class PaymentAuditService {
  static async logAction(entry: AuditLogEntry): Promise<void> {
    try {
      await db.query(`
        INSERT INTO payment_audit_log (
          entity_type, entity_id, action, old_values, new_values,
          user_id, user_name, ip_address, user_agent, reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        entry.entityType,
        entry.entityId,
        entry.action,
        entry.oldValues ? JSON.stringify(entry.oldValues) : null,
        entry.newValues ? JSON.stringify(entry.newValues) : null,
        entry.userId || null,
        entry.userName || null,
        entry.ipAddress || null,
        entry.userAgent || null,
        entry.reason || null
      ]);

      console.log(`[AUDIT] ${entry.action} ${entry.entityType} ${entry.entityId} by user ${entry.userName || entry.userId || 'system'}`);
    } catch (error) {
      console.error('Failed to log audit entry:', error);
      // Don't throw - audit failures shouldn't break business operations
    }
  }

  static async getAuditTrail(entityType: 'invoice' | 'payment', entityId: number): Promise<any[]> {
    try {
      const result = await db.query(`
        SELECT pal.*, u.full_name as user_full_name
        FROM payment_audit_log pal
        LEFT JOIN users u ON pal.user_id = u.id
        WHERE entity_type = $1 AND entity_id = $2
        ORDER BY timestamp DESC
      `, [entityType, entityId]);

      return result.rows;
    } catch (error) {
      console.error('Failed to fetch audit trail:', error);
      return [];
    }
  }

  static async getRecentActivity(limit: number = 50): Promise<any[]> {
    try {
      const result = await db.query(`
        SELECT pal.*, u.full_name as user_full_name
        FROM payment_audit_log pal
        LEFT JOIN users u ON pal.user_id = u.id
        ORDER BY timestamp DESC
        LIMIT $1
      `, [limit]);

      return result.rows;
    } catch (error) {
      console.error('Failed to fetch recent activity:', error);
      return [];
    }
  }
}