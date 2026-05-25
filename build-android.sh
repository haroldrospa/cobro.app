#!/bin/bash

# 🚀 CobroApp - Build Script for Android
# Este script compila la aplicación para Android

set -e  # Exit on error

echo "🎯 CobroApp - Android Build Script"
echo "=================================="
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
print_step() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# 1. Verificar Node.js
print_step "Verificando Node.js..."
if ! command -v node &> /dev/null; then
    print_error "Node.js no está instalado. Instala Node.js 18+ primero."
    exit 1
fi
echo "   Node version: $(node -v)"

# 2. Verificar Java
print_step "Verificando Java JDK..."
if ! command -v java &> /dev/null; then
    print_error "Java no está instalado. Instalaría JDK 17."
    exit 1
fi
echo "   Java version: $(java -version 2>&1 | head -n 1)"

# 3. Verificar Android SDK
print_step "Verificando Android SDK..."
if [ -z "$ANDROID_HOME" ]; then
    print_warning "ANDROID_HOME no está configurado."
    print_warning "Intenta ejecutar: export ANDROID_HOME=\$HOME/Library/Android/sdk"
    exit 1
fi
echo "   Android SDK: $ANDROID_HOME"

# 4. Instalar dependencias
print_step "Instalando dependencias de Node..."
npm install

# 5. Build de la aplicación web
print_step "Compilando aplicación web (Vite)..."
npm run build

# 6. Sincronizar con Capacitor
print_step "Sincronizando con Capacitor..."
npx cap sync android

# 7. Compilar APK
print_step "Compilando APK de Android..."
cd android

# Limpiar builds anteriores
print_step "Limpiando builds anteriores..."
./gradlew clean

# Compilar APK de debug
print_step "Compilando APK de debug..."
./gradlew assembleDebug

cd ..

# 8. Resultado
print_step "¡Build completado con éxito!"
echo ""
echo "📦 APK generado en:"
echo "   ${GREEN}android/app/build/outputs/apk/debug/app-debug.apk${NC}"
echo ""
echo "📱 Para instalar en un dispositivo conectado:"
echo "   adb install android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
