import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:flutter/material.dart';
import 'package:ota_update/ota_update.dart';
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
          if (context.mounted) {
            _showUpdateDialog(
              context,
              latestVersion,
              releaseNotes,
              downloadUrl,
              isForceUpdate,
            );
          }
        }
      }
    } catch (e) {
      debugPrint('Error checking update: $e');
    }
  }

  static void _showUpdateDialog(
    BuildContext context,
    String version,
    String notes,
    String url,
    bool forceUpdate,
  ) {
    String downloadProgress = "0";
    bool isDownloading = false;
    String statusMessage = "";

    showDialog(
      context: context,
      barrierDismissible: !forceUpdate,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => PopScope(
          canPop: !forceUpdate && !isDownloading,
          child: AlertDialog(
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: Row(
              children: [
                const Icon(Icons.system_update, color: Colors.blue),
                const SizedBox(width: 10),
                const Text('Update Tersedia'),
              ],
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Versi terbaru ($version) sudah tersedia.',
                    style: const TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 10),
                const Text('Apa yang baru:'),
                Text(notes,
                    style: TextStyle(color: Colors.grey[700], fontSize: 13)),
                if (isDownloading) ...[
                  const SizedBox(height: 20),
                  LinearProgressIndicator(
                    value: double.tryParse(downloadProgress)! / 100,
                    backgroundColor: Colors.grey[200],
                    valueColor:
                        const AlwaysStoppedAnimation<Color>(Colors.blue),
                  ),
                  const SizedBox(height: 10),
                  Center(
                    child: Text(
                      statusMessage.isEmpty
                          ? "Mendownload: $downloadProgress%"
                          : statusMessage,
                      style: const TextStyle(fontSize: 12, color: Colors.blue),
                    ),
                  ),
                ],
                if (forceUpdate && !isDownloading) ...[
                  const SizedBox(height: 15),
                  const Text(
                      'Update ini wajib dilakukan untuk terus menggunakan aplikasi.',
                      style: TextStyle(
                          color: Colors.red,
                          fontSize: 12,
                          fontWeight: FontWeight.bold)),
                ]
              ],
            ),
            actions: [
              if (!forceUpdate && !isDownloading)
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Nanti'),
                ),
              if (!isDownloading)
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: () {
                    setState(() {
                      isDownloading = true;
                      statusMessage = "Memulai download...";
                    });

                    _doUpdate(url, (progress, status, msg) {
                      if (context.mounted) {
                        setState(() {
                          downloadProgress = progress;
                          if (msg != null) statusMessage = msg;
                          if (status == OtaStatus.INSTALLING) {
                            isDownloading = false;
                            Navigator.pop(context);
                          }
                        });
                      }
                    });
                  },
                  child: const Text('Update Sekarang'),
                ),
            ],
          ),
        ),
      ),
    );
  }

  static void _doUpdate(String url,
      Function(String progress, OtaStatus status, String? msg) onProgress) {
    try {
      OtaUpdate().execute(url, destinationFilename: 'update.apk').listen(
        (OtaEvent event) {
          debugPrint('OTA Status: ${event.status}, Value: ${event.value}');

          switch (event.status) {
            case OtaStatus.DOWNLOADING:
              onProgress(event.value ?? "0", event.status, null);
              break;
            case OtaStatus.INSTALLING:
              onProgress("100", event.status, "Menginstall...");
              break;
            case OtaStatus.ALREADY_RUNNING_ERROR:
              onProgress("0", event.status, "Proses sudah berjalan.");
              break;
            case OtaStatus.PERMISSION_NOT_GRANTED_ERROR:
              onProgress("0", event.status, "Izin instalasi ditolak.");
              break;
            case OtaStatus.INTERNAL_ERROR:
              onProgress("0", event.status, "Error internal sistem.");
              break;
            case OtaStatus.DOWNLOAD_ERROR:
              onProgress("0", event.status, "Gagal mendownload file.");
              break;
            case OtaStatus.CHECKSUM_ERROR:
              onProgress("0", event.status, "File korup (Checksum error).");
              break;
            default:
              onProgress(
                  event.value ?? "0", event.status, "Status: ${event.status}");
              break;
          }
        },
        onError: (e) {
          debugPrint('OTA Error: $e');
          onProgress("0", OtaStatus.INTERNAL_ERROR, "Koneksi terputus.");
        },
      );
    } catch (e) {
      debugPrint('Exception OTA: $e');
      onProgress("0", OtaStatus.INTERNAL_ERROR, "Gagal memulai update.");
    }
  }
}
