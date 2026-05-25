import electron, { ipcMain } from 'electron'
const { app, BrowserWindow } = electron
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: any | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC || '', 'favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// --- Native Printing Handlers ---

ipcMain.handle('get-printers', async () => {
  if (!win) return [];
  try {
    return await win.webContents.getPrintersAsync();
  } catch (error) {
    console.error('Error fetching printers:', error);
    return [];
  }
});

ipcMain.handle('print-data', async (_event, options) => {
  if (!win) return { success: false, error: 'No main window' };

  const width = options.width || '80mm'; // Unused in pure print(), but good for context
  const printerName = options.printerName;
  const htmlContent = options.htmlContent;

  try {
    // Create a hidden window for printing
    let printWin = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: true,
      }
    });

    // Load the content
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    // Wait for load
    await new Promise(resolve => setTimeout(resolve, 500));

    // Print
    const printOptions: any = {
      silent: true,
      printBackground: true,
      deviceName: printerName,
    };

    // Attempt to configure paper size? Electron printing API is limited here for custom sizes
    // unless we use printToPDF then print. But simple printing often works if driver is set.

    await printWin.webContents.print(printOptions, (success, errorType) => {
      if (!success) {
        console.error('Print failed:', errorType);
      }
    });

    // Close and cleanup
    // We wait a bit to ensure job is sent
    setTimeout(() => {
      printWin.close();
    }, 5000);

    return { success: true };
  } catch (error: any) {
    console.error('Printing error:', error);
    return { success: false, error: error.message };
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
