import { useState, useEffect, useCallback, useMemo, FormEvent } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  LayoutDashboard,
  GraduationCap,
  Wallet,
  Briefcase,
  Settings,
  LogOut,
  LifeBuoy,
  CheckCircle2,
  Wifi,
  Download,
  CalendarClock,
  Award,
  Bot,
  Sparkles,
  Mail,
  Users,
  Crown,
  Video,
  Store,
  Receipt,
} from 'lucide-react';
import ProtectedRoute from '../src/components/auth/ProtectedRoute';
import SiteHeader from '../src/components/layout/SiteHeader';
import SiteFooter from '../src/components/layout/SiteFooter';
import LaunchKitDrawer from '../src/components/admin/LaunchKitDrawer';
import AiMarketingAssistantDrawer from '../src/components/dashboard/AiMarketingAssistantDrawer';
import MyPurchasesPanel, { purchasedBooks } from '../src/components/dashboard/MyPurchasesPanel';
import { listMyBooks, BookListItem } from '../src/services/childrensBookService';
import { useAuth } from '../src/context/AuthContext';
import { MyCourseWithProgress } from '../src/types/lms';
import { getMyCourses, downloadCertificate } from '../src/services/courseService';
import { AssignedGig, GigStatus } from '../src/types/community';
import { getAssignedGigs, requestMentorHelp } from '../src/services/gigService';
import { getTrainerMe } from '../src/services/trainerWorkspaceService';
import { getFeeSchedule, findRate } from '../src/services/commissionsService';
import { useEscapeToClose } from '../src/hooks/useEscapeToClose';
import {
  getWalletSummary,
  getMyPayoutRequests,
  createPayoutRequest,
  WalletSummary,
  PayoutRequestRow,
} from '../src/services/walletService';
import { getMyPayments, downloadInvoice, MyPaymentRow } from '../src/services/paymentService';
import { createMentorshipRequest } from '../src/services/mentorshipService';
import {
  getProducts,
  getProductDownload,
  submitProduct,
  updateMyProduct,
  getMySubmissions,
  uploadMyProductImage,
  uploadMyProductFile,
  uploadMyProductVideo,
  DigitalProduct,
  ProductLicenseType,
  LICENSE_LABELS,
  validateProductDiscount,
} from '../src/services/productService';
import RichTextEditor from '../src/components/shared/RichTextEditor';
import FileDropzone from '../src/components/shared/FileDropzone';
import ImageGalleryUploader from '../src/components/shared/ImageGalleryUploader';
import VideoTutorialLink from '../src/components/shared/VideoTutorialLink';
import { assetFilenameFromUrl } from '../src/utils/assetFilename';
import { User } from '../src/types/auth';
import { resolveLocale } from '@/src/utils/locale';
import { DIGITAL_PRODUCT_CATEGORIES } from '../src/data/digitalProductCategories';

const PRODUCT_ASSET_ACCEPT = '.zip,.pdf,.epub,.rar,.7z,.fig,.sketch,.psd,.ai,.doc,.docx,.mp4,.mov';

type Tab = 'overview' | 'purchases' | 'courses' | 'wallet' | 'gigs' | 'products';

