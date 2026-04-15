/**
 * Hyperion Network Tools — DNS lookup, ping, traceroute, whois, SSL cert check, HTTP headers
 */
const { execSync } = require('child_process');
const dns = require('dns');
const tls = require('tls');
const https = require('https');
const net = require('net');

// ═══ SANITIZATION ═══

function sanitizeHostname(host) {
  return host.replace(/[^a-zA-Z0-9.\-:]/g, '').slice(0, 253);
}

function isValidHostname(host) {
  return /^[a-zA-Z0-9][a-zA-Z0-9.\-]*[a-zA-Z0-9]$/.test(host) || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

// ═══ DNS LOOKUP ═══

function dnsLookup(hostname) {
  const host = sanitizeHostname(hostname);
  if (!host) throw new Error('Invalid hostname');

  return new Promise((resolve, reject) => {
    const results = {};
    let pending = 5;
    const done = () => { if (--pending === 0) resolve(results); };

    dns.resolve4(host, (err, addrs) => { results.A = err ? [] : addrs; done(); });
    dns.resolve6(host, (err, addrs) => { results.AAAA = err ? [] : addrs; done(); });
    dns.resolveMx(host, (err, addrs) => { results.MX = err ? [] : addrs; done(); });
    dns.resolveNs(host, (err, addrs) => { results.NS = err ? [] : addrs; done(); });
    dns.resolveTxt(host, (err, addrs) => { results.TXT = err ? [] : addrs.map(a => a.join('')); done(); });

    setTimeout(() => resolve(results), 10000);
  });
}

function reverseDns(ip) {
  return new Promise((resolve, reject) => {
    dns.reverse(ip, (err, hostnames) => {
      if (err) resolve({ ip, hostnames: [], error: err.code });
      else resolve({ ip, hostnames });
    });
  });
}

// ═══ PING ═══

function ping(host, count = 4) {
  const safe = sanitizeHostname(host);
  if (!safe) throw new Error('Invalid hostname');
  const c = Math.min(Math.max(parseInt(count) || 4, 1), 20);

  try {
    const output = execSync(`ping -c ${c} -W 5 ${safe} 2>&1`, { encoding: 'utf8', timeout: 30000 });
    const lines = output.trim().split('\n');

    // Parse stats
    const statsLine = lines.find(l => l.includes('packets transmitted'));
    const rttLine = lines.find(l => l.includes('min/avg/max'));

    let sent = 0, received = 0, loss = '0%';
    if (statsLine) {
      const m = statsLine.match(/(\d+) packets transmitted, (\d+) .*?received.*?(\d+\.?\d*)% packet loss/);
      if (m) { sent = parseInt(m[1]); received = parseInt(m[2]); loss = m[3] + '%'; }
    }

    let min = 0, avg = 0, max = 0;
    if (rttLine) {
      const m = rttLine.match(/([\d.]+)\/([\d.]+)\/([\d.]+)/);
      if (m) { min = parseFloat(m[1]); avg = parseFloat(m[2]); max = parseFloat(m[3]); }
    }

    // Parse individual replies
    const replies = lines.filter(l => l.includes('bytes from')).map(l => {
      const tm = l.match(/time[=<]([\d.]+)/);
      const ttlm = l.match(/ttl=(\d+)/);
      return { time: tm ? parseFloat(tm[1]) : 0, ttl: ttlm ? parseInt(ttlm[1]) : 0 };
    });

    return { host: safe, sent, received, loss, rtt: { min, avg, max }, replies, raw: output };
  } catch (err) {
    return { host: safe, sent: 0, received: 0, loss: '100%', rtt: { min: 0, avg: 0, max: 0 }, replies: [], error: err.message, raw: err.stdout || '' };
  }
}

// ═══ TRACEROUTE ═══

function traceroute(host, maxHops = 20) {
  const safe = sanitizeHostname(host);
  if (!safe) throw new Error('Invalid hostname');

  try {
    const output = execSync(`traceroute -m ${Math.min(maxHops, 30)} -w 3 ${safe} 2>&1`, { encoding: 'utf8', timeout: 60000 });
    const lines = output.trim().split('\n');
    const hops = lines.slice(1).map(line => {
      const match = line.match(/^\s*(\d+)\s+(.+)/);
      if (!match) return null;
      return { hop: parseInt(match[1]), detail: match[2].trim() };
    }).filter(Boolean);

    return { host: safe, hops, raw: output };
  } catch (err) {
    return { host: safe, hops: [], error: err.message, raw: err.stdout || '' };
  }
}

// ═══ WHOIS ═══

function whois(domain) {
  const safe = sanitizeHostname(domain);
  if (!safe) throw new Error('Invalid domain');

  try {
    const output = execSync(`whois ${safe} 2>&1`, { encoding: 'utf8', timeout: 15000 });
    // Extract key fields
    const fields = {};
    const patterns = {
      registrar: /Registrar:\s*(.+)/i,
      created: /Creat(?:ion|ed)(?: Date)?:\s*(.+)/i,
      expires: /(?:Expir(?:y|ation)|Registry Expiry)(?: Date)?:\s*(.+)/i,
      updated: /Updated(?: Date)?:\s*(.+)/i,
      nameservers: /Name Server:\s*(.+)/gi,
      status: /(?:Domain )?Status:\s*(.+)/i,
    };

    for (const [key, regex] of Object.entries(patterns)) {
      if (key === 'nameservers') {
        const ns = [];
        let m;
        while ((m = regex.exec(output)) !== null) ns.push(m[1].trim());
        fields[key] = ns;
      } else {
        const m = regex.exec(output);
        if (m) fields[key] = m[1].trim();
      }
    }

    return { domain: safe, fields, raw: output };
  } catch (err) {
    return { domain: safe, fields: {}, error: err.message, raw: '' };
  }
}

// ═══ SSL CERTIFICATE CHECK ═══

function checkSslCert(host, port = 443) {
  const safe = sanitizeHostname(host);
  if (!safe) throw new Error('Invalid hostname');

  return new Promise((resolve) => {
    const socket = tls.connect({
      host: safe,
      port: parseInt(port) || 443,
      servername: safe,
      timeout: 10000,
      rejectUnauthorized: false,
    }, () => {
      const cert = socket.getPeerCertificate();
      socket.destroy();

      if (!cert || !cert.subject) {
        resolve({ host: safe, error: 'No certificate found' });
        return;
      }

      const now = new Date();
      const validFrom = new Date(cert.valid_from);
      const validTo = new Date(cert.valid_to);
      const daysLeft = Math.ceil((validTo - now) / (1000 * 60 * 60 * 24));

      resolve({
        host: safe,
        subject: cert.subject,
        issuer: cert.issuer,
        validFrom: validFrom.toISOString(),
        validTo: validTo.toISOString(),
        daysLeft,
        expired: daysLeft < 0,
        serialNumber: cert.serialNumber,
        fingerprint: cert.fingerprint,
        fingerprint256: cert.fingerprint256,
        altNames: cert.subjectaltname ? cert.subjectaltname.split(', ') : [],
        protocol: socket.getProtocol?.() || 'unknown',
        authorized: socket.authorized,
      });
    });

    socket.on('error', (err) => {
      resolve({ host: safe, error: err.message });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ host: safe, error: 'Connection timed out' });
    });
  });
}

