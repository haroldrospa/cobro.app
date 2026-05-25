#!/bin/bash

# 🚀 CobroApp - Build Script for Windows
# Este script compila la aplicación para Windows (.exe)

set -e  # Exit on error

echo "🎯 CobroApp - Windows Build Script"
echo "==================================="
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

# 2. Verificar electron-builder
print_step "Verificando electron-builder..."
if ! npm list electron-builder &> /dev/null; then
    print_warning "electron-builder no encontrado en dependencias."
    print_step "Instalando electron-builder..."
    npm install --save-dev electron-builder
fi

# 3. Instalar dependencias
print_step "Instalando dependencias de Node..."
npm install

# 4. Build de la aplicación web
print_step "Compilando aplicación web (Vite)..."
npm run build

# 5. Compilar Electron Windows
print_step "Compilando aplicación Electron para Windows..."
npm run electron:build

# 6. Resultado
VERSION=$(node -p "require('./package.json').version")
print_step "¡Build completado con éxito!"
echo ""
echo "📦 Instalador de Windows generado en:"
echo "   ${GREEN}release/${VERSION}/CobroApp-Setup-${VERSION}.exe${NC}"
echo ""
echo "💾 Tamaño aproximado: ~100-150 MB"
echo ""
echo "🎯 Para ejecutar:"
echo "   1. Navega a release/${VERSION}/"
echo "   2. Ejecuta el instalador .exe"
echo "   3. Sigue las instrucciones en pantalla"
echo ""
