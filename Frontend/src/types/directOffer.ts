interface OfferParticipant {
  id: string;
  name: string;
  role: 'Student' | 'Mentor' | 'SuperAdmin' | 'Client';
}

export type DirectOfferStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn';

export interface DirectOffer {
  id: string;
  client: OfferParticipant;
  freelancer: OfferParticipant;
  gig: { id: string; title: string } | null;
  title: string;
  description: string;
  budgetAmount: number;
  currency: string;
  message: string;
  status: DirectOfferStatus;
  createdAt: string;
  updatedAt: string;
}
