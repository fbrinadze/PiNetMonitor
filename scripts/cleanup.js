#!/usr/bin/env node

/**
 * Cleanup Script
 * Removes historical data older than the configured retention period
 */

const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

const DATA_DIR = process.env.DATA_DIR || path.join(require('os').homedir(), '.network-monitor');
const DATA_RETENTION_HOURS = parseInt(process.env.DATA_RETENTION_HOURS || '24', 10);

console.log('Network Monitor - Data Cleanup');
console.log('==============================');
console.log(`Data directory: ${DATA_DIR}`);
console.log(`Retention period: ${DATA_RETENTION_HOURS} hours`);
console.log('');

// Check if data directory exists
if (!fs.existsSync(DATA_DIR)) {
  console.log('Data directory does not exist. Nothing to clean up.');
  process.exit(0);
}

const dbPath = path.join(DATA_DIR, 'db.json');

// Check if database file exists
if (!fs.existsSync(dbPath)) {
  console.log('Database file does not exist. Nothing to clean up.');
  process.exit(0);
}

try {
  // Read database
  const dbContent = fs.readFileSync(dbPath, 'utf8');
  const db = JSON.parse(dbContent);

  const cutoffTime = new Date(Date.now() - DATA_RETENTION_HOURS * 60 * 60 * 1000);
  console.log(`Removing data older than: ${cutoffTime.toISOString()}`);
  console.log('');

  let removedCount = 0;

  // Clean up traffic stats
  if (db.trafficStats && Array.isArray(db.trafficStats)) {
    const originalCount = db.trafficStats.length;
    db.trafficStats = db.trafficStats.filter(stat => {
      const timestamp = new Date(stat.timestamp);
      return timestamp >= cutoffTime;
    });
    const removed = originalCount - db.trafficStats.length;
    removedCount += removed;
    console.log(`Traffic stats: Removed ${removed} entries (${db.trafficStats.length} remaining)`);
  }

  // Clean up health metrics
  if (db.healthMetrics && Array.isArray(db.healthMetrics)) {
    const originalCount = db.healthMetrics.length;
    db.healthMetrics = db.healthMetrics.filter(metric => {
      const timestamp = new Date(metric.lastUpdated);
      return timestamp >= cutoffTime;
    });
    const removed = originalCount - db.healthMetrics.length;
    removedCount += removed;
    console.log(`Health metrics: Removed ${removed} entries (${db.healthMetrics.length} remaining)`);
  }

  // Write back to database
  if (removedCount > 0) {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
    console.log('');
    console.log(`✓ Cleanup completed. Removed ${removedCount} total entries.`);
  } else {
    console.log('');
    console.log('✓ No old data found. Nothing to clean up.');
  }

} catch (error) {
  console.error('Error during cleanup:', error.message);
  process.exit(1);
}
