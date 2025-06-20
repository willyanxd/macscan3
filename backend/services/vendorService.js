import https from 'https';

export class VendorService {
  constructor() {
    this.cache = new Map();
    this.requestQueue = [];
    this.isProcessing = false;
    this.lastRequestTime = 0;
    this.requestDelay = 1100; // 1.1 seconds to respect rate limit
  }

  /**
   * Get vendor information for a MAC address
   * @param {string} macAddress - MAC address to lookup
   * @returns {Promise<string>} Vendor name or null
   */
  async getVendor(macAddress) {
    if (!macAddress) return null;

    // Normalize MAC address
    const normalizedMac = this.normalizeMacAddress(macAddress);
    if (!normalizedMac) return null;

    // Check cache first
    if (this.cache.has(normalizedMac)) {
      return this.cache.get(normalizedMac);
    }

    // Add to queue and process
    return new Promise((resolve) => {
      this.requestQueue.push({ macAddress: normalizedMac, resolve });
      this.processQueue();
    });
  }

  /**
   * Process the vendor lookup queue with rate limiting
   */
  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const { macAddress, resolve } = this.requestQueue.shift();

      // Rate limiting - ensure we don't exceed 1 request per second
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      if (timeSinceLastRequest < this.requestDelay) {
        await new Promise(resolve => setTimeout(resolve, this.requestDelay - timeSinceLastRequest));
      }

      try {
        const vendor = await this.fetchVendorFromAPI(macAddress);
        this.cache.set(macAddress, vendor);
        this.lastRequestTime = Date.now();
        resolve(vendor);
      } catch (error) {
        console.error(`Failed to fetch vendor for ${macAddress}:`, error.message);
        this.cache.set(macAddress, null);
        resolve(null);
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessing = false;
  }

  /**
   * Fetch vendor information from macvendors.com API
   * @param {string} macAddress - Normalized MAC address
   * @returns {Promise<string>} Vendor name or null
   */
  fetchVendorFromAPI(macAddress) {
    return new Promise((resolve, reject) => {
      const url = `https://api.macvendors.com/${macAddress}`;
      
      const request = https.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'MAC-Scanner/1.0'
        }
      }, (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          if (response.statusCode === 200) {
            const vendor = data.trim();
            resolve(vendor || null);
          } else if (response.statusCode === 404) {
            resolve(null); // Vendor not found
          } else {
            reject(new Error(`HTTP ${response.statusCode}: ${data}`));
          }
        });
      });

      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });

      request.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Normalize MAC address to standard format
   * @param {string} mac - MAC address in any format
   * @returns {string} Normalized MAC address (XX:XX:XX:XX:XX:XX)
   */
  normalizeMacAddress(mac) {
    if (!mac) return null;
    
    // Remove all separators and convert to uppercase
    const cleanMac = mac.replace(/[.:\-\s]/g, '').toUpperCase();
    
    // Ensure it's 12 characters
    if (cleanMac.length !== 12) return null;
    
    // Add colons every 2 characters
    return cleanMac.replace(/(.{2})/g, '$1:').slice(0, -1);
  }

  /**
   * Get multiple vendors in batch (with rate limiting)
   * @param {string[]} macAddresses - Array of MAC addresses
   * @returns {Promise<Object>} Object mapping MAC addresses to vendors
   */
  async getBatchVendors(macAddresses) {
    const results = {};
    
    for (const mac of macAddresses) {
      try {
        const vendor = await this.getVendor(mac);
        results[mac] = vendor;
      } catch (error) {
        console.error(`Failed to get vendor for ${mac}:`, error);
        results[mac] = null;
      }
    }
    
    return results;
  }

  /**
   * Clear the vendor cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      queueLength: this.requestQueue.length,
      isProcessing: this.isProcessing
    };
  }
}