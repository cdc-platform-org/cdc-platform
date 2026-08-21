import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { loadStripe, Stripe, StripeCardElement } from '@stripe/stripe-js';
import { Plus, Trash2, CreditCard, ShieldCheck, Landmark } from 'lucide-react';
import {
  getPaymentMethods,
  createCardSetupIntent,
  addPaymentMethod,
  setDefaultPaymentMethod,
  removePaymentMethod,
  getBillingSettings,
} from '../../services/billingService';
import { PaymentMethod } from '../../types/billing';
import { SupportedLocale } from '../../utils/locale';

const STRINGS = {
  ka: {
    title: 'გადახდის მეთოდები',
    hint: 'დაამატეთ ბარათი მომავალი გადახდებისა და გამოწერების ავტომატური განახლებისთვის — CDC არასდროს ინახავს თქვენს ბარათის რეალურ ნომერს, ამას უსაფრთხოდ აკეთებს Stripe.',
    addCard: '➕ ახალი ბარათის დამატება',
    cancel: 'გაუქმება',
    saveCard: 'ბარათის შენახვა',
    saving: 'მუშავდება…',
    noCards: 'ჯერ არცერთი ბარათი არ გაქვთ დამატებული.',
    default: 'ძირითადი',
    setDefault: 'ძირითადად დაყენება',
    settingDefault: 'ინახება…',
    delete: '🗑️ წაშლა',
    deleting: 'იშლება…',
    expires: 'ვადა',
    loadFailed: 'გადახდის მეთოდების ჩატვირთვა ვერ მოხერხდა.',
    stripeNotConfigured: 'ბარათების დამატება დროებით მიუწვდომელია.',
    initializingCard: 'იტვირთება…',
    addFailed: 'ბარათის დამატება ვერ მოხერხდა. სცადეთ თავიდან.',
    deleteFailed: 'ბარათის წაშლა ვერ მოხერხდა.',
    deleteConfirmAutoRenew:
      'ამ ბარათით ფინანსდება აქტიური გამოწერა — წაშლის შემთხვევაში გამოწერა დაუყოვნებლივ გაუქმდება და ულიმიტო წვდომას დაკარგავთ. გავაგრძელო წაშლა?',
    confirmDeleteYes: 'დიახ, წაშლა',
    confirmDeleteNo: 'გაუქმება',
    termsPrefix: 'ვეთანხმები',
    termsLink: 'წესებსა და პირობებს',
    termsRequired: 'ბარათის შესანახად საჭიროა წესებსა და პირობებზე თანხმობა.',
    bankTransferToggle: 'არ გსურთ ბარათის მიბმა? საბანკო გადარიცხვა (IBAN)',
    bankTransferHint: 'შეგიძლიათ ჩაირიცხოთ თანხა უშუალოდ ჩვენს ანგარიშზე — მიუთითეთ თქვენი ანგარიშის ელ-ფოსტა გადარიცხვის დანიშნულებაში, რომ თანხა ჩაგერიცხოთ ხელით.',
    bankTransferIban: 'IBAN',
    bankTransferBank: 'ბანკი',
    bankTransferAccountName: 'მიმღები',
  },
  en: {
    title: 'Payment Methods',
    hint: "Add a card for future payments and subscription auto-renewal — CDC never stores your real card number, Stripe handles that securely.",
    addCard: '➕ Add a New Card',
    cancel: 'Cancel',
    saveCard: 'Save Card',
    saving: 'Processing…',
    noCards: "You haven't added any cards yet.",
    default: 'Default',
    setDefault: 'Set as default',
    settingDefault: 'Saving…',
    delete: '🗑️ Delete',
    deleting: 'Deleting…',
    expires: 'Expires',
    loadFailed: 'Unable to load payment methods.',
    stripeNotConfigured: 'Adding a card is temporarily unavailable.',
    initializingCard: 'Loading…',
    addFailed: 'Unable to add this card. Please try again.',
    deleteFailed: 'Unable to delete this card.',
    deleteConfirmAutoRenew:
      'This card is funding an active subscription — removing it will immediately cancel that subscription and revoke your unlimited access. Continue removing it?',
    confirmDeleteYes: 'Yes, delete it',
    confirmDeleteNo: 'Cancel',
    termsPrefix: 'I agree to the',
    termsLink: 'Terms & Conditions',
    termsRequired: 'You need to accept the Terms & Conditions to save a card.',
    bankTransferToggle: "Don't want to attach a card? Bank transfer (IBAN)",
    bankTransferHint: 'You can wire the amount directly to our account — put your account email in the transfer reference so we can credit it manually.',
    bankTransferIban: 'IBAN',
    bankTransferBank: 'Bank',
    bankTransferAccountName: 'Recipient',
  },
  de: {
    title: 'Zahlungsmethoden',
    hint: 'Fügen Sie eine Karte für zukünftige Zahlungen und die automatische Verlängerung von Abonnements hinzu — CDC speichert niemals Ihre echte Kartennummer, das übernimmt sicher Stripe.',
    addCard: '➕ Neue Karte hinzufügen',
    cancel: 'Abbrechen',
    saveCard: 'Karte speichern',
    saving: 'Wird verarbeitet…',
    noCards: 'Sie haben noch keine Karten hinzugefügt.',
    default: 'Standard',
    setDefault: 'Als Standard festlegen',
    settingDefault: 'Wird gespeichert…',
    delete: '🗑️ Löschen',
    deleting: 'Wird gelöscht…',
    expires: 'Gültig bis',
    loadFailed: 'Zahlungsmethoden konnten nicht geladen werden.',
    stripeNotConfigured: 'Das Hinzufügen einer Karte ist vorübergehend nicht möglich.',
    initializingCard: 'Wird geladen…',
    addFailed: 'Diese Karte konnte nicht hinzugefügt werden. Bitte versuchen Sie es erneut.',
    deleteFailed: 'Diese Karte konnte nicht gelöscht werden.',
    deleteConfirmAutoRenew:
      'Diese Karte finanziert ein aktives Abonnement — durch das Entfernen wird dieses Abonnement sofort gekündigt und Ihr unbegrenzter Zugriff widerrufen. Trotzdem entfernen?',
    confirmDeleteYes: 'Ja, löschen',
    confirmDeleteNo: 'Abbrechen',
    termsPrefix: 'Ich stimme den',
    termsLink: 'Allgemeinen Geschäftsbedingungen zu',
    termsRequired: 'Sie müssen den Allgemeinen Geschäftsbedingungen zustimmen, um eine Karte zu speichern.',
    bankTransferToggle: 'Keine Karte hinterlegen? Banküberweisung (IBAN)',
    bankTransferHint: 'Sie können den Betrag direkt auf unser Konto überweisen — geben Sie Ihre Konto-E-Mail-Adresse im Verwendungszweck an, damit wir den Betrag manuell gutschreiben können.',
    bankTransferIban: 'IBAN',
    bankTransferBank: 'Bank',
    bankTransferAccountName: 'Empfänger',
  },
  es: {
    title: 'Métodos de pago',
    hint: 'Añade una tarjeta para futuros pagos y la renovación automática de suscripciones — CDC nunca almacena el número real de tu tarjeta, de eso se encarga Stripe de forma segura.',
    addCard: '➕ Añadir nueva tarjeta',
    cancel: 'Cancelar',
    saveCard: 'Guardar tarjeta',
    saving: 'Procesando…',
    noCards: 'Todavía no has añadido ninguna tarjeta.',
    default: 'Predeterminada',
    setDefault: 'Establecer como predeterminada',
    settingDefault: 'Guardando…',
    delete: '🗑️ Eliminar',
    deleting: 'Eliminando…',
    expires: 'Caduca',
    loadFailed: 'No se pudieron cargar los métodos de pago.',
    stripeNotConfigured: 'Añadir una tarjeta no está disponible temporalmente.',
    initializingCard: 'Cargando…',
    addFailed: 'No se pudo añadir esta tarjeta. Inténtalo de nuevo.',
    deleteFailed: 'No se pudo eliminar esta tarjeta.',
    deleteConfirmAutoRenew:
      'Esta tarjeta financia una suscripción activa — al eliminarla, esa suscripción se cancelará de inmediato y perderás tu acceso ilimitado. ¿Continuar con la eliminación?',
    confirmDeleteYes: 'Sí, eliminar',
    confirmDeleteNo: 'Cancelar',
    termsPrefix: 'Acepto los',
    termsLink: 'Términos y Condiciones',
    termsRequired: 'Debes aceptar los Términos y Condiciones para guardar una tarjeta.',
    bankTransferToggle: '¿No quieres vincular una tarjeta? Transferencia bancaria (IBAN)',
    bankTransferHint: 'Puedes transferir el importe directamente a nuestra cuenta — indica el correo electrónico de tu cuenta como concepto de la transferencia para que podamos abonarlo manualmente.',
    bankTransferIban: 'IBAN',
    bankTransferBank: 'Banco',
    bankTransferAccountName: 'Beneficiario',
  },
  fr: {
    title: 'Moyens de paiement',
    hint: "Ajoutez une carte pour vos futurs paiements et le renouvellement automatique de vos abonnements — CDC ne stocke jamais le vrai numéro de votre carte, c'est Stripe qui s'en charge en toute sécurité.",
    addCard: '➕ Ajouter une nouvelle carte',
    cancel: 'Annuler',
    saveCard: 'Enregistrer la carte',
    saving: 'Traitement en cours…',
    noCards: "Vous n'avez encore ajouté aucune carte.",
    default: 'Par défaut',
    setDefault: 'Définir par défaut',
    settingDefault: 'Enregistrement…',
    delete: '🗑️ Supprimer',
    deleting: 'Suppression…',
    expires: "Expire le",
    loadFailed: 'Impossible de charger les moyens de paiement.',
    stripeNotConfigured: "L'ajout d'une carte est temporairement indisponible.",
    initializingCard: 'Chargement…',
    addFailed: "Impossible d'ajouter cette carte. Veuillez réessayer.",
    deleteFailed: 'Impossible de supprimer cette carte.',
    deleteConfirmAutoRenew:
      "Cette carte finance un abonnement actif — la supprimer annulera immédiatement cet abonnement et révoquera votre accès illimité. Continuer la suppression ?",
    confirmDeleteYes: 'Oui, supprimer',
    confirmDeleteNo: 'Annuler',
    termsPrefix: "J'accepte les",
    termsLink: 'Conditions Générales',
    termsRequired: "Vous devez accepter les Conditions Générales pour enregistrer une carte.",
    bankTransferToggle: "Vous ne voulez pas lier de carte ? Virement bancaire (IBAN)",
    bankTransferHint: "Vous pouvez virer le montant directement sur notre compte — indiquez l'e-mail de votre compte dans le motif du virement afin que nous puissions le créditer manuellement.",
    bankTransferIban: 'IBAN',
    bankTransferBank: 'Banque',
    bankTransferAccountName: 'Bénéficiaire',
  },
  uk: {
    title: 'Способи оплати',
    hint: 'Додайте картку для майбутніх платежів і автоматичного продовження підписок — CDC ніколи не зберігає реальний номер вашої картки, це безпечно робить Stripe.',
    addCard: '➕ Додати нову картку',
    cancel: 'Скасувати',
    saveCard: 'Зберегти картку',
    saving: 'Обробка…',
    noCards: 'Ви ще не додали жодної картки.',
    default: 'Основна',
    setDefault: 'Зробити основною',
    settingDefault: 'Зберігається…',
    delete: '🗑️ Видалити',
    deleting: 'Видалення…',
    expires: 'Дійсна до',
    loadFailed: 'Не вдалося завантажити способи оплати.',
    stripeNotConfigured: 'Додавання картки тимчасово недоступне.',
    initializingCard: 'Завантаження…',
    addFailed: 'Не вдалося додати цю картку. Спробуйте ще раз.',
    deleteFailed: 'Не вдалося видалити цю картку.',
    deleteConfirmAutoRenew:
      'Ця картка фінансує активну підписку — після видалення підписку буде негайно скасовано, а необмежений доступ відкликано. Продовжити видалення?',
    confirmDeleteYes: 'Так, видалити',
    confirmDeleteNo: 'Скасувати',
    termsPrefix: 'Я погоджуюся з',
    termsLink: 'Умовами використання',
    termsRequired: 'Щоб зберегти картку, потрібно погодитися з Умовами використання.',
    bankTransferToggle: 'Не хочете прив’язувати картку? Банківський переказ (IBAN)',
    bankTransferHint: 'Ви можете переказати суму напряму на наш рахунок — вкажіть email свого акаунта в призначенні платежу, щоб ми могли зарахувати кошти вручну.',
    bankTransferIban: 'IBAN',
    bankTransferBank: 'Банк',
    bankTransferAccountName: 'Отримувач',
  },
};

