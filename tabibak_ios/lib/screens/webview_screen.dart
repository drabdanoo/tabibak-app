import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:permission_handler/permission_handler.dart';
import 'dart:io';

class WebViewScreen extends StatefulWidget {
  final String url;
  final String title;

  const WebViewScreen({
    Key? key,
    required this.url,
    required this.title,
  }) : super(key: key);

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  late WebViewController _webViewController;
  bool _isLoading = true;
  bool _canGoBack = false;

  @override
  void initState() {
    super.initState();
    _requestPermissions();
    _initializeWebView();
  }

  Future<void> _requestPermissions() async {
    if (Platform.isIOS) {
      await Permission.camera.request();
      await Permission.microphone.request();
      await Permission.photos.request();
      await Permission.location.request();
    }
  }

  void _initializeWebView() {
    _webViewController = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (String url) {
            setState(() {
              _isLoading = true;
            });
          },
          onPageFinished: (String url) {
            setState(() {
              _isLoading = false;
            });
            _updateCanGoBack();
          },
          onWebResourceError: (WebResourceError error) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('خطأ: ${error.description}'),
                backgroundColor: Colors.red,
              ),
            );
          },
          onNavigationRequest: (NavigationRequest request) {
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.url));
  }

  Future<void> _updateCanGoBack() async {
    final canGoBack = await _webViewController.canGoBack();
    setState(() {
      _canGoBack = canGoBack;
    });
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: () async {
        if (_canGoBack) {
          await _webViewController.goBack();
          return false;
        }
        return true;
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.title),
          elevation: 0,
          backgroundColor: const Color(0xFF2D9B9B),
          foregroundColor: Colors.white,
          actions: [
            if (_canGoBack)
              IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () async {
                  if (await _webViewController.canGoBack()) {
                    await _webViewController.goBack();
                  }
                },
              ),
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: () {
                _webViewController.reload();
              },
            ),
          ],
        ),
        body: Stack(
          children: [
            WebViewWidget(controller: _webViewController),
            if (_isLoading)
              Container(
                color: Colors.white.withOpacity(0.7),
                child: const Center(
                  child: CircularProgressIndicator(
                    valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF2D9B9B)),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
