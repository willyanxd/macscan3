import sqlite3 from 'sqlite3';
import { promisify } from 'util';

export class Database {
  constructor(dbPath = './data/mac_scanner.db') {
    this.dbPath = dbPath;
    this.db = null;
  }

  async initialize() {
    try {
      // Ensure data directory exists
      const fs = await import('fs');
      const path = await import('path');
      
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.db = new sqlite3.Database(this.dbPath);
      
      // Promisify database methods
      this.db.run = promisify(this.db.run.bind(this.db));
      this.db.get = promisify(this.db.get.bind(this.db));
      this.db.all = promisify(this.db.all.bind(this.db));

      await this.createTables();
      console.log('✅ Database connection established');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  async createTables() {
    const tables = [
      // Jobs table
      `CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        vlan_id INTEGER,
        schedule_type TEXT DEFAULT 'manual',
        schedule_interval INTEGER,
        retention_policy TEXT DEFAULT '7days',
        notifications_enabled BOOLEAN DEFAULT 1,
        warning_notifications BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1
      )`,

      // Switches table
      `CREATE TABLE IF NOT EXISTS switches (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER DEFAULT 22,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
      )`,

      // Known devices table
      `CREATE TABLE IF NOT EXISTS known_devices (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        mac_address TEXT NOT NULL,
        switch_id TEXT NOT NULL,
        vlan_id INTEGER,
        is_authorized BOOLEAN DEFAULT 0,
        first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'offline',
        device_name TEXT,
        FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE,
        FOREIGN KEY (switch_id) REFERENCES switches (id) ON DELETE CASCADE,
        UNIQUE(job_id, mac_address, switch_id)
      )`,

      // Job history table
      `CREATE TABLE IF NOT EXISTS job_history (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        execution_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL,
        devices_found INTEGER DEFAULT 0,
        new_devices INTEGER DEFAULT 0,
        unauthorized_devices INTEGER DEFAULT 0,
        error_message TEXT,
        duration INTEGER,
        FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
      )`,

      // Notifications table
      `CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        severity TEXT DEFAULT 'info',
        is_read BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
      )`,

      // Whitelist table
      `CREATE TABLE IF NOT EXISTS whitelist (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        mac_address TEXT NOT NULL,
        device_name TEXT,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE,
        UNIQUE(job_id, mac_address)
      )`
    ];

    for (const table of tables) {
      await this.db.run(table);
    }

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_known_devices_job_id ON known_devices(job_id)',
      'CREATE INDEX IF NOT EXISTS idx_known_devices_mac ON known_devices(mac_address)',
      'CREATE INDEX IF NOT EXISTS idx_job_history_job_id ON job_history(job_id)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_job_id ON notifications(job_id)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read)',
      'CREATE INDEX IF NOT EXISTS idx_whitelist_job_id ON whitelist(job_id)'
    ];

    for (const index of indexes) {
      await this.db.run(index);
    }
  }

  async close() {
    if (this.db) {
      await new Promise((resolve, reject) => {
        this.db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('✅ Database connection closed');
    }
  }

  // Generic query methods
  async run(sql, params = []) {
    try {
      return await this.db.run(sql, params);
    } catch (error) {
      console.error('Database run error:', error);
      throw error;
    }
  }

  async get(sql, params = []) {
    try {
      return await this.db.get(sql, params);
    } catch (error) {
      console.error('Database get error:', error);
      throw error;
    }
  }

  async all(sql, params = []) {
    try {
      return await this.db.all(sql, params);
    } catch (error) {
      console.error('Database all error:', error);
      throw error;
    }
  }
}