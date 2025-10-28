# 🎨 App Icon & Logo Guide

## Your Tabibok Logo

Based on your Canva designs:
- **Primary Logo**: Teal stethoscope forming a heart shape
- **Color**: #2D9B9B (Teal/Turquoise)
- **Style**: Medical, clean, professional
- **Background**: White for app icon, transparent for splash

---

## 📱 Required Images

### 1. App Launcher Icons (Required)

You need to create PNG images in these exact sizes:

| Density | Size | Location |
|---------|------|----------|
| mdpi | 48x48 | `app/src/main/res/mipmap-mdpi/` |
| hdpi | 72x72 | `app/src/main/res/mipmap-hdpi/` |
| xhdpi | 96x96 | `app/src/main/res/mipmap-xhdpi/` |
| xxhdpi | 144x144 | `app/src/main/res/mipmap-xxhdpi/` |
| xxxhdpi | 192x192 | `app/src/main/res/mipmap-xxxhdpi/` |

**Files needed in each folder:**
- `ic_launcher.png` - Square icon
- `ic_launcher_round.png` - Round icon (same image, will be cropped)

### 2. Splash Screen Logo (Required)

| File | Size | Location |
|------|------|----------|
| logo_splash.png | 512x512 or larger | `app/src/main/res/drawable/` |

**Requirements:**
- Transparent background (PNG with alpha channel)
- High resolution (512x512 minimum, 1024x1024 recommended)
- White or light-colored logo (shows on teal background)

---

## 🚀 Quick Method: Use Icon Generator

### Option 1: Online Tool (Easiest)

1. **Go to**: https://appicon.co/ or https://easyappicon.com/

2. **Upload**: Your 1024x1024 logo from Canva

3. **Select**: Android

4. **Download**: ZIP file with all sizes

5. **Extract**: Copy all folders to `app/src/main/res/`

### Option 2: Android Studio (Built-in)

1. **Right-click** on `res` folder in Android Studio

2. **Select**: New > Image Asset

3. **Asset Type**: Launcher Icons (Adaptive and Legacy)

4. **Foreground Layer**: 
   - Select your logo image
   - Adjust padding/scaling

5. **Background Layer**: 
   - Choose color: #2D9B9B (teal)

6. **Click**: Next > Finish

7. **Result**: All icon sizes generated automatically!

### Option 3: Manual Export from Canva

1. **In Canva**, open your icon design

2. **Click**: Share > Download

3. **File type**: PNG

4. **Size**: Custom dimensions

5. **Export each size**:
   ```
   48x48   → mipmap-mdpi
   72x72   → mipmap-hdpi
   96x96   → mipmap-xhdpi
   144x144 → mipmap-xxhdpi
   192x192 → mipmap-xxxhdpi
   512x512 → drawable (splash logo)
   ```

6. **Rename** files to:
   - `ic_launcher.png`
   - `ic_launcher_round.png`
   - `logo_splash.png`

---

## 🎨 Design Recommendations

### App Icon (Launcher)
```
✅ DO:
- Use your teal stethoscope-heart logo
- White or rounded square background
- Clear, recognizable at small sizes
- Consistent with brand colors

❌ DON'T:
- Use text (too small to read)
- Use complex details
- Use transparent background (for launcher icon)
- Use photos or gradients
```

### Splash Logo
```
✅ DO:
- Use transparent background
- Use white or light color (shows on teal)
- High resolution (512x512+)
- Center the logo
- Keep it simple and clean

❌ DON'T:
- Use dark colors (won't show on teal background)
- Use low resolution
- Include text (add in layout instead)
```

---

## 📐 Icon Specifications

### Launcher Icon Guidelines
- **Format**: PNG-24 with alpha channel
- **Color Space**: sRGB
- **Shape**: Square with rounded corners (system will apply)
- **Safe Zone**: Keep important content in center 80%
- **Shadow**: None (system adds shadow)

### Adaptive Icons (Android 8.0+)
- **Foreground**: Your logo (108x108dp canvas, 72x72dp safe zone)
- **Background**: Solid color or simple pattern
- **Layers**: Separate foreground and background for parallax effect

---

## 🖼️ Your Tabibok Icons

Based on your Canva design, here's what to export:

### From Screenshot 1 (Logo with text)
```
Use this for: Splash screen
Export as: logo_splash.png (512x512)
Background: Transparent
Color: White logo on transparent
```

### From Screenshot 2 (Icon version)
```
Use this for: App launcher icons
Export as: ic_launcher.png (all sizes)
Background: White or light gray
Color: Teal logo (#2D9B9B)
```

---

## ✅ Checklist

Before building APK, ensure you have:

- [ ] `mipmap-mdpi/ic_launcher.png` (48x48)
- [ ] `mipmap-mdpi/ic_launcher_round.png` (48x48)
- [ ] `mipmap-hdpi/ic_launcher.png` (72x72)
- [ ] `mipmap-hdpi/ic_launcher_round.png` (72x72)
- [ ] `mipmap-xhdpi/ic_launcher.png` (96x96)
- [ ] `mipmap-xhdpi/ic_launcher_round.png` (96x96)
- [ ] `mipmap-xxhdpi/ic_launcher.png` (144x144)
- [ ] `mipmap-xxhdpi/ic_launcher_round.png` (144x144)
- [ ] `mipmap-xxxhdpi/ic_launcher.png` (192x192)
- [ ] `mipmap-xxxhdpi/ic_launcher_round.png` (192x192)
- [ ] `drawable/logo_splash.png` (512x512+)

---

## 🎯 Quick Test

After adding icons:

1. **Build APK** in Android Studio
2. **Install** on device
3. **Check**:
   - App icon appears in launcher
   - Icon looks clear and sharp
   - Splash screen shows logo correctly
   - Colors match your brand

---

## 💡 Pro Tips

1. **Use 1024x1024 master**: Export from Canva at highest resolution, then scale down
2. **Test on device**: Icons look different on screen vs computer
3. **Check all densities**: Test on phones with different screen densities
4. **Keep it simple**: Complex logos don't work well at small sizes
5. **Consistent branding**: Use same colors and style across all assets

---

## 🔧 Troubleshooting

### Icon not showing after install
- **Solution**: Uninstall app completely, then reinstall

### Icon looks blurry
- **Solution**: Export at higher resolution, ensure PNG not JPG

### Splash logo not visible
- **Solution**: Check if logo color contrasts with teal background

### Wrong icon shape
- **Solution**: Android system applies shape, ensure safe zone is respected

---

## 📞 Need Help?

If you need help exporting icons from Canva:
1. Open your design in Canva
2. Click "Share" > "Download"
3. Select PNG format
4. Choose custom size
5. Enter dimensions (e.g., 192x192)
6. Download and rename

**That's it!** Your icons are ready to use! 🎉