const dict = {
  ka: {
    title: 'პირადი კაბინეტი',
    tabOverview: 'მიმოხილვა',
    tabCourses: 'ჩემი კურსები',
    tabWallet: 'საფულე',
    tabGigs: 'ჩემი პროექტები',
    tabProducts: 'ჩემი ციფრული პროდუქტები',
    tabSettings: 'პარამეტრები',
    tabMentorshipSessions: 'მენტორის სესიები',
    mentorWorkspace: 'მენტორის პანელი',
    logout: 'გასვლა',
    loading: 'იტვირთება…',
    // Overview
    statCourses: 'ჩარიცხული კურსები',
    statWallet: 'საფულის ბალანსი',
    statGigs: 'აქტიური შეკვეთები',
    statCerts: 'მიღებული სერტიფიკატები',
    aiTutorTitle: 'AI კურსის რეპეტიტორი',
    aiTutorDesc: 'გაქვთ შეკითხვა გაკვეთილთან დაკავშირებით? AI რეპეტიტორი ხელმისაწვდომია პირდაპირ გაკვეთილის გვერდზე.',
    aiTutorCta: 'გაგრძელება რეპეტიტორთან ერთად',
    progressTitle: 'კურსის პროგრესი',
    noCourses: 'თქვენ ჯერ არცერთ კურსზე არ ხართ ჩარიცხული.',
    browseCourses: 'კურსების დათვალიერება',
    unlockLearnerTitle: 'სწავლის გაგრძელება',
    unlockLearnerDesc: 'გააგრძელეთ იქიდან, სადაც გაჩერდით.',
    unlockFreelancerTitle: 'ფრილანსის შესაძლებლობები',
    unlockFreelancerDesc: 'დაათვალიერეთ შეკვეთები და განავითარეთ ფრილანსერული კარიერა.',
    unlockCta: 'გადასვლა →',
    digitalStoreTitle: 'ციფრული მაღაზია',
    digitalStoreDesc: 'განათავსე შენი ციფრული პროდუქტები უფასოდ, გამოიყენე AI Launch Kit და გაზარდე გაყიდვები.',
    digitalStoreCta: 'პროდუქტის დამატება →',
    // Courses tab
    coursesTitle: 'ჩემი კურსები & სერტიფიკატები',
    viewAllCertificates: 'ყველა სერტიფიკატი',
    progress: 'პროგრესი',
    continue: 'გაგრძელება',
    downloadCert: 'სერტიფიკატის ჩამოტვირთვა',
    generating: 'გენერირდება…',
    certLocked: 'სერტიფიკატი ხელმისაწვდომი იქნება კურსის დასრულების შემდეგ',
    // Wallet tab
    walletTitle: 'საფულე & გადახდები',
    availableBalance: 'ხელმისაწვდომი ბალანსი',
    escrowBalance: 'ესქროუში დაბლოკილი თანხა',
    requestPayout: 'გატანის მოთხოვნა',
    amount: 'თანხა (₾)',
    iban: 'IBAN',
    ibanHint: 'ცარიელი დატოვების შემთხვევაში გამოყენებული იქნება პარამეტრებში შენახული IBAN.',
    submit: 'მოთხოვნის გაგზავნა',
    submitting: 'იგზავნება…',
    payoutHistory: 'გატანების ისტორია',
    noPayouts: 'გატანის მოთხოვნები ჯერ არ არის.',
    paymentHistory: 'გადახდების ისტორია',
    noPayments: 'გადახდები ჯერ არ არის.',
    paymentPurpose: { COURSE: 'კურსი', MENTORSHIP: 'მენტორობა', GIG_ESCROW_FUNDING: 'შეკვეთის დაფინანსება', PRODUCT: 'ციფრული პროდუქტი' } as Record<string, string>,
    // Gigs tab
    gigsTitle: 'ჩემი შეკვეთები / სამუშაო სივრცე',
    noGigs: 'თქვენ ჯერ არცერთ შეკვეთაზე არ ხართ დანიშნული.',
    browseGigs: 'შეკვეთების დათვალიერება',
    budget: 'ბიუჯეტი',
    chat: 'ჩატი დამკვეთთან',
    mentorHelp: 'CDC მენტორის დახმარების მოთხოვნა',
    mentorRequested: 'მენტორის დახმარება მოთხოვნილია',
    firstOrderBadge: 'პირველი შეკვეთა',
    // Products tab
    productsTitle: 'ჩემი ციფრული პროდუქტები',
    noProducts: 'თქვენ ჯერ არცერთი ციფრული პროდუქტი არ გაქვთ შეძენილი.',
    browseProducts: 'მაღაზიის დათვალიერება',
    downloadProduct: 'ჩამოტვირთვა',
    downloadFailed: 'ჩამოტვირთვა ვერ მოხერხდა.',
    invoiceDownloadFailed: 'ინვოისის ჩამოტვირთვა ვერ მოხერხდა.',
    downloadInvoiceLabel: 'ინვოისი',
    submitProductFailed: 'გაგზავნა ვერ მოხერხდა.',
    addProduct: 'ციფრული პროდუქტის დამატება',
    submitProductTitle: 'ახალი პროდუქტის გაგზავნა (განსახილველად)',
    formTitle: 'სათაური',
    formDescription: 'აღწერა',
    formPrice: 'ფასი (GEL, 0 = უფასო)',
    commissionBannerText: 'პლატფორმის საკომისიო შეადგენს {{rate}}%-ს საბანკო ტრანზაქციების მომსახურების საკომისიოს ჩათვლით.',
    commissionBannerNet: 'თქვენი წილი: {{amount}} GEL',
    formCategory: 'კატეგორია',
    formCoverImage: 'მთავარი ფოტო (გარეკანი)',
    formCoverHint: 'დააჭირეთ ან ჩააგდეთ სურათი აქ',
    formCoverSizeHint: 'ოპტიმალური ზომა: 2000 × 1500 px (4:3 თანაფარდობა). PNG/JPG, მაქს. 10MB.',
    formGalleryLabel: 'დამატებითი სქრინშოთები',
    formGallerySizeHint: 'ატვირთეთ მაქს. 4 სურათი (ოპტიმალური ზომა: 2000 × 1500 px, 4:3).',
    formGalleryAdd: 'დამატება',
    formUploading: 'იტვირთება…',
    formRemove: 'წაშლა',
    formAssetLabel: 'ჩამოსატვირთი ფაილი',
    formAssetHint: 'ZIP, PDF, EPUB, RAR, 7Z, FIG, SKETCH, PSD, AI, DOC, DOCX, MP4 ან MOV — მაქს. 200MB',
    formAssetHintEditing: 'ატვირთეთ ახალი ფაილი მხოლოდ იმ შემთხვევაში, თუ გსურთ მისი შეცვლა — წინააღმდეგ შემთხვევაში არსებული ფაილი უცვლელი დარჩება.',
    imageUploadFailed: 'სურათის ატვირთვა ვერ მოხერხდა.',
    fileUploadFailed: 'ფაილის ატვირთვა ვერ მოხერხდა.',
    formSubmit: 'გაგზავნა',
    formSubmitting: 'იგზავნება…',
    formCancel: 'გაუქმება',
    mySubmissionsTitle: 'ჩემი გაგზავნილი პროდუქტები',
    statusPending: 'განხილვაშია',
    statusApproved: 'გამოქვეყნებული',
    statusRejected: 'უარყოფილი',
    statusNeedsRevision: 'საჭიროებს ცვლილებას',
    rejectionReasonLabel: 'მიზეზი',
    editAndResubmit: 'რედაქტირება და ხელახლა გაგზავნა',
    editSubmissionTitle: 'პროდუქტის რედაქტირება',
    formResubmit: 'ხელახლა გაგზავნა',
    // Confirm modal (shared with learn.tsx)
    confirmTitle: 'გთხოვთ შეამოწმოთ!',
    confirmBody: 'სერტიფიკატზე დაიბეჭდება სახელი და გვარი:',
    confirmChangeHint: 'თუ გსურთ სახელის შეცვლა, გადადით პროფილის პარამეტრებში.',
    confirmDownload: 'დადასტურება და ჩამოტვირთვა',
    confirmChangeName: 'სახელის შეცვლა (პროფილში გადასვლა)',
    confirmCancel: 'გაუქმება',
    certDownloadFailed: 'სერტიფიკატის გენერირება ვერ მოხერხდა. სცადეთ თავიდან.',
    certLimitTitle: 'სერტიფიკატი უკვე ჩამოტვირთულია',
    certLimitMessage:
      'სერტიფიკატის განმეორებით ჩამოტვირთვისთვის ან მონაცემების შესაცვლელად, გთხოვთ დაუკავშირდეთ მხარდაჭერის გუნდს ელფოსტაზე: contact@cdc.org.ge',
    certLimitClose: 'დახურვა',
    certLimitContactEmail: 'contact@cdc.org.ge',
    // Post quota (non-graduates)
    statPostsLeft: 'დარჩენილი პოსტები (ამ თვეში)',
    postsLeftValue: 'დარჩენილი გაქვთ 3-დან {{remaining}} პოსტი ამ თვეში',
    // Freelancer skill verification exam
    examTitle: 'უნარების ვერიფიკაცია / გამოცდა',
    examPendingBody: 'გაიარეთ ტესტირება ფრილანსერის სტატუსის გასააქტიურებლად',
    examStart: 'ტესტირების დაწყება',
    examVerifiedBadge: 'ვერიფიცირებული ფრილანსერი ✅',
    // Mentorship request (graduates only)
    mentorshipButton: 'დახმარება / მენტორობა',
    mentorshipModalTitle: 'დახმარების მოთხოვნა',
    mentorshipModalHint: 'აღწერეთ რაში გჭირდებათ დახმარება (შეკვეთა ან სხვა) — CDC მენტორი მალე დაგიკავშირდებათ.',
    mentorshipPlaceholder: 'მაგ: დახმარება მჭირდება მიმდინარე შეკვეთის ტექნიკურ ნაწილში...',
    mentorshipSubmit: 'გაგზავნა',
    mentorshipSubmitting: 'იგზავნება…',
    mentorshipSentTitle: 'მოთხოვნა გაგზავნილია!',
    mentorshipSentBody: 'CDC მენტორი მალე დაგიკავშირდებათ.',
    mentorshipClose: 'დახურვა',
    mentorshipError: 'მოთხოვნის გაგზავნა ვერ მოხერხდა.',
  },
  en: {
    title: 'Dashboard',
    tabOverview: 'Overview',
    tabCourses: 'My Courses & Certificates',
    tabWallet: 'Wallet & Payouts',
    tabGigs: 'My Projects / Workspace',
    tabProducts: 'My Digital Products',
    tabSettings: 'Account Settings',
    tabMentorshipSessions: 'Mentorship Sessions',
    mentorWorkspace: 'Mentor Workspace',
    logout: 'Log Out',
    loading: 'Loading…',
    statCourses: 'Enrolled Courses',
    statWallet: 'Wallet Balance',
    statGigs: 'Active Gigs',
    statCerts: 'Certificates Earned',
    aiTutorTitle: 'AI Course Tutor',
    aiTutorDesc: 'Have a question about a lesson? Your AI Tutor is available right on the lesson page.',
    aiTutorCta: 'Continue with your Tutor',
    progressTitle: 'Course Progress',
    noCourses: "You're not enrolled in any courses yet.",
    browseCourses: 'Browse Courses',
    unlockLearnerTitle: 'Continue Learning',
    unlockLearnerDesc: 'Pick up where you left off in your courses.',
    unlockFreelancerTitle: 'Explore Freelancing',
    unlockFreelancerDesc: 'Browse gigs and grow your freelance career.',
    unlockCta: 'Go →',
    digitalStoreTitle: 'Digital Store',
    digitalStoreDesc: 'List your digital products for free, use the AI Launch Kit, and grow your sales.',
    digitalStoreCta: 'Add a Product →',
    coursesTitle: 'My Courses & Certificates',
    viewAllCertificates: 'View all certificates',
    progress: 'Progress',
    continue: 'Continue',
    downloadCert: 'Download Certificate',
    generating: 'Generating…',
    certLocked: 'The certificate unlocks once the course is complete.',
    walletTitle: 'Wallet & Payouts',
    availableBalance: 'Available Balance',
    escrowBalance: 'Held in Escrow',
    requestPayout: 'Request a Payout',
    amount: 'Amount (₾)',
    iban: 'IBAN',
    ibanHint: 'Leave blank to use the IBAN saved in your account settings.',
    submit: 'Submit Request',
    submitting: 'Submitting…',
    payoutHistory: 'Payout History',
    noPayouts: 'No payout requests yet.',
    paymentHistory: 'Payment History',
    noPayments: 'No payments yet.',
    paymentPurpose: { COURSE: 'Course', MENTORSHIP: 'Mentorship', GIG_ESCROW_FUNDING: 'Gig Funding', PRODUCT: 'Digital Product' } as Record<string, string>,
    gigsTitle: 'My Gigs / Workspace',
    noGigs: "You're not assigned to any gigs yet.",
    browseGigs: 'Browse Gigs',
    budget: 'Budget',
    chat: 'Chat with client',
    mentorHelp: 'Request CDC Mentor Help',
    mentorRequested: 'Mentor help requested',
    firstOrderBadge: 'First Order',
    productsTitle: 'My Digital Products',
    noProducts: "You haven't purchased any digital products yet.",
    browseProducts: 'Browse Store',
    downloadProduct: 'Download',
    downloadFailed: 'Download failed.',
    invoiceDownloadFailed: 'Unable to download the invoice.',
    downloadInvoiceLabel: 'Invoice',
    submitProductFailed: 'Submission failed.',
    addProduct: 'Add Digital Product',
    submitProductTitle: 'Submit New Product (for review)',
    formTitle: 'Title',
    formDescription: 'Description',
    formPrice: 'Price (GEL, 0 = free)',
    commissionBannerText: 'The platform fee is {{rate}}%, including bank transaction processing fees.',
    commissionBannerNet: 'Your share: {{amount}} GEL',
    formCategory: 'Category',
    formCoverImage: 'Main Cover Image',
    formCoverHint: 'Click or drop an image here',
    formCoverSizeHint: 'Optimal Cover Size: 2000 × 1500 px (4:3 ratio). PNG/JPG, up to 10MB.',
    formGalleryLabel: 'Additional Screenshots',
    formGallerySizeHint: 'Upload up to 15 preview images (Optimal Size: 2000 × 1500 px, 4:3 ratio).',
    formGalleryAdd: 'Add',
    formUploading: 'Uploading…',
    formRemove: 'Remove',
    formAssetLabel: 'Downloadable File',
    formAssetHint: 'ZIP, PDF, EPUB, RAR, 7Z, FIG, SKETCH, PSD, AI, DOC, DOCX, MP4, or MOV — up to 200MB',
    formAssetHintEditing: 'Only upload a new file if you want to replace it — otherwise the existing file stays unchanged.',
    imageUploadFailed: 'Image upload failed.',
    fileUploadFailed: 'File upload failed.',
    formSubmit: 'Submit',
    formSubmitting: 'Submitting…',
    formCancel: 'Cancel',
    mySubmissionsTitle: 'My Submissions',
    statusPending: 'Pending Review',
    statusApproved: 'Published',
    statusRejected: 'Rejected',
    statusNeedsRevision: 'Needs Revision',
    rejectionReasonLabel: 'Reason',
    editAndResubmit: 'Edit & Resubmit',
    editSubmissionTitle: 'Edit Product',
    formResubmit: 'Resubmit',
    confirmTitle: 'Please double-check!',
    confirmBody: 'This name will be printed on your certificate:',
    confirmChangeHint: 'To change it, go to your account settings.',
    confirmDownload: 'Confirm & Download',
    confirmChangeName: 'Change Name (Go to Settings)',
    confirmCancel: 'Cancel',
    certDownloadFailed: 'Unable to generate the certificate. Please try again.',
    certLimitTitle: 'Certificate Already Downloaded',
    certLimitMessage:
      'To re-download your certificate or update its details, please contact our support team at: contact@cdc.org.ge',
    certLimitClose: 'Close',
    certLimitContactEmail: 'contact@cdc.org.ge',
    statPostsLeft: 'Forum posts left (this month)',
    postsLeftValue: 'You have {{remaining}} of 3 posts left this month',
    examTitle: 'Skill Verification / Exam',
    examPendingBody: 'Take the exam to activate your freelancer status',
    examStart: 'Start Exam',
    examVerifiedBadge: 'Verified Freelancer ✅',
    mentorshipButton: 'Help / Mentorship',
    mentorshipModalTitle: 'Request Help',
    mentorshipModalHint: 'Describe what you need help with (an order, a gig, or anything else) — a CDC mentor will reach out soon.',
    mentorshipPlaceholder: 'e.g. I need help with the technical side of my current gig...',
    mentorshipSubmit: 'Send',
    mentorshipSubmitting: 'Sending…',
    mentorshipSentTitle: 'Request sent!',
    mentorshipSentBody: 'A CDC mentor will reach out to you soon.',
    mentorshipClose: 'Close',
    mentorshipError: 'Unable to send the request.',
  },
  de: {
    title: 'Dashboard',
    tabOverview: 'Overview',
    tabCourses: 'My Courses & Certificates',
    tabWallet: 'Wallet & Payouts',
    tabGigs: 'My Projects / Workspace',
    tabProducts: 'My Digital Products',
    tabSettings: 'Account Settings',
    tabMentorshipSessions: 'Mentorship Sessions',
    mentorWorkspace: 'Mentor Workspace',
    logout: 'Log Out',
    loading: 'Loading…',
    statCourses: 'Enrolled Courses',
    statWallet: 'Wallet Balance',
    statGigs: 'Active Gigs',
    statCerts: 'Certificates Earned',
    aiTutorTitle: 'AI Course Tutor',
    aiTutorDesc: 'Have a question about a lesson? Your AI Tutor is available right on the lesson page.',
    aiTutorCta: 'Continue with your Tutor',
    progressTitle: 'Course Progress',
    noCourses: "You're not enrolled in any courses yet.",
    browseCourses: 'Browse Courses',
    unlockLearnerTitle: 'Continue Learning',
    unlockLearnerDesc: 'Pick up where you left off in your courses.',
    unlockFreelancerTitle: 'Explore Freelancing',
    unlockFreelancerDesc: 'Browse gigs and grow your freelance career.',
    unlockCta: 'Go →',
    digitalStoreTitle: 'Digital Store',
    digitalStoreDesc: 'List your digital products for free, use the AI Launch Kit, and grow your sales.',
    digitalStoreCta: 'Add a Product →',
    coursesTitle: 'My Courses & Certificates',
    viewAllCertificates: 'View all certificates',
    progress: 'Progress',
    continue: 'Continue',
    downloadCert: 'Download Certificate',
    generating: 'Generating…',
    certLocked: 'The certificate unlocks once the course is complete.',
    walletTitle: 'Wallet & Payouts',
    availableBalance: 'Available Balance',
    escrowBalance: 'Held in Escrow',
    requestPayout: 'Request a Payout',
    amount: 'Amount (₾)',
    iban: 'IBAN',
    ibanHint: 'Leave blank to use the IBAN saved in your account settings.',
    submit: 'Submit Request',
    submitting: 'Submitting…',
    payoutHistory: 'Payout History',
    noPayouts: 'No payout requests yet.',
    paymentHistory: 'Payment History',
    noPayments: 'No payments yet.',
    paymentPurpose: { COURSE: 'Course', MENTORSHIP: 'Mentorship', GIG_ESCROW_FUNDING: 'Gig Funding', PRODUCT: 'Digital Product' } as Record<string, string>,
    gigsTitle: 'My Gigs / Workspace',
    noGigs: "You're not assigned to any gigs yet.",
    browseGigs: 'Browse Gigs',
    budget: 'Budget',
    chat: 'Chat with client',
    mentorHelp: 'Request CDC Mentor Help',
    mentorRequested: 'Mentor help requested',
    firstOrderBadge: 'First Order',
    productsTitle: 'My Digital Products',
    noProducts: "You haven't purchased any digital products yet.",
    browseProducts: 'Browse Store',
    downloadProduct: 'Download',
    downloadFailed: 'Download failed.',
    invoiceDownloadFailed: 'Unable to download the invoice.',
    downloadInvoiceLabel: 'Invoice',
    submitProductFailed: 'Submission failed.',
    addProduct: 'Add Digital Product',
    submitProductTitle: 'Submit New Product (for review)',
    formTitle: 'Title',
    formDescription: 'Description',
    formPrice: 'Price (GEL, 0 = free)',
    commissionBannerText: 'The platform fee is {{rate}}%, including bank transaction processing fees.',
    commissionBannerNet: 'Your share: {{amount}} GEL',
    formCategory: 'Category',
    formCoverImage: 'Main Cover Image',
    formCoverHint: 'Click or drop an image here',
    formCoverSizeHint: 'Optimal Cover Size: 2000 × 1500 px (4:3 ratio). PNG/JPG, up to 10MB.',
    formGalleryLabel: 'Additional Screenshots',
    formGallerySizeHint: 'Upload up to 15 preview images (Optimal Size: 2000 × 1500 px, 4:3 ratio).',
    formGalleryAdd: 'Add',
    formUploading: 'Uploading…',
    formRemove: 'Remove',
    formAssetLabel: 'Downloadable File',
    formAssetHint: 'ZIP, PDF, EPUB, RAR, 7Z, FIG, SKETCH, PSD, AI, DOC, DOCX, MP4, or MOV — up to 200MB',
    formAssetHintEditing: 'Only upload a new file if you want to replace it — otherwise the existing file stays unchanged.',
    imageUploadFailed: 'Image upload failed.',
    fileUploadFailed: 'File upload failed.',
    formSubmit: 'Submit',
    formSubmitting: 'Submitting…',
    formCancel: 'Cancel',
    mySubmissionsTitle: 'My Submissions',
    statusPending: 'Pending Review',
    statusApproved: 'Published',
    statusRejected: 'Rejected',
    statusNeedsRevision: 'Needs Revision',
    rejectionReasonLabel: 'Reason',
    editAndResubmit: 'Edit & Resubmit',
    editSubmissionTitle: 'Edit Product',
    formResubmit: 'Resubmit',
    confirmTitle: 'Please double-check!',
    confirmBody: 'This name will be printed on your certificate:',
    confirmChangeHint: 'To change it, go to your account settings.',
    confirmDownload: 'Confirm & Download',
    confirmChangeName: 'Change Name (Go to Settings)',
    confirmCancel: 'Cancel',
    certDownloadFailed: 'Unable to generate the certificate. Please try again.',
    certLimitTitle: 'Certificate Already Downloaded',
    certLimitMessage:
      'To re-download your certificate or update its details, please contact our support team at: contact@cdc.org.ge',
    certLimitClose: 'Close',
    certLimitContactEmail: 'contact@cdc.org.ge',
    statPostsLeft: 'Forum posts left (this month)',
    postsLeftValue: 'You have {{remaining}} of 3 posts left this month',
    examTitle: 'Skill Verification / Exam',
    examPendingBody: 'Take the exam to activate your freelancer status',
    examStart: 'Start Exam',
    examVerifiedBadge: 'Verified Freelancer ✅',
    mentorshipButton: 'Help / Mentorship',
    mentorshipModalTitle: 'Request Help',
    mentorshipModalHint: 'Describe what you need help with (an order, a gig, or anything else) — a CDC mentor will reach out soon.',
    mentorshipPlaceholder: 'e.g. I need help with the technical side of my current gig...',
    mentorshipSubmit: 'Send',
    mentorshipSubmitting: 'Sending…',
    mentorshipSentTitle: 'Request sent!',
    mentorshipSentBody: 'A CDC mentor will reach out to you soon.',
    mentorshipClose: 'Close',
    mentorshipError: 'Unable to send the request.',
  },
  es: {
    title: 'Dashboard',
    tabOverview: 'Overview',
    tabCourses: 'My Courses & Certificates',
    tabWallet: 'Wallet & Payouts',
    tabGigs: 'My Projects / Workspace',
    tabProducts: 'My Digital Products',
    tabSettings: 'Account Settings',
    tabMentorshipSessions: 'Mentorship Sessions',
    mentorWorkspace: 'Mentor Workspace',
    logout: 'Log Out',
    loading: 'Loading…',
    statCourses: 'Enrolled Courses',
    statWallet: 'Wallet Balance',
    statGigs: 'Active Gigs',
    statCerts: 'Certificates Earned',
    aiTutorTitle: 'AI Course Tutor',
    aiTutorDesc: 'Have a question about a lesson? Your AI Tutor is available right on the lesson page.',
    aiTutorCta: 'Continue with your Tutor',
    progressTitle: 'Course Progress',
    noCourses: "You're not enrolled in any courses yet.",
    browseCourses: 'Browse Courses',
    unlockLearnerTitle: 'Continue Learning',
    unlockLearnerDesc: 'Pick up where you left off in your courses.',
    unlockFreelancerTitle: 'Explore Freelancing',
    unlockFreelancerDesc: 'Browse gigs and grow your freelance career.',
    unlockCta: 'Go →',
    digitalStoreTitle: 'Digital Store',
    digitalStoreDesc: 'List your digital products for free, use the AI Launch Kit, and grow your sales.',
    digitalStoreCta: 'Add a Product →',
    coursesTitle: 'My Courses & Certificates',
    viewAllCertificates: 'View all certificates',
    progress: 'Progress',
    continue: 'Continue',
    downloadCert: 'Download Certificate',
    generating: 'Generating…',
    certLocked: 'The certificate unlocks once the course is complete.',
    walletTitle: 'Wallet & Payouts',
    availableBalance: 'Available Balance',
    escrowBalance: 'Held in Escrow',
    requestPayout: 'Request a Payout',
    amount: 'Amount (₾)',
    iban: 'IBAN',
    ibanHint: 'Leave blank to use the IBAN saved in your account settings.',
    submit: 'Submit Request',
    submitting: 'Submitting…',
    payoutHistory: 'Payout History',
    noPayouts: 'No payout requests yet.',
    paymentHistory: 'Payment History',
    noPayments: 'No payments yet.',
    paymentPurpose: { COURSE: 'Course', MENTORSHIP: 'Mentorship', GIG_ESCROW_FUNDING: 'Gig Funding', PRODUCT: 'Digital Product' } as Record<string, string>,
    gigsTitle: 'My Gigs / Workspace',
    noGigs: "You're not assigned to any gigs yet.",
    browseGigs: 'Browse Gigs',
    budget: 'Budget',
    chat: 'Chat with client',
    mentorHelp: 'Request CDC Mentor Help',
    mentorRequested: 'Mentor help requested',
    firstOrderBadge: 'First Order',
    productsTitle: 'My Digital Products',
    noProducts: "You haven't purchased any digital products yet.",
    browseProducts: 'Browse Store',
    downloadProduct: 'Download',
    downloadFailed: 'Download failed.',
    invoiceDownloadFailed: 'Unable to download the invoice.',
    downloadInvoiceLabel: 'Invoice',
    submitProductFailed: 'Submission failed.',
    addProduct: 'Add Digital Product',
    submitProductTitle: 'Submit New Product (for review)',
    formTitle: 'Title',
    formDescription: 'Description',
    formPrice: 'Price (GEL, 0 = free)',
    commissionBannerText: 'The platform fee is {{rate}}%, including bank transaction processing fees.',
    commissionBannerNet: 'Your share: {{amount}} GEL',
    formCategory: 'Category',
    formCoverImage: 'Main Cover Image',
    formCoverHint: 'Click or drop an image here',
    formCoverSizeHint: 'Optimal Cover Size: 2000 × 1500 px (4:3 ratio). PNG/JPG, up to 10MB.',
    formGalleryLabel: 'Additional Screenshots',
    formGallerySizeHint: 'Upload up to 15 preview images (Optimal Size: 2000 × 1500 px, 4:3 ratio).',
    formGalleryAdd: 'Add',
    formUploading: 'Uploading…',
    formRemove: 'Remove',
    formAssetLabel: 'Downloadable File',
    formAssetHint: 'ZIP, PDF, EPUB, RAR, 7Z, FIG, SKETCH, PSD, AI, DOC, DOCX, MP4, or MOV — up to 200MB',
    formAssetHintEditing: 'Only upload a new file if you want to replace it — otherwise the existing file stays unchanged.',
    imageUploadFailed: 'Image upload failed.',
    fileUploadFailed: 'File upload failed.',
    formSubmit: 'Submit',
    formSubmitting: 'Submitting…',
    formCancel: 'Cancel',
    mySubmissionsTitle: 'My Submissions',
    statusPending: 'Pending Review',
    statusApproved: 'Published',
    statusRejected: 'Rejected',
    statusNeedsRevision: 'Needs Revision',
    rejectionReasonLabel: 'Reason',
    editAndResubmit: 'Edit & Resubmit',
    editSubmissionTitle: 'Edit Product',
    formResubmit: 'Resubmit',
    confirmTitle: 'Please double-check!',
    confirmBody: 'This name will be printed on your certificate:',
    confirmChangeHint: 'To change it, go to your account settings.',
    confirmDownload: 'Confirm & Download',
    confirmChangeName: 'Change Name (Go to Settings)',
    confirmCancel: 'Cancel',
    certDownloadFailed: 'Unable to generate the certificate. Please try again.',
    certLimitTitle: 'Certificate Already Downloaded',
    certLimitMessage:
      'To re-download your certificate or update its details, please contact our support team at: contact@cdc.org.ge',
    certLimitClose: 'Close',
    certLimitContactEmail: 'contact@cdc.org.ge',
    statPostsLeft: 'Forum posts left (this month)',
    postsLeftValue: 'You have {{remaining}} of 3 posts left this month',
    examTitle: 'Skill Verification / Exam',
    examPendingBody: 'Take the exam to activate your freelancer status',
    examStart: 'Start Exam',
    examVerifiedBadge: 'Verified Freelancer ✅',
    mentorshipButton: 'Help / Mentorship',
    mentorshipModalTitle: 'Request Help',
    mentorshipModalHint: 'Describe what you need help with (an order, a gig, or anything else) — a CDC mentor will reach out soon.',
    mentorshipPlaceholder: 'e.g. I need help with the technical side of my current gig...',
    mentorshipSubmit: 'Send',
    mentorshipSubmitting: 'Sending…',
    mentorshipSentTitle: 'Request sent!',
    mentorshipSentBody: 'A CDC mentor will reach out to you soon.',
    mentorshipClose: 'Close',
    mentorshipError: 'Unable to send the request.',
  },
  fr: {
    title: 'Dashboard',
    tabOverview: 'Overview',
    tabCourses: 'My Courses & Certificates',
    tabWallet: 'Wallet & Payouts',
    tabGigs: 'My Projects / Workspace',
    tabProducts: 'My Digital Products',
    tabSettings: 'Account Settings',
    tabMentorshipSessions: 'Mentorship Sessions',
    mentorWorkspace: 'Mentor Workspace',
    logout: 'Log Out',
    loading: 'Loading…',
    statCourses: 'Enrolled Courses',
    statWallet: 'Wallet Balance',
    statGigs: 'Active Gigs',
    statCerts: 'Certificates Earned',
    aiTutorTitle: 'AI Course Tutor',
    aiTutorDesc: 'Have a question about a lesson? Your AI Tutor is available right on the lesson page.',
    aiTutorCta: 'Continue with your Tutor',
    progressTitle: 'Course Progress',
    noCourses: "You're not enrolled in any courses yet.",
    browseCourses: 'Browse Courses',
    unlockLearnerTitle: 'Continue Learning',
    unlockLearnerDesc: 'Pick up where you left off in your courses.',
    unlockFreelancerTitle: 'Explore Freelancing',
    unlockFreelancerDesc: 'Browse gigs and grow your freelance career.',
    unlockCta: 'Go →',
    digitalStoreTitle: 'Digital Store',
    digitalStoreDesc: 'List your digital products for free, use the AI Launch Kit, and grow your sales.',
    digitalStoreCta: 'Add a Product →',
    coursesTitle: 'My Courses & Certificates',
    viewAllCertificates: 'View all certificates',
    progress: 'Progress',
    continue: 'Continue',
    downloadCert: 'Download Certificate',
    generating: 'Generating…',
    certLocked: 'The certificate unlocks once the course is complete.',
    walletTitle: 'Wallet & Payouts',
    availableBalance: 'Available Balance',
    escrowBalance: 'Held in Escrow',
    requestPayout: 'Request a Payout',
    amount: 'Amount (₾)',
    iban: 'IBAN',
    ibanHint: 'Leave blank to use the IBAN saved in your account settings.',
    submit: 'Submit Request',
    submitting: 'Submitting…',
    payoutHistory: 'Payout History',
    noPayouts: 'No payout requests yet.',
    paymentHistory: 'Payment History',
    noPayments: 'No payments yet.',
    paymentPurpose: { COURSE: 'Course', MENTORSHIP: 'Mentorship', GIG_ESCROW_FUNDING: 'Gig Funding', PRODUCT: 'Digital Product' } as Record<string, string>,
    gigsTitle: 'My Gigs / Workspace',
    noGigs: "You're not assigned to any gigs yet.",
    browseGigs: 'Browse Gigs',
    budget: 'Budget',
    chat: 'Chat with client',
    mentorHelp: 'Request CDC Mentor Help',
    mentorRequested: 'Mentor help requested',
    firstOrderBadge: 'First Order',
    productsTitle: 'My Digital Products',
    noProducts: "You haven't purchased any digital products yet.",
    browseProducts: 'Browse Store',
    downloadProduct: 'Download',
    downloadFailed: 'Download failed.',
    invoiceDownloadFailed: 'Unable to download the invoice.',
    downloadInvoiceLabel: 'Invoice',
    submitProductFailed: 'Submission failed.',
    addProduct: 'Add Digital Product',
    submitProductTitle: 'Submit New Product (for review)',
    formTitle: 'Title',
    formDescription: 'Description',
    formPrice: 'Price (GEL, 0 = free)',
    commissionBannerText: 'The platform fee is {{rate}}%, including bank transaction processing fees.',
    commissionBannerNet: 'Your share: {{amount}} GEL',
    formCategory: 'Category',
    formCoverImage: 'Main Cover Image',
    formCoverHint: 'Click or drop an image here',
    formCoverSizeHint: 'Optimal Cover Size: 2000 × 1500 px (4:3 ratio). PNG/JPG, up to 10MB.',
    formGalleryLabel: 'Additional Screenshots',
    formGallerySizeHint: 'Upload up to 15 preview images (Optimal Size: 2000 × 1500 px, 4:3 ratio).',
    formGalleryAdd: 'Add',
    formUploading: 'Uploading…',
    formRemove: 'Remove',
    formAssetLabel: 'Downloadable File',
    formAssetHint: 'ZIP, PDF, EPUB, RAR, 7Z, FIG, SKETCH, PSD, AI, DOC, DOCX, MP4, or MOV — up to 200MB',
    formAssetHintEditing: 'Only upload a new file if you want to replace it — otherwise the existing file stays unchanged.',
    imageUploadFailed: 'Image upload failed.',
    fileUploadFailed: 'File upload failed.',
    formSubmit: 'Submit',
    formSubmitting: 'Submitting…',
    formCancel: 'Cancel',
    mySubmissionsTitle: 'My Submissions',
    statusPending: 'Pending Review',
    statusApproved: 'Published',
    statusRejected: 'Rejected',
    statusNeedsRevision: 'Needs Revision',
    rejectionReasonLabel: 'Reason',
    editAndResubmit: 'Edit & Resubmit',
    editSubmissionTitle: 'Edit Product',
    formResubmit: 'Resubmit',
    confirmTitle: 'Please double-check!',
    confirmBody: 'This name will be printed on your certificate:',
    confirmChangeHint: 'To change it, go to your account settings.',
    confirmDownload: 'Confirm & Download',
    confirmChangeName: 'Change Name (Go to Settings)',
    confirmCancel: 'Cancel',
    certDownloadFailed: 'Unable to generate the certificate. Please try again.',
    certLimitTitle: 'Certificate Already Downloaded',
    certLimitMessage:
      'To re-download your certificate or update its details, please contact our support team at: contact@cdc.org.ge',
    certLimitClose: 'Close',
    certLimitContactEmail: 'contact@cdc.org.ge',
    statPostsLeft: 'Forum posts left (this month)',
    postsLeftValue: 'You have {{remaining}} of 3 posts left this month',
    examTitle: 'Skill Verification / Exam',
    examPendingBody: 'Take the exam to activate your freelancer status',
    examStart: 'Start Exam',
    examVerifiedBadge: 'Verified Freelancer ✅',
    mentorshipButton: 'Help / Mentorship',
    mentorshipModalTitle: 'Request Help',
    mentorshipModalHint: 'Describe what you need help with (an order, a gig, or anything else) — a CDC mentor will reach out soon.',
    mentorshipPlaceholder: 'e.g. I need help with the technical side of my current gig...',
    mentorshipSubmit: 'Send',
    mentorshipSubmitting: 'Sending…',
    mentorshipSentTitle: 'Request sent!',
    mentorshipSentBody: 'A CDC mentor will reach out to you soon.',
    mentorshipClose: 'Close',
    mentorshipError: 'Unable to send the request.',
  },
  uk: {
    title: 'Dashboard',
    tabOverview: 'Overview',
    tabCourses: 'My Courses & Certificates',
    tabWallet: 'Wallet & Payouts',
    tabGigs: 'My Projects / Workspace',
    tabProducts: 'My Digital Products',
    tabSettings: 'Account Settings',
    tabMentorshipSessions: 'Mentorship Sessions',
    mentorWorkspace: 'Mentor Workspace',
    logout: 'Log Out',
    loading: 'Loading…',
    statCourses: 'Enrolled Courses',
    statWallet: 'Wallet Balance',
    statGigs: 'Active Gigs',
    statCerts: 'Certificates Earned',
    aiTutorTitle: 'AI Course Tutor',
    aiTutorDesc: 'Have a question about a lesson? Your AI Tutor is available right on the lesson page.',
    aiTutorCta: 'Continue with your Tutor',
    progressTitle: 'Course Progress',
    noCourses: "You're not enrolled in any courses yet.",
    browseCourses: 'Browse Courses',
    unlockLearnerTitle: 'Continue Learning',
    unlockLearnerDesc: 'Pick up where you left off in your courses.',
    unlockFreelancerTitle: 'Explore Freelancing',
    unlockFreelancerDesc: 'Browse gigs and grow your freelance career.',
    unlockCta: 'Go →',
    digitalStoreTitle: 'Digital Store',
    digitalStoreDesc: 'List your digital products for free, use the AI Launch Kit, and grow your sales.',
    digitalStoreCta: 'Add a Product →',
    coursesTitle: 'My Courses & Certificates',
    viewAllCertificates: 'View all certificates',
    progress: 'Progress',
    continue: 'Continue',
    downloadCert: 'Download Certificate',
    generating: 'Generating…',
    certLocked: 'The certificate unlocks once the course is complete.',
    walletTitle: 'Wallet & Payouts',
    availableBalance: 'Available Balance',
    escrowBalance: 'Held in Escrow',
    requestPayout: 'Request a Payout',
    amount: 'Amount (₾)',
    iban: 'IBAN',
    ibanHint: 'Leave blank to use the IBAN saved in your account settings.',
    submit: 'Submit Request',
    submitting: 'Submitting…',
    payoutHistory: 'Payout History',
    noPayouts: 'No payout requests yet.',
    paymentHistory: 'Payment History',
    noPayments: 'No payments yet.',
    paymentPurpose: { COURSE: 'Course', MENTORSHIP: 'Mentorship', GIG_ESCROW_FUNDING: 'Gig Funding', PRODUCT: 'Digital Product' } as Record<string, string>,
    gigsTitle: 'My Gigs / Workspace',
    noGigs: "You're not assigned to any gigs yet.",
    browseGigs: 'Browse Gigs',
    budget: 'Budget',
    chat: 'Chat with client',
    mentorHelp: 'Request CDC Mentor Help',
    mentorRequested: 'Mentor help requested',
    firstOrderBadge: 'First Order',
    productsTitle: 'My Digital Products',
    noProducts: "You haven't purchased any digital products yet.",
    browseProducts: 'Browse Store',
    downloadProduct: 'Download',
    downloadFailed: 'Download failed.',
    invoiceDownloadFailed: 'Unable to download the invoice.',
    downloadInvoiceLabel: 'Invoice',
    submitProductFailed: 'Submission failed.',
    addProduct: 'Add Digital Product',
    submitProductTitle: 'Submit New Product (for review)',
    formTitle: 'Title',
    formDescription: 'Description',
    formPrice: 'Price (GEL, 0 = free)',
    commissionBannerText: 'The platform fee is {{rate}}%, including bank transaction processing fees.',
    commissionBannerNet: 'Your share: {{amount}} GEL',
    formCategory: 'Category',
    formCoverImage: 'Main Cover Image',
    formCoverHint: 'Click or drop an image here',
    formCoverSizeHint: 'Optimal Cover Size: 2000 × 1500 px (4:3 ratio). PNG/JPG, up to 10MB.',
    formGalleryLabel: 'Additional Screenshots',
    formGallerySizeHint: 'Upload up to 15 preview images (Optimal Size: 2000 × 1500 px, 4:3 ratio).',
    formGalleryAdd: 'Add',
    formUploading: 'Uploading…',
    formRemove: 'Remove',
    formAssetLabel: 'Downloadable File',
    formAssetHint: 'ZIP, PDF, EPUB, RAR, 7Z, FIG, SKETCH, PSD, AI, DOC, DOCX, MP4, or MOV — up to 200MB',
    formAssetHintEditing: 'Only upload a new file if you want to replace it — otherwise the existing file stays unchanged.',
    imageUploadFailed: 'Image upload failed.',
    fileUploadFailed: 'File upload failed.',
    formSubmit: 'Submit',
    formSubmitting: 'Submitting…',
    formCancel: 'Cancel',
    mySubmissionsTitle: 'My Submissions',
    statusPending: 'Pending Review',
    statusApproved: 'Published',
    statusRejected: 'Rejected',
    statusNeedsRevision: 'Needs Revision',
    rejectionReasonLabel: 'Reason',
    editAndResubmit: 'Edit & Resubmit',
    editSubmissionTitle: 'Edit Product',
    formResubmit: 'Resubmit',
    confirmTitle: 'Please double-check!',
    confirmBody: 'This name will be printed on your certificate:',
    confirmChangeHint: 'To change it, go to your account settings.',
    confirmDownload: 'Confirm & Download',
    confirmChangeName: 'Change Name (Go to Settings)',
    confirmCancel: 'Cancel',
    certDownloadFailed: 'Unable to generate the certificate. Please try again.',
    certLimitTitle: 'Certificate Already Downloaded',
    certLimitMessage:
      'To re-download your certificate or update its details, please contact our support team at: contact@cdc.org.ge',
    certLimitClose: 'Close',
    certLimitContactEmail: 'contact@cdc.org.ge',
    statPostsLeft: 'Forum posts left (this month)',
    postsLeftValue: 'You have {{remaining}} of 3 posts left this month',
    examTitle: 'Skill Verification / Exam',
    examPendingBody: 'Take the exam to activate your freelancer status',
    examStart: 'Start Exam',
    examVerifiedBadge: 'Verified Freelancer ✅',
    mentorshipButton: 'Help / Mentorship',
    mentorshipModalTitle: 'Request Help',
    mentorshipModalHint: 'Describe what you need help with (an order, a gig, or anything else) — a CDC mentor will reach out soon.',
    mentorshipPlaceholder: 'e.g. I need help with the technical side of my current gig...',
    mentorshipSubmit: 'Send',
    mentorshipSubmitting: 'Sending…',
    mentorshipSentTitle: 'Request sent!',
    mentorshipSentBody: 'A CDC mentor will reach out to you soon.',
    mentorshipClose: 'Close',
    mentorshipError: 'Unable to send the request.',
  },
};

