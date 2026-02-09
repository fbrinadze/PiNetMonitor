const arp = require('node-arp');
const ping = require('ping');
const dns = require('dns').promises;
const { promisify } = require('util');
const EventEmitter = require('events');

const arpGetMAC = promisify(arp.getMAC);

/**
 * @typedef {Object} Device
 * @property {string} ipAddress - IP address (e.g., "192.168.1.100")
 * @property {string} macAddress - MAC address (e.g., "AA:BB:CC:DD:EE:FF")
 * @property {string} hostname - Hostname or "unknown"
 * @property {string} vendor - Vendor name from MAC lookup
 * @property {Date} firstSeen - When device was first discovered
 * @property {Date} lastSeen - Last successful connectivity check
 * @property {boolean} isActive - Current online/offline status
 */

/**
 * DeviceScanner discovers devices on the local network using ARP scanning and ping sweeps
 */
class DeviceScanner extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, Device>} */
    this.deviceCache = new Map();
    
    // OUI database for MAC vendor lookup (subset of common vendors)
    this.ouiDatabase = this._initializeOUIDatabase();
  }

  /**
   * Initialize OUI database with common MAC vendor prefixes
   * @private
   * @returns {Map<string, string>}
   */
  _initializeOUIDatabase() {
    const oui = new Map();
    
    // Common vendor MAC prefixes (first 6 characters)
    oui.set('00:50:56', 'VMware');
    oui.set('00:0C:29', 'VMware');
    oui.set('00:05:69', 'VMware');
    oui.set('00:1C:42', 'Parallels');
    oui.set('08:00:27', 'Oracle VirtualBox');
    oui.set('52:54:00', 'QEMU/KVM');
    oui.set('00:16:3E', 'Xen');
    oui.set('00:03:FF', 'Microsoft');
    oui.set('00:0D:3A', 'Microsoft');
    oui.set('00:12:5A', 'Microsoft');
    oui.set('00:15:5D', 'Microsoft Hyper-V');
    oui.set('00:17:FA', 'Microsoft');
    oui.set('00:50:F2', 'Microsoft');
    oui.set('28:18:78', 'Microsoft');
    oui.set('7C:1E:52', 'Microsoft');
    oui.set('00:1B:21', 'Intel');
    oui.set('00:1E:67', 'Intel');
    oui.set('00:21:5C', 'Intel');
    oui.set('00:23:15', 'Intel');
    oui.set('00:24:D7', 'Intel');
    oui.set('00:26:C6', 'Intel');
    oui.set('00:27:0E', 'Intel');
    oui.set('3C:A9:F4', 'Intel');
    oui.set('00:03:93', 'Apple');
    oui.set('00:05:02', 'Apple');
    oui.set('00:0A:27', 'Apple');
    oui.set('00:0A:95', 'Apple');
    oui.set('00:0D:93', 'Apple');
    oui.set('00:10:FA', 'Apple');
    oui.set('00:11:24', 'Apple');
    oui.set('00:14:51', 'Apple');
    oui.set('00:16:CB', 'Apple');
    oui.set('00:17:F2', 'Apple');
    oui.set('00:19:E3', 'Apple');
    oui.set('00:1B:63', 'Apple');
    oui.set('00:1C:B3', 'Apple');
    oui.set('00:1D:4F', 'Apple');
    oui.set('00:1E:52', 'Apple');
    oui.set('00:1E:C2', 'Apple');
    oui.set('00:1F:5B', 'Apple');
    oui.set('00:1F:F3', 'Apple');
    oui.set('00:21:E9', 'Apple');
    oui.set('00:22:41', 'Apple');
    oui.set('00:23:12', 'Apple');
    oui.set('00:23:32', 'Apple');
    oui.set('00:23:6C', 'Apple');
    oui.set('00:23:DF', 'Apple');
    oui.set('00:24:36', 'Apple');
    oui.set('00:25:00', 'Apple');
    oui.set('00:25:4B', 'Apple');
    oui.set('00:25:BC', 'Apple');
    oui.set('00:26:08', 'Apple');
    oui.set('00:26:4A', 'Apple');
    oui.set('00:26:B0', 'Apple');
    oui.set('00:26:BB', 'Apple');
    oui.set('04:0C:CE', 'Apple');
    oui.set('04:15:52', 'Apple');
    oui.set('04:26:65', 'Apple');
    oui.set('08:00:07', 'Apple');
    oui.set('08:66:98', 'Apple');
    oui.set('08:70:45', 'Apple');
    oui.set('0C:3E:9F', 'Apple');
    oui.set('0C:4D:E9', 'Apple');
    oui.set('0C:74:C2', 'Apple');
    oui.set('10:40:F3', 'Apple');
    oui.set('10:9A:DD', 'Apple');
    oui.set('10:DD:B1', 'Apple');
    oui.set('14:10:9F', 'Apple');
    oui.set('14:8F:C6', 'Apple');
    oui.set('18:34:51', 'Apple');
    oui.set('18:E7:F4', 'Apple');
    oui.set('1C:AB:A7', 'Apple');
    oui.set('20:C9:D0', 'Apple');
    oui.set('24:A0:74', 'Apple');
    oui.set('28:37:37', 'Apple');
    oui.set('28:CF:DA', 'Apple');
    oui.set('28:E1:4C', 'Apple');
    oui.set('2C:B4:3A', 'Apple');
    oui.set('30:90:AB', 'Apple');
    oui.set('34:15:9E', 'Apple');
    oui.set('34:36:3B', 'Apple');
    oui.set('38:C9:86', 'Apple');
    oui.set('3C:15:C2', 'Apple');
    oui.set('40:30:04', 'Apple');
    oui.set('40:A6:D9', 'Apple');
    oui.set('44:2A:60', 'Apple');
    oui.set('48:43:7C', 'Apple');
    oui.set('48:74:6E', 'Apple');
    oui.set('4C:57:CA', 'Apple');
    oui.set('50:EA:D6', 'Apple');
    oui.set('54:26:96', 'Apple');
    oui.set('54:72:4F', 'Apple');
    oui.set('58:55:CA', 'Apple');
    oui.set('5C:59:48', 'Apple');
    oui.set('5C:95:AE', 'Apple');
    oui.set('60:03:08', 'Apple');
    oui.set('60:33:4B', 'Apple');
    oui.set('60:69:44', 'Apple');
    oui.set('60:C5:47', 'Apple');
    oui.set('60:F8:1D', 'Apple');
    oui.set('60:FA:CD', 'Apple');
    oui.set('64:20:0C', 'Apple');
    oui.set('64:B9:E8', 'Apple');
    oui.set('68:5B:35', 'Apple');
    oui.set('68:96:7B', 'Apple');
    oui.set('68:A8:6D', 'Apple');
    oui.set('68:D9:3C', 'Apple');
    oui.set('6C:3E:6D', 'Apple');
    oui.set('6C:40:08', 'Apple');
    oui.set('6C:70:9F', 'Apple');
    oui.set('6C:94:66', 'Apple');
    oui.set('70:11:24', 'Apple');
    oui.set('70:56:81', 'Apple');
    oui.set('70:CD:60', 'Apple');
    oui.set('74:E1:B6', 'Apple');
    oui.set('78:31:C1', 'Apple');
    oui.set('78:67:D7', 'Apple');
    oui.set('78:7B:8A', 'Apple');
    oui.set('78:A3:E4', 'Apple');
    oui.set('78:CA:39', 'Apple');
    oui.set('7C:01:91', 'Apple');
    oui.set('7C:11:BE', 'Apple');
    oui.set('7C:6D:62', 'Apple');
    oui.set('7C:C3:A1', 'Apple');
    oui.set('7C:D1:C3', 'Apple');
    oui.set('7C:F0:5F', 'Apple');
    oui.set('80:49:71', 'Apple');
    oui.set('80:92:9F', 'Apple');
    oui.set('80:E6:50', 'Apple');
    oui.set('84:38:35', 'Apple');
    oui.set('84:85:06', 'Apple');
    oui.set('84:89:AD', 'Apple');
    oui.set('84:FC:FE', 'Apple');
    oui.set('88:1F:A1', 'Apple');
    oui.set('88:53:95', 'Apple');
    oui.set('88:63:DF', 'Apple');
    oui.set('88:66:5A', 'Apple');
    oui.set('88:C6:63', 'Apple');
    oui.set('8C:00:6D', 'Apple');
    oui.set('8C:2D:AA', 'Apple');
    oui.set('8C:58:77', 'Apple');
    oui.set('8C:7C:92', 'Apple');
    oui.set('8C:85:90', 'Apple');
    oui.set('90:27:E4', 'Apple');
    oui.set('90:72:40', 'Apple');
    oui.set('90:84:0D', 'Apple');
    oui.set('90:B0:ED', 'Apple');
    oui.set('90:B9:31', 'Apple');
    oui.set('94:E9:6A', 'Apple');
    oui.set('98:03:D8', 'Apple');
    oui.set('98:5A:EB', 'Apple');
    oui.set('98:B8:E3', 'Apple');
    oui.set('98:D6:BB', 'Apple');
    oui.set('98:E0:D9', 'Apple');
    oui.set('98:FE:94', 'Apple');
    oui.set('9C:04:EB', 'Apple');
    oui.set('9C:20:7B', 'Apple');
    oui.set('9C:35:5B', 'Apple');
    oui.set('9C:84:BF', 'Apple');
    oui.set('9C:F3:87', 'Apple');
    oui.set('A0:18:28', 'Apple');
    oui.set('A0:99:9B', 'Apple');
    oui.set('A4:5E:60', 'Apple');
    oui.set('A4:67:06', 'Apple');
    oui.set('A4:B1:97', 'Apple');
    oui.set('A4:D1:8C', 'Apple');
    oui.set('A8:20:66', 'Apple');
    oui.set('A8:5B:78', 'Apple');
    oui.set('A8:66:7F', 'Apple');
    oui.set('A8:86:DD', 'Apple');
    oui.set('A8:BB:CF', 'Apple');
    oui.set('A8:FA:D8', 'Apple');
    oui.set('AC:1F:74', 'Apple');
    oui.set('AC:29:3A', 'Apple');
    oui.set('AC:3C:0B', 'Apple');
    oui.set('AC:61:EA', 'Apple');
    oui.set('AC:87:A3', 'Apple');
    oui.set('AC:BC:32', 'Apple');
    oui.set('AC:CF:5C', 'Apple');
    oui.set('AC:E4:B5', 'Apple');
    oui.set('B0:34:95', 'Apple');
    oui.set('B0:65:BD', 'Apple');
    oui.set('B0:9F:BA', 'Apple');
    oui.set('B4:18:D1', 'Apple');
    oui.set('B4:8B:19', 'Apple');
    oui.set('B4:F0:AB', 'Apple');
    oui.set('B4:F6:1C', 'Apple');
    oui.set('B8:09:8A', 'Apple');
    oui.set('B8:17:C2', 'Apple');
    oui.set('B8:41:A4', 'Apple');
    oui.set('B8:53:AC', 'Apple');
    oui.set('B8:63:4D', 'Apple');
    oui.set('B8:78:2E', 'Apple');
    oui.set('B8:C7:5D', 'Apple');
    oui.set('B8:E8:56', 'Apple');
    oui.set('B8:F6:B1', 'Apple');
    oui.set('BC:3B:AF', 'Apple');
    oui.set('BC:52:B7', 'Apple');
    oui.set('BC:67:1C', 'Apple');
    oui.set('BC:6C:21', 'Apple');
    oui.set('BC:92:6B', 'Apple');
    oui.set('BC:9F:EF', 'Apple');
    oui.set('C0:1A:DA', 'Apple');
    oui.set('C0:63:94', 'Apple');
    oui.set('C0:84:7D', 'Apple');
    oui.set('C0:9A:D0', 'Apple');
    oui.set('C0:CC:F8', 'Apple');
    oui.set('C0:CE:CD', 'Apple');
    oui.set('C0:D0:12', 'Apple');
    oui.set('C4:2C:03', 'Apple');
    oui.set('C8:2A:14', 'Apple');
    oui.set('C8:33:4B', 'Apple');
    oui.set('C8:69:CD', 'Apple');
    oui.set('C8:85:50', 'Apple');
    oui.set('C8:B5:B7', 'Apple');
    oui.set('C8:BC:C8', 'Apple');
    oui.set('C8:E0:EB', 'Apple');
    oui.set('CC:08:E0', 'Apple');
    oui.set('CC:25:EF', 'Apple');
    oui.set('CC:29:F5', 'Apple');
    oui.set('CC:44:63', 'Apple');
    oui.set('CC:78:5F', 'Apple');
    oui.set('D0:03:4B', 'Apple');
    oui.set('D0:23:DB', 'Apple');
    oui.set('D0:25:98', 'Apple');
    oui.set('D0:33:11', 'Apple');
    oui.set('D0:4F:7E', 'Apple');
    oui.set('D0:81:7A', 'Apple');
    oui.set('D0:A6:37', 'Apple');
    oui.set('D0:C5:F3', 'Apple');
    oui.set('D0:D2:B0', 'Apple');
    oui.set('D0:E1:40', 'Apple');
    oui.set('D4:61:9D', 'Apple');
    oui.set('D4:85:64', 'Apple');
    oui.set('D4:90:9C', 'Apple');
    oui.set('D4:9A:20', 'Apple');
    oui.set('D4:A3:3D', 'Apple');
    oui.set('D4:DC:CD', 'Apple');
    oui.set('D4:F4:6F', 'Apple');
    oui.set('D8:1D:72', 'Apple');
    oui.set('D8:30:62', 'Apple');
    oui.set('D8:96:95', 'Apple');
    oui.set('D8:9E:3F', 'Apple');
    oui.set('D8:A2:5E', 'Apple');
    oui.set('D8:BB:2C', 'Apple');
    oui.set('D8:CF:9C', 'Apple');
    oui.set('DC:2B:2A', 'Apple');
    oui.set('DC:2B:61', 'Apple');
    oui.set('DC:37:18', 'Apple');
    oui.set('DC:3D:24', 'Apple');
    oui.set('DC:56:E7', 'Apple');
    oui.set('DC:86:D8', 'Apple');
    oui.set('DC:9B:9C', 'Apple');
    oui.set('DC:A4:CA', 'Apple');
    oui.set('DC:A9:04', 'Apple');
    oui.set('E0:05:C5', 'Apple');
    oui.set('E0:33:8E', 'Apple');
    oui.set('E0:66:78', 'Apple');
    oui.set('E0:AC:CB', 'Apple');
    oui.set('E0:B5:2D', 'Apple');
    oui.set('E0:B9:BA', 'Apple');
    oui.set('E0:C7:67', 'Apple');
    oui.set('E0:F5:C6', 'Apple');
    oui.set('E0:F8:47', 'Apple');
    oui.set('E4:25:E7', 'Apple');
    oui.set('E4:8B:7F', 'Apple');
    oui.set('E4:9A:79', 'Apple');
    oui.set('E4:CE:8F', 'Apple');
    oui.set('E8:04:0B', 'Apple');
    oui.set('E8:06:88', 'Apple');
    oui.set('E8:40:40', 'Apple');
    oui.set('E8:80:2E', 'Apple');
    oui.set('E8:B2:AC', 'Apple');
    oui.set('EC:35:86', 'Apple');
    oui.set('EC:85:2F', 'Apple');
    oui.set('F0:18:98', 'Apple');
    oui.set('F0:24:75', 'Apple');
    oui.set('F0:98:9D', 'Apple');
    oui.set('F0:B4:79', 'Apple');
    oui.set('F0:C1:F1', 'Apple');
    oui.set('F0:CB:A1', 'Apple');
    oui.set('F0:D1:A9', 'Apple');
    oui.set('F0:DB:E2', 'Apple');
    oui.set('F0:DC:E2', 'Apple');
    oui.set('F0:F6:1C', 'Apple');
    oui.set('F4:0F:24', 'Apple');
    oui.set('F4:1B:A1', 'Apple');
    oui.set('F4:37:B7', 'Apple');
    oui.set('F4:5C:89', 'Apple');
    oui.set('F4:F1:5A', 'Apple');
    oui.set('F4:F9:51', 'Apple');
    oui.set('F8:1E:DF', 'Apple');
    oui.set('F8:27:93', 'Apple');
    oui.set('F8:95:C7', 'Apple');
    oui.set('FC:25:3F', 'Apple');
    oui.set('FC:E9:98', 'Apple');
    oui.set('FC:FC:48', 'Apple');
    
    return oui;
  }

  /**
   * Lookup vendor name from MAC address using OUI database
   * @private
   * @param {string} macAddress - MAC address
   * @returns {string} Vendor name or "Unknown"
   */
  _lookupVendor(macAddress) {
    if (!macAddress || macAddress === 'unknown') {
      return 'Unknown';
    }
    
    // Extract first 8 characters (XX:XX:XX format)
    const prefix = macAddress.substring(0, 8).toUpperCase();
    return this.ouiDatabase.get(prefix) || 'Unknown';
  }

  /**
   * Perform reverse DNS lookup for hostname
   * @private
   * @param {string} ipAddress - IP address
   * @returns {Promise<string>} Hostname or "unknown"
   */
  async _lookupHostname(ipAddress) {
    try {
      const hostnames = await dns.reverse(ipAddress);
      return hostnames && hostnames.length > 0 ? hostnames[0] : 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Get MAC address for an IP using ARP
   * @private
   * @param {string} ipAddress - IP address
   * @returns {Promise<string>} MAC address or "unknown"
   */
  async _getMACAddress(ipAddress) {
    try {
      const mac = await arpGetMAC(ipAddress);
      return mac || 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Scan a specific IP address for device information
   * @param {string} ipAddress - IP address to scan
   * @returns {Promise<Device|null>} Device object or null if not reachable
   */
  async scanDevice(ipAddress) {
    try {
      // Ping the device to check if it's alive
      const pingResult = await ping.promise.probe(ipAddress, {
        timeout: 2,
        min_reply: 1
      });

      if (!pingResult.alive) {
        // Device is not responding
        return null;
      }

      // Get MAC address
      const macAddress = await this._getMACAddress(ipAddress);
      
      // Get hostname
      const hostname = await this._lookupHostname(ipAddress);
      
      // Lookup vendor
      const vendor = this._lookupVendor(macAddress);
      
      const now = new Date();
      
      // Check if device exists in cache
      const cachedDevice = this.deviceCache.get(ipAddress);
      
      const device = {
        ipAddress,
        macAddress,
        hostname,
        vendor,
        firstSeen: cachedDevice ? cachedDevice.firstSeen : now,
        lastSeen: now,
        isActive: true
      };
      
      // Update cache
      this.deviceCache.set(ipAddress, device);
      
      return device;
    } catch (error) {
      const err = /** @type {Error} */ (error);
      console.error(`Error scanning device ${ipAddress}:`, err.message);
      return null;
    }
  }

  /**
   * Scan the entire network subnet for active devices
   * @param {string} subnet - Subnet to scan (e.g., "192.168.1")
   * @returns {Promise<Device[]>} Array of discovered devices
   */
  async scanNetwork(subnet = '192.168.1') {
    /** @type {Device[]} */
    const devices = [];
    const scanPromises = [];
    
    // Scan IP addresses 1-254
    for (let i = 1; i <= 254; i++) {
      const ipAddress = `${subnet}.${i}`;
      scanPromises.push(
        this.scanDevice(ipAddress).then(device => {
          if (device) {
            devices.push(device);
            // Emit event for newly discovered device
            this.emit('deviceDiscovered', device);
          }
        })
      );
    }
    
    // Wait for all scans to complete
    await Promise.all(scanPromises);
    
    // Mark devices in cache that weren't found as inactive
    for (const [ip, cachedDevice] of this.deviceCache.entries()) {
      if (!devices.find(d => d.ipAddress === ip)) {
        cachedDevice.isActive = false;
      }
    }
    
    // Emit scan complete event
    this.emit('scanComplete', devices.length);
    
    return devices;
  }

  /**
   * Get cached devices
   * @returns {Device[]} Array of cached devices
   */
  getCachedDevices() {
    return Array.from(this.deviceCache.values());
  }
}

module.exports = DeviceScanner;
