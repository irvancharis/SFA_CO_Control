import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter/material.dart';
import '../utils/api_config.dart';

class VersionService {
  static Future<void> checkUpdate(BuildContext context) async {
    try {
      final PackageInfo packageInfo = await PackageInfo.fromPlatform();
      final int currentBuildNumber = int.tryParse(packageInfo.buildNumber) ?? 0;

      final response =
          await http.get(Uri.parse(ApiConfig.getUrl('/api/apk-latest')));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data == null) return;

        final String latestVersion = data['version_name'];
        final int latestBuildNumber = data['version_code'];
        final String downloadUrl = data['download_url'];
        final String releaseNotes = data['release_notes'] ??
            'Perbaikan sistem dan peningkatan performa.';
        final bool isForceUpdate = data['is_force_update'] == 1;

        if (latestBuildNumber > currentBuildNumber) {
          _showUpdateDialog(
            context,
            latestVersion,
            releaseNotes,
            downloadUrl,
            isForceUpdate,
          );
        }
      }
    } catch (e) {
      print('Error checking update: $e');
    }
  }

  static void _showUpdateDialog(
    BuildContext context,
    String version,
    String notes,
    String url,
    bool forceUpdate,
  ) {
    showDialog(
      context: context,
      barrierDismissible: !forceUpdate,
      builder: (context) => WillPopScope(
        onWillPop: () async => !forceUpdate,
        child: AlertDialog(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            children: [
              Icon(Icons.system_update, color: Colors.blue),
              SizedBox(width: 10),
              Text('Update Tersedia'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Versi terbaru ($version) sudah tersedia.',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              SizedBox(height: 10),
              Text('Apa yang baru:'),
              Text(notes,
                  style: TextStyle(color: Colors.grey[700], fontSize: 13)),
              if (forceUpdate) ...[
                SizedBox(height: 15),
                Text(
                    'Update ini wajib dilakukan untuk terus menggunakan aplikasi.',
                    style: TextStyle(
                        color: Colors.red,
                        fontSize: 12,
                        fontWeight: FontWeight.bold)),
              ]
            ],
          ),
          actions: [
            if (!forceUpdate)
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text('Nanti'),
              ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: () async {
                final Uri uri = Uri.parse(url);
                if (await canLaunchUrl(uri)) {
                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                }
              },
              child: Text('Update Sekarang'),
            ),
          ],
        ),
      ),
    );
  }
}