const GIG_STATUS_BADGE: Record<GigStatus, string> = {
  open: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/30',
  assigned: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
  submitted: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
};

const PAYOUT_STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  APPROVED: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
  REJECTED: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  PAID: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
};

const PAYMENT_STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  COMPLETED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  FAILED: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  CANCELLED: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/30',
  REFUNDED: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
};

function formatGel(minorUnits: number): string {
  return `${(minorUnits / 100).toFixed(2)} ₾`;
}

function formatMoney(minorUnits: number, currency: string): string {
  return `${(minorUnits / 100).toFixed(2)} ${currency === 'GEL' ? '₾' : currency}`;
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
      <div
        className="bg-gradient-to-r from-cyan-500 to-purple-500 h-full transition-all duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

// isVerifiedGraduate is the app-wide "verified freelancer" flag — set by
// either graduating a course or passing the freelancer skill exam (see
// Backend's routes/freelancerExam.ts and routes/courses.ts) — and gates gig/
// vacancy applications, uncapped forum posting, and mentorship access.
function FreelancerExamCard({ user, t }: { user: User; t: typeof dict['ka']; }) {
  if (user.isVerifiedGraduate) {
    return (
      <div className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 flex items-center justify-between gap-3 h-full">
        <h2 className="text-sm font-extrabold tracking-wide text-slate-800 dark:text-slate-100">{t.examTitle}</h2>
        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">{t.examVerifiedBadge}</span>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-cyan-300 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/30 p-4 flex flex-wrap items-center justify-between gap-3 h-full">
      <div>
        <h2 className="text-sm font-extrabold tracking-wide text-slate-800 dark:text-slate-100">{t.examTitle}</h2>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{t.examPendingBody}</p>
      </div>
      <Link
        href="/freelancer/exam"
        className="inline-block text-xs font-bold text-white bg-slate-900 dark:bg-cyan-600 px-4 py-2.5 rounded-xl no-underline shrink-0"
      >
        {t.examStart}
      </Link>
    </div>
  );
}

function DashboardContent() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  // IAKO Trainer Tools — sidebar entry only when the signed-in user has an
  // active TrainerProfile (server-verified via GET /trainer/me, see
  // trainerWorkspaceService.ts). Deliberately not a Role check — a Mentor or
  // admin without a TrainerProfile must not see it.
  const [isTrainer, setIsTrainer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<MyCourseWithProgress[]>([]);
  const [gigs, setGigs] = useState<AssignedGig[]>([]);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequestRow[]>([]);
  const [payments, setPayments] = useState<MyPaymentRow[]>([]);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [purchasedProducts, setPurchasedProducts] = useState<DigitalProduct[]>([]);
  const [myBooks, setMyBooks] = useState<BookListItem[]>([]);
  const [downloadingProductId, setDownloadingProductId] = useState<string | null>(null);
  const [productDownloadError, setProductDownloadError] = useState<string | null>(null);
  const [mySubmissions, setMySubmissions] = useState<DigitalProduct[]>([]);
  const [launchKitTarget, setLaunchKitTarget] = useState<{ productId: string; title: string } | null>(null);
  const [showAiMarketingAssistant, setShowAiMarketingAssistant] = useState(false);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitTitle, setSubmitTitle] = useState('');
  const [submitDescription, setSubmitDescription] = useState('');
  const [submitPrice, setSubmitPrice] = useState('');
  const [submitCategory, setSubmitCategory] = useState('');
  const [submitImageUrl, setSubmitImageUrl] = useState('');
  const [submitPreviewImages, setSubmitPreviewImages] = useState<string[]>([]);
  const [submitFileUrl, setSubmitFileUrl] = useState('');
  const [submitVideoUrl, setSubmitVideoUrl] = useState('');
  const [submitVideoUploading, setSubmitVideoUploading] = useState(false);
  const [submitLicenseType, setSubmitLicenseType] = useState<ProductLicenseType>('PERSONAL_USE');
  const [submitDiscountedPrice, setSubmitDiscountedPrice] = useState('');
  const [submitSaleEndsAt, setSubmitSaleEndsAt] = useState('');
  const [submitFileUploading, setSubmitFileUploading] = useState(false);
  const [submitFileUploadError, setSubmitFileUploadError] = useState<string | null>(null);
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Fallback only (matches productSaleService.ts's own FALLBACK_PERCENTAGE
  // for DIGITAL_PRODUCT_VERIFIED) — used until GET /commissions resolves, so
  // the commission banner below never shows a stale/wrong rate while loading.
  // NOTE: always looks up the VERIFIED rate, not the +5% Unverified Tier
  // Surcharge one — this component's `user` doesn't carry
  // verificationLevel/verificationStatus/isVerified (only isVerifiedGraduate),
  // so it can't reproduce the backend's full isIdentityVerified() check.
  // An unverified uploader will see a lower estimate here than they're
  // actually charged at sale time; flagged, not fixed, in this pass.
  const [digitalProductCommissionPct, setDigitalProductCommissionPct] = useState(20);
  useEffect(() => {
    getTrainerMe().then((result) => setIsTrainer(result.isTrainer)).catch(() => setIsTrainer(false));
  }, []);

  useEffect(() => {
    getFeeSchedule()
      .then((schedule) => {
        const pct = findRate(schedule, 'DIGITAL_PRODUCT_VERIFIED');
        if (pct != null) setDigitalProductCommissionPct(pct);
      })
      .catch(() => {
        // Commission banner just keeps showing the fallback rate above.
      });
  }, []);

  // isVerifiedGraduate covers both "passed the freelancer exam" and "CDC
  // course graduate" (see Backend's freelancerExam.ts/courses.ts — same
  // flag, not two separate booleans); admin-team members can submit too.
  const canSubmitProduct = !!user && (user.isVerifiedGraduate || !!user.adminRole);

  const [downloadingCourseId, setDownloadingCourseId] = useState<string | null>(null);
  const [confirmCourseId, setConfirmCourseId] = useState<string | null>(null);
  const [certDownloadError, setCertDownloadError] = useState<string | null>(null);
  const [certLimitMessage, setCertLimitMessage] = useState<string | null>(null);
  const [requestingMentorFor, setRequestingMentorFor] = useState<string | null>(null);

  useEscapeToClose(confirmCourseId !== null, () => setConfirmCourseId(null));
  useEscapeToClose(certLimitMessage !== null, () => setCertLimitMessage(null));

  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutIban, setPayoutIban] = useState('');
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  const [showMentorshipModal, setShowMentorshipModal] = useState(false);
  const [mentorshipMessage, setMentorshipMessage] = useState('');
  const [mentorshipSubmitting, setMentorshipSubmitting] = useState(false);
  const [mentorshipError, setMentorshipError] = useState<string | null>(null);
  const [mentorshipSent, setMentorshipSent] = useState(false);

  useEscapeToClose(showMentorshipModal, () => setShowMentorshipModal(false));

  useEffect(() => {
    // Clients get their own dedicated dashboard — this one is student-
    // facing. Mentors used to be redirected away to /dashboard/mentorship
    // too, which meant a Mentor could never see their own courses/wallet/
    // digital products/settings here — a Mentor is still a regular
    // platform user underneath (see Role enum: Mentor is a value of the
    // same single `role` field Student/Client use, not a separate add-on
    // flag), so those sections are just as real for them. They now see
    // this standard dashboard like everyone else, plus the Mentor
    // Workspace sidebar link below.
    if (user?.role === 'Client') {
      router.replace('/dashboard/client');
    }
  }, [user?.role, router]);

  // Deep-link support for SiteHeader's "My Courses" menu item
  // (/dashboard?tab=courses) and same-page CTA cards like
  // DigitalStoreCTACard (/dashboard?tab=products) — re-syncs whenever the
  // query param itself changes, not just on initial mount. A cross-page
  // link makes router.isReady flip false->true, which used to be the only
  // thing that re-ran this; but a card ALREADY on /dashboard linking to
  // /dashboard?tab=products is a same-page query-only transition that never
  // changes router.isReady, so that alone silently no-opped (URL updated,
  // visible tab didn't). router.query.tab is now also a dependency, and
  // that's safe against fighting the tab buttons' own setActiveTab — a
  // button click never changes the URL, so it can never retrigger this.
  useEffect(() => {
    const queryTab = router.query.tab;
    if (queryTab === 'purchases' || queryTab === 'courses' || queryTab === 'wallet' || queryTab === 'gigs') {
      setActiveTab(queryTab);
    } else if (queryTab === 'products') {
      // Purchased products now live under "My purchases"; the products tab
      // itself is only the seller workspace, so a non-seller following an
      // old ?tab=products link lands on their purchases instead.
      setActiveTab(canSubmitProduct ? 'products' : 'purchases');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.tab, canSubmitProduct]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // allSettled, not all: with Promise.all a single failing request
      // (e.g. the forum quota) rejected the whole batch and left every
      // section empty — including the user's purchases.
      const [coursesRes, gigsRes, walletRes, payoutRes, paymentsRes, productsRes, booksRes] = await Promise.allSettled([
        getMyCourses(),
        getAssignedGigs(),
        getWalletSummary(),
        getMyPayoutRequests(),
        getMyPayments(),
        getProducts(),
        listMyBooks(),
      ]);
      if (coursesRes.status === 'fulfilled') setCourses(coursesRes.value);
      if (gigsRes.status === 'fulfilled') setGigs(gigsRes.value);
      if (walletRes.status === 'fulfilled') setWallet(walletRes.value);
      if (payoutRes.status === 'fulfilled') setPayoutRequests(payoutRes.value);
      if (paymentsRes.status === 'fulfilled') setPayments(paymentsRes.value);
      if (productsRes.status === 'fulfilled') setPurchasedProducts(productsRes.value.filter((p) => p.purchased));
      if (booksRes.status === 'fulfilled') setMyBooks(booksRes.value);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (user?.payoutIban) setPayoutIban(user.payoutIban);
  }, [user?.payoutIban]);

  useEffect(() => {
    if (activeTab === 'products' && canSubmitProduct) {
      getMySubmissions()
        .then(setMySubmissions)
        .catch(() => {});
    }
  }, [activeTab, canSubmitProduct]);

  const submitDiscountError = useMemo(() => {
    if (!submitDiscountedPrice) return null;
    return validateProductDiscount(Number(submitPrice) || 0, Number(submitDiscountedPrice) || 0);
  }, [submitPrice, submitDiscountedPrice]);

  // Mirrors Backend's products.ts validateSubmitterPrice exactly: only an
  // admin-team member (user.adminRole set) may publish a 0 GEL product —
  // a regular seller's price must clear the 2 GEL floor that covers the
  // payment gateway's own per-transaction fee. Checked live as the seller
  // types, not just on submit, so the button disables before they even try.
  const MIN_SUBMITTER_PRICE_GEL = 2;
  const submitPriceError =
    submitPrice === '' || !!user?.adminRole
      ? null
      : Number(submitPrice) === 0
        ? 'Only CDC admins can publish a free (0 GEL) product. Set a price of at least 2 GEL, or ask an admin to publish it as a free lead-magnet listing.'
        : Number(submitPrice) < MIN_SUBMITTER_PRICE_GEL
          ? `Price must be at least ${MIN_SUBMITTER_PRICE_GEL} GEL to cover payment processing fees.`
          : null;

  const handleSubmitProduct = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (submitPriceError) return setSubmitError(submitPriceError);
    if (submitDiscountError) return setSubmitError(submitDiscountError);
    setSubmittingProduct(true);
    try {
      // Editing an existing NEEDS_REVISION/PENDING submission resubmits it
      // (server resets status back to PENDING) rather than creating a
      // second, duplicate product — see productService.ts's updateMyProduct.
      // fileUrl is never returned by GET /mine/submissions (DigitalProduct
      // has no fileUrl field client-side at all), so startEditSubmission
      // leaves submitFileUrl blank — only sent when the submitter actually
      // picks a replacement file; otherwise the existing file is left as-is.
      if (editingSubmissionId) {
        await updateMyProduct(editingSubmissionId, {
          title: submitTitle,
          description: submitDescription,
          price: Number(submitPrice) || 0,
          category: submitCategory,
          imageUrl: submitImageUrl,
          previewImages: submitPreviewImages,
          previewVideoUrl: submitVideoUrl || null,
          licenseType: submitLicenseType,
          discountedPrice: submitDiscountedPrice ? Number(submitDiscountedPrice) : null,
          saleEndsAt: submitSaleEndsAt || null,
          ...(submitFileUrl ? { fileUrl: submitFileUrl } : {}),
        });
      } else {
        await submitProduct({
          title: submitTitle,
          description: submitDescription,
          price: Number(submitPrice) || 0,
          category: submitCategory,
          imageUrl: submitImageUrl,
          previewImages: submitPreviewImages,
          previewVideoUrl: submitVideoUrl || null,
          fileUrl: submitFileUrl,
          licenseType: submitLicenseType,
          discountedPrice: submitDiscountedPrice ? Number(submitDiscountedPrice) : null,
          saleEndsAt: submitSaleEndsAt || null,
        });
      }
      setSubmitTitle('');
      setSubmitDescription('');
      setSubmitPrice('');
      setSubmitCategory('');
      setSubmitImageUrl('');
      setSubmitPreviewImages([]);
      setSubmitFileUrl('');
      setSubmitVideoUrl('');
      setSubmitLicenseType('PERSONAL_USE');
      setSubmitDiscountedPrice('');
      setSubmitSaleEndsAt('');
      setEditingSubmissionId(null);
      setShowSubmitForm(false);
      setMySubmissions(await getMySubmissions());
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message ?? t.submitProductFailed);
    } finally {
      setSubmittingProduct(false);
    }
  };

  const startEditSubmission = (s: DigitalProduct) => {
    setEditingSubmissionId(s.id);
    setSubmitTitle(s.title);
    setSubmitDescription(s.description);
    setSubmitPrice(String(s.price / 100));
    setSubmitCategory(s.category);
    setSubmitImageUrl(s.imageUrl);
    setSubmitPreviewImages(s.previewImages);
    setSubmitVideoUrl(s.previewVideoUrl ?? '');
    setSubmitLicenseType(s.licenseType);
    setSubmitDiscountedPrice(s.discountedPrice != null ? String(s.discountedPrice / 100) : '');
    // <input type="datetime-local"> needs "YYYY-MM-DDTHH:mm", not a full ISO
    // string with seconds/ms/timezone — slice(0, 16) trims exactly that.
    setSubmitSaleEndsAt(s.saleEndsAt ? s.saleEndsAt.slice(0, 16) : '');
    setSubmitFileUrl(''); // fileUrl is never exposed to the client — re-upload if it needs to change, otherwise the existing file stays untouched (omitted from the payload).
    setSubmitError(null);
    setShowSubmitForm(true);
  };

  const handleSubmitAssetFile = async (file: File) => {
    setSubmitFileUploadError(null);
    setSubmitFileUploading(true);
    try {
      setSubmitFileUrl(await uploadMyProductFile(file));
    } catch (err: any) {
      setSubmitFileUploadError(err?.response?.data?.message ?? t.fileUploadFailed);
    } finally {
      setSubmitFileUploading(false);
    }
  };

  const handleSubmitVideoFile = async (file: File) => {
    setSubmitVideoUploading(true);
    try {
      setSubmitVideoUrl(await uploadMyProductVideo(file));
    } catch {
      // Non-fatal — the demo video is optional, leave whatever was there.
    } finally {
      setSubmitVideoUploading(false);
    }
  };

  // Same legal-name precedence as the certificate generator and learn.tsx's
  // confirmation modal — keeps every "what name prints on the cert" surface
  // in sync with a single rule.
  const certificateNameKa =
    user?.legalFirstNameKa && user?.legalLastNameKa ? `${user.legalFirstNameKa} ${user.legalLastNameKa}` : user?.name ?? '';
  const certificateNameEn =
    user?.legalFirstNameEn && user?.legalLastNameEn ? `${user.legalFirstNameEn} ${user.legalLastNameEn}` : null;

  const handleDownloadCertificate = async (courseId: string, courseTitle: string) => {
    setDownloadingCourseId(courseId);
    setCertDownloadError(null);
    try {
      const blob = await downloadCertificate(courseId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate-${courseTitle}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setConfirmCourseId(null);
    } catch (err: any) {
      // responseType: 'blob' means an error response's JSON body arrives as
      // a Blob too, not parsed data — err.response.data.message would be
      // undefined even when the server sent a real error message. Without
      // this, a failed request (e.g. the one-download-per-course limit)
      // just silently reset the button with no feedback at all.
      const errorBlob = err?.response?.data;
      let serverMessage: string | undefined;
      let serverErrorKey: string | undefined;
      if (errorBlob instanceof Blob) {
        try {
          const parsed = JSON.parse(await errorBlob.text());
          serverMessage = parsed?.message;
          serverErrorKey = parsed?.error;
        } catch {
          // not JSON — ignore, fall back to the generic message below
        }
      }
      if (serverErrorKey === 'DOWNLOAD_LIMIT_REACHED') {
        setConfirmCourseId(null);
        setCertLimitMessage(serverMessage ?? t.certLimitMessage);
      } else {
        setCertDownloadError(serverMessage || t.certDownloadFailed);
      }
    } finally {
      setDownloadingCourseId(null);
    }
  };

  const handleDownloadInvoice = async (paymentId: string) => {
    setInvoiceError(null);
    setDownloadingInvoiceId(paymentId);
    try {
      const blob = await downloadInvoice(paymentId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${paymentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setInvoiceError(t.invoiceDownloadFailed);
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const handleDownloadProduct = async (productId: string) => {
    setProductDownloadError(null);
    setDownloadingProductId(productId);
    try {
      const { fileUrl } = await getProductDownload(productId);
      // window.open after an await is often blocked as a popup; fall back
      // to navigating the current tab so the download still starts. (No
      // 'noopener' feature string: with it window.open always returns null,
      // which would make the fallback fire even when the tab did open.)
      const opened = window.open(fileUrl, '_blank');
      if (opened) opened.opener = null;
      else window.location.assign(fileUrl);
    } catch {
      setProductDownloadError(t.downloadFailed);
    } finally {
      setDownloadingProductId(null);
    }
  };

  const handleRequestMentorHelp = async (gigId: string) => {
    setRequestingMentorFor(gigId);
    try {
      const updated = await requestMentorHelp(gigId);
      setGigs((prev) => prev.map((g) => (g.id === gigId ? updated : g)));
    } finally {
      setRequestingMentorFor(null);
    }
  };

  const closeMentorshipModal = () => {
    setShowMentorshipModal(false);
    setMentorshipMessage('');
    setMentorshipError(null);
    setMentorshipSent(false);
  };

  const handleMentorshipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMentorshipError(null);
    if (mentorshipMessage.trim().length < 5) {
      setMentorshipError(lang === 'ka' ? 'გთხოვთ დაწეროთ მეტი დეტალი.' : 'Please add a bit more detail.');
      return;
    }
    setMentorshipSubmitting(true);
    try {
      await createMentorshipRequest(mentorshipMessage.trim());
      setMentorshipSent(true);
    } catch {
      setMentorshipError(t.mentorshipError);
    } finally {
      setMentorshipSubmitting(false);
    }
  };

  const handlePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutError(null);
    const minorAmount = Math.round(Number(payoutAmount) * 100);
    if (!minorAmount || minorAmount < 100) {
      setPayoutError(lang === 'ka' ? 'შეიყვანეთ სწორი თანხა.' : 'Enter a valid amount.');
      return;
    }
    setPayoutSubmitting(true);
    try {
      await createPayoutRequest(minorAmount, payoutIban || undefined);
      setPayoutAmount('');
      const [walletData, payoutData] = await Promise.all([getWalletSummary(), getMyPayoutRequests()]);
      setWallet(walletData);
      setPayoutRequests(payoutData);
    } catch (err: any) {
      setPayoutError(err?.response?.data?.message ?? (lang === 'ka' ? 'მოთხოვნის გაგზავნა ვერ მოხერხდა.' : 'Unable to submit request.'));
    } finally {
      setPayoutSubmitting(false);
    }
  };

  const certificatesEarned = courses.filter((c) => c.hasCertificate).length;
  // Points the AI Tutor promo card at whichever enrolled course still has
  // work left — falls back to the first enrolled course if everything's
  // already complete, so the card still links somewhere valid.
  const inProgressCourse = courses.find((c) => c.progress.percent < 100) ?? courses[0];
  const escrowBalance = gigs
    .filter((g) => g.transaction?.status === 'HELD_IN_ESCROW')
    .reduce((sum, g) => sum + (g.transaction?.netAmount ?? 0), 0);

  const confirmCourse = courses.find((c) => c.course.id === confirmCourseId)?.course ?? null;

  const ownedBooks = purchasedBooks(myBooks, payments);
  const purchasesCount = ownedBooks.length + courses.length + purchasedProducts.length;
  const purchasesLabel = lang === 'ka' ? 'ჩემი შენაძენები' : 'My purchases';

  // Primary sections. Gigs only shows for people who actually freelance
  // (have a gig, or chose the freelancer path); the products tab is the
  // seller workspace, so it only shows for people allowed to sell.
  const NAV: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { key: 'overview', label: t.tabOverview, icon: LayoutDashboard },
    { key: 'purchases', label: purchasesLabel, icon: Receipt },
    { key: 'courses', label: t.tabCourses, icon: GraduationCap },
    { key: 'wallet', label: t.tabWallet, icon: Wallet },
    ...(gigs.length > 0 || user?.primaryIntent === 'TALENT' ? [{ key: 'gigs' as Tab, label: t.tabGigs, icon: Briefcase }] : []),
    ...(canSubmitProduct ? [{ key: 'products' as Tab, label: lang === 'ka' ? 'ჩემი პროდუქტების გაყიდვა' : 'Sell products', icon: Store }] : []),
  ];

  // Secondary destinations: plain links, visually lighter than the tabs so
  // the sidebar reads as "a few sections + a short list of extras".
  const MORE_LINKS: { href: string; label: string; icon: typeof LayoutDashboard; show: boolean }[] = [
    { href: '/dashboard/tools', label: lang === 'ka' ? 'ჩემი ხელსაწყოები' : 'My tools', icon: Sparkles, show: true },
    { href: '/dashboard/live-trainings', label: lang === 'ka' ? 'ლაივ ტრენინგები' : 'Live trainings', icon: Video, show: true },
    { href: '/dashboard/mentorship-sessions', label: t.tabMentorshipSessions, icon: CalendarClock, show: true },
    { href: '/dashboard/mentorship', label: t.mentorWorkspace, icon: Users, show: user?.role === 'Mentor' },
    { href: '/dashboard/trainer', label: lang === 'ka' ? 'ტრენერის პანელი' : 'Trainer Control Center', icon: GraduationCap, show: isTrainer },
    { href: '/dashboard/career-quiz', label: lang === 'ka' ? 'ჩემი კარიერული ტესტი' : 'My Career Test', icon: Award, show: true },
    { href: '/dashboard/settings', label: t.tabSettings, icon: Settings, show: true },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t.title} | CDC Platform`}</title>
      </Head>

      <SiteHeader />

      <div className="max-w-7xl 2xl:max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 md:py-8 grid md:grid-cols-4 xl:grid-cols-5 gap-6 md:gap-8 flex-1 w-full">
        {/* SIDE MENU */}
        <nav className="md:sticky md:top-24 self-start space-y-4 min-w-0">
          <div className="space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={`w-full flex items-center gap-2.5 text-left px-3 py-2.5 rounded-lg text-sm font-semibold transition border-none cursor-pointer ${
                    active
                      ? 'bg-slate-900 dark:bg-cyan-600 text-white'
                      : 'bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.key === 'purchases' && purchasesCount > 0 && (
                    <span className={`text-[11px] font-bold px-1.5 rounded ${active ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700'}`}>{purchasesCount}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-0.5">
            {user?.isVerifiedGraduate && (
              <button
                type="button"
                onClick={() => setShowMentorshipModal(true)}
                className="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg text-xs font-semibold bg-transparent border-none cursor-pointer text-cyan-700 dark:text-cyan-300 hover:bg-slate-200/60 dark:hover:bg-slate-800"
              >
                <Wifi className="w-3.5 h-3.5 shrink-0" />
                {t.mentorshipButton}
              </button>
            )}
            {MORE_LINKS.filter((l) => l.show).map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 no-underline"
              >
                <l.icon className="w-3.5 h-3.5 shrink-0" />
                {l.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => { logout(); router.push('/'); }}
              className="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg text-xs font-semibold bg-transparent border-none cursor-pointer text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              {t.logout}
            </button>
          </div>
        </nav>

        {/* CONTENT */}
        <div className="md:col-span-3 xl:col-span-4 space-y-6 min-w-0">
          {loading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.loading}</p>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-xl font-extrabold">
                      {lang === 'ka' ? 'გამარჯობა' : 'Hello'}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
                    </h1>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: purchasesLabel, value: String(purchasesCount), icon: Receipt, onClick: () => setActiveTab('purchases') },
                      { label: t.statCourses, value: String(courses.length), icon: GraduationCap, onClick: () => setActiveTab('courses') },
                      { label: t.statCerts, value: String(certificatesEarned), icon: Award, onClick: () => setActiveTab('courses') },
                      { label: t.statWallet, value: wallet ? formatGel(wallet.earningsBalance) : '—', icon: Wallet, onClick: () => setActiveTab('wallet') },
                    ].map((stat) => (
                      <button
                        key={stat.label}
                        type="button"
                        onClick={stat.onClick}
                        className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 cursor-pointer hover:border-cyan-400/60 transition"
                      >
                        <stat.icon className="w-4 h-4 text-slate-500 dark:text-slate-400 mb-2" />
                        <p className="text-xl font-black text-slate-900 dark:text-white">{stat.value}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{stat.label}</p>
                      </button>
                    ))}
                  </div>

                  <MyPurchasesPanel
                    compact
                    lang={lang}
                    books={ownedBooks}
                    courses={courses}
                    products={purchasedProducts}
                    onDownloadProduct={handleDownloadProduct}
                    downloadingProductId={downloadingProductId}
                    productDownloadError={productDownloadError}
                    onSeeAll={() => setActiveTab('purchases')}
                  />

                  {inProgressCourse && inProgressCourse.progress.percent < 100 && (
                    <Link
                      href={`/courses/${inProgressCourse.course.id}/learn`}
                      className="flex items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 no-underline text-current hover:border-cyan-400/60 transition"
                    >
                      <div className="shrink-0 w-10 h-10 rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{inProgressCourse.course.title}</p>
                        <div className="mt-2"><ProgressBar percent={inProgressCourse.progress.percent} /></div>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-cyan-600 dark:text-cyan-400 whitespace-nowrap">
                        {lang === 'ka' ? 'გაგრძელება →' : 'Continue →'}
                      </span>
                    </Link>
                  )}

                  {user?.role === 'Student' && !user.isVerifiedGraduate && <FreelancerExamCard user={user} t={t} />}
                </div>
              )}

              {activeTab === 'purchases' && (
                <MyPurchasesPanel
                  lang={lang}
                  books={ownedBooks}
                  courses={courses}
                  products={purchasedProducts}
                  onDownloadProduct={handleDownloadProduct}
                  downloadingProductId={downloadingProductId}
                  productDownloadError={productDownloadError}
                />
              )}

              {activeTab === 'courses' && (
                <div className="space-y-4">
                  {user?.role === 'Student' && <FreelancerExamCard user={user} t={t} />}
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h2 className="text-lg font-extrabold tracking-wide">{t.coursesTitle}</h2>
                    {certificatesEarned > 0 && (
                      <Link
                        href="/dashboard/certificates"
                        className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline no-underline whitespace-nowrap"
                      >
                        {t.viewAllCertificates} →
                      </Link>
                    )}
                  </div>
                  {courses.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-10 text-center">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t.noCourses}</p>
                      <Link
                        href="/courses"
                        className="inline-block text-xs font-bold text-white bg-slate-900 dark:bg-cyan-600 px-4 py-2.5 rounded-xl no-underline"
                      >
                        {t.browseCourses}
                      </Link>
                    </div>
                  ) : (
                    courses.map(({ course, progress, hasCertificate, certificateDownloadCount }) => (
                      <div
                        key={course.id}
                        className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4"
                      >
                        <h3 className="font-bold text-base text-slate-900 dark:text-white tracking-wide">{course.title}</h3>
                        <div>
                          <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                            <span>{t.progress}</span>
                            <span>{progress.percent}%</span>
                          </div>
                          <ProgressBar percent={progress.percent} />
                        </div>
                        <div className="flex flex-wrap justify-end gap-2 pt-2">
                          <Link
                            href={`/courses/${course.id}/learn`}
                            className="text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 no-underline hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            {t.continue}
                          </Link>
                          {progress.percent >= 100 ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (certificateDownloadCount >= 1) {
                                  setCertLimitMessage(t.certLimitMessage);
                                  return;
                                }
                                setCertDownloadError(null);
                                setConfirmCourseId(course.id);
                              }}
                              disabled={downloadingCourseId === course.id}
                              className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition disabled:opacity-60"
                            >
                              <GraduationCap className="w-3.5 h-3.5" />
                              {downloadingCourseId === course.id ? t.generating : t.downloadCert}
                            </button>
                          ) : (
                            !hasCertificate && (
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 self-center">{t.certLocked}</span>
                            )
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'wallet' && (
                <div className="space-y-8">
                  <h2 className="text-lg font-extrabold tracking-wide">{t.walletTitle}</h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-6">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t.availableBalance}</p>
                      <p className="text-3xl font-black text-cyan-600 dark:text-cyan-300">{formatGel(wallet?.earningsBalance ?? 0)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-6">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t.escrowBalance}</p>
                      <p className="text-3xl font-black text-amber-600 dark:text-amber-300">{formatGel(escrowBalance)}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-6">
                    <h3 className="text-sm font-bold mb-1">{t.requestPayout}</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">{t.ibanHint}</p>
                    {payoutError && (
                      <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs text-red-600 dark:text-red-300">
                        {payoutError}
                      </div>
                    )}
                    <form onSubmit={handlePayoutSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder={t.amount}
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                      <input
                        placeholder={t.iban}
                        value={payoutIban}
                        onChange={(e) => setPayoutIban(e.target.value)}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                      <button
                        type="submit"
                        disabled={payoutSubmitting}
                        className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                      >
                        {payoutSubmitting ? t.submitting : t.submit}
                      </button>
                    </form>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold mb-4">{t.payoutHistory}</h3>
                    {payoutRequests.length === 0 ? (
                      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-8 text-center">
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t.noPayouts}</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-xs">
                          <tbody>
                            {payoutRequests.map((r) => (
                              <tr key={r.id} className="border-b last:border-0 border-slate-200 dark:border-slate-800">
                                <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{formatGel(r.amount)}</td>
                                <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400">{r.iban}</td>
                                <td className="px-4 py-3 text-slate-500 dark:text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-right">
                                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${PAYOUT_STATUS_BADGE[r.status]}`}>
                                    {r.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-bold mb-4">{t.paymentHistory}</h3>
                    {invoiceError && (
                      <p className="text-xs font-medium text-rose-600 dark:text-rose-400 mb-3">{invoiceError}</p>
                    )}
                    {payments.length === 0 ? (
                      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-8 text-center">
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t.noPayments}</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-xs">
                          <tbody>
                            {payments.map((p) => (
                              <tr key={p.id} className="border-b last:border-0 border-slate-200 dark:border-slate-800">
                                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{t.paymentPurpose[p.purpose] ?? p.purpose}</td>
                                <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                                  {p.referenceTitle ?? '—'}
                                  {p.promoCode && (
                                    <span className="ml-2 inline-block text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                      {p.promoCode}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{formatMoney(p.amount, p.currency)}</td>
                                <td className="px-4 py-3 text-slate-500 dark:text-slate-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${PAYMENT_STATUS_BADGE[p.status]}`}>
                                      {p.status}
                                    </span>
                                    {p.status === 'COMPLETED' && (
                                      <button
                                        type="button"
                                        onClick={() => handleDownloadInvoice(p.id)}
                                        disabled={downloadingInvoiceId === p.id}
                                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60"
                                      >
                                        <Download className="w-3 h-3" />
                                        {downloadingInvoiceId === p.id ? t.loading : t.downloadInvoiceLabel}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'gigs' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-extrabold tracking-wide mb-2">{t.gigsTitle}</h2>
                  {gigs.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-10 text-center">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t.noGigs}</p>
                      <Link
                        href="/gigs"
                        className="inline-block text-xs font-bold text-white bg-slate-900 dark:bg-cyan-600 px-4 py-2.5 rounded-xl no-underline"
                      >
                        {t.browseGigs}
                      </Link>
                    </div>
                  ) : (
                    gigs.map((gig) => (
                      <div
                        key={gig.id}
                        className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3"
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <h3 className="font-bold text-base text-slate-900 dark:text-white tracking-wide">{gig.title}</h3>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-1">
                              {t.budget}: {formatGel(gig.budgetAmount)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${GIG_STATUS_BADGE[gig.status]}`}>
                              {gig.status}
                            </span>
                            {gig.isFirstOrder && (
                              <span className="text-[10px] font-bold uppercase px-2 py-1 rounded border bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30">
                                {t.firstOrderBadge}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2 pt-2">
                          <Link
                            href={`/messages/${gig.postedById}`}
                            className="text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 no-underline hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            {t.chat}
                          </Link>
                          {gig.isFirstOrder &&
                            (gig.mentorHelpRequestedAt ? (
                              <span className="flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {t.mentorRequested}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRequestMentorHelp(gig.id)}
                                disabled={requestingMentorFor === gig.id}
                                className="flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition disabled:opacity-60"
                              >
                                <LifeBuoy className="w-3.5 h-3.5" />
                                {t.mentorHelp}
                              </button>
                            ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'products' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h2 className="text-lg font-extrabold tracking-wide">{t.productsTitle}</h2>
                    {canSubmitProduct && (
                      <button
                        type="button"
                        onClick={() => setShowSubmitForm((open) => !open)}
                        className="text-xs font-bold px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-cyan-600 text-white border-none cursor-pointer"
                      >
                        {t.addProduct}
                      </button>
                    )}
                  </div>

                  {showSubmitForm && (
                    <form
                      onSubmit={handleSubmitProduct}
                      className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-6 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <h3 className="text-sm font-bold">{editingSubmissionId ? t.editSubmissionTitle : t.submitProductTitle}</h3>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowAiMarketingAssistant(true)}
                            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-500 text-white border-none cursor-pointer shadow-md shadow-purple-500/30 hover:shadow-purple-500/50 transition-shadow"
                          >
                            <Crown className="w-3.5 h-3.5" />
                            {lang === 'ka' ? 'AI მარკეტინგული ასისტენტი' : 'AI Marketing Assistant'}
                          </button>
                          <VideoTutorialLink lang={lang} />
                        </div>
                      </div>
                      {submitError && (
                        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-xs text-red-600 dark:text-red-300">
                          {submitError}
                        </div>
                      )}
                      <input
                        required
                        placeholder={t.formTitle}
                        value={submitTitle}
                        onChange={(e) => setSubmitTitle(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                      />
                      <RichTextEditor required rows={3} placeholder={t.formDescription} value={submitDescription} onChange={setSubmitDescription} />
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder={t.formPrice}
                            value={submitPrice}
                            onChange={(e) => setSubmitPrice(e.target.value)}
                            className={`w-full rounded-lg border bg-white dark:bg-slate-800 px-3 py-2 text-sm ${submitPriceError ? 'border-red-400' : 'border-slate-300 dark:border-slate-700'}`}
                          />
                          {submitPriceError && <p className="text-xs text-red-500 mt-1">{submitPriceError}</p>}
                        </div>
                        <select
                          required
                          value={submitCategory}
                          onChange={(e) => setSubmitCategory(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                        >
                          <option value="" disabled>
                            {t.formCategory}
                          </option>
                          {/* Preserves an existing product's category during edit even if it
                              predates this curated list, instead of silently swapping it on save. */}
                          {submitCategory && !DIGITAL_PRODUCT_CATEGORIES.some((c) => c.value === submitCategory) && (
                            <option value={submitCategory}>{submitCategory}</option>
                          )}
                          {DIGITAL_PRODUCT_CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.emoji} {lang === 'ka' ? c.labelKa : c.labelEn}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="rounded-lg border border-cyan-400/30 bg-cyan-50/60 dark:bg-cyan-500/10 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                        <p>{t.commissionBannerText.replace('{{rate}}', String(digitalProductCommissionPct))}</p>
                        <p className="font-bold text-cyan-700 dark:text-cyan-400 mt-0.5">
                          {t.commissionBannerNet.replace(
                            '{{amount}}',
                            (Number(submitPrice || 0) * (1 - digitalProductCommissionPct / 100)).toFixed(2)
                          )}
                        </p>
                      </div>
                      <ImageGalleryUploader
                        coverUrl={submitImageUrl}
                        onCoverChange={setSubmitImageUrl}
                        previewImages={submitPreviewImages}
                        onPreviewImagesChange={setSubmitPreviewImages}
                        uploadImage={uploadMyProductImage}
                        lang={lang}
                        labels={{
                          coverLabel: t.formCoverImage,
                          coverHint: t.formCoverHint,
                          coverSizeHint: t.formCoverSizeHint,
                          galleryLabel: t.formGalleryLabel,
                          gallerySizeHint: t.formGallerySizeHint,
                          addMore: t.formGalleryAdd,
                          uploading: t.formUploading,
                          remove: t.formRemove,
                          uploadFailed: t.imageUploadFailed,
                        }}
                      />
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{t.formAssetLabel}</label>
                        <FileDropzone
                          accept={PRODUCT_ASSET_ACCEPT}
                          uploading={submitFileUploading}
                          selectedFileName={assetFilenameFromUrl(submitFileUrl)}
                          onFile={handleSubmitAssetFile}
                          label={t.formAssetLabel}
                          hint={editingSubmissionId ? t.formAssetHintEditing : t.formAssetHint}
                          uploadingLabel={t.formUploading}
                        />
                        {submitFileUploadError && <p className="text-xs text-red-500 mt-1">{submitFileUploadError}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                          {lang === 'ka' ? 'დემო ვიდეო (არასავალდებულო)' : 'Demo Video (optional)'}
                        </label>
                        <input
                          value={submitVideoUrl}
                          onChange={(e) => setSubmitVideoUrl(e.target.value)}
                          placeholder={lang === 'ka' ? 'YouTube/Vimeo ბმული, ან ატვირთეთ ფაილი ქვემოთ' : 'YouTube/Vimeo link, or upload a file below'}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm mb-2"
                        />
                        <FileDropzone
                          accept=".mp4,.mov"
                          uploading={submitVideoUploading}
                          selectedFileName={submitVideoUrl ? assetFilenameFromUrl(submitVideoUrl) : null}
                          onFile={handleSubmitVideoFile}
                          label={lang === 'ka' ? 'ვიდეოს ატვირთვა' : 'Upload video'}
                          hint={lang === 'ka' ? 'MP4 ან MOV, მაქს. 50MB' : 'MP4 or MOV, up to 50MB'}
                          uploadingLabel={t.formUploading}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{lang === 'ka' ? 'ლიცენზია' : 'License'}</label>
                        <select
                          value={submitLicenseType}
                          onChange={(e) => setSubmitLicenseType(e.target.value as ProductLicenseType)}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                        >
                          {(Object.keys(LICENSE_LABELS) as ProductLicenseType[]).map((key) => (
                            <option key={key} value={key}>{LICENSE_LABELS[key][lang === 'ka' ? 'ka' : 'en']}</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                            {lang === 'ka' ? 'ფასდაკლებული ფასი (GEL)' : 'Discounted Price (GEL)'}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={submitDiscountedPrice}
                            onChange={(e) => setSubmitDiscountedPrice(e.target.value)}
                            placeholder={lang === 'ka' ? 'ცარიელი — ფასდაკლების გარეშე' : 'Leave blank for no sale'}
                            className={`w-full rounded-xl border bg-white dark:bg-slate-900 px-3 py-2 text-sm ${submitDiscountError ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                            {lang === 'ka' ? 'ფასდაკლება მთავრდება' : 'Sale Ends At'}
                          </label>
                          <input
                            type="datetime-local"
                            value={submitSaleEndsAt}
                            onChange={(e) => setSubmitSaleEndsAt(e.target.value)}
                            disabled={!submitDiscountedPrice}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm disabled:opacity-50"
                          />
                        </div>
                      </div>
                      {submitDiscountError && <p className="text-xs text-red-500">{submitDiscountError}</p>}
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={
                            submittingProduct ||
                            !submitImageUrl ||
                            (!editingSubmissionId && !submitFileUrl) ||
                            submitFileUploading ||
                            !!submitDiscountError ||
                            !!submitPriceError
                          }
                          className="text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-cyan-600 text-white disabled:opacity-60"
                        >
                          {submittingProduct ? t.formSubmitting : editingSubmissionId ? t.formResubmit : t.formSubmit}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowSubmitForm(false);
                            setEditingSubmissionId(null);
                          }}
                          className="text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                        >
                          {t.formCancel}
                        </button>
                      </div>
                    </form>
                  )}

                  {mySubmissions.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">{t.mySubmissionsTitle}</h3>
                      {mySubmissions.map((s) => (
                        <div
                          key={s.id}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 flex items-center justify-between gap-3 flex-wrap"
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{s.title}</p>
                            {(s.status === 'REJECTED' || s.status === 'NEEDS_REVISION') && s.rejectionReason && (
                              <p className={`text-xs mt-0.5 ${s.status === 'NEEDS_REVISION' ? 'text-orange-600' : 'text-red-500'}`}>
                                {t.rejectionReasonLabel}: {s.rejectionReason}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {(s.status === 'PENDING' || s.status === 'NEEDS_REVISION') && (
                              <button
                                type="button"
                                onClick={() => startEditSubmission(s)}
                                className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline bg-transparent border-none cursor-pointer"
                              >
                                {t.editAndResubmit}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setLaunchKitTarget({ productId: s.id, title: s.title })}
                              className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline bg-transparent border-none cursor-pointer"
                            >
                              Launch Kit
                            </button>
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-1 rounded border whitespace-nowrap ${
                                s.status === 'APPROVED'
                                  ? 'text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30'
                                  : s.status === 'REJECTED'
                                  ? 'text-red-600 border-red-300 bg-red-50 dark:bg-red-950/30'
                                  : s.status === 'NEEDS_REVISION'
                                  ? 'text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950/30'
                                  : 'text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30'
                              }`}
                            >
                              {s.status === 'APPROVED'
                                ? t.statusApproved
                                : s.status === 'REJECTED'
                                ? t.statusRejected
                                : s.status === 'NEEDS_REVISION'
                                ? t.statusNeedsRevision
                                : t.statusPending}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {lang === 'ka' ? 'შენ მიერ ნაყიდი პროდუქტები ახლა „ჩემი შენაძენების“ განყოფილებაშია.' : 'Products you bought are now under "My purchases".'}{' '}
                    <button type="button" onClick={() => setActiveTab('purchases')} className="font-bold text-cyan-600 dark:text-cyan-400 bg-transparent border-none cursor-pointer p-0">
                      {lang === 'ka' ? 'ნახვა →' : 'Open →'}
                    </button>
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {confirmCourse && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmCourseId(null)}
        >
          <div
            className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2">{t.confirmTitle}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t.confirmBody}</p>
            <p className="text-lg font-bold text-cyan-600 dark:text-cyan-300 mb-1">{certificateNameKa}</p>
            {certificateNameEn && <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{certificateNameEn}</p>}
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-6">{t.confirmChangeHint}</p>
            {certDownloadError && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400 mb-3">{certDownloadError}</p>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleDownloadCertificate(confirmCourse.id, confirmCourse.title)}
                disabled={downloadingCourseId === confirmCourse.id}
                className="w-full text-sm font-bold px-4 py-3 rounded-xl bg-slate-950 dark:bg-cyan-600 text-white hover:bg-slate-800 dark:hover:bg-cyan-500 transition disabled:opacity-60"
              >
                {downloadingCourseId === confirmCourse.id ? t.generating : t.confirmDownload}
              </button>
              <Link
                href="/dashboard/settings"
                className="w-full text-center text-sm font-bold px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 no-underline hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t.confirmChangeName}
              </Link>
              <button
                type="button"
                onClick={() => setConfirmCourseId(null)}
                className="w-full text-sm font-bold px-4 py-3 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 bg-transparent"
              >
                {t.confirmCancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {certLimitMessage && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setCertLimitMessage(null)}
        >
          <div
            className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-3">{t.certLimitTitle}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-5">{certLimitMessage}</p>
            <div className="flex flex-col gap-2">
              <a
                href={`mailto:${t.certLimitContactEmail}`}
                className="flex items-center justify-center gap-2 w-full text-sm font-bold px-4 py-3 rounded-xl bg-slate-950 dark:bg-cyan-600 text-white hover:bg-slate-800 dark:hover:bg-cyan-500 transition no-underline"
              >
                <Mail className="w-4 h-4" />
                {t.certLimitContactEmail}
              </a>
              <button
                type="button"
                onClick={() => setCertLimitMessage(null)}
                className="w-full text-sm font-bold px-4 py-3 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 bg-transparent"
              >
                {t.certLimitClose}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMentorshipModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeMentorshipModal}
        >
          <div
            className="max-w-md w-full bg-white dark:bg-slate-900 border border-cyan-400/40 rounded-2xl p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {mentorshipSent ? (
              <>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2">{t.mentorshipSentTitle}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t.mentorshipSentBody}</p>
                <button
                  type="button"
                  onClick={closeMentorshipModal}
                  className="w-full text-sm font-bold px-4 py-3 rounded-xl bg-slate-950 dark:bg-cyan-600 text-white hover:bg-slate-800 dark:hover:bg-cyan-500 transition"
                >
                  {t.mentorshipClose}
                </button>
              </>
            ) : (
              <form onSubmit={handleMentorshipSubmit}>
                <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white mb-2">
                  <Wifi className="w-4 h-4 text-cyan-500" />
                  {t.mentorshipModalTitle}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t.mentorshipModalHint}</p>
                {mentorshipError && (
                  <div className="mb-3 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs text-red-600 dark:text-red-300">
                    {mentorshipError}
                  </div>
                )}
                <textarea
                  rows={4}
                  value={mentorshipMessage}
                  onChange={(e) => setMentorshipMessage(e.target.value)}
                  placeholder={t.mentorshipPlaceholder}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <div className="flex flex-col gap-2 mt-4">
                  <button
                    type="submit"
                    disabled={mentorshipSubmitting}
                    className="w-full text-sm font-bold px-4 py-3 rounded-xl bg-slate-950 dark:bg-cyan-600 text-white hover:bg-slate-800 dark:hover:bg-cyan-500 transition disabled:opacity-60"
                  >
                    {mentorshipSubmitting ? t.mentorshipSubmitting : t.mentorshipSubmit}
                  </button>
                  <button
                    type="button"
                    onClick={closeMentorshipModal}
                    className="w-full text-sm font-bold px-4 py-3 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 bg-transparent"
                  >
                    {t.confirmCancel}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <SiteFooter />

      {launchKitTarget && (
        <LaunchKitDrawer
          target={{ productId: launchKitTarget.productId }}
          title={launchKitTarget.title}
          scope="creator"
          onClose={() => setLaunchKitTarget(null)}
        />
      )}

      {showAiMarketingAssistant && (
        <AiMarketingAssistantDrawer
          title={submitTitle}
          description={submitDescription}
          category={submitCategory}
          productId={editingSubmissionId ?? undefined}
          lang={lang}
          onApplyTitle={setSubmitTitle}
          onApplyDescription={setSubmitDescription}
          onClose={() => setShowAiMarketingAssistant(false)}
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
