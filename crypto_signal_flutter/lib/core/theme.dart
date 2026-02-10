import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color primaryColor = Color(0xFF6366f1);
  static const Color secondaryColor = Color(0xFF4f46e5);
  static const Color backgroundColor = Color(0xFF020617);
  static const Color cardColor = Color(0x1A64748B); // Semi-transparent for glassmorphism
  static const Color textColor = Colors.white;
  static const Color mutedTextColor = Color(0xFF94A3B8);

  static ThemeData darkTheme = ThemeData(
    brightness: Brightness.dark,
    primaryColor: primaryColor,
    scaffoldBackgroundColor: backgroundColor,
    textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme).copyWith(
      displayLarge: const TextStyle(color: textColor, fontWeight: FontWeight.bold),
      bodyLarge: const TextStyle(color: textColor),
      bodyMedium: const TextStyle(color: mutedTextColor),
    ),
    cardTheme: CardThemeData(
      color: const Color(0xFF1E293B),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 0,
    ),
  );
}
