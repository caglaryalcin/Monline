export const financeWorkspaceTranslations = {
  tr: {
    finance_workspace: "Finans",
    finance_workspace_sections: "Finans bölümleri",
    finance_workspace_overview: "Genel Bakış",
    finance_workspace_ledger: "Gelir-Gider",
    finance_workspace_debts: "Borçlar",
    finance_workspace_savings: "Birikimler",
    statistics_monthly_payments_income: "Aylık gelir ve ödemeler",
    statistics_other_ledger_expenses: "Diğer Gelir-Gider giderleri",
    statistics_ledger_category_note:
      "Abonelikler ve Gelir-Gider'deki kayıtlı gelecek giderler birlikte gösterilir. Tablo kayıtları satır etiketlerine göre gruplanır; bağlı aboneliğin kategorisi varsa korunur. Gelirler bu maliyet dağılımına dahil edilmez.",
    statistics_payment_items: "Gelir ve ödeme kalemleri",
    statistics_expected_income: "Beklenen gelirler",
    statistics_planned_dates: "Planlanan tarih",
    statistics_entry_count: "{{count}} kayıt",
    statistics_ledger_upcoming_sentence:
      "{{month}} döneminde {{count}} kalem için toplam {{amount}} tutarında yaklaşan ödeme var.",
    statistics_ledger_upcoming_empty: "{{month}} döneminde kayıtlı yaklaşan ödeme yok.",
    statistics_ledger_upcoming_note:
      "Aboneliklerin gelecek ödemeleri ve Gelir-Gider tablosunda bugünden itibaren kayıtlı, ödenmemiş giderler gösterilir. Bağlantılı kayıtlar bir kez sayılır. Kartla karşılanan giderler yerine kartın kayıtlı ödeme tutarı kullanılır; devreden eksi dahil edilmez. Gelir-Gider tutarları ana para birimine güncel kurla çevrilir. Tabloda kayıtlı olmayan ileri dönem giderleri tahmin edilmez.",
    statistics_income_sentence:
      "{{month}} döneminde {{count}} kalem için toplam {{amount}} tutarında beklenen gelir var.",
    statistics_income_empty: "{{month}} döneminde kayıtlı beklenen gelir yok.",
    statistics_income_none: "Beklenen gelir yok",
    statistics_income_note:
      "Gelir-Gider tablosunda bugünden itibaren kayıtlı, henüz tahsil edilmemiş maaş ve diğer planlanan gelirler gösterilir. Tutarlar ana para birimine güncel kurla çevrilir. Tabloda kayıtlı olmayan ileri dönem gelirleri tahmin edilmez.",
    finance_workspace_debt_sections: "Borç bölümleri",
    finance_workspace_intro: "Geliriniz, giderleriniz, borçlarınız ve birikimleriniz bir arada.",
    finance_workspace_month_state: "Aylık durum",
    finance_workspace_assets_state: "Varlık durumu",
    finance_workspace_income: "Bu ayın geliri",
    finance_workspace_expenses: "Bu ayın gideri",
    finance_workspace_remaining: "Kalan para",
    finance_workspace_received: "Tahsil edilen gelirler",
    finance_workspace_paid: "Ödenen giderler + devreden eksi",
    finance_workspace_flow_formula: "Gelir − Toplam gider",
    finance_workspace_total_debts: "Borçlar toplamı",
    finance_workspace_debt_formula: "Bu ay ödenmeyenler + toplam kart borcu",
    finance_workspace_net: "Net varlık",
    finance_workspace_net_formula: "Birikimler − Borçlar toplamı",
    finance_workspace_recorded: "Güncel kayıtlar · {{currency}}",
    finance_currency_unavailable:
      "{{currency}} para birimine dönüşüm için kur alınamadı. Ana para birimini ve Döviz Kuru API ayarlarını kontrol edin. Kur alınana kadar tutarlar gösterilmez ve yeni tutar kaydedilemez.",
    finance_workspace_load_error: "Finans özetinin bazı verileri yüklenemedi.",
    finance_workspace_incomplete:
      "Birikimlerin değerlemesi veya borç verileri yüklenemediğinde ilgili toplam hesaplanamaz.",
    finance_workspace_summary_help:
      "Aylık durum Gelir-Gider tablosuyla aynıdır. Borçlar toplamı, bu ayın diğer ödenmemiş tutarları ile kalan ekstre borcunu, kayıtlı ekstre sonrası kart harcamalarını ve kalan kart taksitlerini kapsar. Kart ödemeleri düşülür; aynı borç bir kez sayılır. Bankada yapılan yeni işlemler platforma kaydedildiğinde toplama yansır. Net varlık = Birikimler toplamı − Borçlar toplamı.",
  },
  en: {
    finance_workspace: "Finance",
    finance_workspace_sections: "Finance sections",
    finance_workspace_overview: "Overview",
    finance_workspace_ledger: "Income & expenses",
    finance_workspace_debts: "Debts",
    finance_workspace_savings: "Savings",
    statistics_monthly_payments_income: "Monthly income and payments",
    statistics_other_ledger_expenses: "Other ledger expenses",
    statistics_ledger_category_note:
      "Includes subscriptions and recorded upcoming ledger expenses. Ledger entries are grouped by row tags; a linked subscription's category is retained when available. Income is excluded from this cost distribution.",
    statistics_payment_items: "Income and payment items",
    statistics_expected_income: "Expected income",
    statistics_planned_dates: "Planned date",
    statistics_entry_count: "{{count}} records",
    statistics_ledger_upcoming_sentence:
      "{{month}} has {{count}} items with upcoming payments totaling {{amount}}.",
    statistics_ledger_upcoming_empty: "There are no recorded upcoming payments for {{month}}.",
    statistics_ledger_upcoming_note:
      "Includes upcoming subscription charges and unpaid expenses recorded in Income & expenses from today onward. Linked entries are counted once. Card-funded expenses are represented by the card's recorded repayment; carried deficits are excluded. Ledger amounts use the current exchange rate for your main currency. Future expenses without ledger entries are not estimated.",
    statistics_income_sentence:
      "{{month}} has {{count}} items with expected income totaling {{amount}}.",
    statistics_income_empty: "There is no recorded expected income for {{month}}.",
    statistics_income_none: "No expected income",
    statistics_income_note:
      "Shows salary and other planned income recorded in Income & expenses from today onward that has not been received. Amounts use the current exchange rate for your main currency. Future income without ledger entries is not estimated.",
    finance_workspace_debt_sections: "Debt sections",
    finance_workspace_intro: "Your income, expenses, debts and savings together.",
    finance_workspace_month_state: "Monthly position",
    finance_workspace_assets_state: "Assets & liabilities",
    finance_workspace_income: "Income this month",
    finance_workspace_expenses: "Expenses this month",
    finance_workspace_remaining: "Money remaining",
    finance_workspace_received: "Income received",
    finance_workspace_paid: "Paid expenses + carried deficit",
    finance_workspace_flow_formula: "Income − Total expenses",
    finance_workspace_total_debts: "Total debts",
    finance_workspace_debt_formula: "Unpaid this month + total card debt",
    finance_workspace_net: "Net assets",
    finance_workspace_net_formula: "Savings − Total debts",
    finance_workspace_recorded: "Current records · {{currency}}",
    finance_currency_unavailable:
      "The exchange rate for {{currency}} is unavailable. Check your main currency and Exchange Rate API settings. Amounts cannot be displayed or entered until the rate is available.",
    finance_workspace_load_error: "Some financial overview data could not be loaded.",
    finance_workspace_incomplete:
      "A total cannot be calculated when savings valuations or debt records could not be loaded.",
    finance_workspace_summary_help:
      "The monthly position matches the income and expense ledger. Total debts include this month's other unpaid entries, remaining statement balances, recorded card purchases after those statements and remaining card installments. Card payments are deducted and each obligation is counted once. New bank transactions are included when recorded in the platform. Net assets = Total savings − Total debts.",
  },
  de: {
    finance_workspace: "Finanzen",
    finance_workspace_sections: "Finanzbereiche",
    finance_workspace_overview: "Überblick",
    finance_workspace_ledger: "Einnahmen & Ausgaben",
    finance_workspace_debts: "Schulden",
    finance_workspace_savings: "Ersparnisse",
    statistics_monthly_payments_income: "Monatliche Einnahmen und Zahlungen",
    statistics_other_ledger_expenses: "Sonstige erfasste Ausgaben",
    statistics_ledger_category_note:
      "Enthält Abonnements und erfasste zukünftige Ausgaben. Tabelleneinträge werden nach Zeilenkennzeichnung gruppiert; die Kategorie eines verknüpften Abonnements bleibt erhalten. Einnahmen sind in dieser Kostenverteilung nicht enthalten.",
    statistics_payment_items: "Einnahmen und Zahlungsposten",
    statistics_expected_income: "Erwartete Einnahmen",
    statistics_planned_dates: "Geplantes Datum",
    statistics_entry_count: "{{count}} Einträge",
    statistics_ledger_upcoming_sentence:
      "Für {{month}} stehen {{count}} Posten mit Zahlungen von insgesamt {{amount}} an.",
    statistics_ledger_upcoming_empty: "Für {{month}} sind keine bevorstehenden Zahlungen erfasst.",
    statistics_ledger_upcoming_note:
      "Enthält zukünftige Abonnementzahlungen und ab heute erfasste, unbezahlte Ausgaben aus Einnahmen & Ausgaben. Verknüpfte Einträge werden einmal gezählt. Kartenausgaben werden durch die erfasste Kartenrückzahlung berücksichtigt; übertragene Fehlbeträge sind ausgeschlossen. Beträge werden zum aktuellen Kurs in die Hauptwährung umgerechnet. Zukünftige Ausgaben ohne Eintrag werden nicht geschätzt.",
    statistics_income_sentence:
      "Für {{month}} werden aus {{count}} Posten Einnahmen von insgesamt {{amount}} erwartet.",
    statistics_income_empty: "Für {{month}} sind keine erwarteten Einnahmen erfasst.",
    statistics_income_none: "Keine erwarteten Einnahmen",
    statistics_income_note:
      "Zeigt ab heute erfasstes, noch nicht erhaltenes Gehalt und andere geplante Einnahmen aus Einnahmen & Ausgaben. Beträge werden zum aktuellen Kurs in die Hauptwährung umgerechnet. Zukünftige Einnahmen ohne Eintrag werden nicht geschätzt.",
    finance_workspace_debt_sections: "Schuldenbereiche",
    finance_workspace_intro: "Einnahmen, Ausgaben, Schulden und Ersparnisse an einem Ort.",
    finance_workspace_month_state: "Monatsübersicht",
    finance_workspace_assets_state: "Vermögensübersicht",
    finance_workspace_income: "Einnahmen diesen Monat",
    finance_workspace_expenses: "Ausgaben diesen Monat",
    finance_workspace_remaining: "Verbleibendes Geld",
    finance_workspace_received: "Erhaltene Einnahmen",
    finance_workspace_paid: "Bezahlte Ausgaben + übertragener Fehlbetrag",
    finance_workspace_flow_formula: "Einnahmen − Gesamtausgaben",
    finance_workspace_total_debts: "Gesamtschulden",
    finance_workspace_debt_formula: "Diesen Monat offen + gesamte Kartenschulden",
    finance_workspace_net: "Nettovermögen",
    finance_workspace_net_formula: "Ersparnisse − Gesamtschulden",
    finance_workspace_recorded: "Aktuelle Einträge · {{currency}}",
    finance_currency_unavailable:
      "Der Wechselkurs für {{currency}} ist nicht verfügbar. Bitte Hauptwährung und Wechselkurs-API-Einstellungen prüfen. Bis der Kurs verfügbar ist, können Beträge nicht angezeigt oder eingegeben werden.",
    finance_workspace_load_error: "Einige Daten der Finanzübersicht konnten nicht geladen werden.",
    finance_workspace_incomplete:
      "Wenn die Bewertung der Ersparnisse oder die Schuldeinträge nicht geladen werden konnten, kann die betreffende Summe nicht berechnet werden.",
    finance_workspace_summary_help:
      "Die Monatsübersicht entspricht der Einnahmen- und Ausgabentabelle. Gesamtschulden umfassen andere offene Einträge dieses Monats, verbleibende Abrechnungssalden, erfasste spätere Kartenkäufe und ausstehende Kartenraten. Kartenzahlungen werden abgezogen und jede Schuld einmal gezählt. Neue Bankumsätze fließen ein, sobald sie in der Plattform erfasst sind. Nettovermögen = Ersparnisse − Gesamtschulden.",
  },
};
