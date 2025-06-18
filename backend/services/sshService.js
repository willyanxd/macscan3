import { Client } from 'ssh2';

export class SSHService {
  constructor() {
    this.connections = new Map();
    this.debugMode = process.env.SSH_DEBUG === 'true';
  }

  /**
   * Enhanced SSH connection test with detailed debugging
   * @param {Object} switchConfig - Switch configuration
   * @returns {Promise<Object>} Connection result with details
   */
  async testConnection(switchConfig) {
    const { host, port = 22, username, password } = switchConfig;
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const conn = new Client();
      let connectionDetails = {
        success: false,
        message: '',
        details: {
          host,
          port,
          username,
          connectionTime: 0,
          sshVersion: null,
          algorithms: null,
          error: null
        }
      };

      const timeout = setTimeout(() => {
        conn.end();
        connectionDetails.message = 'Connection timeout (10 seconds)';
        connectionDetails.details.error = 'TIMEOUT';
        resolve(connectionDetails);
      }, 10000);

      conn.on('ready', () => {
        clearTimeout(timeout);
        connectionDetails.success = true;
        connectionDetails.message = 'Connection successful';
        connectionDetails.details.connectionTime = Date.now() - startTime;
        
        // Test basic command execution
        conn.exec('echo "SSH_TEST_OK"', (err, stream) => {
          if (err) {
            connectionDetails.success = false;
            connectionDetails.message = 'Connected but command execution failed';
            connectionDetails.details.error = err.message;
          } else {
            stream.on('data', (data) => {
              if (data.toString().includes('SSH_TEST_OK')) {
                connectionDetails.message = 'Connection and command execution successful';
              }
            });
          }
          conn.end();
          resolve(connectionDetails);
        });
      });

      conn.on('handshake', (negotiated) => {
        connectionDetails.details.sshVersion = negotiated.serverVersion;
        connectionDetails.details.algorithms = {
          kex: negotiated.kex,
          cipher: negotiated.cs.cipher,
          hmac: negotiated.cs.hmac
        };
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        connectionDetails.success = false;
        connectionDetails.details.error = err.code || err.message;
        
        switch (err.code) {
          case 'ECONNREFUSED':
            connectionDetails.message = 'Connection refused - Check if SSH is enabled and port is correct';
            break;
          case 'ENOTFOUND':
            connectionDetails.message = 'Host not found - Check IP address';
            break;
          case 'ETIMEDOUT':
            connectionDetails.message = 'Connection timeout - Check network connectivity';
            break;
          case 'ECONNRESET':
            connectionDetails.message = 'Connection reset - Check firewall settings';
            break;
          default:
            if (err.message.includes('Authentication')) {
              connectionDetails.message = 'Authentication failed - Check username/password';
            } else {
              connectionDetails.message = `Connection failed: ${err.message}`;
            }
        }
        resolve(connectionDetails);
      });

      try {
        conn.connect({
          host,
          port,
          username,
          password,
          readyTimeout: 10000,
          algorithms: {
            kex: [
              'diffie-hellman-group14-sha256',
              'diffie-hellman-group14-sha1',
              'diffie-hellman-group1-sha1',
              'ecdh-sha2-nistp256',
              'ecdh-sha2-nistp384',
              'ecdh-sha2-nistp521'
            ],
            cipher: [
              'aes128-ctr',
              'aes192-ctr', 
              'aes256-ctr',
              'aes128-gcm',
              'aes256-gcm',
              'aes128-cbc',
              'aes192-cbc',
              'aes256-cbc',
              '3des-cbc'
            ],
            hmac: [
              'hmac-sha2-256',
              'hmac-sha2-512',
              'hmac-sha1',
              'hmac-md5'
            ]
          },
          debug: this.debugMode ? console.log : undefined
        });
      } catch (error) {
        clearTimeout(timeout);
        connectionDetails.success = false;
        connectionDetails.message = `Connection setup failed: ${error.message}`;
        connectionDetails.details.error = error.message;
        resolve(connectionDetails);
      }
    });
  }

  /**
   * Execute command on switch via SSH with enhanced error handling
   * @param {Object} switchConfig - Switch configuration
   * @param {string} command - Command to execute
   * @returns {Promise<Object>} Command result with output and metadata
   */
  async executeCommand(switchConfig, command) {
    const { host, port = 22, username, password } = switchConfig;
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let output = '';
      let errorOutput = '';
      
      const timeout = setTimeout(() => {
        conn.end();
        reject(new Error('Command execution timeout (30 seconds)'));
      }, 30000);

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            clearTimeout(timeout);
            conn.end();
            reject(new Error(`Command execution failed: ${err.message}`));
            return;
          }

          stream.on('close', (code, signal) => {
            clearTimeout(timeout);
            conn.end();
            
            const result = {
              success: code === 0,
              output: output.trim(),
              errorOutput: errorOutput.trim(),
              exitCode: code,
              signal,
              executionTime: Date.now() - startTime,
              command
            };

            if (code === 0) {
              resolve(result);
            } else {
              reject(new Error(`Command failed with exit code ${code}: ${errorOutput || output}`));
            }
          });

          stream.on('data', (data) => {
            output += data.toString();
          });

          stream.stderr.on('data', (data) => {
            errorOutput += data.toString();
          });
        });
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`SSH connection failed: ${err.message}`));
      });

      conn.connect({
        host,
        port,
        username,
        password,
        readyTimeout: 30000,
        algorithms: {
          kex: [
            'diffie-hellman-group14-sha256',
            'diffie-hellman-group14-sha1',
            'diffie-hellman-group1-sha1',
            'ecdh-sha2-nistp256'
          ],
          cipher: [
            'aes128-ctr',
            'aes192-ctr', 
            'aes256-ctr',
            'aes128-gcm',
            'aes256-gcm',
            'aes128-cbc',
            'aes192-cbc',
            'aes256-cbc'
          ],
          hmac: [
            'hmac-sha2-256',
            'hmac-sha2-512',
            'hmac-sha1'
          ]
        }
      });
    });
  }

  /**
   * Enhanced MAC address scanning with support for multiple switch types
   * @param {Object} switchConfig - Switch configuration
   * @param {number} vlanId - VLAN ID to scan
   * @returns {Promise<Object>} Scan results with metadata
   */
  async scanMacAddresses(switchConfig, vlanId) {
    try {
      const scanResults = {
        macAddresses: [],
        switchType: 'unknown',
        commandUsed: '',
        scanTime: Date.now(),
        success: false,
        details: {}
      };

      // Define commands for different switch types
      const switchCommands = [
        // Cisco IOS/IOS-XE
        {
          type: 'cisco_ios',
          commands: [
            `show mac address-table vlan ${vlanId}`,
            `show mac-address-table vlan ${vlanId}`,
            `show bridge address-table vlan ${vlanId}`
          ]
        },
        // HP/Aruba
        {
          type: 'hp_aruba',
          commands: [
            `show mac-address vlan ${vlanId}`,
            `show mac-address-table vlan ${vlanId}`,
            `show bridge address-table vlan ${vlanId}`
          ]
        },
        // Juniper
        {
          type: 'juniper',
          commands: [
            `show ethernet-switching table vlan ${vlanId}`,
            `show bridge mac-table vlan ${vlanId}`
          ]
        },
        // Dell
        {
          type: 'dell',
          commands: [
            `show mac address-table vlan ${vlanId}`,
            `show bridge address-table vlan ${vlanId}`
          ]
        },
        // Generic/Fallback
        {
          type: 'generic',
          commands: [
            `show mac-table vlan ${vlanId}`,
            `show fdb vlan ${vlanId}`,
            `show arp vlan ${vlanId}`
          ]
        }
      ];

      let lastError = null;

      // Try each switch type and command combination
      for (const switchType of switchCommands) {
        for (const command of switchType.commands) {
          try {
            console.log(`Trying ${switchType.type} command: ${command}`);
            const result = await this.executeCommand(switchConfig, command);
            
            if (result.success && result.output) {
              const macAddresses = this.parseMacAddresses(result.output, switchType.type);
              
              if (macAddresses.length > 0) {
                scanResults.macAddresses = macAddresses;
                scanResults.switchType = switchType.type;
                scanResults.commandUsed = command;
                scanResults.success = true;
                scanResults.details = {
                  rawOutput: result.output,
                  executionTime: result.executionTime,
                  outputLength: result.output.length
                };
                
                console.log(`✅ Successfully scanned ${macAddresses.length} MAC addresses using ${switchType.type} command`);
                return scanResults;
              }
            }
          } catch (error) {
            lastError = error;
            console.log(`❌ Command failed: ${command} - ${error.message}`);
            continue;
          }
        }
      }

      // If no commands worked, throw the last error
      if (lastError) {
        throw new Error(`All scan commands failed. Last error: ${lastError.message}`);
      } else {
        throw new Error('No MAC addresses found with any supported command');
      }

    } catch (error) {
      console.error(`Failed to scan MAC addresses from ${switchConfig.host}:`, error);
      throw error;
    }
  }

  /**
   * Enhanced MAC address parsing with support for multiple output formats
   * @param {string} output - Raw switch output
   * @param {string} switchType - Type of switch
   * @returns {Array} Array of MAC addresses
   */
  parseMacAddresses(output, switchType = 'generic') {
    const macAddresses = new Set();
    
    // Different regex patterns for different switch types
    const patterns = {
      cisco_ios: [
        /([0-9a-fA-F]{4}\.[0-9a-fA-F]{4}\.[0-9a-fA-F]{4})/g, // Cisco format: xxxx.xxxx.xxxx
        /([0-9a-fA-F]{2}[:-]){5}([0-9a-fA-F]{2})/g // Standard format: xx:xx:xx:xx:xx:xx
      ],
      hp_aruba: [
        /([0-9a-fA-F]{2}[:-]){5}([0-9a-fA-F]{2})/g,
        /([0-9a-fA-F]{6}-[0-9a-fA-F]{6})/g // HP format: xxxxxx-xxxxxx
      ],
      juniper: [
        /([0-9a-fA-F]{2}[:-]){5}([0-9a-fA-F]{2})/g
      ],
      dell: [
        /([0-9a-fA-F]{2}[:-]){5}([0-9a-fA-F]{2})/g,
        /([0-9a-fA-F]{4}\.[0-9a-fA-F]{4}\.[0-9a-fA-F]{4})/g
      ],
      generic: [
        /([0-9a-fA-F]{2}[:-]){5}([0-9a-fA-F]{2})/g,
        /([0-9a-fA-F]{4}\.[0-9a-fA-F]{4}\.[0-9a-fA-F]{4})/g,
        /([0-9a-fA-F]{6}-[0-9a-fA-F]{6})/g
      ]
    };

    const switchPatterns = patterns[switchType] || patterns.generic;

    for (const pattern of switchPatterns) {
      const matches = output.match(pattern) || [];
      matches.forEach(mac => {
        const normalizedMac = this.normalizeMacAddress(mac);
        if (normalizedMac && this.isValidMacAddress(normalizedMac)) {
          macAddresses.add(normalizedMac);
        }
      });
    }

    return Array.from(macAddresses);
  }

  /**
   * Normalize MAC address to standard format (xx:xx:xx:xx:xx:xx)
   * @param {string} mac - MAC address in any format
   * @returns {string} Normalized MAC address
   */
  normalizeMacAddress(mac) {
    if (!mac) return null;
    
    // Remove all separators and convert to lowercase
    const cleanMac = mac.replace(/[.:-]/g, '').toLowerCase();
    
    // Ensure it's 12 characters
    if (cleanMac.length !== 12) return null;
    
    // Add colons every 2 characters
    return cleanMac.replace(/(.{2})/g, '$1:').slice(0, -1);
  }

  /**
   * Validate MAC address format
   * @param {string} mac - MAC address to validate
   * @returns {boolean} True if valid
   */
  isValidMacAddress(mac) {
    const macRegex = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i;
    return macRegex.test(mac) && mac !== '00:00:00:00:00:00';
  }

  /**
   * Create interactive SSH shell with enhanced debugging
   * @param {Object} switchConfig - Switch configuration
   * @returns {Promise<Object>} Shell connection object
   */
  async createShell(switchConfig) {
    const { host, port = 22, username, password } = switchConfig;
    
    return new Promise((resolve, reject) => {
      const conn = new Client();
      
      conn.on('ready', () => {
        conn.shell((err, stream) => {
          if (err) {
            conn.end();
            reject(err);
            return;
          }

          resolve({
            connection: conn,
            stream: stream,
            send: (command) => {
              stream.write(command + '\n');
            },
            close: () => {
              stream.end();
              conn.end();
            }
          });
        });
      });

      conn.on('error', (err) => {
        reject(err);
      });

      conn.connect({
        host,
        port,
        username,
        password,
        readyTimeout: 10000,
        algorithms: {
          kex: [
            'diffie-hellman-group14-sha256',
            'diffie-hellman-group14-sha1',
            'diffie-hellman-group1-sha1'
          ],
          cipher: [
            'aes128-ctr',
            'aes192-ctr', 
            'aes256-ctr',
            'aes128-gcm',
            'aes256-gcm'
          ],
          hmac: [
            'hmac-sha2-256',
            'hmac-sha2-512',
            'hmac-sha1'
          ]
        }
      });
    });
  }

  /**
   * Get switch information and capabilities
   * @param {Object} switchConfig - Switch configuration
   * @returns {Promise<Object>} Switch information
   */
  async getSwitchInfo(switchConfig) {
    try {
      const commands = [
        'show version',
        'show system',
        'show inventory',
        'show hardware'
      ];

      let switchInfo = {
        model: 'Unknown',
        version: 'Unknown',
        type: 'Unknown',
        capabilities: []
      };

      for (const command of commands) {
        try {
          const result = await this.executeCommand(switchConfig, command);
          if (result.success) {
            // Parse switch information from output
            const output = result.output.toLowerCase();
            
            if (output.includes('cisco')) {
              switchInfo.type = 'cisco';
            } else if (output.includes('hp') || output.includes('aruba')) {
              switchInfo.type = 'hp_aruba';
            } else if (output.includes('juniper')) {
              switchInfo.type = 'juniper';
            } else if (output.includes('dell')) {
              switchInfo.type = 'dell';
            }
            
            // Extract model and version information
            const lines = result.output.split('\n');
            for (const line of lines) {
              if (line.toLowerCase().includes('model') || line.toLowerCase().includes('product')) {
                switchInfo.model = line.trim();
                break;
              }
            }
            
            break;
          }
        } catch (error) {
          continue;
        }
      }

      return switchInfo;
    } catch (error) {
      console.error('Failed to get switch info:', error);
      return {
        model: 'Unknown',
        version: 'Unknown',
        type: 'generic',
        capabilities: []
      };
    }
  }
}