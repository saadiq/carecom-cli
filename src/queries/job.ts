export const JOB_APPLICATIONS_QUERY = `
  query JobApplications(
    $jobId: ID!
    $sortBy: JobApplicationsSortBy
    $max: Int
    $jobApplicationFilter: SeekerJobApplicationFilter
    $start: String
  ) {
    jobApplications: jobProfile(jobId: $jobId) {
      ... on JobProfileSuccess {
        job {
          id
          serviceType
          adultCareJob
          applications(
            sortBy: $sortBy
            max: $max
            jobApplicationFilter: $jobApplicationFilter
            start: $start
          ) {
            ... on JobApplicationsConnection {
              edges {
                node {
                  ...ApplicantFragment
                }
                cursor
              }
              filteredCount
              pageInfo {
                endCursor
                hasNextPage
                hasPreviousPage
                startCursor
              }
            }
          }
        }
      }
    }
  }

  fragment ApplicantFragment on JobApplicationLinkage {
    jobApplicationId
    conversationId
    seekerInterest
    privateNote
    applicant {
      ... on Caregiver {
        yearsOfExperience
        member {
          imageURL
          id
          legacyId
          isPremium
          displayName
          address {
            city
            zip
            state
          }
        }
        badges
        hiredTimes
        isFavorite
        profileURL
        messageThreadId
        profiles {
          childCareCaregiverProfile {
            id
            payRange {
              ...PayRangeFragment
            }
            recurringRate {
              ...PayRangeFragment
            }
          }
          tutoringCaregiverProfile {
            id
            payRange {
              ...PayRangeFragment
            }
            recurringRate {
              ...PayRangeFragment
            }
          }
          houseKeepingCaregiverProfile {
            id
            payRange {
              ...PayRangeFragment
            }
            recurringRate {
              ...PayRangeFragment
            }
          }
          petCareCaregiverProfile {
            id
            payRange {
              ...PayRangeFragment
            }
            recurringRate {
              ...PayRangeFragment
            }
          }
          seniorCareCaregiverProfile {
            id
            payRange {
              ...PayRangeFragment
            }
            recurringRate {
              ...PayRangeFragment
            }
          }
        }
        revieweeMetrics {
          ... on RevieweeMetricsPayload {
            metrics {
              averageRatings {
                type
                value
              }
              totalReviews
            }
          }
        }
      }
    }
  }

  fragment PayRangeFragment on PayRange {
    hourlyRateFrom {
      amount
    }
    hourlyRateTo {
      amount
    }
  }
`;

export const SET_INTEREST_MUTATION = `
  mutation JobApplicationInterest($jobApplicationId: String!, $seekerInterest: JobApplicationSeekerInterest!) {
    jobApplicationInterest(
      jobApplicationId: $jobApplicationId
      seekerInterest: $seekerInterest
    ) {
      ... on JobApplicationInterestSuccess { dummy }
      ... on JobApplicationInterestError { error }
    }
  }
`;

export const SET_PRIVATE_NOTE_MUTATION = `
  mutation JobApplicationPrivateNote($jobApplicationId: ID!, $privateNote: String) {
    jobApplicationPrivateNote(
      jobApplicationId: $jobApplicationId
      privateNote: $privateNote
    ) {
      ... on JobApplicationPrivateNoteSuccess { dummy }
      ... on JobApplicationPrivateNoteError { error }
    }
  }
`;

export const JOB_SETUP_QUERY = `
  query JobSetupCC($jobId: ID!) {
    jobSetup(id: $jobId) {
      jobId
      serviceType
      jobStatus
      oneTimeJob
      jobApplicantsCount
      jobClosedDate
      jobLocation {
        city
        state
        stateCode
        zipcode
      }
      jobInput {
        ... on ChildCareJobInputType {
          title
          description
          zipcode
          startDate
          endDate
          rate {
            minimum {
              amount
            }
            maximum {
              amount
            }
          }
        }
      }
    }
  }
`;
