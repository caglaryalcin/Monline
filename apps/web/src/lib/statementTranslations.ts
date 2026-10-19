// The rest of the interface falls back to English for languages without these keys.
export const statementTranslations = {
  tr: {
    statement_import_prepare_note:
      "İçe aktarmadan önce <categories>kategorilerinizi</categories> ve <paymentMethods>ödeme yöntemlerinizi</paymentMethods> düzenlemenizi tavsiye ederiz.",
    statement_import_title: "Aboneliklere ve takvime aktar",
    statement_import_description:
      "Eşleşen abonelikler otomatik kullanılır; eşleşme yoksa yeni kayıt oluşturulur. Seçilen işlemler ekstredeki tarih ve tutarla ödenmiş olarak takvime eklenir. İadeler aktarılmaz.",
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
      "Ekstrede seçtiğin ödemeler kendi tarih ve tutarlarıyla aktarılır. İstersen ödeme dönemine göre bugüne kadarki eksik ödemeleri ayrıca kontrol edip ekleyebilirsin. Aktif abonelik oluşturma seçeneği bundan bağımsızdır; kapalıysa yeni abonelik pasif kalır.",
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
      "{{count}} abonelik harcaması, aynı ekstredeki aynı işyeri, para birimi ve tutardaki iadesiyle eşleştiği için çıkarıldı. Bu harcamalar kaydedilmeyecek veya takvime aktarılmayacak.",
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
      "Enpara, DenizBank veya Garanti BBVA ekstrenden yalnızca online abonelik ödemelerini çıkar. Eşleşmeleri kontrol edip aylık abonelik listeni kaydet.",
    statement_privacy:
      "PDF ve şifresi cihazındaki tarayıcıda işlenir; sunucuya gönderilmez. Yalnızca seçip onayladığın işlem listesi hesabına kaydedilir. AI kullanılmaz.",
    statement_file: "PDF dosyası · en fazla 20 MB",
    statement_choose: "PDF seç",
    statement_no_file: "Dosya seçilmedi",
    statement_bank: "Banka",
    statement_auto_bank: "Otomatik algıla",
    statement_period: "Ekstre dönemi",
    statement_password: "PDF şifresi (varsa)",
    statement_read: "Online abonelikleri bul",
    statement_progress: "{{current}} / {{total}} sayfa okunuyor…",
    statement_review: "Online abonelik ödemelerini incele",
    statement_saved_list: "Kaydedilen işlem listesi",
    statement_review_note:
      "Yalnızca tanınan online servisler, kayıtlı aboneliklerinle eşleşen işlemler ve kontrol gerektiren dijital servis ödemeleri gösterilir. Market, akaryakıt, nakit avans, banka ücretleri ve kart borcu ödemeleri dışarıda kalır. Apple/Google gibi açıklamalar tek seferlik alışveriş de olabilir; bu satırlar seçili gelmez. Açıklama, tarih, tutar ve para birimini ekstrenle karşılaştır; eşleşme tek başına abonelik kanıtı değildir.",
    statement_net: "Toplam online abonelik ödemesi",
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
    statement_kind_fee: "Ücret / faiz / vergi",
    statement_kind_cash: "Nakit avans",
    statement_unresolved: "{{count}} olası abonelik satırının tutarı veya tarihi okunamadı",
    statement_unresolved_note:
      "Bu satırlar bir online servisle eşleşiyor ancak tam okunamadı. Eksik abonelik ödemesini yukarıdan elle ekleyebilirsin. Diğer harcamalar filtrelendiği için liste toplamı ekstre borcuna eşit olmayabilir.",
    statement_empty_pages:
      "{{count}} sayfadan metin alınamadı; bu sayfalardaki işlemler listede eksik olabilir.",
    statement_review_confirm:
      "Seçtiğim satırların online abonelik ödemesi olduğunu, tarihlerini, tutarlarını ve para birimlerini PDF ile kontrol ettim. İadeler dahil edilmez. Sonraki adımda abonelikleri eşleştirip ödemeleri takvime aktaracağım.",
    statement_save: "Kaydet ve aktarmaya devam et",
    statement_saved:
      "İşlem listesi arşive kaydedildi. Aboneliklere ve takvime aktarmak için eşleştirmeleri onayla.",
    statement_select_bank: "Kaydetmek için bankayı seç.",
    statement_archive: "Ekstre arşivi",
    statement_archive_note:
      "Bir ekstreyi açıp aboneliklere ve takvime aktarabilirsin. Arşiv listesi ayrıca harcama sayılmaz; daha önce kaydedilmiş aynı ödemeler tekrar oluşturulmaz.",
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
    statement_no_rows:
      "Eşleşen online abonelik bulunamadı. Açıklamasından tanınamayan bir abonelik varsa adını ve ödemesini elle ekleyebilirsin. PDF düzeni okunamıyorsa bazı işlemler eksik olabilir.",
    statement_invalid_rows:
      "Seçili satırların abonelik adı, tarih, açıklama ve tutarını kontrol et. Tutarlar pozitif ve en fazla iki ondalık basamaklı olmalı. İadeler dahil edilmez. En fazla 3.000 işlem kaydedilebilir.",
    statement_duplicate:
      "Bu PDF için bir işlem listesi zaten kaydedilmiş. Ekstre arşivinden açabilirsin.",
    statement_save_failed: "İşlem listesi kaydedilemedi. Tekrar dene.",
    statement_load_failed: "Ekstre arşivi yüklenemedi.",
    statement_delete_failed: "Ekstre listesi silinemedi.",
    statement_import_history: "Ekstre tarihinden bugüne kadar takvime ekle",
    statement_import_history_note:
      "Ödeme dönemine göre eksik tarihler oluşturulur. Tutarlar son seçili ekstre ödemesinden alınır; her tutarı kontrol edip değiştirebilir veya tarihi çıkarabilirsin. Onayladığın ödemeler ödendi olarak eklenir. Ekstredeki ve daha önce ödenmiş tarihler tekrar eklenmez.",
  },
  en: {
    statement_import_prepare_note:
      "We recommend organizing your <categories>categories</categories> and <paymentMethods>payment methods</paymentMethods> before importing.",
    statement_import_title: "Import into subscriptions and calendar",
    statement_import_description:
      "Matching subscriptions are used automatically; otherwise a new record is created. Selected charges appear as paid with their statement dates and amounts. Refunds are excluded.",
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
      "Selected statement charges keep their original dates and amounts. Optionally review and add missing payments through today using the billing cycle. Creating an active subscription is independent; new subscriptions remain inactive when it is off.",
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
      "{{count}} subscription charges were excluded after matching refunds in the same statement with the same merchant, currency and amount. These charges will not be saved or imported into the calendar.",
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
      "Extract only online subscription payments from an Enpara, DenizBank or Garanti BBVA statement. Review the matches and save your monthly subscription list.",
    statement_privacy:
      "The PDF and password are processed in your browser and never sent to the server. Only the transaction list you select and approve is saved to your account. No AI is used.",
    statement_file: "PDF file · up to 20 MB",
    statement_choose: "Choose PDF",
    statement_no_file: "No file selected",
    statement_bank: "Bank",
    statement_auto_bank: "Detect automatically",
    statement_period: "Statement period",
    statement_password: "PDF password (if required)",
    statement_read: "Find online subscriptions",
    statement_progress: "Reading page {{current}} of {{total}}…",
    statement_review: "Review online subscription payments",
    statement_saved_list: "Saved transaction list",
    statement_review_note:
      "Only recognized online services, matches with your saved subscriptions and possible digital service subscriptions are shown. Groceries, fuel, cash advances, bank fees and card repayments are excluded. Apple/Google descriptors can also be one-off purchases; those rows are not selected. Compare descriptions, dates, amounts and currencies with the statement. A merchant match alone does not prove a subscription.",
    statement_net: "Total online subscription payments",
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
    statement_kind_fee: "Fee / interest / tax",
    statement_kind_cash: "Cash advance",
    statement_unresolved:
      "Could not read the amount or date of {{count}} possible subscription rows",
    statement_unresolved_note:
      "These rows match an online service but could not be fully read. Add the missing subscription payment manually above. Other spending is filtered out, so this total may differ from the statement balance.",
    statement_empty_pages:
      "No text was found on {{count}} pages; transactions on those pages may be missing.",
    statement_review_confirm:
      "I checked that the selected rows are online subscription payments and compared their dates, amounts and currencies with the PDF. Refunds are excluded. Next, I will match subscriptions and import the payments into the calendar.",
    statement_save: "Save and continue to import",
    statement_saved:
      "Transaction list saved to the archive. Confirm the matches to import into subscriptions and the calendar.",
    statement_select_bank: "Choose a bank before saving.",
    statement_archive: "Statement archive",
    statement_archive_note:
      "Open a statement to import into subscriptions and the calendar. The archive itself is not counted as spending; previously recorded matching payments are not created again.",
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
      "No matching online subscriptions were found. Add a subscription and its payment manually if its description was not recognized. Unsupported PDF layouts may also leave transactions unread.",
    statement_invalid_rows:
      "Check subscription names, dates, descriptions and amounts. Amounts must be positive with at most two decimal places. Refunds are excluded. Up to 3,000 transactions can be saved.",
    statement_duplicate:
      "A transaction list for this PDF is already saved. Open it from the statement archive.",
    statement_save_failed: "Could not save the transaction list. Please try again.",
    statement_load_failed: "Could not load the statement archive.",
    statement_delete_failed: "Could not delete the statement list.",
    statement_import_history: "Add payments from the statement date through today",
    statement_import_history_note:
      "Missing dates follow the billing cycle. Amounts start from the latest selected statement charge; review, edit or exclude each one. Confirmed entries are marked paid. Statement dates and previously paid dates are not added again.",
  },
  de: {
    statement_import_prepare_note:
      "Wir empfehlen, vor dem Import deine <categories>Kategorien</categories> und <paymentMethods>Zahlungsmethoden</paymentMethods> einzurichten.",
    statement_import_title: "In Abos und Kalender übernehmen",
    statement_import_description:
      "Passende Abos werden automatisch verwendet; andernfalls wird ein neuer Eintrag erstellt. Ausgewählte Belastungen werden mit Datum und Betrag der Abrechnung als bezahlt übernommen. Erstattungen werden ausgeschlossen.",
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
      "Ausgewählte Zahlungen behalten Datum und Betrag der Abrechnung. Fehlende Zahlungen bis heute können nach Prüfung ergänzt werden. Ein aktives Abo wird unabhängig davon erstellt; ohne diese Auswahl bleibt ein neues Abo inaktiv.",
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
      "{{count}} Abo-Belastungen wurden passenden Erstattungen derselben Abrechnung mit gleichem Händler, gleicher Währung und gleichem Betrag zugeordnet. Diese Belastungen werden weder gespeichert noch in den Kalender übernommen.",
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
      "Lies nur Online-Abozahlungen aus einer Abrechnung von Enpara, DenizBank oder Garanti BBVA aus. Prüfe die Treffer und speichere deine monatliche Aboliste.",
    statement_privacy:
      "PDF und Passwort werden im Browser verarbeitet und nicht an den Server gesendet. Nur die ausgewählten und bestätigten Umsätze werden im Konto gespeichert. Es wird keine KI verwendet.",
    statement_file: "PDF-Datei · bis zu 20 MB",
    statement_choose: "PDF auswählen",
    statement_no_file: "Keine Datei ausgewählt",
    statement_bank: "Bank",
    statement_auto_bank: "Automatisch erkennen",
    statement_period: "Abrechnungszeitraum",
    statement_password: "PDF-Passwort (falls erforderlich)",
    statement_read: "Online-Abonnements finden",
    statement_progress: "Seite {{current}} von {{total}} wird gelesen…",
    statement_review: "Online-Abozahlungen prüfen",
    statement_saved_list: "Gespeicherte Umsatzliste",
    statement_review_note:
      "Angezeigt werden nur bekannte Online-Dienste, Treffer zu gespeicherten Abos und mögliche digitale Abonnements. Lebensmittel, Kraftstoff, Bargeldvorschüsse, Bankgebühren und Kartenrückzahlungen bleiben außen vor. Apple-/Google-Buchungen können einmalige Einkäufe sein und sind nicht ausgewählt. Prüfe Beschreibung, Datum, Betrag und Währung im PDF. Ein Händlername allein beweist kein Abonnement.",
    statement_net: "Gesamte Online-Abozahlungen",
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
    statement_kind_fee: "Gebühr / Zinsen / Steuer",
    statement_kind_cash: "Bargeldvorschuss",
    statement_unresolved:
      "Betrag oder Datum von {{count}} möglichen Abozeilen konnte nicht gelesen werden",
    statement_unresolved_note:
      "Diese Zeilen passen zu einem Online-Dienst, wurden aber nicht vollständig gelesen. Fehlende Abozahlungen lassen sich oben ergänzen. Andere Ausgaben werden gefiltert, daher kann die Summe vom Abrechnungsbetrag abweichen.",
    statement_empty_pages:
      "Auf {{count}} Seiten wurde kein Text gefunden. Dortige Umsätze können fehlen.",
    statement_review_confirm:
      "Ich habe die ausgewählten Online-Abozahlungen sowie Datum, Betrag und Währung mit dem PDF verglichen. Erstattungen sind ausgeschlossen. Im nächsten Schritt ordne ich Abos zu und übernehme die Zahlungen in den Kalender.",
    statement_save: "Speichern und zur Übernahme",
    statement_saved:
      "Umsatzliste archiviert. Bestätige die Zuordnungen, um Abos und Kalenderzahlungen zu übernehmen.",
    statement_select_bank: "Wähle vor dem Speichern eine Bank.",
    statement_archive: "Abrechnungsarchiv",
    statement_archive_note:
      "Öffne eine Abrechnung, um Abos und Kalenderzahlungen zu übernehmen. Das Archiv zählt nicht zusätzlich als Ausgabe; bereits erfasste gleiche Zahlungen werden nicht erneut erstellt.",
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
      "Keine passenden Online-Abos gefunden. Nicht erkannte Abos und Zahlungen können manuell ergänzt werden. Bei unbekannten PDF-Layouts können Umsätze fehlen.",
    statement_invalid_rows:
      "Prüfe Aboname, Datum, Beschreibung und Betrag. Beträge müssen positiv sein und höchstens zwei Nachkommastellen haben. Erstattungen sind ausgeschlossen. Maximal 3.000 Umsätze sind möglich.",
    statement_duplicate:
      "Für dieses PDF ist bereits eine Umsatzliste gespeichert. Öffne sie im Archiv.",
    statement_save_failed:
      "Die Umsatzliste konnte nicht gespeichert werden. Bitte erneut versuchen.",
    statement_load_failed: "Das Abrechnungsarchiv konnte nicht geladen werden.",
    statement_delete_failed: "Die Abrechnungsliste konnte nicht gelöscht werden.",
    statement_import_history: "Zahlungen vom Abrechnungsdatum bis heute hinzufügen",
    statement_import_history_note:
      "Fehlende Termine folgen dem Zahlungszyklus. Beträge werden aus der letzten ausgewählten Zahlung übernommen und können geprüft, geändert oder ausgeschlossen werden. Bestätigte Einträge gelten als bezahlt. Bereits bezahlte Termine und Abrechnungstage werden übersprungen.",
  },
};
