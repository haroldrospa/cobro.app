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

## 🍎 iOS

No hay Mac en esta máquina (Windows), y Xcode solo corre en macOS — así que
el build de iOS se hace en la nube con **Codemagic**
(https://codemagic.io), sin necesitar comprar ni prestar una Mac.

Ya está scaffoldeado en `ios/` (`npx cap add ios`, hecho una vez — de ahí
en adelante solo hace falta `npx cap sync ios` tras cada cambio del lado
web) y el workflow de build vive en [`codemagic.yaml`](codemagic.yaml) en
la raíz del repo.

⚠️ **El escáner de código de barras (cámara) y la impresión térmica por
Bluetooth son plugins nativos escritos solo en Kotlin/Android** — no existe
todavía su equivalente en Swift para iOS. El código ya oculta esas
opciones fuera de Android (`isAndroidNative()` en `src/utils/platform.ts`),
así que el build de iOS no se rompe, simplemente sale sin esas dos
funciones hasta que alguien las implemente nativamente en Swift. Ver el
aviso al inicio de [`docs/APP_STORE_LISTING.md`](docs/APP_STORE_LISTING.md).

### Setup único (antes del primer build)

1. Inscribirse en **Apple Developer Program** (developer.apple.com,
   USD $99/año) — usar tipo de cuenta **Individual**, no Organización, para
   no necesitar un número D-U-N-S.
2. En App Store Connect, crear la ficha de la app (`com.cobro.app`) y
   copiar el **Apple ID** numérico que le asigna (App Information → Apple
   ID) — va en `APP_STORE_APPLE_ID` dentro de `codemagic.yaml`.
3. Generar una API key en App Store Connect (Users and Access →
   Integrations → App Store Connect API, acceso "App Manager") y subirla
   en Codemagic (Team settings → Code signing identities → App Store
   Connect) con el nombre `cobroapp_appstore` (o el que se use — debe
   coincidir con `integrations.app_store_connect` en `codemagic.yaml`).
4. Conectar este repositorio como app nueva en Codemagic y decirle que use
   `codemagic.yaml` del repo.

### Build de release (sube automáticamente a TestFlight)

Se dispara desde el dashboard de Codemagic (workflow `ios-release`), no
desde esta máquina — Codemagic compila en una Mac suya, firma con la API
key configurada arriba, y publica el `.ipa` en TestFlight.

Contenido de la ficha de la tienda listo en
[`docs/APP_STORE_LISTING.md`](docs/APP_STORE_LISTING.md).

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

**iOS**
- [ ] Inscrito en Apple Developer Program (cuenta Individual)
- [ ] App creada en App Store Connect, `APP_STORE_APPLE_ID` copiado a
      `codemagic.yaml`
- [ ] API key de App Store Connect subida a Codemagic
- [ ] Repo conectado en Codemagic, workflow `ios-release` corrido sin
      errores
- [ ] Build probado desde TestFlight

**Windows (Electron)**
- [ ] Icono .ico generado
- [ ] `./build-windows.sh` ejecutado
- [ ] EXE probado en Windows

---

**Tiempo estimado total**: 30-45 minutos (primera vez, con Android y Windows
ya listos). iOS depende de tiempos externos: aprobación de Apple Developer
Program (horas a pocos días) y tiempo de build en Codemagic (~10-20 min por
build, dentro del free tier para uso ocasional).
