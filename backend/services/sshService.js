import { spawn } from 'child_process';
import { EventEmitter } from 'events';

export class SSHService extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map();
    this.debugMode = process.env.SSH_DEBUG === 'true';
  }

  /**
   * Enhanced SSH connection test with child_process
   * @param {Object} switchConfig - Switch configuration
   * @returns {Promise<Object>} Connection result with details
   */
  async testConnection(switchConfig) {
    const { host, port = 22, username, password } = switchConfig;
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      let connectionDetails = {
        success: false,
        message: '',
        details: {
          host,
          port,
          username,
          connectionTime: 0,
          sshVersion: null,
          ready: false,
          error: null
        }
      };

      // Use sshpass for password authentication
      const sshArgs = [
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'ConnectTimeout=10',
        '-o', 'ServerAliveInterval=5',
        '-o', 'ServerAliveCountMax=3',
        '-p', port.toString(),
        `${username}@${host}`
      ];

      const sshProcess = spawn('sshpass', ['-p', password, 'ssh', ...sshArgs], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';
      let isReady = false;
      let hasPrompt = false;

      const timeout = setTimeout(() => {
        sshProcess.kill('SIGTERM');
        connectionDetails.message = 'Connection timeout (10 seconds)';
        connectionDetails.details.error = 'TIMEOUT';
        resolve(connectionDetails);
      }, 10000);

      sshProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        
        if (this.debugMode) {
          console.log('SSH stdout:', chunk);
        }

        // Check for common switch prompts and ready indicators
        const readyPatterns = [
          /[>#$%]\s*$/,           // Common shell prompts
          /Password:\s*$/,        // Password prompt (shouldn't happen with sshpass)
          /\(config\)[>#$%]\s*$/, // Config mode prompts
          /Press any key/i,       // Press any key prompts
          /--More--/,             // Paging prompts
          /\[Y\/N\]/i,           // Yes/No prompts
          /login:/i,              // Login prompts
          /username:/i            // Username prompts
        ];

        // Check if we have a prompt indicating the connection is ready
        if (readyPatterns.some(pattern => pattern.test(chunk))) {
          hasPrompt = true;
          if (!isReady) {
            isReady = true;
            connectionDetails.details.ready = true;
            
            // Send a simple test command
            sshProcess.stdin.write('echo "SSH_TEST_OK"\n');
          }
        }

        // Check for test command response
        if (chunk.includes('SSH_TEST_OK') && isReady) {
          clearTimeout(timeout);
          connectionDetails.success = true;
          connectionDetails.message = 'Connection and command execution successful';
          connectionDetails.details.connectionTime = Date.now() - startTime;
          sshProcess.stdin.write('exit\n');
          setTimeout(() => {
            sshProcess.kill('SIGTERM');
            resolve(connectionDetails);
          }, 1000);
        }
      });

      sshProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        
        if (this.debugMode) {
          console.log('SSH stderr:', chunk);
        }
      });

      sshProcess.on('close', (code) => {
        clearTimeout(timeout);
        
        if (!connectionDetails.success) {
          connectionDetails.details.error = errorOutput || 'Connection failed';
          
          if (errorOutput.includes('Permission denied')) {
            connectionDetails.message = 'Authentication failed - Check username/password';
          } else if (errorOutput.includes('Connection refused')) {
            connectionDetails.message = 'Connection refused - Check if SSH is enabled and port is correct';
          } else if (errorOutput.includes('No route to host')) {
            connectionDetails.message = 'No route to host - Check IP address and network connectivity';
          } else if (errorOutput.includes('Connection timed out')) {
            connectionDetails.message = 'Connection timeout - Check network connectivity and firewall';
          } else if (hasPrompt) {
            connectionDetails.success = true;
            connectionDetails.message = 'Connection established but test command failed';
            connectionDetails.details.connectionTime = Date.now() - startTime;
          } else {
            connectionDetails.message = `Connection failed: ${errorOutput || 'Unknown error'}`;
          }
        }
        
        resolve(connectionDetails);
      });

      sshProcess.on('error', (err) => {
        clearTimeout(timeout);
        connectionDetails.success = false;
        connectionDetails.details.error = err.message;
        
        if (err.code === 'ENOENT') {
          connectionDetails.message = 'SSH client not found - Please install openssh-client and sshpass';
        } else {
          connectionDetails.message = `SSH process error: ${err.message}`;
        }
        
        resolve(connectionDetails);
      });
    });
  }

  /**
   * Execute command on switch via SSH with enhanced error handling and readiness detection
   * @param {Object} switchConfig - Switch configuration
   * @param {string} command - Command to execute
   * @returns {Promise<Object>} Command result with output and metadata
   */
  async executeCommand(switchConfig, command) {
    const { host, port = 22, username, password } = switchConfig;
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const sshArgs = [
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'ConnectTimeout=30',
        '-o', 'ServerAliveInterval=5',
        '-o', 'ServerAliveCountMax=3',
        '-p', port.toString(),
        `${username}@${host}`
      ];

      const sshProcess = spawn('sshpass', ['-p', password, 'ssh', ...sshArgs], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';
      let isReady = false;
      let commandSent = false;
      let commandCompleted = false;

      const timeout = setTimeout(() => {
        sshProcess.kill('SIGTERM');
        reject(new Error('Command execution timeout (30 seconds)'));
      }, 30000);

      sshProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        
        if (this.debugMode) {
          console.log('SSH stdout:', chunk);
        }

        // Wait for switch to be ready before sending command
        if (!isReady && !commandSent) {
          const readyPatterns = [
            /[>#$%]\s*$/,           // Common shell prompts
            /\(config\)[>#$%]\s*$/, // Config mode prompts
            /Press any key/i,       // Press any key prompts
            /--More--/,             // Paging prompts
          ];

          if (readyPatterns.some(pattern => pattern.test(chunk))) {
            isReady = true;
            
            // Wait a bit more to ensure switch is fully ready
            setTimeout(() => {
              if (!commandSent) {
                commandSent = true;
                sshProcess.stdin.write(command + '\n');
                
                // Wait for command completion, then exit
                setTimeout(() => {
                  if (!commandCompleted) {
                    sshProcess.stdin.write('exit\n');
                  }
                }, 5000);
              }
            }, 1000);
          }
        }

        // Check for command completion indicators
        if (commandSent && !commandCompleted) {
          const completionPatterns = [
            /[>#$%]\s*$/,           // Return to prompt
            /\(config\)[>#$%]\s*$/, // Config mode prompt
            /Invalid input/i,       // Error messages
            /Unknown command/i,     // Error messages
            /Syntax error/i,        // Error messages
          ];

          if (completionPatterns.some(pattern => pattern.test(chunk))) {
            commandCompleted = true;
            setTimeout(() => {
              sshProcess.stdin.write('exit\n');
            }, 500);
          }
        }
      });

      sshProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        
        if (this.debugMode) {
          console.log('SSH stderr:', chunk);
        }
      });

      sshProcess.on('close', (code) => {
        clearTimeout(timeout);
        
        const result = {
          success: code === 0 || (commandSent && output.length > 0),
          output: this.cleanOutput(output),
          errorOutput: errorOutput.trim(),
          exitCode: code,
          executionTime: Date.now() - startTime,
          command,
          commandSent,
          isReady
        };

        if (result.success) {
          resolve(result);
        } else {
          reject(new Error(`Command failed: ${errorOutput || 'Unknown error'}`));
        }
      });

      sshProcess.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`SSH process error: ${err.message}`));
      });
    });
  }

  /**
   * Enhanced MAC address scanning with better switch readiness detection
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
        {
          type: 'cisco_ios',
          commands: [
            `show mac address-table vlan ${vlanId}`,
            `show mac-address-table vlan ${vlanId}`,
            `show bridge address-table vlan ${vlanId}`
          ]
        },
        {
          type: 'hp_aruba',
          commands: [
            `show mac-address vlan ${vlanId}`,
            `show mac-address-table vlan ${vlanId}`,
            `show bridge address-table vlan ${vlanId}`
          ]
        },
        {
          type: 'juniper',
          commands: [
            `show ethernet-switching table vlan ${vlanId}`,
            `show bridge mac-table vlan ${vlanId}`
          ]
        },
        {
          type: 'dell',
          commands: [
            `show mac address-table vlan ${vlanId}`,
            `show bridge address-table vlan ${vlanId}`
          ]
        },
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
                  outputLength: result.output.length,
                  commandSent: result.commandSent,
                  isReady: result.isReady
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
   * Clean SSH output by removing control characters and prompts
   * @param {string} output - Raw SSH output
   * @returns {string} Cleaned output
   */
  cleanOutput(output) {
    return output
      // Remove ANSI escape sequences
      .replace(/\x1b\[[0-9;]*m/g, '')
      // Remove carriage returns
      .replace(/\r/g, '')
      // Remove common SSH connection messages
      .replace(/Warning: Permanently added .* to the list of known hosts\./g, '')
      // Remove empty lines at start and end
      .trim()
      // Remove duplicate empty lines
      .replace(/\n\s*\n\s*\n/g, '\n\n');
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
   * Create interactive SSH shell with enhanced readiness detection
   * @param {Object} switchConfig - Switch configuration
   * @returns {Promise<Object>} Shell connection object
   */
  async createShell(switchConfig) {
    const { host, port = 22, username, password } = switchConfig;
    
    return new Promise((resolve, reject) => {
      const sshArgs = [
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'ConnectTimeout=10',
        '-p', port.toString(),
        `${username}@${host}`
      ];

      const sshProcess = spawn('sshpass', ['-p', password, 'ssh', ...sshArgs], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let isReady = false;
      let output = '';

      const timeout = setTimeout(() => {
        sshProcess.kill('SIGTERM');
        reject(new Error('Shell connection timeout'));
      }, 10000);

      sshProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        
        // Check for readiness
        if (!isReady) {
          const readyPatterns = [
            /[>#$%]\s*$/,
            /\(config\)[>#$%]\s*$/,
          ];

          if (readyPatterns.some(pattern => pattern.test(chunk))) {
            isReady = true;
            clearTimeout(timeout);
            
            resolve({
              process: sshProcess,
              send: (command) => {
                sshProcess.stdin.write(command + '\n');
              },
              close: () => {
                sshProcess.stdin.write('exit\n');
                setTimeout(() => {
                  sshProcess.kill('SIGTERM');
                }, 1000);
              },
              isReady: () => isReady
            });
          }
        }
      });

      sshProcess.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      sshProcess.on('close', () => {
        clearTimeout(timeout);
        if (!isReady) {
          reject(new Error('SSH connection closed before ready'));
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