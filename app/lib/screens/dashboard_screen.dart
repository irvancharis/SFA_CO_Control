import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:intl/intl.dart';

import '../models/feature_model.dart';
import '../services/feature_service.dart';
import '../services/sync_service.dart';
import '../utils/api_config.dart';
import '../services/version_service.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'pelanggan_list_screen.dart';
import 'pelanggan_list_custom_screen.dart';

// ===================== Tokens (selaras layar lain) ======================
class _UX {
  static const primary = Color(0xFF6B4EE0);
  static const primaryDark = Color(0xFF5338B8);
  static const primarySurface = Color(0xFFF3F0FF);
  static const bg = Color(0xFFF8F9FE);
  static const textMain = Color(0xFF1A1C1E);
  static const textMuted = Color(0xFF6E7179);
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late Future<List<Feature>> _futureFeatures;
  bool _syncing = false;
  bool _exporting = false;
  String? username;
  String _version = '1.0.0';
  int _customerCount = 0;

  @override
  void initState() {
    super.initState();
    _refreshData();
    _loadUsername();
    _loadVersionInfo();

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await Future.delayed(const Duration(seconds: 2));
      if (mounted) {
        _doSync();
        VersionService.checkUpdate(context);
      }
    });
  }

  Future<void> _refreshData() async {
    setState(() {
      _futureFeatures = _loadFeaturesFiltered();
    });
    final count = await _loadCustomerCount();
    if (mounted) {
      setState(() {
        _customerCount = count;
      });
    }
  }

  Future<int> _loadCustomerCount() async {
    final dbPath = p.join(await getDatabasesPath(), 'appdb.db');
    Database? db;
    try {
      db = await openDatabase(dbPath);
      final existRows = await db.rawQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        ['pelanggan'],
      );
      if (existRows.isEmpty) return 0;
      final rows = await db.rawQuery('SELECT COUNT(*) as total FROM pelanggan');
      return Sqflite.firstIntValue(rows) ?? 0;
    } catch (e) {
      return 0;
    } finally {
      await db?.close();
    }
  }

  Future<void> _loadVersionInfo() async {
    final info = await PackageInfo.fromPlatform();
    if (mounted) {
      setState(() {
        _version = '${info.version}+${info.buildNumber}';
      });
    }
  }

  Future<void> _loadUsername() async {
    final prefs = await SharedPreferences.getInstance();
    final storedName = prefs.getString('user_name') ?? 'Pengguna';
    setState(() {
      username = storedName;
    });
  }

  Future<List<Feature>> _loadFeaturesFiltered() async {
    try {
      final all = await FeatureService().fetchFeatures();
      final activeFeatureIds = await _getActiveFeatureIdsFromDb();

      if (activeFeatureIds.isEmpty) {
        return all;
      }

      final filtered =
          all.where((f) => activeFeatureIds.contains(f.id)).toList();
      return filtered.isEmpty ? all : filtered;
    } catch (e) {
      debugPrint('Gagal memfilter fitur: $e');
      return FeatureService().fetchFeatures();
    }
  }

  Future<Set<String>> _getActiveFeatureIdsFromDb() async {
    final dbPath = p.join(await getDatabasesPath(), 'appdb.db');
    Database? db;
    try {
      db = await openDatabase(dbPath);
      final existRows = await db.rawQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        ['pelanggan'],
      );
      if (existRows.isEmpty) return <String>{};

      final rows = await db
          .rawQuery('SELECT DISTINCT fitur AS feature_id FROM pelanggan');
      return rows
          .map((r) => (r['feature_id'] ?? '').toString())
          .where((s) => s.isNotEmpty)
          .toSet();
    } catch (e) {
      debugPrint('getActiveFeatureIds error: $e');
      return <String>{};
    } finally {
      await db?.close();
    }
  }

  Future<void> _doSync() async {
    setState(() => _syncing = true);
    try {
      await SyncService.syncAll();
      if (!mounted) return;
      _refreshData();
      _showModernSnackBar(
        context,
        'Sinkronisasi Berhasil',
        'Data master telah diperbarui dari server.',
        _UX.primary,
        Icons.sync,
      );
    } catch (e) {
      debugPrint('Auto sync error: $e');
    } finally {
      if (mounted) setState(() => _syncing = false);
    }
  }

  Future<void> _exportDatabase() async {
    setState(() => _exporting = true);
    try {
      final dbPath = p.join(await getDatabasesPath(), 'appdb.db');
      final dbFile = File(dbPath);

      if (!(await dbFile.exists())) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Database tidak ditemukan')),
        );
        return;
      }

      final prefs = await SharedPreferences.getInstance();
      final kodeUser = prefs.getString('user_id') ?? '';
      final tanggalStr = DateFormat('ddMMyyyy_HHmmss').format(DateTime.now());
      final fileName = 'DB_${kodeUser}_$tanggalStr.db';

      final fileBytes = await dbFile.readAsBytes();

      final url = Uri.parse(ApiConfig.getUrl('/upload-db'));
      final request = http.MultipartRequest('POST', url)
        ..files.add(http.MultipartFile.fromBytes('file', fileBytes,
            filename: fileName));

      final response = await request.send();

      if (!mounted) return;

      if (response.statusCode == 200) {
        _showModernSnackBar(
          context,
          'Backup Berhasil!',
          'Database berhasil di-upload ke server.',
          Colors.green,
          Icons.cloud_done_outlined,
        );
      } else {
        _showModernSnackBar(
          context,
          'Backup Gagal',
          'Status: ${response.statusCode}',
          Colors.redAccent,
          Icons.error_outline,
        );
      }
    } catch (e) {
      if (!mounted) return;
      _showModernSnackBar(
        context,
        'Error Backup',
        '$e',
        Colors.redAccent,
        Icons.error_outline,
      );
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  void _showModernSnackBar(BuildContext context, String title, String msg,
      Color color, IconData icon) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        elevation: 0,
        behavior: SnackBarBehavior.floating,
        backgroundColor: Colors.transparent,
        content: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.95),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.2),
                blurRadius: 10,
                offset: const Offset(0, 4),
              )
            ],
          ),
          child: Row(
            children: [
              Icon(icon, color: Colors.white, size: 28),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                            color: Colors.white)),
                    Text(msg,
                        style: const TextStyle(
                            fontSize: 12, color: Colors.white70)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _logout() async {
    final shouldLogout = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Logout'),
        content: const Text('Apakah Anda yakin ingin keluar?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Batal', style: TextStyle(color: _UX.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              elevation: 0,
            ),
            onPressed: () => Navigator.pop(context, true),
            child:
                const Text('Ya, Keluar', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (shouldLogout == true) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('isLoggedIn', false);
      if (!mounted) return;
      Navigator.of(context).pushNamedAndRemoveUntil('/login', (route) => false);
    }
  }

  IconData _iconFromName(String? iconName) {
    switch (iconName) {
      case 'dashboard':
        return Icons.dashboard_rounded;
      case 'visit':
        return Icons.location_on_rounded;
      case 'call':
        return Icons.phone_android_rounded;
      case 'report':
        return Icons.pie_chart_rounded;
      default:
        return Icons.grid_view_rounded;
    }
  }

  Future<void> _refresh() async {
    await _refreshData();
  }

  @override
  Widget build(BuildContext context) {
    final dateStr =
        DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(DateTime.now());

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final shouldExit = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: const Text('Keluar Aplikasi'),
            content: const Text('Yakin ingin keluar dari aplikasi?'),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Kembali',
                    style: TextStyle(color: _UX.textMuted)),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: _UX.primary,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Ya', style: TextStyle(color: Colors.white)),
              ),
            ],
          ),
        );
        if (shouldExit == true) exit(0);
      },
      child: Scaffold(
        backgroundColor: _UX.bg,
        body: Stack(
          children: [
            // Header Gradient
            Container(
              height: 220,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [_UX.primary, _UX.primaryDark],
                ),
                borderRadius: BorderRadius.only(
                  bottomLeft: Radius.circular(40),
                  bottomRight: Radius.circular(40),
                ),
              ),
            ),

            SafeArea(
              child: RefreshIndicator(
                onRefresh: _refresh,
                color: _UX.primary,
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    // Top Bar
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
                      sliver: SliverToBoxAdapter(
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Selamat Datang,',
                                    style: TextStyle(
                                      color:
                                          Colors.white.withValues(alpha: 0.8),
                                      fontSize: 14,
                                    ),
                                  ),
                                  Text(
                                    '${username ?? 'User'} 👋',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 22,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    // Quick Actions & Date Card Container
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(20, 25, 20, 10),
                        child: Column(
                          children: [
                            // Combined Info & Action Card
                            Container(
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(28),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.06),
                                    blurRadius: 20,
                                    offset: const Offset(0, 8),
                                  ),
                                ],
                              ),
                              child: Column(
                                children: [
                                  // Date & Summary Row
                                  Padding(
                                    padding: const EdgeInsets.all(20),
                                    child: Row(
                                      children: [
                                        _InfoTile(
                                          icon: Icons.calendar_today_outlined,
                                          label: 'Hari Ini',
                                          value: dateStr,
                                        ),
                                        const SizedBox(width: 12),
                                        Container(
                                          width: 1,
                                          height: 40,
                                          color: Colors.grey
                                              .withValues(alpha: 0.2),
                                        ),
                                        const SizedBox(width: 12),
                                        _InfoTile(
                                          icon: Icons.people_outline_rounded,
                                          label: 'Pelanggan',
                                          value: '$_customerCount',
                                        ),
                                      ],
                                    ),
                                  ),
                                  const Divider(height: 1, thickness: 0.5),
                                  // Action Buttons Row (SYNC & BACKUP SEJAJAR)
                                  Padding(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 12, vertical: 12),
                                    child: Row(
                                      children: [
                                        Expanded(
                                          child: _QuickActionButton(
                                            label: 'Sinkronisasi',
                                            icon: Icons.sync_rounded,
                                            isLoading: _syncing,
                                            onPressed: _doSync,
                                            color: _UX.primary,
                                          ),
                                        ),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: _QuickActionButton(
                                            label: 'Backup Data',
                                            icon: Icons.cloud_upload_outlined,
                                            isLoading: _exporting,
                                            onPressed: _exportDatabase,
                                            color: Colors.teal.shade600,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.fromLTRB(24, 25, 24, 15),
                        child: Row(
                          children: [
                            Text(
                              'Menu Utama',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: _UX.textMain,
                                letterSpacing: 0.5,
                              ),
                            ),
                            Spacer(),
                            Icon(Icons.arrow_forward_ios_rounded,
                                size: 14, color: _UX.textMuted),
                          ],
                        ),
                      ),
                    ),

                    // Features Grid
                    FutureBuilder<List<Feature>>(
                      future: _futureFeatures,
                      builder: (context, snapshot) {
                        if (snapshot.connectionState ==
                            ConnectionState.waiting) {
                          return const SliverToBoxAdapter(
                            child: Padding(
                              padding: EdgeInsets.all(50),
                              child: Center(child: CircularProgressIndicator()),
                            ),
                          );
                        }
                        final features = snapshot.data ?? [];
                        if (features.isEmpty) {
                          return const SliverToBoxAdapter(
                            child: Padding(
                              padding: EdgeInsets.all(50),
                              child: Center(
                                child: Text('Tidak ada menu aktif',
                                    style: TextStyle(color: _UX.textMuted)),
                              ),
                            ),
                          );
                        }

                        return SliverPadding(
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          sliver: SliverGrid(
                            gridDelegate:
                                const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 2,
                              crossAxisSpacing: 16,
                              mainAxisSpacing: 16,
                              childAspectRatio: 1.15,
                            ),
                            delegate: SliverChildBuilderDelegate(
                              (context, index) {
                                final f = features[index];
                                return _FeatureCard(
                                  title: f.nama,
                                  icon: _iconFromName(f.icon),
                                  onTap: () {
                                    final type = (f.type).toLowerCase();
                                    final screen = type == 'custom'
                                        ? PelangganListCustomScreen(
                                            featureId: f.id,
                                            title: f.nama,
                                            featureType: f.type,
                                          )
                                        : PelangganListScreen(
                                            featureId: f.id,
                                            title: f.nama,
                                            featureType: f.type,
                                          );
                                    Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                            builder: (_) => screen));
                                  },
                                );
                              },
                              childCount: features.length,
                            ),
                          ),
                        );
                      },
                    ),

                    const SliverToBoxAdapter(child: SizedBox(height: 120)),
                  ],
                ),
              ),
            ),
          ],
        ),
        bottomNavigationBar: Container(
          padding: const EdgeInsets.fromLTRB(20, 15, 20, 30),
          decoration: BoxDecoration(
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 10,
                offset: const Offset(0, -5),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: _UX.bg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  'Control Sales App • Version $_version',
                  style: const TextStyle(
                    color: _UX.textMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoTile(
      {required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: _UX.primarySurface,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: _UX.primary, size: 20),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: const TextStyle(
                        color: _UX.textMuted,
                        fontSize: 10,
                        fontWeight: FontWeight.bold)),
                Text(value,
                    style: const TextStyle(
                        color: _UX.textMain,
                        fontSize: 13,
                        fontWeight: FontWeight.w800),
                    overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickActionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isLoading;
  final VoidCallback onPressed;
  final Color color;

  const _QuickActionButton({
    required this.label,
    required this.icon,
    required this.isLoading,
    required this.onPressed,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: isLoading ? null : onPressed,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (isLoading)
                SizedBox(
                    width: 18,
                    height: 18,
                    child:
                        CircularProgressIndicator(strokeWidth: 2, color: color))
              else
                Icon(icon, size: 20, color: color),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                    color: color, fontWeight: FontWeight.w700, fontSize: 13),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CircularActionButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onPressed;
  final String tooltip;
  final double size;

  const _CircularActionButton({
    required this.icon,
    required this.onPressed,
    required this.tooltip,
    this.size = 40,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.2),
        shape: BoxShape.circle,
      ),
      child: Tooltip(
        message: tooltip,
        child: InkWell(
          onTap: onPressed,
          customBorder: const CircleBorder(),
          child: Center(
            child: Icon(icon, color: Colors.white, size: size * 0.5),
          ),
        ),
      ),
    );
  }
}

class _FeatureCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final VoidCallback onTap;

  const _FeatureCard(
      {required this.title, required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white, width: 2), // Ring effect
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(24),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: _UX.primarySurface,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Icon(icon, color: _UX.primary, size: 30),
                ),
                const SizedBox(height: 14),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      color: _UX.textMain,
                      fontWeight: FontWeight.w800,
                      fontSize: 13),
                ),
                const SizedBox(height: 4),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
