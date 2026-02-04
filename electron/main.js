const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const isDev = require('electron-is-dev');
const fs = require('fs');
const http = require('http');
const os = require('os');
const { checkLicense } = require('./licenseCheck');

let mainWindow;
let serverProcess;

// ------------------ وظائف مساعدة ------------------

// الحصول على IP Address المحلي
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // تجاهل internal (127.0.0.1) و IPv6
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost'; // fallback
}

// التحقق من المنفذ
function checkPort(port) {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

// إيقاف أي عملية تستخدم المنفذ
async function killProcessOnPort(port) {
  return new Promise((resolve) => {
    exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
      if (!stdout) return resolve();
      const lines = stdout.split('\n');
      const pids = new Set();
      lines.forEach(line => {
        const pid = line.trim().split(/\s+/).pop();
        if (!isNaN(pid)) pids.add(pid);
      });
      pids.forEach(pid => {
        try { process.kill(pid); } catch {}
      });
      setTimeout(resolve, 500);
    });
  });
}

// نسخ مجلدات
function copyFolderRecursive(source, target) {
  if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  if (fs.lstatSync(source).isDirectory()) {
    fs.readdirSync(source).forEach(file => {
      const curSource = path.join(source, file);
      const curTarget = path.join(target, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursive(curSource, curTarget);
      } else {
        fs.copyFileSync(curSource, curTarget);
      }
    });
  }
}

// ------------------ تشغيل Next Production ------------------

async function startProductionServer() {
  try {
    // ✅ تشغيل migration script أولاً
    try {
      const { migrateDatabase } = require('./check-and-migrate');
      const possibleDbPaths = [
        path.join(process.resourcesPath, 'app', 'prisma', 'gym.db'),
        path.join(process.cwd(), 'prisma', 'gym.db')
      ];
      for (const dbPath of possibleDbPaths) {
        if (fs.existsSync(dbPath)) {
          migrateDatabase(dbPath);
          break;
        }
      }
    } catch (migrationError) {
      console.warn('⚠️ Migration warning:', migrationError.message);
      // Continue even if migration fails (database might not exist yet)
    }

    // kill port إذا مش فاضي
    const portAvailable = await checkPort(4001);
    if (!portAvailable) {
      console.log('Port 4001 in use, killing...');
      await killProcessOnPort(4001);
    }

    // البحث عن مسار Next.js standalone
    const possiblePaths = [
      // في حالة extraResources (Production)
      path.join(process.resourcesPath, 'app'),
      // في حالة development
      path.join(process.cwd(), '.next', 'standalone'),
      // fallback
      process.cwd()
    ];

    let appPath = null;
    let serverFile = null;

    // البحث عن server.js
    for (const testPath of possiblePaths) {
      const serverPath = path.join(testPath, 'server.js');
      console.log('Checking path:', serverPath);
      if (fs.existsSync(serverPath)) {
        appPath = testPath;
        serverFile = serverPath;
        console.log('✓ Found server at:', serverPath);
        break;
      }
    }

    // تحديد مسار Node.js المضمّن
    // في Production، نستخدم node.exe من مجلد Electron
    const nodePath = path.join(process.resourcesPath, '..', 'node.exe');
    const useSystemNode = !fs.existsSync(nodePath);

    // إذا مش لاقيين standalone، نستخدم npx next start
    if (!serverFile) {
      console.log('Standalone not found, using npx next start');
      appPath = possiblePaths.find(p => fs.existsSync(path.join(p, 'package.json')));
      if (!appPath) throw new Error('Next.js files not found');

      serverProcess = spawn('npx', ['next', 'start', '-p', '4001', '-H', '0.0.0.0'], {
        cwd: appPath,
        env: { ...process.env, NODE_ENV: 'production', PORT: '4001', HOSTNAME: '0.0.0.0' },
        shell: true,
        stdio: 'pipe'
      });
    } else {
      // تشغيل standalone server.js مباشرة باستخدام require
      console.log('Starting standalone server');

      // تحديد مسار قاعدة البيانات (relative من appPath)
      const DATABASE_URL = 'file:./prisma/gym.db';

      console.log('App path:', appPath);
      console.log('Database URL:', DATABASE_URL);

      // تعيين المتغيرات البيئية
      process.env.NODE_ENV = 'production';
      process.env.PORT = '4001';
      process.env.HOSTNAME = '0.0.0.0';
      process.env.DATABASE_URL = DATABASE_URL;

      // تغيير المجلد الحالي
      process.chdir(appPath);

      // تشغيل السيرفر مباشرة
      require(serverFile);

      console.log('✅ Server started via require()');
    }

    // فقط إذا كان serverProcess موجود (حالة npx)
    if (serverProcess) {
      serverProcess.stdout.on('data', data => console.log(`Next: ${data}`));
      serverProcess.stderr.on('data', data => console.error(`Next ERR: ${data}`));
      serverProcess.on('error', err => console.error('Server failed:', err));
      serverProcess.on('exit', code => { if (code !== 0) console.error('Server exited code:', code); });
    }

  } catch (error) {
    console.error('Error starting server:', error);
    dialog.showErrorBox('خطأ في السيرفر', error.message);
  }
}

// ------------------ إنشاء نافذة Electron ------------------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    center: true,
    icon: path.join(__dirname, '../build/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      partition: 'persist:gym', // حفظ الـ cookies والـ session
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: !isDev,
    title: 'نظام إدارة الصالة الرياضية',
    backgroundColor: '#ffffff',
    show: false
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  const startUrl = 'http://localhost:4001';
  let attempts = 0, maxAttempts = 30;

  const loadApp = () => {
    attempts++;
    http.get(startUrl, () => mainWindow.loadURL(startUrl))
      .on('error', () => {
        if (attempts < maxAttempts) setTimeout(loadApp, 1000);
        else {
          dialog.showErrorBox('خطأ في التشغيل', 'فشل في بدء خادم التطبيق. يرجى إعادة تشغيل البرنامج.');
          app.quit();
        }
      });
  };
  setTimeout(loadApp, isDev ? 100 : 3000);

  if (isDev) mainWindow.webContents.openDevTools();
  else {
    mainWindow.removeMenu();
    Menu.setApplicationMenu(null);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (serverProcess) serverProcess.kill();
  });
}

// ------------------ IPC Handlers ------------------

// ✅ Handler للحصول على IP Address
ipcMain.handle('get-local-ip', () => {
  return getLocalIPAddress();
});

// ------------------ أحداث التطبيق ------------------

app.whenReady().then(async () => {
  // ✅ فحص الترخيص قبل بدء التطبيق (في Production فقط)
  if (!isDev) {
    console.log('🔒 Checking license...');
    const licenseResult = await checkLicense();

    if (!licenseResult.isValid) {
      console.error('❌ License check failed:', licenseResult.message);
      dialog.showErrorBox(
        '🔒 النظام معطل - System Locked',
        `${licenseResult.message}\n\n` +
        `الرجاء التواصل مع الدعم الفني:\n` +
        `📞 +201028518754\n` +
        `💬 WhatsApp: +201028518754`
      );
      app.quit();
      return;
    }

    console.log('✅ License validated successfully');
    await startProductionServer();
  }

  createWindow();
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  if (error.code !== 'EPIPE') dialog.showErrorBox('خطأ غير متوقع', error.message);
});

app.on('before-quit', async () => {
  if (serverProcess) serverProcess.kill();
  await killProcessOnPort(4001);
});
