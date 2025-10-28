import 'package:flutter/material.dart';
import 'skeleton_loader.dart';

class SkeletonListLoader extends StatelessWidget {
  final int itemCount;
  final bool hasAvatar;
  final bool hasSubtitle;

  const SkeletonListLoader({
    Key? key,
    this.itemCount = 5,
    this.hasAvatar = true,
    this.hasSubtitle = true,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      itemCount: itemCount,
      itemBuilder: (context, index) {
        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (hasAvatar) ...[
                  SkeletonLoader(
                    width: 50,
                    height: 50,
                    isCircular: true,
                  ),
                  const SizedBox(width: 16),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SkeletonLoader(
                        height: 16,
                        width: 150,
                      ),
                      const SizedBox(height: 8),
                      if (hasSubtitle) ...[
                        SkeletonLoader(
                          height: 14,
                          width: double.infinity,
                        ),
                        const SizedBox(height: 8),
                      ],
                      SkeletonLoader(
                        height: 14,
                        width: 100,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}