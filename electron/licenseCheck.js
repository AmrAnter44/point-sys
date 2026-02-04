// electron/licenseCheck.js
// License verification for Electron startup

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Path to .env.production in production build
function loadEnvVars() {
  try {
    // Try to load from resources path (production)
    const envPaths = [
      path.join(process.resourcesPath, 'app', '.env.production'),
      path.join(process.cwd(), '.env.production'),
      path.join(process.cwd(), '.env')
    ];

    for (const envPath of envPaths) {
      if (fs.existsSync(envPath)) {
        console.log('📄 Loading env from:', envPath);
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n');

        const env = {};
        lines.forEach(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
              let value = valueParts.join('=').trim();
              // Remove quotes if present
              value = value.replace(/^["']|["']$/g, '');
              env[key.trim()] = value;
            }
          }
        });

        return env;
      }
    }

    console.warn('⚠️ No .env file found');
    return {};
  } catch (error) {
    console.error('❌ Error loading env:', error);
    return {};
  }
}

// Verify SHA1 signature
function verifySignature(enabled, signature, secretKey) {
  const expectedSig = crypto
    .createHash('sha1')
    .update(secretKey + enabled.toString())
    .digest('hex');

  console.log('🔐 License Signature Verification:');
  console.log('  • enabled:', enabled);
  console.log('  • Expected signature:', expectedSig);
  console.log('  • Received signature:', signature);
  console.log('  • Match:', expectedSig === signature);

  return expectedSig === signature;
}

// Fetch license from GitHub
function fetchLicenseData(url) {
  return new Promise((resolve, reject) => {
    console.log('📡 Fetching license from:', url);

    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Electron-App',
        'Cache-Control': 'no-cache'
      }
    };

    https.get(options, (res) => {
      console.log('📥 Response status:', res.statusCode);

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log('📦 License data received:', parsed);
          resolve(parsed);
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    }).on('error', (err) => {
      console.error('❌ License fetch error:', err);
      reject(err);
    });
  });
}

// Main license check function
async function checkLicense() {
  console.log('🔍 Starting Electron license validation...');

  try {
    // Load environment variables
    const env = loadEnvVars();
    const secretKey = env.LICENSE_SECRET_KEY;
    const checkUrl = env.LICENSE_CHECK_URL;

    if (!secretKey || !checkUrl) {
      console.error('❌ License configuration missing');
      return {
        isValid: false,
        message: 'License configuration is missing. Please contact support.'
      };
    }

    // Fetch license data
    const data = await fetchLicenseData(checkUrl);

    if (!data) {
      console.log('❌ No license data received');
      return {
        isValid: false,
        message: 'Unable to verify license. Please check your internet connection.'
      };
    }

    // Verify signature
    const sigValid = verifySignature(data.enabled, data.sig, secretKey);

    if (!sigValid) {
      console.log('❌ License signature validation FAILED');
      return {
        isValid: false,
        message: 'License signature is invalid. Please contact support.'
      };
    }

    console.log('✅ Signature validation passed');

    // Check if enabled
    if (!data.enabled) {
      console.log('🔒 License is DISABLED (enabled=false)');
      return {
        isValid: false,
        message: data.message || 'License has been deactivated. Please contact support.'
      };
    }

    console.log('✅ License validation successful - Application UNLOCKED');
    return {
      isValid: true,
      message: data.message || 'License is valid.'
    };

  } catch (error) {
    console.error('❌ License check error:', error);
    return {
      isValid: false,
      message: `License verification failed: ${error.message}`
    };
  }
}

module.exports = { checkLicense };
