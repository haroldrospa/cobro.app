# ⚡ Guía Rápida de Compilación - CobroApp

## 🎯 Resumen Ejecutivo
**TODO LO QUE NECESITAS ESTÁ LISTO**. Solo sigue estos pasos:

---

## 🤖 Android

Verificado en esta máquina (Windows + Git Bash):
- **JDK 17** (Temurin) — coincide con lo que pide `android/app/build.gradle`.
  No hace falta JDK 21.
- **Android SDK** instalado en `C:\Users\Harold\AppData\Local\Android\Sdk`.
- `android/local.properties` ya apunta Gradle a ese SDK (archivo **local**,
  ignorado por git — si compilas desde otra máquina, hay que recrearlo con
  `sdk.dir=<ruta-a-tu-Android-Sdk>`).

Si compilas desde una máquina nueva sin el SDK instalado, la forma más simple
es instalar **Android Studio** (https://developer.android.com/studio), que
trae el SDK incluido.

### Build de prueba (debug, sin firmar)

Para instalar en tu propio dispositivo y probar cambios rápido:

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

📦 APK en: `android/app/build/outputs/apk/debug/app-debug.apk`

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Build de release (firmado, para Play Store)

Requiere el keystore de release: `android/keystore.properties` +
`android/app/cobroapp-release.jks` (ambos **locales, ignorados por git**).
Si trabajas desde otra máquina, restáuralos desde tu respaldo — **nunca
generes un keystore nuevo**, eso invalida la firma de todas las
actualizaciones futuras publicadas en Play Store con la app actual.

```bash
npm run build
npx cap sync android
cd android
./gradlew bundleRelease
```

📦 AAB (formato que exige Play Store) en:
`android/app/build/outputs/bundle/release/app-release.aab`

Contenido de la ficha de la tienda listo en
[`docs/PLAY_STORE_LISTING.md`](docs/PLAY_STORE_LISTING.md).

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
# o, para el release firmado:
./gradlew bundleRelease --stacktrace
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

**Android**
- [ ] JDK 17 y Android SDK disponibles (ver sección de arriba)
- [ ] `android/local.properties` con el `sdk.dir` correcto
- [ ] Para release: `android/keystore.properties` y el `.jks` restaurados
      desde el respaldo
- [ ] `./gradlew bundleRelease` ejecutado sin errores
- [ ] AAB probado (pista de prueba interna en Play Console, o instalando vía
      `bundletool`)

**Windows (Electron)**
- [ ] Icono .ico generado
- [ ] `./build-windows.sh` ejecutado
- [ ] EXE probado en Windows

---

**Tiempo estimado total**: 30-45 minutos (primera vez)
