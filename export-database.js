#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function exportDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting database export...');
    
    // Get all table names
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    console.log(`📊 Found ${tables.length} tables to export:`, tables.join(', '));
    
    let sqlDump = '';
    
    // Add header
    sqlDump += `-- Database Export
-- Generated on: ${new Date().toISOString()}
-- Tables: ${tables.length}

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

`;

    // Export schema and data for each table
    for (const tableName of tables) {
      console.log(`📋 Exporting table: ${tableName}`);
      
      // Get table schema
      const schemaResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
        ORDER BY ordinal_position;
      `, [tableName]);
      
      sqlDump += `-- Table: ${tableName}\n`;
      sqlDump += `DROP TABLE IF EXISTS "${tableName}" CASCADE;\n`;
      
      // Get CREATE TABLE statement
      const createTableResult = await client.query(`
        SELECT 
          'CREATE TABLE "' || table_name || '" (' ||
          string_agg(
            '"' || column_name || '" ' || 
            CASE 
              WHEN data_type = 'character varying' THEN 'VARCHAR' || COALESCE('(' || character_maximum_length || ')', '')
              WHEN data_type = 'character' THEN 'CHAR' || COALESCE('(' || character_maximum_length || ')', '')
              WHEN data_type = 'numeric' THEN 'NUMERIC' || COALESCE('(' || numeric_precision || ',' || numeric_scale || ')', '')
              WHEN data_type = 'integer' THEN 'INTEGER'
              WHEN data_type = 'bigint' THEN 'BIGINT'
              WHEN data_type = 'smallint' THEN 'SMALLINT'
              WHEN data_type = 'boolean' THEN 'BOOLEAN'
              WHEN data_type = 'text' THEN 'TEXT'
              WHEN data_type = 'timestamp without time zone' THEN 'TIMESTAMP'
              WHEN data_type = 'timestamp with time zone' THEN 'TIMESTAMPTZ'
              WHEN data_type = 'date' THEN 'DATE'
              WHEN data_type = 'time without time zone' THEN 'TIME'
              WHEN data_type = 'jsonb' THEN 'JSONB'
              WHEN data_type = 'json' THEN 'JSON'
              WHEN data_type = 'uuid' THEN 'UUID'
              WHEN data_type = 'ARRAY' THEN data_type
              ELSE UPPER(data_type)
            END ||
            CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
            CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
            ', '
          ) || ');' as create_statement
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
        GROUP BY table_name;
      `, [tableName]);
      
      if (createTableResult.rows.length > 0) {
        sqlDump += createTableResult.rows[0].create_statement + '\n\n';
      }
      
      // Get data
      const dataResult = await client.query(`SELECT * FROM "${tableName}"`);
      
      if (dataResult.rows.length > 0) {
        const columns = Object.keys(dataResult.rows[0]);
        const columnNames = columns.map(col => `"${col}"`).join(', ');
        
        sqlDump += `-- Data for table: ${tableName}\n`;
        
        for (const row of dataResult.rows) {
          const values = columns.map(col => {
            const value = row[col];
            if (value === null) return 'NULL';
            if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
            if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
            if (value instanceof Date) return `'${value.toISOString()}'`;
            if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
            return value;
          }).join(', ');
          
          sqlDump += `INSERT INTO "${tableName}" (${columnNames}) VALUES (${values});\n`;
        }
        
        sqlDump += '\n';
      }
    }
    
    // Get sequences and reset them
    const sequencesResult = await client.query(`
      SELECT sequence_name 
      FROM information_schema.sequences 
      WHERE sequence_schema = 'public';
    `);
    
    if (sequencesResult.rows.length > 0) {
      sqlDump += '-- Reset sequences\n';
      for (const seq of sequencesResult.rows) {
        const seqName = seq.sequence_name;
        const tableName = seqName.replace(/_id_seq$/, '');
        sqlDump += `SELECT setval('${seqName}', COALESCE((SELECT MAX(id) FROM "${tableName}"), 1));\n`;
      }
      sqlDump += '\n';
    }
    
    // Create export directory if it doesn't exist
    const exportDir = path.join(process.cwd(), 'database_exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    // Write to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `database_export_${timestamp}.sql`;
    const filepath = path.join(exportDir, filename);
    
    fs.writeFileSync(filepath, sqlDump);
    
    console.log(`✅ Database export completed!`);
    console.log(`📁 File saved to: ${filepath}`);
    console.log(`📊 Export size: ${(fs.statSync(filepath).size / 1024 / 1024).toFixed(2)} MB`);
    
    // Also create a JSON export for easier programmatic access
    const jsonData = {};
    for (const tableName of tables) {
      const dataResult = await client.query(`SELECT * FROM "${tableName}"`);
      jsonData[tableName] = dataResult.rows;
    }
    
    const jsonFilename = `database_export_${timestamp}.json`;
    const jsonFilepath = path.join(exportDir, jsonFilename);
    fs.writeFileSync(jsonFilepath, JSON.stringify(jsonData, null, 2));
    
    console.log(`📄 JSON export also saved to: ${jsonFilepath}`);
    console.log(`📊 JSON size: ${(fs.statSync(jsonFilepath).size / 1024 / 1024).toFixed(2)} MB`);
    
    return { sqlFile: filepath, jsonFile: jsonFilepath };
    
  } catch (error) {
    console.error('❌ Error during database export:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the export
if (require.main === module) {
  exportDatabase()
    .then(({ sqlFile, jsonFile }) => {
      console.log('\n🎉 Database export successful!');
      console.log(`SQL file: ${sqlFile}`);
      console.log(`JSON file: ${jsonFile}`);
    })
    .catch(error => {
      console.error('Export failed:', error);
      process.exit(1);
    });
}

module.exports = exportDatabase;