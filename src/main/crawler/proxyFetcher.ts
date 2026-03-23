import axios from 'axios';
import { addProxy, addLog } from '../db/database';

const PROXY_SOURCES = [
  'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
  'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt',
  'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all'
];

export async function fetchFreeProxies() {
  addLog('Starting automated free proxy discovery...', 'info');
  let totalFound = 0;

  for (const source of PROXY_SOURCES) {
    try {
      const response = await axios.get(source, { timeout: 15000 });
      const rawProxies = response.data.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 5);
      
      for (const proxy of rawProxies) {
        // Basic validation for IP:PORT
        if (/^(\d{1,3}\.){3}\d{1,3}:\d+$/.test(proxy) || proxy.includes('@')) {
          addProxy(proxy);
          totalFound++;
        }
      }
    } catch (err: any) {
      addLog(`Failed to fetch from ${source}: ${err.message}`, 'error');
    }
  }

  addLog(`Proxy discovery complete. Added/Updated ${totalFound} proxy addresses.`, 'success');
  return totalFound;
}
