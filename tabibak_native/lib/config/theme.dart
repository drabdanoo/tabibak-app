import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // Premium Color Palette - Modern Clinic Aesthetic
  // Gradient Purples (Indigo → Soft Violet)
  static const Color primaryIndigo = Color(0xFF5B21B6); // Deep indigo
  static const Color primaryViolet = Color(0xFF7C3AED); // Soft violet
  static const Color primaryPurpleLight = Color(0xFF9333EA); // Light purple
  static const Color accentGold = Color(0xFFD4AF37); // Premium gold accent
  static const Color accentCyan = Color(0xFF06B6D4); // Cyan accent
  
  // Neutrals (Off-white & Stone Gray)
  static const Color backgroundStone = Color(0xFFF5F5F4); // Stone gray background
  static const Color cardWhite = Color(0xFFFAFAFA); // Off-white cards
  static const Color textPrimary = Color(0xFF1C1917); // Rich black
  static const Color textSecondary = Color(0xFF78716C); // Muted gray
  
  // Status Colors (Muted)
  static const Color errorRed = Color(0xFFDC2626);
  static const Color warningAmber = Color(0xFFF59E0B);
  static const Color successEmerald = Color(0xFF059669);
  
  // Legacy colors (for backwards compatibility)
  static const Color primaryPurple = primaryIndigo;
  static const Color primaryGreen = primaryIndigo;
  static const Color secondaryBlue = accentCyan;
  static const Color secondaryPurple = primaryViolet;
  static const Color backgroundGray = backgroundStone;
  static const Color cardBackground = cardWhite;
  static const Color successGreen = successEmerald;
  static const Color warningOrange = warningAmber;
  static const Color accentBlue = accentCyan;
  static const Color accentTeal = accentCyan;
  
  // Gradient for premium headers
  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [primaryIndigo, primaryViolet],
  );

  static ThemeData get lightTheme {
    return ThemeData(
      primaryColor: primaryIndigo,
      scaffoldBackgroundColor: backgroundStone,
      fontFamily: GoogleFonts.poppins().fontFamily, // Elegant, legible typeface
      useMaterial3: true,
      
      colorScheme: const ColorScheme.light(
        primary: primaryIndigo,
        secondary: primaryViolet,
        tertiary: accentGold,
        error: errorRed,
        surface: cardWhite,
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        onError: Colors.white,
        onSurface: textPrimary,
      ),
      
      appBarTheme: AppBarTheme(
        backgroundColor: primaryIndigo,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        iconTheme: const IconThemeData(color: Colors.white, size: 24),
        titleTextStyle: GoogleFonts.poppins(
          fontSize: 22,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.5, // Increased letter spacing for luxury
          color: Colors.white,
        ),
      ),
      
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryIndigo, // Primary background
          foregroundColor: Colors.white, // Text color
          textStyle: GoogleFonts.poppins(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
          elevation: 4,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ).copyWith(
          shadowColor: WidgetStateProperty.all(primaryIndigo.withValues(alpha: 0.25)), // Subtle shadow with soft blur
          animationDuration: const Duration(milliseconds: 200),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          visualDensity: VisualDensity.compact,
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: primaryIndigo, // Text color
          textStyle: GoogleFonts.poppins(
            fontSize: 16,
            fontWeight: FontWeight.w500,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ).copyWith(
          overlayColor: WidgetStateProperty.all(primaryIndigo.withValues(alpha: 0.1)), // Hover/focus effect
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: textSecondary, // Text color
          textStyle: GoogleFonts.poppins(
            fontSize: 16,
            fontWeight: FontWeight.w500,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          side: BorderSide(color: textSecondary.withValues(alpha: 0.2)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ).copyWith(
          side: WidgetStateProperty.all(BorderSide(color: textSecondary.withValues(alpha: 0.2))),
        ),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: textSecondary.withValues(alpha: 0.2)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(
            color: primaryIndigo,
            width: 2.0,
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: errorRed, width: 2),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: errorRed, width: 2),
        ),
        labelStyle: GoogleFonts.poppins(
          color: textSecondary.withValues(alpha: 0.6),
          fontSize: 16,
        ),
        floatingLabelStyle: const TextStyle(
          color: primaryIndigo,
        ),
      ),

      cardTheme: const CardThemeData(
        color: Colors.white,
        elevation: 4,
        shadowColor: Color(0x0f5b21b6), // primaryIndigo.withValues(alpha: 0.06)
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(16)),
        ),
        margin: EdgeInsets.all(0),
      ),

      dialogTheme: const DialogThemeData(
        backgroundColor: Colors.white,
        elevation: 8,
        shadowColor: Color(0x0f5b21b6), // primaryIndigo.withValues(alpha: 0.06)
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(20)),
        ),
      ),

      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: primaryIndigo,
        unselectedItemColor: textSecondary.withValues(alpha: 0.6),
        selectedLabelStyle: GoogleFonts.poppins(
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
        unselectedLabelStyle: GoogleFonts.poppins(
          fontSize: 12,
        ),
        type: BottomNavigationBarType.fixed,
        elevation: 8,
        showSelectedLabels: true,
        showUnselectedLabels: true,
      ),

      listTileTheme: ListTileThemeData(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        tileColor: Colors.white,
        iconColor: primaryIndigo,
        textColor: textPrimary,
        style: ListTileStyle.drawer,
      ),

      // Material state properties for better accessibility
      textSelectionTheme: const TextSelectionThemeData(
        cursorColor: primaryIndigo,
        selectionColor: primaryViolet,
        selectionHandleColor: primaryIndigo,
      ),
      
      // Scrollbar theme for better visibility
      scrollbarTheme: ScrollbarThemeData(
        thumbColor: WidgetStateProperty.all(primaryIndigo.withValues(alpha: 0.7)),
        thickness: WidgetStateProperty.all(6.0),
        radius: const Radius.circular(8),
      ),
    );
  }

  // Card Styles
  static BoxDecoration cardDecoration({Color? color, BorderRadius? borderRadius, List<BoxShadow>? boxShadow}) {
    return BoxDecoration(
      color: color ?? cardWhite,
      borderRadius: borderRadius ?? BorderRadius.circular(24),
      boxShadow: boxShadow ?? [
        BoxShadow(
          color: primaryIndigo.withValues(alpha: 0.15),
          blurRadius: 12,
          offset: const Offset(0, 4),
        ),
      ],
    );
  }

  static BoxDecoration cardShadow({Color? color, BorderRadius? borderRadius}) {
    return BoxDecoration(
      color: color ?? cardWhite,
      borderRadius: borderRadius ?? BorderRadius.circular(24),
      boxShadow: [
        BoxShadow(
          color: primaryIndigo.withValues(alpha: 0.06),
          blurRadius: 16,
          offset: const Offset(0, 8),
        ),
      ],
    );
  }
}
