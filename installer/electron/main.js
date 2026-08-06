const { app, BrowserWindow, Menu, Tray, nativeImage, session, shell } = require('electron')
const path = require('path')

const DEFAULT_APP_URL = 'https://lumestack.de/chat'
const ICON_PATH = path.join(__dirname, 'assets', 'icon.png')
const ALLOWED_PERMISSIONS = new Set(['media', 'notifications', 'fullscreen', 'clipboard-sanitized-write'])

let mainWindow = null
let tray = null
let isQuitting = false

function getAppUrl() {
  try {
    const candidate = new URL(process.env.NOKKI_APP_URL || DEFAULT_APP_URL)
    const localDevelopment = candidate.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(candidate.hostname)
    if (candidate.protocol !== 'https:' && !localDevelopment) throw new Error('Unsichere URL')
    return candidate
  } catch {
    return new URL(DEFAULT_APP_URL)
  }
}

const appUrl = getAppUrl()
const appOrigin = appUrl.origin

function isAllowedAppUrl(rawUrl) {
  try {
    return new URL(rawUrl).origin === appOrigin
  } catch {
    return false
  }
}

function openExternal(rawUrl) {
  try {
    const url = new URL(rawUrl)
    if (['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)) {
      void shell.openExternal(url.toString())
    }
  } catch {}
}

function createApplicationMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{
      label: 'Nokki',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'Nokki',
      submenu: [
        { label: 'Startseite', click: () => void mainWindow?.loadURL(appUrl.toString()) },
        { label: 'Neu laden', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.webContents.reload() },
        { type: 'separator' },
        { label: 'Beenden', accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4', click: () => app.quit() },
      ],
    },
    { label: 'Bearbeiten', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'Ansicht', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Hilfe', submenu: [{ label: 'Nokki im Browser öffnen', click: () => openExternal(appUrl.toString()) }] },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function configurePermissions() {
  const allowed = (webContents, permission, requestingOrigin) => {
    const origin = requestingOrigin || webContents?.getURL()
    return isAllowedAppUrl(origin) && ALLOWED_PERMISSIONS.has(permission)
  }

  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => (
    allowed(webContents, permission, requestingOrigin)
  ))
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    callback(allowed(webContents, permission, details.requestingUrl))
  })
}

function createWindow() {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
    return mainWindow
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    title: 'Nokki',
    icon: ICON_PATH,
    backgroundColor: '#08090f',
    autoHideMenuBar: process.platform !== 'darwin',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: true,
      devTools: !app.isPackaged,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // Eine geladene Webseite darf den nativen Fenstertitel nicht auf einen alten
  // Produktnamen zurücksetzen.
  mainWindow.webContents.on('page-title-updated', event => {
    event.preventDefault()
    mainWindow?.setTitle('Nokki')
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedAppUrl(url)) {
      event.preventDefault()
      openExternal(url)
    }
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, _description, validatedUrl, isMainFrame) => {
    if (!isMainFrame || errorCode === -3 || !validatedUrl.startsWith(appOrigin)) return
    void mainWindow?.loadFile(path.join(__dirname, 'offline.html'), {
      query: { retry: appUrl.toString() },
    })
  })

  mainWindow.on('close', event => {
    if (!isQuitting && process.platform !== 'darwin') {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })
  void mainWindow.loadURL(appUrl.toString())
  return mainWindow
}

function createTray() {
  const icon = nativeImage.createFromPath(ICON_PATH)
  tray = new Tray(icon.resize({ width: process.platform === 'darwin' ? 18 : 20, height: process.platform === 'darwin' ? 18 : 20 }))
  tray.setToolTip('Nokki')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Nokki öffnen', click: () => createWindow() },
    { label: 'Neu laden', click: () => mainWindow?.webContents.reload() },
    { type: 'separator' },
    { label: 'Beenden', click: () => app.quit() },
  ]))
  tray.on('click', () => createWindow())
  tray.on('double-click', () => createWindow())
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => createWindow())

  app.whenReady().then(() => {
    app.setAppUserModelId('de.lumestack.nokki')
    configurePermissions()
    createApplicationMenu()
    createWindow()
    createTray()
  })
}

app.on('before-quit', () => { isQuitting = true })
app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return
  // Unter Windows/Linux bleibt Nokki im Tray aktiv.
})
app.on('activate', () => createWindow())
