import 'feature_subdetail_model.dart';

class FeatureDetail {
  final String id; // ID_FEATUREDETAIL (UUID)
  final String idFeature; // ID_FEATURE
  final String nama; // NAME
  final String icon; // ICON (nullable)
  final int seq; // SEQ
  final int isRequired; // IS_REQUIRED
  final int isActive; // IS_ACTIVE
  final String? keterangan; // KETERANGAN (nullable)
  final String? type; // TYPE (nullable)
  final List<FeatureSubDetail> subDetails; // opsional

  FeatureDetail({
    required this.id,
    required this.idFeature,
    required this.nama,
    required this.icon,
    required this.seq,
    required this.isRequired,
    required this.isActive,
    required this.keterangan,
    required this.type,
    this.subDetails = const [],
  });

  /// ✅ Parsing dari JSON (server)
  factory FeatureDetail.fromJson(Map<String, dynamic> json) {
    return FeatureDetail(
      id: json['ID_FEATUREDETAIL']?.toString() ?? '',
      idFeature: json['ID_FEATURE']?.toString() ?? '',
      nama: json['NAME'] ?? '',
      icon: json['ICON'],
      seq: json['SEQ'] is int
          ? json['SEQ']
          : int.tryParse(json['SEQ']?.toString() ?? '') ?? 0,
      isRequired: json['IS_REQUIRED'] is int
          ? json['IS_REQUIRED']
          : int.tryParse(json['IS_REQUIRED']?.toString() ?? '') ?? 0,
      isActive: json['IS_ACTIVE'] is int
          ? json['IS_ACTIVE']
          : int.tryParse(json['IS_ACTIVE']?.toString() ?? '') ?? 0,
      keterangan: json['KETERANGAN'],
      type: json['TYPE'],
      subDetails: [], // akan diisi terpisah jika ada
    );
  }

  /// ✅ Parsing dari database
  factory FeatureDetail.fromMap(Map<String, dynamic> map,
      [List<FeatureSubDetail>? subs]) {
    return FeatureDetail(
      id: map['id']?.toString() ?? '',
      idFeature: map['idFeature']?.toString() ?? '',
      nama: map['nama'] ?? '',
      icon: map['icon'],
      seq: map['seq'] is int
          ? map['seq']
          : int.tryParse(map['seq'].toString()) ?? 0,
      isRequired: map['isRequired'] is int
          ? map['isRequired']
          : int.tryParse(map['isRequired'].toString()) ?? 0,
      isActive: map['isActive'] is int
          ? map['isActive']
          : int.tryParse(map['isActive'].toString()) ?? 0,
      keterangan: map['keterangan'],
      type: map['type'],
      subDetails: subs ?? [],
    );
  }

  /// ✅ Untuk insert ke database SQLite
  Map<String, dynamic> toMap() => {
        'id': id,
        'idFeature': idFeature,
        'nama': nama,
        'icon': icon,
        'seq': seq,
        'isRequired': isRequired,
        'isActive': isActive,
        'keterangan': keterangan,
        'type': type,
      };

  /// ✅ Untuk encode ke JSON (jika perlu kirim balik)
  Map<String, dynamic> toJson() => {
        'ID_FEATUREDETAIL': id,
        'ID_FEATURE': idFeature,
        'NAME': nama,
        'ICON': icon,
        'SEQ': seq,
        'IS_REQUIRED': isRequired,
        'IS_ACTIVE': isActive,
        'KETERANGAN': keterangan,
        'TYPE': type,
        'SUBDETAIL': subDetails.map((e) => e.toJson()).toList(),
      };
}
