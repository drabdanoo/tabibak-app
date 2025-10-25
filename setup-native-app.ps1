# Tabibak Native App Setup Script
# Run this in PowerShell

Write-Host "🚀 Setting up Tabibak Native Flutter App..." -ForegroundColor Green

# Create project
Write-Host "`n📦 Creating Flutter project..." -ForegroundColor Cyan
flutter create --org com.abdullah tabibak_native

# Navigate to project
cd tabibak_native

# Create folder structure
Write-Host "`n📁 Creating folder structure..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "lib/config"
New-Item -ItemType Directory -Force -Path "lib/models"
New-Item -ItemType Directory -Force -Path "lib/services"
New-Item -ItemType Directory -Force -Path "lib/providers"
New-Item -ItemType Directory -Force -Path "lib/screens/patient"
New-Item -ItemType Directory -Force -Path "lib/screens/doctor"
New-Item -ItemType Directory -Force -Path "lib/screens/receptionist"
New-Item -ItemType Directory -Force -Path "lib/widgets"
New-Item -ItemType Directory -Force -Path "lib/utils"
New-Item -ItemType Directory -Force -Path "assets/images"
New-Item -ItemType Directory -Force -Path "assets/icons"

Write-Host "`n✅ Project structure created!" -ForegroundColor Green
Write-Host "`n📋 Next steps:" -ForegroundColor Yellow
Write-Host "1. Copy google-services.json to android/app/" -ForegroundColor White
Write-Host "2. Update pubspec.yaml with dependencies" -ForegroundColor White
Write-Host "3. Run: flutter pub get" -ForegroundColor White
Write-Host "4. Start coding! 🎉" -ForegroundColor White