const dict: Record<SupportedLocale, typeof STRINGS.en> = STRINGS;

function brandLabel(brand: string): string {
  if (brand === 'amex') return 'American Express';
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return stripePromise;
}

export default function PaymentMethodsCard({ lang, userName }: { lang: SupportedLocale; userName?: string }) {
  const t = dict[lang];
  const [cards, setCards] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [bankTransfer, setBankTransfer] = useState<{ iban: string; bankName: string | null; accountName: string | null } | null>(null);
  const [showBankTransfer, setShowBankTransfer] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [cardElementReady, setCardElementReady] = useState(false);
  // Distinct from addError (a failed submit) — set when Stripe.js itself
  // never becomes usable (missing/invalid NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  // or js.stripe.com blocked/unreachable), so the form shows a clear message
  // instead of a permanently empty, silently-disabled box.
  const [stripeInitError, setStripeInitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const cardElementInstanceRef = useRef<StripeCardElement | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getPaymentMethods()
      .then(setCards)
      .catch(() => setLoadError(t.loadFailed))
      .finally(() => setLoading(false));
  }, [t.loadFailed]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Best-effort — a settings-fetch failure just means the bank-transfer
    // alternative doesn't render, not a load error for the whole card.
    getBillingSettings()
      .then((settings) => {
        if (settings.bankTransferIban) {
          setBankTransfer({
            iban: settings.bankTransferIban,
            bankName: settings.bankTransferBankName,
            accountName: settings.bankTransferAccountName,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Mounts a fresh Stripe Card Element (a Stripe-hosted iframe — raw card
  // input never touches this page's own DOM/JS) each time the add-card form
  // opens, and tears it down when it closes so a cancelled-then-reopened
  // form doesn't double-mount.
  useEffect(() => {
    if (!showAddForm) return;
    let cancelled = false;
    let card: StripeCardElement | null = null;
    setStripeInitError(null);
    getStripe().then((stripe) => {
      if (cancelled) return;
      if (!stripe) {
        // loadStripe resolved to null — no publishable key (or Stripe.js
        // failed to load). Surface it instead of leaving the box empty.
        setStripeInitError(t.stripeNotConfigured);
        return;
      }
      if (!elementRef.current) return;
      stripeRef.current = stripe;
      const isDark = document.documentElement.classList.contains('dark');
      const elements = stripe.elements();
      card = elements.create('card', {
        style: {
          base: {
            fontSize: '14px',
            color: isDark ? '#e2e8f0' : '#0f172a',
            '::placeholder': { color: isDark ? '#64748b' : '#94a3b8' },
          },
          invalid: { color: '#ef4444' },
        },
      });
      card.mount(elementRef.current);
      cardElementInstanceRef.current = card;
      setCardElementReady(true);
    });
    return () => {
      cancelled = true;
      card?.unmount();
      cardElementInstanceRef.current = null;
      setCardElementReady(false);
    };
  }, [showAddForm, t.stripeNotConfigured]);

  const handleAddCard = async () => {
    const stripe = stripeRef.current;
    const card = cardElementInstanceRef.current;
    if (!stripe || !card) {
      setAddError(t.stripeNotConfigured);
      return;
    }
    if (!termsAccepted) {
      setAddError(t.termsRequired);
      return;
    }
    setSubmitting(true);
    setAddError(null);
    try {
      const { paymentMethod, error: pmError } = await stripe.createPaymentMethod({
        type: 'card',
        card,
        billing_details: userName ? { name: userName } : undefined,
      });
      if (pmError || !paymentMethod || !paymentMethod.card) {
        setAddError(pmError?.message ?? t.addFailed);
        return;
      }

      const clientSecret = await createCardSetupIntent();
      const { setupIntent, error: confirmError } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: paymentMethod.id,
      });
      if (confirmError || !setupIntent) {
        setAddError(confirmError?.message ?? t.addFailed);
        return;
      }

      await addPaymentMethod({
        processorToken: paymentMethod.id,
        setupIntentId: setupIntent.id,
        brand: paymentMethod.card.brand,
        last4: paymentMethod.card.last4,
        expiryMonth: paymentMethod.card.exp_month,
        expiryYear: paymentMethod.card.exp_year,
      });
      setShowAddForm(false);
      setTermsAccepted(false);
      load();
    } catch (err: any) {
      setAddError(err?.response?.data?.message ?? t.addFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    setBusyId(id);
    setRowError(null);
    try {
      const updated = await setDefaultPaymentMethod(id);
      setCards((prev) => prev.map((c) => ({ ...c, isDefault: c.id === updated.id })));
    } catch {
      setRowError(t.loadFailed);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string, confirmed = false) => {
    setBusyId(id);
    setRowError(null);
    try {
      await removePaymentMethod(id, confirmed);
      setConfirmDeleteId(null);
      setCards((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setConfirmDeleteId(id);
      } else {
        setRowError(err?.response?.data?.message ?? t.deleteFailed);
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-6 space-y-4">
      <div>
        <h2 className="text-sm font-bold mb-1 flex items-center gap-2">
          <CreditCard className="w-4 h-4" /> {t.title}
        </h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-500" />
          {t.hint}
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">…</p>
      ) : loadError ? (
        <p className="text-xs text-red-600 dark:text-red-400">{loadError}</p>
      ) : cards.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{t.noCards}</p>
      ) : (
        <div className="space-y-2">
          {cards.map((card) => (
            <div key={card.id}>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 shrink-0">
                    {card.brand.slice(0, 4)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {brandLabel(card.brand)} •••• {card.last4}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t.expires} {String(card.expiryMonth).padStart(2, '0')}/{card.expiryYear}
                    </p>
                  </div>
                  {card.isDefault && (
                    <span className="shrink-0 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30">
                      {t.default}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!card.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(card.id)}
                      disabled={busyId === card.id}
                      className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline bg-transparent border-none cursor-pointer disabled:opacity-50"
                    >
                      {busyId === card.id ? t.settingDefault : t.setDefault}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => (confirmDeleteId === card.id ? handleDelete(card.id, true) : handleDelete(card.id))}
                    disabled={busyId === card.id}
                    className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline bg-transparent border-none cursor-pointer disabled:opacity-50"
                  >
                    {busyId === card.id ? t.deleting : t.delete}
                  </button>
                </div>
              </div>
              {confirmDeleteId === card.id && (
                <div className="mt-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
                  <p className="mb-2">{t.deleteConfirmAutoRenew}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(card.id, true)}
                      className="text-[11px] font-bold text-white bg-red-600 px-3 py-1.5 rounded-lg border-none cursor-pointer hover:bg-red-700"
                    >
                      {t.confirmDeleteYes}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-[11px] font-bold text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent cursor-pointer"
                    >
                      {t.confirmDeleteNo}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {rowError && <p className="text-xs text-red-600 dark:text-red-400">{rowError}</p>}

      {showAddForm ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
          <div className="relative">
            <div
              ref={elementRef}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/60 px-3.5 py-3 min-h-[42px]"
            />
            {!cardElementReady && !stripeInitError && (
              <div className="absolute inset-0 flex items-center gap-2 px-3.5 rounded-lg bg-white dark:bg-slate-800/60 pointer-events-none">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 dark:border-slate-600 border-t-cyan-500 animate-spin" />
                <span className="text-xs text-slate-400 dark:text-slate-500">{t.initializingCard}</span>
              </div>
            )}
          </div>
          {stripeInitError && <p className="text-xs text-red-600 dark:text-red-400">{stripeInitError}</p>}
          {addError && <p className="text-xs text-red-600 dark:text-red-400">{addError}</p>}

          <label className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 shrink-0"
            />
            <span>
              {t.termsPrefix}{' '}
              <Link href="/terms" target="_blank" className="font-bold text-cyan-600 dark:text-cyan-400 hover:underline">
                {t.termsLink}
              </Link>
            </span>
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddCard}
              disabled={submitting || !cardElementReady || !termsAccepted}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white disabled:opacity-60"
            >
              {submitting && <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
              {submitting ? t.saving : t.saveCard}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setAddError(null);
                setTermsAccepted(false);
              }}
              disabled={submitting}
              className="text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-60"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
        >
          <Plus className="w-3.5 h-3.5" /> {t.addCard}
        </button>
      )}

      {bankTransfer && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowBankTransfer((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 bg-transparent border-none cursor-pointer p-0"
          >
            <Landmark className="w-3.5 h-3.5" /> {t.bankTransferToggle}
          </button>
          {showBankTransfer && (
            <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/40 px-4 py-3 space-y-1.5">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">{t.bankTransferHint}</p>
              <div className="text-xs flex items-center justify-between gap-3">
                <span className="text-slate-500 dark:text-slate-400">{t.bankTransferIban}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{bankTransfer.iban}</span>
              </div>
              {bankTransfer.bankName && (
                <div className="text-xs flex items-center justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">{t.bankTransferBank}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{bankTransfer.bankName}</span>
                </div>
              )}
              {bankTransfer.accountName && (
                <div className="text-xs flex items-center justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">{t.bankTransferAccountName}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{bankTransfer.accountName}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
