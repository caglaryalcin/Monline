// The rest of the interface falls back to English for languages without these keys.
export const statementTranslations = {
  tr: {
    statement_duplicates_title: "Benzer harcamalar bulundu!",
    statement_duplicates_short_help: "Yükleyeceğin işlemleri mevcut kayıtlarla karşılaştır. Hiçbir kayıt otomatik çıkarılmaz.",
    statement_duplicates_review_count: "Kontrol et: {{count}} eşleşme",
    statement_duplicates_transaction: "{{number}}. işlem",
    statement_duplicates_record_count: "{{count}} ayrı kayıt karşılaştırılıyor",
    statement_duplicates_review_heading: "Aynı ödeme tekrar kaydediliyor olabilir.",
    statement_duplicates_legitimate_help: "Eğer bu harcama aynı gün gerçekten {{count}} kez yapıldıysa",
    statement_duplicates_legitimate_action: "kontrol etmene gerek yok, kaydet!",
    statement_duplicates_installment_count: "{{count}} işlem farklı taksit olabilir",
    statement_duplicates_installment_help: "Bunlar farklı aylara ait taksitler. Ek bir işlem yapman gerekmiyor; seçili kayıtlar normal şekilde kaydedilecek.",
    statement_duplicates_compared_records: "Benzer kayıt",
    statement_duplicates_amount: "Tutar",
    statement_duplicates_same_amount: "Tutar aynı",
    statement_duplicates_other_installment: "Taksit sırası farklı",
    statement_duplicates_pdf_page: "PDF · sayfa {{page}}",
    statement_duplicates_view_statement: "Ekstreyi aç",
    statement_duplicates_rules: "Benzerlik neye göre bulunuyor?",
    statement_duplicates_help:
      "Aynı gün, aynı firma ve para birimindeki kayıtlar karşılaştırılır. Yakın tutar sınırı TL için 5 TL, diğer para birimleri için 0,01 birimdir. Hiçbir kayıt otomatik silinmez veya birleştirilmez. Farklı taksitler ayrı ödemeler olabilir. Geri dönerek istemediğin satırların seçimini kaldırabilirsin.",
    statement_duplicates_possible_duplicate: "Olası mükerrer kayıt — kontrol et",
    statement_duplicates_installment_continuation: "Aynı alışverişin farklı taksiti olabilir",
    statement_duplicates_new: "Yüklenecek kayıt",
    statement_duplicates_source_statement: "Kayıtlı PDF ekstresi",
    statement_duplicates_source_ledger: "Gelir/Gider",
    statement_duplicates_source_manual_card: "Elle girilen kart harcaması",
    statement_duplicates_source_manual_bill: "Elle girilen fatura",
    statement_duplicates_source_incoming: "Bu PDF içindeki diğer satır",
    statement_duplicates_difference: "Tutar farkı",
    statement_duplicates_back: "Geri dön ve kontrol et",
    statement_duplicates_continue: "Seçili kayıtları kaydet",
    statement_duplicates_more:
      "İlk 200 benzerlik gösteriliyor. Diğerlerini görmek için seçimlerini düzenleyip yeniden kontrol et.",
    statement_duplicate_check_failed:
      "Benzer harcamalar kontrol edilemedi. Kayıt yapılmadı; tekrar dene.",
    statement_open_page: "Ekstre sayfasını aç",
    statement_attention_title: "Kontrol gerektiren işlemler ({{count}})",
    statement_attention_help:
      "Bu satırlarda tutar veya metin belirsiz. PDF’deki sayfayı kontrol edip işlem tablosunda düzelt. Belirsiz tutarlar toplamda ve kayıtta kullanılmaz.",
    statement_text_issue:
      "Açıklamadaki bazı karakterler çözülemedi. İş yeri adını PDF ile karşılaştır.",
    statement_review_confirm_incomplete:
      "{{count}} okuma uyarısını ve kaynak satırlarını PDF ile kontrol ettim. Eksik işlemleri düzelttim veya dışarıda bıraktım; yalnızca seçili işlemlerin kaydedilmesini onaylıyorum.",
    statement_amount_issue_joined_installment:
      "Taksit numarası tutarla birleşmiş olabilir. PDF’deki tutarı ve taksiti kontrol edip tutarı elle gir. Satır bu haliyle seçilemez.",
    statement_amount_issue_invalid_amount:
      "Tutar eksiksiz ve güvenilir biçimde okunamadı. PDF’deki tutarı elle gir.",
    statement_amount_issue_multiple_amounts:
      "Birden fazla tutar sütunu var; hangi tutarın harcama olduğu belirsiz. PDF’deki harcama tutarını elle gir.",
    statement_amount_issue_installment_total:
      "Taksit tutarı toplam alışveriş tutarını aşıyor. PDF’deki tutarı ve taksiti kontrol et.",
    statement_totals_mismatch: "PDF özeti ile okunan işlem toplamları uyuşmuyor.",
    statement_reconciliation_report_issue: "GitHub’da hata bildir",
    statement_totals_unverified: "PDF toplamları doğrulanamadı.",
    statement_verification_check_summary_balance: "PDF özetinin kendi hesabı",
    statement_verification_check_balance: "Ekstre borcu",
    statement_verification_check_movement: "Dönemin net hareketi",
    statement_verification_from_summary: "PDF özetinden hesaplanan",
    statement_verification_issue_no_source_rows: "Karşılaştırılabilecek işlem satırı bulunamadı.",
    statement_verification_issue_invalid_source_rows: "Bazı işlem tutarları PDF kaynak satırıyla doğrulanamadı.",
    statement_verification_issue_conflicting_source_rows: "Aynı PDF satırına ait birbiriyle çelişen kayıtlar var.",
    statement_verification_issue_unsupported_currency: "TL dışındaki işlemler için toplam doğrulaması yapılamadı.",
    statement_verification_issue_invalid_summary: "PDF özetindeki bazı tutarlar geçerli değil.",
    statement_verification_issue_unread_source_rows: "PDF’nin bazı işlem satırları veya sayfaları okunamadı.",
    statement_verification_issue_incomplete_summary: "Karşılaştırma için PDF’de yeterli özet bilgisi bulunamadı.",
    statement_verification_override: "Doğrulamadan kaydetme seçeneği",
    statement_verification_confirm: "Otomatik toplam doğrulaması yapılamadığını biliyorum; kontrol ettiğim seçili işlemleri kaydetmeyi onaylıyorum.",
    statement_refunds_matched_short: "{{count}} iade harcamayla eşleşti",
    statement_refund_exact_match: "Harcamayla eşleşti: {{date}} · {{amount}}",
    statement_excluded_help:
      "Seçmediğin {{count}} işlem harcama listesine eklenmez. PDF toplamı kontrolünde kaynak olarak saklanır; ekstre borcu değişmez.",
    statement_reconciliation_values:
      "Ekstre: {{expected}} · Hesaplanan: {{actual}} · Fark: {{difference}}",
    statement_reconciliation_pdf: "PDF’deki toplam",
    statement_reconciliation_calculated: "Satırların toplamı",
    statement_reconciliation_source_rows: "Hesaba katılan {{count}} satır",
    statement_reconciliation_cancelled: "Tam iadeyle kapanan {{amount}} tekrar eklenmedi.",
    statement_reconciliation_override: "Farka rağmen kaydetme seçeneği",
    statement_reconciliation_confirm:
      "Bu farkı PDF ile kontrol ettim; yalnızca seçili işlemleri bu haliyle kaydetmeyi onaylıyorum.",
    statement_installment_invalid:
      "Geçerli bir taksit yaz (ör. 2/4). Taksit sırası toplam taksit sayısından büyük olamaz.",
    statement_unmatched_refunds_title: "Eşleşmeyen iadeler ({{count}})",
    statement_refunds_title: "İadeler ({{count}})",
    statement_matched_refunds_title: "Eşleşen iadeler ({{count}})",
    statement_refund_net: "Net {{amount}}",
    statement_refund_returned_info: "Harcama iade edildi.",
    statement_refund_installment_info: "Taksit iadesi eşleşti.",
    statement_refund_difference_info: "İade eşleşti; tutar farkı korunur.",
    statement_refund_proximity_info: "Sonraki tarih ve yakın TL tutarıyla eşleşti; fark korunur.",
    statement_refund_merchant_info: "Bu ekstrede aynı mağazaya ait harcama ve iadelerin toplamı.",
    statement_refund_charge_total: "Harcamalar",
    statement_refund_refund_total: "İadeler",
    statement_refund_remaining: "Kalan harcama",
    statement_refund_group_rows: "İşlemler ({{count}})",
    statement_refund_original_amount: "Özgün döviz tutarı: {{amount}}",
    statement_refund_installment_match: "Taksitle eşleşti: {{date}} · {{installment}} · {{amount}}",
    statement_refund_currency_match: "Döviz tutarıyla eşleşti: {{original}} · {{date}} · {{amount}}",
    statement_refund_rounding_net: "Harcama − iade: {{amount}}. Tutar farkı toplamda korunur.",
    statement_unmatched_refunds_help:
      "Bu iadeler ana işlem tablosundan ayrı tutulur. Seçili olanlar net toplamdan düşülür ve ekstreyle kaydedilir. Kısmi iadeler bir harcamayı otomatik olarak kaldırmaz.",
    statement_category_digital: "Dijital / Abonelik",
    statement_category_online: "Online Alışveriş",
    statement_category_bills: "Fatura / Hizmet",
    statement_category_shopping: "Giyim / Alışveriş",
    statement_category_health: "Sağlık",
    statement_category_groceries: "Market / Gıda",
    statement_category_dining: "Yemek / Restoran",
    statement_category_coffee: "Kahve",
    statement_category_travel: "Seyahat",
    statement_category_transport: "Ulaşım",
    statement_category_toys: "Oyuncak",
    statement_category_foreign: "Yurtdışı Harcamalar",
    statement_category_other: "Diğer",
    statement_category_fees: "Faiz / Vergi",
    statement_category_summary: "Kategori özeti",
    statement_category_chart: "Kategori dağılımı · {{currency}}",
    statement_category_details: "{{category}} harcamaları",
    statement_category_select: "Harcamaları görmek için pasta dilimine veya kategori adına tıkla.",
    statement_category_net_total: "Net toplam",
    statement_category_no_positive: "Pozitif net harcama yok.",
    statement_category_refund: "Net iade",
    statement_category_positive_only:
      "Pasta pozitif net kategorileri gösterir. İadeler, listede ve net toplamda korunur.",
    statement_category: "Kategori",
    statement_category_filter: "Gösterilen kategori",
    statement_all_categories: "Tüm kategoriler",
    statement_account_summary: "Ekstre özeti",
    statement_account_summary_help:
      "Ekstrede bulunan özet değerleri otomatik alınır ve değiştirilemez. Okunamayan değerler gösterilmez. Tutarlar TL cinsindedir.",
    statement_summary_previous_balance: "Önceki ekstre borcu",
    statement_summary_payments: "Yapılan ödemeler",
    statement_summary_payments_with_refunds: "Ödemeler ve iadeler",
    statement_payments_refund_breakdown: "Kart ödemesi {{payments}} + iade {{refunds}}",
    statement_summary_purchases: "Harcamalar ve geçmiş aydan taksitler",
    statement_summary_cash: "Nakit avans",
    statement_summary_fees: "Faiz, vergi ve ücretler",
    statement_summary_balance: "Ekstre borcu",
    statement_summary_minimum_payment: "Minimum ödeme",
    statement_summary_mismatch:
      "Ekstre özetindeki borç hesabı uyuşmuyor. PDF üzerindeki tutarları kontrol et.",
    statement_digital_help:
      "Bu bölümdeki her harcama düzenli abonelik olmayabilir. Tanınan abonelikleri mevcut kayıtlarınla eşleştir; tek seferlik ve belirsiz işlemleri aktarımda ayrıca kontrol et.",
    statement_financing_interest: "Alışveriş faizi",
    statement_financing_kkdf: "Faizlerin KKDF’si",
    statement_financing_bsmv: "Faiz ve ücretlerin BSMV’si",
    statement_financing_unitemized: "Özetten alınan faiz / masraf",
    statement_derived_fee_help:
      "PDF’nin üst özetindeki faiz, vergi ve masraf toplamının ayrı işlem satırlarında yer almayan kısmıdır. Borç hesabına dahil edilir; ayrı bir ödeme kaydı oluşturmaz.",
    statement_summary_fees_applied:
      "PDF’nin üst özetinden alınan {{amount}} faiz / masraf borç hesabına dahil edildi. İşlem satırlarında bulunan masraflar tekrar eklenmedi.",
    statement_delete_all: "Tüm ekstreleri sil",
    statement_delete_all_note:
      "Tüm sayfalardaki ekstre arşivinin tamamı kalıcı olarak silinecek. Abonelikler ve takvime aktarılmış ödemeler korunacak. Emin misiniz?",
    statement_import_add_category: "Kategori ekle",
    statement_import_category_name: "Kategori adı",
    statement_import_prepare_note:
      "Aboneliklere ve takvime aktarmadan önce <categories>kategorilerinizi</categories> ve <paymentMethods>ödeme yöntemlerinizi</paymentMethods> düzenlemenizi tavsiye ederiz.",
    statement_import_title: "Online abonelikleri aktar",
    statement_import_description:
      "Bu adımda online abonelikleri mevcut aboneliklerinle eşleştirebilir veya yeni abonelik olarak ekleyebilirsin.",
    statement_import_target: "Bu ödemelerin aboneliği",
    statement_import_no_similar:
      "Aynı para biriminde benzer bir kayıtlı abonelik bulunamadı. Yeni abonelik oluşturabilirsin.",
    statement_import_split: "İşlemleri ayrı ayrı eşleştir",
    statement_import_combine: "Tutarları birleştir",
    statement_import_uncombine: "Birleştirmeyi kaldır",
    statement_import_combine_hint:
      "Aynı gün seçili {{count}} işlem var. Aynı aboneliğe aitse tek ödeme olarak toplayabilirsin.",
    statement_import_combine_enabled:
      "Seçili {{count}} işlem, takvime {{total}} tutarında tek ödeme olarak aktarılacak. Aynı ekstrede daha önce aktarılan tutarlar tekrar eklenmez.",
    statement_import_new: "Yeni abonelik oluştur",
    statement_import_cycle: "Ödeme dönemi",
    statement_import_active: "Aktif abonelik oluştur",
    statement_import_next: "Sonraki ödeme tarihi",
    statement_import_next_month:
      "Ay ve yıl, aktarım yaptığın tarihin bir sonraki ayından alınır. Gün, seçili en son harcamadan korunur; o gün yoksa ayın son günü kullanılır.",
    statement_import_schedule_note:
      "Ekstre kaydedildi. Harcamalar Takvim’de gösteriliyor.",
    statement_import_existing_note:
      "Mevcut aboneliğinin fiyatı ve aktif/pasif durumu korunur. Seçtiğin kategori ve ödeme yöntemi aboneliğe kaydedilir. Seçilen geçmiş ödemeler eklenir; sonraki ödeme tarihi mevcut ayın bir sonraki ayına güncellenir.",
    statement_import_date_range: "Ödeme tarihi geçerli olmalı ve bugünden sonra olmamalıdır.",
    statement_import_submit: "{{count}} işlemi aktar",
    statement_import_result:
      "{{created}} yeni abonelik oluşturuldu, {{imported}} ödeme takvime aktarıldı. Daha önce kaydedilmiş {{skipped}} ödeme atlandı.",
    statement_import_load_failed:
      "Aktarım için abonelikler, para birimleri, ödeme dönemleri, kategoriler veya ödeme yöntemleri yüklenemedi.",
    statement_import_retry: "Tekrar dene",
    statement_import_invalid: "Seçilen işlemleri, abonelik adını ve ödeme dönemini kontrol et.",
    statement_import_currency:
      "Ödemeyi aynı para birimindeki bir abonelikle eşleştir. Para birimi hesabında yoksa önce Ayarlar > Para birimleri bölümünden ekle.",
    statement_import_ambiguous:
      "Aynı ad ve para biriminde birden fazla abonelik var. Kayıtlı aboneliklerin adlarını ayırt edilecek şekilde düzenleyip tekrar aktar.",
    statement_import_next_date:
      "Aktif yeni aboneliğin sonraki ödeme tarihi, bugünden ve ekstredeki ödemelerden sonra olmalı.",
    statement_import_conflict:
      "Aynı abonelik ve tarihte çakışan ödeme kayıtları var. Aynı aboneliğe ait seçili işlemlerin tutarlarını birleştir, ayrı üyelikleri farklı aboneliklerle eşleştir veya takvimdeki kaydı kontrol et. Hiçbir işlem aktarılmadı.",
    statement_import_conflict_row: "{{subscription}} · {{date}}: Bu tarihte çakışan bir ödeme var.",
    statement_import_failed:
      "Aktarım sonucu doğrulanamadı. Ekranı yenileyip tekrar deneyebilirsin; kaydedilmiş aynı ödemeler tekrar eklenmez.",
    statement_subscription: "Abonelik",
    statement_subscription_name: "Online abonelik adı",
    statement_match_catalog: "Tanınan online servis",
    statement_match_account: "Kayıtlı aboneliğinle eşleşiyor · online abonelik olduğunu kontrol et",
    statement_match_provider: "Abonelik olabilir · tek seferlik alışveriş olmadığını kontrol et",
    statement_match_manual: "Elle belirtilen online abonelik",
    statement_excluded:
      "{{count}} işlem listeden çıkarıldı. Online abonelik dışındaki ve iadeyle kapanan işlemler dahil edilmez.",
    statement_refunded_charges_excluded:
      "{{count}} harcama, aynı ekstredeki tam iadesiyle eşleşti. Harcama ve iade satırları listeden çıkarıldı; kaydedilmeyecek veya aktarılmayacak.",
    statement_unmatched_refunds:
      "{{count}} iade, aynı ekstredeki bir harcamayla tam olarak eşleştirilemedi. İlgili harcamaları kontrol et; kısmi, farklı ekstredeki veya tutarı belirsiz iadeler otomatik olarak bir harcamayı kaldırmaz.",
    statement_account_match_unavailable:
      "Kayıtlı abonelikler yüklenemedi; eşleştirme yalnızca tanınan online servislerle yapılacak.",
    statement_online_only:
      "Yalnızca adı belirtilen online abonelik ödemeleri kaydedilebilir. İadeler dahil edilmez.",
    transfer_data_bank_statements: "Ekstre işlem listeleri",
    statement_secure_context: "PDF okumak için Monline'ı HTTPS veya localhost üzerinden aç.",
    statement_previous: "Önceki",
    statement_next: "Sonraki",
    bank_statements: "Ekstreler",
    project_about: "Monline hakkında",
    project_description: "Aboneliklerini, bütçeni ve harcamalarını tek yerde takip et.",
    project_links: "Monline bağlantıları",
    project_issues: "Yardım ve sorun bildir",
    project_about_description:
      "Monline; aboneliklerini, düzenli ödemelerini ve bütçeni tek yerden yönetmeni sağlayan, kendi sunucunda çalışan bir uygulamadır. Ödeme takvimi, ekstre aktarımı ve ödeme kayıtlarına dayanan istatistiklerle harcamalarını takip edebilirsin.",
    project_stack:
      "<label>Altyapı</label>: React, TypeScript, Node.js ve SQLite. Docker ile çalıştırılabilir.",
    project_maintainer: "Projeyi sürdüren:",
    project_github_pending: "GitHub deposu henüz oluşturulmadı.",
    statement_upload: "Kredi kartı ekstresi",
    statement_intro:
      "Enpara, DenizBank veya Garanti BBVA ekstreni yükle. Tüm işlemleri kategori özetiyle inceleyip kaydet; Dijital / Abonelik bölümündeki uygun ödemeleri mevcut aboneliklerine ve takvime aktar.",
    statement_privacy:
      "PDF ve şifresi cihazındaki tarayıcıda işlenir; sunucuya gönderilmez. AI kullanılmaz.",
    statement_file: "PDF dosyası · en fazla 20 MB",
    statement_choose: "PDF seç",
    statement_no_file: "Dosya seçilmedi",
    statement_bank: "Banka",
    statement_auto_bank: "Otomatik algıla",
    statement_period: "Ekstre dönemi",
    statement_password: "PDF şifresi (varsa)",
    statement_read: "Ekstreyi oku",
    statement_checking_file: "Dosyanın daha önce kaydedilip kaydedilmediği kontrol ediliyor…",
    statement_file_check_failed: "Dosya kaydı kontrol edilemedi. Yeniden dene.",
    statement_file_check_retry: "Dosyayı yeniden kontrol et",
    statement_progress: "{{current}} / {{total}} sayfa okunuyor…",
    statement_review: "Ekstreyi incele",
    statement_saved_list: "Kaydedilen işlem listesi",
    statement_review_note:
      "Kaydetmeden önce işlemleri ve tutarları kontrol et.",
    statement_refunds_removed_short: "{{count}} tam iade listeden çıkarıldı",
    statement_refunds_review_short: "{{count}} iadeyi incele",
    statement_balance_formula_title: "Ekstre borcu nasıl hesaplanıyor?",
    statement_net: "İşlemlerden hesaplanan net harcama",
    statement_net_help:
      "Seçili harcamalar, faiz/masraflar ve iadelerden hesaplanır. Önceki borcu ve kart borcu ödemelerini içermez; toplam ekstre borcundan farklı olabilir.",
    statement_pdf_balance: "PDF’deki toplam ekstre borcu: {{amount}}",
    statement_balance_formula_help:
      "Önceki borç − ödemeler + harcamalar + nakit avans + faiz/masraflar = ekstre borcu",
    statement_spending: "Abonelik ödemeleri",
    statement_refunds: "İadeler",
    statement_repayments: "Kart borcu ödemeleri (harcamaya dahil değil)",
    statement_selected: "{{total}} işlemden {{selected}} tanesi seçili",
    statement_reparse: "Döneme göre yeniden oku (düzeltmeler sıfırlanır)",
    statement_add_row: "Eksik online abonelik ekle",
    statement_include: "Dahil et",
    statement_include_row: "{{merchant}} işlemini dahil et",
    statement_date: "İşlem tarihi",
    statement_date_format: "GG/AA/YYYY",
    statement_choose_date: "İşlem tarihini seç",
    statement_date_outside_period: "İşlem tarihi seçilen ekstre döneminden farklı bir aya ait.",
    statement_merchant: "İşyeri / açıklama",
    statement_amount: "Tutar",
    statement_currency: "Para birimi",
    statement_kind: "İşlem türü",
    statement_source: "PDF kaynağı",
    statement_page: "Sayfa {{page}}",
    statement_installment: "Taksit",
    statement_check_row: "Tarih, tutar ve para birimini kontrol et",
    statement_kind_charge: "Harcama",
    statement_kind_refund: "İade / alacak",
    statement_kind_repayment: "Kart borcu ödemesi",
    statement_repayment_no_calendar: "Takvim’e aktarılmaz; Gelir/Gider’deki kart ödemesi esas alınır.",
    statement_kind_fee: "Ücret / faiz / vergi",
    statement_kind_cash: "Nakit avans",
    statement_unresolved: "{{count}} işlem satırının tutarı veya tarihi okunamadı",
    statement_unresolved_note:
      "Bu satırlar otomatik olarak çözümlenemedi. PDF ile karşılaştırıp eksik işlemleri elle ekle. Kaynak satırlar ekstreyle birlikte saklanır.",
    statement_empty_pages:
      "{{count}} sayfadan metin alınamadı; bu sayfalardaki işlemler listede eksik olabilir.",
    statement_review_confirm:
      "Seçili işlemlerin tarihlerini, tutarlarını, kategorilerini ve para birimlerini PDF ile kontrol ettim. Ekstre özeti ve okunamayan kaynak satırlarıyla birlikte kaydedilmesini onaylıyorum.",
    statement_save: "Ekstreyi kaydet",
    statement_saved:
      "Ekstre ve kategori özeti arşive kaydedildi. Dijital / Abonelik bölümünden uygun ödemeleri aboneliklerine aktarabilirsin.",
    statement_select_bank: "Kaydetmek için bankayı seç.",
    statement_archive: "Ekstre arşivi",
    statement_archive_note:
      "Kaydettiğin tam ekstreler, kategori özetleri ve abonelik eşleştirmeleri burada tutulur.",
    statement_archive_empty: "Henüz kaydedilmiş ekstre yok.",
    statement_delete_title: "Ekstre listesi silinsin mi?",
    statement_delete_note:
      "Bu ekstreye ait kaydedilen işlem listesi silinecek. Abonelik kayıtların etkilenmez.",
    statement_invalid_file: "20 MB'dan küçük, geçerli bir PDF dosyası seç.",
    statement_too_many_pages: "Bu PDF işlem sınırını aşıyor. En fazla 80 sayfalık bir ekstre seç.",
    statement_no_text:
      "PDF'de okunabilir metin bulunamadı. Taranmış / resim içeren ekstreler için OCR desteği henüz yok.",
    statement_password_error: "PDF şifreli veya şifre hatalı. PDF şifresini girip yeniden dene.",
    statement_read_failed:
      "PDF okunamadı. Dosyanın geçerli ve okunabilir metin içerdiğini kontrol et.",
    statement_no_rows: "İşlem bulunamadı. Okunamayan satırları kontrol et veya elle işlem ekle.",
    statement_invalid_rows:
      "Seçili işlemlerin tarih, tutar, kategori ve para birimi bilgilerini kontrol et.",
    statement_duplicate:
      "Bu ekstre zaten kayıtlı. Ekstre arşivinden açabilirsin.",
    statement_save_failed: "İşlem listesi kaydedilemedi. Tekrar dene.",
    statement_load_failed: "Ekstre arşivi yüklenemedi.",
    statement_delete_failed: "Ekstre listesi silinemedi.",
    statement_import_history: "Ekstre tarihinden bugüne kadar takvime ekle",
    statement_import_history_note:
      "Ödeme dönemine göre eksik tarihler oluşturulur. Tutarlar son seçili ekstre ödemesinden alınır; her tutarı kontrol edip değiştirebilir veya tarihi çıkarabilirsin. Onayladığın ödemeler ödendi olarak eklenir. Ekstredeki ve daha önce ödenmiş tarihler tekrar eklenmez.",
  },
  en: {
    statement_duplicates_title: "Similar purchases found!",
    statement_duplicates_short_help: "Compare incoming transactions with existing records. No records are removed automatically.",
    statement_duplicates_review_count: "Review: {{count}} matches",
    statement_duplicates_transaction: "Transaction {{number}}",
    statement_duplicates_record_count: "Comparing {{count}} separate records",
    statement_duplicates_review_heading: "These payments may be recorded twice.",
    statement_duplicates_legitimate_help: "If you really made this purchase {{count}} times on the same day,",
    statement_duplicates_legitimate_action: "no review is needed — save!",
    statement_duplicates_installment_count: "Possible other installments: {{count}}",
    statement_duplicates_installment_help: "These installments belong to different months. No action is needed; selected records will be saved normally.",
    statement_duplicates_compared_records: "Similar record",
    statement_duplicates_amount: "Amount",
    statement_duplicates_same_amount: "Same amount",
    statement_duplicates_other_installment: "Different installment number",
    statement_duplicates_pdf_page: "PDF · page {{page}}",
    statement_duplicates_view_statement: "Open statement",
    statement_duplicates_rules: "How are similar transactions found?",
    statement_duplicates_help:
      "Records with the same date, merchant and currency are compared. The tolerance is TRY 5 or 0.01 for other currencies. Nothing is deleted or merged automatically. Different installments can be separate payments. Go back to deselect unwanted rows.",
    statement_duplicates_possible_duplicate: "Possible duplicate — review",
    statement_duplicates_installment_continuation:
      "May be another installment of the same purchase",
    statement_duplicates_new: "Incoming record",
    statement_duplicates_source_statement: "Saved PDF statement",
    statement_duplicates_source_ledger: "Income / Expenses",
    statement_duplicates_source_manual_card: "Manual card purchase",
    statement_duplicates_source_manual_bill: "Manual bill",
    statement_duplicates_source_incoming: "Another row in this PDF",
    statement_duplicates_difference: "Amount difference",
    statement_duplicates_back: "Go back and review",
    statement_duplicates_continue: "Save selected records",
    statement_duplicates_more:
      "Showing the first 200 matches. Adjust your selections and check again to see more.",
    statement_duplicate_check_failed:
      "Similar purchases could not be checked. Nothing was saved; try again.",
    statement_open_page: "Open statement page",
    statement_attention_title: "Transactions needing review ({{count}})",
    statement_attention_help:
      "These rows contain an ambiguous amount or text. Check the PDF page and correct the transaction table. Ambiguous amounts are excluded from totals and saved transactions.",
    statement_text_issue:
      "Some description characters could not be decoded. Compare the merchant name with the PDF.",
    statement_review_confirm_incomplete:
      "I checked {{count}} extraction warnings and their source lines against the PDF. I corrected or omitted incomplete transactions and approve saving only the selected transactions.",
    statement_amount_issue_joined_installment:
      "The installment number may be joined to the amount. Check the PDF and manually enter the amount and installment. This row cannot be selected yet.",
    statement_amount_issue_invalid_amount:
      "The complete amount could not be read reliably. Enter the amount from the PDF manually.",
    statement_amount_issue_multiple_amounts:
      "There are multiple amount columns. Enter the actual purchase amount from the PDF manually.",
    statement_amount_issue_installment_total:
      "The installment amount exceeds the total purchase amount. Check the PDF amount and installment.",
    statement_totals_mismatch: "PDF summary totals do not match the extracted transactions.",
    statement_reconciliation_report_issue: "Report an issue on GitHub",
    statement_totals_unverified: "PDF totals could not be verified.",
    statement_verification_check_summary_balance: "PDF summary equation",
    statement_verification_check_balance: "Statement closing balance",
    statement_verification_check_movement: "Net movement for the period",
    statement_verification_from_summary: "Calculated from the PDF summary",
    statement_verification_issue_no_source_rows: "No source transactions were found for comparison.",
    statement_verification_issue_invalid_source_rows: "Some transaction amounts could not be verified against their PDF source.",
    statement_verification_issue_conflicting_source_rows: "Conflicting records refer to the same PDF source row.",
    statement_verification_issue_unsupported_currency: "Totals could not be verified for non-TRY transactions.",
    statement_verification_issue_invalid_summary: "Some PDF summary amounts are invalid.",
    statement_verification_issue_unread_source_rows: "Some PDF transaction rows or pages could not be read.",
    statement_verification_issue_incomplete_summary: "The PDF does not contain enough summary information for comparison.",
    statement_verification_override: "Option to save without verification",
    statement_verification_confirm: "I understand that automatic totals verification was unavailable and confirm saving the selected transactions I reviewed.",
    statement_refunds_matched_short: "Refunds matched to purchases: {{count}}",
    statement_refund_exact_match: "Matched purchase: {{date}} · {{amount}}",
    statement_excluded_help:
      "{{count}} unselected transactions will not be added to spending. They are retained for PDF reconciliation; the statement balance stays unchanged.",
    statement_reconciliation_values:
      "Statement: {{expected}} · Calculated: {{actual}} · Difference: {{difference}}",
    statement_reconciliation_pdf: "PDF total",
    statement_reconciliation_calculated: "Transaction total",
    statement_reconciliation_source_rows: "Included source rows: {{count}}",
    statement_reconciliation_cancelled: "Fully refunded purchases of {{amount}} were not added again.",
    statement_reconciliation_override: "Option to save with this difference",
    statement_reconciliation_confirm:
      "I checked this difference against the PDF and confirm saving only the selected transactions as shown.",
    statement_installment_invalid:
      "Enter a valid installment (e.g. 2/4). Its position cannot exceed the total installment count.",
    statement_unmatched_refunds_title: "Unmatched refunds ({{count}})",
    statement_refunds_title: "Refunds ({{count}})",
    statement_matched_refunds_title: "Matched refunds ({{count}})",
    statement_refund_net: "Net {{amount}}",
    statement_refund_returned_info: "Purchase refunded.",
    statement_refund_installment_info: "Installment refund matched.",
    statement_refund_difference_info: "Refund matched; the amount difference is preserved.",
    statement_refund_proximity_info: "Matched by a later date and a similar TRY amount; the difference is preserved.",
    statement_refund_merchant_info: "Purchases and refunds for the same store in this statement.",
    statement_refund_charge_total: "Purchases",
    statement_refund_refund_total: "Refunds",
    statement_refund_remaining: "Net spending",
    statement_refund_group_rows: "Transactions ({{count}})",
    statement_refund_original_amount: "Original currency amount: {{amount}}",
    statement_refund_installment_match: "Matched installment: {{date}} · {{installment}} · {{amount}}",
    statement_refund_currency_match: "Matched original currency amount: {{original}} · {{date}} · {{amount}}",
    statement_refund_rounding_net: "Charge − refund: {{amount}}. The amount difference is preserved in totals.",
    statement_unmatched_refunds_help:
      "These refunds are kept outside the main transaction table. Selected refunds reduce net spending and are saved with the statement. Partial refunds do not automatically remove a purchase.",
    statement_category_digital: "Digital / Subscriptions",
    statement_category_online: "Online shopping",
    statement_category_bills: "Bills / Services",
    statement_category_shopping: "Clothing / Shopping",
    statement_category_health: "Health",
    statement_category_groceries: "Groceries",
    statement_category_dining: "Dining / Restaurants",
    statement_category_coffee: "Coffee",
    statement_category_travel: "Travel",
    statement_category_transport: "Transport",
    statement_category_toys: "Toys",
    statement_category_foreign: "Foreign purchases",
    statement_category_other: "Other",
    statement_category_fees: "Interest / Taxes",
    statement_category_summary: "Category summary",
    statement_category_chart: "Category distribution · {{currency}}",
    statement_category_details: "{{category}} spending",
    statement_category_select: "Select a pie slice or category name to see its spending.",
    statement_category_net_total: "Net total",
    statement_category_no_positive: "No positive net spending.",
    statement_category_refund: "Net refund",
    statement_category_positive_only:
      "The pie shows positive net categories. Refunds remain in the list and net total.",
    statement_category: "Category",
    statement_category_filter: "Displayed category",
    statement_all_categories: "All categories",
    statement_account_summary: "Statement summary",
    statement_account_summary_help:
      "Summary values are read automatically from the statement and cannot be edited. Missing values are omitted. Amounts are in TRY.",
    statement_summary_previous_balance: "Previous balance",
    statement_summary_payments: "Payments",
    statement_summary_payments_with_refunds: "Payments and refunds",
    statement_payments_refund_breakdown: "Card payments {{payments}} + refunds {{refunds}}",
    statement_summary_purchases: "Purchases and earlier installments",
    statement_summary_cash: "Cash advances",
    statement_summary_fees: "Interest, taxes and fees",
    statement_summary_balance: "Statement balance",
    statement_summary_minimum_payment: "Minimum payment",
    statement_summary_mismatch:
      "The statement balance equation does not match. Check the source PDF amounts.",
    statement_digital_help:
      "A digital purchase is not necessarily a recurring subscription. Match recognized services to your existing subscriptions and review uncertain or one-off purchases before importing.",
    statement_financing_interest: "Purchase interest",
    statement_financing_kkdf: "Interest KKDF",
    statement_financing_bsmv: "Interest and fee BSMV",
    statement_financing_unitemized: "Interest / fees from the summary",
    statement_derived_fee_help:
      "The interest, taxes and fees stated in the PDF summary that do not appear as separate transaction rows. Included in the balance calculation without creating a separate payment.",
    statement_summary_fees_applied:
      "{{amount}} in interest / fees from the PDF summary was included in the balance calculation. Fees already present as transaction rows were not added again.",
    statement_delete_all: "Delete all statements",
    statement_delete_all_note:
      "Permanently delete the entire statement archive, across all pages? Subscriptions and payments already imported into the calendar will be kept.",
    statement_import_add_category: "Add category",
    statement_import_category_name: "Category name",
    statement_import_prepare_note:
      "Before importing into subscriptions and the calendar, we recommend organizing your <categories>categories</categories> and <paymentMethods>payment methods</paymentMethods>.",
    statement_import_title: "Import online subscriptions",
    statement_import_description:
      "In this step, match online subscriptions to your existing subscriptions or create new ones.",
    statement_import_target: "Subscription for these payments",
    statement_import_no_similar:
      "No similar saved subscription was found in the same currency. You can create a new subscription.",
    statement_import_split: "Match transactions separately",
    statement_import_combine: "Combine amounts",
    statement_import_uncombine: "Undo combination",
    statement_import_combine_hint:
      "{{count}} transactions are selected on the same day. Combine them into one payment if they belong to the same subscription.",
    statement_import_combine_enabled:
      "{{count}} selected transactions will be imported as one calendar payment of {{total}}. Amounts already imported from this statement are not added again.",
    statement_import_new: "Create a new subscription",
    statement_import_cycle: "Billing cycle",
    statement_import_active: "Create active subscription",
    statement_import_next: "Next payment date",
    statement_import_next_month:
      "The month and year come from the month after the import date. The day is kept from the latest selected charge, or the last day of the month if necessary.",
    statement_import_schedule_note:
      "Statement saved. Its spending is shown in Calendar.",
    statement_import_existing_note:
      "Your existing subscription’s price and active/inactive status are kept. Your category and payment method selections are saved to the subscription. Selected historical payments are added, and the next payment date is updated to the month after the current month.",
    statement_import_date_range: "The payment date must be valid and cannot be after today.",
    statement_import_submit: "Import {{count}} transactions",
    statement_import_result:
      "Created {{created}} subscriptions and imported {{imported}} calendar payments. Skipped {{skipped}} previously recorded payments.",
    statement_import_load_failed:
      "Subscriptions, currencies, billing cycles, categories or payment methods could not be loaded for import.",
    statement_import_retry: "Try again",
    statement_import_invalid:
      "Check the selected transactions, subscription name and billing cycle.",
    statement_import_currency:
      "Match the payment with a subscription in the same currency. If the currency is missing, add it in Settings > Currencies first.",
    statement_import_ambiguous:
      "Multiple subscriptions have this name and currency. Give the saved subscriptions distinct names before importing again.",
    statement_import_next_date:
      "An active new subscription's next payment must be after today and after the statement payments.",
    statement_import_conflict:
      "Payments conflict for the same subscription and date. Combine selected transactions belonging to the same subscription, match separate memberships to separate subscriptions, or check the calendar record. Nothing was imported.",
    statement_import_conflict_row: "{{subscription}} · {{date}}: A payment conflicts on this date.",
    statement_import_failed:
      "The import result could not be confirmed. Refresh and try again; matching payments already saved will not be added twice.",
    statement_subscription: "Subscription",
    statement_subscription_name: "Online subscription name",
    statement_match_catalog: "Recognized online service",
    statement_match_account: "Matches your subscription · check that it is an online subscription",
    statement_match_provider: "Possible subscription · check that it is not a one-off purchase",
    statement_match_manual: "Manually identified online subscription",
    statement_excluded:
      "{{count}} transactions were excluded. Non-subscription transactions and fully refunded charges are not included.",
    statement_refunded_charges_excluded:
      "{{count}} purchases match full refunds in this statement. Both rows were removed from the list and will not be saved or imported.",
    statement_unmatched_refunds:
      "{{count}} refunds could not be fully matched to a charge in this statement. Check the related charges; partial refunds, refunds in other statements and ambiguous amounts do not automatically remove a charge.",
    statement_account_match_unavailable:
      "Your saved subscriptions could not be loaded; only recognized online services will be matched.",
    statement_online_only:
      "Only named online subscription payments can be saved. Refunds are excluded.",
    transfer_data_bank_statements: "Statement transaction lists",
    statement_secure_context: "Open Monline using HTTPS or localhost to read PDFs.",
    statement_previous: "Previous",
    statement_next: "Next",
    bank_statements: "Statements",
    project_about: "About Monline",
    project_description: "Track your subscriptions, budget and spending in one place.",
    project_links: "Monline links",
    project_issues: "Help and report an issue",
    project_about_description:
      "Monline is a self-hosted application for managing your subscriptions, recurring payments and budget in one place. Follow your spending with a payment calendar, statement imports and statistics based on recorded payments.",
    project_stack:
      "<label>Stack</label>: React, TypeScript, Node.js and SQLite. Deployable with Docker.",
    project_maintainer: "Maintained by:",
    project_github_pending: "The GitHub repository has not been created yet.",
    statement_upload: "Credit card statement",
    statement_intro:
      "Upload an Enpara, DenizBank or Garanti BBVA statement. Review and save all transactions with a category summary, then import eligible Digital / Subscriptions payments into your subscriptions and calendar.",
    statement_privacy:
      "The PDF and its password are processed in your browser and are not sent to the server. No AI is used.",
    statement_file: "PDF file · up to 20 MB",
    statement_choose: "Choose PDF",
    statement_no_file: "No file selected",
    statement_bank: "Bank",
    statement_auto_bank: "Detect automatically",
    statement_period: "Statement period",
    statement_password: "PDF password (if required)",
    statement_read: "Read statement",
    statement_checking_file: "Checking whether this file has already been saved…",
    statement_file_check_failed: "Could not check the file. Please try again.",
    statement_file_check_retry: "Check the file again",
    statement_progress: "Reading page {{current}} of {{total}}…",
    statement_review: "Review statement",
    statement_saved_list: "Saved transaction list",
    statement_review_note:
      "Check transactions and amounts before saving.",
    statement_refunds_removed_short: "Full refunds removed: {{count}}",
    statement_refunds_review_short: "Review refunds: {{count}}",
    statement_balance_formula_title: "How is the statement balance calculated?",
    statement_net: "Net spending from transactions",
    statement_net_help:
      "Calculated from selected spending, fees/interest and refunds. Excludes the previous balance and card repayments, so it may differ from the total statement balance.",
    statement_pdf_balance: "Total statement balance in the PDF: {{amount}}",
    statement_balance_formula_help:
      "Previous balance − payments + purchases + cash advances + fees/interest = statement balance",
    statement_spending: "Subscription payments",
    statement_refunds: "Refunds",
    statement_repayments: "Card repayments (excluded from spending)",
    statement_selected: "{{selected}} of {{total}} transactions selected",
    statement_reparse: "Read again using period (resets edits)",
    statement_add_row: "Add missing online subscription",
    statement_include: "Include",
    statement_include_row: "Include transaction: {{merchant}}",
    statement_date: "Transaction date",
    statement_date_format: "DD/MM/YYYY",
    statement_choose_date: "Choose transaction date",
    statement_date_outside_period:
      "The transaction date is in a different month from the selected statement period.",
    statement_merchant: "Merchant / description",
    statement_amount: "Amount",
    statement_currency: "Currency",
    statement_kind: "Transaction type",
    statement_source: "PDF source",
    statement_page: "Page {{page}}",
    statement_installment: "Installment",
    statement_check_row: "Check the date, amount and currency",
    statement_kind_charge: "Purchase",
    statement_kind_refund: "Refund / credit",
    statement_kind_repayment: "Card repayment",
    statement_repayment_no_calendar: "Not added to Calendar; the card payment in Income/Expenses is used.",
    statement_kind_fee: "Fee / interest / tax",
    statement_kind_cash: "Cash advance",
    statement_unresolved: "Could not read the amount or date of {{count}} transaction rows",
    statement_unresolved_note:
      "These lines could not be parsed automatically. Compare them with the PDF and add missing transactions manually. Source lines are saved with the statement.",
    statement_empty_pages:
      "No text was found on {{count}} pages; transactions on those pages may be missing.",
    statement_review_confirm:
      "I compared the selected transaction dates, amounts, categories and currencies with the PDF. Save them together with the statement summary and unresolved source lines.",
    statement_save: "Save statement",
    statement_saved:
      "Statement and category summary archived. Import eligible payments from Digital / Subscriptions into your subscriptions.",
    statement_select_bank: "Choose a bank before saving.",
    statement_archive: "Statement archive",
    statement_archive_note:
      "Your full statements, category summaries and subscription matches are saved here.",
    statement_archive_empty: "No statements have been saved yet.",
    statement_delete_title: "Delete statement list?",
    statement_delete_note:
      "The saved transaction list for this statement will be deleted. Your subscriptions are unaffected.",
    statement_invalid_file: "Choose a valid PDF smaller than 20 MB.",
    statement_too_many_pages:
      "This PDF exceeds the processing limit. Choose a statement with no more than 80 pages.",
    statement_no_text:
      "No readable text was found. OCR for scanned / image-only statements is not supported yet.",
    statement_password_error:
      "The PDF is encrypted or the password is incorrect. Enter its password and try again.",
    statement_read_failed:
      "Unable to read the PDF. Check that it is valid and contains readable text.",
    statement_no_rows:
      "No transactions found. Check the unresolved lines or add a transaction manually.",
    statement_invalid_rows:
      "Check the dates, amounts, categories and currencies of the selected transactions.",
    statement_duplicate:
      "This statement is already saved. Open it from the statement archive.",
    statement_save_failed: "Could not save the transaction list. Please try again.",
    statement_load_failed: "Could not load the statement archive.",
    statement_delete_failed: "Could not delete the statement list.",
    statement_import_history: "Add payments from the statement date through today",
    statement_import_history_note:
      "Missing dates follow the billing cycle. Amounts start from the latest selected statement charge; review, edit or exclude each one. Confirmed entries are marked paid. Statement dates and previously paid dates are not added again.",
  },
  de: {
    statement_duplicates_title: "Ähnliche Ausgaben gefunden!",
    statement_duplicates_short_help: "Vergleiche neue Umsätze mit vorhandenen Einträgen. Es wird nichts automatisch entfernt.",
    statement_duplicates_review_count: "Prüfen: {{count}} Vergleiche",
    statement_duplicates_transaction: "Umsatz {{number}}",
    statement_duplicates_record_count: "{{count}} separate Einträge werden verglichen",
    statement_duplicates_review_heading: "Diese Zahlungen könnten doppelt erfasst werden.",
    statement_duplicates_legitimate_help: "Wenn du diesen Einkauf am selben Tag tatsächlich {{count}} Mal getätigt hast,",
    statement_duplicates_legitimate_action: "musst du nichts prüfen – speichern!",
    statement_duplicates_installment_count: "Mögliche weitere Raten: {{count}}",
    statement_duplicates_installment_help: "Diese Raten gehören zu unterschiedlichen Monaten. Es ist nichts zu tun; ausgewählte Einträge werden normal gespeichert.",
    statement_duplicates_compared_records: "Ähnlicher Eintrag",
    statement_duplicates_amount: "Betrag",
    statement_duplicates_same_amount: "Gleicher Betrag",
    statement_duplicates_other_installment: "Andere Ratennummer",
    statement_duplicates_pdf_page: "PDF · Seite {{page}}",
    statement_duplicates_view_statement: "Abrechnung öffnen",
    statement_duplicates_rules: "Wie werden ähnliche Umsätze gefunden?",
    statement_duplicates_help:
      "Verglichen werden Datum, Händler und Währung. Die Toleranz beträgt 5 TRY bzw. 0,01 in anderen Währungen. Es wird nichts automatisch gelöscht oder zusammengeführt. Unterschiedliche Raten können separate Zahlungen sein. Zurückgehen, um unerwünschte Zeilen abzuwählen.",
    statement_duplicates_possible_duplicate: "Mögliches Duplikat — prüfen",
    statement_duplicates_installment_continuation:
      "Möglicherweise eine weitere Rate desselben Kaufs",
    statement_duplicates_new: "Neuer Eintrag",
    statement_duplicates_source_statement: "Gespeicherte PDF-Abrechnung",
    statement_duplicates_source_ledger: "Einnahmen / Ausgaben",
    statement_duplicates_source_manual_card: "Manueller Kartenumsatz",
    statement_duplicates_source_manual_bill: "Manuelle Rechnung",
    statement_duplicates_source_incoming: "Andere Zeile in diesem PDF",
    statement_duplicates_difference: "Betragsdifferenz",
    statement_duplicates_back: "Zurück und prüfen",
    statement_duplicates_continue: "Auswahl speichern",
    statement_duplicates_more:
      "Die ersten 200 Treffer werden angezeigt. Auswahl anpassen und erneut prüfen, um weitere zu sehen.",
    statement_duplicate_check_failed:
      "Ähnliche Ausgaben konnten nicht geprüft werden. Nichts wurde gespeichert; erneut versuchen.",
    statement_open_page: "Abrechnungsseite öffnen",
    statement_attention_title: "Zu prüfende Umsätze ({{count}})",
    statement_attention_help:
      "Diese Zeilen enthalten einen unklaren Betrag oder Text. Prüfe die PDF-Seite und korrigiere die Tabelle. Unklare Beträge werden weder summiert noch als Umsätze gespeichert.",
    statement_text_issue:
      "Einige Zeichen der Beschreibung konnten nicht gelesen werden. Vergleiche den Händlernamen mit dem PDF.",
    statement_review_confirm_incomplete:
      "Ich habe {{count}} Lesewarnungen und die Quellzeilen mit dem PDF geprüft. Unvollständige Umsätze wurden korrigiert oder ausgelassen; nur die ausgewählten Umsätze sollen gespeichert werden.",
    statement_amount_issue_joined_installment:
      "Die Ratennummer könnte mit dem Betrag verbunden sein. Prüfe das PDF und gib Betrag und Rate manuell ein. Diese Zeile kann noch nicht ausgewählt werden.",
    statement_amount_issue_invalid_amount:
      "Der vollständige Betrag konnte nicht sicher gelesen werden. Gib den Betrag aus dem PDF manuell ein.",
    statement_amount_issue_multiple_amounts:
      "Es gibt mehrere Betragsspalten. Gib den tatsächlichen Kaufbetrag aus dem PDF manuell ein.",
    statement_amount_issue_installment_total:
      "Der Ratenbetrag übersteigt den gesamten Kaufbetrag. Prüfe Betrag und Rate im PDF.",
    statement_totals_mismatch:
      "Die PDF-Zusammenfassung stimmt nicht mit den erkannten Umsätzen überein.",
    statement_excluded_help:
      "{{count}} abgewählte Umsätze werden nicht zu den Ausgaben hinzugefügt. Sie bleiben für den PDF-Abgleich erhalten; der Abrechnungssaldo bleibt unverändert.",
    statement_reconciliation_values:
      "Abrechnung: {{expected}} · Berechnet: {{actual}} · Differenz: {{difference}}",
    statement_reconciliation_pdf: "PDF-Summe",
    statement_reconciliation_calculated: "Umsatzsumme",
    statement_reconciliation_source_rows: "Berücksichtigte Quellzeilen: {{count}}",
    statement_reconciliation_cancelled: "Vollständig erstattete Einkäufe von {{amount}} wurden nicht erneut addiert.",
    statement_reconciliation_report_issue: "Fehler auf GitHub melden",
    statement_totals_unverified: "Die PDF-Summen konnten nicht geprüft werden.",
    statement_verification_check_summary_balance: "Berechnung der PDF-Zusammenfassung",
    statement_verification_check_balance: "Abrechnungssaldo",
    statement_verification_check_movement: "Nettobewegung des Zeitraums",
    statement_verification_from_summary: "Aus der PDF-Zusammenfassung berechnet",
    statement_verification_issue_no_source_rows: "Keine ursprünglichen Umsätze zum Vergleich gefunden.",
    statement_verification_issue_invalid_source_rows: "Einige Umsatzbeträge konnten nicht mit ihrer PDF-Quelle abgeglichen werden.",
    statement_verification_issue_conflicting_source_rows: "Widersprüchliche Einträge beziehen sich auf dieselbe PDF-Zeile.",
    statement_verification_issue_unsupported_currency: "Summen für Umsätze außerhalb von TRY konnten nicht geprüft werden.",
    statement_verification_issue_invalid_summary: "Einige Beträge der PDF-Zusammenfassung sind ungültig.",
    statement_verification_issue_unread_source_rows: "Einige PDF-Umsatzzeilen oder Seiten konnten nicht gelesen werden.",
    statement_verification_issue_incomplete_summary: "Die PDF enthält nicht genügend Summeninformationen für einen Vergleich.",
    statement_verification_override: "Ohne Prüfung speichern",
    statement_verification_confirm: "Ich weiß, dass die automatische Summenprüfung nicht möglich war, und bestätige das Speichern der ausgewählten, geprüften Umsätze.",
    statement_refunds_matched_short: "Zugeordnete Erstattungen: {{count}}",
    statement_refund_exact_match: "Zugeordneter Einkauf: {{date}} · {{amount}}",
    statement_reconciliation_override: "Trotz Differenz speichern",
    statement_reconciliation_confirm:
      "Ich habe die Differenz mit dem PDF geprüft und bestätige das Speichern nur der ausgewählten Umsätze.",
    statement_installment_invalid:
      "Gib eine gültige Rate ein (z. B. 2/4). Die Position darf die gesamte Ratenanzahl nicht übersteigen.",
    statement_unmatched_refunds_title: "Nicht zugeordnete Erstattungen ({{count}})",
    statement_refunds_title: "Erstattungen ({{count}})",
    statement_matched_refunds_title: "Zugeordnete Erstattungen ({{count}})",
    statement_refund_net: "Netto {{amount}}",
    statement_refund_returned_info: "Einkauf erstattet.",
    statement_refund_installment_info: "Ratenerstattung zugeordnet.",
    statement_refund_difference_info: "Erstattung zugeordnet; die Betragsdifferenz bleibt erhalten.",
    statement_refund_proximity_info: "Über späteres Datum und ähnlichen TRY-Betrag zugeordnet; die Differenz bleibt erhalten.",
    statement_refund_merchant_info: "Einkäufe und Erstattungen desselben Händlers in dieser Abrechnung.",
    statement_refund_charge_total: "Einkäufe",
    statement_refund_refund_total: "Erstattungen",
    statement_refund_remaining: "Verbleibende Ausgaben",
    statement_refund_group_rows: "Umsätze ({{count}})",
    statement_refund_original_amount: "Ursprünglicher Fremdwährungsbetrag: {{amount}}",
    statement_refund_installment_match: "Zugeordnete Rate: {{date}} · {{installment}} · {{amount}}",
    statement_refund_currency_match: "Über Originalbetrag zugeordnet: {{original}} · {{date}} · {{amount}}",
    statement_refund_rounding_net: "Belastung − Erstattung: {{amount}}. Die Betragsdifferenz bleibt in den Summen erhalten.",
    statement_unmatched_refunds_help:
      "Diese Erstattungen stehen außerhalb der Haupttabelle. Ausgewählte Erstattungen reduzieren die Nettoausgaben und werden gespeichert. Teilerstattungen entfernen einen Einkauf nicht automatisch.",
    statement_category_digital: "Digital / Abonnements",
    statement_category_online: "Online-Einkäufe",
    statement_category_bills: "Rechnungen / Dienste",
    statement_category_shopping: "Kleidung / Einkäufe",
    statement_category_health: "Gesundheit",
    statement_category_groceries: "Lebensmittel",
    statement_category_dining: "Essen / Restaurants",
    statement_category_coffee: "Kaffee",
    statement_category_travel: "Reisen",
    statement_category_transport: "Verkehr",
    statement_category_toys: "Spielzeug",
    statement_category_foreign: "Auslandseinkäufe",
    statement_category_other: "Sonstiges",
    statement_category_fees: "Zinsen / Steuern",
    statement_category_summary: "Kategorieübersicht",
    statement_category_chart: "Kategorieverteilung · {{currency}}",
    statement_category_details: "Ausgaben für {{category}}",
    statement_category_select:
      "Wähle ein Tortensegment oder einen Kategorienamen, um die Ausgaben zu sehen.",
    statement_category_net_total: "Nettosumme",
    statement_category_no_positive: "Keine positiven Nettoausgaben.",
    statement_category_refund: "Nettoerstattung",
    statement_category_positive_only:
      "Das Diagramm zeigt positive Nettokategorien. Erstattungen bleiben in der Liste und Nettosumme erhalten.",
    statement_category: "Kategorie",
    statement_category_filter: "Angezeigte Kategorie",
    statement_all_categories: "Alle Kategorien",
    statement_account_summary: "Abrechnungsübersicht",
    statement_account_summary_help:
      "Übersichtswerte werden automatisch aus der Abrechnung gelesen und sind schreibgeschützt. Fehlende Werte werden nicht angezeigt. Beträge sind in TRY.",
    statement_summary_previous_balance: "Vorheriger Saldo",
    statement_summary_payments: "Zahlungen",
    statement_summary_payments_with_refunds: "Zahlungen und Erstattungen",
    statement_payments_refund_breakdown: "Kartenzahlungen {{payments}} + Erstattungen {{refunds}}",
    statement_summary_purchases: "Einkäufe und frühere Raten",
    statement_summary_cash: "Bargeldvorschüsse",
    statement_summary_fees: "Zinsen, Steuern und Gebühren",
    statement_summary_balance: "Abrechnungssaldo",
    statement_summary_minimum_payment: "Mindestzahlung",
    statement_summary_mismatch:
      "Die Saldenberechnung stimmt nicht überein. Prüfe die Beträge im PDF.",
    statement_digital_help:
      "Ein digitaler Einkauf ist nicht immer ein Abonnement. Ordne erkannte Dienste vorhandenen Abonnements zu und prüfe unklare oder einmalige Einkäufe vor dem Import.",
    statement_financing_interest: "Einkaufszinsen",
    statement_financing_kkdf: "KKDF auf Zinsen",
    statement_financing_bsmv: "BSMV auf Zinsen und Gebühren",
    statement_financing_unitemized: "Zinsen / Gebühren aus der Übersicht",
    statement_derived_fee_help:
      "Zinsen, Steuern und Gebühren aus der PDF-Übersicht, die nicht als einzelne Buchungen vorliegen. Sie fließen ohne zusätzliche Zahlung in die Saldenberechnung ein.",
    statement_summary_fees_applied:
      "{{amount}} an Zinsen / Gebühren aus der PDF-Übersicht wurden in die Saldenberechnung einbezogen. Bereits vorhandene Gebührenbuchungen wurden nicht erneut addiert.",
    statement_delete_all: "Alle Abrechnungen löschen",
    statement_delete_all_note:
      "Das gesamte Abrechnungsarchiv auf allen Seiten endgültig löschen? Abonnements und bereits importierte Kalenderzahlungen bleiben erhalten.",
    statement_import_add_category: "Kategorie hinzufügen",
    statement_import_category_name: "Kategoriename",
    statement_import_prepare_note:
      "Vor der Übernahme in Abonnements und Kalender empfehlen wir, deine <categories>Kategorien</categories> und <paymentMethods>Zahlungsmethoden</paymentMethods> einzurichten.",
    statement_import_title: "Online-Abos übernehmen",
    statement_import_description:
      "Ordne in diesem Schritt Online-Abos deinen bestehenden Abos zu oder lege neue an.",
    statement_import_target: "Abo für diese Zahlungen",
    statement_import_no_similar:
      "Kein ähnliches gespeichertes Abo mit derselben Währung gefunden. Du kannst ein neues Abo erstellen.",
    statement_import_split: "Umsätze einzeln zuordnen",
    statement_import_combine: "Beträge zusammenfassen",
    statement_import_uncombine: "Zusammenfassung aufheben",
    statement_import_combine_hint:
      "{{count}} Umsätze am selben Tag sind ausgewählt. Gehören sie zum selben Abo, kannst du sie als eine Zahlung zusammenfassen.",
    statement_import_combine_enabled:
      "{{count}} ausgewählte Umsätze werden als eine Kalenderzahlung über {{total}} übernommen. Bereits aus dieser Abrechnung übernommene Beträge werden nicht erneut addiert.",
    statement_import_new: "Neues Abo erstellen",
    statement_import_cycle: "Zahlungsintervall",
    statement_import_active: "Aktives Abo erstellen",
    statement_import_next: "Nächster Zahlungstermin",
    statement_import_next_month:
      "Monat und Jahr stammen aus dem Monat nach dem Importdatum. Der Tag der letzten ausgewählten Ausgabe bleibt erhalten; falls nötig wird der letzte Monatstag verwendet.",
    statement_import_schedule_note:
      "Abrechnung gespeichert. Die Ausgaben werden im Kalender angezeigt.",
    statement_import_existing_note:
      "Preis und Aktivstatus des bestehenden Abos bleiben erhalten. Deine Auswahl für Kategorie und Zahlungsmethode wird im Abo gespeichert. Vergangene Zahlungen werden ergänzt und der nächste Zahlungstermin auf den Monat nach dem aktuellen Monat gesetzt.",
    statement_import_date_range:
      "Das Zahlungsdatum muss gültig sein und darf nicht nach dem heutigen Tag liegen.",
    statement_import_submit: "{{count}} Umsätze übernehmen",
    statement_import_result:
      "{{created}} Abos erstellt und {{imported}} Kalenderzahlungen übernommen. {{skipped}} bereits erfasste Zahlungen übersprungen.",
    statement_import_load_failed:
      "Abos, Währungen, Zahlungsintervalle, Kategorien oder Zahlungsmethoden konnten nicht geladen werden.",
    statement_import_retry: "Erneut versuchen",
    statement_import_invalid: "Prüfe ausgewählte Umsätze, Abonamen und Zahlungsintervall.",
    statement_import_currency:
      "Ordne die Zahlung einem Abo mit derselben Währung zu. Fehlende Währungen zuerst unter Einstellungen > Währungen hinzufügen.",
    statement_import_ambiguous:
      "Mehrere Abos haben diesen Namen und diese Währung. Gib den gespeicherten Abos vor dem Import unterschiedliche Namen.",
    statement_import_next_date:
      "Der nächste Zahlungstermin eines aktiven neuen Abos muss nach heute und nach den Abrechnungszahlungen liegen.",
    statement_import_conflict:
      "Zahlungen für dasselbe Abo und Datum stehen im Konflikt. Fasse ausgewählte Umsätze desselben Abos zusammen, ordne separate Mitgliedschaften verschiedenen Abos zu oder prüfe den Kalendereintrag. Es wurde nichts übernommen.",
    statement_import_conflict_row:
      "{{subscription}} · {{date}}: An diesem Datum gibt es eine widersprüchliche Zahlung.",
    statement_import_failed:
      "Das Ergebnis konnte nicht bestätigt werden. Lade die Seite neu und versuche es erneut; bereits gespeicherte gleiche Zahlungen werden nicht doppelt angelegt.",
    statement_subscription: "Abonnement",
    statement_subscription_name: "Name des Online-Abonnements",
    statement_match_catalog: "Erkannter Online-Dienst",
    statement_match_account: "Passt zu deinem Abonnement · Online-Abonnement prüfen",
    statement_match_provider: "Mögliches Abonnement · einmaligen Einkauf ausschließen",
    statement_match_manual: "Manuell angegebenes Online-Abonnement",
    statement_excluded:
      "{{count}} Umsätze wurden ausgeschlossen. Umsätze ohne Online-Abo und vollständig erstattete Belastungen werden nicht übernommen.",
    statement_refunded_charges_excluded:
      "{{count}} Einkäufe haben vollständige Erstattungen in dieser Abrechnung. Beide Buchungen wurden aus der Liste entfernt und werden weder gespeichert noch übernommen.",
    statement_unmatched_refunds:
      "{{count}} Erstattungen konnten keiner Belastung dieser Abrechnung eindeutig zugeordnet werden. Prüfe die betreffenden Belastungen; Teilerstattungen, andere Abrechnungen und unklare Beträge entfernen keine Belastung automatisch.",
    statement_account_match_unavailable:
      "Deine Abonnements konnten nicht geladen werden. Es werden nur bekannte Online-Dienste erkannt.",
    statement_online_only:
      "Es können nur benannte Online-Abozahlungen gespeichert werden. Erstattungen sind ausgeschlossen.",
    transfer_data_bank_statements: "Abrechnungslisten",
    statement_secure_context: "Öffne Monline über HTTPS oder localhost, um PDFs zu lesen.",
    statement_previous: "Zurück",
    statement_next: "Weiter",
    bank_statements: "Abrechnungen",
    project_about: "Über Monline",
    project_description: "Abonnements, Budget und Ausgaben an einem Ort verwalten.",
    project_links: "Monline-Links",
    project_issues: "Hilfe und Problem melden",
    project_about_description:
      "Monline ist eine selbst gehostete Anwendung, mit der du Abonnements, wiederkehrende Zahlungen und dein Budget an einem Ort verwaltest. Verfolge deine Ausgaben mit Zahlungskalender, Kontoauszugsimport und Statistiken auf Basis erfasster Zahlungen.",
    project_stack:
      "<label>Technik</label>: React, TypeScript, Node.js und SQLite. Mit Docker bereitstellbar.",
    project_maintainer: "Betreut von:",
    project_github_pending: "Das GitHub-Repository wurde noch nicht erstellt.",
    statement_upload: "Kreditkartenabrechnung",
    statement_intro:
      "Lade eine Abrechnung von Enpara, DenizBank oder Garanti BBVA hoch. Prüfe und speichere alle Umsätze mit Kategorieübersicht. Geeignete Zahlungen unter Digital / Abonnements können in Abonnements und Kalender übernommen werden.",
    statement_privacy:
      "PDF und Passwort werden im Browser verarbeitet und nicht an den Server gesendet. Es wird keine KI verwendet.",
    statement_file: "PDF-Datei · bis zu 20 MB",
    statement_choose: "PDF auswählen",
    statement_no_file: "Keine Datei ausgewählt",
    statement_bank: "Bank",
    statement_auto_bank: "Automatisch erkennen",
    statement_period: "Abrechnungszeitraum",
    statement_password: "PDF-Passwort (falls erforderlich)",
    statement_read: "Abrechnung lesen",
    statement_checking_file: "Es wird geprüft, ob diese Datei bereits gespeichert wurde…",
    statement_file_check_failed: "Die Datei konnte nicht geprüft werden. Bitte erneut versuchen.",
    statement_file_check_retry: "Datei erneut prüfen",
    statement_progress: "Seite {{current}} von {{total}} wird gelesen…",
    statement_review: "Abrechnung prüfen",
    statement_saved_list: "Gespeicherte Umsatzliste",
    statement_review_note:
      "Prüfe Umsätze und Beträge vor dem Speichern.",
    statement_refunds_removed_short: "Entfernte vollständige Erstattungen: {{count}}",
    statement_refunds_review_short: "Erstattungen prüfen: {{count}}",
    statement_balance_formula_title: "Wie wird der Abrechnungssaldo berechnet?",
    statement_net: "Nettoumsatz aus Buchungen",
    statement_net_help:
      "Aus ausgewählten Ausgaben, Zinsen/Gebühren und Erstattungen berechnet. Vorheriger Saldo und Kartenzahlungen sind nicht enthalten; der Abrechnungssaldo kann daher abweichen.",
    statement_pdf_balance: "Gesamter Abrechnungssaldo im PDF: {{amount}}",
    statement_balance_formula_help:
      "Vorheriger Saldo − Zahlungen + Einkäufe + Bargeldvorschüsse + Zinsen/Gebühren = Abrechnungssaldo",
    statement_spending: "Abozahlungen",
    statement_refunds: "Erstattungen",
    statement_repayments: "Kartenrückzahlungen (keine Ausgaben)",
    statement_selected: "{{selected}} von {{total}} Umsätzen ausgewählt",
    statement_reparse: "Mit Zeitraum erneut lesen (setzt Änderungen zurück)",
    statement_add_row: "Fehlendes Online-Abo hinzufügen",
    statement_include: "Übernehmen",
    statement_include_row: "Umsatz übernehmen: {{merchant}}",
    statement_date: "Umsatzdatum",
    statement_date_format: "TT/MM/JJJJ",
    statement_choose_date: "Umsatzdatum auswählen",
    statement_date_outside_period:
      "Das Umsatzdatum liegt in einem anderen Monat als der ausgewählte Abrechnungszeitraum.",
    statement_merchant: "Händler / Beschreibung",
    statement_amount: "Betrag",
    statement_currency: "Währung",
    statement_kind: "Umsatzart",
    statement_source: "PDF-Quelle",
    statement_page: "Seite {{page}}",
    statement_installment: "Rate",
    statement_check_row: "Datum, Betrag und Währung prüfen",
    statement_kind_charge: "Einkauf",
    statement_kind_refund: "Erstattung / Gutschrift",
    statement_kind_repayment: "Kartenrückzahlung",
    statement_repayment_no_calendar: "Nicht im Kalender; maßgeblich ist die Kartenzahlung in Einnahmen/Ausgaben.",
    statement_kind_fee: "Gebühr / Zinsen / Steuer",
    statement_kind_cash: "Bargeldvorschuss",
    statement_unresolved:
      "Betrag oder Datum von {{count}} Umsatzzeilen konnte nicht gelesen werden",
    statement_unresolved_note:
      "Diese Zeilen konnten nicht automatisch gelesen werden. Vergleiche sie mit dem PDF und ergänze fehlende Umsätze manuell. Die Quellzeilen werden mitgespeichert.",
    statement_empty_pages:
      "Auf {{count}} Seiten wurde kein Text gefunden. Dortige Umsätze können fehlen.",
    statement_review_confirm:
      "Ich habe Datum, Betrag, Kategorie und Währung der ausgewählten Umsätze mit dem PDF verglichen. Sie werden mit der Abrechnungsübersicht und ungelesenen Quellzeilen gespeichert.",
    statement_save: "Abrechnung speichern",
    statement_saved:
      "Abrechnung und Kategorieübersicht archiviert. Geeignete Zahlungen unter Digital / Abonnements können in Abonnements übernommen werden.",
    statement_select_bank: "Wähle vor dem Speichern eine Bank.",
    statement_archive: "Abrechnungsarchiv",
    statement_archive_note:
      "Vollständige Abrechnungen, Kategorieübersichten und Abozuordnungen werden hier gespeichert.",
    statement_archive_empty: "Noch keine Abrechnungen gespeichert.",
    statement_delete_title: "Abrechnungsliste löschen?",
    statement_delete_note:
      "Die gespeicherte Umsatzliste dieser Abrechnung wird gelöscht. Abonnements bleiben unverändert.",
    statement_invalid_file: "Wähle ein gültiges PDF mit weniger als 20 MB.",
    statement_too_many_pages:
      "Das PDF überschreitet das Verarbeitungslimit. Wähle eine Abrechnung mit höchstens 80 Seiten.",
    statement_no_text:
      "Kein lesbarer Text gefunden. OCR für gescannte Abrechnungen wird noch nicht unterstützt.",
    statement_password_error:
      "Das PDF ist verschlüsselt oder das Passwort ist falsch. Gib das Passwort ein und versuche es erneut.",
    statement_read_failed:
      "Das PDF konnte nicht gelesen werden. Prüfe, ob es gültig ist und lesbaren Text enthält.",
    statement_no_rows:
      "Keine Umsätze gefunden. Prüfe die ungelesenen Zeilen oder füge einen Umsatz hinzu.",
    statement_invalid_rows: "Prüfe Datum, Betrag, Kategorie und Währung der ausgewählten Umsätze.",
    statement_duplicate:
      "Diese Abrechnung ist bereits gespeichert. Öffne sie im Archiv.",
    statement_save_failed:
      "Die Umsatzliste konnte nicht gespeichert werden. Bitte erneut versuchen.",
    statement_load_failed: "Das Abrechnungsarchiv konnte nicht geladen werden.",
    statement_delete_failed: "Die Abrechnungsliste konnte nicht gelöscht werden.",
    statement_import_history: "Zahlungen vom Abrechnungsdatum bis heute hinzufügen",
    statement_import_history_note:
      "Fehlende Termine folgen dem Zahlungszyklus. Beträge werden aus der letzten ausgewählten Zahlung übernommen und können geprüft, geändert oder ausgeschlossen werden. Bestätigte Einträge gelten als bezahlt. Bereits bezahlte Termine und Abrechnungstage werden übersprungen.",
  },
};
