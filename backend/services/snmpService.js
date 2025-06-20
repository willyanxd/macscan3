import snmp from 'net-snmp';

export class SNMPService {
  constructor() {
    this.sessions = new Map();
    this.debugMode = process.env.SNMP_DEBUG === 'true';
  }

  /**
   * Test SNMP connection to switch
   * @param {Object} switchConfig - Switch configuration
   * @returns {Promise<Object>} Connection result with details
   */
  async testConnection(switchConfig) {
    const { host, community = 'public', version = '2c' } = switchConfig;
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      let connectionDetails = {
        success: false,
        message: '',
        details: {
          host,
          community,
          version,
          connectionTime: 0,
          systemInfo: null,
          error: null
        }
      };

      const session = snmp.createSession(host, community, {
        version: version === '1' ? snmp.Version1 : snmp.Version2c,
        timeout: 5000,
        retries: 1
      });

      const timeout = setTimeout(() => {
        session.close();
        connectionDetails.message = 'Connection timeout (5 seconds)';
        connectionDetails.details.error = 'TIMEOUT';
        resolve(connectionDetails);
      }, 5000);

      // Test with system description OID
      const systemDescrOid = '1.3.6.1.2.1.1.1.0';
      
      session.get([systemDescrOid], (error, varbinds) => {
        clearTimeout(timeout);
        
        if (error) {
          connectionDetails.success = false;
          connectionDetails.details.error = error.message;
          
          if (error.message.includes('Timeout')) {
            connectionDetails.message = 'SNMP timeout - Check if SNMP is enabled and community is correct';
          } else if (error.message.includes('No response')) {
            connectionDetails.message = 'No SNMP response - Check IP address and network connectivity';
          } else if (error.message.includes('Authentication')) {
            connectionDetails.message = 'Authentication failed - Check SNMP community string';
          } else {
            connectionDetails.message = `SNMP error: ${error.message}`;
          }
        } else {
          connectionDetails.success = true;
          connectionDetails.message = 'SNMP connection successful';
          connectionDetails.details.connectionTime = Date.now() - startTime;
          
          if (varbinds && varbinds[0] && !snmp.isVarbindError(varbinds[0])) {
            connectionDetails.details.systemInfo = varbinds[0].value.toString();
          }
        }
        
        session.close();
        resolve(connectionDetails);
      });
    });
  }

  /**
   * Get switch information via SNMP
   * @param {Object} switchConfig - Switch configuration
   * @returns {Promise<Object>} Switch information
   */
  async getSwitchInfo(switchConfig) {
    const { host, community = 'public', version = '2c' } = switchConfig;
    
    return new Promise((resolve, reject) => {
      const session = snmp.createSession(host, community, {
        version: version === '1' ? snmp.Version1 : snmp.Version2c,
        timeout: 10000,
        retries: 2
      });

      const oids = [
        '1.3.6.1.2.1.1.1.0', // sysDescr
        '1.3.6.1.2.1.1.5.0', // sysName
        '1.3.6.1.2.1.1.6.0', // sysLocation
        '1.3.6.1.2.1.1.3.0'  // sysUpTime
      ];

      session.get(oids, (error, varbinds) => {
        session.close();
        
        if (error) {
          reject(new Error(`Failed to get switch info: ${error.message}`));
          return;
        }

        const switchInfo = {
          description: 'Unknown',
          name: 'Unknown',
          location: 'Unknown',
          uptime: 'Unknown',
          type: 'generic',
          capabilities: ['snmp']
        };

        if (varbinds && varbinds.length >= 4) {
          if (!snmp.isVarbindError(varbinds[0])) {
            switchInfo.description = varbinds[0].value.toString();
            
            // Detect switch type from description
            const desc = switchInfo.description.toLowerCase();
            if (desc.includes('cisco')) {
              switchInfo.type = 'cisco';
            } else if (desc.includes('hp') || desc.includes('aruba')) {
              switchInfo.type = 'hp_aruba';
            } else if (desc.includes('juniper')) {
              switchInfo.type = 'juniper';
            } else if (desc.includes('dell')) {
              switchInfo.type = 'dell';
            }
          }
          
          if (!snmp.isVarbindError(varbinds[1])) {
            switchInfo.name = varbinds[1].value.toString();
          }
          
          if (!snmp.isVarbindError(varbinds[2])) {
            switchInfo.location = varbinds[2].value.toString();
          }
          
          if (!snmp.isVarbindError(varbinds[3])) {
            const uptimeTicks = parseInt(varbinds[3].value);
            const uptimeSeconds = Math.floor(uptimeTicks / 100);
            const days = Math.floor(uptimeSeconds / 86400);
            const hours = Math.floor((uptimeSeconds % 86400) / 3600);
            const minutes = Math.floor((uptimeSeconds % 3600) / 60);
            switchInfo.uptime = `${days}d ${hours}h ${minutes}m`;
          }
        }

        resolve(switchInfo);
      });
    });
  }

  /**
   * Convert MAC address from OID format
   * @param {string} oid - OID containing MAC address
   * @returns {string} Formatted MAC address
   */
  macFromOid(oid) {
    const parts = oid.split('.');
    const macParts = parts.slice(-6).map(x => parseInt(x).toString(16).padStart(2, '0'));
    return macParts.join(':').toUpperCase();
  }

  /**
   * Get FDB entries for a specific VLAN
   * @param {Object} session - SNMP session
   * @param {number} vlanId - VLAN ID
   * @returns {Promise<Object>} MAC to bridge port mapping
   */
  getFDBEntries(session, vlanId) {
    return new Promise((resolve, reject) => {
      const macMap = {};
      const fdbTableBase = `1.3.6.1.2.1.17.7.1.2.2.1.2.${vlanId}`;

      session.subtree(fdbTableBase, (varbinds) => {
        for (const vb of varbinds) {
          if (!snmp.isVarbindError(vb)) {
            const mac = this.macFromOid(vb.oid);
            const bridgePort = parseInt(vb.value);
            macMap[mac] = { bridgePort };
          }
        }
      }, (err) => {
        if (err) {
          reject(new Error(`Failed to get FDB entries: ${err.message}`));
        } else {
          resolve(macMap);
        }
      });
    });
  }

  /**
   * Get bridge port to interface index mapping
   * @param {Object} session - SNMP session
   * @returns {Promise<Object>} Bridge port to ifIndex mapping
   */
  getPortIfIndexMap(session) {
    return new Promise((resolve, reject) => {
      const portMap = {};
      const portIfIndexOid = '1.3.6.1.2.1.17.1.4.1.2'; // dot1dBasePortIfIndex

      session.subtree(portIfIndexOid, (varbinds) => {
        for (const vb of varbinds) {
          if (!snmp.isVarbindError(vb)) {
            const dot1dPort = parseInt(vb.oid.split('.').pop());
            const ifIndex = parseInt(vb.value);
            portMap[dot1dPort] = ifIndex;
          }
        }
      }, (err) => {
        if (err) {
          reject(new Error(`Failed to get port mapping: ${err.message}`));
        } else {
          resolve(portMap);
        }
      });
    });
  }

  /**
   * Get interface descriptions
   * @param {Object} session - SNMP session
   * @returns {Promise<Object>} Interface index to description mapping
   */
  getIfDescrMap(session) {
    return new Promise((resolve, reject) => {
      const descrMap = {};
      const ifDescrBase = '1.3.6.1.2.1.2.2.1.2'; // ifDescr

      session.subtree(ifDescrBase, (varbinds) => {
        for (const vb of varbinds) {
          if (!snmp.isVarbindError(vb)) {
            const ifIndex = parseInt(vb.oid.split('.').pop());
            const ifName = vb.value.toString();
            descrMap[ifIndex] = ifName;
          }
        }
      }, (err) => {
        if (err) {
          reject(new Error(`Failed to get interface descriptions: ${err.message}`));
        } else {
          resolve(descrMap);
        }
      });
    });
  }

  /**
   * Scan MAC addresses for a specific VLAN
   * @param {Object} switchConfig - Switch configuration
   * @param {number} vlanId - VLAN ID to scan
   * @returns {Promise<Object>} Scan results with MAC addresses and interfaces
   */
  async scanMacAddresses(switchConfig, vlanId) {
    const { host, community = 'public', version = '2c' } = switchConfig;
    
    return new Promise(async (resolve, reject) => {
      const scanResults = {
        macAddresses: [],
        macDetails: {},
        switchType: 'generic',
        scanTime: Date.now(),
        success: false,
        details: {
          totalMacs: 0,
          vlanId: vlanId,
          host: host
        }
      };

      const session = snmp.createSession(host, community, {
        version: version === '1' ? snmp.Version1 : snmp.Version2c,
        timeout: 15000,
        retries: 2
      });

      try {
        console.log(`🔍 Scanning VLAN ${vlanId} on switch ${host}...`);

        // Get all required mappings
        const [fdbMap, portIfIndexMap, ifDescrMap] = await Promise.all([
          this.getFDBEntries(session, vlanId),
          this.getPortIfIndexMap(session),
          this.getIfDescrMap(session)
        ]);

        // Process MAC addresses and map to interfaces
        for (const [mac, { bridgePort }] of Object.entries(fdbMap)) {
          const ifIndex = portIfIndexMap[bridgePort];
          const interfaceName = ifDescrMap[ifIndex] || `ifIndex ${ifIndex}`;
          
          scanResults.macAddresses.push(mac);
          scanResults.macDetails[mac] = {
            interface: interfaceName,
            bridgePort: bridgePort,
            ifIndex: ifIndex
          };

          if (this.debugMode) {
            console.log(`📡 MAC ${mac} → Interface: ${interfaceName}`);
          }
        }

        scanResults.success = true;
        scanResults.details.totalMacs = scanResults.macAddresses.length;
        
        console.log(`✅ Found ${scanResults.macAddresses.length} MAC addresses on VLAN ${vlanId}`);
        
        session.close();
        resolve(scanResults);

      } catch (error) {
        session.close();
        console.error(`❌ SNMP scan failed for ${host}:`, error.message);
        reject(new Error(`SNMP scan failed: ${error.message}`));
      }
    });
  }

  /**
   * Test MAC scanning on a switch
   * @param {Object} switchConfig - Switch configuration
   * @param {number} vlanId - VLAN ID to test
   * @returns {Promise<Object>} Test scan results
   */
  async testMacScan(switchConfig, vlanId) {
    try {
      const scanResult = await this.scanMacAddresses(switchConfig, vlanId);
      return {
        success: true,
        message: `Successfully scanned VLAN ${vlanId}`,
        macCount: scanResult.macAddresses.length,
        sampleMacs: scanResult.macAddresses.slice(0, 5), // Show first 5 MACs as sample
        details: scanResult.details
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        macCount: 0,
        sampleMacs: [],
        details: { error: error.message }
      };
    }
  }

  /**
   * Normalize MAC address to standard format
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
    return cleanMac.replace(/(.{2})/g, '$1:').slice(0, -1).toUpperCase();
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
   * Close all active sessions
   */
  closeAllSessions() {
    for (const [key, session] of this.sessions) {
      try {
        session.close();
      } catch (error) {
        console.error(`Error closing SNMP session ${key}:`, error);
      }
    }
    this.sessions.clear();
  }
}