// ═══ HTTP HEADERS CHECK ═══

function getHttpHeaders(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    const client = parsedUrl.protocol === 'https:' ? https : require('http');

    const req = client.request(parsedUrl, { method: 'HEAD', timeout: 10000 }, (res) => {
      resolve({
        url: parsedUrl.href,
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        headers: res.headers,
        httpVersion: res.httpVersion,
      });
    });

    req.on('error', (err) => reject(new Error(`HTTP error: ${err.message}`)));
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.end();
  });
}

// ═══ PORT CHECK ═══

function checkPort(host, port, timeoutMs = 3000) {
  const safe = sanitizeHostname(host);
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    const start = Date.now();
    socket.on('connect', () => {
      const latency = Date.now() - start;
      socket.destroy();
      resolve({ host: safe, port, open: true, latency });
    });
    socket.on('timeout', () => { socket.destroy(); resolve({ host: safe, port, open: false, error: 'timeout' }); });
    socket.on('error', (err) => { resolve({ host: safe, port, open: false, error: err.code || err.message }); });
    socket.connect(parseInt(port), safe);
  });
}

// ═══ COMMON PORTS INFO ═══

const COMMON_PORTS = {
  21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS',
  80: 'HTTP', 110: 'POP3', 143: 'IMAP', 443: 'HTTPS', 465: 'SMTPS',
  587: 'SMTP/TLS', 993: 'IMAPS', 995: 'POP3S', 3000: 'Dev Server',
  3306: 'MySQL', 5432: 'PostgreSQL', 5672: 'RabbitMQ', 6379: 'Redis',
  8080: 'HTTP Alt', 8443: 'HTTPS Alt', 27017: 'MongoDB', 9200: 'Elasticsearch',
};

function getPortInfo(port) {
  return COMMON_PORTS[parseInt(port)] || 'Unknown';
}

module.exports = {
  sanitizeHostname, isValidHostname,
  dnsLookup, reverseDns,
  ping, traceroute, whois,
  checkSslCert, getHttpHeaders, checkPort,
  COMMON_PORTS, getPortInfo,
};
