import 'package:flutter/material.dart';
import '../models/pelanggan_model.dart';
import '../models/posm_model.dart';
import '../services/database_helper.dart';
import 'package:intl/intl.dart';

class POSMControlScreen extends StatefulWidget {
  final String featureId;
  final String title;
  final Pelanggan pelanggan;

  const POSMControlScreen({
    super.key,
    required this.featureId,
    required this.title,
    required this.pelanggan,
  });

  @override
  State<POSMControlScreen> createState() => _POSMControlScreenState();
}

class _POSMControlScreenState extends State<POSMControlScreen> {
  bool _isLoading = true;
  String? _idVisit;
  
  // Data dummy/awal berdasarkan gambar
  final List<Map<String, dynamic>> _posmItems = [
    {'sku': 'Uno Mild', 'subject': 'Sun Screen'},
    {'sku': 'Uno Mild', 'subject': 'Hanging Lighter'},
    {'sku': 'Uno Mild', 'subject': 'Product Display'},
  ];

  final Map<String, POSMAudit> _auditData = {};

  @override
  void initState() {
    super.initState();
    _initData();
  }

  Future<void> _initData() async {
    setState(() => _isLoading = true);
    
    // Ambil atau buat visit
    final visit = await DatabaseHelper.instance.getVisitByPelangganId(widget.pelanggan.id);
    if (visit != null) {
      _idVisit = visit['id_visit'];
      final existingData = await DatabaseHelper.instance.getPosmAuditByVisit(_idVisit!);
      for (var map in existingData) {
        final audit = POSMAudit.fromMap(map);
        _auditData["${audit.sku}_${audit.subject}"] = audit;
      }
    } else {
      // Jika belum ada visit, kita bisa buat di sini atau nanti saat simpan
      // Namun biasanya visit dibuat saat masuk ke layar ini di SFA
      _idVisit = "V_${widget.pelanggan.id}_${DateTime.now().millisecondsSinceEpoch}";
      // Note: Idealnya panggil insertVisitIfNotExists tapi butuh data sales dll.
      // Sesuai alur SFA, visit harusnya sudah ada saat sampai di sini dari PelangganListScreen.
    }

    // Inisialisasi data kosong jika belum ada
    for (var item in _posmItems) {
      final key = "${item['sku']}_${item['subject']}";
      if (!_auditData.containsKey(key)) {
        _auditData[key] = POSMAudit(
          idVisit: _idVisit ?? '',
          sku: item['sku'],
          subject: item['subject'],
          placement: 0,
          hilang: 0,
          masihAda: 0,
          rusak: 0,
          dirapikan: 0,
        );
      }
    }

    setState(() => _isLoading = false);
  }

  Future<void> _saveData() async {
    if (_idVisit == null) return;

    for (var audit in _auditData.values) {
      await DatabaseHelper.instance.upsertPosmAudit(
        idVisit: _idVisit!,
        sku: audit.sku,
        subject: audit.subject,
        placement: audit.placement,
        hilang: audit.hilang,
        masihAda: audit.masihAda,
        rusak: audit.rusak,
        dirapikan: audit.dirapikan,
      );
    }

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Data POSM berhasil disimpan secara lokal')),
      );
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        backgroundColor: const Color(0xFF6B4EE0),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.save),
            onPressed: _saveData,
          )
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildHeader(),
                  const SizedBox(height: 20),
                  const Text(
                    "Audit Penempatan POSM",
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 10),
                  ... _posmItems.map((item) => _buildAuditCard(item['sku'], item['subject'])).toList(),
                  const SizedBox(height: 80),
                ],
              ),
            ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(16),
        child: ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF6B4EE0),
            foregroundColor: Colors.white,
            minimumSize: const Size.fromHeight(50),
          ),
          onPressed: _saveData,
          child: const Text("SIMPAN DATA"),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade300),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.pelanggan.nama ?? 'Nama Pelanggan',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(widget.pelanggan.alamat ?? 'Alamat', style: TextStyle(color: Colors.grey.shade600)),
            const Divider(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text("Tipe:"),
                Text(widget.pelanggan.tipePelanggan ?? '-', style: const TextStyle(fontWeight: FontWeight.bold)),
              ],
            )
          ],
        ),
      ),
    );
  }

  Widget _buildAuditCard(String sku, String subject) {
    final key = "${sku}_$subject";
    final audit = _auditData[key]!;

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: const BoxDecoration(
              color: Color(0xFFF3F0FF),
              borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text("$sku - $subject", style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF6B4EE0))),
                Text(
                  "Pencapaian: ${(audit.targetVsAct * 100).toStringAsFixed(0)}%",
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(child: _buildInputField("Placement", audit.placement, (val) => _updateAudit(key, placement: val))),
                    const SizedBox(width: 12),
                    Expanded(child: _buildInputField("Hilang", audit.hilang, (val) => _updateAudit(key, hilang: val), isWarning: true)),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: _buildInputField("Masih Ada", audit.masihAda, (val) => _updateAudit(key, masihAda: val))),
                    const SizedBox(width: 12),
                    Expanded(child: _buildInputField("Rusak", audit.rusak, (val) => _updateAudit(key, rusak: val), isWarning: true)),
                  ],
                ),
                const SizedBox(height: 12),
                _buildInputField("Di Rapikan Kembali", audit.dirapikan, (val) => _updateAudit(key, dirapikan: val)),
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildInputField(String label, int value, Function(int) onChanged, {bool isWarning = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        TextField(
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: isWarning ? Colors.red : const Color(0xFF6B4EE0)),
            ),
          ),
          controller: TextEditingController(text: value.toString())..selection = TextSelection.fromPosition(TextPosition(offset: value.toString().length)),
          onChanged: (text) {
            final val = int.tryParse(text) ?? 0;
            onChanged(val);
          },
        ),
      ],
    );
  }

  void _updateAudit(String key, {int? placement, int? hilang, int? masihAda, int? rusak, int? dirapikan}) {
    final old = _auditData[key]!;
    setState(() {
      _auditData[key] = POSMAudit(
        idVisit: old.idVisit,
        sku: old.sku,
        subject: old.subject,
        placement: placement ?? old.placement,
        hilang: hilang ?? old.hilang,
        masihAda: masihAda ?? old.masihAda,
        rusak: rusak ?? old.rusak,
        dirapikan: dirapikan ?? old.dirapikan,
      );
    });
  }
}
