# ⚡ Guía Rápida de Compilación - CobroApp

## 🎯 Resumen Ejecutivo
**TODO LO QUE NECESITAS ESTÁ LISTO**. Solo sigue estos pasos:

---

## 🤖 Android APK

### Paso 1: Instalar Android Studio
- Descarga: https://developer.android.com/studio
- Sigue el instalador (incluye todo lo necesario)

### Paso 2: Configurar Variables
```bash
# Agrega a ~/.zshrc
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools

# Recarga
source ~/.zshrc
```

### Paso 3: Compilar
```bash
cd "/Users/haroldrosado/Documents/Cobro App/cobro-main"
./build-android.sh
```

### Resultado
📦 APK en: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🪟 Windows EXE

### Paso 1: Generar Icono .ico
1. Ve a: https://www.icoconverter.com/
2. Sube: `build-assets/icons/app-icon.png`
3. Descarga el .ico
4. Guarda como: `build-assets/icons/icon.ico`

### Paso 2: Compilar
```bash
cd "/Users/haroldrosado/Documents/Cobro App/cobro-main"
./build-windows.sh
```

### Resultado
📦 EXE en: `release/<version>/CobroApp-Setup-<version>.exe`

---

## 🆘 Si Algo Falla

**Android:**
```bash
cd android
./gradlew clean
./gradlew assembleDebug --stacktrace
```

**Windows:**
```bash
npm cache clean --force
rm -rf node_modules
npm install
npm run electron:build
```

---

## ✅ Checklist Final

- [ ] Android Studio instalado
- [ ] ANDROID_HOME configurado
- [ ] Icono .ico generado
- [ ] `./build-android.sh` ejecutado
- [ ] `./build-windows.sh` ejecutado
- [ ] APK probado en dispositivo
- [ ] EXE probado en Windows

---

**Tiempo estimado total**: 30-45 minutos (primera vez)
