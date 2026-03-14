// Config stored at ~/.config/carecom/config.json
export interface CareComConfig {
  cookies: Record<string, string>;
  defaultJobId: string;
  defaultZip: string;
  authenticatedAt: string;
  lastRefreshedAt?: string;
}

// GraphQL response wrapper
export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    path?: string[];
    extensions?: Record<string, any>;
  }>;
}

// Job & Applicant types
export interface JobApplication {
  node: Applicant;
}

export interface Applicant {
  conversationId: string;
  seekerInterest: string;
  member: MemberData;
  caregiver: CaregiverData;
  profileDescription: string;
}

export interface MemberData {
  memberId: string;
  memberUUID: string;
  displayName: string;
  firstName: string;
  lastName: string;
  imageURL: string;
  address: {
    city: string;
    state: string;
    zip: string;
  };
  legacyId: string;
}

export interface CaregiverData {
  yearsOfExperience: number;
  signUpDate: string;
  responseTime: number;
  avgReviewRating: number;
  numberOfReviews: number;
  hourlyRate: {
    amount: string;
    currencyCode: string;
  };
  recurringRate: {
    amount: string;
    currencyCode: string;
  };
  badges: string[];
  hiredLocallyCount: number;
  hasCareCheck: boolean;
  premium: boolean;
  profileDescription: string;
  qualities: string[];
  services: string[];
  languages: string[];
  education: string;
}

// Interest counts
export interface InterestCounts {
  interested: number;
  notInterested: number;
  unspecified: number;
}

// Search result types
export interface SearchResult {
  memberId: string;
  memberUUID: string;
  displayName: string;
  imageURL: string;
  city: string;
  state: string;
  yearsOfExperience: number;
  avgReviewRating: number;
  numberOfReviews: number;
  hourlyRateAmount: string;
  badges: string[];
  bio: string;
  distanceFromSearchLocation: number;
}

export interface SearchResponse {
  totalHits: number;
  hasNextPage: boolean;
  endCursor: string;
  results: SearchResult[];
}

// Notification counts
export interface NotificationCountsData {
  conversations: number;
  jobApplications: number;
  bookings: number;
}
