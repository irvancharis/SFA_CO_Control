class POSMAudit {
  final String idVisit;
  final String sku;
  final String subject;
  final int placement;
  final int hilang;
  final int masihAda;
  final int rusak;
  final int dirapikan;

  POSMAudit({
    required this.idVisit,
    required this.sku,
    required this.subject,
    required this.placement,
    required this.hilang,
    required this.masihAda,
    required this.rusak,
    required this.dirapikan,
  });

  factory POSMAudit.fromMap(Map<String, dynamic> map) {
    return POSMAudit(
      idVisit: map['id_visit'] ?? '',
      sku: map['sku'] ?? '',
      subject: map['subject'] ?? '',
      placement: map['placement'] ?? 0,
      hilang: map['hilang'] ?? 0,
      masihAda: map['masih_ada'] ?? 0,
      rusak: map['rusak'] ?? 0,
      dirapikan: map['dirapikan'] ?? 0,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id_visit': idVisit,
      'sku': sku,
      'subject': subject,
      'placement': placement,
      'hilang': hilang,
      'masih_ada': masihAda,
      'rusak': rusak,
      'dirapikan': dirapikan,
    };
  }

  double get targetVsAct {
    if (placement == 0) return 0;
    // Calculation from image: Tgt vs act seems to be (Masih ada / Placement) or similar?
    // Looking at Monday SRM 101 Sun Screen: Placement 8, Masih ada 2, Lepas 6. Tgt vs act 100%?
    // Wait, Monday SRM 101 Sun Screen: Masih ada 2 + Rapikan 6 = 8. So 8/8 = 100%.
    // So it might be (masih_ada + dirapikan) / placement.
    return (masihAda + dirapikan) / placement;
  }
}
