import 'package:flutter/material.dart';

class CustomIllustration extends StatelessWidget {
  final double size;

  const CustomIllustration({Key? key, this.size = 150.0}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        color: Color(0xFFEDE9FE), // Light purple background
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Outer circle
          Container(
            width: size * 0.8,
            height: size * 0.8,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: Color(0xFFDDD6FE), // Medium purple
            ),
          ),
          // Inner circle
          Container(
            width: size * 0.6,
            height: size * 0.6,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: Color(0xFFC4B5FD), // Darker purple
            ),
          ),
          // Cross icon
          Icon(
            Icons.add,
            size: size * 0.4,
            color: Colors.white,
          ),
          // Rotate to make it a cross
          Transform.rotate(
            angle: 0.785, // 45 degrees in radians
            child: Icon(
              Icons.add,
              size: size * 0.4,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}